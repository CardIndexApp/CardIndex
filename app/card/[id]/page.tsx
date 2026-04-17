'use client'
import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Navbar from '@/components/Navbar'
import { getCard, fmt, scoreColor } from '@/lib/data'

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

const SparkTooltip = ({ active, payload }: { active?: boolean; payload?: { value: number }[] }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: '#181828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px' }}>
        <span className="font-num" style={{ fontSize: 12, color: '#f0f0f8' }}>{fmt(payload[0].value)}</span>
      </div>
    )
  }
  return null
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', fontWeight: 600 }}>{label}</span>
        <span className="font-num" style={{ fontSize: 11, color, fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 2 }} />
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

export default function CardPage() {
  const { id } = useParams<{ id: string }>()
  const card = getCard(id)

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
  const [showAnalysis, setShowAnalysis] = useState(false)

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

  // API card fallback
  if (!card) {
    const displayName = apiCard?.name ?? '...'
    const displaySet = apiCard ? `${apiCard.set} · #${apiCard.number}` : 'Loading...'
    return (
      <>
        <style>{PAGE_STYLES}</style>
        <Navbar />
        <main style={{ paddingTop: 88, paddingBottom: 80, minHeight: '100vh' }}>
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
              <p className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Full analysis coming soon</p>
              <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
                This card isn&apos;t in our analysis database yet. We&apos;re continually adding cards — check back soon.
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
  const mainScoreColor = scoreColor(card.score)

  const rangeWidth = card.priceRange90d.max - card.priceRange90d.min
  const priceBarPos = Math.max(0, Math.min(100, (userPrice - card.priceRange90d.min) / rangeWidth * 100))

  const windowPoints = analysisWindow === '1M' ? 2 : analysisWindow === '3M' ? 3 : 6
  const chartData = card.history.slice(-windowPoints)
  const chartColor = card.trendPct >= 0 ? '#3de88a' : '#e8524a'

  const windowLabel = analysisWindow === '1M' ? 'last 30 days' : analysisWindow === '3M' ? 'last 90 days' : 'last 180 days'
  const summaryText = `Based on eBay sold data from the ${windowLabel}, PSA ${selectedGrade === 'RAW' ? 'ungraded' : selectedGrade} copies sold between ${fmt(card.priceRange90d.min)} and ${fmt(card.priceRange90d.max)}. Your price of ${fmt(userPrice)} is approximately ${Math.abs(Math.round(vsMarketPct))}% ${vsMarketPct < 0 ? 'below' : 'above'} the market average of ${fmt(card.marketAvg)}${vsMarketPct <= -20 ? ', representing a strong buying opportunity if authentic' : ''}.`

  const breakevenDisplay = vsMarketPct < 0
    ? { label: `Already ${Math.abs(Math.round(vsMarketPct))}% below market`, sub: 'at / below market' }
    : card.monthlyGrowth > 0
      ? { label: `~${Math.ceil(Math.log(userPrice / card.marketAvg) / Math.log(1 + card.monthlyGrowth / 100))}mo`, sub: `at +${card.monthlyGrowth}%/mo growth` }
      : { label: 'N/A', sub: 'negative growth trend' }

  const C = { borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 10 }
  const P = { padding: '18px 20px' }
  const L: React.CSSProperties = { fontSize: 10, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 12, display: 'block' }

  return (
    <>
      <style>{PAGE_STYLES}</style>
      <Navbar />
      <main className="ci-main" style={{ paddingTop: 88, paddingBottom: 100, minHeight: '100vh' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px' }}>

          {/* ── Card Header (with controls) ── */}
          <div style={{ ...C, marginTop: 24 }} className="ci-card-surface">
            <div style={{ ...P }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                  <div style={{ width: 88, height: 122, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {card.imageUrl && !imgError ? (
                      <img src={card.imageUrl} alt={card.name} onError={() => setImgError(true)} style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: 40 }}>{card.emoji}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="font-mono-custom" style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 6 }}>CARDINDEX — CARD MARKET INTELLIGENCE</p>
                    <h1 className="font-display" style={{ fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 4, lineHeight: 1.1 }}>{card.name}</h1>
                    <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 12 }}>{card.set} · #{card.cardNumber}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {card.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink2)', letterSpacing: 0.3 }}>{tag}</span>
                      ))}
                    </div>
                    <Link href="/market" style={{ fontSize: 12, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 14 }}>← Change card</Link>
                  </div>
                </div>
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
                  <div className="font-num" style={{ fontSize: 64, fontWeight: 800, color: mainScoreColor, letterSpacing: '-3px', lineHeight: 1 }}>{card.score}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>/ 100</div>
                  <div style={{ marginTop: 10, width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${card.score}%`, background: mainScoreColor, borderRadius: 2 }} />
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
                    { label: 'MARKET AVG',   value: fmt(card.marketAvg),                                                                      sub: `${card.ebayListings.length} eBay sold`,                                                                        valueColor: 'var(--ink)',                                               valueSize: 22 },
                    { label: 'YOUR PRICE',   value: fmt(userPrice),                                                                           sub: vsMarketPct < 0 ? `+${fmt(belowMkt).replace('$','')} below` : `${fmt(Math.abs(belowMkt)).replace('$','')} above`, valueColor: 'var(--gold)',                                              valueSize: 22 },
                    { label: 'VS MARKET',    value: `${vsMarketPct >= 0 ? '+' : ''}${Math.round(vsMarketPct)}%`,                              sub: vsMarketPct < 0 ? 'below market' : 'above market',                                                             valueColor: vsMarketPct < 0 ? '#3de88a' : '#e8524a',                   valueSize: 24 },
                    { label: 'HOLD RATING',  value: card.holdVerdict,                                                                         sub: `score: ${card.holdScore}/100`,                                                                                 valueColor: holdColor,                                                  valueSize: 14 },
                    { label: 'SALES FOUND',  value: String(card.ebayListings.length),                                                         sub: `${card.ebayListings.length} eBay sold`,                                                                        valueColor: 'var(--ink)',                                               valueSize: 26 },
                    { label: 'PRICE RANGE',  value: `${fmt(card.priceRange90d.min)}–${fmt(card.priceRange90d.max)}`,                          sub: 'low — high',                                                                                                   valueColor: 'var(--ink)',                                               valueSize: 13 },
                    { label: 'TREND',        value: `${card.trendPct >= 0 ? '+' : ''}${card.trendPct}%`,                                     sub: card.trendLabel,                                                                                                valueColor: card.trendPct >= 0 ? '#3de88a' : '#e8524a',                valueSize: 22 },
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
                  { label: 'MARKET AVG',       value: fmt(card.marketAvg),           sub: 'current',                                                                                                          valueColor: 'var(--ink)' },
                  { label: 'YOUR PRICE',        value: fmt(userPrice),                sub: vsMarketPct < 0 ? `+${fmt(belowMkt).replace('$','')} below mkt` : `${fmt(Math.abs(belowMkt)).replace('$','')} above mkt`, valueColor: 'var(--gold)' },
                  { label: `SALES (${analysisWindow})`, value: String(card.ebayListings.length), sub: `${card.ebayListings.length} eBay sold`, valueColor: 'var(--ink)' },
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
                      <div style={{ position: 'absolute', top: 14, left: 0, fontSize: 10, color: 'var(--ink2)' }}>Low: {fmt(card.priceRange90d.min)}</div>
                      <div style={{ position: 'absolute', top: 14, right: 0, fontSize: 10, color: 'var(--ink2)' }}>High: {fmt(card.priceRange90d.max)}</div>
                    </div>
                  </div>
                </div>
                <div style={{ ...C, marginBottom: 0 }} className="ci-card-surface">
                  <div style={{ ...P }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--ink3)' }}>PRICE TREND — {analysisWindow}</span>
                      <div style={{ textAlign: 'right' }}>
                        <div className="font-num" style={{ fontSize: 18, fontWeight: 700, color: chartColor }}>{card.trendPct >= 0 ? '+' : ''}{card.trendPct}%</div>
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
                  {card.ebayListings.map((listing, i) => (
                    <div key={i} style={{ paddingTop: 14, paddingBottom: 14, borderBottom: i < card.ebayListings.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 4 }}>{listing.title}</p>
                        <p style={{ fontSize: 11, color: 'var(--ink3)' }}>{listing.date}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {listing.badge && (
                          <div style={{ fontSize: 9, letterSpacing: 1.5, padding: '2px 7px', borderRadius: 4, background: listing.badge === 'HIGH' ? 'rgba(232,82,74,0.1)' : 'rgba(61,232,138,0.1)', color: listing.badge === 'HIGH' ? '#e8524a' : '#3de88a', border: `1px solid ${listing.badge === 'HIGH' ? 'rgba(232,82,74,0.2)' : 'rgba(61,232,138,0.2)'}`, marginBottom: 5, display: 'inline-block' }}>{listing.badge}</div>
                        )}
                        <div className="font-num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{fmt(listing.price)}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--ink3)' }}>
                    {card.ebayListings.length} sales · Avg: {fmt(card.marketAvg)} · Range: {fmt(card.priceRange90d.min)}–{fmt(card.priceRange90d.max)}
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

              {/* Hold Analysis */}
              <div style={{ ...C }} className="ci-card-surface">
                <div style={{ ...P }}>
                  <span style={{ ...L }}>HOLD ANALYSIS</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 200, paddingRight: 16 }}>
                      <div className="font-display" style={{ fontSize: 'clamp(20px, 4vw, 26px)', fontWeight: 800, color: holdColor, letterSpacing: '-0.5px', marginBottom: 10 }}>{card.holdVerdict}</div>
                      <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.65 }}>{card.holdDescription}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="font-num" style={{ fontSize: 52, fontWeight: 800, color: holdColor, letterSpacing: '-3px', lineHeight: 1 }}>{card.holdScore}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>hold score / 100</div>
                    </div>
                  </div>

                  <div className="ci-hold-metrics">
                    {[
                      { label: 'MONTHLY GROWTH', value: `${card.monthlyGrowth >= 0 ? '+' : ''}${card.monthlyGrowth}%`, sub: 'avg/month', color: card.monthlyGrowth >= 0 ? '#3de88a' : '#e8524a' },
                      { label: 'PROJ. 12MO', value: fmt(card.projections.m12.price), sub: `+${card.projections.m12.pct}% projected`, color: '#3de88a' },
                      { label: 'BREAK-EVEN', value: breakevenDisplay.label, sub: breakevenDisplay.sub, color: vsMarketPct < 0 ? '#3de88a' : 'var(--ink)' },
                    ].map((m, i) => (
                      <div key={i} style={{ borderRadius: 10, padding: '14px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 8, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>{m.label}</div>
                        <div className="font-num" style={{ fontSize: 15, fontWeight: 700, color: m.color, marginBottom: 4, lineHeight: 1.2 }}>{m.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink3)', lineHeight: 1.4 }}>{m.sub}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {card.holdFactors.map((factor, i) => {
                      const isDown = factor.title.startsWith('↓')
                      const isNeutral = factor.title.startsWith('→')
                      const arrowColor = isDown ? '#e8524a' : isNeutral ? '#e8c547' : '#3de88a'
                      const arrowBg = isDown ? 'rgba(232,82,74,0.1)' : isNeutral ? 'rgba(232,197,71,0.1)' : 'rgba(61,232,138,0.1)'
                      const arrowBorder = isDown ? 'rgba(232,82,74,0.2)' : isNeutral ? 'rgba(232,197,71,0.2)' : 'rgba(61,232,138,0.2)'
                      const arrow = isDown ? '↓' : isNeutral ? '→' : '↑'
                      return (
                        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: arrowBg, border: `1px solid ${arrowBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 11, color: arrowColor, fontWeight: 700 }}>{arrow}</span>
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{factor.title.replace(/^[↑↓→]\s*/, '')}</p>
                            <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>{factor.description}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="ci-proj">
                    {[
                      { label: '3 MONTHS',  price: card.projections.m3.price,  pct: card.projections.m3.pct,  desc: `+${card.projections.m3.pct}% as supply stabilises` },
                      { label: '6 MONTHS',  price: card.projections.m6.price,  pct: card.projections.m6.pct,  desc: `+${card.projections.m6.pct}% post-launch appreciation` },
                      { label: '12 MONTHS', price: card.projections.m12.price, pct: card.projections.m12.pct, desc: `+${card.projections.m12.pct}% flagship card premium` },
                    ].map((proj, i) => (
                      <div key={i} style={{ borderRadius: 10, padding: '16px 14px', background: 'rgba(61,232,138,0.04)', border: '1px solid rgba(61,232,138,0.1)' }}>
                        <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 10 }}>{proj.label}</div>
                        <div className="font-num" style={{ fontSize: 18, fontWeight: 700, color: proj.pct >= 0 ? '#3de88a' : '#e8524a', marginBottom: 4 }}>{fmt(proj.price)}</div>
                        <div style={{ fontSize: 10, color: proj.pct >= 0 ? '#3de88a' : '#e8524a', marginBottom: 4 }}>{proj.pct >= 0 ? '+' : ''}{proj.pct}%</div>
                        <div style={{ fontSize: 10, color: 'var(--ink3)', lineHeight: 1.4 }}>{proj.desc}</div>
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
