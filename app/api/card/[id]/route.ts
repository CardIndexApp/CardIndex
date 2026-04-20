/**
 * GET /api/card/[id]?grade=PSA+10&name=Charizard&set=Base+Set
 *
 * Returns card price data + CardIndex score via Poketrace API.
 * Checks search_cache first (24h TTL), falls back to live fetch.
 *
 * [id] is the pokemontcg.io card ID — used as cache key only.
 * Actual pricing is fetched from Poketrace by matching card name.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { findBestMatch, getPokétraceCard, getPriceHistory, gradeToTier, getTierPrice } from '@/lib/poketrace'
import { computeScore } from '@/lib/score'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const grade      = req.nextUrl.searchParams.get('grade')  ?? 'Raw'
  const cardName   = req.nextUrl.searchParams.get('name')   ?? ''
  const setName    = req.nextUrl.searchParams.get('set')    ?? ''
  const cardNumber = req.nextUrl.searchParams.get('number') ?? ''

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

  if (cached) {
    const age = Date.now() - new Date(cached.last_fetched).getTime()
    if (age < CACHE_TTL_MS) {
      // Log the search hit
      await supabase.from('search_log').insert({ card_id: id, card_name: cardName, grade })
      return NextResponse.json({ source: 'cache', data: cached })
    }
  }

  // ── 2. Find the card on Poketrace ─────────────────────────────────────────
  if (!process.env.POKETRACE_API_KEY) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({ error: 'POKETRACE_API_KEY not configured' }, { status: 503 })
  }

  const matchedCard = await findBestMatch(cardName, setName, cardNumber)
  if (!matchedCard) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({ error: 'Card not found on Poketrace' }, { status: 404 })
  }

  // ── 3. Fetch full card pricing ────────────────────────────────────────────
  const fullCard = await getPokétraceCard(matchedCard.id)
  if (!fullCard) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({ error: 'Failed to fetch card pricing' }, { status: 502 })
  }

  const tier      = gradeToTier(grade)
  const tierPrice = getTierPrice(fullCard, tier)

  if (!tierPrice) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({ error: `No price data for ${grade}` }, { status: 404 })
  }

  // ── 4. Fetch price history ────────────────────────────────────────────────
  const history = await getPriceHistory(matchedCard.id, tier, '30d')

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
    cache_key:         cacheKey,
    card_id:           id,
    card_name:         cardName,
    set_name:          setName || fullCard.set.name,
    grade,
    image_url:         fullCard.image,
    price:             tierPrice.avg,
    price_change_pct:  Math.round(priceChangePct * 10) / 10,
    price_range_low:   tierPrice.low ?? tierPrice.avg,
    price_range_high:  tierPrice.high ?? tierPrice.avg,
    price_history:     priceHistory,
    ebay_listings:     [], // listings require Scale plan
    score:             scoreBreakdown.total,
    score_breakdown:   scoreBreakdown,
    sales_count_30d:   tierPrice.saleCount ?? 0,
    last_fetched:      new Date().toISOString(),
    // Poketrace extras
    poketrace_id:      fullCard.id,
    currency:          fullCard.currency,
    market:            fullCard.market,
    avg7d:             tierPrice.avg7d ?? null,
    avg30d:            tierPrice.avg30d ?? null,
  }

  // ── 9. Upsert cache + log ─────────────────────────────────────────────────
  await Promise.all([
    supabase.from('search_cache').upsert(record),
    supabase.from('search_log').insert({ card_id: id, card_name: cardName, grade }),
  ])

  return NextResponse.json({ source: 'live', data: record })
}
