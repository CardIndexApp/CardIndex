/**
 * GET /api/card/[id]?grade=PSA+10&name=Charizard&set=Base+Set&number=4
 *
 * Returns card price data + CardIndex score via Poketrace API.
 * Checks search_cache first (24h TTL), falls back to live fetch.
 *
 * Matching strategy (in order):
 *   1. TCGPlayer ID  → GET /cards?tcgplayer_ids={id}            (most accurate)
 *   2. Set slug + number → findBySetAndNumber                   (deterministic)
 *   3. Name search fallback → findBestMatch                     (fuzzy, last resort)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  searchByTcgPlayerId,
  findBestMatch,
  findBySetAndNumber,
  getPokétraceCard,
  getPriceHistory,
  getPoketraceSetSlug,
  gradeToTier,
  getTierPrice,
  toPoketraceVariants,
} from '@/lib/poketrace'
import { computeScore } from '@/lib/score'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface PokemonTcgCardInfo {
  tcgplayerId: string | null
  /** Full Poketrace-style number e.g. "004/102" */
  fullNumber: string | null
  /** Bare number e.g. "4" */
  bareNumber: string | null
  subtypes: string[]
  supertypes: string[]
  imageUrl: string | null
}

/** Fetch pokemontcg.io card, extract TCGPlayer product ID + card number + subtypes */
async function getPokemonTcgCardInfo(pokemontcgId: string): Promise<PokemonTcgCardInfo> {
  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/cards/${pokemontcgId}`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return { tcgplayerId: null, fullNumber: null, bareNumber: null, subtypes: [], supertypes: [], imageUrl: null }
    const json = await res.json()
    const data = json.data

    // Extract TCGPlayer ID from URL e.g. https://www.tcgplayer.com/product/123456/...
    const url: string | undefined = data?.tcgplayer?.url
    const tcgMatch = url?.match(/\/product\/(\d+)/)
    const tcgplayerId = tcgMatch ? tcgMatch[1] : null

    // Build full card number "number/printedTotal" e.g. "004/102"
    const number = data?.number as string | undefined
    const printedTotal = data?.set?.printedTotal as number | undefined
    const totalCards   = data?.set?.total as number | undefined
    let fullNumber: string | null = null
    let bareNumber: string | null = null

    if (number) {
      bareNumber = number
      const total = printedTotal ?? totalCards
      if (total) {
        const numPart  = number.replace(/[^0-9]/g, '')
        const totalStr = String(total).padStart(3, '0')
        const numStr   = numPart.padStart(3, '0')
        fullNumber = `${numStr}/${totalStr}`
      } else {
        fullNumber = number
      }
    }

    return {
      tcgplayerId,
      fullNumber,
      bareNumber,
      subtypes:   data?.subtypes  ?? [],
      supertypes: data?.supertypes ?? [],
      imageUrl:   (data?.images?.large ?? data?.images?.small) as string | null ?? null,
    }
  } catch {
    return { tcgplayerId: null, fullNumber: null, bareNumber: null, subtypes: [], supertypes: [], imageUrl: null }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const grade      = req.nextUrl.searchParams.get('grade')  ?? 'Raw'
  const cardName   = req.nextUrl.searchParams.get('name')   ?? ''
  const setName    = req.nextUrl.searchParams.get('set')    ?? ''
  const cardNumber = req.nextUrl.searchParams.get('number') ?? ''
  const bustCache  = req.nextUrl.searchParams.get('bust_cache') === '1'

  if (!cardName) {
    return NextResponse.json({ error: 'name param required' }, { status: 400 })
  }

  const cacheKey = `${id}:${grade}`
  const supabase = adminClient()

  // ── 1. Check cache ────────────────────────────────────────────────────────
  const { data: cached } = await supabase
    .from('search_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .single()

  if (cached && !bustCache) {
    const age = Date.now() - new Date(cached.last_fetched).getTime()
    if (age < CACHE_TTL_MS) {
      await supabase.from('search_log').insert({ card_id: id, card_name: cardName, grade })
      return NextResponse.json({ source: 'cache', data: cached })
    }
  }

  if (!process.env.POKETRACE_API_KEY) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({ error: 'POKETRACE_API_KEY not configured' }, { status: 503 })
  }

  // ── 2. Fetch pokemontcg.io info + Poketrace set slug in parallel ──────────
  const [ptcgInfo, poketraceSetSlug] = await Promise.all([
    getPokemonTcgCardInfo(id),
    setName ? getPoketraceSetSlug(setName) : Promise.resolve(null),
  ])

  const variants = toPoketraceVariants(ptcgInfo.subtypes, ptcgInfo.supertypes)

  let matchedCard = null
  let matchReason = ''
  const tried: string[] = []

  // ── Strategy A: TCGPlayer ID (most precise) ───────────────────────────────
  if (ptcgInfo.tcgplayerId) {
    tried.push(`tcgplayer_id:${ptcgInfo.tcgplayerId}`)
    const found = await searchByTcgPlayerId(ptcgInfo.tcgplayerId)
    if (found) {
      matchedCard = found
      matchReason = `tcgplayer_id:${ptcgInfo.tcgplayerId}`
    }
  }

  // ── Strategy B: Set slug + card number (deterministic) ────────────────────
  if (!matchedCard && poketraceSetSlug) {
    // Try both the full padded number ("004/102") and the bare number ("4")
    const numbersToTry = [
      ptcgInfo.fullNumber,
      ptcgInfo.bareNumber,
      cardNumber || null,
    ].filter((n, i, a): n is string => !!n && a.indexOf(n) === i)

    for (const num of numbersToTry) {
      tried.push(`set_slug:${poketraceSetSlug}+number:${num}`)
      const found = await findBySetAndNumber(cardName, poketraceSetSlug, num, variants)
      if (found) {
        matchedCard = found
        matchReason = `set_slug:${poketraceSetSlug}+number:${num}`
        break
      }
    }
  }

  // ── Strategy C: Name search with set/number filtering (fuzzy fallback) ────
  if (!matchedCard) {
    tried.push(`name_search:${cardName}`)
    try {
      const matchResult = await findBestMatch(
        cardName,
        setName,
        ptcgInfo.fullNumber ?? cardNumber,
        ptcgInfo.tcgplayerId ?? undefined
      )
      if (matchResult) {
        matchedCard = matchResult.card
        matchReason = matchResult.debug.matchReason
      }
    } catch {
      // fall through to not-found
    }
  }

  if (!matchedCard) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({
      error: 'Card not found on Poketrace',
      debug: {
        searched: cardName,
        setName,
        cardNumber,
        tcgplayerId: ptcgInfo.tcgplayerId,
        fullNumber: ptcgInfo.fullNumber,
        poketraceSetSlug,
        tried,
      }
    }, { status: 404 })
  }

  // ── 3. Fetch full card pricing ────────────────────────────────────────────
  const fullCard = await getPokétraceCard(matchedCard.id)
  if (!fullCard) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({ error: 'Failed to fetch card pricing', debug: { matchedCard: matchedCard.id, matchReason } }, { status: 502 })
  }

  const tier   = gradeToTier(grade)
  const result = getTierPrice(fullCard, tier)

  if (!result) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({
      error: `No price data for ${grade}`,
      debug: {
        matchedCard: fullCard.name,
        matchedSet: fullCard.set.name,
        matchReason,
        tier,
        availableTiers: [
          ...Object.keys(fullCard.prices.ebay ?? {}),
          ...Object.keys(fullCard.prices.tcgplayer ?? {}),
        ],
      }
    }, { status: 404 })
  }

  const { tierPrice, resolvedTier } = result

  // ── 4. Fetch price history ────────────────────────────────────────────────
  const history = await getPriceHistory(matchedCard.id, resolvedTier, '30d')

  // ── 5. Compute score ──────────────────────────────────────────────────────
  const scoreBreakdown = computeScore(tierPrice, history)

  // ── 6. Build price change % ───────────────────────────────────────────────
  let priceChangePct = 0
  if (tierPrice.avg30d && tierPrice.avg30d > 0) {
    priceChangePct = ((tierPrice.avg - tierPrice.avg30d) / tierPrice.avg30d) * 100
  } else if (history.length >= 2) {
    const oldest = history[0].avg
    const newest = history[history.length - 1].avg
    priceChangePct = oldest > 0 ? ((newest - oldest) / oldest) * 100 : 0
  }

  // ── 7. Format history for sparkline ──────────────────────────────────────
  const priceHistory = history.map(h => ({
    month: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: h.avg,
  }))

  // ── 8. Build all-tier price ladder ────────────────────────────────────────
  const RAW_TIERS = ['NEAR_MINT', 'LIGHTLY_PLAYED', 'MODERATELY_PLAYED', 'HEAVILY_PLAYED', 'DAMAGED']
  const allTierPrices: Record<string, { avg: number; source: string; saleCount?: number }> = {}

  for (const [t, tp] of Object.entries(fullCard.prices.ebay ?? {})) {
    allTierPrices[t] = { avg: tp.avg, source: 'eBay', saleCount: tp.saleCount }
  }
  for (const [t, tp] of Object.entries(fullCard.prices.tcgplayer ?? {})) {
    if (RAW_TIERS.includes(t) || !allTierPrices[t]) {
      allTierPrices[t] = { avg: tp.avg, source: 'TCGPlayer', saleCount: tp.saleCount }
    }
  }
  if (fullCard.prices.cardmarket?.AGGREGATED) {
    allTierPrices['AGGREGATED'] = {
      avg: fullCard.prices.cardmarket.AGGREGATED.avg,
      source: 'CardMarket',
      saleCount: fullCard.prices.cardmarket.AGGREGATED.saleCount,
    }
  }

  // ── 9. Build + upsert cache record ───────────────────────────────────────
  const record = {
    cache_key:           cacheKey,
    card_id:             id,
    card_name:           cardName,
    set_name:            setName || fullCard.set.name,
    grade,
    image_url:           ptcgInfo.imageUrl ?? fullCard.image,
    price:               tierPrice.avg,
    price_change_pct:    Math.round(priceChangePct * 10) / 10,
    price_range_low:     tierPrice.low  ?? tierPrice.avg,
    price_range_high:    tierPrice.high ?? tierPrice.avg,
    price_history:       priceHistory,
    ebay_listings:       [],
    score:               scoreBreakdown.total,
    score_breakdown:     scoreBreakdown,
    sales_count_30d:     tierPrice.saleCount ?? 0,
    last_fetched:        new Date().toISOString(),
    poketrace_id:        fullCard.id,
    match_reason:        matchReason,
    currency:            fullCard.currency,
    market:              fullCard.market,
    resolved_tier:       resolvedTier,
    avg1d:               tierPrice.avg1d  ?? null,
    avg7d:               tierPrice.avg7d  ?? null,
    avg30d:              tierPrice.avg30d ?? null,
    trend:               tierPrice.trend  ?? null,
    confidence:          tierPrice.confidence ?? null,
    all_tier_prices:     allTierPrices,
    total_sale_count:    fullCard.totalSaleCount ?? null,
    last_updated_pt:     fullCard.lastUpdated ?? null,
  }

  await Promise.all([
    supabase.from('search_cache').upsert(record),
    supabase.from('search_log').insert({ card_id: id, card_name: cardName, grade }),
  ])

  return NextResponse.json({ source: 'live', data: record })
}
