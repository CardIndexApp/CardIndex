/**
 * POST /api/admin/market/seed
 * Populates market_constituents directly from the CI_100 seed list.
 *
 * Card IDs are constructed as "{setId}-{number}" — the standard pokemontcg.io
 * format — so no external API calls are needed. Runs in under 1 second.
 *
 * Image URLs are left null on seed; the daily cron fills them in when it
 * fetches prices from Poketrace (which also updates search_cache).
 *
 * Safe to re-run: upserts on (card_id, grade) so duplicates are skipped.
 * Returns { inserted, skipped, failed, errors }
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CI_100_DEDUPED } from '@/lib/marketSeed'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  return p?.is_admin ? admin : null
}

export async function POST() {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let inserted = 0, failed = 0
  const errors: string[] = []

  // Upsert all 100 cards in one batched DB call — no external API needed
  const rows = CI_100_DEDUPED.map(seed => ({
    card_id:   `${seed.setId}-${seed.number}`,
    grade:     seed.grade,
    card_name: seed.name,
    set_name:  seed.setName,
    image_url: null as string | null,
  }))

  const { error } = await admin
    .from('market_constituents')
    .upsert(rows, { onConflict: 'card_id,grade' })

  if (error) {
    // If bulk upsert fails, fall back to one-by-one so partial success is preserved
    for (const row of rows) {
      const { error: rowErr } = await admin
        .from('market_constituents')
        .upsert(row, { onConflict: 'card_id,grade' })
      if (rowErr) {
        failed++
        errors.push(`${row.card_name}: ${rowErr.message}`)
      } else {
        inserted++
      }
    }
  } else {
    inserted = rows.length
  }

  const { count } = await admin
    .from('market_constituents')
    .select('*', { count: 'exact', head: true })
  const skipped = (count ?? 0) - inserted

  return NextResponse.json({ inserted, skipped, failed, total: count, errors })
}
