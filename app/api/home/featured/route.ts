/**
 * GET /api/home/featured
 *
 * Returns 5 pinned featured cards for the homepage "Trending Opportunities" section.
 * Each card is fetched from search_cache (24h TTL) or looked up live via Poketrace.
 *
 * Pinned cards (hardcoded):
 *   1. Mega Charizard X ex  — ME02: Phantasmal Flames  (JP)
 *   2. Pikachu ex           — ME: Ascended Heroes       (JP)
 *   3. Ethan's Typhlosion   — SV10: Destined Rivals     (EN)
 *   4. Mega Gengar ex       — ME: Ascended Heroes       (JP)
 *   5. Blastoise ex         — SV: Scarlet & Violet 151  (EN)
 *
 * Each card is cached individually in search_cache (24h TTL) so repeat requests are instant.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  searchByTcgPlayerId,
  findBestMatch,
  findBySetAndNumber,
  getPokétraceCard,
  getPriceHistory,
  getPoketraceSetSlugs,
  gradeToTier,
  getTierPrice,
  toPoketraceVariants,
  PoketraceApiError,
  type PoketraceVariant,
  type PokétraceCard,
  type PriceHistoryPoint,
} from '@/lib/poketrace'
import { computeScore } from '@/lib/score'

// No route-level revalidate — each card is cached individually in search_cache (24h TTL).
// The Cache-Control header on the response handles CDN/browser caching.
export const revalidate = 0

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

interface PinnedCard {
  /** pokemontcg.io card ID */
  id: string
  /** Grade for display + cache key. 'Raw' for both JP and EN ungraded. */
  grade: string
  /** 'pokemon' for EN sets, 'pokemon-japanese' for JP sets */
  game: string
  /** Card name as used in pokemontcg.io / display */
  name: string
  /** Set name matching pokemontcg.io set name */
  set: string
}

const PINNED: PinnedCard[] = [
  { id: 'me2-130',    grade: 'Raw', game: 'pokemon-japanese', name: 'Mega Charizard X ex', set: 'Phantasmal Flames'     },
  { id: 'me2pt5-277', grade: 'Raw', game: 'pokemon-japanese', name: 'Pikachu ex',          set: 'Ascended Heroes'       },
  { id: 'sv10-190',   grade: 'Raw', game: 'pokemon',          name: "Ethan's Typhlosion",  set: 'Destined Rivals'       },
  { id: 'me2pt5-284', grade: 'Raw', game: 'pokemon-japanese', name: 'Mega Gengar ex',      set: 'Ascended Heroes'       },
  { id: 'sv3pt5-200', grade: 'Raw', game: 'pokemon',          name: 'Blastoise ex',        set: 'Scarlet & Violet 151'  },
]

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// ── pokemontcg.io helper ──────────────────────────────────────────────────────

interface PtcgInfo {
  tcgplayerId: string | null
  fullNumber: string | null
  bareNumber: string | null
  subtypes: string[]
  supertypes: string[]
  imageUrl: string | null
}

async function getPtcgInfo(id: string): Promise<PtcgInfo> {
  const empty: PtcgInfo = { tcgplayerId: null, fullNumber: null, bareNumber: null, subtypes: [], supertypes: [], imageUrl: null }
  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/cards/${id}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return empty
    const { data } = await res.json()

    const url: string | undefined = data?.tcgplayer?.url
    const tcgMatch    = url?.match(/\/product\/(\d+)/)
    const tcgplayerId = tcgMatch ? tcgMatch[1] : null

    const number       = data?.number as string | undefined
    const printedTotal = (data?.set?.printedTotal ?? data?.set?.total) as number | undefined
    let fullNumber: string | null = null
    let bareNumber: string | null = null
    if (number) {
      bareNumber = number
      if (printedTotal) {
        fullNumber = `${number.replace(/[^0-9]/g, '').padStart(3, '0')}/${String(printedTotal).padStart(3, '0')}`
      } else {
        fullNumber = number
      }
    }

    return {
      tcgplayerId,
      fullNumber,
      bareNumber,
      subtypes:  data?.subtypes  ?? [],
      supertypes: data?.supertypes ?? [],
      imageUrl: (data?.images?.large ?? data?.images?.small) as string | null ?? null,
    }
  } catch {
    return empty
  }
}

// ── Remove history outliers ───────────────────────────────────────────────────

function removeHistoryOutliers(pts: PriceHistoryPoint[]): PriceHistoryPoint[] {
  if (pts.length < 3) return pts
  const sorted = [...pts].map(p => p.avg).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  if (median <= 0) return pts
  return pts.filter(p => p.avg >= median / 3 && p.avg <= median * 3)
}

// ── Fetch a single pinned card (cache → live) ─────────────────────────────────

async function fetchPinnedCard(
  pin: PinnedCard,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<FeaturedCard | null> {
  const cacheKey = `${pin.id}:${pin.grade}`

  // ── 1. Check search_cache ─────────────────────────────────────────────────
  try {
    const { data: cached } = await supabase
      .from('search_cache')
      .select('card_id, card_name, set_name, grade, price, price_change_pct, score, image_url, last_fetched')
      .eq('cache_key', cacheKey)
      .gt('price', 0)
      .single()

    if (cached) {
      const age = Date.now() - new Date(cached.last_fetched).getTime()
      if (age < CACHE_TTL_MS) {
        return {
          id:     cached.card_id,
          name:   (cached.card_name || pin.name).trim(),
          set:    cached.set_name  || pin.set,
          grade:  cached.grade     || pin.grade,
          price:  cached.price,
          change: cached.price_change_pct ?? 0,
          score:  cached.score ?? 0,
          img:    cached.image_url ?? '',
        }
      }
    }
  } catch { /* cache miss — continue to live fetch */ }

  // ── 2. Live Poketrace lookup ──────────────────────────────────────────────
  if (!process.env.POKETRACE_API_KEY) return null

  try {
    // Fetch pokemontcg.io info in parallel with Poketrace set slug lookup.
    // Pass pin.game so JP sets are searched on the EU market (game='pokemon-japanese').
    const [ptcgInfo, setSlugResult] = await Promise.allSettled([
      getPtcgInfo(pin.id),
      getPoketraceSetSlugs(pin.set, pin.game),
    ])

    const info     = ptcgInfo.status     === 'fulfilled' ? ptcgInfo.value     : { tcgplayerId: null, fullNumber: null, bareNumber: null, subtypes: [], supertypes: [], imageUrl: null }
    let setSlugs   = setSlugResult.status === 'fulfilled' ? setSlugResult.value : []

    // If game-specific search found nothing, retry with the default game as fallback
    // (some JP sets appear in Poketrace under game='pokemon' with EU market data)
    if (!setSlugs.length && pin.game !== 'pokemon') {
      try { setSlugs = await getPoketraceSetSlugs(pin.set, 'pokemon') } catch { /* ok */ }
    }

    const variants = toPoketraceVariants(info.subtypes, info.supertypes) as PoketraceVariant[]

    let matchedCard: PokétraceCard | null = null

    // Strategy A: TCGPlayer ID (most precise)
    if (!matchedCard && info.tcgplayerId) {
      try { matchedCard = await searchByTcgPlayerId(info.tcgplayerId) } catch { /* continue */ }
    }

    // Strategy B: Set slug + card number
    if (!matchedCard && setSlugs.length) {
      const numbers = [info.fullNumber, info.bareNumber].filter((n): n is string => !!n)
      for (const num of numbers) {
        try {
          const found = await findBySetAndNumber(pin.name, setSlugs, num, variants, pin.game)
          if (found) { matchedCard = found; break }
        } catch { /* try next number */ }
      }
    }

    // Strategy C: Name search with game/market
    if (!matchedCard) {
      try {
        const result = await findBestMatch(
          pin.name,
          pin.set,
          info.fullNumber,
          info.tcgplayerId ?? undefined,
          setSlugs[0] ?? undefined,
          pin.game,
        )
        if (result) matchedCard = result.card
      } catch { /* give up */ }
    }

    if (!matchedCard) return null

    // ── 3. Fetch full pricing ────────────────────────────────────────────────
    let fullCard: PokétraceCard | null = null
    try { fullCard = await getPokétraceCard(matchedCard.id) } catch { /* continue */ }
    if (!fullCard) return null

    const tier = gradeToTier(pin.grade)
    const tierResult = getTierPrice(fullCard, tier)
    if (!tierResult || !tierResult.tierPrice.avg) return null

    const { tierPrice, resolvedTier } = tierResult

    // ── 4. Fetch price history + compute score ────────────────────────────────
    const rawHistory = await getPriceHistory(matchedCard.id, resolvedTier, '1y')
    const history    = removeHistoryOutliers(rawHistory)
    const scoreBreakdown = computeScore(tierPrice, history)

    // Price change %
    let priceChangePct = 0
    if (tierPrice.avg30d && tierPrice.avg30d > 0) {
      priceChangePct = ((tierPrice.avg - tierPrice.avg30d) / tierPrice.avg30d) * 100
    } else if (history.length >= 2) {
      const oldest = history[0].avg
      const newest = history[history.length - 1].avg
      priceChangePct = oldest > 0 ? ((newest - oldest) / oldest) * 100 : 0
    }

    // Month-grouped price history for cache
    const monthMap = new Map<string, { price: number; volume: number }>()
    for (const h of history) {
      const d   = new Date(h.date)
      const key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      monthMap.set(key, { price: h.avg, volume: h.saleCount ?? 0 })
    }
    const priceHistory = Array.from(monthMap.entries()).map(([month, v]) => ({ month, price: v.price, volume: v.volume }))

    // Prefer Poketrace CDN (already in img proxy allowlist) over pokemontcg.io
    // JP cards from pokemontcg.io use images.scrydex.com (now also allowed)
    const imageUrl = fullCard.image || info.imageUrl || ''

    // Data source / warning (simplified — no TCGPlayer fallback here)
    const ebaySaleCount = fullCard.prices.ebay?.[resolvedTier]?.saleCount ?? tierPrice.saleCount ?? 0
    const isCardMarket  = resolvedTier === 'AGGREGATED'
    const dataSource    = isCardMarket ? 'cardmarket' : fullCard.prices.ebay?.[resolvedTier] ? 'ebay' : 'tcgplayer'
    const dataWarning   = ebaySaleCount >= 10 ? null : ebaySaleCount >= 5 ? 'limited_sales' : null

    // ── 5. Upsert to search_cache ─────────────────────────────────────────────
    const record = {
      cache_key:        cacheKey,
      card_id:          pin.id,
      card_name:        fullCard.name || pin.name,
      set_name:         fullCard.set.name || pin.set,
      grade:            pin.grade,
      image_url:        imageUrl,
      price:            tierPrice.avg,
      price_change_pct: Math.round(priceChangePct * 10) / 10,
      price_range_low:  tierPrice.low  ?? tierPrice.avg,
      price_range_high: tierPrice.high ?? tierPrice.avg,
      price_history:    priceHistory,
      ebay_listings:    [],
      score:            scoreBreakdown.total,
      score_breakdown:  scoreBreakdown,
      sales_count_30d:  tierPrice.saleCount ?? 0,
      last_fetched:     new Date().toISOString(),
      poketrace_id:     fullCard.id,
      match_reason:     'pinned_featured',
      currency:         fullCard.currency,
      market:           fullCard.market,
      resolved_tier:    resolvedTier,
      avg1d:            tierPrice.avg1d  ?? null,
      avg7d:            tierPrice.avg7d  ?? null,
      avg30d:           tierPrice.avg30d ?? null,
      trend:            tierPrice.trend  ?? null,
      confidence:       tierPrice.confidence ?? (dataWarning ? 'medium' : 'high'),
      total_sale_count: fullCard.totalSaleCount ?? null,
      last_updated_pt:  fullCard.lastUpdated ?? null,
      data_warning:     dataWarning,
      data_source:      dataSource,
      ebay_sale_count:  ebaySaleCount,
      ebay_avg_usd:     fullCard.prices.ebay?.[resolvedTier]?.avg ?? tierPrice.avg,
    }

    await supabase.from('search_cache').upsert(record)

    return {
      id:     pin.id,
      name:   (fullCard.name || pin.name).trim(),
      set:    fullCard.set.name || pin.set,
      grade:  pin.grade,
      price:  tierPrice.avg,
      change: Math.round(priceChangePct * 10) / 10,
      score:  scoreBreakdown.total,
      img:    imageUrl,
    }
  } catch (err) {
    if (err instanceof PoketraceApiError) {
      console.error('[/api/home/featured] Poketrace API error:', err.status, pin.id)
    }
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = createAdminClient()

    // Fetch all 5 pinned cards in parallel
    const results = await Promise.all(PINNED.map(pin => fetchPinnedCard(pin, supabase)))
    const cards   = results.filter((c): c is FeaturedCard => c !== null)

    // If we got less than 3 pinned cards (API key missing / new set not yet in Poketrace),
    // fall back to market_constituents + search_cache so the section is never empty
    if (cards.length < 3) {
      const existingKeys = new Set(cards.map(c => `${c.id}:${c.grade}`))
      const need = 5 - cards.length

      // Try market_constituents joined with search_cache (has images)
      const { data: constituents } = await supabase
        .from('market_constituents')
        .select('card_id, grade, card_name, set_name, image_url')
        .limit(80)

      if (constituents && constituents.length > 0) {
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
            const cache = cacheMap.get(`${c.card_id}:${c.grade}`)
            if (!cache?.price) return null
            return {
              id:     c.card_id,
              name:   (cache.card_name || c.card_name || '').trim(),
              set:    cache.set_name || c.set_name || '',
              grade:  c.grade,
              price:  cache.price,
              change: cache.price_change_pct ?? 0,
              score:  cache.score ?? 0,
              img:    cache.image_url || c.image_url || '',
            }
          })
          .filter((c): c is FeaturedCard => c !== null && !existingKeys.has(`${c.id}:${c.grade}`))
          .sort((a, b) => b.score - a.score)
          .slice(0, need)
        cards.push(...extras)
      }
    }

    return NextResponse.json({ cards }, {
      headers: { 'Cache-Control': 'public, max-age=43200, stale-while-revalidate=86400' },
    })
  } catch (err) {
    console.error('[/api/home/featured]', err)
    return NextResponse.json({ cards: [] }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
    })
  }
}
