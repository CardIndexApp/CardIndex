/**
 * GET /api/home/featured
 *
 * Returns 5 pinned featured cards for the homepage "Trending Opportunities" section.
 *
 * Each card is looked up via the existing /api/card/[id] route (which handles
 * all Poketrace lookup strategies, JP/EN game selection, and search_cache writes).
 * After the first successful fetch, the card lives in search_cache for 24h so
 * every subsequent call to this route is instant (just a Supabase read).
 *
 * Pinned cards:
 *   1. Mega Charizard X ex  — ME02: Phantasmal Flames  (JP)
 *   2. Pikachu ex           — ME: Ascended Heroes       (JP)
 *   3. Ethan's Typhlosion   — SV10: Destined Rivals     (EN)
 *   4. Mega Gengar ex       — ME: Ascended Heroes       (JP)
 *   5. Blastoise ex         — SV: Scarlet & Violet 151  (EN)
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Never cache this route at the Next.js / CDN layer.
// Individual card data is cached in search_cache (24h) via /api/card/[id].
export const dynamic = 'force-dynamic'

export interface FeaturedCard {
  id: string
  name: string
  set: string
  grade: string
  price: number
  change: number
  score: number
  img: string
}

interface PinnedCard {
  id: string      // pokemontcg.io card ID
  grade: string
  game: string    // 'pokemon' | 'pokemon-japanese'
  name: string
  set: string
}

const PINNED: PinnedCard[] = [
  { id: 'me2-130',    grade: 'Raw', game: 'pokemon-japanese', name: 'Mega Charizard X ex', set: 'Phantasmal Flames'     },
  { id: 'me2pt5-277', grade: 'Raw', game: 'pokemon-japanese', name: 'Pikachu ex',          set: 'Ascended Heroes'       },
  { id: 'sv10-190',   grade: 'Raw', game: 'pokemon',          name: "Ethan's Typhlosion",  set: 'Destined Rivals'       },
  { id: 'me2pt5-284', grade: 'Raw', game: 'pokemon-japanese', name: 'Mega Gengar ex',      set: 'Ascended Heroes'       },
  { id: 'sv3pt5-200', grade: 'Raw', game: 'pokemon',          name: 'Blastoise ex',        set: 'Scarlet & Violet 151'  },
]

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 h

// ── Read a pinned card from search_cache ───────────────────────────────────────

async function readFromCache(
  pin: PinnedCard,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<FeaturedCard | null> {
  try {
    const { data } = await supabase
      .from('search_cache')
      .select('card_id, card_name, set_name, grade, price, price_change_pct, score, image_url, last_fetched')
      .eq('cache_key', `${pin.id}:${pin.grade}`)
      .gt('price', 0)
      .single()

    if (!data) return null
    const age = Date.now() - new Date(data.last_fetched).getTime()
    if (age >= CACHE_TTL_MS) return null   // stale — re-fetch below

    return {
      id:     data.card_id,
      name:   (data.card_name || pin.name).trim(),
      set:    data.set_name   || pin.set,
      grade:  data.grade      || pin.grade,
      price:  data.price,
      change: data.price_change_pct ?? 0,
      score:  data.score ?? 0,
      img:    data.image_url ?? '',
    }
  } catch {
    return null
  }
}

// ── Fetch a pinned card via /api/card/[id] (populates search_cache) ───────────

async function fetchViaCardApi(
  pin: PinnedCard,
  baseUrl: string,
): Promise<FeaturedCard | null> {
  try {
    const params = new URLSearchParams({
      grade: pin.grade,
      name:  pin.name,
      set:   pin.set,
      game:  pin.game,
    })
    const res = await fetch(
      `${baseUrl}/api/card/${encodeURIComponent(pin.id)}?${params}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    const json = await res.json()
    const d = json.data
    if (!d?.price) return null

    return {
      id:     pin.id,
      name:   (d.card_name || pin.name).trim(),
      set:    d.set_name   || pin.set,
      grade:  pin.grade,
      price:  d.price,
      change: d.price_change_pct ?? 0,
      score:  d.score ?? 0,
      img:    d.image_url ?? '',
    }
  } catch {
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const supabase = createAdminClient()

  // Step 1: read all 5 from search_cache in parallel (instant if warmed)
  const cached = await Promise.all(PINNED.map(pin => readFromCache(pin, supabase)))

  // Step 2: for any cache miss, call /api/card/[id] to do the live lookup + warm the cache
  const misses = PINNED.filter((_, i) => cached[i] === null)
  const fetched = misses.length > 0
    ? await Promise.all(misses.map(pin => fetchViaCardApi(pin, baseUrl)))
    : []

  // Merge: preserve pinned order, replace cache-miss slots with live results
  let missIdx = 0
  const cards: FeaturedCard[] = cached.map(c => {
    if (c !== null) return c
    return fetched[missIdx++] ?? null
  }).filter((c): c is FeaturedCard => c !== null)

  // Step 3: if fewer than 3 pinned cards resolved, pad with top-scored cache rows
  // (keeps the section populated while Poketrace data propagates for new sets)
  if (cards.length < 3) {
    const existingKeys = new Set(cards.map(c => `${c.id}:${c.grade}`))
    const need = 5 - cards.length

    const { data: constituents } = await supabase
      .from('market_constituents')
      .select('card_id, grade, card_name, set_name, image_url')
      .limit(80)

    if (constituents?.length) {
      const keys = constituents
        .filter(c => !existingKeys.has(`${c.card_id}:${c.grade}`))
        .map(c => `${c.card_id}:${c.grade}`)

      const { data: cacheRows } = await supabase
        .from('search_cache')
        .select('cache_key, price, price_change_pct, score, image_url, card_name, set_name')
        .in('cache_key', keys)
        .gt('price', 0)

      const cacheMap = new Map((cacheRows ?? []).map(r => [r.cache_key, r]))

      const extras = constituents
        .map(c => {
          const row = cacheMap.get(`${c.card_id}:${c.grade}`)
          if (!row?.price) return null
          return {
            id:     c.card_id,
            name:   (row.card_name || c.card_name || '').trim(),
            set:    row.set_name || c.set_name || '',
            grade:  c.grade,
            price:  row.price,
            change: row.price_change_pct ?? 0,
            score:  row.score ?? 0,
            img:    row.image_url || c.image_url || '',
          } satisfies FeaturedCard
        })
        .filter((c): c is FeaturedCard => c !== null && !existingKeys.has(`${c.id}:${c.grade}`))
        .sort((a, b) => b.score - a.score)
        .slice(0, need)

      cards.push(...extras)
    }
  }

  return NextResponse.json({ cards }, {
    headers: { 'Cache-Control': 'no-cache' },
  })
}
