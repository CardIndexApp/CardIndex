/**
 * GET /api/market
 * Aggregates search_cache rows into market indices and movers.
 * Uses the service-role client — no RLS, server-side only.
 *
 * Response is cached for 30 minutes via Cache-Control.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface CacheRow {
  cache_key: string
  card_id: string
  card_name: string
  set_name: string | null
  grade: string
  image_url: string | null
  price: number | null
  price_change_pct: number | null
  price_history: { month: string; price: number }[] | null
  avg7d: number | null
  avg30d: number | null
  sales_count_30d: number | null
  score: number | null
  last_fetched: string | null
}

export interface IndexStats {
  level: number          // median price of cards in this category
  change30d: number      // median 30d % change
  change7d: number       // derived: (price - avg7d) / avg7d * 100
  cardCount: number
  risingCount: number
  fallingCount: number
}

export interface MoverCard {
  card_id: string
  card_name: string
  grade: string
  price: number | null
  change: number | null
  sales: number | null
  score: number | null
  image_url: string | null
}

export interface MarketResponse {
  overall: IndexStats | null
  raw: IndexStats | null
  graded: IndexStats | null
  psa10: IndexStats | null
  indexMetrics: IndexMetrics | null
  indexHistory: { month: string; value: number }[]
  topRising: MoverCard[]
  topFalling: MoverCard[]
  mostTraded: MoverCard[]
  signal: 'new_high' | 'rising' | 'stable' | 'falling' | 'new_low'
  stats: { totalCards: number; risingCount: number; fallingCount: number; unchangedCount: number }
  lastUpdated: string | null
  empty?: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function gradeType(grade: string): 'raw' | 'graded' | 'psa10' {
  const g = (grade || '').toUpperCase().trim()
  if (g === 'PSA 10') return 'psa10'
  if (/^(PSA|BGS|CGC|SGC|GMA|ACE)\s/.test(g) || ['PSA', 'BGS', 'CGC', 'SGC', 'GMA'].includes(g)) return 'graded'
  return 'raw'
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function round2(n: number) { return Math.round(n * 100) / 100 }

/**
 * Parse a month string into a timestamp for sorting.
 * Handles: "Apr 2025", "Jan 2024", "2024-01", "January 2024", "Apr '25"
 */
function parseMonth(s: string): number {
  // ISO month "2024-01" → "2024-01-01"
  if (/^\d{4}-\d{2}$/.test(s)) return new Date(s + '-01').getTime()
  // "Apr 2025" or "April 2025" — canonical new format
  const full = s.match(/^(\w+)\s+(\d{4})$/)
  if (full) {
    const d = new Date(`${full[1]} 1, ${full[2]}`)
    if (!isNaN(d.getTime())) return d.getTime()
  }
  // "Apr '25" or "Apr 25" short year
  const short = s.match(/^(\w+)\s+'?(\d{2})$/)
  if (short) {
    const d = new Date(`${short[1]} 1, 20${short[2]}`)
    if (!isNaN(d.getTime())) return d.getTime()
  }
  // Legacy "Apr 28" day-level (no year) — assume current year
  const legacy = new Date(s)
  return isNaN(legacy.getTime()) ? 0 : legacy.getTime()
}

function computeIndexStats(rows: CacheRow[]): IndexStats | null {
  const priced = rows.filter(r => r.price != null && r.price > 0)
  if (priced.length === 0) return null

  const prices = priced.map(r => r.price!)
  const level = round2(median(prices))

  const withChange = priced.filter(r => r.price_change_pct != null)
  const change30d = withChange.length > 0
    ? round2(median(withChange.map(r => r.price_change_pct!)))
    : 0

  // 7d change: derive from avg7d vs current price
  const with7d = priced.filter(r => r.avg7d != null && r.avg7d > 0)
  const change7d = with7d.length > 0
    ? round2(median(with7d.map(r => ((r.price! - r.avg7d!) / r.avg7d!) * 100)))
    : 0

  const changes = withChange.map(r => r.price_change_pct!)
  const risingCount = changes.filter(c => c > 0).length
  const fallingCount = changes.filter(c => c < 0).length

  return { level, change30d, change7d, cardCount: priced.length, risingCount, fallingCount }
}

/**
 * Build a normalized index history.
 * For each card, normalize price_history so the card's first point = 100.
 * Average the normalized values by month to get an equal-weighted index.
 * Require a month to have at least minCoverage% of cards to be included.
 */
function computeIndexHistory(rows: CacheRow[]): { month: string; value: number }[] {
  const withHistory = rows.filter(
    r => r.price_history && r.price_history.length >= 2 && r.price != null && r.price > 0
  )
  if (withHistory.length < 3) return []

  const monthMap = new Map<string, number[]>()

  for (const row of withHistory) {
    const hist = (row.price_history!).filter(p => p.price > 0)
    if (hist.length < 2) continue
    const basePrice = hist[0].price

    for (const pt of hist) {
      const normalized = (pt.price / basePrice) * 100
      if (!monthMap.has(pt.month)) monthMap.set(pt.month, [])
      monthMap.get(pt.month)!.push(normalized)
    }
  }

  const minSamples = Math.max(2, Math.floor(withHistory.length * 0.15))
  const months = [...monthMap.keys()]
    .filter(m => (monthMap.get(m)?.length ?? 0) >= minSamples)
    .sort((a, b) => parseMonth(a) - parseMonth(b))

  return months.map(m => ({
    month: m,
    value: round2(median(monthMap.get(m)!)),
  }))
}

export interface IndexMetrics {
  level:           number   // current normalized index value (base 100)
  change7d:        number   // % change over last 7 days
  change30d:       number   // % change over last 30 days
  change90d:       number   // % change over last 90 days
  trendExtension:  number   // 7d momentum projected forward 30 days
  week52High:      number   // highest index value in last 52 weeks
  week52Low:       number   // lowest index value in last 52 weeks
}

/**
 * Derive index-level metrics from the normalized index history + per-card avgs.
 * - Period changes from history: compare latest value to N months back.
 * - 52w high/low: max/min over last 12 history points.
 * - Trend extension: 7d momentum × (30/7) — annualizes weekly momentum to 30d.
 */
function computeIndexMetrics(
  history: { month: string; value: number }[],
  change7d: number,
  change30d: number,
): IndexMetrics | null {
  if (history.length === 0) return null

  const current = history[history.length - 1].value

  // 90d change — compare to entry ~3 months back
  const idx90 = Math.max(0, history.length - 4)
  const val90 = history[idx90].value
  const change90d = round2(((current - val90) / val90) * 100)

  // 52-week window — last 12 monthly entries
  const window52 = history.slice(-12).map(h => h.value)
  const week52High = round2(Math.max(...window52))
  const week52Low  = round2(Math.min(...window52))

  // Trend extension: if this week's momentum continues for a month
  const trendExtension = round2(change7d * (30 / 7))

  return {
    level: round2(current),
    change7d,
    change30d,
    change90d,
    trendExtension,
    week52High,
    week52Low,
  }
}

function toMover(r: CacheRow, sales = false): MoverCard {
  return {
    card_id: r.card_id,
    card_name: r.card_name,
    grade: r.grade,
    price: r.price,
    change: r.price_change_pct,
    sales: sales ? r.sales_count_30d : null,
    score: r.score,
    image_url: r.image_url,
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const admin = createAdminClient()

    // ── Check if CI-100 constituents are configured ───────────────────────────
    const { data: constituents } = await admin
      .from('market_constituents')
      .select('card_id,grade,card_name,set_name,image_url')

    let rows: CacheRow[]
    let usingConstituents = false

    if (constituents && constituents.length > 0) {
      // Fetch ONLY constituent cards from search_cache
      usingConstituents = true
      const cacheKeys = constituents.map((c: { card_id: string; grade: string }) => `${c.card_id}:${c.grade}`)
      const { data: cached, error } = await admin
        .from('search_cache')
        .select('cache_key,card_id,card_name,set_name,grade,image_url,price,price_change_pct,price_history,avg7d,avg30d,sales_count_30d,score,last_fetched')
        .in('cache_key', cacheKeys)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      rows = (cached ?? []) as CacheRow[]
    } else {
      // Fallback: use all of search_cache (pre-index mode)
      const { data: all, error } = await admin
        .from('search_cache')
        .select('cache_key,card_id,card_name,set_name,grade,image_url,price,price_change_pct,price_history,avg7d,avg30d,sales_count_30d,score,last_fetched')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      rows = (all ?? []) as CacheRow[]
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        empty: true,
        constituentCount: constituents?.length ?? 0,
        pricedCount: 0,
      } as MarketResponse & { constituentCount: number; pricedCount: number }, {
        headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' },
      })
    }

    const allPriced = rows.filter(r => r.price != null && r.price > 0)
    const rawRows    = allPriced.filter(r => gradeType(r.grade) === 'raw')
    const gradedRows = allPriced.filter(r => gradeType(r.grade) !== 'raw')
    const psa10Rows  = allPriced.filter(r => gradeType(r.grade) === 'psa10')
    void usingConstituents // used for future metadata

    const overall = computeIndexStats(allPriced)
    const raw     = computeIndexStats(rawRows)
    const graded  = computeIndexStats(gradedRows)
    const psa10   = computeIndexStats(psa10Rows)

    const indexHistory = computeIndexHistory(allPriced)
    const indexMetrics = overall
      ? computeIndexMetrics(indexHistory, overall.change7d, overall.change30d)
      : null

    // Top movers — deduplicate by card_id so same card doesn't appear twice with different grades
    const byChange = [...allPriced]
      .filter(r => r.price_change_pct != null)
      .sort((a, b) => (b.price_change_pct ?? 0) - (a.price_change_pct ?? 0))

    const topRising  = byChange.slice(0, 10).map(r => toMover(r))
    const topFalling = [...byChange].reverse().slice(0, 10).map(r => toMover(r))

    const mostTraded = [...allPriced]
      .filter(r => (r.sales_count_30d ?? 0) > 0)
      .sort((a, b) => (b.sales_count_30d ?? 0) - (a.sales_count_30d ?? 0))
      .slice(0, 10)
      .map(r => toMover(r, true))

    // Market-wide signal based on 30d change
    const c = overall?.change30d ?? 0
    const signal: MarketResponse['signal'] =
      c >= 15 ? 'new_high' :
      c >=  3 ? 'rising' :
      c <= -15 ? 'new_low' :
      c <=  -3 ? 'falling' :
      'stable'

    const risingCount   = allPriced.filter(r => (r.price_change_pct ?? 0) > 0).length
    const fallingCount  = allPriced.filter(r => (r.price_change_pct ?? 0) < 0).length
    const unchangedCount = allPriced.filter(r => r.price_change_pct === 0).length

    const sorted = [...(rows as CacheRow[])].sort(
      (a, b) => new Date(b.last_fetched ?? 0).getTime() - new Date(a.last_fetched ?? 0).getTime()
    )

    const response = {
      overall,
      raw,
      graded,
      psa10,
      indexMetrics,
      indexHistory,
      topRising,
      topFalling,
      mostTraded,
      signal,
      stats: { totalCards: allPriced.length, risingCount, fallingCount, unchangedCount },
      lastUpdated: sorted[0]?.last_fetched ?? null,
      constituentCount: constituents?.length ?? 0,
      pricedCount: allPriced.length,
    } satisfies MarketResponse & { constituentCount: number; pricedCount: number }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=300' },
    })
  } catch (err) {
    console.error('[market] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
