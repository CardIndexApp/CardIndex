/**
 * GET /api/home/featured
 *
 * Returns 5 pinned featured cards for the homepage "Trending Opportunities" section.
 *
 * Strategy per card:
 *   1. Read from search_cache (instant — populated on first successful lookup)
 *   2. On cache miss: single Poketrace name search → first result → full pricing
 *      Uses the correct game/market per card (EU for JP sets, US for EN sets).
 *      Image always comes from pokemontcg.io (hardcoded, always reliable).
 *   3. Write result to search_cache (24 h TTL) so subsequent requests are instant.
 *
 * Falls back to market_constituents if fewer than 3 pinned cards resolve.
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

// ── Pinned card definitions ───────────────────────────────────────────────────
// img: pokemontcg.io image URL (proxied through /api/img — always reliable)

interface PinnedCard {
  id: string      // pokemontcg.io card ID (used as cache_key prefix)
  grade: string
  game: string    // 'pokemon' | 'pokemon-japanese'
  name: string    // display name AND Poketrace search term
  set: string     // display set name
  img: string     // pokemontcg.io image URL
}

const PINNED: PinnedCard[] = [
  {
    id: 'me2-130', grade: 'Raw', game: 'pokemon-japanese',
    name: 'Mega Charizard X ex', set: 'Phantasmal Flames',
    img: 'https://images.pokemontcg.io/me2/130.png',
  },
  {
    id: 'me2pt5-277', grade: 'Raw', game: 'pokemon-japanese',
    name: 'Pikachu ex', set: 'Ascended Heroes',
    img: 'https://images.scrydex.com/pokemon/me2pt5-277/small',
  },
  {
    id: 'sv10-190', grade: 'Raw', game: 'pokemon',
    name: "Ethan's Typhlosion", set: 'Destined Rivals',
    img: 'https://images.pokemontcg.io/sv10/190.png',
  },
  {
    id: 'me2pt5-284', grade: 'Raw', game: 'pokemon-japanese',
    name: 'Mega Gengar ex', set: 'Ascended Heroes',
    img: 'https://images.scrydex.com/pokemon/me2pt5-284/small',
  },
  {
    id: 'sv3pt5-200', grade: 'Raw', game: 'pokemon',
    name: 'Blastoise ex', set: 'Scarlet & Violet 151',
    img: 'https://images.pokemontcg.io/sv3pt5/200.png',
  },
]

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

// ── Helpers ───────────────────────────────────────────────────────────────────

function removeOutliers(pts: PriceHistoryPoint[]): PriceHistoryPoint[] {
  if (pts.length < 3) return pts
  const sorted = [...pts].map(p => p.avg).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  if (median <= 0) return pts
  return pts.filter(p => p.avg >= median / 3 && p.avg <= median * 3)
}

// ── Read from search_cache ────────────────────────────────────────────────────
// Tries two strategies so it finds cards regardless of whether they were cached
// via a pokemontcg.io ID or a Poketrace UUID (eu_XXXXX / UUID).

const SET_KEYWORDS: Record<string, string> = {
  'me2-130':    'Phantasmal',
  'me2pt5-277': 'Ascended',
  'sv10-190':   'Destined',
  'me2pt5-284': 'Ascended',
  'sv3pt5-200': '151',
}

async function readCache(
  pin: PinnedCard,
  db: ReturnType<typeof createAdminClient>,
): Promise<FeaturedCard | null> {
  const toFeatured = (data: Record<string, unknown>): FeaturedCard => ({
    id:     pin.id,
    name:   pin.name,
    set:    pin.set,
    grade:  pin.grade,
    price:  data.price as number,
    change: (data.price_change_pct as number) ?? 0,
    score:  (data.score as number) ?? 0,
    img:    pin.img,
  })

  try {
    // Strategy 1: exact cache_key (written by liveLookup or direct card page visit via pokemontcg.io ID)
    const { data: exact } = await db
      .from('search_cache')
      .select('card_id, price, price_change_pct, score, last_fetched')
      .eq('cache_key', `${pin.id}:${pin.grade}`)
      .gt('price', 0)
      .single()

    if (exact && Date.now() - new Date(exact.last_fetched as string).getTime() < CACHE_TTL_MS) {
      return toFeatured(exact)
    }
  } catch { /* no exact match — try by name */ }

  try {
    // Strategy 2: card visited via search (Poketrace UUID as cache_key).
    // Match on card_name + set_name keyword + grade.
    const keyword = SET_KEYWORDS[pin.id] ?? ''
    const query = db
      .from('search_cache')
      .select('price, price_change_pct, score, last_fetched')
      .ilike('card_name', `%${pin.name}%`)
      .eq('grade', pin.grade)
      .gt('price', 0)
      .order('last_fetched', { ascending: false })
      .limit(10)

    const { data: rows } = await query

    // Pick the row whose set_name best matches our set keyword
    const row = (rows ?? []).find(r =>
      !keyword || ((r as Record<string, unknown>).set_name as string ?? '').toLowerCase().includes(keyword.toLowerCase())
    ) ?? rows?.[0]

    if (row && Date.now() - new Date((row as Record<string, unknown>).last_fetched as string).getTime() < CACHE_TTL_MS) {
      return toFeatured(row as Record<string, unknown>)
    }
  } catch { /* cache miss */ }

  return null
}

// ── Live lookup: name search → first result → full pricing ────────────────────

async function liveLookup(
  pin: PinnedCard,
  db: ReturnType<typeof createAdminClient>,
): Promise<FeaturedCard | null> {
  if (!process.env.POKETRACE_API_KEY) return null
  try {
    // Single name search — simplest possible lookup, most likely to succeed
    const results = await searchPokétraceCards(pin.name, { game: pin.game })
    if (!results.length) return null

    // Pick the result with the highest price (most likely to be the sought card)
    const best = results.reduce((a, b) => (b.topPrice ?? 0) > (a.topPrice ?? 0) ? b : a)
    const fullCard = await getPokétraceCard(best.id)
    if (!fullCard) return null

    const tier   = gradeToTier(pin.grade)
    const result = getTierPrice(fullCard, tier)
    if (!result?.tierPrice.avg) return null
    const { tierPrice, resolvedTier } = result

    const history      = removeOutliers(await getPriceHistory(best.id, resolvedTier, '1y'))
    const scoreResult  = computeScore(tierPrice, history)

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

    const record = {
      cache_key:        `${pin.id}:${pin.grade}`,
      card_id:          pin.id,
      card_name:        fullCard.name || pin.name,
      set_name:         fullCard.set.name || pin.set,
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
    }

    await db.from('search_cache').upsert(record)

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
    if (err instanceof PoketraceApiError) {
      console.error('[featured] Poketrace error', err.status, pin.id)
    } else {
      console.error('[featured] lookup failed', pin.id, err)
    }
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  try {
    const db = createAdminClient()

    // Read all 5 from cache first (parallel, fast)
    const cached = await Promise.all(PINNED.map(pin => readCache(pin, db)))

    // For cache misses, do live lookup (parallel)
    const misses  = PINNED.filter((_, i) => cached[i] === null)
    const fetched = misses.length
      ? await Promise.all(misses.map(pin => liveLookup(pin, db)))
      : []

    let missIdx = 0
    const cards: FeaturedCard[] = cached
      .map(c => c !== null ? c : (fetched[missIdx++] ?? null))
      .filter((c): c is FeaturedCard => c !== null)

    // Pad with market_constituents if fewer than 3 pinned cards resolved
    if (cards.length < 3) {
      const existingKeys = new Set(cards.map(c => `${c.id}:${c.grade}`))
      const need = 5 - cards.length

      const { data: constituents } = await db
        .from('market_constituents')
        .select('card_id, grade, card_name, set_name, image_url')
        .limit(80)

      if (constituents?.length) {
        const keys = constituents
          .filter(c => !existingKeys.has(`${c.card_id}:${c.grade}`))
          .map(c => `${c.card_id}:${c.grade}`)

        const { data: rows } = await db
          .from('search_cache')
          .select('cache_key, price, price_change_pct, score, image_url, card_name, set_name')
          .in('cache_key', keys)
          .gt('price', 0)

        const cacheMap = new Map((rows ?? []).map(r => [r.cache_key, r]))

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
  } catch (err) {
    console.error('[/api/home/featured]', err)
    return NextResponse.json({ cards: [] })
  }
}
