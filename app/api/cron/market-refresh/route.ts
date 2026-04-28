/**
 * GET /api/cron/market-refresh
 *
 * Called by Vercel Cron daily at 06:00 UTC (configured in vercel.json).
 * Refreshes Poketrace prices for every CI-100 constituent that hasn't been
 * updated in the last 20 hours, writing the result into search_cache.
 *
 * Authentication: Vercel sets the Authorization header to
 *   Bearer <CRON_SECRET>
 * so we verify that before doing anything.
 *
 * Rate limiting: processes cards in parallel batches of 5 to stay within
 * Vercel's 300s pro / 60s hobby function timeout.
 * Worst case: 100 cards / 5 per batch × ~3s per batch = ~60s.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const STALE_MS = 20 * 60 * 60 * 1000 // 20 hours

async function refreshCard(
  cardId: string,
  grade: string,
  cardName: string,
  setName: string | null
): Promise<'ok' | 'skip' | 'fail'> {
  try {
    const params = new URLSearchParams({ grade, name: cardName })
    if (setName) params.set('set', setName)

    // Call our own card API — this fetches from Poketrace and writes to search_cache
    const base = process.env.NEXT_PUBLIC_SITE_URL
      ?? process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

    const r = await fetch(`${base}/api/card/${encodeURIComponent(cardId)}?${params.toString()}`, {
      headers: {
        // Pass the service-role key so the internal request bypasses auth if needed
        'x-cron-refresh': process.env.CRON_SECRET ?? '',
      },
    })

    return r.ok ? 'ok' : 'fail'
  } catch {
    return 'fail'
  }
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

  // Fetch all constituents
  const { data: constituents, error } = await admin
    .from('market_constituents')
    .select('card_id, grade, card_name, set_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!constituents?.length) return NextResponse.json({ message: 'No constituents configured', refreshed: 0 })

  // Cross-reference with search_cache to find stale/missing
  const cacheKeys = constituents.map((c: { card_id: string; grade: string }) => `${c.card_id}:${c.grade}`)
  const { data: cached } = await admin
    .from('search_cache')
    .select('cache_key, last_fetched')
    .in('cache_key', cacheKeys)

  const freshnessMap = new Map((cached ?? []).map((r: { cache_key: string; last_fetched: string | null }) =>
    [r.cache_key, r.last_fetched ? new Date(r.last_fetched).getTime() : 0]
  ))

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
    })
  }

  // Process in batches of 5 (parallel within batch, sequential across batches)
  const results = await batchAll(
    toRefresh as { card_id: string; grade: string; card_name: string; set_name: string | null }[],
    5,
    (c) => refreshCard(c.card_id, c.grade, c.card_name, c.set_name)
  )

  const ok   = results.filter(r => r === 'ok').length
  const fail = results.filter(r => r === 'fail').length

  console.log(`[market-refresh] ${ok} refreshed, ${fail} failed, ${Date.now() - startedAt}ms`)

  return NextResponse.json({
    refreshed: ok,
    failed: fail,
    skipped: constituents.length - toRefresh.length,
    total: constituents.length,
    elapsed: Date.now() - startedAt,
  })
}
