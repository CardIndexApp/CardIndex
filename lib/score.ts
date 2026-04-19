/**
 * CardIndex Score Algorithm
 *
 * Score 0–100 built from real eBay sales signals.
 * Higher = better investment / more in-demand card.
 *
 * Breakdown (100 pts total):
 *   Price Trend (30 pts)  — how much the price has moved recently
 *   Liquidity   (25 pts)  — number of recent sales (how easy to sell)
 *   Consistency (25 pts)  — low price variance = more predictable
 *   Value       (20 pts)  — price relative to historical average
 */

import type { EbayPriceData } from './ebay'

export interface ScoreBreakdown {
  total: number
  trend: number
  liquidity: number
  consistency: number
  value: number
  label: string
  summary: string
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

export function computeScore(data: EbayPriceData): ScoreBreakdown {
  const { listings, averagePrice, medianPrice, salesCount, priceHistory } = data

  // ── 1. Price Trend (30 pts) ──────────────────────────────────────────────
  // Compare oldest vs newest monthly average in priceHistory
  let trendScore = 15 // neutral baseline
  if (priceHistory.length >= 2) {
    const oldest = priceHistory[0].price
    const newest = priceHistory[priceHistory.length - 1].price
    const changePct = oldest > 0 ? ((newest - oldest) / oldest) * 100 : 0
    // +30% = full 30 pts, -30% = 0 pts, 0% = 15 pts
    trendScore = clamp(Math.round(15 + changePct), 0, 30)
  }

  // ── 2. Liquidity (25 pts) ────────────────────────────────────────────────
  // More recent sales = easier to exit the position
  // 30+ sales in 50-item window = full score
  const liquidityScore = clamp(Math.round((salesCount / 30) * 25), 0, 25)

  // ── 3. Consistency (25 pts) ─────────────────────────────────────────────
  // Low coefficient of variation (stddev / mean) = predictable pricing
  const prices = listings.map(l => l.price)
  let consistencyScore = 20 // default decent
  if (prices.length >= 3) {
    const mean = prices.reduce((s, p) => s + p, 0) / prices.length
    const variance = prices.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / prices.length
    const stddev = Math.sqrt(variance)
    const cv = mean > 0 ? stddev / mean : 1
    // CV of 0 = 25 pts, CV of 0.5+ = 0 pts
    consistencyScore = clamp(Math.round(25 * (1 - cv * 2)), 0, 25)
  }

  // ── 4. Value signal (20 pts) ─────────────────────────────────────────────
  // If current median is below historical average, it's a buy signal
  // If well above, it may be overheated
  let valueScore = 10 // neutral
  if (priceHistory.length >= 2 && medianPrice > 0) {
    const histAvg = priceHistory.reduce((s, h) => s + h.price, 0) / priceHistory.length
    const diffPct = histAvg > 0 ? ((medianPrice - histAvg) / histAvg) * 100 : 0
    // -20% below avg = 20 pts (buy signal), +20% above = 0 pts (overheated)
    valueScore = clamp(Math.round(10 - diffPct / 2), 0, 20)
  }

  const total = trendScore + liquidityScore + consistencyScore + valueScore

  // Label
  const label =
    total >= 85 ? 'Exceptional' :
    total >= 70 ? 'Strong' :
    total >= 55 ? 'Moderate' :
    total >= 40 ? 'Weak' : 'Poor'

  const summary =
    total >= 85 ? 'Highly liquid, trending up, excellent consistency.' :
    total >= 70 ? 'Strong market fundamentals with good liquidity.' :
    total >= 55 ? 'Moderate signals — watch for trend confirmation.' :
    total >= 40 ? 'Limited sales activity or declining trend.' :
                  'Illiquid or declining market. High risk.'

  return {
    total: clamp(total, 1, 100),
    trend: trendScore,
    liquidity: liquidityScore,
    consistency: consistencyScore,
    value: valueScore,
    label,
    summary,
  }
}
