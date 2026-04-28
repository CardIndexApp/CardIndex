/**
 * POST /api/admin/market/seed
 * Populates market_constituents from the CI_100 seed list.
 * For each card, fetches the pokemontcg.io card by setId + number to confirm
 * the real card ID before inserting — so IDs are always accurate.
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

  let inserted = 0, skipped = 0, failed = 0
  const errors: string[] = []

  for (const seed of CI_100_DEDUPED) {
    try {
      // Resolve against pokemontcg.io — prefer set+number exact match
      const url = `https://api.pokemontcg.io/v2/cards?q=set.id:${encodeURIComponent(seed.setId)}+number:${encodeURIComponent(seed.number)}&pageSize=1`
      const res = await fetch(url, { next: { revalidate: 86400 } })
      const json = await res.json()
      const card = json.data?.[0]

      if (!card) {
        // Fall back to name search if set/number lookup misses
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
        // Use fallback match
        const { error } = await admin.from('market_constituents').upsert({
          card_id: match.id,
          grade: seed.grade,
          card_name: match.name,
          set_name: match.set?.name ?? seed.setName,
          image_url: match.images?.small ?? null,
        }, { onConflict: 'card_id,grade' })
        if (error) { failed++; errors.push(`DB error ${match.name}: ${error.message}`) } else inserted++
        continue
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

  // Also count skipped (upsert means existing rows aren't double-counted)
  const { count } = await admin.from('market_constituents').select('*', { count: 'exact', head: true })
  skipped = (count ?? 0) - inserted

  return NextResponse.json({ inserted, skipped, failed, total: count, errors })
}
