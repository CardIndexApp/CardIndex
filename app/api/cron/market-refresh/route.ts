/**
 * GET /api/cron/market-refresh
 *
 * Called by Vercel Cron daily at 06:00 UTC (configured in vercel.json).
 *
 * On first run (market_constituents empty), auto-seeds the CI-100 list by
 * resolving each card against pokemontcg.io, then refreshes prices for every
 * constituent that hasn't been updated in the last 20 hours.
 *
 * Authentication: Vercel sets the Authorization header to
 *   Bearer <CRON_SECRET>
 * so we verify that before doing anything.
 *
 * Rate limiting: processes cards in parallel batches of 5 to stay within
 * Vercel's 300s pro / 60s hobby function timeout.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CI_100_DEDUPED } from '@/lib/marketSeed'

const STALE_MS = 20 * 60 * 60 * 1000 // 20 hours

// ── Internal helpers ────────────────────────────────────────────────────────

function siteBase(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

async function batchAll<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}

// ── Auto-seed ───────────────────────────────────────────────────────────────

interface SeedResult { inserted: number; skipped: number; failed: number; errors: string[] }

/**
 * Resolves each CI-100 seed card against pokemontcg.io and upserts into
 * market_constituents.  Safe to re-run — upserts on (card_id, grade).
 */
async function autoSeed(admin: ReturnType<typeof createAdminClient>): Promise<SeedResult> {
  let inserted = 0, skipped = 0, failed = 0
  const errors: string[] = []

  for (const seed of CI_100_DEDUPED) {
    try {
      // Primary: set.id + number exact match
      const url = `https://api.pokemontcg.io/v2/cards?q=set.id:${encodeURIComponent(seed.setId)}+number:${encodeURIComponent(seed.number)}&pageSize=1`
      const res = await fetch(url, { next: { revalidate: 86400 } })
      const json = await res.json()
      let card = json.data?.[0]

      if (!card) {
        // Fallback: name + set search
        const fb = await fetch(
          `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(seed.name)}"+set.id:${encodeURIComponent(seed.setId)}&pageSize=5`,
          { next: { revalidate: 86400 } }
        )
        const fbJson = await fb.json()
        const match = fbJson.data?.find((c: { number: string }) => c.number === seed.number) ?? fbJson.data?.[0]
        if (!match) {
          failed++
          errors.push(`Not found: ${seed.name} (${seed.setId}-${seed.number})`)
          continue
        }
        card = match
      }

      const { error } = await admin.from('market_constituents').upsert({
        card_id: card.id,
        grade: seed.grade,
        card_name: card.name,
        set_name: card.set?.name ?? seed.setName,
        image_url: card.images?.small ?? null,
      }, { onConflict: 'card_id,grade' })

      if (error) {
        failed++
        errors.push(`DB error ${card.name}: ${error.message}`)
      } else {
        inserted++
      }
    } catch (err) {
      failed++
      errors.push(`Exception ${seed.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { inserted, skipped, failed, errors }
}

// ── Price refresh ───────────────────────────────────────────────────────────

async function refreshCard(
  cardId: string,
  grade: string,
  cardName: string,
  setName: string | null
): Promise<'ok' | 'fail'> {
  try {
    const params = new URLSearchParams({ grade, name: cardName })
    if (setName) params.set('set', setName)

    const r = await fetch(
      `${siteBase()}/api/card/${encodeURIComponent(cardId)}?${params.toString()}`,
      { headers: { 'x-cron-refresh': process.env.CRON_SECRET ?? '' } }
    )
    return r.ok ? 'ok' : 'fail'
  } catch {
    return 'fail'
  }
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()
  const startedAt = Date.now()
  const log: string[] = []

  // ── Step 1: Auto-seed if table is empty ───────────────────────────────────
  const { count: constituentCount } = await admin
    .from('market_constituents')
    .select('*', { count: 'exact', head: true })

  let seedResult: SeedResult | null = null

  if ((constituentCount ?? 0) === 0) {
    log.push('market_constituents empty — running auto-seed')
    seedResult = await autoSeed(admin)
    log.push(`Auto-seed: ${seedResult.inserted} inserted, ${seedResult.failed} failed`)
    if (seedResult.errors.length) log.push(...seedResult.errors.slice(0, 10))
  }

  // ── Step 2: Load all constituents ─────────────────────────────────────────
  const { data: constituents, error } = await admin
    .from('market_constituents')
    .select('card_id, grade, card_name, set_name')

  if (error) return NextResponse.json({ error: error.message, log }, { status: 500 })
  if (!constituents?.length) {
    return NextResponse.json({ message: 'No constituents configured', refreshed: 0, log })
  }

  // ── Step 3: Find stale cards ───────────────────────────────────────────────
  const cacheKeys = constituents.map((c: { card_id: string; grade: string }) => `${c.card_id}:${c.grade}`)
  const { data: cached } = await admin
    .from('search_cache')
    .select('cache_key, last_fetched')
    .in('cache_key', cacheKeys)

  const freshnessMap = new Map(
    (cached ?? []).map((r: { cache_key: string; last_fetched: string | null }) =>
      [r.cache_key, r.last_fetched ? new Date(r.last_fetched).getTime() : 0]
    )
  )

  const toRefresh = constituents.filter((c: { card_id: string; grade: string }) => {
    const lastFetched = freshnessMap.get(`${c.card_id}:${c.grade}`) ?? 0
    return Date.now() - lastFetched > STALE_MS
  })

  if (toRefresh.length === 0) {
    return NextResponse.json({
      message: 'All constituents are fresh',
      refreshed: 0,
      total: constituents.length,
      elapsed: Date.now() - startedAt,
      seed: seedResult,
      log,
    })
  }

  // ── Step 4: Refresh stale cards in parallel batches ───────────────────────
  const results = await batchAll(
    toRefresh as { card_id: string; grade: string; card_name: string; set_name: string | null }[],
    5,
    (c) => refreshCard(c.card_id, c.grade, c.card_name, c.set_name)
  )

  const ok   = results.filter(r => r === 'ok').length
  const fail = results.filter(r => r === 'fail').length

  console.log(`[market-refresh] seed=${seedResult ? 'yes' : 'no'} refreshed=${ok} failed=${fail} ${Date.now() - startedAt}ms`)

  return NextResponse.json({
    refreshed: ok,
    failed: fail,
    skipped: constituents.length - toRefresh.length,
    total: constituents.length,
    elapsed: Date.now() - startedAt,
    seed: seedResult,
    log,
  })
}
