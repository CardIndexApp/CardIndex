'use client'
import { useState, useCallback, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ComposedChart, LineChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Navbar from '@/components/Navbar'
import { getCard, fmt, scoreColor } from '@/lib/data'
import { tcgImg } from '@/lib/img'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/lib/currency'

const GRADES = [
  { key: 'RAW', label: 'Ungraded' },
  { key: '10', label: 'GEM MT' },
  { key: '9', label: 'MINT' },
  { key: '8', label: 'NM-MT' },
  { key: '7', label: 'NEAR MT' },
  { key: '6', label: 'EX-MT' },
  { key: '5', label: 'EXCEL' },
  { key: '4', label: 'VG-EX' },
  { key: '3', label: 'VG' },
  { key: '1-2', label: 'POOR' },
]

const WINDOWS = [
  { key: '1M', label: '30 days' },
  { key: '3M', label: '90 days' },
  { key: '6M', label: '180 days' },
]

function getPriceVerdict(vsMarketPct: number) {
  if (vsMarketPct <= -50) return { label: 'EXCELLENT BUY', color: '#3de88a', bg: 'rgba(8,22,14,0.95)', border: 'rgba(61,232,138,0.15)' }
  if (vsMarketPct <= -20) return { label: 'GOOD VALUE', color: '#3de88a', bg: 'rgba(8,22,14,0.95)', border: 'rgba(61,232,138,0.15)' }
  if (vsMarketPct <= 10) return { label: 'FAIR VALUE', color: '#e8c547', bg: 'rgba(18,16,8,0.95)', border: 'rgba(232,197,71,0.15)' }
  if (vsMarketPct <= 30) return { label: 'ABOVE MARKET', color: '#e8524a', bg: 'rgba(22,8,8,0.95)', border: 'rgba(232,82,74,0.15)' }
  return { label: 'OVERPRICED', color: '#e8524a', bg: 'rgba(22,8,8,0.95)', border: 'rgba(232,82,74,0.15)' }
}

function getHoldVerdictColor(score: number) {
  return score >= 80 ? '#3de88a' : score >= 60 ? '#e8c547' : '#e8524a'
}

const SparkTooltip = ({ active, payload, formatter }: { active?: boolean; payload?: { value: number }[]; formatter?: (n: number) => string }) => {
  if (active && payload?.length) {
    const fmtFn = formatter ?? fmt
    return (
      <div style={{ background: '#181828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px' }}>
        <span className="font-num" style={{ fontSize: 12, color: '#f0f0f8' }}>{fmtFn(payload[0].value)}</span>
      </div>
    )
  }
  return null
}

function TileInfo({ id, text, activeTip, setActiveTip }: {
  id: string; text: string
  activeTip: string | null
  setActiveTip: (v: string | null) => void
}) {
  const open = activeTip === id
  return (
    /* Sits at position: absolute top-right — parent tile must have position: relative */
    <span
      style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
      onMouseEnter={() => setActiveTip(id)}
      onMouseLeave={() => setActiveTip(null)}
    >
      <button
        onClick={e => { e.stopPropagation(); setActiveTip(open ? null : id) }}
        style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
        aria-label="More info"
      >i</button>
      {open && (
        <div
          onMouseEnter={() => setActiveTip(id)}
          onMouseLeave={() => setActiveTip(null)}
          onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 13px', width: 210, maxWidth: '72vw', fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
        >
          {/* caret */}
          <div style={{ position: 'absolute', top: -5, right: 5, width: 8, height: 8, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)', borderBottom: 'none', borderRight: 'none', rotate: '45deg' }} />
          {text}
        </div>
      )}
    </span>
  )
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, letterSpacing: 1, color: 'var(--ink2)', fontWeight: 600 }}>{label}</span>
        <span className="font-num" style={{ fontSize: 12, color, fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

const PAGE_STYLES = `
  .ci-controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .ci-sum-grid  { display: grid; grid-template-columns: repeat(4, 1fr); }
  .ci-metrics   { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 10px; }
  .ci-two-col   { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .ci-score-wrap { display: flex; align-items: stretch; gap: 24px; }
  .ci-score-left { display: flex; flex-direction: column; align-items: center; justify-content: center;
    flex-shrink: 0; min-width: 120px; padding-right: 24px; border-right: 1px solid var(--border); }
  .ci-hold-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
  .ci-proj { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .ci-grade-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }

  @media (max-width: 700px) {
    .ci-controls { grid-template-columns: 1fr; }
    .ci-sum-grid  { grid-template-columns: repeat(2, 1fr); }
    .ci-metrics   { grid-template-columns: repeat(2, 1fr); }
    .ci-two-col   { grid-template-columns: 1fr; }
    .ci-score-wrap { flex-direction: column; }
    .ci-score-left { min-width: unset; padding-right: 0; border-right: none;
      padding-bottom: 16px; border-bottom: 1px solid var(--border);
      flex-direction: row; gap: 24px; align-items: flex-end; justify-content: flex-start; }
    .ci-hold-metrics { grid-template-columns: 1fr 1fr; }
    .ci-proj { grid-template-columns: 1fr; }
    .ci-hide-mobile { display: none !important; }
  }

  @media (min-width: 701px) {
    .ci-hide-desktop { display: none !important; }
  }

  /* ── Print / PDF ─────────────────────────────────────── */
  #ci-print-header { display: none; }

  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
        box-shadow: none !important; animation: none !important; transition: none !important; }
    @page { margin: 1.2cm 1.4cm; size: A4; }

    .ci-navbar, .ci-no-print { display: none !important; height: 0 !important;
      overflow: hidden !important; margin: 0 !important; padding: 0 !important; }

    #ci-print-header { display: block !important; margin-bottom: 20px;
      padding-bottom: 16px; border-bottom: 1px solid #242438; }

    body { background: #08080f !important; }
    .ci-main { padding-top: 16px !important; }

    .ci-card-surface { background: #0f0f1c !important; border: 1px solid #242438 !important; break-inside: avoid; }
    .ci-sum-grid  { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; }
    .ci-metrics   { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; }
    .ci-two-col   { display: grid !important; grid-template-columns: 1fr 1fr !important; }
    .ci-hold-metrics { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; }
    .ci-proj      { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; }
  }
`

interface LiveData {
  price: number
  price_change_pct: number
  price_range_low: number
  price_range_high: number
  price_history: { month: string; price: number; volume?: number }[]
  ebay_listings: { title: string; price: number; date: string; url: string }[]
  score: number
  score_breakdown: { total: number; trend: number; liquidity: number; consistency: number; value: number; label: string; summary: string }
  sales_count_30d: number
  resolved_tier?: string
  currency?: string
  // Card metadata stored in cache
  card_name?: string
  set_name?: string
  // pokemontcg.io image URL (images.pokemontcg.io) — available immediately from cache
  image_url?: string | null
  // Moving average fields
  avg1d?: number | null
  avg7d?: number | null
  avg30d?: number | null
  // Trend direction from Poketrace
  trend?: 'up' | 'down' | 'stable' | null
  confidence?: 'high' | 'medium' | 'low' | null
  // Full grade/condition price ladder
  all_tier_prices?: Record<string, { avg: number; source: string; saleCount?: number }> | null
  total_sale_count?: number | null
  last_updated_pt?: string | null
}

const TIER_LABELS: Record<string, string> = {
  PSA_10: 'PSA 10', PSA_9: 'PSA 9', PSA_8: 'PSA 8', PSA_7: 'PSA 7',
  PSA_6: 'PSA 6', PSA_5: 'PSA 5', PSA_4: 'PSA 4', PSA_3: 'PSA 3',
  PSA_2: 'PSA 2', PSA_1: 'PSA 1',
  BGS_10: 'BGS 10', BGS_9_5: 'BGS 9.5', BGS_9: 'BGS 9', BGS_8_5: 'BGS 8.5',
  CGC_10: 'CGC 10', CGC_9_5: 'CGC 9.5', CGC_9: 'CGC 9',
  NEAR_MINT: 'Near Mint', LIGHTLY_PLAYED: 'Lightly Played',
  MODERATELY_PLAYED: 'Mod. Played', HEAVILY_PLAYED: 'Heavily Played', DAMAGED: 'Damaged',
  AGGREGATED: 'CardMarket Avg',
}

const RAW_TIER_KEYS = new Set(['NEAR_MINT', 'LIGHTLY_PLAYED', 'MODERATELY_PLAYED', 'HEAVILY_PLAYED', 'DAMAGED'])

function fmtPrice(n: number, currency?: string) {
  if (currency && currency !== 'USD') {
    return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function TrendBadge({ trend, confidence }: { trend?: string | null; confidence?: string | null }) {
  if (!trend) return null
  const icon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
  const color = trend === 'up' ? '#3de88a' : trend === 'down' ? '#e8524a' : '#e8c547'
  const bg = trend === 'up' ? 'rgba(61,232,138,0.08)' : trend === 'down' ? 'rgba(232,82,74,0.08)' : 'rgba(232,197,71,0.08)'
  const border = trend === 'up' ? 'rgba(61,232,138,0.2)' : trend === 'down' ? 'rgba(232,82,74,0.2)' : 'rgba(232,197,71,0.2)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, background: bg, border: `1px solid ${border}`, fontSize: 11, fontWeight: 700, color }}>
        {icon} {trend.charAt(0).toUpperCase() + trend.slice(1)}
      </span>
      {confidence && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 9px', borderRadius: 99, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10, color: 'var(--ink3)' }}>
          {confidence === 'high' ? '●●●' : confidence === 'medium' ? '●●○' : '●○○'} {confidence}
        </span>
      )}
    </div>
  )
}

// ── Growth profile analysis ───────────────────────────────────────────────
type GrowthProfile = 'hype' | 'organic' | 'correction' | 'volatile' | 'stable' | 'unknown'
function analyzeGrowthProfile(prices: number[]): { profile: GrowthProfile; label: string; desc: string; color: string } {
  const fallback = { profile: 'unknown' as GrowthProfile, label: '—', desc: 'Not enough data', color: 'var(--ink3)' }
  if (prices.length < 5) return fallback
  const n = prices.length
  const first = prices[0], last = prices[n - 1]
  const totalPct = first > 0 ? (last - first) / first : 0
  const changes: number[] = []
  for (let i = 1; i < n; i++) { if (prices[i-1] > 0) changes.push((prices[i] - prices[i-1]) / prices[i-1]) }
  if (!changes.length) return fallback
  const mean = changes.reduce((s, c) => s + c, 0) / changes.length
  const stdDev = Math.sqrt(changes.reduce((s, c) => s + (c - mean) ** 2, 0) / changes.length)
  const dir = totalPct >= 0 ? 1 : -1
  const consistency = changes.filter(c => c * dir > 0).length / changes.length
  const t = Math.floor(n / 3)
  const earlyEnd = prices[t] ?? first, midEnd = prices[t * 2] ?? earlyEnd
  const ep = first > 0 ? Math.abs((earlyEnd - first) / first) : 0
  const mp = earlyEnd > 0 ? Math.abs((midEnd - earlyEnd) / earlyEnd) : 0
  const lp = midEnd > 0 ? Math.abs((last - midEnd) / midEnd) : 0
  const lateWeight = lp / (ep + mp + lp + 0.001)
  if (Math.abs(totalPct) < 0.03) return { profile: 'stable', label: 'Stable', desc: 'Price has been flat — no strong trend', color: '#8b8fa8' }
  const isHype = lateWeight > 0.55 && Math.abs(totalPct) > 0.08
  const isOrganic = consistency >= 0.55 && stdDev < 0.06
  if (totalPct > 0.03) {
    if (isHype) return { profile: 'hype', label: 'Hype-driven', desc: 'Price surged recently — likely a demand spike or viral interest. Watch for a pullback.', color: '#f97316' }
    if (isOrganic) return { profile: 'organic', label: 'Organic growth', desc: 'Steady, consistent gains across the full period — reflects sustained collector demand.', color: '#3de88a' }
    return { profile: 'volatile', label: 'Mixed signals', desc: 'Irregular price action — gains are present but no consistent pattern.', color: '#e8c547' }
  } else {
    if (isHype) return { profile: 'correction', label: 'Sharp correction', desc: 'Price dropped sharply — likely a reversal after a hype spike.', color: '#e8524a' }
    if (isOrganic) return { profile: 'correction', label: 'Gradual decline', desc: 'Slow, consistent fade — waning collector interest over time.', color: '#e8524a' }
    return { profile: 'volatile', label: 'Mixed signals', desc: 'Choppy decline — no clear direction established yet.', color: '#e8c547' }
  }
}

// ── Analysis engine ──────────────────────────────────────────────────────────

type AnalysisSignal = 'BUY' | 'ACCUMULATE' | 'HOLD' | 'REDUCE' | 'AVOID'

function computeAnalysis(d: LiveData) {
  const score       = d.score ?? 0
  const trend       = d.trend ?? 'stable'
  const confidence  = d.confidence ?? 'low'
  const sales       = d.sales_count_30d ?? 0
  const sb          = d.score_breakdown

  // Confidence multiplier — penalises thin-data signals
  const confMult = confidence === 'high' ? 1 : confidence === 'medium' ? 0.88 : 0.72
  const adj = score * confMult

  // Signal
  let signal: AnalysisSignal, sigColor: string, sigBg: string, sigBorder: string
  if (adj >= 74 && trend !== 'down') {
    signal = 'BUY';       sigColor = '#3de88a'; sigBg = 'rgba(61,232,138,0.07)';  sigBorder = 'rgba(61,232,138,0.2)'
  } else if (adj >= 60) {
    signal = 'ACCUMULATE'; sigColor = '#3de88a'; sigBg = 'rgba(61,232,138,0.05)'; sigBorder = 'rgba(61,232,138,0.15)'
  } else if (adj >= 44) {
    signal = 'HOLD';      sigColor = '#e8c547'; sigBg = 'rgba(232,197,71,0.06)'; sigBorder = 'rgba(232,197,71,0.15)'
  } else if (adj >= 28) {
    signal = 'REDUCE';    sigColor = '#e8524a'; sigBg = 'rgba(232,82,74,0.06)';  sigBorder = 'rgba(232,82,74,0.15)'
  } else {
    signal = 'AVOID';     sigColor = '#e8524a'; sigBg = 'rgba(232,82,74,0.08)';  sigBorder = 'rgba(232,82,74,0.2)'
  }

  // Momentum vs moving averages
  const vs7d  = d.avg7d  && d.avg7d  > 0 ? ((d.price - d.avg7d)  / d.avg7d)  * 100 : null
  const vs30d = d.avg30d && d.avg30d > 0 ? ((d.price - d.avg30d) / d.avg30d) * 100 : null

  // Liquidity bucket
  const liqLabel  = sales >= 500 ? 'Extremely High' : sales >= 200 ? 'Very High' : sales >= 50 ? 'High' : sales >= 15 ? 'Moderate' : sales >= 5 ? 'Low' : 'Very Low'
  const liqColor  = sales >= 50 ? '#3de88a' : sales >= 15 ? '#e8c547' : '#e8524a'

  // Consistency & value (normalised 0–100)
  const consPct   = sb ? Math.round(sb.consistency / 25 * 100) : 0
  const consLabel = consPct >= 80 ? 'Very stable' : consPct >= 60 ? 'Stable' : consPct >= 40 ? 'Some variance' : 'High variance'
  const valuePct  = sb ? Math.round(sb.value / 20 * 100) : 0
  const valueLabel = valuePct >= 80 ? 'Great value' : valuePct >= 60 ? 'Good value' : valuePct >= 40 ? 'Fair value' : 'Below average'

  // Price position in 30d range (0–100%)
  const rangeW    = d.price_range_high - d.price_range_low
  const rangePos  = rangeW > 0 ? (d.price - d.price_range_low) / rangeW : 0.5
  const rangePct  = Math.round(Math.max(0, Math.min(1, rangePos)) * 100)
  const rangeLabel = rangePos >= 0.8 ? 'Near range high' : rangePos >= 0.6 ? 'Above midpoint' : rangePos >= 0.4 ? 'Near midpoint' : rangePos >= 0.2 ? 'Below midpoint' : 'Near range low'
  const rangeColor = rangePos >= 0.75 ? '#e8c547' : '#3de88a'

  // Reasoning sentence
  const parts: string[] = []
  if (signal === 'BUY' || signal === 'ACCUMULATE') {
    parts.push(`CardIndex score ${score}/100`)
    if (trend === 'up') parts.push('rising price trend')
    if (sales >= 50)    parts.push(`liquid market — ${sales.toLocaleString()} sales in 30 days`)
    if (confidence === 'high') parts.push('high data confidence')
  } else if (signal === 'HOLD') {
    parts.push(`Score ${score}/100 with ${trend} trend`)
    if (consPct >= 70) parts.push('consistent price history')
    else parts.push('mixed signals — no clear direction')
  } else {
    if (score < 45)          parts.push(`low score of ${score}/100`)
    if (trend === 'down')    parts.push('declining price trend')
    if (sales < 10)          parts.push('thin market liquidity')
    if (confidence === 'low') parts.push('insufficient trade data for confidence')
  }
  const reasoning = parts.length > 0
    ? parts.join(', ').replace(/^(.)/, c => c.toUpperCase()) + '.'
    : 'Insufficient data for a confident recommendation.'

  return { signal, sigColor, sigBg, sigBorder, vs7d, vs30d, liqLabel, liqColor, consPct, consLabel, valuePct, valueLabel, rangePct, rangeLabel, rangeColor, reasoning }
}

function gradeToPoketraceTier(grade: string): string {
  if (!grade || grade === 'Raw' || grade === 'Ungraded') return 'NEAR_MINT'
  return grade.trim().replace(/\s+/g, '_').replace(/\./g, '_')
}

export default function CardPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const urlGrade   = searchParams.get('grade')    ?? null
  const urlName    = searchParams.get('name')     ?? null
  const urlSet     = searchParams.get('set')      ?? null
  const urlNumber  = searchParams.get('number')   ?? null
  const urlSetSlug = searchParams.get('set_slug') ?? null
  const card = getCard(id)

  // Currency conversion
  const { fmtCurrency } = useCurrency()

  const [apiCard, setApiCard] = useState<{ name: string; set: string; number: string; imageUrl: string; tags: string[] } | null>(null)
  const [imgError, setImgError] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  // Live price data from /api/card/[id]
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [liveDebug, setLiveDebug] = useState<Record<string, any> | null>(null)

  // Watchlist state
  const [watchlistAdded, setWatchlistAdded] = useState(false)
  const [watchlistItemId, setWatchlistItemId] = useState<string | null>(null)
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Check auth
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user)
      setUserId(data.user?.id ?? null)
    })
  }, [])

  // Check if card is already on watchlist
  useEffect(() => {
    if (!userId) return
    const grade = urlGrade ?? (card ? `PSA ${card.grade.replace('PSA ', '')}` : 'PSA 10')
    createClient()
      .from('watchlists')
      .select('id')
      .eq('user_id', userId)
      .eq('card_id', id)
      .eq('grade', grade)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setWatchlistAdded(true)
          setWatchlistItemId(data.id)
        }
      })
  }, [userId, id, urlGrade, card])

  // Stable fetch function — used by initial load and retry button
  const fetchLiveData = useCallback((bustCache = false) => {
    const cardName = urlName ?? card?.name
    const grade    = urlGrade ?? (card ? `PSA ${card.grade.replace('PSA ', '')}` : 'PSA 10')
    if (!cardName) return
    setLiveLoading(true)
    setLiveError(null)
    setLiveDebug(null)
    const params = new URLSearchParams({ grade, name: cardName })
    if (urlSet)    params.set('set', urlSet)
    if (urlNumber) params.set('number', urlNumber)
    if (bustCache) params.set('bust_cache', '1')
    fetch(`/api/card/${id}?${params.toString()}`)
      .then(async r => {
        const json = await r.json().catch(() => null)
        if (json?.data) {
          setLiveData(json.data)
        } else {
          const raw: string = json?.error ?? 'Unable to load price data'
          const msg = raw === 'Card not found on Poketrace' ? "This card isn't in the pricing database yet"
            : raw.startsWith('No price data') ? `No ${grade} sales data available`
            : raw === 'POKETRACE_API_KEY not configured' ? 'Pricing service unavailable'
            : raw.includes('authentication failed') ? 'Pricing service unavailable — please try again later'
            : raw.includes('rate limit') ? 'Too many requests — please wait a moment and retry'
            : raw.startsWith('Pricing service error') ? 'Pricing service temporarily unavailable'
            : raw
          setLiveError(msg)
          if (json?.debug) setLiveDebug(json.debug)
        }
      })
      .catch(() => setLiveError('Network error — please try again'))
      .finally(() => setLiveLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, urlGrade, urlName, urlSet, urlNumber, card])

  // Fetch live price data — userId intentionally excluded to avoid double-fetch
  useEffect(() => {
    fetchLiveData()
  }, [fetchLiveData])

  // Write recently viewed to localStorage — separate from price fetch so userId is always available
  useEffect(() => {
    if (!liveData || !userId) return
    try {
      const grade  = urlGrade ?? (card ? `PSA ${card.grade.replace('PSA ', '')}` : 'PSA 10')
      const cardName = urlName ?? card?.name ?? liveData.card_name ?? ''
      const rvKey  = `ci_rv_${userId}`
      const stored: Array<{ card_id: string; card_name: string; grade: string; set_name: string | null; viewed_at: string }> =
        JSON.parse(localStorage.getItem(rvKey) ?? '[]')
      const entry = {
        card_id: id,
        card_name: liveData.card_name ?? cardName,
        grade,
        set_name: liveData.set_name ?? urlSet ?? null,
        viewed_at: new Date().toISOString(),
      }
      const updated = [entry, ...stored.filter(x => !(x.card_id === id && x.grade === grade))].slice(0, 20)
      localStorage.setItem(rvKey, JSON.stringify(updated))
    } catch {}
  }, [liveData, userId])

  // Fetch pokemontcg.io metadata for unknown cards
  useEffect(() => {
    if (!card && id) {
      fetch(`https://api.pokemontcg.io/v2/cards/${id}`)
        .then(r => r.json())
        .then(d => {
          const c = d.data
          if (c) setApiCard({
            name: c.name,
            set: c.set?.name ?? '',
            number: c.number ?? '',
            imageUrl: c.images?.large ?? c.images?.small ?? '',
            tags: [c.rarity, c.supertype, ...(c.subtypes ?? [])].filter(Boolean),
          })
        })
        .catch(() => {})
    }
  }, [card, id])

  useEffect(() => {
    const dismiss = () => setActiveTip(null)
    document.addEventListener('click', dismiss)
    return () => document.removeEventListener('click', dismiss)
  }, [])

  const addToWatchlist = async () => {
    if (!isLoggedIn) return
    setWatchlistLoading(true)
    const cardName   = urlName ?? card?.name ?? apiCard?.name ?? ''
    const grade      = urlGrade ?? (card ? card.grade : 'PSA 10')
    const imageUrl   = card?.imageUrl ?? liveData?.image_url ?? apiCard?.imageUrl ?? ''
    const setName    = urlSet ?? card?.set ?? apiCard?.set ?? liveData?.set_name ?? ''
    const cardNumber = urlNumber ?? card?.cardNumber ?? apiCard?.number ?? ''
    const res = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: id, card_name: cardName, set_name: setName, grade, image_url: imageUrl, card_number: cardNumber }),
    })
    if (res.ok) {
      const json = await res.json()
      setWatchlistAdded(true)
      setWatchlistItemId(json.item?.id ?? null)
    }
    setWatchlistLoading(false)
  }

  const removeFromWatchlist = async () => {
    if (!watchlistItemId) return
    setWatchlistLoading(true)
    await fetch(`/api/watchlist?id=${watchlistItemId}`, { method: 'DELETE' })
    setWatchlistAdded(false)
    setWatchlistItemId(null)
    setWatchlistLoading(false)
  }

  const defaultGrade = card?.grade.replace('PSA ', '') ?? '10'
  const [selectedGrade, setSelectedGrade] = useState(defaultGrade)
  const [priceInput, setPriceInput] = useState(card ? String(card.price) : '')
  const [userPrice, setUserPrice] = useState(card ? card.price : 0)
  const [analysisWindow, setAnalysisWindow] = useState<'1M' | '3M' | '6M'>('3M')
  const [chartWindow, setChartWindow] = useState<'7d' | '30d' | '90d'>('30d')
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [activeTip, setActiveTip] = useState<string | null>(null)

  const handleAnalyse = useCallback(() => {
    const parsed = parseFloat(priceInput.replace(/[^0-9.]/g, ''))
    if (!isNaN(parsed) && parsed > 0) setUserPrice(parsed)
  }, [priceInput])

  const exportPDF = useCallback(() => {
    if (!card) return
    const dateStr = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    const gradeLabel = selectedGrade === 'RAW' ? 'Raw / Ungraded' : `PSA ${selectedGrade}`

    const existing = document.getElementById('ci-print-header')
    if (existing) existing.remove()

    const header = document.createElement('div')
    header.id = 'ci-print-header'
    header.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <div>
          <div style="font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#8888a0;margin-bottom:6px;">CardIndex — Card Market Intelligence</div>
          <div style="font-size:28px;font-weight:800;color:#eaeaf2;letter-spacing:-.5px;line-height:1;margin-bottom:6px;">${card.name}</div>
          <div style="font-size:12px;color:#8888a0;margin-bottom:10px;">${card.set} · #${card.cardNumber}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${card.tags.map(t => `<span style="background:rgba(232,197,71,.1);border:1px solid rgba(232,197,71,.25);border-radius:5px;padding:3px 10px;font-size:11px;font-weight:600;color:#e8c547;">${t}</span>`).join('')}
            <span style="background:#0f0f1c;border:1px solid #242438;border-radius:5px;padding:3px 10px;font-size:11px;color:#8888a0;">${gradeLabel}</span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          ${card.imageUrl ? `<img src="${card.imageUrl}" style="width:72px;border-radius:6px;margin-bottom:8px;display:block;margin-left:auto;" />` : ''}
          <div style="font-size:10px;color:#8888a0;">${dateStr}</div>
          <div style="font-size:10px;color:#5e5e76;margin-top:2px;">card-index.app</div>
        </div>
      </div>`

    const main = document.querySelector('.ci-main')
    if (main) main.insertBefore(header, main.firstChild)

    setTimeout(() => {
      window.print()
      setTimeout(() => {
        document.getElementById('ci-print-header')?.remove()
      }, 500)
    }, 150)
  }, [card, selectedGrade])

  // Non-demo card fallback — use live Poketrace data if available
  if (!card) {
    const displayName = urlName ?? apiCard?.name ?? liveData?.card_name ?? '...'
    const displaySet  = urlSet  ?? (apiCard ? `${apiCard.set} · #${apiCard.number}` : liveData?.set_name ?? 'Loading...')
    // Prefer pokemontcg.io URL from cache (available instantly) over the slower secondary API fetch
    const imageUrl    = apiCard?.imageUrl ?? liveData?.image_url ?? ''

    return (
      <>
        <style>{PAGE_STYLES}</style>
        <Navbar />
        <main className="ci-main" style={{ paddingTop: 72, paddingBottom: 80, minHeight: '100vh' }}>
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px' }}>

            {/* Card header */}
            <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden', marginTop: 24, marginBottom: 10 }}>
              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 80, height: 110, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {imageUrl && !imgError ? (
                      <img src={tcgImg(imageUrl)} alt={displayName} onError={() => setImgError(true)} style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: 28 }}>🃏</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h1 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 2 }}>{displayName}</h1>
                    <p style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 10 }}>{displaySet}</p>
                    {urlGrade && (
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, background: 'var(--gold2)', border: '1px solid rgba(232,197,71,0.25)', fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>{urlGrade}</span>
                    )}
                  </div>
                  {isLoggedIn && (
                    <button
                      onClick={watchlistAdded ? removeFromWatchlist : addToWatchlist}
                      disabled={watchlistLoading}
                      style={{ padding: '8px 14px', borderRadius: 10, background: watchlistAdded ? 'rgba(61,232,138,0.1)' : 'var(--surface2)', border: `1.5px solid ${watchlistAdded ? 'rgba(61,232,138,0.4)' : 'var(--border2)'}`, fontSize: 11, fontWeight: 600, color: watchlistAdded ? 'var(--green)' : 'var(--ink2)', cursor: watchlistLoading ? 'default' : 'pointer', flexShrink: 0 }}
                    >
                      {watchlistLoading ? '…' : watchlistAdded ? '★ Watching · Remove' : '☆ Watch'}
                    </button>
                  )}
                </div>
                <Link href={urlSetSlug ? `/search?return_to_set=${encodeURIComponent(urlSetSlug)}` : '/search'} style={{ fontSize: 12, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 14 }}>← Change card</Link>
              </div>
            </div>

            {/* Live data panel */}
            {liveLoading && (
              <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Fetching live prices…</div>
              </div>
            )}

            {!liveLoading && liveError && (
              <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: '24px 20px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>📭</span>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--ink2)', fontWeight: 600 }}>{liveError}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>Try a different grade, or check back later as new sales data is added regularly.</div>
                    </div>
                  </div>
                  <button
                    onClick={() => fetchLiveData(true)}
                    style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border2)', fontSize: 11, color: 'var(--ink2)', cursor: 'pointer', flexShrink: 0 }}
                  >
                    ↺ Retry
                  </button>
                </div>
                {liveDebug && (
                  <details style={{ marginTop: 12, fontSize: 10, color: 'var(--ink3)' }}>
                    <summary style={{ cursor: 'pointer', userSelect: 'none', letterSpacing: 0.5 }}>Debug info</summary>
                    <pre style={{ marginTop: 6, padding: '8px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.3)', overflow: 'auto', fontSize: 10, lineHeight: 1.5, color: 'var(--ink2)' }}>
                      {JSON.stringify(liveDebug, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {!liveLoading && liveData && (
              <>
                {/* Tier notice — shown when we fell back to a different tier */}
                {liveData.resolved_tier && liveData.resolved_tier !== gradeToPoketraceTier(urlGrade ?? 'Raw') && (
                  <div style={{ borderRadius: 10, padding: '10px 14px', background: 'rgba(232,197,71,0.06)', border: '1px solid rgba(232,197,71,0.2)', fontSize: 12, color: 'var(--gold)', marginBottom: 10 }}>
                    ⚠ No {urlGrade} data found — showing <strong>{liveData.resolved_tier.replace(/_/g, ' ')}</strong> prices instead
                  </div>
                )}

                {/* Price summary */}
                <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'nowrap', gap: 16 }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', display: 'block', marginBottom: 6 }}>MARKET PRICE</span>
                      <div className="font-num" style={{ fontSize: 42, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-2px', lineHeight: 1 }}>
                        {liveData.price > 0 ? fmtCurrency(liveData.price) : '—'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
                        {/* Desktop: Range first */}
                        {liveData.price_range_low > 0 && (
                          <span className="ci-hide-mobile" style={{ fontSize: 12, color: 'var(--ink3)' }}>
                            Range: {fmtCurrency(liveData.price_range_low)} – {fmtCurrency(liveData.price_range_high)}
                          </span>
                        )}
                        {/* Mobile: Sales first */}
                        {liveData.sales_count_30d > 0 && (
                          <span className="ci-hide-desktop" style={{ fontSize: 12, color: 'var(--ink3)', whiteSpace: 'nowrap' }}>
                            {liveData.sales_count_30d.toLocaleString()} sales (30d)
                          </span>
                        )}
                        {/* Both: % change */}
                        <span className="font-num" style={{ fontSize: 13, color: liveData.price_change_pct >= 0 ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                          {liveData.price_change_pct >= 0 ? '+' : ''}{liveData.price_change_pct.toFixed(1)}% (30d)
                        </span>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <TrendBadge trend={liveData.trend} confidence={liveData.confidence} />
                      </div>
                    </div>
                    {(() => {
                      const sig = computeAnalysis(liveData)
                      return (
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', display: 'block', marginBottom: 6 }}>CARDINDEX SCORE</span>
                          <div className="font-num" style={{ fontSize: 48, fontWeight: 800, color: scoreColor(liveData.score), letterSpacing: '-2px', lineHeight: 1 }}>{liveData.score}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2, marginBottom: 8 }}>{liveData.score_breakdown?.label ?? ''}</div>
                          <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 99, background: sig.sigBg, border: `1px solid ${sig.sigBorder}`, fontSize: 11, fontWeight: 800, color: sig.sigColor, letterSpacing: 1.5 }}>
                            {sig.signal}
                          </span>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Moving averages row */}
                  {(liveData.avg7d != null || liveData.avg30d != null) && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      {[
                        { label: '7D AVG', value: liveData.avg7d },
                        { label: '30D AVG', value: liveData.avg30d },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{label}</div>
                          <div className="font-num" style={{ fontSize: 15, fontWeight: 700, color: value != null ? 'var(--ink)' : 'var(--ink3)' }}>
                            {value != null ? fmtCurrency(value) : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>


                {/* Analysis panel */}
                {liveData.score_breakdown && (() => {
                  const a = computeAnalysis(liveData)
                  return (
                    <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px', marginBottom: 10 }}>
                      <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', display: 'block', marginBottom: 14 }}>ANALYSIS</span>

                      {/* 6 metric tiles — 3-col on desktop, 2-col on mobile */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>

                        {/* Price Momentum — split 7d / 30d */}
                        <div style={{ padding: '12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', position: 'relative' }}>
                          <TileInfo id="momentum" text="How the current price compares to its 7-day and 30-day moving averages. Positive means the price is trading above recent averages — a bullish signal." activeTip={activeTip} setActiveTip={setActiveTip} />
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 10 }}>PRICE MOMENTUM</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {/* 7d */}
                            <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                              <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--ink3)', marginBottom: 4 }}>7D AVG</div>
                              {a.vs7d != null ? (
                                <>
                                  <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: a.vs7d >= 0 ? '#3de88a' : '#e8524a' }}>
                                    {a.vs7d >= 0 ? '+' : ''}{a.vs7d.toFixed(1)}%
                                  </div>
                                  <div style={{ marginTop: 6, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '50%', top: -1, width: 1, height: 5, background: 'rgba(255,255,255,0.2)' }} />
                                    <div style={{ position: 'absolute', ...(a.vs7d >= 0 ? { left: '50%' } : { right: '50%' }), width: `${Math.min(Math.abs(a.vs7d), 25) / 25 * 50}%`, height: '100%', background: a.vs7d >= 0 ? '#3de88a' : '#e8524a', borderRadius: 2 }} />
                                  </div>
                                </>
                              ) : <div style={{ fontSize: 12, color: 'var(--ink3)' }}>—</div>}
                            </div>
                            {/* 30d */}
                            <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                              <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--ink3)', marginBottom: 4 }}>30D AVG</div>
                              {a.vs30d != null ? (
                                <>
                                  <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: a.vs30d >= 0 ? '#3de88a' : '#e8524a' }}>
                                    {a.vs30d >= 0 ? '+' : ''}{a.vs30d.toFixed(1)}%
                                  </div>
                                  <div style={{ marginTop: 6, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '50%', top: -1, width: 1, height: 5, background: 'rgba(255,255,255,0.2)' }} />
                                    <div style={{ position: 'absolute', ...(a.vs30d >= 0 ? { left: '50%' } : { right: '50%' }), width: `${Math.min(Math.abs(a.vs30d), 25) / 25 * 50}%`, height: '100%', background: a.vs30d >= 0 ? '#3de88a' : '#e8524a', borderRadius: 2 }} />
                                  </div>
                                </>
                              ) : <div style={{ fontSize: 12, color: 'var(--ink3)' }}>—</div>}
                            </div>
                          </div>
                        </div>

                        {/* Trend — mini sparkline */}
                        <div style={{ padding: '12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', position: 'relative' }}>
                          <TileInfo id="trend" text="Direction and rate of price change over the available history. Shows whether the card is appreciating, declining, or holding steady over time." activeTip={activeTip} setActiveTip={setActiveTip} />
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>PRICE TREND</div>
                          {(() => {
                            // Build sparkline data: prefer real history, fall back to synthetic 3-point from avg30d→avg7d→price
                            const histPrices = liveData.price_history?.length >= 2 ? liveData.price_history.map(p => p.price) : null
                            const synthetic: number[] | null = (!histPrices && liveData.avg30d && liveData.avg7d && liveData.price)
                              ? [liveData.avg30d, liveData.avg7d, liveData.price]
                              : null
                            const pts = histPrices ?? synthetic
                            const pct = pts && pts[0] > 0 ? ((pts[pts.length - 1] - pts[0]) / pts[0] * 100) : (liveData.price_change_pct ?? null)
                            const pctColor = pct != null && pct >= 0 ? '#3de88a' : '#e8524a'
                            const dir = liveData.trend ?? (pct == null ? 'stable' : pct > 2 ? 'up' : pct < -2 ? 'down' : 'stable')

                            const W = 200, H = 44
                            const sparkLine = pts && pts.length >= 2 ? (() => {
                              const min = Math.min(...pts), max = Math.max(...pts)
                              const rng = max - min || pts[0] * 0.01 || 1
                              const coords = pts.map((p, i) => ({
                                x: (i / (pts.length - 1)) * W,
                                y: H - 4 - ((p - min) / rng) * (H - 8),
                              }))
                              const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
                              const area = `${line} L${W},${H} L0,${H} Z`
                              return { coords, line, area }
                            })() : null

                            return (
                              <>
                                {sparkLine ? (
                                  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 44, display: 'block', marginBottom: 10 }}>
                                    <defs>
                                      <linearGradient id="trend-tile-grad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={pctColor} stopOpacity="0.3" />
                                        <stop offset="100%" stopColor={pctColor} stopOpacity="0" />
                                      </linearGradient>
                                    </defs>
                                    <path d={sparkLine.area} fill="url(#trend-tile-grad)" />
                                    <path d={sparkLine.line} fill="none" stroke={pctColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx={sparkLine.coords[sparkLine.coords.length - 1].x.toFixed(1)} cy={sparkLine.coords[sparkLine.coords.length - 1].y.toFixed(1)} r="2.5" fill={pctColor} />
                                  </svg>
                                ) : (
                                  <div style={{ height: 44, display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                                    <div style={{ height: 2, width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 1 }} />
                                  </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <TrendBadge trend={dir} confidence={null} />
                                  {pct != null && (
                                    <span className="font-num" style={{ fontSize: 12, fontWeight: 700, color: pctColor }}>
                                      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              </>
                            )
                          })()}
                        </div>

                        {/* Liquidity — graduated bar */}
                        <div style={{ padding: '12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                          <TileInfo id="liquidity" text="How actively this card trades on the market. Higher liquidity means it's easier to buy or sell at a fair price. Based on the number of eBay sales in the last 30 days." activeTip={activeTip} setActiveTip={setActiveTip} />
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>LIQUIDITY</div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: a.liqColor, marginBottom: 7 }}>{a.liqLabel}</div>
                          {/* 5-segment bar: thresholds 5 / 15 / 50 / 200 / 500 sales */}
                          {(() => {
                            const sales = liveData.sales_count_30d ?? 0
                            const thresholds = [5, 15, 50, 200, 500]
                            const filled = thresholds.filter(t => sales >= t).length
                            return (
                              <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                                {thresholds.map((_, i) => (
                                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < filled ? a.liqColor : 'rgba(255,255,255,0.07)', opacity: i < filled ? (0.5 + i * 0.12) : 1 }} />
                                ))}
                              </div>
                            )
                          })()}
                          {(liveData.sales_count_30d ?? 0) > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{(liveData.sales_count_30d ?? 0).toLocaleString()} sales / 30d</div>
                          )}
                          </div>
                        </div>

                        {/* Price position — gradient spectrum */}
                        <div style={{ padding: '12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                          <TileInfo id="position" text="Where the current market price sits within its 30-day trading range. Near the high end suggests strong buying pressure; near the low end may signal weakness or a buying opportunity." activeTip={activeTip} setActiveTip={setActiveTip} />
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>PRICE POSITION</div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: a.rangeColor, marginBottom: 9 }}>{a.rangeLabel}</div>
                          {/* Gradient track + marker */}
                          <div style={{ position: 'relative', marginBottom: 6 }}>
                            <div style={{ height: 7, borderRadius: 4, background: 'linear-gradient(to right, #3de88a 0%, #e8c547 50%, #e8524a 100%)' }} />
                            <div style={{
                              position: 'absolute',
                              left: `${Math.max(5, Math.min(95, a.rangePct))}%`,
                              top: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: 13, height: 13,
                              borderRadius: '50%',
                              background: '#fff',
                              border: '2px solid var(--surface2)',
                              boxShadow: `0 0 0 2px ${a.rangeColor}, 0 2px 8px rgba(0,0,0,0.5)`,
                              zIndex: 1,
                            }} />
                          </div>
                          {/* Low / high labels */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink3)' }}>
                            <span>{fmtCurrency(liveData.price_range_low)}</span>
                            <span style={{ fontSize: 9, color: 'var(--ink3)', opacity: 0.5 }}>{a.rangePct}th pct.</span>
                            <span>{fmtCurrency(liveData.price_range_high)}</span>
                          </div>
                          </div>
                        </div>

                        {/* Consistency — ring progress */}
                        <div style={{ padding: '12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', textAlign: 'center', position: 'relative' }}>
                          <TileInfo id="consistency" text="How stable the price has been over time. A high score means low volatility — the card holds its value reliably. A low score means the price swings around a lot." activeTip={activeTip} setActiveTip={setActiveTip} />
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 10 }}>CONSISTENCY</div>
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                            <div style={{
                              width: 52, height: 52, borderRadius: '50%',
                              background: `conic-gradient(${scoreColor(a.consPct)} 0% ${a.consPct}%, rgba(255,255,255,0.07) ${a.consPct}% 100%)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="font-num" style={{ fontSize: 10, fontWeight: 700, color: scoreColor(a.consPct) }}>{a.consPct}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{a.consLabel}</div>
                        </div>

                        {/* Value score — ring progress */}
                        <div style={{ padding: '12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', textAlign: 'center', position: 'relative' }}>
                          <TileInfo id="value" text="Measures whether the current price represents good value relative to the card's trading history and market fundamentals. High means undervalued; low means priced at a premium." activeTip={activeTip} setActiveTip={setActiveTip} />
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 10 }}>VALUE SCORE</div>
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                            <div style={{
                              width: 52, height: 52, borderRadius: '50%',
                              background: `conic-gradient(${scoreColor(a.valuePct)} 0% ${a.valuePct}%, rgba(255,255,255,0.07) ${a.valuePct}% 100%)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="font-num" style={{ fontSize: 10, fontWeight: 700, color: scoreColor(a.valuePct) }}>{a.valuePct}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{a.valueLabel}</div>
                        </div>

                      </div>
                    </div>
                  )
                })()}

                {/* Score breakdown */}
                {liveData.score_breakdown && (
                  <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)' }}>SCORE BREAKDOWN</span>
                      <span className="font-num" style={{ fontSize: 11, color: 'var(--ink3)' }}>out of 100</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <ScoreBar label="Trend"       value={Math.round(liveData.score_breakdown.trend / 30 * 100)}       color={scoreColor(Math.round(liveData.score_breakdown.trend / 30 * 100))} />
                      <ScoreBar label="Liquidity"   value={Math.round(liveData.score_breakdown.liquidity / 25 * 100)}   color={scoreColor(Math.round(liveData.score_breakdown.liquidity / 25 * 100))} />
                      <ScoreBar label="Consistency" value={Math.round(liveData.score_breakdown.consistency / 25 * 100)} color={scoreColor(Math.round(liveData.score_breakdown.consistency / 25 * 100))} />
                      <ScoreBar label="Value"       value={Math.round(liveData.score_breakdown.value / 20 * 100)}       color={scoreColor(Math.round(liveData.score_breakdown.value / 20 * 100))} />
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', lineHeight: 1.65 }}>{liveData.score_breakdown.summary}</p>
                  </div>
                )}

                {/* Price & Volume Chart */}
                {liveData.price_history && liveData.price_history.length >= 2 && (() => {
                  const pts = chartWindow === '7d' ? 7 : chartWindow === '30d' ? 30 : 90
                  const sliced = liveData.price_history.slice(-pts)
                  const hasVolume = sliced.some(p => (p.volume ?? 0) > 0)
                  const first = sliced[0]?.price ?? 0
                  const last  = sliced[sliced.length - 1]?.price ?? 0
                  const pct   = first > 0 ? ((last - first) / first * 100) : 0
                  const lineColor = pct >= 0 ? '#3de88a' : '#e8524a'
                  const maxVol = Math.max(...sliced.map(p => p.volume ?? 0), 1)

                  // Tick stride: show ~6 labels regardless of window size
                  const stride = Math.max(1, Math.floor(sliced.length / 6))

                  const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div style={{ background: '#181828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', minWidth: 120 }}>
                        <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 6 }}>{label}</div>
                        {payload.map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: 'var(--ink2)' }}>{p.name === 'price' ? fmtCurrency(p.value) : `${p.value} sales`}</span>
                          </div>
                        ))}
                      </div>
                    )
                  }

                  return (
                    <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)' }}>PRICE &amp; VOLUME</span>
                          <span className="font-num" style={{ fontSize: 13, fontWeight: 700, color: lineColor }}>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['7d', '30d', '90d'] as const).map(w => (
                            <button key={w} onClick={() => setChartWindow(w)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${chartWindow === w ? lineColor : 'var(--border2)'}`, background: chartWindow === w ? `${lineColor}18` : 'transparent', color: chartWindow === w ? lineColor : 'var(--ink3)', cursor: 'pointer', fontWeight: chartWindow === w ? 700 : 400, transition: 'all 0.15s' }}>
                              {w}
                            </button>
                          ))}
                        </div>
                      </div>

                      <ResponsiveContainer width="100%" height={180}>
                        <ComposedChart data={sliced} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                          <XAxis
                            dataKey="month"
                            tick={{ fill: '#55556a', fontSize: 9, fontFamily: 'Helvetica' }}
                            axisLine={false} tickLine={false}
                            interval={stride - 1}
                          />
                          <YAxis yAxisId="price" hide domain={['auto', 'auto']} />
                          {hasVolume && <YAxis yAxisId="vol" orientation="right" hide domain={[0, maxVol * 3]} />}
                          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }} />
                          {hasVolume && (
                            <Bar yAxisId="vol" dataKey="volume" name="volume" fill={lineColor} opacity={0.18} radius={[2, 2, 0, 0]} />
                          )}
                          <Line yAxisId="price" type="monotone" dataKey="price" name="price" stroke={lineColor} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: lineColor, stroke: 'var(--surface)' }} />
                        </ComposedChart>
                      </ResponsiveContainer>

                      {hasVolume && (
                        <div style={{ display: 'flex', gap: 16, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 10, height: 2, background: lineColor, borderRadius: 1 }} />
                            <span style={{ fontSize: 10, color: 'var(--ink3)' }}>Price</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 10, height: 8, background: lineColor, opacity: 0.35, borderRadius: 2 }} />
                            <span style={{ fontSize: 10, color: 'var(--ink3)' }}>Sales volume</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Grade / condition price ladder */}
                {liveData.all_tier_prices && Object.keys(liveData.all_tier_prices).length > 0 && (() => {
                  const tiers = liveData.all_tier_prices!
                  const resolvedTier = liveData.resolved_tier ?? ''
                  const gradedEntries = Object.entries(tiers)
                    .filter(([k]) => !RAW_TIER_KEYS.has(k) && k !== 'AGGREGATED')
                    .sort(([, a], [, b]) => b.avg - a.avg)
                  const rawEntries = Object.entries(tiers)
                    .filter(([k]) => RAW_TIER_KEYS.has(k))
                    .sort(([, a], [, b]) => b.avg - a.avg)
                  const marketEntry = tiers['AGGREGATED']

                  const TierRow = ({ tierKey, data }: { tierKey: string; data: { avg: number; source: string; saleCount?: number } }) => {
                    const isActive = tierKey === resolvedTier
                    return (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                        background: isActive ? 'rgba(232,197,71,0.07)' : 'transparent',
                        border: isActive ? '1px solid rgba(232,197,71,0.25)' : '1px solid transparent',
                        transition: 'background 0.15s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: isActive ? 'var(--gold)' : 'var(--ink2)', fontWeight: isActive ? 700 : 400 }}>
                            {TIER_LABELS[tierKey] ?? tierKey.replace(/_/g, ' ')}
                          </span>
                          {isActive && (
                            <span style={{ fontSize: 9, letterSpacing: 1, padding: '2px 6px', borderRadius: 4, background: 'rgba(232,197,71,0.15)', color: 'var(--gold)', fontWeight: 600 }}>CURRENT</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {data.saleCount != null && data.saleCount > 0 && (
                            <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{data.saleCount} sales</span>
                          )}
                          <span style={{ fontSize: 10, color: 'var(--ink3)', opacity: 0.7 }}>{data.source}</span>
                          <span className="font-num" style={{ fontSize: 14, fontWeight: 700, color: isActive ? 'var(--gold)' : 'var(--ink)', minWidth: 72, textAlign: 'right' }}>
                            {fmtCurrency(data.avg)}
                          </span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)' }}>PRICE LADDER</span>
                        {liveData.total_sale_count != null && liveData.total_sale_count > 0 && (
                          <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{liveData.total_sale_count.toLocaleString()} total sales</span>
                        )}
                      </div>

                      {gradedEntries.length > 0 && (
                        <>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8, paddingLeft: 4 }}>GRADED</div>
                          {gradedEntries.map(([k, v]) => <TierRow key={k} tierKey={k} data={v} />)}
                        </>
                      )}

                      {rawEntries.length > 0 && (
                        <>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginTop: gradedEntries.length > 0 ? 14 : 0, marginBottom: 8, paddingLeft: 4 }}>RAW / UNGRADED</div>
                          {rawEntries.map(([k, v]) => <TierRow key={k} tierKey={k} data={v} />)}
                        </>
                      )}

                      {marketEntry && (
                        <>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginTop: 14, marginBottom: 8, paddingLeft: 4 }}>MARKET</div>
                          <TierRow tierKey="AGGREGATED" data={marketEntry} />
                        </>
                      )}

                      {liveData.last_updated_pt && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--ink3)' }}>
                          Data updated {new Date(liveData.last_updated_pt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </>
            )}

            {!liveLoading && !liveData && (
              <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: '32px 20px', textAlign: 'center' }}>
                <p className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>No price data available</p>
                <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
                  We couldn&apos;t find pricing for this card. Try a different grade or check back soon.
                </p>
                <Link href="/search" style={{ display: 'inline-block', marginTop: 16, padding: '10px 20px', borderRadius: 10, background: 'var(--gold)', color: '#08080f', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                  Search again
                </Link>
              </div>
            )}

          </div>
        </main>
      </>
    )
  }

  // Prefer live API data where available, fall back to hardcoded card data
  const livePrice   = liveData?.price         ?? card.price
  const liveScore   = liveData?.score         ?? card.score
  const liveHistory = liveData?.price_history ?? card.history.map((h: { month: string; price: number }) => h)
  const liveListings = liveData?.ebay_listings ?? card.ebayListings
  const liveRangeLow  = liveData?.price_range_low  ?? card.priceRange90d.min
  const liveRangeHigh = liveData?.price_range_high ?? card.priceRange90d.max
  const liveTrendPct  = liveData?.price_change_pct ?? card.trendPct
  const liveSalesCount = liveData?.sales_count_30d ?? card.ebayListings.length

  // Derived values
  const marketAvg = livePrice
  const vsMarketPct = userPrice > 0 ? ((userPrice - marketAvg) / marketAvg * 100) : 0
  const belowMkt = marketAvg - userPrice
  const verdict = getPriceVerdict(vsMarketPct)
  const holdColor = getHoldVerdictColor(card.holdScore)
  const mainScoreColor = scoreColor(liveScore)

  const rangeWidth = liveRangeHigh - liveRangeLow
  const priceBarPos = Math.max(0, Math.min(100, rangeWidth > 0 ? (userPrice - liveRangeLow) / rangeWidth * 100 : 50))

  const windowPoints = analysisWindow === '1M' ? 2 : analysisWindow === '3M' ? 3 : 6
  const chartData = liveHistory.slice(-windowPoints)
  const chartColor = liveTrendPct >= 0 ? '#3de88a' : '#e8524a'

  const windowLabel = analysisWindow === '1M' ? 'last 30 days' : analysisWindow === '3M' ? 'last 90 days' : 'last 180 days'
  const summaryText = `Based on eBay sold data from the ${windowLabel}, ${urlGrade ?? card.grade} copies sold between ${fmtCurrency(liveRangeLow)} and ${fmtCurrency(liveRangeHigh)}. Your price of ${fmtCurrency(userPrice)} is approximately ${Math.abs(Math.round(vsMarketPct))}% ${vsMarketPct < 0 ? 'below' : 'above'} the market average of ${fmtCurrency(marketAvg)}${vsMarketPct <= -20 ? ', representing a strong buying opportunity if authentic' : ''}.`

  const breakevenDisplay = vsMarketPct < 0
    ? { label: `Already ${Math.abs(Math.round(vsMarketPct))}% below market`, sub: 'at / below market' }
    : card.monthlyGrowth > 0
      ? { label: `~${Math.ceil(Math.log(userPrice / marketAvg) / Math.log(1 + card.monthlyGrowth / 100))}mo`, sub: `at +${card.monthlyGrowth}%/mo growth` }
      : { label: 'N/A', sub: 'negative growth trend' }

  const C = { borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 10 }
  const P = { padding: '18px 20px' }
  const L: React.CSSProperties = { fontSize: 10, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 12, display: 'block' }

  return (
    <>
      <style>{PAGE_STYLES}</style>
      <Navbar />
      <main className="ci-main" style={{ paddingTop: 72, paddingBottom: 100, minHeight: '100vh' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px' }}>

          {/* ── Card Header (with controls) ── */}
          <div style={{ ...C, marginTop: 24 }} className="ci-card-surface">
            <div style={{ ...P }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                  <div
                    onClick={() => card.imageUrl && !imgError && setLightbox(true)}
                    title={card.imageUrl && !imgError ? 'Click to enlarge' : undefined}
                    style={{ width: 88, height: 122, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', cursor: card.imageUrl && !imgError ? 'zoom-in' : 'default', position: 'relative', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { if (card.imageUrl && !imgError) e.currentTarget.style.borderColor = 'var(--gold)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
                  >
                    {card.imageUrl && !imgError ? (
                      <img src={tcgImg(card.imageUrl)} alt={card.name} onError={() => setImgError(true)} style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: 40 }}>{card.emoji}</span>
                    )}
                  </div>

                  {/* Lightbox */}
                  {lightbox && card.imageUrl && (
                    <div
                      onClick={() => setLightbox(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
                    >
                      <div style={{ position: 'relative', maxWidth: 420, width: '100%' }}>
                        <img
                          src={tcgImg(card.imageUrl)}
                          alt={card.name}
                          style={{ width: '100%', borderRadius: 16, boxShadow: '0 32px 80px rgba(0,0,0,0.8)', display: 'block' }}
                          onClick={e => e.stopPropagation()}
                        />
                        <button
                          onClick={() => setLightbox(false)}
                          style={{ position: 'absolute', top: -14, right: -14, width: 32, height: 32, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >×</button>
                        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 12 }}>Click anywhere to close</p>
                      </div>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="font-mono-custom" style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 6 }}>CARDINDEX — CARD MARKET INTELLIGENCE</p>
                    <h1 className="font-display" style={{ fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 4, lineHeight: 1.1 }}>{card.name}</h1>
                    <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 12 }}>{card.set} · #{card.cardNumber}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {card.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink2)', letterSpacing: 0.3 }}>{tag}</span>
                      ))}
                    </div>
                    <Link href={urlSetSlug ? `/search?return_to_set=${encodeURIComponent(urlSetSlug)}` : '/search'} style={{ fontSize: 12, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 14 }}>← Change card</Link>
                  </div>
                </div>
                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'flex-start', flexShrink: 0 }}>
                  {/* Watchlist button */}
                  {isLoggedIn && (
                    <button
                      className="ci-no-print"
                      onClick={watchlistAdded ? removeFromWatchlist : addToWatchlist}
                      disabled={watchlistLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: watchlistAdded ? 'rgba(61,232,138,0.1)' : 'var(--surface2)', border: `1.5px solid ${watchlistAdded ? 'rgba(61,232,138,0.4)' : 'var(--border2)'}`, borderRadius: 10, padding: '9px 14px', fontSize: 11, fontWeight: 600, color: watchlistAdded ? 'var(--green)' : 'var(--ink2)', cursor: watchlistLoading ? 'default' : 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => { if (!watchlistAdded) { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' } }}
                      onMouseLeave={e => { if (!watchlistAdded) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--ink2)' } }}
                    >
                      {watchlistLoading ? '…' : watchlistAdded ? '★ Watching · Remove' : '☆ Watch'}
                    </button>
                  )}
                  {/* Live data badge + force refresh */}
                  {liveData && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'var(--green)', letterSpacing: 1, padding: '4px 8px', borderRadius: 6, background: 'rgba(61,232,138,0.07)', border: '1px solid rgba(61,232,138,0.15)' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                        LIVE DATA
                      </div>
                      <button
                        onClick={() => {
                          setLiveData(null)
                          // Delete Supabase cache entry then re-fetch live
                          const grade = urlGrade ?? (card ? `PSA ${card.grade.replace('PSA ', '')}` : 'PSA 10')
                          fetch(`/api/cache?id=${encodeURIComponent(id)}&grade=${encodeURIComponent(grade)}`, { method: 'DELETE' })
                            .finally(() => fetchLiveData(true))
                        }}
                        title="Force refresh prices"
                        style={{ padding: '3px 7px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border2)', fontSize: 10, color: 'var(--ink3)', cursor: 'pointer', lineHeight: 1 }}
                      >↺</button>
                    </div>
                  )}
                  {liveLoading && (
                    <div style={{ fontSize: 9, color: 'var(--ink3)', letterSpacing: 1 }}>Fetching prices…</div>
                  )}
                  {/* Export PDF button */}
                  <button
                    className="ci-no-print"
                    onClick={exportPDF}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1.5px solid var(--border2)', borderRadius: 10, padding: '9px 14px', fontSize: 11, fontWeight: 500, color: 'var(--ink3)', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0, alignSelf: 'flex-start' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--ink3)' }}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1" />
                    <rect x="4" y="9" width="8" height="6" rx="1" />
                    <path d="M8 1v8M5 6l3 3 3-3" />
                  </svg>
                  Export PDF
                </button>
                </div>
              </div>

              {/* Grade + Price + Window — inline in header */}
              <div className="ci-controls ci-no-print" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                {/* Grade */}
                <div>
                  <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 8, display: 'block' }}>GRADE</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {GRADES.map(g => {
                      const active = selectedGrade === g.key
                      return (
                        <button key={g.key} onClick={() => setSelectedGrade(g.key)}
                          style={{ padding: '5px 9px', borderRadius: 6, border: active ? '1px solid rgba(232,197,71,0.4)' : '1px solid var(--border)', background: active ? 'var(--gold2)' : 'transparent', cursor: 'pointer' }}>
                          <span className="font-num" style={{ fontSize: 11, fontWeight: 700, color: active ? 'var(--gold)' : 'var(--ink3)' }}>{g.key}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                {/* Price */}
                <div>
                  <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 8, display: 'block' }}>YOUR PRICE</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, paddingLeft: 10, overflow: 'hidden' }}>
                      <span className="font-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink3)', flexShrink: 0 }}>$</span>
                      <input type="text" inputMode="numeric" value={priceInput}
                        onChange={e => setPriceInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAnalyse()}
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '9px 8px 9px 4px', fontSize: 16, fontWeight: 700, color: 'var(--gold)', fontFamily: 'Helvetica, Arial, sans-serif', letterSpacing: '-0.5px', minWidth: 0 }} />
                    </div>
                    <button onClick={handleAnalyse}
                      style={{ padding: '0 14px', borderRadius: 8, background: 'var(--gold)', border: 'none', color: '#08080f', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11, fontWeight: 800, letterSpacing: 1, cursor: 'pointer', flexShrink: 0 }}>
                      ANALYSE
                    </button>
                  </div>
                </div>
                {/* Window */}
                <div>
                  <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 8, display: 'block' }}>WINDOW</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {WINDOWS.map(w => {
                      const active = analysisWindow === w.key
                      return (
                        <button key={w.key} onClick={() => setAnalysisWindow(w.key as '1M' | '3M' | '6M')}
                          style={{ flex: 1, padding: '7px 6px', borderRadius: 7, border: active ? '1px solid rgba(232,197,71,0.4)' : '1px solid var(--border)', background: active ? 'var(--gold2)' : 'transparent', cursor: 'pointer', textAlign: 'center' }}>
                          <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--gold)' : 'var(--ink3)', lineHeight: 1 }}>{w.key}</div>
                          <div style={{ fontSize: 9, color: active ? 'rgba(232,197,71,0.6)' : 'var(--ink3)', marginTop: 3 }}>{w.label}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── CardIndex Score ── */}
          <div style={{ ...C }} className="ci-card-surface">
            <div style={{ ...P }}>
              <div className="ci-score-wrap">
                <div className="ci-score-left">
                  <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 10, display: 'block', textAlign: 'center' }}>CARDINDEX SCORE</span>
                  <div className="font-num" style={{ fontSize: 64, fontWeight: 800, color: mainScoreColor, letterSpacing: '-3px', lineHeight: 1 }}>{liveScore}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>/ 100</div>
                  <div style={{ marginTop: 10, width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${liveScore}%`, background: mainScoreColor, borderRadius: 2 }} />
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 32px' }}>
                    <ScoreBar label="GROWTH"     value={card.breakdown.growth}     color={scoreColor(card.breakdown.growth)} />
                    <ScoreBar label="LIQUIDITY"  value={card.breakdown.liquidity}  color={scoreColor(card.breakdown.liquidity)} />
                    <ScoreBar label="DEMAND"     value={card.breakdown.demand}     color={scoreColor(card.breakdown.demand)} />
                    <ScoreBar label="VOLATILITY" value={card.breakdown.volatility} color={scoreColor(card.breakdown.volatility)} />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5, marginTop: 2 }}>
                    Composite score measuring growth potential, market liquidity, price volatility, and collector demand. Updated daily.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Price Verdict ── */}
          <div style={{ borderRadius: 14, background: verdict.bg, border: `1px solid ${verdict.border}`, padding: '22px 24px', marginBottom: 10 }}>
            <span style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 10 }}>PRICE VERDICT</span>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="font-display" style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800, color: verdict.color, letterSpacing: '-0.5px', marginBottom: 12 }}>{verdict.label}</div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>{summaryText}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="font-num" style={{ fontSize: 'clamp(40px, 8vw, 56px)', fontWeight: 800, color: verdict.color, letterSpacing: '-3px', lineHeight: 1 }}>
                  {vsMarketPct < 0 ? '' : '+'}{Math.round(vsMarketPct)}%
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, letterSpacing: 1 }}>
                  {vsMarketPct < 0 ? 'below' : 'above'} market avg
                </div>
              </div>
            </div>
          </div>

          {/* ── Show Full Analysis toggle ── */}
          <div className="ci-no-print" style={{ marginBottom: 10 }}>
            <button
              onClick={() => setShowAnalysis(!showAnalysis)}
              style={{ width: '100%', padding: '14px 20px', borderRadius: 14, background: 'var(--surface)', border: '1px solid rgba(232,197,71,0.25)', color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'border-color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(232,197,71,0.25)')}
            >
              {showAnalysis ? '↑ Hide Analysis' : '↓ Show Full Analysis'}
            </button>
          </div>

          {/* ── Full Analysis (hidden by default) ── */}
          {showAnalysis && (
            <>
              {/* 8-cell Summary Grid */}
              <div style={{ ...C }} className="ci-card-surface">
                <div className="ci-sum-grid">
                  {[
                    { label: 'VERDICT',      value: verdict.label,                                                                            sub: 'price vs market',                                                                                              valueColor: verdict.color,                                              valueSize: 15 },
                    { label: 'MARKET AVG',   value: fmtCurrency(marketAvg),                                                                        sub: `${liveSalesCount} eBay sold`,                                                                                  valueColor: 'var(--ink)',                                               valueSize: 22 },
                    { label: 'YOUR PRICE',   value: fmtCurrency(userPrice),                                                                       sub: vsMarketPct < 0 ? `${fmtCurrency(belowMkt)} below` : `${fmtCurrency(Math.abs(belowMkt))} above`,              valueColor: 'var(--gold)',                                              valueSize: 22 },
                    { label: 'VS MARKET',    value: `${vsMarketPct >= 0 ? '+' : ''}${Math.round(vsMarketPct)}%`,                              sub: vsMarketPct < 0 ? 'below market' : 'above market',                                                             valueColor: vsMarketPct < 0 ? '#3de88a' : '#e8524a',                   valueSize: 24 },
                    { label: 'HOLD RATING',  value: liveData?.score_breakdown?.label ?? card.holdVerdict,                                     sub: `score: ${liveScore}/100`,                                                                                      valueColor: holdColor,                                                  valueSize: 14 },
                    { label: 'SALES FOUND',  value: String(liveSalesCount),                                                                   sub: `${liveSalesCount} eBay sold`,                                                                                  valueColor: 'var(--ink)',                                               valueSize: 26 },
                    { label: 'PRICE RANGE',  value: `${fmtCurrency(liveRangeLow)}–${fmtCurrency(liveRangeHigh)}`,                             sub: 'low — high',                                                                                                   valueColor: 'var(--ink)',                                               valueSize: 13 },
                    { label: 'TREND',        value: `${liveTrendPct >= 0 ? '+' : ''}${liveTrendPct}%`,                                        sub: liveTrendPct >= 5 ? 'Rising' : liveTrendPct <= -5 ? 'Declining' : 'Stable',                                     valueColor: liveTrendPct >= 0 ? '#3de88a' : '#e8524a',                 valueSize: 22 },
                  ].map((cell, i) => (
                    <div key={i} style={{
                      padding: '16px 18px',
                      borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
                      borderRight: (i + 1) % 4 !== 0 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 8 }}>{cell.label}</div>
                      <div className="font-num" style={{ fontSize: cell.valueSize, fontWeight: 700, color: cell.valueColor, lineHeight: 1.1, marginBottom: 5 }}>{cell.value}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{cell.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7 }}>
                  {summaryText}
                </div>
                <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, background: 'rgba(61,232,138,0.06)', border: '1px solid rgba(61,232,138,0.15)', fontSize: 10, color: '#3de88a' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3de88a', display: 'inline-block' }} />
                    LIVE DATA · eBay completed listings — {card.rarity} {selectedGrade === 'RAW' ? 'raw/ungraded' : `PSA ${selectedGrade}`}
                  </span>
                </div>
              </div>

              {/* 4 metric cards */}
              <div className="ci-metrics">
                {[
                  { label: 'MARKET AVG',       value: fmtCurrency(marketAvg),            sub: 'current',                                                                                                          valueColor: 'var(--ink)' },
                  { label: 'YOUR PRICE',        value: fmtCurrency(userPrice),            sub: vsMarketPct < 0 ? `${fmtCurrency(belowMkt)} below mkt` : `${fmtCurrency(Math.abs(belowMkt))} above mkt`,        valueColor: 'var(--gold)' },
                  { label: `SALES (${analysisWindow})`, value: String(liveSalesCount), sub: `${liveSalesCount} eBay sold`,                   valueColor: 'var(--ink)' },
                  { label: 'VOLATILITY',        value: `±${card.volatilityPct}%`,     sub: card.volatilityLabel, valueColor: card.volatilityPct >= 40 ? '#e8524a' : card.volatilityPct >= 20 ? '#e8c547' : 'var(--ink)' },
                ].map((m, i) => (
                  <div key={i} style={{ borderRadius: 14, padding: '18px 20px', background: 'var(--surface)', border: '1px solid var(--border)' }} className="ci-card-surface">
                    <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 10 }}>{m.label}</div>
                    <div className="font-num" style={{ fontSize: 22, fontWeight: 800, color: m.valueColor, letterSpacing: '-0.5px', marginBottom: 5 }}>{m.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink3)', lineHeight: 1.4 }}>{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Price Range + Price Trend */}
              <div className="ci-two-col">
                <div style={{ ...C, marginBottom: 0 }} className="ci-card-surface">
                  <div style={{ ...P }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink3)' }}>PRICE RANGE — {analysisWindow}</span>
                      <span style={{ fontSize: 10, color: 'var(--ink3)' }}>Last {analysisWindow === '1M' ? '30' : analysisWindow === '3M' ? '90' : '180'} days</span>
                    </div>
                    <div style={{ position: 'relative', marginBottom: 36 }}>
                      <div style={{ height: 6, borderRadius: 3, background: 'linear-gradient(to right, rgba(232,197,71,0.4), rgba(61,232,138,0.5))' }}>
                        <div style={{ position: 'absolute', left: `${priceBarPos}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 14, height: 14, borderRadius: '50%', background: '#e8c547', border: '2px solid var(--bg)', boxShadow: '0 0 8px rgba(232,197,71,0.5)', zIndex: 2 }} />
                      </div>
                      <div style={{ position: 'absolute', top: 14, left: `${priceBarPos}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 10, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ color: '#e8c547', fontSize: 11 }}>•</span> Your price
                      </div>
                      <div style={{ position: 'absolute', top: 14, left: 0, fontSize: 10, color: 'var(--ink2)' }}>Low: {fmtCurrency(liveRangeLow)}</div>
                      <div style={{ position: 'absolute', top: 14, right: 0, fontSize: 10, color: 'var(--ink2)' }}>High: {fmtCurrency(liveRangeHigh)}</div>
                    </div>
                  </div>
                </div>
                <div style={{ ...C, marginBottom: 0 }} className="ci-card-surface">
                  <div style={{ ...P }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink3)' }}>PRICE TREND — {analysisWindow}</span>
                      <div style={{ textAlign: 'right' }}>
                        <div className="font-num" style={{ fontSize: 18, fontWeight: 700, color: chartColor }}>{liveTrendPct >= 0 ? '+' : ''}{liveTrendPct}%</div>
                        <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{card.trendLabel} trend</div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={110}>
                      <LineChart data={chartData} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
                        <XAxis dataKey="month" tick={{ fill: '#55556a', fontSize: 9, fontFamily: 'Helvetica' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<SparkTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
                        <Line type="monotone" dataKey="price" stroke={chartColor} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: chartColor, stroke: 'var(--surface)' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Liquidity Rate */}
              <div style={{ ...C }} className="ci-card-surface">
                <div style={{ ...P }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink3)' }}>LIQUIDITY RATE</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="font-num" style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>{card.liquidityScore}</span>
                      <span style={{ fontSize: 12, color: 'var(--ink3)' }}>/100</span>
                      <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.2)', color: 'var(--gold)' }}>{card.liquidityLabel}</span>
                    </div>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginBottom: 14, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${card.liquidityScore}%`, background: 'var(--gold)', borderRadius: 2 }} />
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.65 }}>{card.liquidityDesc}</p>
                </div>
              </div>

              {/* eBay Sold Listings */}
              <div style={{ ...C }} className="ci-card-surface">
                <div style={{ ...P }}>
                  <span style={{ ...L }}>EBAY SOLD LISTINGS USED</span>
                  {liveListings.map((listing: { title: string; price: number; date: string; url?: string; badge?: string }, i: number) => (
                    <a key={i} href={listing.url} target="_blank" rel="noopener noreferrer"
                      style={{ paddingTop: 14, paddingBottom: 14, borderBottom: i < liveListings.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, textDecoration: 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 4 }}>{listing.title}</p>
                        <p style={{ fontSize: 11, color: 'var(--ink3)' }}>{listing.date ? new Date(listing.date).toLocaleDateString() : ''}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {listing.badge && (
                          <div style={{ fontSize: 9, letterSpacing: 1.5, padding: '2px 7px', borderRadius: 4, background: listing.badge === 'HIGH' ? 'rgba(232,82,74,0.1)' : 'rgba(61,232,138,0.1)', color: listing.badge === 'HIGH' ? '#e8524a' : '#3de88a', border: `1px solid ${listing.badge === 'HIGH' ? 'rgba(232,82,74,0.2)' : 'rgba(61,232,138,0.2)'}`, marginBottom: 5, display: 'inline-block' }}>{listing.badge}</div>
                        )}
                        <div className="font-num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(listing.price)}</div>
                      </div>
                    </a>
                  ))}
                  <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--ink3)' }}>
                    {liveSalesCount} sales · Avg: {fmtCurrency(marketAvg)} · Range: {fmtCurrency(liveRangeLow)}–{fmtCurrency(liveRangeHigh)}
                  </div>
                </div>
              </div>

              {/* AI Insights */}
              <div style={{ ...C }} className="ci-card-surface">
                <div style={{ ...P }}>
                  <span style={{ ...L }}>AI INSIGHTS</span>
                  {card.aiInsights.map((insight, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 0', borderBottom: i < card.aiInsights.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ color: '#3de88a', fontSize: 14, flexShrink: 0, marginTop: 1 }}>•</span>
                      <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.65, margin: 0 }}>{insight}</p>
                    </div>
                  ))}
                </div>
              </div>

            </>
          )}

        </div>
      </main>
    </>
  )
}
