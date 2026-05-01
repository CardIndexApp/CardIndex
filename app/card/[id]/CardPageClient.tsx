'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ComposedChart, LineChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ReferenceArea } from 'recharts'
import Navbar from '@/components/Navbar'
import { getCard, fmt, scoreColor } from '@/lib/data'
import { tcgImg } from '@/lib/img'
import { createClient } from '@/lib/supabase/client'
import { useCurrency, CURRENCIES } from '@/lib/currency'

const GRADES = [
  { key: 'Raw',    label: 'RAW',    grader: 'RAW' },
  { key: 'PSA 10', label: 'PSA 10', grader: 'PSA' },
  { key: 'PSA 9',  label: 'PSA 9',  grader: 'PSA' },
  { key: 'PSA 8',  label: 'PSA 8',  grader: 'PSA' },
  { key: 'PSA 7',  label: 'PSA 7',  grader: 'PSA' },
  { key: 'PSA 6',  label: 'PSA 6',  grader: 'PSA' },
  { key: 'PSA 5',  label: 'PSA 5',  grader: 'PSA' },
  { key: 'PSA 4',  label: 'PSA 4',  grader: 'PSA' },
  { key: 'PSA 3',  label: 'PSA 3',  grader: 'PSA' },
  { key: 'PSA 2',  label: 'PSA 2',  grader: 'PSA' },
  { key: 'PSA 1',  label: 'PSA 1',  grader: 'PSA' },
  { key: 'BGS 10', label: 'BGS 10', grader: 'BGS' },
  { key: 'BGS 9.5',label: 'BGS 9.5',grader: 'BGS' },
  { key: 'BGS 9',  label: 'BGS 9',  grader: 'BGS' },
  { key: 'BGS 8.5',label: 'BGS 8.5',grader: 'BGS' },
  { key: 'CGC 10', label: 'CGC 10', grader: 'CGC' },
  { key: 'CGC 9.5',label: 'CGC 9.5',grader: 'CGC' },
  { key: 'CGC 9',  label: 'CGC 9',  grader: 'CGC' },
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

function TileInfo({ id, text, activeTip, setActiveTip, inline }: {
  id: string; text: string
  activeTip: string | null
  setActiveTip: (v: string | null) => void
  inline?: boolean
}) {
  const open    = activeTip === id
  const btnRef  = useRef<HTMLButtonElement>(null)
  const tipRef  = useRef<HTMLDivElement>(null)
  const [tipRect, setTipRect] = useState<{
    top: number; left: number; alignRight: boolean; above: boolean
  } | null>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      // Stay open if the tap/click is inside the button OR inside the tooltip portal
      if (btnRef.current?.contains(target)) return
      if (tipRef.current?.contains(target)) return
      setActiveTip(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open, setActiveTip])

  function openTip() {
    if (!btnRef.current) { setActiveTip(id); return }
    const r    = btnRef.current.getBoundingClientRect()
    const tipW = Math.min(240, window.innerWidth - 24)
    // Start anchored to button's left edge, then clamp so it never overflows either side
    let left = r.left
    if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8
    if (left < 8) left = 8
    const above = window.innerHeight - r.bottom < 120
    const top   = above ? r.top - 8 : r.bottom + 8
    setTipRect({ top, left, alignRight: false, above })
    setActiveTip(id)
  }

  return (
    <span
      className="ci-no-print"
      style={inline
        ? { display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, flexShrink: 0 }
        : { position: 'absolute', top: 2, right: 2, zIndex: 10,
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }
      }
    >
      <button
        ref={btnRef}
        onPointerEnter={e => { if (e.pointerType !== 'touch') openTip() }}
        onPointerLeave={e => { if (e.pointerType !== 'touch') setActiveTip(null) }}
        onTouchEnd={e => { e.preventDefault(); e.stopPropagation(); open ? setActiveTip(null) : openTip() }}
        onClick={e => { e.stopPropagation(); if (!('ontouchstart' in window)) { open ? setActiveTip(null) : openTip() } }}
        style={{
          width: 22, height: 22, minHeight: 22, borderRadius: '50%',
          background: open ? 'rgba(232,197,71,0.18)' : 'rgba(255,255,255,0.07)',
          border: `1px solid ${open ? 'rgba(232,197,71,0.4)' : 'rgba(255,255,255,0.13)'}`,
          color: open ? 'var(--gold)' : 'rgba(255,255,255,0.4)',
          fontSize: 10, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, lineHeight: 1, transition: 'all 0.15s',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
        aria-label="More info"
        aria-expanded={open}
      >i</button>

      {open && tipRect && typeof document !== 'undefined' && createPortal(
        <div
          ref={tipRef}
          onPointerEnter={e => { if (e.pointerType !== 'touch') setActiveTip(id) }}
          onPointerLeave={e => { if (e.pointerType !== 'touch') setActiveTip(null) }}
          onTouchStart={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            ...(tipRect.above
              ? { bottom: window.innerHeight - tipRect.top }
              : { top: tipRect.top }),
            left: tipRect.left,
            zIndex: 9999,
            background: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 10,
            padding: '12px 14px',
            width: Math.min(240, window.innerWidth - 24),
            fontSize: 12,
            color: 'rgba(255,255,255,0.82)',
            lineHeight: 1.6,
            boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{
            position: 'absolute',
            ...(tipRect.above
              ? { bottom: -5, borderBottom: 'none', borderLeft: 'none' }
              : { top: -5,    borderTop: 'none',    borderRight: 'none' }),
            ...(tipRect.alignRight ? { right: 10 } : { left: 10 }),
            width: 8, height: 8,
            background: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.14)',
            rotate: '45deg',
          }} />
          {text}
        </div>,
        document.body
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
  .ci-analysis-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }

  /* Analytics grid helpers */
  .ci-adv-4col { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .ci-adv-3col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .ci-adv-2col { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }

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
    .ci-analysis-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .ci-tile-label { font-size: 8px !important; letter-spacing: 1px !important; }
    .ci-tile { padding: 10px !important; }
    .ci-analysis-panel { padding: 14px !important; }
    .ci-page-outer { padding: 0 12px !important; }
    .ci-section { margin-bottom: 8px !important; }
    .ci-pc-row { grid-template-columns: 1fr 1fr !important; }
    .ci-pc-row > div:last-child { grid-column: 1 / -1; }

    /* Analytics grids: collapse 4→2 col, 3→2 col on mobile */
    .ci-adv-4col { grid-template-columns: repeat(2, 1fr) !important; }
    .ci-adv-3col { grid-template-columns: repeat(2, 1fr) !important; }

    /* Analytics panel inner padding */
    .ci-card-surface > div { padding: 14px 14px !important; }

    /* Grade premium: allow label to wrap */
    .ci-grade-label { white-space: normal !important; font-size: 11px !important; }

    /* Bottom nav extra clearance on card page */
    .ci-main { padding-bottom: 100px !important; }

    /* Card header: buttons move below card info on mobile */
    .ci-card-actions { flex-direction: row !important; width: 100%; align-items: stretch !important; margin-top: 4px; flex-shrink: unset !important; }
    .ci-card-actions > * { flex: 1 !important; min-width: 0; }
    .ci-card-actions > * > button { width: 100% !important; }
  }

  @media (min-width: 701px) {
    .ci-hide-desktop { display: none !important; }
  }

  /* Hide number-input spinners (price check field) */
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type="number"] { -moz-appearance: textfield; }

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
  // Data quality fields
  data_warning?: string | null   // null | 'limited_sales' | 'rare_asset' | 'high_value_limited' | 'low_volume_tcg_fallback' | 'low_volume_no_fallback'
  data_source?: string | null    // 'ebay' | 'tcgplayer' | 'cardmarket'
  ebay_sale_count?: number | null
  ebay_avg_usd?: number | null
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
  // Detect Poketrace tier contamination (e.g. PSA 10 avg leaking into Raw tier).
  // Fingerprint: avg7d ≈ avg30d (within 3%) while both are more than 3x away from
  // the current price. In a real crash the 7d avg always diverges from the 30d avg
  // because recent prices have already fallen — identical averages = static wrong-tier data.
  const _a7  = d.avg7d  && d.avg7d  > 0 ? d.avg7d  : null
  const _a30 = d.avg30d && d.avg30d > 0 ? d.avg30d : null
  const _contaminated = (() => {
    if (!_a7 || !_a30 || !d.price) return false
    const divergence = Math.abs(_a7 - _a30) / _a30          // how different are the two averages?
    const ratio      = Math.max(_a7 / d.price, d.price / _a7) // how far from current price?
    return divergence < 0.03 && ratio > 3                    // nearly identical + far from price = bad data
  })()
  const clean7d  = _contaminated ? null : _a7
  const clean30d = _contaminated ? null : _a30
  const vs7d  = clean7d  ? ((d.price - clean7d)  / clean7d)  * 100 : null
  const vs30d = clean30d ? ((d.price - clean30d) / clean30d) * 100 : null

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

  // Reasoning sentence — fully data-driven
  const parts: string[] = []
  if (signal === 'BUY' || signal === 'ACCUMULATE') {
    parts.push(`Score ${score}/100`)
    if (trend === 'up')          parts.push('price trending up')
    else if (trend === 'stable') parts.push('stable price trend')
    if (sales >= 50)             parts.push(`strong liquidity — ${sales.toLocaleString()} sales in 30d`)
    else if (sales >= 15)        parts.push(`moderate liquidity — ${sales.toLocaleString()} sales in 30d`)
    if (vs30d !== null && vs30d < -5) parts.push(`trading ${Math.abs(vs30d).toFixed(1)}% below 30d avg`)
    if (confidence === 'high')   parts.push('high data confidence')
  } else if (signal === 'HOLD') {
    parts.push(`Score ${score}/100`)
    if (trend === 'up')          parts.push('price edging up')
    else if (trend === 'down')   parts.push('slight downward drift')
    else                         parts.push('no clear price direction')
    if (consPct >= 70)           parts.push('consistent price history')
    else if (consPct < 40)       parts.push('volatile price history')
    if (sales < 15)              parts.push('low sales volume')
  } else {
    // REDUCE / AVOID
    if (score === 0 || score === 1) {
      parts.push('no market data available')
      parts.push('unable to assess value')
    } else {
      if (score < 45)            parts.push(`weak score of ${score}/100`)
      if (trend === 'down')      parts.push('declining price trend')
      if (sales === 0)           parts.push('no recent sales recorded')
      else if (sales < 5)        parts.push(`only ${sales} sale${sales === 1 ? '' : 's'} in 30d`)
      else if (sales < 15)       parts.push('thin market liquidity')
      if (vs30d !== null && vs30d > 10) parts.push(`trading ${vs30d.toFixed(1)}% above 30d avg`)
      if (confidence === 'low')  parts.push('insufficient data for confidence')
    }
  }
  const reasoning = parts.length > 0
    ? parts.join(', ').replace(/^(.)/, c => c.toUpperCase()) + '.'
    : 'Insufficient data for a confident recommendation.'

  return { signal, sigColor, sigBg, sigBorder, vs7d, vs30d, clean7d, clean30d, liqLabel, liqColor, consPct, consLabel, valuePct, valueLabel, rangePct, rangeLabel, rangeColor, reasoning }
}

// ── Price Check ───────────────────────────────────────────────────────────────
// Produces a modified LiveData snapshot where the "price" the user is paying
// replaces the market price for the purposes of analysis. The value component
// is recalculated using the same formula as lib/score.ts, which pushes the
// signal toward BUY when the found price is significantly below market.
function buildPriceCheckData(base: LiveData, userPrice: number): LiveData {
  const market = base.price
  if (!market || market <= 0 || !base.score_breakdown) return base

  // Compare user price against 30d avg (fair-value proxy), or market if unavailable
  const valueBase = base.avg30d ?? market
  const diffPct   = valueBase > 0 ? ((userPrice - valueBase) / valueBase) * 100 : 0

  // Same clamp formula as lib/score.ts value component
  const newValue  = Math.max(0, Math.min(20, Math.round(10 - diffPct / 2)))
  const delta     = newValue - base.score_breakdown.value
  const newTotal  = Math.max(1, Math.min(100, base.score_breakdown.total + delta))

  return {
    ...base,
    price: userPrice,  // so computeAnalysis recalculates vs7d / vs30d from buyer's POV
    score: newTotal,
    score_breakdown: { ...base.score_breakdown, value: newValue, total: newTotal },
  }
}

function gradeToPoketraceTier(grade: string): string {
  if (!grade || grade === 'Raw' || grade === 'Ungraded') return 'NEAR_MINT'
  return grade.trim().replace(/\s+/g, '_').replace(/\./g, '_')
}

export default function CardPageClient() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const urlGrade   = searchParams.get('grade')    ?? null
  const urlName    = searchParams.get('name')     ?? null
  const urlSet     = searchParams.get('set')      ?? null
  const urlNumber  = searchParams.get('number')   ?? null
  const urlSetSlug = searchParams.get('set_slug') ?? null
  const card = getCard(id)

  // Currency conversion
  const { fmtCurrency, currency, rates, convert } = useCurrency()
  // Symbol for the active currency (e.g. "A$", "£")
  const currencySymbol = CURRENCIES[currency]?.symbol ?? '$'
  // Convert a user-entered local-currency amount → USD (what all internal prices use)
  const toUSD = (localAmount: number) => localAmount / (rates[currency] ?? 1)

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

  // Portfolio state
  const [pfLoading, setPfLoading] = useState(false)
  const [pfShowForm, setPfShowForm] = useState(false)
  const [pfPrice, setPfPrice] = useState('')
  const [pfQty, setPfQty] = useState('1')
  const [pfError, setPfError] = useState<string | null>(null)
  const [pfSuccess, setPfSuccess] = useState(false)

  // Check auth
  const [userId, setUserId] = useState<string | null>(null)
  const [userTier, setUserTier] = useState<string>('free')
  useEffect(() => {
    const client = createClient()
    client.auth.getUser().then(async ({ data }) => {
      setIsLoggedIn(!!data.user)
      setUserId(data.user?.id ?? null)
      if (data.user) {
        const { data: prof } = await client.from('profiles').select('tier').eq('id', data.user.id).single()
        setUserTier(prof?.tier ?? 'free')
      }
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

  // CI Index comparison data (non-blocking)
  const [marketSnap, setMarketSnap] = useState<{
    change7d: number | null
    change30d: number | null
    change90d: number | null
    risingCount: number
    fallingCount: number
    totalCards: number
  } | null>(null)

  useEffect(() => {
    if (!liveData) return
    fetch('/api/market')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || d.empty) return
        // Prefer indexMetrics (normalized history-based), fall back to overall per-card medians
        setMarketSnap({
          change7d:     d.indexMetrics?.change7d  ?? d.overall?.change7d  ?? null,
          change30d:    d.indexMetrics?.change30d ?? d.overall?.change30d ?? null,
          change90d:    d.indexMetrics?.change90d ?? null,
          risingCount:  d.stats?.risingCount  ?? 0,
          fallingCount: d.stats?.fallingCount ?? 0,
          totalCards:   d.stats?.totalCards   ?? 0,
        })
      })
      .catch(() => {})
  }, [liveData])

  // Pre-fill portfolio price from live data
  useEffect(() => {
    if (liveData?.price && !pfPrice) {
      const localPrice = liveData.price * (rates[currency] ?? 1)
      setPfPrice(localPrice.toFixed(2))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveData])

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

  const submitPortfolio = async () => {
    const localPrice = parseFloat(pfPrice.replace(/[^0-9.]/g, ''))
    const qty = parseInt(pfQty, 10)
    if (!localPrice || localPrice <= 0) { setPfError('Enter a valid price'); return }
    if (!qty || qty < 1) { setPfError('Enter a valid quantity'); return }
    setPfError(null)
    setPfLoading(true)
    const cardName   = urlName ?? card?.name ?? apiCard?.name ?? ''
    const grade      = urlGrade ?? (card ? card.grade : 'PSA 10')
    const imageUrl   = card?.imageUrl ?? liveData?.image_url ?? apiCard?.imageUrl ?? ''
    const setName    = urlSet ?? card?.set ?? apiCard?.set ?? liveData?.set_name ?? ''
    const cardNumber = urlNumber ?? card?.cardNumber ?? apiCard?.number ?? ''
    const res = await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_id: id,
        card_name: cardName,
        set_name: setName,
        grade,
        image_url: imageUrl,
        card_number: cardNumber,
        purchase_price: toUSD(localPrice),
        quantity: qty,
      }),
    })
    setPfLoading(false)
    if (res.ok) {
      setPfSuccess(true)
      setPfShowForm(false)
      setPfPrice('')
      setPfQty('1')
    } else {
      const j = await res.json().catch(() => ({}))
      setPfError(j.error ?? 'Failed to add to portfolio')
    }
  }

  const removeFromWatchlist = async () => {
    if (!watchlistItemId) return
    setWatchlistLoading(true)
    await fetch(`/api/watchlist?id=${watchlistItemId}`, { method: 'DELETE' })
    setWatchlistAdded(false)
    setWatchlistItemId(null)
    setWatchlistLoading(false)
  }

  const defaultGrade = urlGrade ?? card?.grade ?? 'PSA 10'
  const [selectedGrade, setSelectedGrade] = useState(defaultGrade)
  const [priceInput, setPriceInput] = useState(card ? String(card.price) : '')
  const [userPrice, setUserPrice] = useState(card ? card.price : 0)
  const [analysisWindow, setAnalysisWindow] = useState<'1M' | '3M' | '6M'>('3M')
  const [chartWindow, setChartWindow] = useState<'7d' | '30d' | '90d'>('30d')
  const [showAnalysis, setShowAnalysis] = useState(true)
  const [ladderGrader, setLadderGrader] = useState<'PSA' | 'BGS' | 'CGC'>('PSA')
  const [activeTip, setActiveTip]             = useState<string | null>(null)
  const [priceCheckOpen, setPriceCheckOpen]   = useState(false)
  const [priceCheckInput, setPriceCheckInput] = useState('')
  const [priceCheckPrice, setPriceCheckPrice] = useState<number | null>(null)

  function commitPriceCheck() {
    const local = parseFloat(priceCheckInput.replace(/[^0-9.]/g, ''))
    if (local > 0) {
      // Store as USD internally — all liveData prices are USD
      setPriceCheckPrice(toUSD(local))
      setPriceCheckOpen(false)
    }
  }
  function clearPriceCheck() {
    setPriceCheckPrice(null); setPriceCheckInput(''); setPriceCheckOpen(false)
  }

  const handleAnalyse = useCallback(() => {
    const parsed = parseFloat(priceInput.replace(/[^0-9.]/g, ''))
    if (!isNaN(parsed) && parsed > 0) setUserPrice(parsed)
  }, [priceInput])

  const exportPDF = useCallback(() => {
    if (!card && !liveData) return
    const dateStr = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

    // Derive display fields from whichever data path is active
    let pdfName: string, pdfSet: string, pdfGrade: string, pdfTags: string[], pdfImage: string
    if (card) {
      pdfName  = card.name
      pdfSet   = `${card.set} · #${card.cardNumber}`
      pdfGrade = selectedGrade === 'Raw' ? 'Raw / Ungraded' : selectedGrade
      pdfTags  = card.tags
      pdfImage = card.imageUrl
    } else {
      // Live-data path — format the resolved tier properly
      const rt = liveData!.resolved_tier ?? urlGrade ?? 'Raw'
      pdfGrade = rt.includes('_')
        ? rt.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
        : rt
      pdfName  = liveData!.card_name ?? urlName ?? 'Unknown'
      pdfSet   = [liveData!.set_name ?? urlSet, urlNumber ? `#${urlNumber}` : null].filter(Boolean).join(' · ')
      pdfTags  = []
      pdfImage = liveData!.image_url ?? ''
    }

    const existing = document.getElementById('ci-print-header')
    if (existing) existing.remove()

    const header = document.createElement('div')
    header.id = 'ci-print-header'
    header.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <div>
          <div style="font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#8888a0;margin-bottom:6px;">CardIndex — Card Market Intelligence</div>
          <div style="font-size:28px;font-weight:800;color:#eaeaf2;letter-spacing:-.5px;line-height:1;margin-bottom:6px;">${pdfName}</div>
          <div style="font-size:12px;color:#8888a0;margin-bottom:10px;">${pdfSet}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${pdfTags.map(t => `<span style="background:rgba(232,197,71,.1);border:1px solid rgba(232,197,71,.25);border-radius:5px;padding:3px 10px;font-size:11px;font-weight:600;color:#e8c547;">${t}</span>`).join('')}
            <span style="background:#0f0f1c;border:1px solid #242438;border-radius:5px;padding:3px 10px;font-size:11px;color:#8888a0;">${pdfGrade}</span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          ${pdfImage ? `<img src="${pdfImage}" style="width:72px;border-radius:6px;margin-bottom:8px;display:block;margin-left:auto;" />` : ''}
          <div style="font-size:10px;color:#8888a0;">${dateStr}</div>
          <div style="font-size:10px;color:#5e5e76;margin-top:2px;">card-index.app</div>
        </div>
      </div>`

    const main = document.querySelector('.ci-main')
    if (main) main.insertBefore(header, main.firstChild)

    setTimeout(() => {
      window.print()
      setTimeout(() => { document.getElementById('ci-print-header')?.remove() }, 500)
    }, 150)
  }, [card, liveData, selectedGrade, urlGrade, urlName, urlSet, urlNumber])

  // Shared panel style constants (used in both card and !card render paths)
  const CPL = {
    C: { borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 10 },
    P: { padding: '18px 20px' },
    L: { fontSize: 10, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 12, display: 'block' } as React.CSSProperties,
  }

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
          <div className="ci-page-outer" style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px' }}>

            {/* Card header */}
            <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden', marginTop: 24, marginBottom: 10 }}>
              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
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
                    <div className="ci-card-actions" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                      <button
                        onClick={watchlistAdded ? removeFromWatchlist : addToWatchlist}
                        disabled={watchlistLoading}
                        style={{ padding: '8px 14px', borderRadius: 10, background: watchlistAdded ? 'rgba(61,232,138,0.1)' : 'var(--surface2)', border: `1.5px solid ${watchlistAdded ? 'rgba(61,232,138,0.4)' : 'var(--border2)'}`, fontSize: 11, fontWeight: 600, color: watchlistAdded ? 'var(--green)' : 'var(--ink2)', cursor: watchlistLoading ? 'default' : 'pointer', width: '100%' }}
                      >
                        {watchlistLoading ? '…' : watchlistAdded ? '★ Watching · Remove' : '☆ Watch'}
                      </button>
                      <button
                        onClick={() => { setPfShowForm(f => !f); setPfError(null) }}
                        style={{ padding: '8px 14px', borderRadius: 10, background: pfSuccess ? 'rgba(61,232,138,0.1)' : 'var(--surface2)', border: `1.5px solid ${pfSuccess ? 'rgba(61,232,138,0.4)' : 'var(--border2)'}`, fontSize: 11, fontWeight: 600, color: pfSuccess ? 'var(--green)' : 'var(--ink2)', cursor: 'pointer', width: '100%' }}
                      >
                        {pfSuccess ? '✓ Added to Portfolio' : '＋ Portfolio'}
                      </button>
                      {pfShowForm && (
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, width: 200 }}>
                          <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 8, fontWeight: 600, letterSpacing: 0.5 }}>ADD TO PORTFOLIO</div>
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 3 }}>Purchase price ({currency})</div>
                            <input
                              type="number"
                              value={pfPrice}
                              onChange={e => setPfPrice(e.target.value)}
                              placeholder="0.00"
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border2)', fontSize: 12, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 3 }}>Quantity</div>
                            <input
                              type="number"
                              value={pfQty}
                              onChange={e => setPfQty(e.target.value)}
                              min={1}
                              placeholder="1"
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border2)', fontSize: 12, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                          {pfError && <div style={{ fontSize: 10, color: '#ff6b6b', marginBottom: 6 }}>{pfError}</div>}
                          <button
                            onClick={submitPortfolio}
                            disabled={pfLoading}
                            style={{ width: '100%', padding: '7px 0', borderRadius: 7, background: 'var(--gold)', border: 'none', fontSize: 12, fontWeight: 700, color: '#0f0f1c', cursor: pfLoading ? 'default' : 'pointer' }}
                          >
                            {pfLoading ? '…' : 'Add'}
                          </button>
                        </div>
                      )}
                      {/* Compare link */}
                      <Link
                        href={`/compare?c=${encodeURIComponent(`${id}:${encodeURIComponent(urlGrade ?? 'Raw')}:${encodeURIComponent(urlName ?? '')}`)}`}
                        style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--surface2)', border: '1.5px solid var(--border2)', fontSize: 11, fontWeight: 600, color: 'var(--ink2)', cursor: 'pointer', width: '100%', textDecoration: 'none', display: 'block', textAlign: 'center', boxSizing: 'border-box' }}
                        onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                        onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--ink2)' }}
                      >
                        ⚖ Compare
                      </Link>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                  <Link href={urlSetSlug ? `/search?return_to_set=${encodeURIComponent(urlSetSlug)}` : '/search'} style={{ fontSize: 12, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>← Change card</Link>
                  {liveData && (userTier === 'standard' || userTier === 'pro') ? (
                    <button
                      className="ci-no-print"
                      onClick={exportPDF}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', border: '1.5px solid var(--border2)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 500, color: 'var(--ink3)', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--ink3)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1" />
                        <rect x="4" y="9" width="8" height="6" rx="1" />
                        <path d="M8 1v8M5 6l3 3 3-3" />
                      </svg>
                      Export PDF
                    </button>
                  ) : isLoggedIn && liveData ? (
                    <Link href="/pricing" className="ci-no-print" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', border: '1.5px solid var(--border2)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 500, color: 'var(--ink3)', textDecoration: 'none' }}>
                      🔒 PDF
                    </Link>
                  ) : null}
                </div>
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
                        {/* Both: % change — Standard+ only */}
                        {['standard','pro'].includes(userTier) ? (
                          <span className="font-num" style={{ fontSize: 13, color: liveData.price_change_pct >= 0 ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                            {liveData.price_change_pct >= 0 ? '+' : ''}{liveData.price_change_pct.toFixed(1)}% (30d)
                          </span>
                        ) : (
                          <Link href="/pricing" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', padding: '2px 8px', borderRadius: 6, background: 'var(--gold2)', border: '1px solid rgba(232,197,71,0.25)' }}>🔒 Standard</Link>
                        )}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        {['standard','pro'].includes(userTier) ? (
                          <TrendBadge trend={liveData.trend} confidence={liveData.confidence} />
                        ) : (
                          <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink3)', textDecoration: 'none', padding: '3px 10px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border2)' }}>🔒 Trend — Standard+</Link>
                        )}
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
                  {(() => {
                    const _a7  = liveData.avg7d  && liveData.avg7d  > 0 ? liveData.avg7d  : null
                    const _a30 = liveData.avg30d && liveData.avg30d > 0 ? liveData.avg30d : null
                    const contaminated = (() => {
                      if (!_a7 || !_a30 || !liveData.price) return false
                      const div   = Math.abs(_a7 - _a30) / _a30
                      const ratio = Math.max(_a7 / liveData.price, liveData.price / _a7)
                      return div < 0.03 && ratio > 3
                    })()
                    const c7  = contaminated ? null : _a7
                    const c30 = contaminated ? null : _a30
                    if (c7 == null && c30 == null) return null
                    return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      {[
                        { label: '7D AVG', value: c7 },
                        { label: '30D AVG', value: c30 },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{label}</div>
                          <div className="font-num" style={{ fontSize: 15, fontWeight: 700, color: value != null ? 'var(--ink)' : 'var(--ink3)' }}>
                            {value != null ? fmtCurrency(value) : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )})()}

                  {/* ── Price Check trigger ─────────────────────────────── */}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    {priceCheckOpen ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink3)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>
                            {currencySymbol}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={priceCheckInput}
                            onChange={e => setPriceCheckInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && commitPriceCheck()}
                            placeholder={`Price in ${currency}…`}
                            autoFocus
                            style={{
                              width: '100%', padding: `9px 10px 9px ${currencySymbol.length > 1 ? '30px' : '22px'}`,
                              borderRadius: 8, background: 'var(--surface2)',
                              border: '1.5px solid var(--border2)', color: 'var(--ink)',
                              fontSize: 14, outline: 'none', boxSizing: 'border-box',
                              WebkitAppearance: 'none', appearance: 'none',
                            }}
                            onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                          />
                        </div>
                        <button onClick={commitPriceCheck} style={{ padding: '9px 16px', borderRadius: 8, background: 'var(--gold)', color: '#080810', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                          Check
                        </button>
                        <button onClick={clearPriceCheck} style={{ padding: '9px 10px', borderRadius: 8, background: 'none', border: '1px solid var(--border2)', color: 'var(--ink3)', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setPriceCheckOpen(true)
                          // Pre-fill with the local-currency equivalent of the stored USD value
                          if (priceCheckPrice) {
                            const localVal = convert(priceCheckPrice)
                            const decimals = CURRENCIES[currency]?.decimals ?? 2
                            setPriceCheckInput(localVal.toFixed(decimals))
                          }
                        }}
                        style={{ width: '100%', padding: '9px 0', borderRadius: 8, background: 'none', border: '1px solid var(--border2)', color: priceCheckPrice ? 'var(--gold)' : 'var(--ink2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'border-color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                      >
                        {priceCheckPrice ? `🔎 Price Check · ${fmtCurrency(priceCheckPrice)} — tap to update` : '🔎 Price Check'}
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Price Check result panel ──────────────────────────── */}
                {priceCheckPrice && priceCheckPrice > 0 && liveData.price > 0 && liveData.score_breakdown && (() => {
                  const pct      = ((priceCheckPrice - liveData.price) / liveData.price) * 100
                  const verdict  = getPriceVerdict(pct)
                  const pcData   = buildPriceCheckData(liveData, priceCheckPrice)
                  const pa       = computeAnalysis(pcData)
                  const ma       = computeAnalysis(liveData)
                  const scoreGain = pcData.score - liveData.score
                  const origValue = liveData.score_breakdown.value
                  const newValue  = pcData.score_breakdown!.value
                  return (
                    <div style={{ borderRadius: 14, background: 'var(--surface)', border: `1.5px solid ${verdict.border}`, padding: '20px', marginBottom: 10 }}>

                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)' }}>PRICE CHECK</span>
                        <button onClick={clearPriceCheck} style={{ fontSize: 11, color: 'var(--ink3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                          ✕ Clear
                        </button>
                      </div>

                      {/* Price comparison */}
                      <div className="ci-pc-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                        <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>YOU FOUND</div>
                          <div className="font-num" style={{ fontSize: 20, fontWeight: 800, color: pct <= 0 ? '#3de88a' : '#e8524a', letterSpacing: '-1px' }}>{fmtCurrency(priceCheckPrice)}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>MARKET</div>
                          <div className="font-num" style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px' }}>{fmtCurrency(liveData.price)}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: verdict.bg, border: `1px solid ${verdict.border}` }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: verdict.color, marginBottom: 6, opacity: 0.8 }}>VS MARKET</div>
                          <div className="font-num" style={{ fontSize: 20, fontWeight: 800, color: verdict.color, letterSpacing: '-1px' }}>
                            {pct <= 0 ? '' : '+'}{pct.toFixed(1)}%
                          </div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: verdict.color, marginTop: 4, letterSpacing: 1 }}>{verdict.label}</div>
                        </div>
                      </div>

                      {/* Signal / Score / Value row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                        {/* Adjusted signal */}
                        <div style={{ textAlign: 'center', padding: '14px 8px', borderRadius: 10, background: pa.sigBg, border: `1px solid ${pa.sigBorder}` }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: pa.sigColor, marginBottom: 8, opacity: 0.75 }}>AT YOUR PRICE</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: pa.sigColor, letterSpacing: 1.5 }}>{pa.signal}</div>
                          {pa.signal !== ma.signal && (
                            <div style={{ fontSize: 9, color: 'var(--ink3)', marginTop: 6 }}>
                              was <span style={{ color: ma.sigColor, fontWeight: 700 }}>{ma.signal}</span>
                            </div>
                          )}
                        </div>
                        {/* Adjusted score */}
                        <div style={{ textAlign: 'center', padding: '14px 8px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>SCORE</div>
                          <div className="font-num" style={{ fontSize: 22, fontWeight: 800, color: scoreColor(pcData.score), letterSpacing: '-1px' }}>{pcData.score}</div>
                          {scoreGain !== 0 && (
                            <div style={{ fontSize: 9, color: scoreGain > 0 ? '#3de88a' : '#e8524a', marginTop: 4, fontWeight: 700 }}>
                              {scoreGain > 0 ? '+' : ''}{scoreGain} vs market
                            </div>
                          )}
                        </div>
                        {/* Value score */}
                        <div style={{ textAlign: 'center', padding: '14px 8px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>VALUE</div>
                          <div className="font-num" style={{ fontSize: 22, fontWeight: 800, color: scoreColor(Math.round(newValue / 20 * 100)), letterSpacing: '-1px' }}>{newValue}/20</div>
                          {newValue !== origValue && (
                            <div style={{ fontSize: 9, color: 'var(--ink3)', marginTop: 4 }}>
                              was {origValue}/20
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reasoning */}
                      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.7, margin: 0 }}>{pa.reasoning}</p>
                      </div>
                    </div>
                  )
                })()}

                {/* Analysis panel */}
                {liveData.score_breakdown && (() => {
                  const a = computeAnalysis(liveData)
                  return (
                    <div className="ci-analysis-panel ci-section" style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px', marginBottom: 10 }}>
                      <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', display: 'block', marginBottom: 14 }}>ANALYSIS</span>

                      {/* 6 metric tiles — 3-col on desktop, 2-col on mobile */}
                      <div className="ci-analysis-grid">

                        {/* Price Momentum — split 7d / 30d */}
                        <div className="ci-tile" style={{ padding: '12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', position: 'relative' }}>
                          <TileInfo id="momentum" text="How the current price compares to its 7-day and 30-day moving averages. Positive means the price is trading above recent averages — a bullish signal." activeTip={activeTip} setActiveTip={setActiveTip} />
                          <div className="ci-tile-label" style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 10, paddingRight: 22 }}>PRICE MOMENTUM</div>
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
                        <div className="ci-tile" style={{ padding: '12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', position: 'relative' }}>
                          <TileInfo id="trend" text="Direction and rate of price change over the available history. Shows whether the card is appreciating, declining, or holding steady over time." activeTip={activeTip} setActiveTip={setActiveTip} />
                          <div className="ci-tile-label" style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8, paddingRight: 22 }}>PRICE TREND</div>
                          {(() => {
                            // Build sparkline data: prefer real history, fall back to synthetic 3-point from avg30d→avg7d→price
                            // Only use avg30d/avg7d for synthetic if they pass the same sanity check as momentum
                            const histPrices = liveData.price_history?.length >= 2 ? liveData.price_history.map(p => p.price) : null
                            const safeAvg30d = a.clean30d ?? null
                            const safeAvg7d  = a.clean7d  ?? null
                            const synthetic: number[] | null = (!histPrices && safeAvg30d && safeAvg7d && liveData.price)
                              ? [safeAvg30d, safeAvg7d, liveData.price]
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
                                  {['standard','pro'].includes(userTier) ? (
                                    <TrendBadge trend={dir} confidence={null} />
                                  ) : (
                                    <Link href="/pricing" style={{ fontSize: 10, color: 'var(--ink3)', textDecoration: 'none' }}>🔒 Standard+</Link>
                                  )}
                                  {pct != null && (
                                    ['standard','pro'].includes(userTier) ? (
                                      <span className="font-num" style={{ fontSize: 12, fontWeight: 700, color: pctColor }}>
                                        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 11, color: 'var(--ink3)', filter: 'blur(4px)', userSelect: 'none' }}>+00.0%</span>
                                    )
                                  )}
                                </div>
                              </>
                            )
                          })()}
                        </div>

                        {/* Liquidity — graduated bar */}
                        <div className="ci-tile" style={{ padding: '12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                          <TileInfo id="liquidity" text="How actively this card trades on the market. Higher liquidity means it's easier to buy or sell at a fair price. Based on the number of eBay sales in the last 30 days." activeTip={activeTip} setActiveTip={setActiveTip} />
                          <div className="ci-tile-label" style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8, paddingRight: 22 }}>LIQUIDITY</div>
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
                        <div className="ci-tile" style={{ padding: '12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                          <TileInfo id="position" text="Where the current market price sits within its 30-day trading range. Near the high end suggests strong buying pressure; near the low end may signal weakness or a buying opportunity." activeTip={activeTip} setActiveTip={setActiveTip} />
                          <div className="ci-tile-label" style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6, paddingRight: 22 }}>PRICE POSITION</div>
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
                        <div className="ci-tile" style={{ padding: '12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', textAlign: 'center', position: 'relative' }}>
                          <TileInfo id="consistency" text={a.consPct === 0 ? "Score is 0 because the card's price is extremely volatile — the gap between its high and low sale prices is as wide as the average price itself. This makes future pricing unpredictable." : "How stable the price has been over time. A high score means low volatility — the card holds its value reliably. A low score means the price swings around a lot."} activeTip={activeTip} setActiveTip={setActiveTip} />
                          <div className="ci-tile-label" style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 10, paddingRight: 22 }}>CONSISTENCY</div>
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
                        <div className="ci-tile" style={{ padding: '12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', textAlign: 'center', position: 'relative' }}>
                          <TileInfo id="value" text={a.valuePct === 0 ? `Score is 0 because the card is trading significantly above its 30-day average — at least 20% higher. You'd be buying at a notable premium to recent market value.${a.consPct >= 80 ? " Note: the price may look stable right now, but it's elevated compared to where it was 30 days ago." : ""}` : "Measures whether the current price represents good value relative to the card's trading history. High means undervalued; low means priced at a premium."} activeTip={activeTip} setActiveTip={setActiveTip} />
                          <div className="ci-tile-label" style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 10, paddingRight: 22 }}>VALUE SCORE</div>
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
                {liveData.score_breakdown && (() => {
                  const a = computeAnalysis(liveData)
                  return (
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

                    {/* Zero-score explanation banners */}
                    {(() => {
                      const sb2 = liveData.score_breakdown
                      const sales2 = liveData.sales_count_30d ?? 0
                      const trendPct2 = liveData.price_change_pct ?? 0
                      type ZeroReason = { label: string; text: string }
                      const reasons: ZeroReason[] = []

                      if (sb2.trend === 0) {
                        const msg = sales2 === 0
                          ? 'No recent sales data to establish a price direction.'
                          : trendPct2 <= -15
                            ? `Price has fallen ${Math.abs(trendPct2).toFixed(0)}% recently with no recovery — no positive momentum to score.`
                            : 'No positive price movement detected. This card is in a declining or stagnant trend with no upward momentum.'
                        reasons.push({ label: 'Trend', text: msg })
                      }

                      if (sb2.liquidity === 0) {
                        const msg = sales2 === 0
                          ? 'No sales recorded in the last 30 days. Without an active market, buying or selling this card at a fair price may be very difficult.'
                          : `Only ${sales2} sale${sales2 === 1 ? '' : 's'} in the last 30 days — too thin to score for liquidity.`
                        reasons.push({ label: 'Liquidity', text: msg })
                      }

                      if (sb2.consistency === 0) {
                        reasons.push({ label: 'Consistency', text: 'Extreme price volatility. The gap between high and low sale prices is as wide as the average price itself, making future pricing highly unpredictable.' })
                      }

                      if (sb2.value === 0) {
                        reasons.push({ label: 'Value', text: 'Trading at a significant premium. This card is priced at least 20% above its 30-day average — buying now means paying well above recent market value.' })
                      }

                      if (reasons.length === 0) return null
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 14 }}>
                          {reasons.map(r => (
                            <div key={r.label} style={{ borderRadius: 9, background: 'rgba(232,82,74,0.06)', border: '1px solid rgba(232,82,74,0.18)', padding: '10px 12px', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                              <span style={{ fontSize: 12, flexShrink: 0, lineHeight: 1.5, opacity: 0.85 }}>⚠</span>
                              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: 'var(--ink3)' }}>
                                <span style={{ fontWeight: 700, color: '#e8524a', marginRight: 4 }}>{r.label} scored 0</span>
                                {r.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    <p style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', lineHeight: 1.65 }}>{a.reasoning}</p>
                  </div>
                  )
                })()}

                {/* ── Show Full Analysis toggle (Standard+) ── */}
                {['standard', 'pro'].includes(userTier) ? (
                  <div style={{ marginBottom: 10 }}>
                    <button
                      onClick={() => setShowAnalysis(!showAnalysis)}
                      style={{ width: '100%', padding: '14px 20px', borderRadius: 14, background: 'var(--surface)', border: '1px solid rgba(232,197,71,0.25)', color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'border-color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(232,197,71,0.25)')}
                    >
                      {showAnalysis ? '↑ Hide Advanced Analytics' : '↓ Show Advanced Analytics'}
                    </button>
                  </div>
                ) : isLoggedIn ? (
                  <div style={{ marginBottom: 10 }}>
                    <Link href="/pricing" style={{ textDecoration: 'none', width: '100%', padding: '14px 20px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      🔒 Advanced Analytics — Standard+ feature · Upgrade to unlock
                    </Link>
                  </div>
                ) : null}

                {/* ── Advanced Analytics (Standard+) ── */}
                {showAnalysis && ['standard', 'pro'].includes(userTier) && (() => {
                  const a = computeAnalysis(liveData)
                  const { C: aC, P: aP, L: aL } = CPL
                  const liveRangeLowAdv  = liveData.price_range_low  ?? liveData.price
                  const liveRangeHighAdv = liveData.price_range_high ?? liveData.price
                  const liveSalesAdv     = liveData.sales_count_30d  ?? 0
                  const liveTrendAdv     = liveData.price_change_pct ?? 0
                  const chartColorAdv    = liveTrendAdv >= 0 ? '#3de88a' : '#e8524a'
                  const windowPointsAdv  = analysisWindow === '1M' ? 2 : analysisWindow === '3M' ? 3 : 6
                  const liveHistory      = liveData.price_history ?? []
                  const chartDataAdv     = liveHistory.slice(-windowPointsAdv)
                  return (
                    <>
                      {/* ─ ADVANCED ANALYTICS divider ─ */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 10px', padding: '0 2px' }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', whiteSpace: 'nowrap' }}>ADVANCED ANALYTICS</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      </div>

                      {/* 1 — Moving Average Signal */}
                      {(a.clean7d || a.clean30d) && (() => {
                        const a1 = liveData.avg1d; const a7 = a.clean7d; const a30 = a.clean30d; const cur = liveData.price
                        const signal = a7 && a30 ? (a7 > a30 * 1.02 ? 'BULLISH' : a7 < a30 * 0.98 ? 'BEARISH' : 'NEUTRAL') : 'NEUTRAL'
                        const sigColor = signal === 'BULLISH' ? 'var(--green)' : signal === 'BEARISH' ? '#ff6b6b' : 'var(--gold)'
                        const sigBg = signal === 'BULLISH' ? 'rgba(61,232,138,0.08)' : signal === 'BEARISH' ? 'rgba(255,107,107,0.08)' : 'rgba(232,197,71,0.08)'
                        const sigBorder = signal === 'BULLISH' ? 'rgba(61,232,138,0.2)' : signal === 'BEARISH' ? 'rgba(255,107,107,0.2)' : 'rgba(232,197,71,0.2)'
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>MOVING AVERAGE SIGNAL</span>
                                  <TileInfo id="adv-1" text="Compares the 7-day and 30-day price averages. When the 7D avg rises above the 30D avg the short-term trend is bullish; when it falls below, bearish. A strong signal when both averages are diverging." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: sigBg, border: `1px solid ${sigBorder}`, color: sigColor, letterSpacing: 0.5 }}>
                                  {signal === 'BULLISH' ? '▲' : signal === 'BEARISH' ? '▼' : '●'} {signal}
                                </span>
                              </div>
                              <div className="ci-adv-4col">
                                {([{ label: 'CURRENT', value: cur, highlight: true }, { label: '1D AVG', value: a1 }, { label: '7D AVG', value: a7 }, { label: '30D AVG', value: a30 }] as { label: string; value: number | null | undefined; highlight?: boolean }[]).map((m, i) => (
                                  <div key={i} style={{ borderRadius: 10, padding: '12px 14px', background: m.highlight ? 'rgba(232,197,71,0.06)' : 'var(--bg)', border: `1px solid ${m.highlight ? 'rgba(232,197,71,0.2)' : 'var(--border)'}` }}>
                                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{m.label}</div>
                                    <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: m.highlight ? 'var(--gold)' : 'var(--ink)' }}>{m.value != null ? fmtCurrency(m.value) : '—'}</div>
                                  </div>
                                ))}
                              </div>
                              {a7 && a30 && (
                                <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 12, lineHeight: 1.6 }}>
                                  {signal === 'BULLISH' ? `7-day avg (${fmtCurrency(a7)}) is tracking above the 30-day avg (${fmtCurrency(a30)}) — short-term upward momentum.` : signal === 'BEARISH' ? `7-day avg (${fmtCurrency(a7)}) is tracking below the 30-day avg (${fmtCurrency(a30)}) — short-term downward pressure.` : `7-day and 30-day averages are closely aligned — no clear directional signal.`}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* 2 — Volatility Analysis */}
                      {liveData.price_history && liveData.price_history.length >= 3 && (() => {
                        const prices = liveData.price_history.map((h: { price: number }) => h.price)
                        const mean = prices.reduce((a: number, b: number) => a + b, 0) / prices.length
                        const variance = prices.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / prices.length
                        const stdDev = Math.sqrt(variance); const volPct = mean > 0 ? (stdDev / mean) * 100 : 0
                        const volLabel = volPct < 10 ? 'Low' : volPct < 25 ? 'Moderate' : volPct < 50 ? 'High' : 'Extreme'
                        const volColor = volPct < 10 ? 'var(--green)' : volPct < 25 ? 'var(--gold)' : '#ff6b6b'
                        const minP = Math.min(...prices); const maxP = Math.max(...prices)
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>VOLATILITY ANALYSIS</span>
                                  <TileInfo id="adv-2" text="Measures how much the price fluctuates using standard deviation. Low volatility means stable, predictable pricing — easier to buy/sell at a fair price. High volatility means bigger risk and potential reward." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: volPct < 10 ? 'rgba(61,232,138,0.08)' : volPct < 25 ? 'rgba(232,197,71,0.08)' : 'rgba(255,107,107,0.08)', border: `1px solid ${volPct < 10 ? 'rgba(61,232,138,0.2)' : volPct < 25 ? 'rgba(232,197,71,0.2)' : 'rgba(255,107,107,0.2)'}`, color: volColor }}>{volLabel} Volatility</span>
                              </div>
                              <div style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink3)', marginBottom: 5 }}><span>LOW</span><span>MODERATE</span><span>HIGH</span><span>EXTREME</span></div>
                                <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'linear-gradient(to right, #3de88a, #e8c547, #ff6b6b)' }}>
                                  <div style={{ position: 'absolute', left: `${Math.min(volPct / 60 * 100, 96)}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 13, height: 13, borderRadius: '50%', background: 'var(--surface)', border: `2px solid ${volColor}`, boxShadow: `0 0 6px ${volColor}80` }} />
                                </div>
                              </div>
                              <div className="ci-adv-4col">
                                {[{ label: 'STD DEV', value: fmtCurrency(stdDev) }, { label: 'VOLATILITY', value: `${volPct.toFixed(1)}%` }, { label: 'RANGE', value: fmtCurrency(maxP - minP) }, { label: 'MEAN PRICE', value: fmtCurrency(mean) }].map((m, i) => (
                                  <div key={i} style={{ borderRadius: 8, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 4 }}>{m.label}</div>
                                    <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{m.value}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 3 — Score Radar */}
                      {(() => {
                        const sb = liveData.score_breakdown
                        const radarData = sb ? [
                          { axis: 'Trend',       value: Math.round((sb.trend       ?? 0) / 30 * 100) },
                          { axis: 'Liquidity',   value: Math.round((sb.liquidity   ?? 0) / 25 * 100) },
                          { axis: 'Consistency', value: Math.round((sb.consistency ?? 0) / 25 * 100) },
                          { axis: 'Value',       value: Math.round((sb.value       ?? 0) / 20 * 100) },
                        ] : null
                        if (!radarData) return null
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                <span style={{ ...aL, marginBottom: 0 }}>SCORE BREAKDOWN — RADAR</span>
                                <TileInfo id="adv-3" text="Visual breakdown of all four CardIndex score components — Trend, Liquidity, Consistency, and Value — each normalized to 100. The larger the radar shape, the stronger the overall investment profile." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                                <div style={{ width: 200, height: 180, flexShrink: 0 }}>
                                  <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarData}>
                                      <PolarGrid stroke="rgba(255,255,255,0.07)" />
                                      <PolarAngleAxis dataKey="axis" tick={{ fill: '#55556a', fontSize: 10, fontFamily: 'Helvetica' }} />
                                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                                      <Radar dataKey="value" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.12} dot={{ fill: 'var(--gold)', r: 3 }} />
                                    </RadarChart>
                                  </ResponsiveContainer>
                                </div>
                                <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {radarData.map((d, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <span style={{ fontSize: 9, letterSpacing: 1, color: 'var(--ink3)', width: 76, flexShrink: 0 }}>{d.axis.toUpperCase()}</span>
                                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${d.value}%`, background: scoreColor(d.value), borderRadius: 2 }} />
                                      </div>
                                      <span className="font-num" style={{ fontSize: 11, fontWeight: 700, color: scoreColor(d.value), width: 26, textAlign: 'right' }}>{d.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 4 — Sales Volume Trend */}
                      {liveData.price_history && liveData.price_history.some((h: { volume?: number }) => (h.volume ?? 0) > 0) && (() => {
                        const volData = liveData.price_history.filter((h: { volume?: number }) => h.volume != null).map((h: { month: string; price: number; volume?: number }) => ({ month: h.month, volume: h.volume ?? 0 }))
                        const maxVol = Math.max(...volData.map((d: { volume: number }) => d.volume), 1)
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>SALES VOLUME TREND</span>
                                  <TileInfo id="adv-4" text="Number of completed eBay sales per period. Rising volume alongside rising price confirms genuine demand. Falling volume on a rising price can signal a weak, unsustained move." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--ink3)' }}>peak {maxVol} sales/mo</span>
                              </div>
                              <ResponsiveContainer width="100%" height={120}>
                                <ComposedChart data={volData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                                  <XAxis dataKey="month" tick={{ fill: '#55556a', fontSize: 9, fontFamily: 'Helvetica' }} axisLine={false} tickLine={false} />
                                  <YAxis hide domain={[0, maxVol * 1.2]} />
                                  <Tooltip content={({ active, payload }) => active && payload?.length ? <div style={{ background: '#181828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px' }}><div className="font-num" style={{ fontSize: 12, color: 'rgba(74,158,255,0.9)' }}>{payload[0]?.value} sales</div></div> : null} />
                                  <Bar dataKey="volume" fill="rgba(74,158,255,0.55)" radius={[3, 3, 0, 0]} />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 5 — Grade Premium Comparison */}
                      {liveData.all_tier_prices && Object.keys(liveData.all_tier_prices).length > 1 && (() => {
                        const tiers = liveData.all_tier_prices as Record<string, { avg: number; source: string; saleCount?: number }>
                        const psa10 = tiers['PSA_10']?.avg ?? 0
                        const psa9  = tiers['PSA_9']?.avg  ?? 0
                        const nm    = tiers['NEAR_MINT']?.avg ?? 0
                        const lp    = tiers['LIGHTLY_PLAYED']?.avg ?? 0
                        const psa10Premium = (psa10 > 0 && nm > 0) ? psa10 / nm : null
                        const psa9of10     = (psa9  > 0 && psa10 > 0) ? psa9 / psa10 : null
                        const mintPremium  = (nm > 0 && lp > 0) ? nm / lp : null
                        // Only render if we have at least one PSA entry
                        const hasPSA = Object.keys(tiers).some(k => k.startsWith('PSA_'))
                        if (!hasPSA) return null
                        const fmtMult = (v: number | null) => v == null ? 'n/a' : `${v.toFixed(2)}x`
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                                <span style={{ ...aL, marginBottom: 0 }}>GRADE PREMIUM COMPARISON</span>
                                <TileInfo id="adv-5" text="How much more a PSA 10 commands over raw Near Mint, and how Near Mint compares to Lightly Played. Helps you decide whether grading is worth the cost." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                                {[
                                  { label: 'PSA 10 PREMIUM', value: fmtMult(psa10Premium) },
                                  { label: 'PSA 9 / 10',     value: fmtMult(psa9of10) },
                                  { label: 'MINT PREMIUM',   value: fmtMult(mintPremium) },
                                ].map(({ label, value }) => (
                                  <div key={label} style={{ borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 72 }}>
                                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)' }}>{label}</div>
                                    <div className="font-num" style={{ fontSize: 22, fontWeight: 700, color: value === 'n/a' ? 'var(--ink3)' : 'var(--ink)' }}>{value}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 6 — Sales Price Distribution */}
                      {liveData.ebay_listings && liveData.ebay_listings.length >= 3 && (() => {
                        const prices: number[] = liveData.ebay_listings.map((l: { price: number }) => l.price)
                        const minP = Math.min(...prices); const maxP = Math.max(...prices)
                        const range = maxP - minP; const bucketSize = range > 0 ? range / 6 : 1
                        const buckets = Array.from({ length: 6 }, (_, i) => {
                          const lo = minP + i * bucketSize; const hi = lo + bucketSize
                          return { label: `$${lo.toFixed(0)}`, count: prices.filter((p: number) => i === 5 ? p >= lo && p <= hi : p >= lo && p < hi).length }
                        }).filter(b => b.count > 0)
                        const sorted = [...prices].sort((a: number, b: number) => a - b)
                        const median = sorted[Math.floor(sorted.length / 2)]
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>SALES PRICE DISTRIBUTION</span>
                                  <TileInfo id="adv-6" text="Distribution of the individual eBay sale prices used to calculate this card's average. A tight cluster means consistent pricing; a wide spread means high variance and harder-to-predict resale value." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--ink3)' }}>median {fmtCurrency(median)} · {prices.length} sales</span>
                              </div>
                              <ResponsiveContainer width="100%" height={110}>
                                <ComposedChart data={buckets} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                                  <XAxis dataKey="label" tick={{ fill: '#55556a', fontSize: 9, fontFamily: 'Helvetica' }} axisLine={false} tickLine={false} />
                                  <YAxis hide />
                                  <Tooltip content={({ active, payload }) => active && payload?.length ? <div style={{ background: '#181828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px' }}><div className="font-num" style={{ fontSize: 12, color: '#f0f0f8' }}>{payload[0]?.value} sales</div></div> : null} />
                                  <Bar dataKey="count" fill="rgba(232,197,71,0.5)" radius={[3, 3, 0, 0]} />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 7 — Data Confidence & Quality */}
                      {(() => {
                        const conf = liveData.confidence
                        const confColor = conf === 'high' ? 'var(--green)' : conf === 'medium' ? 'var(--gold)' : conf === 'low' ? '#ff6b6b' : 'var(--ink3)'
                        const confBg = conf === 'high' ? 'rgba(61,232,138,0.08)' : conf === 'medium' ? 'rgba(232,197,71,0.08)' : 'rgba(255,107,107,0.08)'
                        const confBorder = conf === 'high' ? 'rgba(61,232,138,0.2)' : conf === 'medium' ? 'rgba(232,197,71,0.2)' : 'rgba(255,107,107,0.2)'
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                <span style={{ ...aL, marginBottom: 0 }}>DATA CONFIDENCE & QUALITY</span>
                                <TileInfo id="adv-7" text="How reliable the underlying price data is. Confidence is derived from the number of recent eBay sales — high means 10+ sales, medium means 5–9, low means fewer than 5 or a TCGPlayer fallback was used." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                              </div>
                              <div className="ci-adv-3col" style={{ gap: 10 }}>
                                <div style={{ borderRadius: 10, padding: '12px 14px', background: conf ? confBg : 'var(--bg)', border: `1px solid ${conf ? confBorder : 'var(--border)'}` }}>
                                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>CONFIDENCE</div>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: confColor, textTransform: 'capitalize' }}>{conf ?? 'Unknown'}</div>
                                </div>
                                <div style={{ borderRadius: 10, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>ALL-GRADE SALES</div>
                                  <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{liveData.total_sale_count ?? liveData.sales_count_30d ?? '—'}</div>
                                </div>
                                <div style={{ borderRadius: 10, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>LAST UPDATED</div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)' }}>{liveData.last_updated_pt ? new Date(liveData.last_updated_pt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : 'Today'}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Price Trend chart (mini) */}
                      {chartDataAdv.length >= 2 && (
                        <div style={{ ...aC }} className="ci-card-surface">
                          <div style={{ ...aP }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ ...aL, marginBottom: 0 }}>PRICE TREND — {analysisWindow}</span>
                              <div style={{ textAlign: 'right' }}>
                                <div className="font-num" style={{ fontSize: 18, fontWeight: 700, color: chartColorAdv }}>{liveTrendAdv >= 0 ? '+' : ''}{liveTrendAdv}%</div>
                              </div>
                            </div>
                            <ResponsiveContainer width="100%" height={110}>
                              <LineChart data={chartDataAdv} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
                                <XAxis dataKey="month" tick={{ fill: '#55556a', fontSize: 9, fontFamily: 'Helvetica' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<SparkTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
                                <Line type="monotone" dataKey="price" stroke={chartColorAdv} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: chartColorAdv, stroke: 'var(--surface)' }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* eBay Sold Listings */}
                      {liveData.ebay_listings && liveData.ebay_listings.length > 0 && (
                        <div style={{ ...aC }} className="ci-card-surface">
                          <div style={{ ...aP }}>
                            <span style={{ ...aL }}>EBAY SOLD LISTINGS USED</span>
                            {liveData.ebay_listings.map((listing: { title: string; price: number; date: string; url?: string; badge?: string }, i: number) => (
                              <a key={i} href={listing.url} target="_blank" rel="noopener noreferrer"
                                style={{ paddingTop: 14, paddingBottom: 14, borderBottom: i < liveData.ebay_listings.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, textDecoration: 'none' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 4 }}>{listing.title}</p>
                                  <p style={{ fontSize: 11, color: 'var(--ink3)' }}>{listing.date ? new Date(listing.date).toLocaleDateString() : ''}</p>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  {listing.badge && <div style={{ fontSize: 9, letterSpacing: 1.5, padding: '2px 7px', borderRadius: 4, background: listing.badge === 'HIGH' ? 'rgba(232,82,74,0.1)' : 'rgba(61,232,138,0.1)', color: listing.badge === 'HIGH' ? '#e8524a' : '#3de88a', border: `1px solid ${listing.badge === 'HIGH' ? 'rgba(232,82,74,0.2)' : 'rgba(61,232,138,0.2)'}`, marginBottom: 5, display: 'inline-block' }}>{listing.badge}</div>}
                                  <div className="font-num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(listing.price)}</div>
                                </div>
                              </a>
                            ))}
                            <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--ink3)' }}>
                              {liveSalesAdv} sales · Avg: {fmtCurrency(liveData.price)} · Range: {fmtCurrency(liveRangeLowAdv)}–{fmtCurrency(liveRangeHighAdv)}
                            </div>
                          </div>
                        </div>
                      )}
                      {/* 8 — Price Velocity */}
                      {liveData.avg7d != null && liveData.avg30d != null && liveData.avg30d > 0 && (() => {
                        const weeklyDelta = liveData.avg7d - liveData.avg30d
                        const weeklyPct   = (weeklyDelta / liveData.avg30d) * 100
                        const proj30d     = liveData.price + weeklyDelta * 4
                        const velLabel    = Math.abs(weeklyPct) < 1 ? 'STABLE' : weeklyPct > 0 ? 'ACCELERATING ▲' : 'DECELERATING ▼'
                        const velColor    = weeklyPct > 1 ? 'var(--green)' : weeklyPct < -1 ? '#ff6b6b' : 'var(--gold)'
                        const velBg       = weeklyPct > 1 ? 'rgba(61,232,138,0.08)' : weeklyPct < -1 ? 'rgba(255,107,107,0.08)' : 'rgba(232,197,71,0.08)'
                        const velBorder   = weeklyPct > 1 ? 'rgba(61,232,138,0.2)' : weeklyPct < -1 ? 'rgba(255,107,107,0.2)' : 'rgba(232,197,71,0.2)'
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>PRICE VELOCITY</span>
                                  <TileInfo id="adv-8" text="Compares the 7-day average to the 30-day baseline to detect whether price momentum is accelerating or decelerating. The 30-day projection extrapolates the current weekly drift forward." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: velBg, border: `1px solid ${velBorder}`, color: velColor }}>{velLabel}</span>
                              </div>
                              <div className="ci-adv-3col">
                                {[
                                  { label: 'CURRENT',      value: fmtCurrency(liveData.price), highlight: true },
                                  { label: 'PROJ. 30D',    value: fmtCurrency(proj30d),        color: proj30d > liveData.price ? 'var(--green)' : '#ff6b6b' },
                                  { label: 'WEEKLY DELTA', value: `${weeklyPct >= 0 ? '+' : ''}${weeklyPct.toFixed(1)}%`, color: velColor },
                                ].map((m, i) => (
                                  <div key={i} style={{ borderRadius: 10, padding: '12px 14px', background: m.highlight ? 'rgba(232,197,71,0.06)' : 'var(--bg)', border: `1px solid ${m.highlight ? 'rgba(232,197,71,0.2)' : 'var(--border)'}` }}>
                                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{m.label}</div>
                                    <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: m.color ?? 'var(--gold)' }}>{m.value}</div>
                                  </div>
                                ))}
                              </div>
                              <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 12, lineHeight: 1.6 }}>
                                {weeklyPct > 1
                                  ? `7-day avg is ${weeklyPct.toFixed(1)}% above the 30-day baseline — price is accelerating. Projected to reach ${fmtCurrency(proj30d)} in 30 days if momentum holds.`
                                  : weeklyPct < -1
                                  ? `7-day avg is ${Math.abs(weeklyPct).toFixed(1)}% below the 30-day baseline — price is decelerating. Projected to reach ${fmtCurrency(proj30d)} in 30 days if trend continues.`
                                  : `7-day and 30-day averages are closely aligned — price momentum is stable.`}
                              </p>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 9 — Buy/Sell Timing */}
                      {liveData.ebay_listings && liveData.ebay_listings.length >= 5 && (() => {
                        const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                        const counts = [0, 0, 0, 0, 0, 0, 0]
                        liveData.ebay_listings.forEach((l: { date?: string }) => {
                          if (l.date) counts[new Date(l.date).getDay()]++
                        })
                        const maxCount  = Math.max(...counts)
                        const bestDay   = counts.indexOf(maxCount)
                        const dayData   = DAYS.map((d, i) => ({ day: d, count: counts[i], best: i === bestDay }))
                        const totalSales = counts.reduce((a, b) => a + b, 0)
                        if (maxCount === 0) return null
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>BUY / SELL TIMING</span>
                                  <TileInfo id="adv-9" text="Breakdown of eBay sales by day of week, based on recent sold listings. The best day to list is when buyers are most active — timing your listing can improve final sale price." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--ink3)' }}>Best day to list: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{DAYS[bestDay]}</span></span>
                              </div>
                              <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 12, lineHeight: 1.5 }}>Sales activity by day of week — based on {totalSales} recent eBay sold listings.</p>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
                                {dayData.map((d, i) => {
                                  const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0
                                  return (
                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                      <div style={{ width: '100%', position: 'relative', height: 60, display: 'flex', alignItems: 'flex-end' }}>
                                        <div style={{ width: '100%', height: `${Math.max(pct, 4)}%`, borderRadius: '3px 3px 0 0', background: d.best ? 'var(--gold)' : 'rgba(255,255,255,0.12)', transition: 'height 0.3s', boxShadow: d.best ? '0 0 8px rgba(232,197,71,0.3)' : 'none' }} />
                                      </div>
                                      <span style={{ fontSize: 9, color: d.best ? 'var(--gold)' : 'var(--ink3)', fontWeight: d.best ? 700 : 400 }}>{d.day}</span>
                                      <span style={{ fontSize: 9, color: 'var(--ink3)' }}>{d.count}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 10 — Outlier Detection */}
                      {liveData.ebay_listings && liveData.ebay_listings.length >= 5 && (() => {
                        const prices  = liveData.ebay_listings.map((l: { price: number }) => l.price)
                        const mean    = prices.reduce((a: number, b: number) => a + b, 0) / prices.length
                        const stdDev  = Math.sqrt(prices.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / prices.length)
                        const tagged  = liveData.ebay_listings.map((l: { title: string; price: number; date?: string; url?: string }) => ({
                          ...l,
                          z: stdDev > 0 ? Math.abs(l.price - mean) / stdDev : 0,
                          outlier: stdDev > 0 && Math.abs(l.price - mean) > 2 * stdDev,
                        }))
                        const outlierCount = tagged.filter((l: { outlier: boolean }) => l.outlier).length
                        if (outlierCount === 0) return null
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>OUTLIER DETECTION</span>
                                  <TileInfo id="adv-10" text="Identifies sales that deviate more than 2 standard deviations from the average. HIGH outliers may reflect exceptional condition or error; LOW outliers may indicate damage or a motivated seller." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 99, background: 'rgba(232,82,74,0.08)', border: '1px solid rgba(232,82,74,0.2)', color: '#ff6b6b' }}>{outlierCount} outlier{outlierCount > 1 ? 's' : ''} detected</span>
                              </div>
                              <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 12, lineHeight: 1.5 }}>
                                Mean: {fmtCurrency(mean)} · ±2σ range: {fmtCurrency(Math.max(0, mean - 2 * stdDev))} – {fmtCurrency(mean + 2 * stdDev)}
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {tagged.sort((a: { price: number }, b: { price: number }) => b.price - a.price).map((l: { title: string; price: number; date?: string; url?: string; outlier: boolean; z: number }, i: number) => (
                                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < tagged.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 12, color: l.outlier ? 'var(--ink)' : 'var(--ink2)', fontWeight: l.outlier ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                                    </div>
                                    {l.outlier && (
                                      <span style={{ fontSize: 9, letterSpacing: 1, padding: '2px 7px', borderRadius: 4, background: l.price > mean ? 'rgba(232,82,74,0.1)' : 'rgba(74,158,255,0.1)', color: l.price > mean ? '#ff6b6b' : '#4a9eff', border: `1px solid ${l.price > mean ? 'rgba(232,82,74,0.25)' : 'rgba(74,158,255,0.25)'}`, flexShrink: 0 }}>
                                        {l.price > mean ? '▲ HIGH' : '▼ LOW'}
                                      </span>
                                    )}
                                    <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: l.outlier ? (l.price > mean ? '#ff6b6b' : '#4a9eff') : 'var(--ink)', flexShrink: 0 }}>{fmtCurrency(l.price)}</div>
                                  </a>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 11 — Grade Relative Value */}
                      {liveData.all_tier_prices && liveData.resolved_tier && (() => {
                        const tiers = liveData.all_tier_prices as Record<string, { avg: number; source: string; saleCount?: number }>
                        const fmtTL  = (k: string) => k.includes('_') ? k.split('_').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ') : k
                        const validEntries = Object.entries(tiers).filter(([k, v]) => k !== 'AGGREGATED' && v.avg > 0).sort(([, a], [, b]) => b.avg - a.avg)
                        if (validEntries.length < 2) return null
                        const topAvg     = validEntries[0][1].avg
                        const topLabel   = fmtTL(validEntries[0][0])
                        const currentAvg = liveData.price
                        const relPct     = topAvg > 0 ? (currentAvg / topAvg) * 100 : 100
                        const discountPct = 100 - relPct
                        // Typical discount ranges by tier
                        const typical: Record<string, [number, number]> = {
                          NEAR_MINT: [0, 5], LIGHTLY_PLAYED: [10, 25], MODERATELY_PLAYED: [25, 40],
                          HEAVILY_PLAYED: [35, 55], DAMAGED: [45, 65],
                        }
                        const range     = typical[liveData.resolved_tier]
                        const isUnder   = range && discountPct > range[1]
                        const isOver    = range && discountPct < range[0]
                        const valueLabel = !range ? 'Unknown' : isUnder ? 'UNDERVALUED' : isOver ? 'PREMIUM' : 'FAIR VALUE'
                        const valueColor = !range ? 'var(--ink3)' : isUnder ? 'var(--green)' : isOver ? '#ff6b6b' : 'var(--gold)'
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>GRADE RELATIVE VALUE</span>
                                  <TileInfo id="adv-11" text="Compares this grade's price to the best available grade to determine if it's trading at a typical, premium, or discounted level. UNDERVALUED means this grade is cheaper than expected relative to mint condition." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: isUnder ? 'rgba(61,232,138,0.08)' : isOver ? 'rgba(255,107,107,0.08)' : 'rgba(232,197,71,0.08)', border: `1px solid ${isUnder ? 'rgba(61,232,138,0.2)' : isOver ? 'rgba(255,107,107,0.2)' : 'rgba(232,197,71,0.2)'}`, color: valueColor }}>{valueLabel}</span>
                              </div>
                              <div style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink3)', marginBottom: 6 }}>
                                  <span>vs {topLabel} ({fmtCurrency(topAvg)})</span>
                                  <span className="font-num" style={{ color: 'var(--ink)', fontWeight: 700 }}>{relPct.toFixed(1)}% of top grade</span>
                                </div>
                                <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
                                  {range && (
                                    <div style={{ position: 'absolute', left: `${100 - range[1]}%`, right: `${range[0]}%`, top: 0, bottom: 0, background: 'rgba(232,197,71,0.15)', borderRadius: 3 }} />
                                  )}
                                  <div style={{ position: 'absolute', left: `${Math.max(0, Math.min(relPct, 100) - 1)}%`, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, borderRadius: '50%', background: 'var(--surface)', border: `2px solid ${valueColor}`, boxShadow: `0 0 6px ${valueColor}80` }} />
                                </div>
                                {range && (
                                  <div style={{ fontSize: 9, color: 'var(--ink3)', marginTop: 6 }}>
                                    Typical {fmtTL(liveData.resolved_tier)} discount: {range[0]}–{range[1]}% below {topLabel} · Current discount: {discountPct.toFixed(1)}%
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div style={{ borderRadius: 8, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 4 }}>THIS GRADE</div>
                                  <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>{fmtCurrency(currentAvg)}</div>
                                </div>
                                <div style={{ borderRadius: 8, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 4 }}>TOP GRADE ({topLabel.toUpperCase()})</div>
                                  <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(topAvg)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 12 — Price Momentum Phases */}
                      {liveData.price_history && liveData.price_history.length >= 6 && (() => {
                        type HistPoint = { month: string; price: number; volume?: number }
                        const hist = liveData.price_history as HistPoint[]
                        // 3-point moving average
                        const ma3 = hist.map((_: HistPoint, i: number) =>
                          i < 2 ? null : (hist[i-2].price + hist[i-1].price + hist[i].price) / 3
                        )
                        // Tag each point with momentum phase
                        const phased = hist.map((h: HistPoint, i: number) => {
                          const prev = i >= 3 ? ma3[i-1] : null
                          const curr = ma3[i]
                          let phase: 'up' | 'down' | 'neutral' = 'neutral'
                          if (prev != null && curr != null) {
                            if (curr > prev * 1.01) phase = 'up'
                            else if (curr < prev * 0.99) phase = 'down'
                          }
                          return { ...h, ma3: curr, phase }
                        })
                        // Build reference areas for consecutive same-phase spans
                        const areas: { x1: string; x2: string; phase: 'up' | 'down' | 'neutral' }[] = []
                        let spanStart = 0
                        for (let i = 1; i <= phased.length; i++) {
                          if (i === phased.length || phased[i].phase !== phased[spanStart].phase) {
                            if (phased[spanStart].phase !== 'neutral') {
                              areas.push({ x1: phased[spanStart].month, x2: phased[Math.min(i, phased.length - 1)].month, phase: phased[spanStart].phase })
                            }
                            spanStart = i
                          }
                        }
                        const upPhases   = phased.filter((p: { phase: string }) => p.phase === 'up').length
                        const downPhases = phased.filter((p: { phase: string }) => p.phase === 'down').length
                        const dominantPhase = upPhases > downPhases ? 'BULLISH' : upPhases < downPhases ? 'BEARISH' : 'MIXED'
                        const domColor  = dominantPhase === 'BULLISH' ? 'var(--green)' : dominantPhase === 'BEARISH' ? '#ff6b6b' : 'var(--gold)'
                        const domBg     = dominantPhase === 'BULLISH' ? 'rgba(61,232,138,0.08)' : dominantPhase === 'BEARISH' ? 'rgba(255,107,107,0.08)' : 'rgba(232,197,71,0.08)'
                        const domBorder = dominantPhase === 'BULLISH' ? 'rgba(61,232,138,0.2)' : dominantPhase === 'BEARISH' ? 'rgba(255,107,107,0.2)' : 'rgba(232,197,71,0.2)'
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>MOMENTUM PHASES</span>
                                  <TileInfo id="adv-12" text="The gold line is a 3-point moving average smoothed over price history. Green shaded zones show periods of accelerating price; red zones show deceleration. Dominant phase determines the BULLISH/BEARISH/MIXED badge." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: domBg, border: `1px solid ${domBorder}`, color: domColor }}>{dominantPhase}</span>
                              </div>
                              <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8, lineHeight: 1.5 }}>
                                Green zones = accelerating price · Red zones = decelerating · Based on 3-point moving average.
                              </p>
                              <ResponsiveContainer width="100%" height={130}>
                                <ComposedChart data={phased} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                                  {areas.map((a, i) => (
                                    <ReferenceArea key={i} x1={a.x1} x2={a.x2}
                                      fill={a.phase === 'up' ? 'rgba(61,232,138,0.08)' : 'rgba(255,107,107,0.08)'}
                                      stroke="none" />
                                  ))}
                                  <XAxis dataKey="month" tick={{ fill: '#55556a', fontSize: 9, fontFamily: 'Helvetica' }} axisLine={false} tickLine={false} />
                                  <YAxis hide />
                                  <Tooltip content={({ active, payload }) => {
                                    if (active && payload?.length) return (
                                      <div style={{ background: '#181828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px' }}>
                                        <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{payload[0]?.payload?.month}</div>
                                        <div className="font-num" style={{ fontSize: 12, color: 'var(--ink)' }}>{fmtCurrency(payload[0]?.value as number)}</div>
                                      </div>
                                    )
                                    return null
                                  }} />
                                  <Line type="monotone" dataKey="price" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} dot={false} />
                                  <Line type="monotone" dataKey="ma3" stroke="var(--gold)" strokeWidth={2} dot={false} strokeDasharray="none" connectNulls />
                                </ComposedChart>
                              </ResponsiveContainer>
                              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                                {[
                                  { label: 'BULLISH PHASES', value: upPhases, color: 'var(--green)' },
                                  { label: 'BEARISH PHASES', value: downPhases, color: '#ff6b6b' },
                                  { label: 'NEUTRAL', value: phased.length - upPhases - downPhases, color: 'var(--ink3)' },
                                ].map((m, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: 9, color: 'var(--ink3)' }}>{m.label}</span>
                                    <span className="font-num" style={{ fontSize: 10, fontWeight: 700, color: m.color }}>{m.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 13 — Price Position Gauge */}
                      {liveData.price_range_low != null && liveData.price_range_high != null && liveData.price_range_high > liveData.price_range_low && (() => {
                        const lo = liveData.price_range_low
                        const hi = liveData.price_range_high
                        const cur = liveData.price
                        const pct = Math.max(0, Math.min(((cur - lo) / (hi - lo)) * 100, 100))
                        const zone = pct <= 33 ? 'BOTTOM THIRD' : pct <= 66 ? 'MID RANGE' : 'TOP THIRD'
                        const zColor = pct <= 33 ? 'var(--green)' : pct <= 66 ? 'var(--gold)' : '#ff6b6b'
                        const zBg = pct <= 33 ? 'rgba(61,232,138,0.08)' : pct <= 66 ? 'rgba(232,197,71,0.08)' : 'rgba(255,107,107,0.08)'
                        const zBorder = pct <= 33 ? 'rgba(61,232,138,0.2)' : pct <= 66 ? 'rgba(232,197,71,0.2)' : 'rgba(255,107,107,0.2)'
                        const insight = pct <= 33
                          ? `Price is near the bottom of its recent range — potentially a good entry point.`
                          : pct <= 66
                          ? `Price is in the middle of its recent range — neither a clear bargain nor overpriced.`
                          : `Price is near the top of its recent range — consider waiting for a pullback before buying.`
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>PRICE POSITION GAUGE</span>
                                  <TileInfo id="adv-13" text="Shows where the current price sits within its recent trading range. Bottom third suggests a potential buying opportunity; top third suggests caution. Based on the high and low prices from the current data window." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: zBg, border: `1px solid ${zBorder}`, color: zColor }}>{zone}</span>
                              </div>
                              <div style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink3)', marginBottom: 6 }}>
                                  <span>LOW {fmtCurrency(lo)}</span>
                                  <span className="font-num" style={{ color: 'var(--gold)', fontWeight: 700 }}>{fmtCurrency(cur)}</span>
                                  <span>HIGH {fmtCurrency(hi)}</span>
                                </div>
                                <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(to right, rgba(61,232,138,0.3), rgba(232,197,71,0.3), rgba(255,107,107,0.3))' }}>
                                  <div style={{ position: 'absolute', left: `${Math.max(1, Math.min(pct, 97))}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 14, height: 14, borderRadius: '50%', background: 'var(--surface)', border: `2.5px solid ${zColor}`, boxShadow: `0 0 8px ${zColor}80` }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--ink3)', marginTop: 4 }}>
                                  <span>BUY ZONE</span><span>NEUTRAL</span><span>CAUTION</span>
                                </div>
                              </div>
                              <p style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.6 }}>{insight}</p>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 14 — VWAP Analysis */}
                      {liveData.price_history && liveData.price_history.some((h: { volume?: number }) => (h.volume ?? 0) > 0) && (() => {
                        type HP = { price: number; volume?: number }
                        const pts = (liveData.price_history as HP[]).filter(h => (h.volume ?? 0) > 0)
                        const totalVol = pts.reduce((a, h) => a + (h.volume ?? 0), 0)
                        if (totalVol === 0) return null
                        const vwap = pts.reduce((a, h) => a + h.price * (h.volume ?? 0), 0) / totalVol
                        const cur = liveData.price
                        const diffPct = vwap > 0 ? ((cur - vwap) / vwap) * 100 : 0
                        const above = diffPct > 0
                        const label = Math.abs(diffPct) < 2 ? 'AT VWAP' : above ? 'ABOVE VWAP' : 'BELOW VWAP'
                        const lColor = Math.abs(diffPct) < 2 ? 'var(--gold)' : above ? '#ff6b6b' : 'var(--green)'
                        const lBg = Math.abs(diffPct) < 2 ? 'rgba(232,197,71,0.08)' : above ? 'rgba(255,107,107,0.08)' : 'rgba(61,232,138,0.08)'
                        const lBorder = Math.abs(diffPct) < 2 ? 'rgba(232,197,71,0.2)' : above ? 'rgba(255,107,107,0.2)' : 'rgba(61,232,138,0.2)'
                        const insight = Math.abs(diffPct) < 2
                          ? `Price is near VWAP — trading at fair value relative to where most volume has occurred.`
                          : above
                          ? `Price is ${diffPct.toFixed(1)}% above VWAP — trading at a premium to where most volume occurred. Potential mean-reversion risk.`
                          : `Price is ${Math.abs(diffPct).toFixed(1)}% below VWAP — trading at a discount to where most volume occurred. Potential value opportunity.`
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>VWAP ANALYSIS</span>
                                  <TileInfo id="adv-14" text="Volume Weighted Average Price (VWAP) weights each price point by its sales volume, giving a more accurate picture of where most trades actually occurred. Trading below VWAP = discount; above = premium." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: lBg, border: `1px solid ${lBorder}`, color: lColor }}>{label}</span>
                              </div>
                              <div className="ci-adv-3col" style={{ marginBottom: 14 }}>
                                {[
                                  { label: 'CURRENT PRICE', value: fmtCurrency(cur), highlight: true },
                                  { label: 'VWAP', value: fmtCurrency(vwap), color: 'var(--ink)' },
                                  { label: 'DEVIATION', value: `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%`, color: lColor },
                                ].map((m, i) => (
                                  <div key={i} style={{ borderRadius: 10, padding: '12px 14px', background: m.highlight ? 'rgba(232,197,71,0.06)' : 'var(--bg)', border: `1px solid ${m.highlight ? 'rgba(232,197,71,0.2)' : 'var(--border)'}` }}>
                                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{m.label}</div>
                                    <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: m.highlight ? 'var(--gold)' : (m.color ?? 'var(--ink)') }}>{m.value}</div>
                                  </div>
                                ))}
                              </div>
                              <p style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.6 }}>{insight}</p>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 15 — Sale Velocity */}
                      {(liveData.sales_count_30d ?? 0) > 0 && (() => {
                        const count30 = liveData.sales_count_30d ?? 0
                        const dailyRate = count30 / 30
                        const weeklyRate = dailyRate * 7
                        const label = dailyRate >= 1 ? 'ACTIVE' : dailyRate >= 0.5 ? 'STEADY' : dailyRate >= 0.2 ? 'SLOW' : 'ILLIQUID'
                        const lColor = dailyRate >= 1 ? 'var(--green)' : dailyRate >= 0.5 ? 'var(--green)' : dailyRate >= 0.2 ? 'var(--gold)' : '#ff6b6b'
                        const lBg = dailyRate >= 0.5 ? 'rgba(61,232,138,0.08)' : dailyRate >= 0.2 ? 'rgba(232,197,71,0.08)' : 'rgba(255,107,107,0.08)'
                        const lBorder = dailyRate >= 0.5 ? 'rgba(61,232,138,0.2)' : dailyRate >= 0.2 ? 'rgba(232,197,71,0.2)' : 'rgba(255,107,107,0.2)'
                        const totalSales = liveData.total_sale_count
                        const daysSinceUpdate = liveData.last_updated_pt ? Math.round((Date.now() - new Date(liveData.last_updated_pt).getTime()) / (1000 * 60 * 60 * 24)) : null
                        const insight = dailyRate >= 1
                          ? `This card sells approximately ${weeklyRate.toFixed(1)} times per week — highly liquid. Easy to buy or sell quickly.`
                          : dailyRate >= 0.5
                          ? `This card sells approximately ${weeklyRate.toFixed(1)} times per week — healthy trading activity.`
                          : dailyRate >= 0.2
                          ? `This card averages about ${weeklyRate.toFixed(1)} sales per week — moderate liquidity. May take time to sell at asking price.`
                          : `This card sells less than once per week on average — illiquid. Expect longer time-to-sell and wider bid/ask spreads.`
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>SALE VELOCITY</span>
                                  <TileInfo id="adv-15" text="Sale velocity measures how frequently this card sells based on recent eBay data. Higher velocity means more liquid — easier to buy and sell at fair market price. Low velocity means it may sit unsold for weeks." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: lBg, border: `1px solid ${lBorder}`, color: lColor }}>{label}</span>
                              </div>
                              <div className="ci-adv-3col" style={{ marginBottom: 14 }}>
                                {[
                                  { label: 'SALES / 30D', value: count30.toLocaleString() },
                                  { label: 'EST. / WEEK', value: `~${weeklyRate.toFixed(1)}` },
                                  { label: 'EST. / DAY', value: dailyRate >= 0.1 ? `~${dailyRate.toFixed(2)}` : '<0.1' },
                                ].map((m, i) => (
                                  <div key={i} style={{ borderRadius: 10, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{m.label}</div>
                                    <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? lColor : 'var(--ink)' }}>{m.value}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--ink3)' }}>
                                {totalSales != null && <span>All-time sales: <span className="font-num" style={{ color: 'var(--ink)', fontWeight: 700 }}>{totalSales.toLocaleString()}</span></span>}
                                {daysSinceUpdate != null && daysSinceUpdate >= 0 && <span>Data age: <span style={{ color: daysSinceUpdate <= 1 ? 'var(--green)' : daysSinceUpdate <= 3 ? 'var(--gold)' : '#ff6b6b' }}>{daysSinceUpdate === 0 ? 'Today' : `${daysSinceUpdate}d ago`}</span></span>}
                              </div>
                              <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 10, lineHeight: 1.6 }}>{insight}</p>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 16 — Score Opportunity Analysis */}
                      {liveData.score_breakdown && (() => {
                        const sb = liveData.score_breakdown
                        const factors = [
                          { key: 'trend',       raw: sb.trend,       max: 30, label: 'Trend' },
                          { key: 'liquidity',   raw: sb.liquidity,   max: 25, label: 'Liquidity' },
                          { key: 'consistency', raw: sb.consistency, max: 25, label: 'Consistency' },
                          { key: 'value',       raw: sb.value,       max: 20, label: 'Value' },
                        ].map(f => ({ ...f, pct: Math.round((f.raw ?? 0) / f.max * 100) }))
                          .sort((a, b) => a.pct - b.pct)
                        const insights: Record<string, { weak: string; improve: string }> = {
                          trend:       { weak: 'Price momentum is weak or declining.',          improve: 'Watch for a trend reversal or price stabilisation before buying.' },
                          liquidity:   { weak: 'Low trading volume limits price discovery.',     improve: 'Consider patience — fewer buyers means wider spreads and longer time-to-sell.' },
                          consistency: { weak: 'High price volatility makes valuation difficult.', improve: 'Wait for price to stabilise over 2–4 weeks before acting.' },
                          value:       { weak: 'Current price is near or above market average.',  improve: 'Look for a dip below the 30-day average for a better entry.' },
                        }
                        const bottom2 = factors.slice(0, 2)
                        const top = factors[factors.length - 1]
                        const scoreColor2 = (p: number) => p >= 70 ? 'var(--green)' : p >= 40 ? 'var(--gold)' : '#ff6b6b'
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>SCORE OPPORTUNITY</span>
                                  <TileInfo id="adv-16" text="Identifies which score components are limiting your CardIndex score and explains what each weakness means for your investment decision. The top-rated factor shows where this card's strength lies." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span className="font-num" style={{ fontSize: 22, fontWeight: 800, color: scoreColor2(factors.reduce((a,f)=>a+f.pct,0)/4) }}>{sb.total ?? liveData.score}<span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 400 }}>/100</span></span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                                {factors.map((f, i) => (
                                  <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ fontSize: 9, letterSpacing: 1, color: 'var(--ink3)', width: 74, flexShrink: 0, textTransform: 'uppercase' }}>{f.label}</div>
                                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${f.pct}%`, background: scoreColor2(f.pct), borderRadius: 3, transition: 'width 0.6s' }} />
                                    </div>
                                    <div className="font-num" style={{ fontSize: 11, fontWeight: 700, color: scoreColor2(f.pct), width: 28, textAlign: 'right', flexShrink: 0 }}>{f.pct}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {bottom2.filter(f => f.pct < 70).map(f => (
                                  <div key={f.key} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,107,107,0.05)', border: '1px solid rgba(255,107,107,0.12)' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#ff6b6b', marginBottom: 3 }}>⚠ {f.label} ({f.pct}/100)</div>
                                    <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>{insights[f.key].weak} {insights[f.key].improve}</div>
                                  </div>
                                ))}
                                {top.pct >= 70 && (
                                  <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(61,232,138,0.05)', border: '1px solid rgba(61,232,138,0.12)' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', marginBottom: 3 }}>✓ Strength: {top.label} ({top.pct}/100)</div>
                                    <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>
                                      {top.key === 'trend' ? 'Strong price momentum — card is appreciating.' : top.key === 'liquidity' ? 'Active trading market — easy to buy or sell.' : top.key === 'consistency' ? 'Stable pricing — low risk of sudden value loss.' : 'Trading at a discount to market average — good value.'}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 17 — Data Source Breakdown */}
                      {(() => {
                        const src = liveData.data_source ?? 'ebay'
                        const warning = liveData.data_warning
                        const ebayCount = liveData.ebay_sale_count ?? liveData.sales_count_30d ?? 0
                        const daysSince = liveData.last_updated_pt ? Math.round((Date.now() - new Date(liveData.last_updated_pt).getTime()) / (1000 * 60 * 60 * 24)) : null
                        const warningMessages: Record<string, string> = {
                          limited_sales: 'Fewer than 10 recent eBay sales — price average may be less stable.',
                          rare_asset: 'High-value card with very few sales — treat price as indicative only.',
                          high_value_limited: 'High-value card with limited sales data — use additional sources to verify.',
                          low_volume_tcg_fallback: 'Insufficient eBay data — price sourced from TCGPlayer instead.',
                          low_volume_no_fallback: 'Very few sales and no TCGPlayer fallback — price has low confidence.',
                        }
                        const srcColor = src === 'ebay' ? '#3de88a' : 'var(--gold)'
                        const srcBg = src === 'ebay' ? 'rgba(61,232,138,0.08)' : 'rgba(232,197,71,0.08)'
                        const srcBorder = src === 'ebay' ? 'rgba(61,232,138,0.2)' : 'rgba(232,197,71,0.2)'
                        return (
                          <div style={{ ...aC }} className="ci-card-surface">
                            <div style={{ ...aP }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...aL, marginBottom: 0 }}>DATA SOURCE BREAKDOWN</span>
                                  <TileInfo id="adv-17" text="Explains where the price data comes from and how trustworthy it is. eBay sold listings are the primary source. TCGPlayer is used as a fallback when eBay data is too sparse. Always check the data age before making a decision." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: srcBg, border: `1px solid ${srcBorder}`, color: srcColor, textTransform: 'uppercase' }}>{src === 'ebay' ? 'eBay' : 'TCGPlayer'}</span>
                              </div>
                              <div className="ci-adv-3col" style={{ marginBottom: warning ? 14 : 0 }}>
                                {[
                                  { label: 'PRIMARY SOURCE', value: src === 'ebay' ? 'eBay Sales' : 'TCGPlayer', color: srcColor },
                                  { label: 'EBAY SALES (30D)', value: ebayCount > 0 ? ebayCount.toLocaleString() : 'N/A', color: ebayCount >= 10 ? 'var(--green)' : ebayCount >= 5 ? 'var(--gold)' : '#ff6b6b' },
                                  { label: 'DATA AGE', value: daysSince === null ? 'Unknown' : daysSince === 0 ? 'Today' : `${daysSince}d ago`, color: daysSince === null ? 'var(--ink3)' : daysSince <= 1 ? 'var(--green)' : daysSince <= 3 ? 'var(--gold)' : '#ff6b6b' },
                                ].map((m, i) => (
                                  <div key={i} style={{ borderRadius: 10, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{m.label}</div>
                                    <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.value}</div>
                                  </div>
                                ))}
                              </div>
                              {warning && warningMessages[warning] && (
                                <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(232,197,71,0.06)', border: '1px solid rgba(232,197,71,0.18)' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', marginBottom: 3 }}>DATA NOTE</div>
                                  <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>{warningMessages[warning]}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                    </>
                  )
                })()}

                {/* Price & Volume Chart — Standard+ only */}
                {liveData.price_history && liveData.price_history.length >= 2 && !['standard','pro'].includes(userTier) && (
                  <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: '32px 24px', textAlign: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 24, marginBottom: 12 }}>📈</div>
                    <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 99, background: 'var(--gold2)', border: '1px solid rgba(232,197,71,0.3)', fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: 1, marginBottom: 12 }}>STANDARD FEATURE</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Price history chart</div>
                    <p style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 20, lineHeight: 1.6 }}>Upgrade to Standard or Pro to view full price history charts and trend data.</p>
                    <Link href="/pricing" style={{ display: 'inline-block', padding: '9px 22px', borderRadius: 10, background: 'var(--gold)', color: '#080810', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>Upgrade to Standard →</Link>
                  </div>
                )}
                {liveData.price_history && liveData.price_history.length >= 2 && ['standard','pro'].includes(userTier) && (() => {
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
                  const isRawView = RAW_TIER_KEYS.has(resolvedTier)

                  // Key sets per grader
                  const PSA_KEYS = new Set(['PSA_10','PSA_9','PSA_8','PSA_7','PSA_6','PSA_5','PSA_4','PSA_3','PSA_2','PSA_1'])
                  const BGS_KEYS = new Set(['BGS_10','BGS_9_5','BGS_9','BGS_8_5'])
                  const CGC_KEYS = new Set(['CGC_10','CGC_9_5','CGC_9'])

                  // Which grader key-set to show in the graded section
                  const activeGraderKeys = isRawView
                    ? (ladderGrader === 'BGS' ? BGS_KEYS : ladderGrader === 'CGC' ? CGC_KEYS : PSA_KEYS)
                    : PSA_KEYS

                  const gradedEntries = Object.entries(tiers)
                    .filter(([k]) => activeGraderKeys.has(k))
                    .sort(([, a], [, b]) => b.avg - a.avg)

                  // Raw row — only Near Mint
                  const rawEntries = Object.entries(tiers)
                    .filter(([k]) => k === 'NEAR_MINT')
                    .sort(([, a], [, b]) => b.avg - a.avg)

                  // Check which graders actually have data (for showing/hiding tabs)
                  const hasGrader = (keys: Set<string>) => Object.keys(tiers).some(k => keys.has(k))
                  const availableGraders = [
                    hasGrader(PSA_KEYS) && 'PSA',
                    hasGrader(BGS_KEYS) && 'BGS',
                    hasGrader(CGC_KEYS) && 'CGC',
                  ].filter(Boolean) as ('PSA' | 'BGS' | 'CGC')[]

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

                  if (gradedEntries.length === 0 && rawEntries.length === 0) return null

                  return (
                    <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px', marginBottom: 10 }}>
                      {/* Header row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)' }}>PRICE LADDER</span>
                        {liveData.total_sale_count != null && liveData.total_sale_count > 0 && (
                          <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{liveData.total_sale_count.toLocaleString()} total sales</span>
                        )}
                      </div>

                      {/* Grader toggle — only shown when viewing a raw card and multiple graders have data */}
                      {isRawView && availableGraders.length > 1 && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                          {availableGraders.map(g => {
                            const active = ladderGrader === g
                            return (
                              <button
                                key={g}
                                onClick={() => setLadderGrader(g)}
                                style={{
                                  padding: '5px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                  cursor: 'pointer', border: `1px solid ${active ? 'var(--gold)' : 'var(--border2)'}`,
                                  background: active ? 'rgba(232,197,71,0.1)' : 'var(--surface2)',
                                  color: active ? 'var(--gold)' : 'var(--ink3)',
                                  transition: 'all 0.15s',
                                }}
                              >
                                {g}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* Graded section */}
                      {gradedEntries.length > 0 && (
                        <>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8, paddingLeft: 4 }}>
                            {isRawView ? `${ladderGrader} GRADED` : 'PSA GRADED'}
                          </div>
                          {gradedEntries.map(([k, v]) => <TierRow key={k} tierKey={k} data={v} />)}
                        </>
                      )}

                      {/* Raw section */}
                      {rawEntries.length > 0 && (
                        <>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginTop: gradedEntries.length > 0 ? 14 : 0, marginBottom: 8, paddingLeft: 4 }}>RAW</div>
                          {rawEntries.map(([k, v]) => <TierRow key={k} tierKey={k} data={v} />)}
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
                <div className="ci-card-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'flex-start', flexShrink: 0 }}>
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
                  {/* Portfolio button */}
                  {isLoggedIn && (
                    <div className="ci-no-print">
                      <button
                        onClick={() => { setPfShowForm(f => !f); setPfError(null) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: pfSuccess ? 'rgba(61,232,138,0.1)' : 'var(--surface2)', border: `1.5px solid ${pfSuccess ? 'rgba(61,232,138,0.4)' : 'var(--border2)'}`, borderRadius: 10, padding: '9px 14px', fontSize: 11, fontWeight: 600, color: pfSuccess ? 'var(--green)' : 'var(--ink2)', cursor: 'pointer', transition: 'all 0.2s', width: '100%' }}
                        onMouseEnter={e => { if (!pfSuccess) { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' } }}
                        onMouseLeave={e => { if (!pfSuccess) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--ink2)' } }}
                      >
                        {pfSuccess ? '✓ Added to Portfolio' : '＋ Portfolio'}
                      </button>
                      {pfShowForm && (
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginTop: 4 }}>
                          <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 8, fontWeight: 600, letterSpacing: 0.5 }}>ADD TO PORTFOLIO</div>
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 3 }}>Purchase price ({currency})</div>
                            <input
                              type="number"
                              value={pfPrice}
                              onChange={e => setPfPrice(e.target.value)}
                              placeholder="0.00"
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border2)', fontSize: 12, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 3 }}>Quantity</div>
                            <input
                              type="number"
                              value={pfQty}
                              onChange={e => setPfQty(e.target.value)}
                              min={1}
                              placeholder="1"
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border2)', fontSize: 12, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                          {pfError && <div style={{ fontSize: 10, color: '#ff6b6b', marginBottom: 6 }}>{pfError}</div>}
                          <button
                            onClick={submitPortfolio}
                            disabled={pfLoading}
                            style={{ width: '100%', padding: '7px 0', borderRadius: 7, background: 'var(--gold)', border: 'none', fontSize: 12, fontWeight: 700, color: '#0f0f1c', cursor: pfLoading ? 'default' : 'pointer' }}
                          >
                            {pfLoading ? '…' : 'Add'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Compare link */}
                  <Link
                    className="ci-no-print"
                    href={`/compare?c=${encodeURIComponent(`${id}:${encodeURIComponent(urlGrade ?? (card ? card.grade : 'Raw'))}:${encodeURIComponent(urlName ?? card?.name ?? '')}`)}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', border: '1.5px solid var(--border2)', borderRadius: 10, padding: '9px 14px', fontSize: 11, fontWeight: 600, color: 'var(--ink2)', textDecoration: 'none', transition: 'all 0.2s' }}
                    onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                    onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--ink2)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="1" x2="8" y2="15"/><line x1="1" y1="8" x2="15" y2="8"/><path d="M4 4l8 8M12 4l-8 8"/></svg>
                    Compare
                  </Link>
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
                  {/* Export PDF — Standard+ */}
                  {(userTier === 'standard' || userTier === 'pro') ? (
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
                  ) : isLoggedIn ? (
                    <Link href="/pricing" className="ci-no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1.5px solid var(--border2)', borderRadius: 10, padding: '9px 14px', fontSize: 11, fontWeight: 500, color: 'var(--ink3)', textDecoration: 'none', flexShrink: 0, alignSelf: 'flex-start' }}>
                      🔒 PDF — Standard+
                    </Link>
                  ) : null}
                </div>
              </div>

              {/* Grade + Price + Window — inline in header */}
              <div className="ci-controls ci-no-print" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                {/* Grade */}
                <div>
                  <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 8, display: 'block' }}>GRADE</span>
                  {['RAW', 'PSA', 'BGS', 'CGC'].map(grp => {
                    const items = GRADES.filter(g => g.grader === grp)
                    if (!items.length) return null
                    return (
                      <div key={grp} style={{ marginBottom: 6 }}>
                        {grp !== 'RAW' && <span style={{ fontSize: 8, letterSpacing: 1.5, color: 'var(--ink3)', display: 'block', marginBottom: 4 }}>{grp}</span>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {items.map(g => {
                            const active = selectedGrade === g.key
                            return (
                              <button key={g.key} onClick={() => setSelectedGrade(g.key)}
                                style={{ padding: '5px 9px', borderRadius: 6, border: active ? '1px solid rgba(232,197,71,0.4)' : '1px solid var(--border)', background: active ? 'var(--gold2)' : 'transparent', cursor: 'pointer' }}>
                                <span className="font-num" style={{ fontSize: 11, fontWeight: 700, color: active ? 'var(--gold)' : 'var(--ink3)' }}>{g.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
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

          {/* ── Data Quality Warning Banner ── */}
          {liveData?.data_warning && (() => {
            const w = liveData.data_warning;
            const configs: Record<string, { bg: string; border: string; icon: string; text: string; sub: string }> = {
              limited_sales:          { bg: 'rgba(232,197,71,0.06)',  border: 'rgba(232,197,71,0.25)',  icon: '⚠️', text: 'Limited sales data',          sub: `Based on ${liveData.ebay_sale_count ?? 'fewer than 10'} recent eBay sales — treat as indicative.` },
              rare_asset:             { bg: 'rgba(99,179,237,0.06)',  border: 'rgba(99,179,237,0.25)',  icon: '💎', text: 'Rare asset',                   sub: 'Very limited market activity. Showing last known eBay sale price.' },
              high_value_limited:     { bg: 'rgba(232,197,71,0.06)',  border: 'rgba(232,197,71,0.25)',  icon: '⚠️', text: 'High-value card — limited data', sub: 'Fewer than 5 recent eBay sales. Price shown is indicative only.' },
              low_volume_tcg_fallback:{ bg: 'rgba(237,137,54,0.08)',  border: 'rgba(237,137,54,0.30)',  icon: '🔄', text: 'Low eBay volume — TCGPlayer price used', sub: 'Fewer than 5 recent eBay sales. Price sourced from TCGPlayer as estimate.' },
              low_volume_no_fallback: { bg: 'rgba(232,90,74,0.08)',   border: 'rgba(232,90,74,0.30)',   icon: '⚠️', text: 'Very limited sales data',        sub: 'Fewer than 5 recent eBay sales and no TCGPlayer data. Use with caution.' },
            };
            const cfg = configs[w];
            if (!cfg) return null;
            return (
              <div style={{ borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '12px 16px', marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{cfg.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>{cfg.sub}</div>
                </div>
                {liveData.data_source && (
                  <div style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 9, letterSpacing: 1, color: 'var(--ink3)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 99, padding: '3px 8px', alignSelf: 'center' }}>
                    SOURCE: {liveData.data_source.toUpperCase()}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Show Full Analysis toggle ── */}
          <div className="ci-no-print" style={{ marginBottom: 10 }}>
            {userTier === 'pro' ? (
              <button
                onClick={() => setShowAnalysis(!showAnalysis)}
                style={{ width: '100%', padding: '14px 20px', borderRadius: 14, background: 'var(--surface)', border: '1px solid rgba(232,197,71,0.25)', color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(232,197,71,0.25)')}
              >
                {showAnalysis ? '↑ Hide Analysis' : '↓ Show Full Analysis'}
              </button>
            ) : (
              <Link href="/pricing" style={{ textDecoration: 'none', width: '100%', padding: '14px 20px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                🔒 Advanced Analytics — Pro feature · Upgrade to unlock
              </Link>
            )}
          </div>

          {/* ── Full Analysis (hidden by default, Pro only) ── */}
          {showAnalysis && userTier === 'pro' && (
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
                    LIVE DATA · eBay completed listings — {card.rarity} {selectedGrade === 'Raw' ? 'raw/ungraded' : selectedGrade}
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

              {/* ─── ADVANCED ANALYTICS SECTION ─── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 10px', padding: '0 2px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', whiteSpace: 'nowrap' }}>ADVANCED ANALYTICS</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {/* 1 — Moving Average Signal */}
              {(liveData?.avg7d || liveData?.avg30d) && (() => {
                const a1 = liveData.avg1d
                const a7 = liveData.avg7d
                const a30 = liveData.avg30d
                const cur = liveData.price
                const signal = a7 && a30 ? (a7 > a30 * 1.02 ? 'BULLISH' : a7 < a30 * 0.98 ? 'BEARISH' : 'NEUTRAL') : 'NEUTRAL'
                const sigColor = signal === 'BULLISH' ? 'var(--green)' : signal === 'BEARISH' ? '#ff6b6b' : 'var(--gold)'
                const sigBg = signal === 'BULLISH' ? 'rgba(61,232,138,0.08)' : signal === 'BEARISH' ? 'rgba(255,107,107,0.08)' : 'rgba(232,197,71,0.08)'
                const sigBorder = signal === 'BULLISH' ? 'rgba(61,232,138,0.2)' : signal === 'BEARISH' ? 'rgba(255,107,107,0.2)' : 'rgba(232,197,71,0.2)'
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>MOVING AVERAGE SIGNAL</span>
                          <TileInfo id="adv-1" text="Compares the 7-day and 30-day price averages. When the 7D avg rises above the 30D avg the short-term trend is bullish; when it falls below, bearish. A strong signal when both averages are diverging." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: sigBg, border: `1px solid ${sigBorder}`, color: sigColor, letterSpacing: 0.5 }}>
                          {signal === 'BULLISH' ? '▲' : signal === 'BEARISH' ? '▼' : '●'} {signal}
                        </span>
                      </div>
                      <div className="ci-adv-4col">
                        {([
                          { label: 'CURRENT', value: cur, highlight: true },
                          { label: '1D AVG',  value: a1 },
                          { label: '7D AVG',  value: a7 },
                          { label: '30D AVG', value: a30 },
                        ] as { label: string; value: number | null | undefined; highlight?: boolean }[]).map((m, i) => (
                          <div key={i} style={{ borderRadius: 10, padding: '12px 14px', background: m.highlight ? 'rgba(232,197,71,0.06)' : 'var(--bg)', border: `1px solid ${m.highlight ? 'rgba(232,197,71,0.2)' : 'var(--border)'}` }}>
                            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{m.label}</div>
                            <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: m.highlight ? 'var(--gold)' : 'var(--ink)' }}>
                              {m.value != null ? fmtCurrency(m.value) : '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                      {a7 && a30 && (
                        <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 12, lineHeight: 1.6 }}>
                          {signal === 'BULLISH'
                            ? `7-day avg (${fmtCurrency(a7)}) is tracking above the 30-day avg (${fmtCurrency(a30)}) — short-term upward momentum.`
                            : signal === 'BEARISH'
                            ? `7-day avg (${fmtCurrency(a7)}) is tracking below the 30-day avg (${fmtCurrency(a30)}) — short-term downward pressure.`
                            : `7-day and 30-day averages are closely aligned — no clear directional signal.`}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* 2 — Volatility Analysis */}
              {liveData?.price_history && liveData.price_history.length >= 3 && (() => {
                const prices = liveData.price_history.map((h: { price: number }) => h.price)
                const mean = prices.reduce((a: number, b: number) => a + b, 0) / prices.length
                const variance = prices.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / prices.length
                const stdDev = Math.sqrt(variance)
                const volPct = mean > 0 ? (stdDev / mean) * 100 : 0
                const volLabel = volPct < 10 ? 'Low' : volPct < 25 ? 'Moderate' : volPct < 50 ? 'High' : 'Extreme'
                const volColor = volPct < 10 ? 'var(--green)' : volPct < 25 ? 'var(--gold)' : '#ff6b6b'
                const minP = Math.min(...prices)
                const maxP = Math.max(...prices)
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>VOLATILITY ANALYSIS</span>
                          <TileInfo id="adv-2" text="Measures how much the price fluctuates using standard deviation. Low volatility means stable, predictable pricing — easier to buy/sell at a fair price. High volatility means bigger risk and potential reward." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: volPct < 10 ? 'rgba(61,232,138,0.08)' : volPct < 25 ? 'rgba(232,197,71,0.08)' : 'rgba(255,107,107,0.08)', border: `1px solid ${volPct < 10 ? 'rgba(61,232,138,0.2)' : volPct < 25 ? 'rgba(232,197,71,0.2)' : 'rgba(255,107,107,0.2)'}`, color: volColor }}>
                          {volLabel} Volatility
                        </span>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink3)', marginBottom: 5 }}>
                          <span>LOW</span><span>MODERATE</span><span>HIGH</span><span>EXTREME</span>
                        </div>
                        <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'linear-gradient(to right, #3de88a, #e8c547, #ff6b6b)' }}>
                          <div style={{ position: 'absolute', left: `${Math.min(volPct / 60 * 100, 96)}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 13, height: 13, borderRadius: '50%', background: 'var(--surface)', border: `2px solid ${volColor}`, boxShadow: `0 0 6px ${volColor}80` }} />
                        </div>
                      </div>
                      <div className="ci-adv-4col">
                        {[
                          { label: 'STD DEV',    value: fmtCurrency(stdDev) },
                          { label: 'VOLATILITY', value: `${volPct.toFixed(1)}%` },
                          { label: 'RANGE',      value: fmtCurrency(maxP - minP) },
                          { label: 'MEAN PRICE', value: fmtCurrency(mean) },
                        ].map((m, i) => (
                          <div key={i} style={{ borderRadius: 8, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 4 }}>{m.label}</div>
                            <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* 3 — Score Radar */}
              {(() => {
                const sb = liveData?.score_breakdown
                const radarData = sb ? [
                  { axis: 'Trend',       value: Math.round((sb.trend       ?? 0) / 30 * 100) },
                  { axis: 'Liquidity',   value: Math.round((sb.liquidity   ?? 0) / 25 * 100) },
                  { axis: 'Consistency', value: Math.round((sb.consistency ?? 0) / 25 * 100) },
                  { axis: 'Value',       value: Math.round((sb.value       ?? 0) / 20 * 100) },
                ] : [
                  { axis: 'Growth',    value: card.breakdown.growth    ?? 50 },
                  { axis: 'Liquidity', value: card.breakdown.liquidity ?? 50 },
                  { axis: 'Demand',    value: card.breakdown.demand    ?? 50 },
                  { axis: 'Stability', value: 100 - (card.breakdown.volatility ?? 50) },
                ]
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        <span style={{ ...L, marginBottom: 0 }}>SCORE BREAKDOWN — RADAR</span>
                        <TileInfo id="adv-3" text="Visual breakdown of all four CardIndex score components — Trend, Liquidity, Consistency, and Value — each normalized to 100. The larger the radar shape, the stronger the overall investment profile." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                        <div style={{ width: 200, height: 180, flexShrink: 0 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarData}>
                              <PolarGrid stroke="rgba(255,255,255,0.07)" />
                              <PolarAngleAxis dataKey="axis" tick={{ fill: '#55556a', fontSize: 10, fontFamily: 'Helvetica' }} />
                              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                              <Radar dataKey="value" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.12} dot={{ fill: 'var(--gold)', r: 3 }} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {radarData.map((d, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 9, letterSpacing: 1, color: 'var(--ink3)', width: 76, flexShrink: 0 }}>{d.axis.toUpperCase()}</span>
                              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${d.value}%`, background: scoreColor(d.value), borderRadius: 2 }} />
                              </div>
                              <span className="font-num" style={{ fontSize: 11, fontWeight: 700, color: scoreColor(d.value), width: 26, textAlign: 'right' }}>{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* 4 — Volume Trend */}
              {liveData?.price_history && liveData.price_history.some((h: { volume?: number }) => (h.volume ?? 0) > 0) && (() => {
                const volData = liveData.price_history
                  .filter((h: { volume?: number }) => h.volume != null)
                  .map((h: { month: string; price: number; volume?: number }) => ({ month: h.month, volume: h.volume ?? 0 }))
                const maxVol = Math.max(...volData.map((d: { volume: number }) => d.volume), 1)
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>SALES VOLUME TREND</span>
                          <TileInfo id="adv-4" text="Number of completed eBay sales per period. Rising volume alongside rising price confirms genuine demand. Falling volume on a rising price can signal a weak, unsustained move." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--ink3)' }}>peak {maxVol} sales/mo</span>
                      </div>
                      <ResponsiveContainer width="100%" height={120}>
                        <ComposedChart data={volData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                          <XAxis dataKey="month" tick={{ fill: '#55556a', fontSize: 9, fontFamily: 'Helvetica' }} axisLine={false} tickLine={false} />
                          <YAxis hide domain={[0, maxVol * 1.2]} />
                          <Tooltip content={({ active, payload }) => {
                            if (active && payload?.length) return (
                              <div style={{ background: '#181828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px' }}>
                                <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{payload[0]?.payload?.month}</div>
                                <div className="font-num" style={{ fontSize: 12, color: 'rgba(74,158,255,0.9)' }}>{payload[0]?.value} sales</div>
                              </div>
                            )
                            return null
                          }} />
                          <Bar dataKey="volume" fill="rgba(74,158,255,0.55)" radius={[3, 3, 0, 0]} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
              })()}

              {/* 5 — Grade Premium Table */}
              {liveData?.all_tier_prices && Object.keys(liveData.all_tier_prices).length > 1 && (() => {
                const tiers = liveData.all_tier_prices as Record<string, { avg: number; source: string; saleCount?: number }>
                const hasPSA = Object.keys(tiers).some(k => k.startsWith('PSA_'))
                if (!hasPSA) return null
                const psa10 = tiers['PSA_10']?.avg ?? 0
                const psa9  = tiers['PSA_9']?.avg  ?? 0
                const nm    = tiers['NEAR_MINT']?.avg ?? 0
                const lp    = tiers['LIGHTLY_PLAYED']?.avg ?? 0
                const psa10Premium = (psa10 > 0 && nm > 0) ? psa10 / nm : null
                const psa9of10     = (psa9  > 0 && psa10 > 0) ? psa9 / psa10 : null
                const mintPremium  = (nm > 0 && lp > 0) ? nm / lp : null
                const fmtMult = (v: number | null) => v == null ? 'n/a' : `${v.toFixed(2)}x`
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                        <span style={{ ...L, marginBottom: 0 }}>GRADE PREMIUM COMPARISON</span>
                        <TileInfo id="adv-5" text="How much more a PSA 10 commands over raw Near Mint, and how Near Mint compares to Lightly Played. Helps you decide whether grading is worth the cost." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {[
                          { label: 'PSA 10 PREMIUM', value: fmtMult(psa10Premium) },
                          { label: 'PSA 9 / 10',     value: fmtMult(psa9of10) },
                          { label: 'MINT PREMIUM',   value: fmtMult(mintPremium) },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 72 }}>
                            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)' }}>{label}</div>
                            <div className="font-num" style={{ fontSize: 22, fontWeight: 700, color: value === 'n/a' ? 'var(--ink3)' : 'var(--ink)' }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* 6 — Sales Price Distribution */}
              {liveData?.ebay_listings && liveData.ebay_listings.length >= 3 && (() => {
                const prices: number[] = liveData.ebay_listings.map((l: { price: number }) => l.price)
                const minP = Math.min(...prices)
                const maxP = Math.max(...prices)
                const range = maxP - minP
                const bucketSize = range > 0 ? range / 6 : 1
                const buckets = Array.from({ length: 6 }, (_, i) => {
                  const lo = minP + i * bucketSize
                  const hi = lo + bucketSize
                  const count = prices.filter((p: number) => i === 5 ? p >= lo && p <= hi : p >= lo && p < hi).length
                  return { label: `$${lo.toFixed(0)}`, count }
                }).filter(b => b.count > 0)
                const sorted = [...prices].sort((a: number, b: number) => a - b)
                const median = sorted[Math.floor(sorted.length / 2)]
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>SALES PRICE DISTRIBUTION</span>
                          <TileInfo id="adv-6" text="Distribution of the individual eBay sale prices used to calculate this card's average. A tight cluster means consistent pricing; a wide spread means high variance and harder-to-predict resale value." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--ink3)' }}>median {fmtCurrency(median)} · {prices.length} sales</span>
                      </div>
                      <ResponsiveContainer width="100%" height={110}>
                        <ComposedChart data={buckets} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                          <XAxis dataKey="label" tick={{ fill: '#55556a', fontSize: 9, fontFamily: 'Helvetica' }} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip content={({ active, payload }) => {
                            if (active && payload?.length) return (
                              <div style={{ background: '#181828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px' }}>
                                <div className="font-num" style={{ fontSize: 12, color: '#f0f0f8' }}>{payload[0]?.value} sales</div>
                              </div>
                            )
                            return null
                          }} />
                          <Bar dataKey="count" fill="rgba(232,197,71,0.5)" radius={[3, 3, 0, 0]} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
              })()}

              {/* 7 — Data Confidence & Quality */}
              {liveData && (() => {
                const conf = liveData.confidence
                const confColor = conf === 'high' ? 'var(--green)' : conf === 'medium' ? 'var(--gold)' : conf === 'low' ? '#ff6b6b' : 'var(--ink3)'
                const confBg = conf === 'high' ? 'rgba(61,232,138,0.08)' : conf === 'medium' ? 'rgba(232,197,71,0.08)' : 'rgba(255,107,107,0.08)'
                const confBorder = conf === 'high' ? 'rgba(61,232,138,0.2)' : conf === 'medium' ? 'rgba(232,197,71,0.2)' : 'rgba(255,107,107,0.2)'
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        <span style={{ ...L, marginBottom: 0 }}>DATA CONFIDENCE & QUALITY</span>
                        <TileInfo id="adv-7" text="How reliable the underlying price data is. Confidence is derived from the number of recent eBay sales — high means 10+ sales, medium means 5–9, low means fewer than 5 or a TCGPlayer fallback was used." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                      </div>
                      <div className="ci-adv-3col" style={{ gap: 10 }}>
                        <div style={{ borderRadius: 10, padding: '12px 14px', background: conf ? confBg : 'var(--bg)', border: `1px solid ${conf ? confBorder : 'var(--border)'}` }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>CONFIDENCE</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: confColor, textTransform: 'capitalize' }}>{conf ?? 'Unknown'}</div>
                        </div>
                        <div style={{ borderRadius: 10, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>ALL-GRADE SALES</div>
                          <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{liveData.total_sale_count ?? liveData.sales_count_30d ?? '—'}</div>
                        </div>
                        <div style={{ borderRadius: 10, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>LAST UPDATED</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)' }}>
                            {liveData.last_updated_pt ? new Date(liveData.last_updated_pt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : 'Today'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* 8 — Price Velocity */}
              {liveData?.avg7d != null && liveData?.avg30d != null && liveData.avg30d > 0 && (() => {
                const weeklyDelta = liveData.avg7d - liveData.avg30d
                const weeklyPct   = (weeklyDelta / liveData.avg30d) * 100
                const proj30d     = liveData.price + weeklyDelta * 4
                const velLabel    = Math.abs(weeklyPct) < 1 ? 'STABLE' : weeklyPct > 0 ? 'ACCELERATING ▲' : 'DECELERATING ▼'
                const velColor    = weeklyPct > 1 ? 'var(--green)' : weeklyPct < -1 ? '#ff6b6b' : 'var(--gold)'
                const velBg       = weeklyPct > 1 ? 'rgba(61,232,138,0.08)' : weeklyPct < -1 ? 'rgba(255,107,107,0.08)' : 'rgba(232,197,71,0.08)'
                const velBorder   = weeklyPct > 1 ? 'rgba(61,232,138,0.2)' : weeklyPct < -1 ? 'rgba(255,107,107,0.2)' : 'rgba(232,197,71,0.2)'
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>PRICE VELOCITY</span>
                          <TileInfo id="adv-8" text="Compares the 7-day average to the 30-day baseline to detect whether price momentum is accelerating or decelerating. The 30-day projection extrapolates the current weekly drift forward." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: velBg, border: `1px solid ${velBorder}`, color: velColor }}>{velLabel}</span>
                      </div>
                      <div className="ci-adv-3col">
                        {[
                          { label: 'CURRENT',      value: fmtCurrency(liveData.price), highlight: true },
                          { label: 'PROJ. 30D',    value: fmtCurrency(proj30d),        color: proj30d > liveData.price ? 'var(--green)' : '#ff6b6b' },
                          { label: 'WEEKLY DELTA', value: `${weeklyPct >= 0 ? '+' : ''}${weeklyPct.toFixed(1)}%`, color: velColor },
                        ].map((m, i) => (
                          <div key={i} style={{ borderRadius: 10, padding: '12px 14px', background: m.highlight ? 'rgba(232,197,71,0.06)' : 'var(--bg)', border: `1px solid ${m.highlight ? 'rgba(232,197,71,0.2)' : 'var(--border)'}` }}>
                            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{m.label}</div>
                            <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: m.color ?? 'var(--gold)' }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 12, lineHeight: 1.6 }}>
                        {weeklyPct > 1 ? `7-day avg is ${weeklyPct.toFixed(1)}% above the 30-day baseline — price is accelerating. Projected to reach ${fmtCurrency(proj30d)} in 30 days if momentum holds.` : weeklyPct < -1 ? `7-day avg is ${Math.abs(weeklyPct).toFixed(1)}% below the 30-day baseline — price is decelerating. Projected to reach ${fmtCurrency(proj30d)} in 30 days if trend continues.` : `7-day and 30-day averages are closely aligned — price momentum is stable.`}
                      </p>
                    </div>
                  </div>
                )
              })()}

              {/* 9 — Buy/Sell Timing */}
              {liveData?.ebay_listings && liveData.ebay_listings.length >= 5 && (() => {
                const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                const counts = [0, 0, 0, 0, 0, 0, 0]
                liveData.ebay_listings.forEach((l: { date?: string }) => { if (l.date) counts[new Date(l.date).getDay()]++ })
                const maxCount = Math.max(...counts); const bestDay = counts.indexOf(maxCount)
                const dayData  = DAYS.map((d, i) => ({ day: d, count: counts[i], best: i === bestDay }))
                const totalSales = counts.reduce((a, b) => a + b, 0)
                if (maxCount === 0) return null
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>BUY / SELL TIMING</span>
                          <TileInfo id="adv-9" text="Breakdown of eBay sales by day of week, based on recent sold listings. The best day to list is when buyers are most active — timing your listing can improve final sale price." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--ink3)' }}>Best day to list: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{DAYS[bestDay]}</span></span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 12, lineHeight: 1.5 }}>Sales activity by day of week — based on {totalSales} recent eBay sold listings.</p>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
                        {dayData.map((d, i) => {
                          const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0
                          return (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <div style={{ width: '100%', position: 'relative', height: 60, display: 'flex', alignItems: 'flex-end' }}>
                                <div style={{ width: '100%', height: `${Math.max(pct, 4)}%`, borderRadius: '3px 3px 0 0', background: d.best ? 'var(--gold)' : 'rgba(255,255,255,0.12)', boxShadow: d.best ? '0 0 8px rgba(232,197,71,0.3)' : 'none' }} />
                              </div>
                              <span style={{ fontSize: 9, color: d.best ? 'var(--gold)' : 'var(--ink3)', fontWeight: d.best ? 700 : 400 }}>{d.day}</span>
                              <span style={{ fontSize: 9, color: 'var(--ink3)' }}>{d.count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* 10 — Outlier Detection */}
              {liveData?.ebay_listings && liveData.ebay_listings.length >= 5 && (() => {
                const prices  = liveData.ebay_listings.map((l: { price: number }) => l.price)
                const mean    = prices.reduce((a: number, b: number) => a + b, 0) / prices.length
                const stdDev  = Math.sqrt(prices.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / prices.length)
                const tagged  = liveData.ebay_listings.map((l: { title: string; price: number; date?: string; url?: string }) => ({ ...l, z: stdDev > 0 ? Math.abs(l.price - mean) / stdDev : 0, outlier: stdDev > 0 && Math.abs(l.price - mean) > 2 * stdDev }))
                const outlierCount = tagged.filter((l: { outlier: boolean }) => l.outlier).length
                if (outlierCount === 0) return null
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>OUTLIER DETECTION</span>
                          <TileInfo id="adv-10" text="Identifies sales that deviate more than 2 standard deviations from the average. HIGH outliers may reflect exceptional condition or error; LOW outliers may indicate damage or a motivated seller." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 99, background: 'rgba(232,82,74,0.08)', border: '1px solid rgba(232,82,74,0.2)', color: '#ff6b6b' }}>{outlierCount} outlier{outlierCount > 1 ? 's' : ''} detected</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 12, lineHeight: 1.5 }}>Mean: {fmtCurrency(mean)} · ±2σ range: {fmtCurrency(Math.max(0, mean - 2 * stdDev))} – {fmtCurrency(mean + 2 * stdDev)}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {tagged.sort((a: { price: number }, b: { price: number }) => b.price - a.price).map((l: { title: string; price: number; date?: string; url?: string; outlier: boolean }, i: number) => (
                          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < tagged.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: l.outlier ? 'var(--ink)' : 'var(--ink2)', fontWeight: l.outlier ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                            </div>
                            {l.outlier && (
                              <span style={{ fontSize: 9, letterSpacing: 1, padding: '2px 7px', borderRadius: 4, background: l.price > mean ? 'rgba(232,82,74,0.1)' : 'rgba(74,158,255,0.1)', color: l.price > mean ? '#ff6b6b' : '#4a9eff', border: `1px solid ${l.price > mean ? 'rgba(232,82,74,0.25)' : 'rgba(74,158,255,0.25)'}`, flexShrink: 0 }}>
                                {l.price > mean ? '▲ HIGH' : '▼ LOW'}
                              </span>
                            )}
                            <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: l.outlier ? (l.price > mean ? '#ff6b6b' : '#4a9eff') : 'var(--ink)', flexShrink: 0 }}>{fmtCurrency(l.price)}</div>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* 11 — Grade Relative Value */}
              {liveData?.all_tier_prices && liveData?.resolved_tier && (() => {
                const tiers = liveData.all_tier_prices as Record<string, { avg: number; source: string; saleCount?: number }>
                const fmtTL  = (k: string) => k.includes('_') ? k.split('_').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ') : k
                const validEntries = Object.entries(tiers).filter(([k, v]) => k !== 'AGGREGATED' && v.avg > 0).sort(([, a], [, b]) => b.avg - a.avg)
                if (validEntries.length < 2) return null
                const topAvg  = validEntries[0][1].avg; const topLabel = fmtTL(validEntries[0][0])
                const currentAvg = liveData.price; const relPct = topAvg > 0 ? (currentAvg / topAvg) * 100 : 100
                const discountPct = 100 - relPct
                const typical: Record<string, [number, number]> = { NEAR_MINT: [0, 5], LIGHTLY_PLAYED: [10, 25], MODERATELY_PLAYED: [25, 40], HEAVILY_PLAYED: [35, 55], DAMAGED: [45, 65] }
                const range  = typical[liveData.resolved_tier]; const isUnder = range && discountPct > range[1]; const isOver = range && discountPct < range[0]
                const valueLabel = !range ? 'Unknown' : isUnder ? 'UNDERVALUED' : isOver ? 'PREMIUM' : 'FAIR VALUE'
                const valueColor = !range ? 'var(--ink3)' : isUnder ? 'var(--green)' : isOver ? '#ff6b6b' : 'var(--gold)'
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>GRADE RELATIVE VALUE</span>
                          <TileInfo id="adv-11" text="Compares this grade's price to the best available grade to determine if it's trading at a typical, premium, or discounted level. UNDERVALUED means this grade is cheaper than expected relative to mint condition." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: isUnder ? 'rgba(61,232,138,0.08)' : isOver ? 'rgba(255,107,107,0.08)' : 'rgba(232,197,71,0.08)', border: `1px solid ${isUnder ? 'rgba(61,232,138,0.2)' : isOver ? 'rgba(255,107,107,0.2)' : 'rgba(232,197,71,0.2)'}`, color: valueColor }}>{valueLabel}</span>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink3)', marginBottom: 6 }}>
                          <span>vs {topLabel} ({fmtCurrency(topAvg)})</span>
                          <span className="font-num" style={{ color: 'var(--ink)', fontWeight: 700 }}>{relPct.toFixed(1)}% of top grade</span>
                        </div>
                        <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
                          {range && <div style={{ position: 'absolute', left: `${100 - range[1]}%`, right: `${range[0]}%`, top: 0, bottom: 0, background: 'rgba(232,197,71,0.15)', borderRadius: 3 }} />}
                          <div style={{ position: 'absolute', left: `${Math.max(0, Math.min(relPct, 100) - 1)}%`, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, borderRadius: '50%', background: 'var(--surface)', border: `2px solid ${valueColor}`, boxShadow: `0 0 6px ${valueColor}80` }} />
                        </div>
                        {range && <div style={{ fontSize: 9, color: 'var(--ink3)', marginTop: 6 }}>Typical {fmtTL(liveData.resolved_tier)} discount: {range[0]}–{range[1]}% below {topLabel} · Current discount: {discountPct.toFixed(1)}%</div>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[{ label: 'THIS GRADE', value: fmtCurrency(currentAvg), color: 'var(--gold)' }, { label: `TOP GRADE (${topLabel.toUpperCase()})`, value: fmtCurrency(topAvg), color: 'var(--ink)' }].map((m, i) => (
                          <div key={i} style={{ borderRadius: 8, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 4 }}>{m.label}</div>
                            <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* 12 — Momentum Phases */}
              {liveData?.price_history && liveData.price_history.length >= 6 && (() => {
                type HistPoint = { month: string; price: number; volume?: number }
                const hist = liveData.price_history as HistPoint[]
                const ma3  = hist.map((_: HistPoint, i: number) => i < 2 ? null : (hist[i-2].price + hist[i-1].price + hist[i].price) / 3)
                const phased = hist.map((h: HistPoint, i: number) => {
                  const prev = i >= 3 ? ma3[i-1] : null; const curr = ma3[i]
                  let phase: 'up' | 'down' | 'neutral' = 'neutral'
                  if (prev != null && curr != null) { if (curr > prev * 1.01) phase = 'up'; else if (curr < prev * 0.99) phase = 'down' }
                  return { ...h, ma3: curr, phase }
                })
                const areas: { x1: string; x2: string; phase: 'up' | 'down' | 'neutral' }[] = []
                let spanStart = 0
                for (let i = 1; i <= phased.length; i++) {
                  if (i === phased.length || phased[i].phase !== phased[spanStart].phase) {
                    if (phased[spanStart].phase !== 'neutral') areas.push({ x1: phased[spanStart].month, x2: phased[Math.min(i, phased.length - 1)].month, phase: phased[spanStart].phase })
                    spanStart = i
                  }
                }
                const upP = phased.filter((p: { phase: string }) => p.phase === 'up').length
                const dnP = phased.filter((p: { phase: string }) => p.phase === 'down').length
                const dom = upP > dnP ? 'BULLISH' : upP < dnP ? 'BEARISH' : 'MIXED'
                const domColor = dom === 'BULLISH' ? 'var(--green)' : dom === 'BEARISH' ? '#ff6b6b' : 'var(--gold)'
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>MOMENTUM PHASES</span>
                          <TileInfo id="adv-12" text="The gold line is a 3-point moving average smoothed over price history. Green shaded zones show periods of accelerating price; red zones show deceleration. Dominant phase determines the BULLISH/BEARISH/MIXED badge." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: dom === 'BULLISH' ? 'rgba(61,232,138,0.08)' : dom === 'BEARISH' ? 'rgba(255,107,107,0.08)' : 'rgba(232,197,71,0.08)', border: `1px solid ${dom === 'BULLISH' ? 'rgba(61,232,138,0.2)' : dom === 'BEARISH' ? 'rgba(255,107,107,0.2)' : 'rgba(232,197,71,0.2)'}`, color: domColor }}>{dom}</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8, lineHeight: 1.5 }}>Green zones = accelerating · Red zones = decelerating · Gold line = 3-point moving average.</p>
                      <ResponsiveContainer width="100%" height={130}>
                        <ComposedChart data={phased} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                          {areas.map((a, i) => (
                            <ReferenceArea key={i} x1={a.x1} x2={a.x2} fill={a.phase === 'up' ? 'rgba(61,232,138,0.08)' : 'rgba(255,107,107,0.08)'} stroke="none" />
                          ))}
                          <XAxis dataKey="month" tick={{ fill: '#55556a', fontSize: 9, fontFamily: 'Helvetica' }} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip content={({ active, payload }) => active && payload?.length ? <div style={{ background: '#181828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px' }}><div style={{ fontSize: 10, color: 'var(--ink3)' }}>{payload[0]?.payload?.month}</div><div className="font-num" style={{ fontSize: 12, color: 'var(--ink)' }}>{fmtCurrency(payload[0]?.value as number)}</div></div> : null} />
                          <Line type="monotone" dataKey="price" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} dot={false} />
                          <Line type="monotone" dataKey="ma3" stroke="var(--gold)" strokeWidth={2} dot={false} connectNulls />
                        </ComposedChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                        {[{ label: 'BULLISH PHASES', value: upP, color: 'var(--green)' }, { label: 'BEARISH PHASES', value: dnP, color: '#ff6b6b' }, { label: 'NEUTRAL', value: phased.length - upP - dnP, color: 'var(--ink3)' }].map((m, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 9, color: 'var(--ink3)' }}>{m.label}</span>
                            <span className="font-num" style={{ fontSize: 10, fontWeight: 700, color: m.color }}>{m.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* 13 — Price Position Gauge */}
              {liveData != null && liveData.price_range_low != null && liveData.price_range_high != null && liveData.price_range_high > liveData.price_range_low && (() => {
                const lo = liveData.price_range_low
                const hi = liveData.price_range_high
                const cur = liveData.price
                const pct = Math.max(0, Math.min(((cur - lo) / (hi - lo)) * 100, 100))
                const zone = pct <= 33 ? 'BOTTOM THIRD' : pct <= 66 ? 'MID RANGE' : 'TOP THIRD'
                const zColor = pct <= 33 ? 'var(--green)' : pct <= 66 ? 'var(--gold)' : '#ff6b6b'
                const zBg = pct <= 33 ? 'rgba(61,232,138,0.08)' : pct <= 66 ? 'rgba(232,197,71,0.08)' : 'rgba(255,107,107,0.08)'
                const zBorder = pct <= 33 ? 'rgba(61,232,138,0.2)' : pct <= 66 ? 'rgba(232,197,71,0.2)' : 'rgba(255,107,107,0.2)'
                const insight = pct <= 33
                  ? `Price is near the bottom of its recent range — potentially a good entry point.`
                  : pct <= 66
                  ? `Price is in the middle of its recent range — neither a clear bargain nor overpriced.`
                  : `Price is near the top of its recent range — consider waiting for a pullback before buying.`
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>PRICE POSITION GAUGE</span>
                          <TileInfo id="adv-13" text="Shows where the current price sits within its recent trading range. Bottom third suggests a potential buying opportunity; top third suggests caution. Based on the high and low prices from the current data window." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: zBg, border: `1px solid ${zBorder}`, color: zColor }}>{zone}</span>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink3)', marginBottom: 6 }}>
                          <span>LOW {fmtCurrency(lo)}</span>
                          <span className="font-num" style={{ color: 'var(--gold)', fontWeight: 700 }}>{fmtCurrency(cur)}</span>
                          <span>HIGH {fmtCurrency(hi)}</span>
                        </div>
                        <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(to right, rgba(61,232,138,0.3), rgba(232,197,71,0.3), rgba(255,107,107,0.3))' }}>
                          <div style={{ position: 'absolute', left: `${Math.max(1, Math.min(pct, 97))}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 14, height: 14, borderRadius: '50%', background: 'var(--surface)', border: `2.5px solid ${zColor}`, boxShadow: `0 0 8px ${zColor}80` }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--ink3)', marginTop: 4 }}>
                          <span>BUY ZONE</span><span>NEUTRAL</span><span>CAUTION</span>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.6 }}>{insight}</p>
                    </div>
                  </div>
                )
              })()}

              {/* 14 — VWAP Analysis */}
              {liveData?.price_history && liveData.price_history.some((h: { volume?: number }) => (h.volume ?? 0) > 0) && (() => {
                type HP = { price: number; volume?: number }
                const pts = (liveData.price_history as HP[]).filter(h => (h.volume ?? 0) > 0)
                const totalVol = pts.reduce((a, h) => a + (h.volume ?? 0), 0)
                if (totalVol === 0) return null
                const vwap = pts.reduce((a, h) => a + h.price * (h.volume ?? 0), 0) / totalVol
                const cur = liveData.price
                const diffPct = vwap > 0 ? ((cur - vwap) / vwap) * 100 : 0
                const above = diffPct > 0
                const label = Math.abs(diffPct) < 2 ? 'AT VWAP' : above ? 'ABOVE VWAP' : 'BELOW VWAP'
                const lColor = Math.abs(diffPct) < 2 ? 'var(--gold)' : above ? '#ff6b6b' : 'var(--green)'
                const lBg = Math.abs(diffPct) < 2 ? 'rgba(232,197,71,0.08)' : above ? 'rgba(255,107,107,0.08)' : 'rgba(61,232,138,0.08)'
                const lBorder = Math.abs(diffPct) < 2 ? 'rgba(232,197,71,0.2)' : above ? 'rgba(255,107,107,0.2)' : 'rgba(61,232,138,0.2)'
                const insight = Math.abs(diffPct) < 2
                  ? `Price is near VWAP — trading at fair value relative to where most volume has occurred.`
                  : above
                  ? `Price is ${diffPct.toFixed(1)}% above VWAP — trading at a premium to where most volume occurred. Potential mean-reversion risk.`
                  : `Price is ${Math.abs(diffPct).toFixed(1)}% below VWAP — trading at a discount to where most volume occurred. Potential value opportunity.`
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>VWAP ANALYSIS</span>
                          <TileInfo id="adv-14" text="Volume Weighted Average Price (VWAP) weights each price point by its sales volume, giving a more accurate picture of where most trades actually occurred. Trading below VWAP = discount; above = premium." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: lBg, border: `1px solid ${lBorder}`, color: lColor }}>{label}</span>
                      </div>
                      <div className="ci-adv-3col" style={{ marginBottom: 14 }}>
                        {[
                          { label: 'CURRENT PRICE', value: fmtCurrency(cur), highlight: true },
                          { label: 'VWAP', value: fmtCurrency(vwap), color: 'var(--ink)' },
                          { label: 'DEVIATION', value: `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%`, color: lColor },
                        ].map((m, i) => (
                          <div key={i} style={{ borderRadius: 10, padding: '12px 14px', background: m.highlight ? 'rgba(232,197,71,0.06)' : 'var(--bg)', border: `1px solid ${m.highlight ? 'rgba(232,197,71,0.2)' : 'var(--border)'}` }}>
                            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{m.label}</div>
                            <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: m.highlight ? 'var(--gold)' : (m.color ?? 'var(--ink)') }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.6 }}>{insight}</p>
                    </div>
                  </div>
                )
              })()}

              {/* 15 — Sale Velocity */}
              {(liveData?.sales_count_30d ?? 0) > 0 && (() => {
                const count30 = liveData!.sales_count_30d ?? 0
                const dailyRate = count30 / 30
                const weeklyRate = dailyRate * 7
                const label = dailyRate >= 1 ? 'ACTIVE' : dailyRate >= 0.5 ? 'STEADY' : dailyRate >= 0.2 ? 'SLOW' : 'ILLIQUID'
                const lColor = dailyRate >= 1 ? 'var(--green)' : dailyRate >= 0.5 ? 'var(--green)' : dailyRate >= 0.2 ? 'var(--gold)' : '#ff6b6b'
                const lBg = dailyRate >= 0.5 ? 'rgba(61,232,138,0.08)' : dailyRate >= 0.2 ? 'rgba(232,197,71,0.08)' : 'rgba(255,107,107,0.08)'
                const lBorder = dailyRate >= 0.5 ? 'rgba(61,232,138,0.2)' : dailyRate >= 0.2 ? 'rgba(232,197,71,0.2)' : 'rgba(255,107,107,0.2)'
                const totalSales = liveData?.total_sale_count
                const daysSinceUpdate = liveData?.last_updated_pt ? Math.round((Date.now() - new Date(liveData.last_updated_pt).getTime()) / (1000 * 60 * 60 * 24)) : null
                const insight = dailyRate >= 1
                  ? `This card sells approximately ${weeklyRate.toFixed(1)} times per week — highly liquid. Easy to buy or sell quickly.`
                  : dailyRate >= 0.5
                  ? `This card sells approximately ${weeklyRate.toFixed(1)} times per week — healthy trading activity.`
                  : dailyRate >= 0.2
                  ? `This card averages about ${weeklyRate.toFixed(1)} sales per week — moderate liquidity. May take time to sell at asking price.`
                  : `This card sells less than once per week on average — illiquid. Expect longer time-to-sell and wider bid/ask spreads.`
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>SALE VELOCITY</span>
                          <TileInfo id="adv-15" text="Sale velocity measures how frequently this card sells based on recent eBay data. Higher velocity means more liquid — easier to buy and sell at fair market price. Low velocity means it may sit unsold for weeks." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: lBg, border: `1px solid ${lBorder}`, color: lColor }}>{label}</span>
                      </div>
                      <div className="ci-adv-3col" style={{ marginBottom: 14 }}>
                        {[
                          { label: 'SALES / 30D', value: count30.toLocaleString() },
                          { label: 'EST. / WEEK', value: `~${weeklyRate.toFixed(1)}` },
                          { label: 'EST. / DAY', value: dailyRate >= 0.1 ? `~${dailyRate.toFixed(2)}` : '<0.1' },
                        ].map((m, i) => (
                          <div key={i} style={{ borderRadius: 10, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{m.label}</div>
                            <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? lColor : 'var(--ink)' }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--ink3)' }}>
                        {totalSales != null && <span>All-time sales: <span className="font-num" style={{ color: 'var(--ink)', fontWeight: 700 }}>{totalSales.toLocaleString()}</span></span>}
                        {daysSinceUpdate != null && daysSinceUpdate >= 0 && <span>Data age: <span style={{ color: daysSinceUpdate <= 1 ? 'var(--green)' : daysSinceUpdate <= 3 ? 'var(--gold)' : '#ff6b6b' }}>{daysSinceUpdate === 0 ? 'Today' : `${daysSinceUpdate}d ago`}</span></span>}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 10, lineHeight: 1.6 }}>{insight}</p>
                    </div>
                  </div>
                )
              })()}

              {/* 16 — Score Opportunity Analysis */}
              {liveData?.score_breakdown && (() => {
                const sb = liveData.score_breakdown
                const factors = [
                  { key: 'trend',       raw: sb.trend,       max: 30, label: 'Trend' },
                  { key: 'liquidity',   raw: sb.liquidity,   max: 25, label: 'Liquidity' },
                  { key: 'consistency', raw: sb.consistency, max: 25, label: 'Consistency' },
                  { key: 'value',       raw: sb.value,       max: 20, label: 'Value' },
                ].map(f => ({ ...f, pct: Math.round((f.raw ?? 0) / f.max * 100) }))
                  .sort((a, b) => a.pct - b.pct)
                const insights16: Record<string, { weak: string; improve: string }> = {
                  trend:       { weak: 'Price momentum is weak or declining.',          improve: 'Watch for a trend reversal or price stabilisation before buying.' },
                  liquidity:   { weak: 'Low trading volume limits price discovery.',     improve: 'Consider patience — fewer buyers means wider spreads and longer time-to-sell.' },
                  consistency: { weak: 'High price volatility makes valuation difficult.', improve: 'Wait for price to stabilise over 2–4 weeks before acting.' },
                  value:       { weak: 'Current price is near or above market average.',  improve: 'Look for a dip below the 30-day average for a better entry.' },
                }
                const bottom2 = factors.slice(0, 2)
                const top = factors[factors.length - 1]
                const scoreColor2 = (p: number) => p >= 70 ? 'var(--green)' : p >= 40 ? 'var(--gold)' : '#ff6b6b'
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>SCORE OPPORTUNITY</span>
                          <TileInfo id="adv-16" text="Identifies which score components are limiting your CardIndex score and explains what each weakness means for your investment decision. The top-rated factor shows where this card's strength lies." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span className="font-num" style={{ fontSize: 22, fontWeight: 800, color: scoreColor2(factors.reduce((a,f)=>a+f.pct,0)/4) }}>{sb.total ?? liveData.score}<span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 400 }}>/100</span></span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        {factors.map((f) => (
                          <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ fontSize: 9, letterSpacing: 1, color: 'var(--ink3)', width: 74, flexShrink: 0, textTransform: 'uppercase' }}>{f.label}</div>
                            <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${f.pct}%`, background: scoreColor2(f.pct), borderRadius: 3, transition: 'width 0.6s' }} />
                            </div>
                            <div className="font-num" style={{ fontSize: 11, fontWeight: 700, color: scoreColor2(f.pct), width: 28, textAlign: 'right', flexShrink: 0 }}>{f.pct}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {bottom2.filter(f => f.pct < 70).map(f => (
                          <div key={f.key} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,107,107,0.05)', border: '1px solid rgba(255,107,107,0.12)' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#ff6b6b', marginBottom: 3 }}>⚠ {f.label} ({f.pct}/100)</div>
                            <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>{insights16[f.key].weak} {insights16[f.key].improve}</div>
                          </div>
                        ))}
                        {top.pct >= 70 && (
                          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(61,232,138,0.05)', border: '1px solid rgba(61,232,138,0.12)' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', marginBottom: 3 }}>✓ Strength: {top.label} ({top.pct}/100)</div>
                            <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>
                              {top.key === 'trend' ? 'Strong price momentum — card is appreciating.' : top.key === 'liquidity' ? 'Active trading market — easy to buy or sell.' : top.key === 'consistency' ? 'Stable pricing — low risk of sudden value loss.' : 'Trading at a discount to market average — good value.'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* 17 — Data Source Breakdown */}
              {(() => {
                const src = liveData?.data_source ?? 'ebay'
                const warning = liveData?.data_warning
                const ebayCount = liveData?.ebay_sale_count ?? liveData?.sales_count_30d ?? 0
                const daysSince = liveData?.last_updated_pt ? Math.round((Date.now() - new Date(liveData.last_updated_pt).getTime()) / (1000 * 60 * 60 * 24)) : null
                const warningMessages: Record<string, string> = {
                  limited_sales: 'Fewer than 10 recent eBay sales — price average may be less stable.',
                  rare_asset: 'High-value card with very few sales — treat price as indicative only.',
                  high_value_limited: 'High-value card with limited sales data — use additional sources to verify.',
                  low_volume_tcg_fallback: 'Insufficient eBay data — price sourced from TCGPlayer instead.',
                  low_volume_no_fallback: 'Very few sales and no TCGPlayer fallback — price has low confidence.',
                }
                const srcColor = src === 'ebay' ? '#3de88a' : 'var(--gold)'
                const srcBg = src === 'ebay' ? 'rgba(61,232,138,0.08)' : 'rgba(232,197,71,0.08)'
                const srcBorder = src === 'ebay' ? 'rgba(61,232,138,0.2)' : 'rgba(232,197,71,0.2)'
                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>DATA SOURCE BREAKDOWN</span>
                          <TileInfo id="adv-17" text="Explains where the price data comes from and how trustworthy it is. eBay sold listings are the primary source. TCGPlayer is used as a fallback when eBay data is too sparse. Always check the data age before making a decision." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, background: srcBg, border: `1px solid ${srcBorder}`, color: srcColor, textTransform: 'uppercase' }}>{src === 'ebay' ? 'eBay' : 'TCGPlayer'}</span>
                      </div>
                      <div className="ci-adv-3col" style={{ marginBottom: warning ? 14 : 0 }}>
                        {[
                          { label: 'PRIMARY SOURCE', value: src === 'ebay' ? 'eBay Sales' : 'TCGPlayer', color: srcColor },
                          { label: 'EBAY SALES (30D)', value: ebayCount > 0 ? ebayCount.toLocaleString() : 'N/A', color: ebayCount >= 10 ? 'var(--green)' : ebayCount >= 5 ? 'var(--gold)' : '#ff6b6b' },
                          { label: 'DATA AGE', value: daysSince === null ? 'Unknown' : daysSince === 0 ? 'Today' : `${daysSince}d ago`, color: daysSince === null ? 'var(--ink3)' : daysSince <= 1 ? 'var(--green)' : daysSince <= 3 ? 'var(--gold)' : '#ff6b6b' },
                        ].map((m, i) => (
                          <div key={i} style={{ borderRadius: 10, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{m.label}</div>
                            <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                      {warning && warningMessages[warning] && (
                        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(232,197,71,0.06)', border: '1px solid rgba(232,197,71,0.18)' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', marginBottom: 3 }}>DATA NOTE</div>
                          <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>{warningMessages[warning]}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* 18 — CI Index Comparison */}
              {liveData && marketSnap && marketSnap.totalCards > 0 && (() => {
                const card30d = liveData.price_change_pct ?? null
                const card7d  = (liveData.avg7d && liveData.avg7d > 0 && liveData.price)
                  ? ((liveData.price - liveData.avg7d) / liveData.avg7d) * 100
                  : null

                const idx30d = marketSnap.change30d
                const idx7d  = marketSnap.change7d

                const diff30d = (card30d != null && idx30d != null) ? card30d - idx30d : null
                const diff7d  = (card7d  != null && idx7d  != null) ? card7d  - idx7d  : null

                // Overall signal — use 30d if available, else 7d
                const primaryDiff = diff30d ?? diff7d
                const signal = primaryDiff == null ? 'unknown'
                  : primaryDiff >= 5  ? 'outperforming'
                  : primaryDiff <= -5 ? 'underperforming'
                  : 'tracking'

                const signalColor  = signal === 'outperforming' ? 'var(--green)' : signal === 'underperforming' ? '#ff6b6b' : 'var(--gold)'
                const signalBg     = signal === 'outperforming' ? 'rgba(61,232,138,0.08)' : signal === 'underperforming' ? 'rgba(255,107,107,0.08)' : 'rgba(232,197,71,0.08)'
                const signalBorder = signal === 'outperforming' ? 'rgba(61,232,138,0.2)'  : signal === 'underperforming' ? 'rgba(255,107,107,0.2)'  : 'rgba(232,197,71,0.2)'
                const signalLabel  = signal === 'outperforming' ? 'OUTPERFORMING INDEX' : signal === 'underperforming' ? 'UNDERPERFORMING INDEX' : signal === 'tracking' ? 'TRACKING INDEX' : '—'

                // Percentile: where does card30d rank vs the rising/falling split
                const { risingCount, fallingCount, totalCards } = marketSnap
                const risingPct  = totalCards > 0 ? Math.round((risingCount  / totalCards) * 100) : null
                const fallingPct = totalCards > 0 ? Math.round((fallingCount / totalCards) * 100) : null

                const fmtChg = (v: number | null, fallback = 'n/a') =>
                  v == null ? fallback : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

                // Bar chart rows
                const BarRow = ({ label, cardVal, idxVal }: { label: string; cardVal: number | null; idxVal: number | null }) => {
                  if (cardVal == null && idxVal == null) return null
                  const maxAbs = Math.max(Math.abs(cardVal ?? 0), Math.abs(idxVal ?? 0), 1)
                  const Bar = ({ val, color, bg }: { val: number | null; color: string; bg: string }) => {
                    if (val == null) return <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: 'var(--ink3)' }}>n/a</div></div>
                    const pct = Math.abs(val) / maxAbs * 100
                    return (
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: bg, borderRadius: 3 }} />
                          </div>
                          <span className="font-num" style={{ fontSize: 11, fontWeight: 700, color, minWidth: 44, textAlign: 'right' }}>{fmtChg(val)}</span>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 36, fontSize: 9, letterSpacing: 1, color: 'var(--ink3)', flexShrink: 0 }}>{label}</div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 9, color: 'var(--ink3)', width: 28, flexShrink: 0 }}>CARD</span>
                          <Bar val={cardVal} color={cardVal != null && cardVal >= 0 ? 'var(--green)' : '#ff6b6b'} bg={cardVal != null && cardVal >= 0 ? 'rgba(61,232,138,0.6)' : 'rgba(255,107,107,0.6)'} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 9, color: 'var(--ink3)', width: 28, flexShrink: 0 }}>CI-100</span>
                          <Bar val={idxVal} color="rgba(255,255,255,0.5)" bg="rgba(255,255,255,0.25)" />
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div style={{ ...C }} className="ci-card-surface">
                    <div style={{ ...P }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...L, marginBottom: 0 }}>CI INDEX COMPARISON</span>
                          <TileInfo id="adv-18" text="Compares this card's price performance to the CI-100 market index. Outperforming means the card has appreciated more than the index average; underperforming means it has lagged behind." activeTip={activeTip} setActiveTip={setActiveTip} inline />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: signalBg, border: `1px solid ${signalBorder}`, color: signalColor }}>
                          {signalLabel}
                        </span>
                      </div>

                      {/* Bar comparison rows */}
                      <div style={{ marginBottom: 14 }}>
                        <BarRow label="7D" cardVal={card7d}  idxVal={idx7d}  />
                        <BarRow label="30D" cardVal={card30d} idxVal={idx30d} />
                        <BarRow label="90D" cardVal={null}    idxVal={marketSnap.change90d} />
                      </div>

                      {/* vs-index delta tiles */}
                      <div className="ci-adv-3col" style={{ gap: 10, marginBottom: risingPct != null ? 14 : 0 }}>
                        {[
                          { label: '7D VS INDEX',  value: fmtChg(diff7d),  color: diff7d  == null ? 'var(--ink3)' : diff7d  >= 0 ? 'var(--green)' : '#ff6b6b' },
                          { label: '30D VS INDEX', value: fmtChg(diff30d), color: diff30d == null ? 'var(--ink3)' : diff30d >= 0 ? 'var(--green)' : '#ff6b6b' },
                          { label: 'SIGNAL',       value: signal === 'unknown' ? '—' : signal.charAt(0).toUpperCase() + signal.slice(1), color: signalColor },
                        ].map(m => (
                          <div key={m.label} style={{ borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', padding: '12px 14px' }}>
                            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{m.label}</div>
                            <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Index breadth */}
                      {risingPct != null && (
                        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>CI-100 BREADTH ({totalCards} cards)</div>
                          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
                            <div style={{ flex: risingPct, background: 'rgba(61,232,138,0.6)', borderRadius: '3px 0 0 3px' }} />
                            <div style={{ flex: 100 - risingPct - (fallingPct ?? 0), background: 'rgba(255,255,255,0.12)' }} />
                            <div style={{ flex: fallingPct ?? 0, background: 'rgba(255,107,107,0.6)', borderRadius: '0 3px 3px 0' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                            <span style={{ fontSize: 10, color: 'var(--green)' }}>↑ {risingPct}% rising</span>
                            <span style={{ fontSize: 10, color: '#ff6b6b' }}>↓ {fallingPct}% falling</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

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
