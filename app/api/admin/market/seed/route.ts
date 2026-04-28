/**
 * POST /api/admin/market/seed
 * Populates market_constituents from the CI_100 seed list.
 *
 * Resolves each card against pokemontcg.io in parallel batches of 5
 * (≈6s total) so it completes well within Vercel Hobby's 10s limit.
 *
 * Safe to re-run: upserts on (card_id, grade) so duplicates are skipped.
 * Returns { inserted, skipped, failed, errors }
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CI_100_DEDUPED, type SeedCard } from '@/lib/marketSeed'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  return p?.is_admin ? admin : null
}

type UpsertPayload = {
  card_id: string; grade: string; card_name: string
  set_name: string | null; image_url: string | null
}

/** Resolve one seed card against pokemontcg.io → upsert payload or null */
async function resolveCard(seed: SeedCard): Promise<UpsertPayload | { error: string }> {
  try {
    // Primary: exact set.id + number lookup
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
      card = fbJson.data?.find((c: { number: string }) => c.number === seed.number)
        ?? fbJson.data?.[0]
    }

    if (!card) {
      return { error: `Not found: ${seed.name} (${seed.setId}-${seed.number})` }
    }

    return {
      card_id:   card.id,
      grade:     seed.grade,
      card_name: card.name,
      set_name:  card.set?.name ?? seed.setName,
      image_url: card.images?.small ?? null,
    }
  } catch (err) {
    return { error: `Exception ${seed.name}: ${err instanceof Error ? err.message : String(err)}` }
  }
}

export async function POST() {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Resolve all cards in parallel batches of 5
  const BATCH = 5
  const resolved: (UpsertPayload | { error: string })[] = []
  for (let i = 0; i < CI_100_DEDUPED.length; i += BATCH) {
    const batch = CI_100_DEDUPED.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(resolveCard))
    resolved.push(...results)
  }

  // Upsert successes, collect errors
  let inserted = 0, failed = 0
  const errors: string[] = []

  for (const result of resolved) {
    if ('error' in result) {
      failed++
      errors.push(result.error)
      continue
    }
    const { error } = await admin
      .from('market_constituents')
      .upsert(result, { onConflict: 'card_id,grade' })
    if (error) {
      failed++
      errors.push(`DB error ${result.card_name}: ${error.message}`)
    } else {
      inserted++
    }
  }

  const { count } = await admin
    .from('market_constituents')
    .select('*', { count: 'exact', head: true })
  const skipped = (count ?? 0) - inserted

  return NextResponse.json({ inserted, skipped, failed, total: count, errors })
}
