/**
 * GET /api/card/[id]?grade=PSA+10&name=Charizard&set=Base+Set&number=125
 *
 * Returns card price data + CardIndex score via Poketrace API.
 * Checks search_cache first (24h TTL), falls back to live fetch.
 *
 * Matching strategy (in order):
 *   1. Fetch pokemontcg.io card → extract TCGPlayer ID → query Poketrace by tcgplayer_ids
 *   2. Construct Poketrace card slug via set slug lookup + number
 *   3. Fall back to name + set name search with slug matching
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { searchByTcgPlayerId, findBestMatch, findByConstructedSlug, getPokétraceCard, getPriceHistory, gradeToTier, getTierPrice } from '@/lib/poketrace'
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
  /** Full Poketrace-style number e.g. "125/094" */
  fullNumber: string | null
  /** pokemontcg.io subtypes that map to Poketrace variant names */
  variants: string[]
}

/** Map pokemontcg.io subtypes/supertypes to Poketrace variant strings */
function toPoketraceVariants(subtypes: string[] = [], supertypes: string[] = []): string[] {
  const out: string[] = []
  const all = [...subtypes.map(s => s.toLowerCase()), ...supertypes.map(s => s.toLowerCase())]

  if (all.some(s => s.includes('holo rare') || s === 'holo')) out.push('Holofoil')
  if (all.some(s => s.includes('reverse holo'))) out.push('ReverseHolofoil')
  if (all.some(s => s.includes('full art'))) out.push('FullArt')
  if (all.some(s => s.includes('alternate art'))) out.push('AlternateArt')
  if (all.some(s => s.includes('secret'))) out.push('SecretRare')
  if (all.some(s => s.includes('normal') || s === 'common' || s === 'uncommon')) out.push('Normal')
  if (all.some(s => s.includes('ex') || s.includes('gx') || s.includes('v '))) {
    if (!out.includes('Holofoil')) out.push('Holofoil')
  }

  // Always include common variants as fallback
  if (!out.includes('Holofoil')) out.push('Holofoil')
  if (!out.includes('Normal')) out.push('Normal')

  return out
}

/** Fetch pokemontcg.io card, extract TCGPlayer product ID + card number info */
async function getPokemonTcgCardInfo(pokemontcgId: string): Promise<PokemonTcgCardInfo> {
  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/cards/${pokemontcgId}`, {
      next: { revalidate: 86400 }, // cache for 24h — this data doesn't change
    })
    if (!res.ok) return { tcgplayerId: null, fullNumber: null, variants: [] }
    const json = await res.json()
    const data = json.data

    // Extract TCGPlayer ID
    const url: string | undefined = data?.tcgplayer?.url
    const tcgMatch = url?.match(/\/product\/(\d+)/)
    const tcgplayerId = tcgMatch ? tcgMatch[1] : null

    // Build full card number "number/printedTotal" (e.g. "125/094")
    const number = data?.number as string | undefined
    const printedTotal = data?.set?.printedTotal as number | undefined
    const totalCards = data?.set?.total as number | undefined
    let fullNumber: string | null = null
    if (number) {
      const total = printedTotal ?? totalCards
      if (total) {
        // Pad both sides to match typical Poketrace format
        const numPart = number.replace(/[^0-9]/g, '')
        const totalStr = String(total).padStart(3, '0')
        const numStr = numPart.padStart(3, '0')
        fullNumber = `${numStr}/${totalStr}`
      } else {
        fullNumber = number
      }
    }

    const variants = toPoketraceVariants(data?.subtypes ?? [], data?.supertypes ?? [])

    return { tcgplayerId, fullNumber, variants }
  } catch {
    return { tcgplayerId: null, fullNumber: null, variants: [] }
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

  // ── 2. Find the card on Poketrace ─────────────────────────────────────────
  // Fetch pokemontcg.io card info once — used by multiple strategies
  const ptcgInfo = await getPokemonTcgCardInfo(id)

  // Strategy A: TCGPlayer ID lookup (most accurate — exact foreign-key match)
  let matchedCard = null
  let matchReason = ''

  if (ptcgInfo.tcgplayerId) {
    const found = await searchByTcgPlayerId(ptcgInfo.tcgplayerId)
    if (found) {
      matchedCard = found
      matchReason = `tcgplayer_id:${ptcgInfo.tcgplayerId}`
    }
  }

  // Strategy B: Construct Poketrace slug via set slug lookup + card number
  // Handles cases where TCGPlayer ID isn't available or doesn't match
  if (!matchedCard && setName) {
    const numToUse = ptcgInfo.fullNumber ?? cardNumber
    if (numToUse) {
      const found = await findByConstructedSlug(cardName, setName, numToUse, ptcgInfo.variants)
      if (found) {
        matchedCard = found
        matchReason = `constructed_slug:${found.id}`
      }
    }
  }

  // Strategy C: Name + set name search (fuzzy fallback)
  if (!matchedCard) {
    const matchResult = await findBestMatch(cardName, setName, cardNumber)
    if (matchResult) {
      matchedCard = matchResult.card
      matchReason = matchResult.debug.matchReason
    }
  }

  if (!matchedCard) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({
      error: 'Card not found on Poketrace',
      debug: { searched: cardName, setName, cardNumber, tcgplayerId: ptcgInfo.tcgplayerId, fullNumber: ptcgInfo.fullNumber }
    }, { status: 404 })
  }

  // ── 3. Fetch full card pricing ────────────────────────────────────────────
  const fullCard = await getPokétraceCard(matchedCard.id)
  if (!fullCard) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({ error: 'Failed to fetch card pricing' }, { status: 502 })
  }

  const tier   = gradeToTier(grade)
  const result = getTierPrice(fullCard, tier)

  if (!result) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({ error: `No price data for ${grade}`, debug: { matchedCard: fullCard.name, matchedSet: fullCard.set.name, matchReason } }, { status: 404 })
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

  // ── 8. Build cache record ─────────────────────────────────────────────────
  const record = {
    cache_key:        cacheKey,
    card_id:          id,
    card_name:        cardName,
    set_name:         setName || fullCard.set.name,
    grade,
    image_url:        fullCard.image,
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
    match_reason:     matchReason,
    currency:         fullCard.currency,
    market:           fullCard.market,
    resolved_tier:    resolvedTier,
    avg7d:            tierPrice.avg7d  ?? null,
    avg30d:           tierPrice.avg30d ?? null,
  }

  // ── 9. Upsert cache + log ─────────────────────────────────────────────────
  await Promise.all([
    supabase.from('search_cache').upsert(record),
    supabase.from('search_log').insert({ card_id: id, card_name: cardName, grade }),
  ])

  return NextResponse.json({ source: 'live', data: record })
}
