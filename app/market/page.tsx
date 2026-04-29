'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { scoreColor } from '@/lib/data'
import { tcgImg } from '@/lib/img'
import { useCurrency } from '@/lib/currency'
import { useTheme } from '@/lib/theme'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { MarketResponse, IndexStats, MoverCard, IndexMetrics } from '@/app/api/market/route'

// ── Mini chart tooltip ─────────────────────────────────────────────────────────
function IndexTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 2 }}>{label}</p>
      <p className="font-num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{payload[0].value.toFixed(1)}</p>
    </div>
  )
}

// ── Change pill ────────────────────────────────────────────────────────────────
function Chg({ v, size = 12 }: { v: number | null | undefined; size?: number }) {
  if (v == null) return <span style={{ fontSize: size, color: 'var(--ink3)' }}>—</span>
  const pos = v >= 0
  return (
    <span className="font-num" style={{ fontSize: size, fontWeight: 600, color: pos ? 'var(--green)' : 'var(--red)' }}>
      {pos ? '+' : ''}{v.toFixed(2)}%
    </span>
  )
}

// ── Signal badge ──────────────────────────────────────────────────────────────
const SIGNAL_LABELS = {
  new_high: { label: 'New high',  bg: 'rgba(61,232,138,0.15)',  border: 'rgba(61,232,138,0.3)',  color: '#3de88a' },
  rising:   { label: 'Rising',    bg: 'rgba(61,232,138,0.08)',  border: 'rgba(61,232,138,0.2)',  color: '#3de88a' },
  stable:   { label: 'Stable',    bg: 'rgba(140,140,180,0.10)', border: 'rgba(140,140,180,0.2)', color: '#8c8cb4' },
  falling:  { label: 'Falling',   bg: 'rgba(232,82,74,0.08)',   border: 'rgba(232,82,74,0.2)',   color: '#e8524a' },
  new_low:  { label: 'New low',   bg: 'rgba(232,82,74,0.15)',   border: 'rgba(232,82,74,0.3)',   color: '#e8524a' },
}

function SignalBadge({ signal }: { signal: keyof typeof SIGNAL_LABELS }) {
  const s = SIGNAL_LABELS[signal]
  return (
    <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {s.label}
    </span>
  )
}

// ── Index Metrics panel ───────────────────────────────────────────────────────
function IndexMetricsPanel({ metrics, loading }: { metrics: IndexMetrics | null | undefined; loading: boolean }) {
  const items: { label: string; value: number | null; isChange?: boolean; highlight?: boolean }[] = metrics ? [
    { label: 'Index Level',       value: metrics.level,          highlight: true },
    { label: '7d Change',         value: metrics.change7d,       isChange: true },
    { label: '30d Change',        value: metrics.change30d,      isChange: true },
    { label: '90d Change',        value: metrics.change90d,      isChange: true },
    { label: 'Trend (30d proj.)', value: metrics.trendExtension, isChange: true },
    { label: '52w High',          value: metrics.week52High },
    { label: '52w Low',           value: metrics.week52Low },
  ] : Array(7).fill({ label: '—', value: null })

  return (
    <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border2)', padding: '18px 24px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>CI Index Metrics</div>
        <div style={{ fontSize: 10, color: 'var(--ink3)' }}>Normalized equal-weighted index (base = 100 at first tracked price)</div>
      </div>
      <div className="mkt-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px 8px' }}>
        {items.map(({ label, value, isChange, highlight }, i) => (
          <div key={i} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label}
            </div>
            {loading || value == null ? (
              <div style={{ height: 22, borderRadius: 4, background: 'var(--surface2)', animation: 'sk-pulse 1.6s ease-in-out infinite' }} />
            ) : isChange ? (
              <Chg v={value} size={14} />
            ) : (
              <span className="font-num" style={{ fontSize: 14, fontWeight: 700, color: highlight ? 'var(--gold)' : 'var(--ink)' }}>
                {value.toFixed(2)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Index stat card ────────────────────────────────────────────────────────────
function IndexCard({ title, subtitle, data, highlight }: {
  title: string; subtitle: string; data: IndexStats | null; highlight?: boolean
}) {
  const level = data?.level
  const changeColor = (v: number) => v >= 0 ? 'var(--green)' : 'var(--red)'

  return (
    <div style={{
      borderRadius: 16, padding: '20px 22px',
      background: 'var(--surface)',
      border: highlight ? '1px solid rgba(232,197,71,0.3)' : '1px solid var(--border)',
      boxShadow: highlight ? '0 0 28px rgba(232,197,71,0.05)' : 'none',
    }}>
      <div style={{ fontSize: 10, color: highlight ? 'var(--gold)' : 'var(--ink3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 12 }}>{subtitle}</div>

      {data ? (
        <>
          <div className="font-num" style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 14, lineHeight: 1 }}>
            {level != null ? level.toFixed(2) : '—'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            {[
              { label: '7d', val: data.change7d },
              { label: '30d', val: data.change30d },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: 9, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 2 }}>{label}</div>
                <span className="font-num" style={{ fontSize: 13, fontWeight: 700, color: changeColor(val) }}>
                  {val >= 0 ? '+' : ''}{val.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{data.cardCount} cards tracked</span>
            <span style={{ fontSize: 10 }}>
              <span style={{ color: 'var(--green)' }}>▲{data.risingCount}</span>
              <span style={{ color: 'var(--ink3)', margin: '0 4px' }}>·</span>
              <span style={{ color: 'var(--red)' }}>▼{data.fallingCount}</span>
            </span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--ink3)', paddingTop: 12 }}>No data yet</div>
      )}
    </div>
  )
}

// ── Mover row ─────────────────────────────────────────────────────────────────
function MoverRow({ item, rank, showSales, fmtCurrency }: {
  item: MoverCard; rank: number; showSales?: boolean; fmtCurrency: (n: number) => string
}) {
  const cardParams = new URLSearchParams({ name: item.card_name, grade: item.grade })
  const href = `/card/${item.card_id}?${cardParams.toString()}`

  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)', textDecoration: 'none', background: 'transparent', transition: 'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span className="font-num" style={{ fontSize: 10, color: 'var(--ink3)', width: 18, flexShrink: 0 }}>{rank}</span>

      {item.image_url ? (
        <div style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)' }}>
          <img src={tcgImg(item.image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      ) : (
        <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--surface2)', flexShrink: 0 }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.card_name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{item.grade}</div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {item.price != null && (
          <div className="font-num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 1 }}>
            {fmtCurrency(item.price)}
          </div>
        )}
        {showSales && item.sales != null ? (
          <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{item.sales} sales</div>
        ) : (
          <Chg v={item.change} size={11} />
        )}
      </div>
    </Link>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ h = 24, w = '100%', r = 6 }: { h?: number; w?: number | string; r?: number }) {
  return (
    <div style={{ height: h, width: w, borderRadius: r, background: 'var(--surface2)' }}
      className="sk-pulse" />
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const WINDOWS = ['3m', '6m', '1y', 'All'] as const
type Window = typeof WINDOWS[number]

function sliceHistory(history: { month: string; value: number }[], window: Window) {
  if (window === 'All' || history.length === 0) return history
  const pts = window === '3m' ? 3 : window === '6m' ? 6 : 12
  return history.slice(-pts)
}

export default function Market() {
  const [data, setData] = useState<MarketResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartWindow, setChartWindow] = useState<Window>('All')
  const { fmtCurrency } = useCurrency()

  useEffect(() => {
    fetch('/api/market')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const { theme } = useTheme()
  const isLight = theme === 'light'
  const gridStroke    = isLight ? 'rgba(0,0,0,0.06)'  : 'rgba(255,255,255,0.04)'
  const tickFill      = isLight ? '#9090aa'            : '#55556a'
  const cursorStroke  = isLight ? 'rgba(0,0,0,0.12)'  : 'rgba(255,255,255,0.08)'

  const signal = data?.signal ?? 'stable'
  const sigStyle = SIGNAL_LABELS[signal]
  const chartData = data ? sliceHistory(data.indexHistory, chartWindow) : []
  const chartUp = chartData.length >= 2 ? chartData[chartData.length - 1].value >= chartData[0].value : true
  const chartColor = chartUp ? '#3de88a' : '#e8524a'

  return (
    <>
      <Navbar />
      <style>{`
        @keyframes sk-pulse { 0%,100%{opacity:1}50%{opacity:.4} }
        .sk-pulse { animation: sk-pulse 1.6s ease-in-out infinite; }
        .mkt-indices { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
        .mkt-movers  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 900px) { .mkt-indices { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 900px) { .mkt-metrics-grid { grid-template-columns: repeat(4,1fr) !important; } }
        @media (max-width: 640px) { .mkt-indices { grid-template-columns: 1fr 1fr; } .mkt-movers { grid-template-columns: 1fr; } .mkt-hero { flex-direction: column !important; } .mkt-metrics-grid { grid-template-columns: repeat(2,1fr) !important; } .mkt-most-traded { grid-template-columns: 1fr !important; } .mkt-most-traded .mkt-most-traded-item { border-right: none !important; border-bottom: 1px solid var(--border) !important; } .mkt-most-traded .mkt-most-traded-item:last-child { border-bottom: none !important; } }
      `}</style>

      <main style={{ paddingTop: 72, paddingBottom: 96, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 0' }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>Market Overview</p>
              {data && (data as { constituentCount?: number }).constituentCount != null && (
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: '2px 9px', borderRadius: 99, background: 'rgba(232,197,71,0.1)', color: 'var(--gold)', border: '1px solid rgba(232,197,71,0.25)' }}>
                  CI-{(data as { constituentCount?: number }).constituentCount} INDEX
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 6 }}>
              Pokemon TCG market
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.6 }}>
              {data && (data as { constituentCount?: number }).constituentCount
                ? `Equal-weighted index tracking ${(data as { constituentCount?: number }).constituentCount} curated cards — ${(data as { pricedCount?: number }).pricedCount ?? 0} currently priced.`
                : 'Aggregate index across all tracked cards — price trends, movers, and market breadth.'}
            </p>
            {data?.lastUpdated && (
              <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 6, opacity: 0.6 }}>
                Last updated {new Date(data.lastUpdated).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          {/* ── Hero: Signal + Overall Index ── */}
          <div className="mkt-hero" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>

            {/* Signal snapshot */}
            <div style={{
              flex: '0 0 240px', borderRadius: 16, padding: '22px 24px',
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
            }}>
              <div style={{ fontSize: 9, color: 'var(--ink3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Signal snapshot</div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>30d trend</div>
                {loading ? <Skeleton h={22} w={90} /> : <SignalBadge signal={signal} />}
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 9, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 4 }}>30d change</div>
                  {loading ? <Skeleton h={20} w={70} /> : (
                    <Chg v={data?.overall?.change30d} size={20} />
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 9, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 4 }}>7d change</div>
                {loading ? <Skeleton h={18} w={60} /> : (
                  <Chg v={data?.overall?.change7d} size={18} />
                )}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 9, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 4 }}>Cards tracked</div>
                  <div className="font-num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                    {loading ? '—' : data?.stats.totalCards ?? '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Overall index hero */}
            <div style={{ flex: 1, borderRadius: 16, padding: '22px 28px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Overall Index</div>
                  {loading ? <Skeleton h={44} w={140} /> : (
                    <div className="font-num" style={{ fontSize: 44, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-2px', lineHeight: 1 }}>
                      {data?.overall?.level != null ? data.overall.level.toFixed(2) : '—'}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 6 }}>median tracked card price (USD)</div>
                </div>

                {/* Change grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', paddingTop: 4 }}>
                  {[
                    { label: '7d change',  val: data?.overall?.change7d },
                    { label: '30d change', val: data?.overall?.change30d },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div style={{ fontSize: 9, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 4 }}>{label.toUpperCase()}</div>
                      {loading ? <Skeleton h={18} w={60} /> : <Chg v={val} size={15} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Breadth bar */}
              {!loading && data && data.stats.totalCards > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--green)', letterSpacing: 0.5 }}>
                      ▲ {data.stats.risingCount} rising
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--ink3)', letterSpacing: 0.5 }}>
                      → {data.stats.unchangedCount} unchanged
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--red)', letterSpacing: 0.5 }}>
                      {data.stats.fallingCount} falling ▼
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--track)', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ height: '100%', width: `${(data.stats.risingCount / data.stats.totalCards) * 100}%`, background: 'var(--green)', borderRadius: '3px 0 0 3px', transition: 'width 0.4s' }} />
                    <div style={{ height: '100%', width: `${(data.stats.unchangedCount / data.stats.totalCards) * 100}%`, background: 'var(--border2)' }} />
                    <div style={{ height: '100%', flex: 1, background: 'var(--red)', borderRadius: '0 3px 3px 0' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── CI Index Metrics ── */}
          <IndexMetricsPanel metrics={data?.indexMetrics} loading={loading} />

          {/* ── 4 Index cards ── */}
          <div className="mkt-indices" style={{ marginBottom: 16 }}>
            <IndexCard title="CI Index"         subtitle="All constituents"   data={loading ? null : data?.overall ?? null} highlight />
            <IndexCard title="Raw Index"        subtitle="Ungraded cards"     data={loading ? null : data?.raw ?? null} />
            <IndexCard title="Graded Index"     subtitle="PSA / BGS / CGC"    data={loading ? null : data?.graded ?? null} />
            <IndexCard title="PSA 10 Index"     subtitle="PSA 10 only"        data={loading ? null : data?.psa10 ?? null} />
          </div>

          {/* ── Index performance chart ── */}
          <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', padding: '22px 24px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Overall index performance</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)' }}>Normalized to each card&apos;s earliest tracked price = 100</div>
              </div>
              <div style={{ display: 'flex', gap: 2, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border2)' }}>
                {WINDOWS.map(w => (
                  <button key={w} onClick={() => setChartWindow(w)}
                    style={{ padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500, background: chartWindow === w ? 'var(--surface2)' : 'transparent', color: chartWindow === w ? 'var(--ink)' : 'var(--ink3)', transition: 'all 0.15s' }}>
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <Skeleton h={220} />
            ) : chartData.length < 2 ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 32, opacity: 0.3 }}>📈</div>
                <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Not enough history yet</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', opacity: 0.7 }}>Visit card pages to build up price history coverage</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mktGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: tickFill, fontSize: 10, fontFamily: 'Helvetica' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: tickFill, fontSize: 10, fontFamily: 'Helvetica' }} axisLine={false} tickLine={false} width={40} tickFormatter={v => v.toFixed(0)} />
                  <Tooltip content={<IndexTooltip />} cursor={{ stroke: cursorStroke, strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} fill="url(#mktGrad)" dot={false} activeDot={{ r: 4, fill: chartColor, stroke: 'var(--surface)' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Top movers ── */}
          <div className="mkt-movers" style={{ marginBottom: 16 }}>
            {/* Rising */}
            <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>▲</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Top rising (30d)</span>
              </div>
              {loading ? (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...Array(5)].map((_, i) => <Skeleton key={i} h={36} />)}
                </div>
              ) : data?.topRising.length ? (
                data.topRising.map((item, i) => (
                  <MoverRow key={`${item.card_id}-${item.grade}`} item={item} rank={i + 1} fmtCurrency={fmtCurrency} />
                ))
              ) : (
                <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: 'var(--ink3)' }}>No data yet</div>
              )}
            </div>

            {/* Falling */}
            <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>▼</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Top falling (30d)</span>
              </div>
              {loading ? (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...Array(5)].map((_, i) => <Skeleton key={i} h={36} />)}
                </div>
              ) : data?.topFalling.length ? (
                data.topFalling.map((item, i) => (
                  <MoverRow key={`${item.card_id}-${item.grade}`} item={item} rank={i + 1} fmtCurrency={fmtCurrency} />
                ))
              ) : (
                <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: 'var(--ink3)' }}>No data yet</div>
              )}
            </div>
          </div>

          {/* ── Most traded ── */}
          {(loading || (data?.mostTraded?.length ?? 0) > 0) && (
            <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Most traded (30d sales)</span>
              </div>
              {loading ? (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...Array(5)].map((_, i) => <Skeleton key={i} h={36} />)}
                </div>
              ) : (
                <div className="mkt-most-traded" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  {data!.mostTraded.map((item, i) => (
                    <div key={`${item.card_id}-${item.grade}`} className="mkt-most-traded-item" style={{ borderBottom: i < data!.mostTraded.length - 2 ? '1px solid var(--border)' : 'none', borderRight: i % 2 === 0 ? '1px solid var(--border)' : 'none' }}>
                      <MoverRow item={item} rank={i + 1} showSales fmtCurrency={fmtCurrency} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Methodology note ── */}
          <div style={{ marginTop: 24, padding: '14px 18px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--ink2)' }}>Methodology:</strong>{' '}
              Index levels reflect the median price of cards in each category from CardIndex&apos;s price cache.
              The 7d change is derived from each card&apos;s 7-day average vs. current price.
              The 30d change is the Poketrace 30-day percentage change, aggregated with a median to reduce outlier impact.
              Performance chart normalises each card to 100 at its earliest tracked price point.
              Coverage grows as more cards are viewed — search for cards to expand the index.
            </p>
          </div>

        </div>
      </main>
    </>
  )
}
