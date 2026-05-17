'use client'

import { useState, useCallback, useEffect } from 'react'

export interface ShareCardCompare {
  name:          string
  setName:       string
  grade:         string
  imageUrl?:     string
  priceDisplay:  string
  changePct:     number
  score:         number
  scoreLabel:    string
  trend:         number   // 0–100
  liquidity:     number   // 0–100
  consistency:   number   // 0–100
  value:         number   // 0–100
  salesCount30d: number
  avg1d?:        number
  avg7d?:        number
  avg30d?:       number
  fmtFn:         (n: number) => string
}

function scoreColor(s: number) {
  return s >= 70 ? '#3cb87a' : s >= 50 ? '#d7aa3c' : '#e05252'
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildCompareHtml(left: ShareCardCompare, right: ShareCardCompare): string {
  const leftWins  = left.score  > right.score
  const rightWins = right.score > left.score

  // Determine dim state: loser is dimmed when there's a clear winner
  function isWinnerCard(card: ShareCardCompare) {
    return card === left ? leftWins : rightWins
  }
  function isDimmed(card: ShareCardCompare) {
    return (leftWins || rightWins) && !isWinnerCard(card)
  }

  function metricRow(label: string, val: number, otherVal: number): string {
    const win  = val > otherVal
    const lose = val < otherVal
    const cls       = win ? 'win' : lose ? 'lose' : ''
    const fillColor = win ? '#3cb87a' : lose ? '#e05252' : '#d7aa3c'
    const valColor  = win ? '#3cb87a' : lose ? '#e05252' : '#d7aa3c'
    return `
        <div class="m-row ${cls}">
          <div class="m-label">${label}</div>
          <div class="m-bar-bg"><div class="m-fill" style="width:${val}%;background:${fillColor}"></div></div>
          <div class="m-val" style="color:${valColor}">${val}</div>
        </div>`
  }

  function signalCol(card: ShareCardCompare, side: 'left' | 'right'): string {
    const isBullish = card.avg7d != null && card.avg30d != null
      ? card.avg7d >= card.avg30d : null
    const signalCls    = isBullish === false ? 'sc-signal bear' : 'sc-signal'
    const signalValCls = isBullish === false ? 'sc-signal-val bear' : 'sc-signal-val'
    const signalText   = isBullish === true ? '▲ Bullish' : isBullish === false ? '▼ Bearish' : '— N/A'
    return `
      <div class="sc-col ${side}">
        <div class="sc-col-label">${card.name}</div>
        <div class="sc-avg-row">
          <div class="sc-avg"><div class="sc-avg-label">Current</div><div class="sc-avg-val amber">${card.priceDisplay}</div></div>
          <div class="sc-avg"><div class="sc-avg-label">1D Avg</div><div class="sc-avg-val">${card.avg1d ? card.fmtFn(card.avg1d) : '—'}</div></div>
          <div class="sc-avg"><div class="sc-avg-label">7D Avg</div><div class="sc-avg-val">${card.avg7d ? card.fmtFn(card.avg7d) : '—'}</div></div>
          <div class="sc-avg"><div class="sc-avg-label">30D Avg</div><div class="sc-avg-val">${card.avg30d ? card.fmtFn(card.avg30d) : '—'}</div></div>
        </div>
        <div class="${signalCls}"><div class="sc-signal-label">Signal</div><div class="${signalValCls}">${signalText}</div></div>
      </div>`
  }

  function colHtml(card: ShareCardCompare, other: ShareCardCompare, side: 'left' | 'right'): string {
    const winner  = isWinnerCard(card)
    const dimmed  = isDimmed(card)
    const scoreCol = scoreColor(card.score)
    const circleBorder = dimmed ? 'rgba(255,255,255,0.15)' : scoreCol
    const numColor     = dimmed ? 'rgba(255,255,255,0.3)'  : scoreCol
    const changeColor  = card.changePct >= 0 ? 'green' : 'red'
    const changeStr    = `${card.changePct >= 0 ? '+' : ''}${card.changePct.toFixed(1)}% 30d`

    const nameParts = card.name.split('&').map(p => p.trim())
    const nameHtml  = nameParts.length > 1
      ? nameParts.map((p, i) => `${esc(p)}${i < nameParts.length - 1 ? ' &amp;' : ''}`).join('<br>')
      : esc(card.name)

    return `
  <div class="card-col ${side}">
    <div class="winner-wrap">
      ${winner ? '<div class="winner-badge"><div class="wb-dot"></div>Better Buy</div>' : ''}
    </div>
    <div class="col-header">
      <div class="card-set-row">${esc(card.setName)} <span class="grade-chip">${esc(card.grade)}</span></div>
      <div class="col-card-name">${nameHtml}</div>
    </div>
    <div class="col-thumb">
      ${card.imageUrl
        ? `<img src="${card.imageUrl}" crossorigin="anonymous" alt="${card.name}">`
        : '<span style="font-size:32px;opacity:0.3">🃏</span>'}
    </div>
    <div class="price-score-block">
      <div class="price-row">
        <div class="price-left">
          <div class="col-price">${card.priceDisplay}</div>
          <div class="col-change ${changeColor}">${changeStr}</div>
        </div>
        <div class="score-circle-big" style="border-color:${circleBorder}">
          <div class="scb-num" style="color:${numColor}">${Math.round(card.score)}</div>
          <div class="scb-label" style="color:${dimmed ? 'rgba(255,255,255,0.2)' : scoreCol};opacity:${dimmed ? 1 : 0.7}">${card.scoreLabel}</div>
        </div>
      </div>
    </div>
    <div class="primary-metrics">
      ${metricRow('Liquidity',   card.liquidity,   other.liquidity)}
      ${metricRow('Consistency', card.consistency, other.consistency)}
      ${metricRow('Trend',       card.trend,       other.trend)}
      ${metricRow('Value',       card.value,       other.value)}
    </div>
    <div class="badges">
      <div class="badge">
        <div class="badge-label">30D Sales</div>
        <div class="badge-value ${card.salesCount30d >= other.salesCount30d ? 'green' : 'amber'}">${card.salesCount30d || '—'}</div>
      </div>
      <div class="badge">
        <div class="badge-label">7D Avg</div>
        <div class="badge-value">${card.avg7d ? card.fmtFn(card.avg7d) : '—'}</div>
      </div>
      <div class="badge">
        <div class="badge-label">30D Avg</div>
        <div class="badge-value">${card.avg30d ? card.fmtFn(card.avg30d) : '—'}</div>
      </div>
    </div>
  </div>`
  }

  return `
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  .sc-wrap { width:1080px; height:1350px; background:#0a0a0c; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; overflow:hidden; display:flex; flex-direction:column; position:relative; }
  .grid { position:absolute; inset:0; pointer-events:none; background-image:linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px); background-size:54px 54px; }
  .glow-center { position:absolute; left:calc(50% - 80px); top:calc(50% - 600px); width:160px; height:1200px; background:radial-gradient(ellipse,rgba(215,170,60,0.04) 0%,transparent 65%); pointer-events:none; }
  .topbar { position:relative; z-index:10; height:86px; flex-shrink:0; display:flex; align-items:center; justify-content:center; padding:0 56px; border-bottom:1px solid rgba(255,255,255,0.07); }
  .logo-wordmark { display:flex; align-items:center; }
  .logo-wordmark span.card { font-size:32px; font-weight:700; color:#ffffff; letter-spacing:-0.5px; }
  .logo-wordmark span.index { font-size:32px; font-weight:700; color:#d7aa3c; letter-spacing:-0.5px; }
  /* Columns */
  .columns { display:flex; position:relative; z-index:2; flex-shrink:0; }
  .vs-col { width:60px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; }
  .vs-line { position:absolute; top:0; bottom:0; left:50%; width:1px; background:rgba(255,255,255,0.07); }
  .vs-badge { width:50px; height:50px; border-radius:50%; background:#0a0a0c; border:1px solid rgba(215,170,60,0.3); display:flex; align-items:center; justify-content:center; font-size:17px; font-weight:700; color:#d7aa3c; position:relative; z-index:1; }
  .card-col { flex:1; padding:26px 28px; display:flex; flex-direction:column; gap:13px; }
  .card-col.left { padding-left:48px; }
  .card-col.right { padding-right:48px; }
  /* Winner wrap — fixed height so both columns stay vertically aligned */
  .winner-wrap { height:38px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .winner-badge { background:rgba(60,184,122,0.09); border:1px solid rgba(60,184,122,0.22); border-radius:5px; padding:7px 14px; font-size:15px; font-weight:700; color:#3cb87a; letter-spacing:0; text-transform:uppercase; display:flex; align-items:center; gap:6px; white-space:nowrap; }
  .wb-dot { width:7px; height:7px; border-radius:50%; background:#3cb87a; flex-shrink:0; }
  /* Header */
  .col-header { flex-shrink:0; }
  .card-set-row { font-size:14px; font-weight:600; color:rgba(255,255,255,0.26); letter-spacing:0.02em; text-transform:uppercase; margin-bottom:8px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .grade-chip { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:3px 9px; font-size:12px; color:rgba(255,255,255,0.38); letter-spacing:0; }
  .col-card-name { font-size:30px; font-weight:700; color:#fff; letter-spacing:-0.8px; line-height:1.1; }
  /* Card thumb */
  .col-thumb { width:58%; margin:0 auto; aspect-ratio:63/88; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; flex-shrink:0; position:relative; overflow:hidden; }
  .col-thumb img { width:100%; height:100%; object-fit:cover; border-radius:inherit; display:block; }
  /* Price + score */
  .price-score-block { flex-shrink:0; }
  .price-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .price-left { display:flex; flex-direction:column; }
  .col-price { font-size:44px; font-weight:700; color:#fff; letter-spacing:-1.5px; line-height:1; }
  .col-change { font-size:18px; font-weight:600; margin-top:6px; }
  .col-change.red { color:#e05252; }
  .col-change.green { color:#3cb87a; }
  .score-circle-big { width:96px; height:96px; border-radius:50%; border:3px solid; display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0; }
  .scb-num { font-size:42px; font-weight:700; letter-spacing:-1px; line-height:1; }
  .scb-label { font-size:11px; font-weight:600; letter-spacing:0.03em; text-transform:uppercase; margin-top:3px; }
  /* Metric bars */
  .primary-metrics { flex-shrink:0; display:flex; flex-direction:column; gap:8px; }
  .m-row { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:11px 14px; display:flex; align-items:center; gap:12px; }
  .m-row.win  { background:rgba(60,184,122,0.05); border-color:rgba(60,184,122,0.13); }
  .m-row.lose { background:rgba(229,82,82,0.04); border-color:rgba(229,82,82,0.10); }
  .m-label { font-size:14px; font-weight:600; color:rgba(255,255,255,0.3); letter-spacing:0.02em; text-transform:uppercase; width:110px; flex-shrink:0; }
  .m-bar-bg { flex:1; height:6px; background:rgba(255,255,255,0.07); border-radius:3px; overflow:hidden; }
  .m-fill { height:100%; border-radius:3px; }
  .m-val { font-size:18px; font-weight:700; width:36px; text-align:right; flex-shrink:0; }
  /* Badges */
  .badges { flex-shrink:0; display:flex; gap:8px; }
  .badge { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.09); border-radius:9px; padding:13px 14px; display:flex; flex-direction:column; gap:6px; flex:1; }
  .badge-label { font-size:13px; font-weight:600; color:rgba(255,255,255,0.28); letter-spacing:0.02em; text-transform:uppercase; }
  .badge-value { font-size:21px; font-weight:700; color:#fff; letter-spacing:-0.4px; }
  .badge-value.green { color:#3cb87a; }
  .badge-value.amber { color:#d7aa3c; }
  /* Signal comparison */
  .signal-compare { flex:1; margin:0 48px; position:relative; z-index:2; display:flex; flex-direction:column; min-height:0; padding-bottom:28px; }
  .sc-divider { height:1px; background:rgba(255,255,255,0.07); margin:0 0 18px; flex-shrink:0; }
  .sc-header { margin-bottom:16px; flex-shrink:0; }
  .sc-title { font-size:13px; font-weight:600; color:rgba(255,255,255,0.22); letter-spacing:0.04em; text-transform:uppercase; }
  .sc-cols { flex:1; display:flex; gap:0; min-height:0; }
  .sc-col { flex:1; display:flex; flex-direction:column; gap:10px; }
  .sc-col.left { padding-right:32px; border-right:1px solid rgba(255,255,255,0.06); }
  .sc-col.right { padding-left:32px; }
  .sc-col-label { font-size:14px; font-weight:600; color:rgba(255,255,255,0.28); letter-spacing:0.02em; text-transform:uppercase; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sc-avg-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .sc-avg { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:13px 15px; }
  .sc-avg-label { font-size:13px; font-weight:600; color:rgba(255,255,255,0.24); letter-spacing:0.02em; text-transform:uppercase; margin-bottom:6px; }
  .sc-avg-val { font-size:20px; font-weight:700; color:#fff; letter-spacing:-0.3px; }
  .sc-avg-val.amber { color:#d7aa3c; }
  .sc-signal { background:rgba(60,184,122,0.06); border:1px solid rgba(60,184,122,0.16); border-radius:8px; padding:13px 15px; display:flex; align-items:center; justify-content:space-between; }
  .sc-signal.bear { background:rgba(229,82,82,0.05); border-color:rgba(229,82,82,0.14); }
  .sc-signal-label { font-size:13px; font-weight:600; color:rgba(255,255,255,0.24); letter-spacing:0.02em; text-transform:uppercase; }
  .sc-signal-val { font-size:17px; font-weight:700; color:#3cb87a; letter-spacing:0; }
  .sc-signal-val.bear { color:#e05252; }
</style>
<div class="sc-wrap">
<div class="grid"></div><div class="glow-center"></div>
<div class="topbar">
  <div class="logo-wordmark"><span class="card">Card</span><span class="index">Index</span></div>
</div>
<div class="columns">
  ${colHtml(left, right, 'left')}
  <div class="vs-col">
    <div class="vs-line"></div>
    <div class="vs-badge">VS</div>
  </div>
  ${colHtml(right, left, 'right')}
</div>
<div class="signal-compare">
  <div class="sc-divider"></div>
  <div class="sc-header"><div class="sc-title">Moving Average Signal</div></div>
  <div class="sc-cols">
    ${signalCol(left,  'left')}
    ${signalCol(right, 'right')}
  </div>
</div>
</div>`
}

export default function ShareCompareModal({
  left,
  right,
  onClose,
}: {
  left:    ShareCardCompare
  right:   ShareCardCompare
  onClose: () => void
}) {
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setGenerating(true)
    setPreviewUrl(null)
    try {
      const html2canvas = (await import('html2canvas')).default
      const wrap = document.createElement('div')
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:1080px;height:1350px;overflow:hidden;pointer-events:none;z-index:-1;'
      wrap.innerHTML = buildCompareHtml(left, right)
      document.body.appendChild(wrap)

      const imgs = Array.from(wrap.querySelectorAll('img'))
      await Promise.allSettled(imgs.map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r })
      ))

      const canvas = await html2canvas(wrap, {
        width: 1080, height: 1350, scale: 2,
        useCORS: true, allowTaint: false,
        backgroundColor: '#0a0a0c', logging: false,
      })
      document.body.removeChild(wrap)
      setPreviewUrl(canvas.toDataURL('image/png', 1.0))
    } catch (e) {
      console.error('ShareCompare generation failed:', e)
    } finally {
      setGenerating(false)
    }
  }, [left, right])

  useEffect(() => { generate() }, [generate])

  function download() {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href     = previewUrl
    a.download = `cardindex-compare-${left.name.replace(/\s+/g, '-').toLowerCase()}-vs-${right.name.replace(/\s+/g, '-').toLowerCase()}.png`
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
        <div style={{
          pointerEvents: 'auto',
          background: '#0e0e1c', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 24, width: '100%', maxWidth: 520,
          maxHeight: '92vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f8' }}>Share Comparison</div>
              <div style={{ fontSize: 11, color: '#55556a', marginTop: 3 }}>
                {left.name} vs {right.name}
              </div>
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

          {/* Preview */}
          <div style={{
            borderRadius: 12, overflow: 'hidden',
            background: '#060610', border: '1px solid rgba(255,255,255,0.06)',
            minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {generating && (
              <div style={{ color: '#55556a', fontSize: 13, padding: 24, textAlign: 'center' }}>
                <div style={{ marginBottom: 8 }}>Generating…</div>
                <div style={{ fontSize: 11, color: '#33334a' }}>Rendering comparison template</div>
              </div>
            )}
            {!generating && previewUrl && (
              <img
                src={previewUrl}
                alt="Comparison preview"
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
