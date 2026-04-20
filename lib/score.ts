/**
 * CardIndex Score Algorithm
 *
 * Score 0–100 built from Poketrace pricing signals.
 * Higher = better investment / more in-demand card.
 *
 * Breakdown (100 pts total):
 *   Price Trend  (30 pts) — recent price movement (avg vs avg30d)
 *   Liquidity    (25 pts) — number of recent sales
 *   Consistency  (25 pts) — low price spread = predictable
 *   Value        (20 pts) — current price vs 30d average
 */

import type { TierPrice, PriceHistoryPoint } from './poketrace'

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

export function computeScore(
  tierPrice: TierPrice,
  history: PriceHistoryPoint[] = []
): ScoreBreakdown {
  const avg = tierPrice.avg ?? 0
  const avg30d = tierPrice.avg30d
  const avg7d = tierPrice.avg7d
  const low = tierPrice.low
  const high = tierPrice.high
  const saleCount = tierPrice.saleCount ?? 0

  // ── 1. Price Trend (30 pts) ──────────────────────────────────────────────
  // Compare current avg vs 30d avg. +30% change = 30pts, -30% = 0pts
  let trendScore = 15 // neutral baseline
  const trendBase = avg30d ?? (history.length > 1 ? history[0].avg : null)
  if (trendBase && trendBase > 0 && avg > 0) {
    const changePct = ((avg - trendBase) / trendBase) * 100
    trendScore = clamp(Math.round(15 + changePct), 0, 30)
  }

  // ── 2. Liquidity (25 pts) ────────────────────────────────────────────────
  // 30+ sales = full score
  const liquidityScore = clamp(Math.round((saleCount / 30) * 25), 0, 25)

  // ── 3. Consistency (25 pts) ─────────────────────────────────────────────
  // Low spread between low and high relative to avg = predictable
  let consistencyScore = 18 // reasonable default when data missing
  if (low !== undefined && high !== undefined && avg > 0) {
    const spread = (high - low) / avg
    consistencyScore = clamp(Math.round(25 * (1 - spread)), 0, 25)
  } else if (history.length >= 3) {
    const prices = history.map(h => h.avg).filter(Boolean)
    const mean = prices.reduce((s, p) => s + p, 0) / prices.length
    const variance = prices.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / prices.length
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1
    consistencyScore = clamp(Math.round(25 * (1 - cv * 2)), 0, 25)
  }

  // ── 4. Value (20 pts) ────────────────────────────────────────────────────
  // If current price is below 30d avg → buy signal (higher score)
  // If above 30d avg → possibly overheated (lower score)
  let valueScore = 10 // neutral
  const valueBase = avg30d ?? (history.length > 0 ? history.reduce((s, h) => s + h.avg, 0) / history.length : null)
  if (valueBase && valueBase > 0 && avg > 0) {
    const diffPct = ((avg - valueBase) / valueBase) * 100
    valueScore = clamp(Math.round(10 - diffPct / 2), 0, 20)
  }

  const total = trendScore + liquidityScore + consistencyScore + valueScore

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
