'use client'
import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Navbar from '@/components/Navbar'
import { getCard, fmt } from '@/lib/data'

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
  if (vsMarketPct <= -50) return { label: 'EXCELLENT BUY', color: '#3de88a', bg: 'rgba(8,22,14,0.95)', border: 'rgba(61,232,138,0.1)' }
  if (vsMarketPct <= -20) return { label: 'GOOD VALUE', color: '#3de88a', bg: 'rgba(8,22,14,0.95)', border: 'rgba(61,232,138,0.1)' }
  if (vsMarketPct <= 10) return { label: 'FAIR VALUE', color: '#e8c547', bg: 'rgba(18,16,8,0.95)', border: 'rgba(232,197,71,0.1)' }
  if (vsMarketPct <= 30) return { label: 'ABOVE MARKET', color: '#e8524a', bg: 'rgba(22,8,8,0.95)', border: 'rgba(232,82,74,0.1)' }
  return { label: 'OVERPRICED', color: '#e8524a', bg: 'rgba(22,8,8,0.95)', border: 'rgba(232,82,74,0.1)' }
}

function getHoldVerdictColor(score: number) {
  return score >= 80 ? '#3de88a' : score >= 60 ? '#e8c547' : '#e8524a'
}

const SparkTooltip = ({ active, payload }: { active?: boolean; payload?: { value: number }[] }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: '#181828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px' }}>
        <span className="font-mono-custom" style={{ fontSize: 12, color: '#f0f0f8' }}>{fmt(payload[0].value)}</span>
      </div>
    )
  }
  return null
}

export default function CardPage() {
  const { id } = useParams<{ id: string }>()
  const card = getCard(id)

  // For API cards not in mock data — fetch basic info from pokemontcg.io
  const [apiCard, setApiCard] = useState<{ name: string; set: string; number: string; imageUrl: string; tags: string[] } | null>(null)
  const [imgError, setImgError] = useState(false)

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

  const defaultGrade = card?.grade.replace('PSA ', '') ?? '10'
  const [selectedGrade, setSelectedGrade] = useState(defaultGrade)
  const [priceInput, setPriceInput] = useState(card ? String(card.price) : '')
  const [userPrice, setUserPrice] = useState(card ? card.price : 0)
  const [analysisWindow, setAnalysisWindow] = useState<'1M' | '3M' | '6M'>('3M')
  const [showFull, setShowFull] = useState(true)

  const handleAnalyse = useCallback(() => {
    const parsed = parseFloat(priceInput.replace(/[^0-9.]/g, ''))
    if (!isNaN(parsed) && parsed > 0) setUserPrice(parsed)
  }, [priceInput])

  // API card (non-mock) — show card info + analysis form, no detailed analysis data
  if (!card) {
    const displayName = apiCard?.name ?? '...'
    const displaySet = apiCard ? `${apiCard.set} · #${apiCard.number}` : 'Loading...'
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 56, paddingBottom: 80, minHeight: '100vh' }}>
          <div style={{ maxWidth: 500, margin: '0 auto', padding: '0 16px' }}>
            <div style={{ marginTop: 20, marginBottom: 12, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 80, height: 110, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {apiCard?.imageUrl && !imgError ? (
                      <img src={apiCard.imageUrl} alt={displayName} onError={() => setImgError(true)} style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{apiCard ? '—' : '...'}</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h1 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 2 }}>{displayName}</h1>
                    <p style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 10 }}>{displaySet}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(apiCard?.tags ?? []).map(tag => (
                        <span key={tag} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink2)' }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <Link href="/" style={{ fontSize: 12, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 14 }}>← Change card</Link>
              </div>
            </div>
            <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
              <p className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Full analysis coming soon</p>
              <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
                This card isn&apos;t in our analysis database yet. We&apos;re continually adding cards — check back soon or browse our featured cards below.
              </p>
              <Link href="/#featured" style={{ display: 'inline-block', marginTop: 16, padding: '10px 20px', borderRadius: 10, background: 'var(--gold)', color: '#08080f', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                Browse featured cards
              </Link>
            </div>
          </div>
        </main>
      </>
    )
  }

  // Derived values
  const vsMarketPct = userPrice > 0 ? ((userPrice - card.marketAvg) / card.marketAvg * 100) : 0
  const belowMkt = card.marketAvg - userPrice
  const verdict = getPriceVerdict(vsMarketPct)
  const holdColor = getHoldVerdictColor(card.holdScore)

  // Price range bar position (clamped 0–100%)
  const rangeWidth = card.priceRange90d.max - card.priceRange90d.min
  const priceBarPos = Math.max(0, Math.min(100, (userPrice - card.priceRange90d.min) / rangeWidth * 100))

  // Chart data filtered by window
  const windowPoints = analysisWindow === '1M' ? 2 : analysisWindow === '3M' ? 3 : 6
  const chartData = card.history.slice(-windowPoints)
  const chartColor = card.trendPct >= 0 ? '#3de88a' : '#e8524a'

  // Summary text
  const windowLabel = analysisWindow === '1M' ? 'last 30 days' : analysisWindow === '3M' ? 'last 90 days' : 'last 180 days'
  const summaryText = `Based on eBay sold data from the ${windowLabel}, PSA ${selectedGrade === 'RAW' ? 'ungraded' : selectedGrade} copies sold between ${fmt(card.priceRange90d.min)} and ${fmt(card.priceRange90d.max)} AUD. Your price of ${fmt(userPrice)} AUD is approximately ${Math.abs(Math.round(vsMarketPct))}% ${vsMarketPct < 0 ? 'below' : 'above'} the market average of ${fmt(card.marketAvg)} AUD${vsMarketPct <= -20 ? ', representing an exceptional buying opportunity if authentic' : ''}.`

  // Breakeven display
  const breakevenDisplay = vsMarketPct < 0
    ? { label: `Already ${Math.abs(Math.round(vsMarketPct))}% below market`, sub: 'already at / below market' }
    : card.monthlyGrowth > 0
      ? { label: `~${Math.ceil(Math.log(userPrice / card.marketAvg) / Math.log(1 + card.monthlyGrowth / 100))}mo`, sub: `at +${card.monthlyGrowth}%/mo growth` }
      : { label: 'N/A', sub: 'negative growth trend' }

  const S = {
    section: { marginBottom: 12, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' } as const,
    sectionPad: { padding: '18px 20px' } as const,
    label: { fontSize: 10, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 12, display: 'block' } as const,
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 56, paddingBottom: 80, minHeight: '100vh' }}>
        <div style={{ maxWidth: 500, margin: '0 auto', padding: '0 16px' }}>

          {/* ── Card Header ── */}
          <div style={{ ...S.section, marginTop: 20 }}>
            <div style={{ ...S.sectionPad }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 80, height: 110, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {card.imageUrl && !imgError ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      onError={() => setImgError(true)}
                      style={{ height: '100%', width: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ fontSize: 36 }}>{card.emoji}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 2 }}>{card.name}</h1>
                  <p style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 10 }}>{card.set} · #{card.cardNumber}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {card.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink2)', letterSpacing: 0.3 }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
              <Link href="/market" style={{ fontSize: 12, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 14 }}>← Change card</Link>
            </div>
          </div>

          {/* ── Grade Selector ── */}
          <div style={{ ...S.section }}>
            <div style={{ ...S.sectionPad }}>
              <span style={{ ...S.label }}>SELECT GRADE</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {GRADES.map(g => {
                  const active = selectedGrade === g.key
                  return (
                    <button
                      key={g.key}
                      onClick={() => setSelectedGrade(g.key)}
                      style={{ padding: '8px 4px', borderRadius: 8, border: active ? '1px solid rgba(232,197,71,0.4)' : '1px solid var(--border)', background: active ? 'var(--gold2)' : 'var(--surface2)', cursor: 'pointer', textAlign: 'center' }}
                    >
                      <div className="font-display" style={{ fontSize: g.key === 'RAW' ? 10 : 14, fontWeight: 700, color: active ? 'var(--gold)' : 'var(--ink)', lineHeight: 1.1 }}>{g.key}</div>
                      <div style={{ fontSize: 8, color: active ? 'var(--gold)' : 'var(--ink3)', marginTop: 2, letterSpacing: 0.3 }}>{g.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Price Input ── */}
          <div style={{ ...S.section }}>
            <div style={{ ...S.sectionPad }}>
              <span style={{ ...S.label }}>YOUR PRICE (AUD)</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 10, overflow: 'hidden', paddingLeft: 14 }}>
                  <span className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink2)', flexShrink: 0 }}>$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={priceInput}
                    onChange={e => setPriceInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAnalyse()}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '12px 10px 12px 6px', fontSize: 22, fontWeight: 700, color: 'var(--gold)', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.5px', minWidth: 0 }}
                  />
                </div>
                <button
                  onClick={handleAnalyse}
                  style={{ padding: '0 20px', borderRadius: 10, background: 'var(--gold)', border: 'none', color: '#08080f', fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: 'pointer', flexShrink: 0 }}
                >
                  ANALYSE
                </button>
              </div>
            </div>
          </div>

          {/* ── Analysis Window ── */}
          <div style={{ ...S.section }}>
            <div style={{ ...S.sectionPad, paddingTop: 14, paddingBottom: 14 }}>
              <span style={{ ...S.label, marginBottom: 10 }}>ANALYSIS WINDOW</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {WINDOWS.map(w => {
                  const active = analysisWindow === w.key
                  return (
                    <button
                      key={w.key}
                      onClick={() => setAnalysisWindow(w.key as '1M' | '3M' | '6M')}
                      style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: active ? '1px solid rgba(232,197,71,0.4)' : '1px solid var(--border)', background: active ? 'var(--gold2)' : 'var(--surface2)', cursor: 'pointer', textAlign: 'center' }}
                    >
                      <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: active ? 'var(--gold)' : 'var(--ink)' }}>{w.key}</div>
                      <div style={{ fontSize: 10, color: active ? 'var(--gold)' : 'var(--ink3)', marginTop: 2 }}>{w.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Summary Grid ── */}
          <div style={{ ...S.section }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {[
                {
                  label: 'VERDICT',
                  value: verdict.label,
                  sub: 'price vs market',
                  valueColor: verdict.color,
                  valueSize: 14,
                },
                {
                  label: 'MARKET AVG',
                  value: fmt(card.marketAvg),
                  sub: `${card.ebayListings.length} eBay sold`,
                  valueColor: 'var(--ink)',
                  valueSize: 18,
                },
                {
                  label: 'YOUR PRICE',
                  value: fmt(userPrice),
                  sub: vsMarketPct < 0 ? `+${fmt(belowMkt).replace('$', '')} below` : `${fmt(Math.abs(belowMkt)).replace('$', '')} above`,
                  valueColor: 'var(--gold)',
                  valueSize: 18,
                },
                {
                  label: 'VS MARKET',
                  value: `${vsMarketPct >= 0 ? '+' : ''}${Math.round(vsMarketPct)}%`,
                  sub: vsMarketPct < 0 ? 'below market' : 'above market',
                  valueColor: vsMarketPct < 0 ? '#3de88a' : '#e8524a',
                  valueSize: 20,
                },
                {
                  label: 'HOLD RATING',
                  value: card.holdVerdict,
                  sub: `score: ${card.holdScore}/100`,
                  valueColor: holdColor,
                  valueSize: 13,
                },
                {
                  label: 'SALES FOUND',
                  value: String(card.ebayListings.length),
                  sub: `${card.ebayListings.length} eBay USD sold`,
                  valueColor: 'var(--ink)',
                  valueSize: 22,
                },
                {
                  label: '90D RANGE',
                  value: `${fmt(card.priceRange90d.min)}–${fmt(card.priceRange90d.max)}`,
                  sub: 'low — high',
                  valueColor: 'var(--ink)',
                  valueSize: 12,
                },
                {
                  label: 'TREND',
                  value: `${card.trendPct >= 0 ? '+' : ''}${card.trendPct}%`,
                  sub: card.trendLabel,
                  valueColor: card.trendPct >= 0 ? '#3de88a' : '#e8524a',
                  valueSize: 18,
                },
              ].map((cell, i) => (
                <div key={i} style={{ padding: '16px 18px', borderBottom: i < 6 ? '1px solid var(--border)' : 'none', borderRight: i % 2 === 0 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 8 }}>{cell.label}</div>
                  <div className="font-display" style={{ fontSize: cell.valueSize, fontWeight: 700, color: cell.valueColor, lineHeight: 1.1, marginBottom: 4 }}>{cell.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{cell.sub}</div>
                </div>
              ))}
            </div>
            {/* Summary paragraph */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--ink2)', lineHeight: 1.7 }}>
              {summaryText}
            </div>
            {/* Toggle */}
            <button
              onClick={() => setShowFull(v => !v)}
              style={{ width: '100%', padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'transparent', border: 'none', color: 'var(--ink2)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 11 }}>{showFull ? '↑' : '↓'}</span>
              {showFull ? 'Hide full analysis' : 'Show full analysis'}
            </button>
          </div>

          {/* ── Full Analysis ── */}
          {showFull && (
            <>
              {/* Price Verdict card */}
              <div style={{ borderRadius: 14, background: verdict.bg, border: `1px solid ${verdict.border}`, padding: '20px', marginBottom: 12, position: 'relative', overflow: 'hidden' }}>
                <span style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 10 }}>PRICE VERDICT</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: verdict.color, letterSpacing: '-0.5px', marginBottom: 10 }}>{verdict.label}</div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: 280 }}>{summaryText}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                    <div className="font-display" style={{ fontSize: 52, fontWeight: 800, color: verdict.color, letterSpacing: '-2px', lineHeight: 1 }}>
                      {vsMarketPct < 0 ? '' : '+'}{Math.round(vsMarketPct)}%
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4, letterSpacing: 1 }}>
                      {vsMarketPct < 0 ? 'below' : 'above'} market avg
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 metric cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'MARKET AVG', value: fmt(card.marketAvg), sub: 'AUD current', valueColor: 'var(--ink)' },
                  { label: 'YOUR PRICE', value: fmt(userPrice), sub: vsMarketPct < 0 ? `+${fmt(belowMkt).replace('$', '')} below mkt` : `${fmt(Math.abs(belowMkt)).replace('$', '')} above mkt`, valueColor: 'var(--gold)' },
                  { label: `SALES (${analysisWindow})`, value: String(card.ebayListings.length), sub: `${card.ebayListings.length} eBay USD sold, converted to AUD`, valueColor: 'var(--ink)' },
                  { label: 'VOLATILITY', value: `±${card.volatilityPct}%`, sub: card.volatilityLabel, valueColor: card.volatilityPct >= 40 ? '#e8524a' : card.volatilityPct >= 20 ? '#e8c547' : 'var(--ink)' },
                ].map((m, i) => (
                  <div key={i} style={{ borderRadius: 12, padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 8 }}>{m.label}</div>
                    <div className="font-display" style={{ fontSize: 22, fontWeight: 800, color: m.valueColor, letterSpacing: '-0.5px', marginBottom: 4 }}>{m.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink3)', lineHeight: 1.4 }}>{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Price Range */}
              <div style={{ ...S.section }}>
                <div style={{ ...S.sectionPad }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink3)' }}>PRICE RANGE — {analysisWindow}</span>
                    <span style={{ fontSize: 10, color: 'var(--ink3)' }}>Last {analysisWindow === '1M' ? '30' : analysisWindow === '3M' ? '90' : '180'} days</span>
                  </div>
                  <div style={{ position: 'relative', marginBottom: 32 }}>
                    {/* Bar */}
                    <div style={{ height: 6, borderRadius: 3, background: 'linear-gradient(to right, rgba(232,197,71,0.45), rgba(61,232,138,0.55))', position: 'relative' }}>
                      {/* Price dot */}
                      <div style={{ position: 'absolute', left: `${priceBarPos}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 14, height: 14, borderRadius: '50%', background: '#e8c547', border: '2px solid var(--bg)', boxShadow: '0 0 8px rgba(232,197,71,0.5)', zIndex: 2 }} />
                    </div>
                    {/* Your price label below dot */}
                    <div style={{ position: 'absolute', top: 14, left: `${priceBarPos}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 10, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ color: '#e8c547', fontSize: 12 }}>•</span> Your price
                    </div>
                    {/* Low / High labels */}
                    <div style={{ position: 'absolute', top: 14, left: 0, fontSize: 10, color: 'var(--ink2)' }}>Low: {fmt(card.priceRange90d.min)}</div>
                    <div style={{ position: 'absolute', top: 14, right: 0, fontSize: 10, color: 'var(--ink2)' }}>High: {fmt(card.priceRange90d.max)}</div>
                  </div>
                </div>
              </div>

              {/* Price Trend */}
              <div style={{ ...S.section }}>
                <div style={{ ...S.sectionPad }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink3)' }}>PRICE TREND — {analysisWindow}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: chartColor }}>{card.trendPct >= 0 ? '+' : ''}{card.trendPct}%</div>
                      <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{card.trendLabel} trend</div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fill: '#55556a', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<SparkTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
                      <Line type="monotone" dataKey="price" stroke={chartColor} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: chartColor, stroke: 'var(--surface)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Liquidity Rate */}
              <div style={{ ...S.section }}>
                <div style={{ ...S.sectionPad }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink3)' }}>LIQUIDITY RATE</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="font-display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{card.liquidityScore}</span>
                      <span style={{ fontSize: 12, color: 'var(--ink3)' }}>/100</span>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(232,197,71,0.12)', border: '1px solid rgba(232,197,71,0.2)', color: 'var(--gold)' }}>{card.liquidityLabel}</span>
                    </div>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginBottom: 12, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${card.liquidityScore}%`, background: 'var(--gold)', borderRadius: 2 }} />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>{card.liquidityDesc}</p>
                </div>
              </div>

              {/* eBay Sold Listings */}
              <div style={{ ...S.section }}>
                <div style={{ ...S.sectionPad }}>
                  <span style={{ ...S.label }}>EBAY SOLD LISTINGS USED</span>
                  {card.ebayListings.map((listing, i) => (
                    <div key={i} style={{ paddingTop: 14, paddingBottom: 14, borderBottom: i < card.ebayListings.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 4 }}>{listing.title}</p>
                        <p style={{ fontSize: 11, color: 'var(--ink3)' }}>{listing.date}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {listing.badge && (
                          <div style={{ fontSize: 9, letterSpacing: 1.5, padding: '2px 6px', borderRadius: 4, background: listing.badge === 'HIGH' ? 'rgba(232,82,74,0.12)' : 'rgba(61,232,138,0.12)', color: listing.badge === 'HIGH' ? '#e8524a' : '#3de88a', border: `1px solid ${listing.badge === 'HIGH' ? 'rgba(232,82,74,0.2)' : 'rgba(61,232,138,0.2)'}`, marginBottom: 4, display: 'inline-block' }}>{listing.badge}</div>
                        )}
                        <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{fmt(listing.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insights */}
              <div style={{ ...S.section }}>
                <div style={{ ...S.sectionPad }}>
                  <span style={{ ...S.label }}>AI INSIGHTS</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {card.aiInsights.map((insight, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ color: '#3de88a', fontSize: 14, flexShrink: 0, marginTop: 1 }}>•</span>
                        <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.65 }}>{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Hold Analysis */}
              <div style={{ ...S.section }}>
                <div style={{ ...S.sectionPad }}>
                  <span style={{ ...S.label }}>HOLD ANALYSIS</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div className="font-display" style={{ fontSize: 22, fontWeight: 800, color: holdColor, letterSpacing: '-0.5px', marginBottom: 8 }}>{card.holdVerdict}</div>
                      <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.65, maxWidth: 280 }}>{card.holdDescription}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                      <div className="font-display" style={{ fontSize: 44, fontWeight: 800, color: holdColor, letterSpacing: '-2px', lineHeight: 1 }}>{card.holdScore}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>hold score / 100</div>
                    </div>
                  </div>

                  {/* Hold metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, margin: '16px 0' }}>
                    {[
                      { label: 'MONTHLY GROWTH', value: `${card.monthlyGrowth >= 0 ? '+' : ''}${card.monthlyGrowth}%`, sub: 'avg per month', color: card.monthlyGrowth >= 0 ? '#3de88a' : '#e8524a' },
                      { label: 'PROJECTED (12MO)', value: fmt(card.projections.m12.price), sub: `+${card.projections.m12.pct}% projected`, color: 'var(--green)' },
                      { label: 'BREAK-EVEN', value: breakevenDisplay.label, sub: breakevenDisplay.sub, color: vsMarketPct < 0 ? '#3de88a' : 'var(--ink)' },
                    ].map((m, i) => (
                      <div key={i} style={{ borderRadius: 10, padding: '12px 10px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 8, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 6 }}>{m.label}</div>
                        <div className="font-display" style={{ fontSize: 13, fontWeight: 700, color: m.color, marginBottom: 3, lineHeight: 1.2 }}>{m.value}</div>
                        <div style={{ fontSize: 9, color: 'var(--ink3)', lineHeight: 1.4 }}>{m.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Hold factors */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    {card.holdFactors.map((factor, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(61,232,138,0.12)', border: '1px solid rgba(61,232,138,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: '#3de88a', fontWeight: 700 }}>↑</span>
                        </div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{factor.title}</p>
                          <p style={{ fontSize: 11, color: 'var(--ink2)', lineHeight: 1.6 }}>{factor.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Projection timeline */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { label: '3 MONTHS', price: card.projections.m3.price, pct: card.projections.m3.pct },
                      { label: '6 MONTHS', price: card.projections.m6.price, pct: card.projections.m6.pct },
                      { label: '12 MONTHS', price: card.projections.m12.price, pct: card.projections.m12.pct },
                    ].map((proj, i) => (
                      <div key={i} style={{ borderRadius: 10, padding: '14px 10px', background: 'rgba(61,232,138,0.04)', border: '1px solid rgba(61,232,138,0.1)' }}>
                        <div style={{ fontSize: 8, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>{proj.label}</div>
                        <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: proj.pct >= 0 ? '#3de88a' : '#e8524a', marginBottom: 4 }}>{fmt(proj.price)}</div>
                        <div style={{ fontSize: 10, color: proj.pct >= 0 ? '#3de88a' : '#e8524a' }}>
                          {proj.pct >= 0 ? '+' : ''}{proj.pct}% · {proj.pct >= 0 ? '+' : ''}{proj.pct}% to {fmt(proj.price)} AUD
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  )
}
