'use client'

/**
 * ShareCardModal — renders the exact 03-single-card.html template with live data,
 * then captures it via html2canvas for download.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export interface ShareCardData {
  cardName:      string
  setName:       string
  grade:         string
  score:         number
  scoreLabel:    string
  price:         number
  priceDisplay:  string
  change:        number
  imageUrl:      string
  trend?:        number
  liquidity?:    number
  consistency?:  number
  value?:        number
  avg1d?:        number
  avg7d?:        number
  avg30d?:       number
  salesCount30d?:  number
  liquidityLabel?: string
  priceRangeLow?:  number
  priceRangeHigh?: number
  psa10price?:   number
  psa9price?:    number
  psa8price?:    number
  proj30d?:      number
  proj60d?:      number
  proj90d?:      number
  fmtFn?:        (n: number) => string
  currency?:     string
}

function scoreColor(s: number) {
  return s >= 70 ? '#3cb87a' : s >= 50 ? '#d7aa3c' : '#e05252'
}
function changeColor(c: number) { return c >= 0 ? '#3cb87a' : '#e05252' }

type Variant = 'moving-avg' | 'score-radar'

function buildHtml(d: ShareCardData, variant: Variant = 'moving-avg'): string {
  const fmt = d.fmtFn ?? ((n: number) => `$${n.toFixed(2)}`)

  const trend       = Math.round(d.trend       ?? 0)
  const liquidity   = Math.round(d.liquidity   ?? 0)
  const consistency = Math.round(d.consistency ?? 0)
  const value       = Math.round(d.value       ?? 0)

  const isBullish = (d.avg7d ?? d.price) >= (d.avg30d ?? d.price)

  const pricePos = (() => {
    if (!d.priceRangeLow || !d.priceRangeHigh) return '—'
    const pos = (d.price - d.priceRangeLow) / (d.priceRangeHigh - d.priceRangeLow)
    return pos < 0.33 ? 'Near low' : pos > 0.66 ? 'Near high' : 'Near midpoint'
  })()

  const changeStr = `${d.change >= 0 ? '+' : ''}${d.change.toFixed(1)}% 30d`
  const avgStr = [
    d.avg7d  ? `7D ${fmt(d.avg7d)}`  : '',
    d.avg30d ? `30D ${fmt(d.avg30d)}` : '',
  ].filter(Boolean).join(' · ')

  // Multi-line card name (split on &)
  const nameParts = d.cardName.split('&').map(p => p.trim())
  const nameHtml  = nameParts.length > 1
    ? nameParts.map((p, i) => `${p}${i < nameParts.length - 1 ? ' &' : ''}`).join('<br>')
    : d.cardName

  function barHtml(label: string, val: number) {
    const col = scoreColor(val)
    const valColor = col
    return `
      <div class="sb-row">
        <div class="sb-label">${label}</div>
        <div class="sb-bar-bg"><div class="sb-fill" style="width:${val}%;background:${col}"></div></div>
        <div class="sb-val" style="color:${valColor}">${val}</div>
      </div>`
  }

  function badgeHtml(label: string, value: string, colClass: string) {
    return `
      <div class="badge">
        <div class="badge-label">${label}</div>
        <div class="badge-value ${colClass}">${value}</div>
      </div>`
  }

  function radarSvgHtml(): string {
    // cx/cy sit inside a viewBox with generous label padding on all sides
    // viewBox: x=-44 y=-26 w=288 h=252  →  44px left, 26px top, 44px right, 26px bottom
    const cx = 100, cy = 100, r = 80
    const tY  = cy - r * trend / 100
    const lX  = cx + r * liquidity / 100
    const csY = cy + r * consistency / 100
    const vX  = cx - r * value / 100
    const dataPoints = `${cx},${tY} ${lX},${cy} ${cx},${csY} ${vX},${cy}`
    function grid(pct: number) {
      const gr = r * pct
      return `${cx},${cy - gr} ${cx + gr},${cy} ${cx},${cy + gr} ${cx - gr},${cy}`
    }
    return `<svg viewBox="-44 -26 288 252" style="width:100%;height:100%;overflow:visible">
      <polygon points="${grid(0.25)}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <polygon points="${grid(0.50)}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <polygon points="${grid(0.75)}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <polygon points="${grid(1.00)}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
      <line x1="${cx}" y1="${cy}" x2="${cx}"     y2="${cy-r}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
      <line x1="${cx}" y1="${cy}" x2="${cx+r}"   y2="${cy}"   stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
      <line x1="${cx}" y1="${cy}" x2="${cx}"     y2="${cy+r}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
      <line x1="${cx}" y1="${cy}" x2="${cx-r}"   y2="${cy}"   stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
      <polygon points="${dataPoints}" fill="rgba(215,170,60,0.15)" stroke="#d7aa3c" stroke-width="1.5"/>
      <circle cx="${cx}"  cy="${tY}"  r="4" fill="#d7aa3c"/>
      <circle cx="${lX}"  cy="${cy}"  r="4" fill="#d7aa3c"/>
      <circle cx="${cx}"  cy="${csY}" r="4" fill="#d7aa3c"/>
      <circle cx="${vX}"  cy="${cy}"  r="4" fill="#d7aa3c"/>
      <text x="${cx}"      y="${cy-r-14}"  text-anchor="middle" font-size="13" font-weight="600" fill="rgba(255,255,255,0.45)" font-family="Helvetica Neue,Helvetica,Arial,sans-serif">Trend</text>
      <text x="${cx+r+12}" y="${cy+5}"    text-anchor="start"  font-size="13" font-weight="600" fill="rgba(255,255,255,0.45)" font-family="Helvetica Neue,Helvetica,Arial,sans-serif">Liquidity</text>
      <text x="${cx}"      y="${cy+r+20}" text-anchor="middle" font-size="13" font-weight="600" fill="rgba(255,255,255,0.45)" font-family="Helvetica Neue,Helvetica,Arial,sans-serif">Consistency</text>
      <text x="${cx-r-12}" y="${cy+5}"    text-anchor="end"    font-size="13" font-weight="600" fill="rgba(255,255,255,0.45)" font-family="Helvetica Neue,Helvetica,Arial,sans-serif">Value</text>
    </svg>`
  }

  function projHtml(label: string, price: number | undefined) {
    if (!price) return `
      <div class="proj-col">
        <div class="proj-label">${label}</div>
        <div class="proj-price">—</div>
        <div class="proj-delta"></div>
      </div>`
    const pct = d.price > 0 ? ((price - d.price) / d.price * 100) : 0
    const up  = pct >= 0
    return `
      <div class="proj-col${up ? ' up' : ''}">
        <div class="proj-label">${label}</div>
        <div class="proj-price">${fmt(price)}</div>
        <div class="proj-delta">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</div>
      </div>`
  }

  const scoreCol = scoreColor(d.score)

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1080px; height:1350px; background:#0b0c0e; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; overflow:hidden; display:flex; flex-direction:column; position:relative; }
  .grid { position:absolute; inset:0; pointer-events:none; background-image:linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px); background-size:54px 54px; }
  .glow { position:absolute; left:50%; top:22%; transform:translate(-50%,-50%); width:860px; height:560px; background:radial-gradient(ellipse,rgba(215,170,60,0.07) 0%,transparent 62%); pointer-events:none; }
  .topbar { position:relative; z-index:10; height:86px; flex-shrink:0; display:flex; align-items:center; justify-content:center; padding:0 56px; border-bottom:1px solid rgba(255,255,255,0.07); }
  .logo-wordmark { display:flex; align-items:center; }
  .logo-wordmark span.card { font-size:34px; font-weight:700; color:#ffffff; letter-spacing:-0.5px; }
  .logo-wordmark span.index { font-size:34px; font-weight:700; color:#d7aa3c; letter-spacing:-0.5px; }
  .currency-code { position:absolute; right:56px; font-size:11px; font-weight:700; color:rgba(255,255,255,0.3); letter-spacing:0.1em; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:5px 8px; }
  .top-section { position:relative; z-index:2; padding:32px 56px 0; flex-shrink:0; display:flex; gap:44px; align-items:flex-start; }
  .card-thumb { width:280px; aspect-ratio:63/88; flex-shrink:0; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; position:relative; overflow:hidden; }
  .card-thumb img { width:100%; height:100%; object-fit:cover; border-radius:inherit; display:block; }
  .card-thumb::before { content:""; position:absolute; inset:0; background:radial-gradient(ellipse at 50% 30%,rgba(215,170,60,0.05) 0%,transparent 60%); }
  .card-identity { flex:1; padding-top:4px; min-width:0; }
  .grade-chip { display:inline-block; background:rgba(215,170,60,0.08); border:1px solid rgba(215,170,60,0.18); border-radius:4px; padding:6px 15px; font-size:17px; font-weight:700; color:rgba(215,170,60,0.85); letter-spacing:0.08em; margin-bottom:11px; }
  .ci-set { font-size:18px; font-weight:600; color:rgba(255,255,255,0.32); letter-spacing:0.06em; text-transform:uppercase; margin-bottom:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ci-name { font-size:52px; font-weight:700; color:#fff; letter-spacing:-1.5px; line-height:1.05; margin-bottom:20px; }
  .price-big { font-size:66px; font-weight:700; color:#fff; letter-spacing:-2.5px; line-height:1; margin-bottom:13px; }
  .price-meta { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
  .price-change { font-size:26px; font-weight:600; }
  .price-avgs { font-size:19px; font-weight:400; color:rgba(255,255,255,0.28); }
  .score-row { position:relative; z-index:2; margin:16px 56px 0; flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:26px 28px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:12px; }
  .score-left { flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:8px; }
  .score-label { font-size:16px; font-weight:600; color:rgba(255,255,255,0.24); letter-spacing:0.12em; text-transform:uppercase; }
  .score-circle { width:124px; height:124px; border-radius:50%; border:3px solid ${scoreCol}; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .score-num { font-size:54px; font-weight:700; color:${scoreCol}; letter-spacing:-2px; line-height:1; }
  .score-sub { font-size:14px; font-weight:600; color:${scoreCol}; opacity:0.6; letter-spacing:0.1em; text-transform:uppercase; margin-top:3px; }
  .score-bars { flex:1; padding-left:40px; }
  .score-radar { flex:1; padding-left:28px; height:180px; display:flex; align-items:center; }
  .sb-row { display:flex; align-items:center; gap:14px; margin-bottom:16px; }
  .sb-row:last-child { margin-bottom:0; }
  .sb-label { font-size:20px; font-weight:600; color:rgba(255,255,255,0.55); width:150px; flex-shrink:0; }
  .sb-bar-bg { flex:1; height:8px; background:rgba(255,255,255,0.07); border-radius:4px; overflow:hidden; }
  .sb-fill { height:100%; border-radius:4px; }
  .sb-val { font-size:22px; font-weight:700; width:44px; text-align:right; flex-shrink:0; }
  .badges-grid { position:relative; z-index:2; display:grid; grid-template-columns:repeat(3,1fr); gap:12px; padding:14px 56px 0; flex-shrink:0; }
  .badge { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:24px 24px; }
  .badge-label { font-size:15px; font-weight:600; color:rgba(255,255,255,0.24); letter-spacing:0.08em; text-transform:uppercase; margin-bottom:10px; }
  .badge-value { font-size:30px; font-weight:700; color:#fff; letter-spacing:-0.3px; }
  .badge-value.green { color:#3cb87a; }
  .badge-value.amber { color:#d7aa3c; }
  .badge-value.sm { font-size:23px; color:rgba(255,255,255,0.45); }
  .signal-section { position:relative; z-index:2; margin:14px 56px 0; flex-shrink:0; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:24px 26px; }
  .ss-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
  .ss-title { font-size:16px; font-weight:600; color:rgba(255,255,255,0.24); letter-spacing:0.1em; text-transform:uppercase; }
  .ss-badge { border-radius:5px; padding:8px 20px; font-size:16px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; }
  .ss-badge.bullish { background:rgba(60,184,122,0.1); border:1px solid rgba(60,184,122,0.22); color:#3cb87a; }
  .ss-badge.bearish { background:rgba(229,82,82,0.1); border:1px solid rgba(229,82,82,0.22); color:#e05252; }
  .ss-avgs { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
  .ss-avg { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:17px 18px; }
  .ss-avg-label { font-size:14px; font-weight:600; color:rgba(255,255,255,0.24); letter-spacing:0.08em; text-transform:uppercase; margin-bottom:9px; }
  .ss-avg-val { font-size:26px; font-weight:700; color:#fff; letter-spacing:-0.3px; }
  .ss-avg-val.amber { color:#d7aa3c; }
  .projected-section { position:relative; z-index:2; margin:14px 56px 0; flex-shrink:0; background:rgba(215,170,60,0.04); border:1px solid rgba(215,170,60,0.16); border-radius:12px; padding:24px 26px; }
  .proj-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
  .proj-title { font-size:16px; font-weight:600; color:rgba(215,170,60,0.6); letter-spacing:0.12em; text-transform:uppercase; }
  .proj-basis { font-size:14px; font-weight:500; color:rgba(255,255,255,0.22); letter-spacing:0.04em; text-transform:uppercase; }
  .proj-cols { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
  .proj-col { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:20px; display:flex; flex-direction:column; gap:7px; }
  .proj-col.up { background:rgba(60,184,122,0.06); border-color:rgba(60,184,122,0.18); }
  .proj-label { font-size:14px; font-weight:600; color:rgba(255,255,255,0.28); letter-spacing:0.08em; text-transform:uppercase; }
  .proj-price { font-size:33px; font-weight:700; color:#fff; letter-spacing:-0.6px; margin-top:2px; }
  .proj-col.up .proj-price { color:#3cb87a; }
  .proj-delta { font-size:19px; font-weight:600; color:rgba(255,255,255,0.3); }
  .proj-col.up .proj-delta { color:rgba(60,184,122,0.7); }
  .spacer { flex:1; min-height:20px; }
</style></head><body>
<div class="grid"></div><div class="glow"></div>
<div class="topbar">
  <div class="logo-wordmark"><span class="card">Card</span><span class="index">Index</span></div>
  ${d.currency ? `<div class="currency-code">${d.currency}</div>` : ''}
</div>
<div class="top-section">
  <div class="card-thumb">
    ${d.imageUrl ? `<img src="${d.imageUrl}" crossorigin="anonymous" alt="${d.cardName}">` : '<span style="font-size:40px">🃏</span>'}
  </div>
  <div class="card-identity">
    <div class="grade-chip">${d.grade}</div>
    <div class="ci-set">${d.setName}</div>
    <div class="ci-name">${nameHtml}</div>
    <div class="price-big">${d.priceDisplay}</div>
    <div class="price-meta">
      <div class="price-change" style="color:${changeColor(d.change)}">${changeStr}</div>
      ${avgStr ? `<div class="price-avgs">${avgStr}</div>` : ''}
    </div>
  </div>
</div>
<div class="score-row">
  <div class="score-left">
    <div class="score-label">Score</div>
    <div class="score-circle">
      <div class="score-num">${Math.round(d.score)}</div>
      <div class="score-sub">${d.scoreLabel}</div>
    </div>
  </div>
  <div class="score-bars">
    ${barHtml('Trend', trend)}
    ${barHtml('Liquidity', liquidity)}
    ${barHtml('Consistency', consistency)}
    ${barHtml('Value', value)}
  </div>
</div>
<div class="badges-grid">
  ${badgeHtml('Liquidity',      d.liquidityLabel ?? '—',                         d.liquidityLabel ? 'green' : '')}
  ${badgeHtml('30D Sales',      d.salesCount30d ? String(d.salesCount30d) : '—', 'amber')}
  ${badgeHtml('Price Position', pricePos,                                         'sm')}
</div>
${variant === 'score-radar' ? radarSectionHtml() : `
<div class="signal-section">
  <div class="ss-header">
    <div class="ss-title">Moving Average Signal</div>
    <div class="ss-badge ${isBullish ? 'bullish' : 'bearish'}">${isBullish ? '▲ Bullish' : '▼ Bearish'}</div>
  </div>
  <div class="ss-avgs">
    <div class="ss-avg"><div class="ss-avg-label">Current</div><div class="ss-avg-val amber">${d.priceDisplay}</div></div>
    <div class="ss-avg"><div class="ss-avg-label">1D Avg</div><div class="ss-avg-val">${d.avg1d ? fmt(d.avg1d) : '—'}</div></div>
    <div class="ss-avg"><div class="ss-avg-label">7D Avg</div><div class="ss-avg-val">${d.avg7d ? fmt(d.avg7d) : '—'}</div></div>
    <div class="ss-avg"><div class="ss-avg-label">30D Avg</div><div class="ss-avg-val">${d.avg30d ? fmt(d.avg30d) : '—'}</div></div>
  </div>
</div>`}
<div class="projected-section">
  <div class="proj-header">
    <div class="proj-title">Projected Price</div>
    <div class="proj-basis">Based on 30D trend · ${d.grade}</div>
  </div>
  <div class="proj-cols">
    ${projHtml('30D Forecast', d.proj30d)}
    ${projHtml('60D Forecast', d.proj60d)}
    ${projHtml('90D Forecast', d.proj90d)}
  </div>
</div>
<div class="spacer"></div>
</body></html>`
}

export default function ShareCardModal({
  data,
  onClose,
}: {
  data:    ShareCardData
  onClose: () => void
}) {
  const [variant, setVariant] = useState<Variant>('moving-avg')
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const generate = useCallback(async () => {
    setGenerating(true)
    setPreviewUrl(null)
    try {
      const html2canvas = (await import('html2canvas')).default

      // Create an off-screen container sized exactly to the template
      const wrap = document.createElement('div')
      wrap.style.cssText = [
        'position:fixed',
        'left:-9999px',
        'top:0',
        'width:1080px',
        'height:1350px',
        'overflow:hidden',
        'pointer-events:none',
        'z-index:-1',
      ].join(';')
      wrap.innerHTML = buildHtml(data, variant)
      document.body.appendChild(wrap)

      // Wait for images to load
      const imgs = Array.from(wrap.querySelectorAll('img'))
      await Promise.allSettled(imgs.map(img =>
        img.complete ? Promise.resolve() : new Promise(r => {
          img.onload = r; img.onerror = r
        })
      ))

      const canvas = await html2canvas(wrap, {
        width:  1080,
        height: 1350,
        scale:  2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#0b0c0e',
        logging: false,
      })

      document.body.removeChild(wrap)
      setPreviewUrl(canvas.toDataURL('image/png', 1.0))
    } catch (e) {
      console.error('ShareCard generation failed:', e)
    } finally {
      setGenerating(false)
    }
  }, [data, variant])

  useEffect(() => { generate() }, [generate])

  function download() {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href     = previewUrl
    a.download = `cardindex-${data.cardName.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
      />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, pointerEvents: 'none',
      }}>
        <div ref={containerRef} style={{
          pointerEvents: 'auto',
          background: '#0e0e1c', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 24, width: '100%', maxWidth: 500,
          maxHeight: '92vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f8' }}>Share Card</div>
              <div style={{ fontSize: 11, color: '#55556a', marginTop: 3 }}>{data.cardName} · {data.grade}</div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, color: '#9898b8', fontSize: 20, cursor: 'pointer',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >×</button>
          </div>

          {/* Variant toggle */}
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              { key: 'moving-avg',  label: 'Moving Avg' },
              { key: 'score-radar', label: 'Score Radar' },
            ] as { key: Variant; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setVariant(key)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: variant === key ? 'rgba(232,197,71,0.15)' : 'rgba(255,255,255,0.04)',
                  border:     variant === key ? '1px solid rgba(232,197,71,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  color:      variant === key ? '#e8c547' : '#55556a',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div style={{
            borderRadius: 12, overflow: 'hidden',
            background: '#060610', border: '1px solid rgba(255,255,255,0.06)',
            minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {generating && (
              <div style={{ color: '#55556a', fontSize: 13, padding: 24, textAlign: 'center' }}>
                <div style={{ marginBottom: 8 }}>Generating…</div>
                <div style={{ fontSize: 11, color: '#33334a' }}>Rendering template</div>
              </div>
            )}
            {!generating && previewUrl && (
              <img
                src={previewUrl}
                alt="Share preview"
                style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 460, objectFit: 'contain' }}
              />
            )}
          </div>

          {/* Download */}
          <button
            onClick={download}
            disabled={generating || !previewUrl}
            style={{
              padding: '14px 0', borderRadius: 12,
              background: generating || !previewUrl ? 'rgba(232,197,71,0.25)' : '#e8c547',
              border: 'none', color: '#08080f', fontSize: 14, fontWeight: 800, letterSpacing: 0.5,
              cursor: generating || !previewUrl ? 'default' : 'pointer',
            }}
          >
            {generating ? 'Generating…' : 'Download PNG (2160×2700)'}
          </button>
        </div>
      </div>
    </>
  )
}
