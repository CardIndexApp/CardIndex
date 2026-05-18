/**
 * GET /api/home/featured
 *
 * Returns the 5 pinned featured cards.
 * Hardcoded snapshot prices are always shown; live search_cache prices
 * replace them when available so the data stays fresh over time.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

// ── Hardcoded snapshot (always shown — no API dependency) ─────────────────────

const STATIC_CARDS: FeaturedCard[] = [
  {
    id: 'me2-130',
    name: 'Mega Charizard X ex',
    set: 'Phantasmal Flames',
    grade: 'Raw',
    price: 979.72,
    change: 0,
    score: 0,
    img: 'https://images.pokemontcg.io/me2/130.png',
  },
  {
    id: 'me2pt5-277',
    name: 'Pikachu ex',
    set: 'Ascended Heroes',
    grade: 'Raw',
    price: 1275,
    change: 0,
    score: 0,
    img: 'https://images.scrydex.com/pokemon/me2pt5-277/small',
  },
  {
    id: 'sv10-190',
    name: "Ethan's Typhlosion",
    set: 'Destined Rivals',
    grade: 'Raw',
    price: 29.65,
    change: 0,
    score: 0,
    img: 'https://images.pokemontcg.io/sv10/190.png',
  },
  {
    id: 'me2pt5-284',
    name: 'Mega Gengar ex',
    set: 'Ascended Heroes',
    grade: 'Raw',
    price: 1450,
    change: 0,
    score: 0,
    img: 'https://images.scrydex.com/pokemon/me2pt5-284/small',
  },
  {
    id: 'sv3pt5-200',
    name: 'Blastoise ex',
    set: 'Scarlet & Violet 151',
    grade: 'Raw',
    price: 165.99,
    change: 0,
    score: 0,
    img: 'https://images.pokemontcg.io/sv3pt5/200.png',
  },
]

// ── Try to enrich from search_cache (live prices) ─────────────────────────────

interface CacheRow {
  price: number
  price_change_pct: number | null
  score: number | null
  set_name: string | null
  grade: string | null
}

const SET_KEYWORDS: Record<string, string> = {
  'me2-130':    'phantasmal',
  'me2pt5-277': 'ascended',
  'sv10-190':   'destined',
  'me2pt5-284': 'ascended',
  'sv3pt5-200': '151',
}

async function enrichFromCache(cards: FeaturedCard[]): Promise<FeaturedCard[]> {
  try {
    const db = createAdminClient()
    const enriched = await Promise.all(
      cards.map(async (card) => {
        try {
          const kw = SET_KEYWORDS[card.id] ?? ''
          const { data: rows } = await db
            .from('search_cache')
            .select('price, price_change_pct, score, set_name, grade')
            .ilike('card_name', `%${card.name}%`)
            .gt('price', 0)
            .order('last_fetched', { ascending: false })
            .limit(20)

          if (!rows?.length) return card

          const row: CacheRow =
            (rows.find((r) => (r.set_name ?? '').toLowerCase().includes(kw)) ?? rows[0]) as CacheRow

          if (!row?.price) return card

          return {
            ...card,
            price:  row.price,
            change: row.price_change_pct ?? 0,
            score:  row.score ?? 0,
          }
        } catch {
          return card
        }
      }),
    )
    return enriched
  } catch {
    return cards
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  // Always start from hardcoded snapshot so there is always something to show
  const base = [...STATIC_CARDS]

  // Silently try to replace prices with live search_cache data
  const cards = await enrichFromCache(base)

  return NextResponse.json({ cards }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
