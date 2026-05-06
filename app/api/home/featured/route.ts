/**
 * GET /api/home/featured
 *
 * Returns the 5 pinned featured cards.
 * Looks up each card in search_cache by name (cards already searched by the user
 * are stored there under their Poketrace ID). Falls back to a live Poketrace name
 * search if not yet cached.
 *
 * No fallback to other cards — only the 5 pinned cards are returned.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  searchPokétraceCards,
  getPokétraceCard,
  getPriceHistory,
  gradeToTier,
  getTierPrice,
  PoketraceApiError,
  type PriceHistoryPoint,
} from '@/lib/poketrace'
import { computeScore } from '@/lib/score'

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
  id: string      // pokemontcg.io card ID (used only as a stable key)
  grade: string
  game: string
  name: string    // Poketrace search term + display name
  set: string     // display set name
  setKeyword: string  // distinctive word from set name for matching in search_cache
  img: string     // pokemontcg.io image — always reliable
}

const PINNED: PinnedCard[] = [
  {
    id: 'me2-130', grade: 'Raw', game: 'pokemon-japanese',
    name: 'Mega Charizard X ex', set: 'Phantasmal Flames', setKeyword: 'Phantasmal',
    img: 'https://images.pokemontcg.io/me2/130.png',
  },
  {
    id: 'me2pt5-277', grade: 'Raw', game: 'pokemon-japanese',
    name: 'Pikachu ex', set: 'Ascended Heroes', setKeyword: 'Ascended',
    img: 'https://images.scrydex.com/pokemon/me2pt5-277/small',
  },
  {
    id: 'sv10-190', grade: 'Raw', game: 'pokemon',
    name: "Ethan's Typhlosion", set: 'Destined Rivals', setKeyword: 'Destined',
    img: 'https://images.pokemontcg.io/sv10/190.png',
  },
  {
    id: 'me2pt5-284', grade: 'Raw', game: 'pokemon-japanese',
    name: 'Mega Gengar ex', set: 'Ascended Heroes', setKeyword: 'Ascended',
    img: 'https://images.scrydex.com/pokemon/me2pt5-284/small',
  },
  {
    id: 'sv3pt5-200', grade: 'Raw', game: 'pokemon',
    name: 'Blastoise ex', set: 'Scarlet & Violet 151', setKeyword: '151',
    img: 'https://images.pokemontcg.io/sv3pt5/200.png',
  },
]

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function removeOutliers(pts: PriceHistoryPoint[]): PriceHistoryPoint[] {
  if (pts.length < 3) return pts
  const sorted = [...pts].map(p => p.avg).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  if (median <= 0) return pts
  return pts.filter(p => p.avg >= median / 3 && p.avg <= median * 3)
}

// ── 1. Look up in search_cache by card name ───────────────────────────────────

async function fromCache(
  pin: PinnedCard,
  db: ReturnType<typeof createAdminClient>,
): Promise<FeaturedCard | null> {
  try {
    // Cards searched via the search page are stored under their Poketrace ID.
    // Match by card_name (partial, case-insensitive) then pick the row whose
    // set_name contains the set keyword.
    const { data: rows } = await db
      .from('search_cache')
      .select('price, price_change_pct, score, set_name, grade, last_fetched')
      .ilike('card_name', `%${pin.name}%`)
      .gt('price', 0)
      .order('last_fetched', { ascending: false })
      .limit(20)

    if (!rows?.length) return null

    const kw = pin.setKeyword.toLowerCase()
    const row = rows.find(r => (r.set_name ?? '').toLowerCase().includes(kw)) ?? rows[0]
    if (!row?.price) return null

    return {
      id:     pin.id,
      name:   pin.name,
      set:    pin.set,
      grade:  (row.grade as string) || pin.grade,
      price:  row.price as number,
      change: (row.price_change_pct as number) ?? 0,
      score:  (row.score as number) ?? 0,
      img:    pin.img,
    }
  } catch {
    return null
  }
}

// ── 2. Live Poketrace name search (warms search_cache) ────────────────────────

async function fromPoketrace(
  pin: PinnedCard,
  db: ReturnType<typeof createAdminClient>,
): Promise<FeaturedCard | null> {
  if (!process.env.POKETRACE_API_KEY) return null
  try {
    const results = await searchPokétraceCards(pin.name, { game: pin.game })
    if (!results.length) return null

    const best = results.reduce((a, b) => (b.topPrice ?? 0) > (a.topPrice ?? 0) ? b : a)
    const fullCard = await getPokétraceCard(best.id)
    if (!fullCard) return null

    const tierResult = getTierPrice(fullCard, gradeToTier(pin.grade))
    if (!tierResult?.tierPrice.avg) return null
    const { tierPrice, resolvedTier } = tierResult

    const history     = removeOutliers(await getPriceHistory(best.id, resolvedTier, '1y'))
    const scoreResult = computeScore(tierPrice, history)

    let change = 0
    if (tierPrice.avg30d && tierPrice.avg30d > 0) {
      change = ((tierPrice.avg - tierPrice.avg30d) / tierPrice.avg30d) * 100
    } else if (history.length >= 2) {
      const oldest = history[0].avg
      const newest = history[history.length - 1].avg
      change = oldest > 0 ? ((newest - oldest) / oldest) * 100 : 0
    }

    const monthMap = new Map<string, { price: number; volume: number }>()
    for (const h of history) {
      const key = new Date(h.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      monthMap.set(key, { price: h.avg, volume: h.saleCount ?? 0 })
    }

    // Store under pokemontcg.io ID so future readCache exact-key lookups work
    await db.from('search_cache').upsert({
      cache_key:        `${pin.id}:${pin.grade}`,
      card_id:          pin.id,
      card_name:        pin.name,
      set_name:         pin.set,
      grade:            pin.grade,
      image_url:        pin.img,
      price:            tierPrice.avg,
      price_change_pct: Math.round(change * 10) / 10,
      price_range_low:  tierPrice.low  ?? tierPrice.avg,
      price_range_high: tierPrice.high ?? tierPrice.avg,
      price_history:    Array.from(monthMap.entries()).map(([month, v]) => ({ month, ...v })),
      ebay_listings:    [],
      score:            scoreResult.total,
      score_breakdown:  scoreResult,
      sales_count_30d:  tierPrice.saleCount ?? 0,
      last_fetched:     new Date().toISOString(),
      poketrace_id:     fullCard.id,
      match_reason:     'featured_name_search',
      currency:         fullCard.currency,
      market:           fullCard.market,
      resolved_tier:    resolvedTier,
      avg1d:            tierPrice.avg1d  ?? null,
      avg7d:            tierPrice.avg7d  ?? null,
      avg30d:           tierPrice.avg30d ?? null,
      trend:            tierPrice.trend  ?? null,
      confidence:       tierPrice.confidence ?? 'medium',
      total_sale_count: fullCard.totalSaleCount ?? null,
      last_updated_pt:  fullCard.lastUpdated ?? null,
      data_warning:     null,
      data_source:      fullCard.prices.ebay?.[resolvedTier] ? 'ebay' : 'cardmarket',
      ebay_sale_count:  fullCard.prices.ebay?.[resolvedTier]?.saleCount ?? 0,
      ebay_avg_usd:     fullCard.prices.ebay?.[resolvedTier]?.avg ?? tierPrice.avg,
    })

    return {
      id:     pin.id,
      name:   pin.name,
      set:    pin.set,
      grade:  pin.grade,
      price:  tierPrice.avg,
      change: Math.round(change * 10) / 10,
      score:  scoreResult.total,
      img:    pin.img,
    }
  } catch (err) {
    if (err instanceof PoketraceApiError) console.error('[featured] Poketrace', err.status, pin.id)
    else console.error('[featured] lookup failed', pin.id, String(err))
    return null
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  try {
    const db = createAdminClient()

    // Try cache first for all 5 (fast Supabase reads in parallel)
    const cached = await Promise.all(PINNED.map(pin => fromCache(pin, db)))

    // Live Poketrace lookup for any misses
    const misses  = PINNED.filter((_, i) => cached[i] === null)
    const fetched = misses.length
      ? await Promise.all(misses.map(pin => fromPoketrace(pin, db)))
      : []

    let mi = 0
    const cards: FeaturedCard[] = cached
      .map(c => c ?? (fetched[mi++] ?? null))
      .filter((c): c is FeaturedCard => c !== null)

    return NextResponse.json({ cards }, {
      headers: { 'Cache-Control': 'no-cache' },
    })
  } catch (err) {
    console.error('[/api/home/featured]', err)
    return NextResponse.json({ cards: [] })
  }
}
