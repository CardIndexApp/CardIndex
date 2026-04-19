/**
 * GET /api/card/[id]?grade=PSA+10
 *
 * Returns card price data + CardIndex score.
 * Checks search_cache first (6h TTL), falls back to live eBay fetch.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchEbayPriceData } from '@/lib/ebay'
import { computeScore } from '@/lib/score'

// Use service role for cache writes (bypasses RLS)
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
  const grade = req.nextUrl.searchParams.get('grade') ?? 'PSA 10'
  const cardName = req.nextUrl.searchParams.get('name') ?? ''

  const cacheKey = `${id}:${grade}`
  const supabase = adminClient()

  // ── 1. Check cache ──────────────────────────────────────────────────────
  const { data: cached } = await supabase
    .from('search_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .single()

  if (cached) {
    const age = Date.now() - new Date(cached.last_fetched).getTime()
    if (age < CACHE_TTL_MS) {
      return NextResponse.json({ source: 'cache', data: cached })
    }
  }

  // ── 2. Fetch from eBay ──────────────────────────────────────────────────
  if (!cardName) {
    return NextResponse.json(
      { error: 'name param required for fresh fetch' },
      { status: 400 }
    )
  }

  const ebay = await fetchEbayPriceData(cardName, grade)

  if (!ebay) {
    // Return cached (stale) if we have it, otherwise 404
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({ error: 'No price data found' }, { status: 404 })
  }

  const scoreBreakdown = computeScore(ebay)

  // Compute 24h change approximation from price history
  const history = ebay.priceHistory
  let priceChangePct = 0
  if (history.length >= 2) {
    const prev = history[history.length - 2].price
    const curr = history[history.length - 1].price
    priceChangePct = prev > 0 ? ((curr - prev) / prev) * 100 : 0
  }

  const record = {
    cache_key: cacheKey,
    card_id: id,
    card_name: cardName,
    grade,
    price: ebay.medianPrice,
    price_change_pct: Math.round(priceChangePct * 10) / 10,
    price_range_low: ebay.lowestPrice,
    price_range_high: ebay.highestPrice,
    price_history: ebay.priceHistory,
    ebay_listings: ebay.listings,
    score: scoreBreakdown.total,
    score_breakdown: scoreBreakdown,
    sales_count_30d: ebay.salesCount,
    last_fetched: new Date().toISOString(),
  }

  // ── 3. Upsert into cache ────────────────────────────────────────────────
  await supabase.from('search_cache').upsert(record)

  return NextResponse.json({ source: 'live', data: record })
}
