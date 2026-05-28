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
  priceHistory?: { month: string; price: number }[]
  fmtFn?:        (n: number) => string
  currency?:     string
}

function scoreColor(s: number) {
  return s >= 70 ? '#3cb87a' : s >= 50 ? '#d7aa3c' : '#e05252'
}
function changeColor(c: number) { return c >= 0 ? '#3cb87a' : '#e05252' }

type Variant = 'moving-avg' | 'score-radar' | 'card-art'

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

  function sparklineSectionHtml(): string {
    const hist = d.priceHistory
    if (!hist || hist.length < 2) return ''

    const fmt = d.fmtFn ?? ((n: number) => `$${n.toFixed(2)}`)
    const prices = hist.map(h => h.price)
    const minP   = Math.min(...prices)
    const maxP   = Math.max(...prices)
    const range  = maxP - minP || 1

    // SVG canvas: 920×72 — line draws in upper zone, labels in bottom 18px
    const W = 920, H = 72, pad = 8, labelZone = 18
    const lineAreaH = H - pad - labelZone  // line draws between y=pad and y=(H-labelZone)
    const xStep = (W - pad * 2) / (hist.length - 1)

    const pts = hist.map((h, i) => {
      const x = pad + i * xStep
      const y = pad + (1 - (h.price - minP) / range) * lineAreaH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    const areaBottom = `${(pad + (hist.length - 1) * xStep).toFixed(1)},${H - labelZone} ${pad},${H - labelZone}`
    const lineColor  = prices[prices.length - 1] >= prices[0] ? '#3cb87a' : '#e05252'

    // Label every ~4th month, always show first and last
    const labelPts = hist.map((h, i) => {
      if (i === 0 || i === hist.length - 1 || i % Math.max(1, Math.floor(hist.length / 6)) === 0) return h
      return null
    })

    const oldest = hist[0].month
    const newest = hist[hist.length - 1].month
    const allTimeHigh = Math.max(...prices)
    const allTimeLow  = Math.min(...prices)

    return `
<div class="sparkline-section">
  <div class="spark-header">
    <div class="spark-title">Price History · ${hist.length}mo</div>
    <div class="spark-meta">
      <div class="spark-stat">
        <div class="spark-stat-label">Period High</div>
        <div class="spark-stat-val" style="color:#3cb87a">${fmt(allTimeHigh)}</div>
      </div>
      <div class="spark-stat">
        <div class="spark-stat-label">Period Low</div>
        <div class="spark-stat-val" style="color:#e05252">${fmt(allTimeLow)}</div>
      </div>
      <div class="spark-stat">
        <div class="spark-stat-label">From</div>
        <div class="spark-stat-val" style="color:rgba(255,255,255,0.45)">${oldest}</div>
      </div>
    </div>
  </div>
  <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;width:100%">
    <defs>
      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${lineColor}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <polygon points="${pts.join(' ')} ${areaBottom}" fill="url(#sparkGrad)"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${labelPts.map((h, i) => {
      if (!h) return ''
      const x = pad + i * xStep
      const anchor = i === 0 ? 'start' : i === hist.length - 1 ? 'end' : 'middle'
      return `<text x="${x.toFixed(1)}" y="${H - 2}" text-anchor="${anchor}" font-size="10" fill="rgba(255,255,255,0.25)" font-family="Helvetica Neue,Helvetica,Arial,sans-serif">${h.month}</text>`
    }).join('')}
    <circle cx="${(pad + (hist.length - 1) * xStep).toFixed(1)}" cy="${(pad + (1 - (prices[prices.length - 1] - minP) / range) * lineAreaH).toFixed(1)}" r="4" fill="${lineColor}"/>
  </svg>
</div>`
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
  .score-row-radar { display:grid !important; grid-template-columns:repeat(3,1fr); align-items:center; }
  .score-left { flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:8px; }
  .score-label { font-size:16px; font-weight:600; color:rgba(255,255,255,0.24); letter-spacing:0.12em; text-transform:uppercase; }
  .score-circle { width:124px; height:124px; border-radius:50%; border:3px solid ${scoreCol}; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .score-num { font-size:54px; font-weight:700; color:${scoreCol}; letter-spacing:-2px; line-height:1; }
  .score-sub { font-size:14px; font-weight:600; color:${scoreCol}; opacity:0.6; letter-spacing:0.1em; text-transform:uppercase; margin-top:3px; }
  .score-bars { flex:1; padding-left:40px; }
  .score-radar { flex:1; padding-left:20px; height:180px; display:flex; align-items:center; }
  .sb-row { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
  .sb-row:last-child { margin-bottom:0; }
  .sb-label { font-size:16px; font-weight:600; color:rgba(255,255,255,0.55); width:120px; flex-shrink:0; }
  .sb-bar-bg { flex:1; height:7px; background:rgba(255,255,255,0.07); border-radius:4px; overflow:hidden; }
  .sb-fill { height:100%; border-radius:4px; }
  .sb-val { font-size:18px; font-weight:700; width:36px; text-align:right; flex-shrink:0; }
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
  .sparkline-section { position:relative; z-index:2; margin:14px 56px 0; flex-shrink:0; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:16px 26px; }
  .spark-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
  .spark-title { font-size:16px; font-weight:600; color:rgba(255,255,255,0.24); letter-spacing:0.1em; text-transform:uppercase; }
  .spark-meta { display:flex; gap:20px; }
  .spark-stat { display:flex; flex-direction:column; gap:3px; }
  .spark-stat-label { font-size:11px; font-weight:600; color:rgba(255,255,255,0.22); letter-spacing:0.08em; text-transform:uppercase; }
  .spark-stat-val { font-size:18px; font-weight:700; color:#fff; letter-spacing:-0.3px; }
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
<div class="score-row${variant === 'score-radar' ? ' score-row-radar' : ''}">
  <div class="score-left">
    <div class="score-label">Score</div>
    <div class="score-circle">
      <div class="score-num">${Math.round(d.score)}</div>
      <div class="score-sub">${d.scoreLabel}</div>
    </div>
  </div>
  ${variant === 'score-radar'
    ? `<div class="score-bars" style="padding-left:0;padding:0 24px;">
    ${barHtml('Trend', trend)}
    ${barHtml('Liquidity', liquidity)}
    ${barHtml('Consistency', consistency)}
    ${barHtml('Value', value)}
  </div><div class="score-radar" style="padding-left:0;justify-content:center;">${radarSvgHtml()}</div>`
    : `<div class="score-bars">
    ${barHtml('Trend', trend)}
    ${barHtml('Liquidity', liquidity)}
    ${barHtml('Consistency', consistency)}
    ${barHtml('Value', value)}
  </div>`}
</div>
<div class="badges-grid">
  ${badgeHtml('Liquidity',      d.liquidityLabel ?? '—',                         d.liquidityLabel ? 'green' : '')}
  ${badgeHtml('30D Sales',      d.salesCount30d ? String(d.salesCount30d) : '—', 'amber')}
  ${badgeHtml('Price Position', pricePos,                                         'sm')}
</div>
${variant === 'score-radar' ? '' : `
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
${variant === 'score-radar' ? sparklineSectionHtml() : ''}
<div class="spacer"></div>
</body></html>`
}

export default function ShareCardModal({
  data,
  onClose,
  isAdmin = false,
}: {
  data:     ShareCardData
  onClose:  () => void
  isAdmin?: boolean
}) {
  const [variant, setVariant] = useState<Variant>('moving-avg')
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 3D card-art controls (admin only)
  const [roll,        setRoll]        = useState(0)   // Y-axis rotation  −60..60°
  const [tilt,        setTilt]        = useState(0)   // X-axis rotation  −45..45°
  const [downloading, setDownloading] = useState(false)

  // Reset angles when leaving card-art
  useEffect(() => {
    if (variant !== 'card-art') { setRoll(0); setTilt(0) }
  }, [variant])

  useEffect(() => {
    const ua = navigator.userAgent
    setIsIOS(/iPhone|iPad|iPod/.test(ua))
    setIsAndroid(/Android/.test(ua))
    const check = () => {
      setIsMobile(window.innerWidth < 640)
      setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const generate = useCallback(async () => {
    // card-art uses a live CSS 3D preview — canvas render happens on download
    if (variant === 'card-art') return

    setGenerating(true)
    setPreviewUrl(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null })
    setPreviewBlob(null)
    try {

      // ── Data templates: html2canvas ─────────────────────────────────────────
      const html2canvas = (await import('html2canvas')).default

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
      // Store blob for zero-await native share; derive object URL for preview
      await new Promise<void>(resolve => {
        canvas.toBlob(blob => {
          if (blob) {
            setPreviewBlob(blob)
            setPreviewUrl(URL.createObjectURL(blob))
          }
          resolve()
        }, 'image/png', 1.0)
      })
    } catch (e) {
      console.error('ShareCard generation failed:', e)
    } finally {
      setGenerating(false)
    }
  }, [data, variant])

  useEffect(() => { generate() }, [generate])

  async function download() {
    if (variant === 'card-art') { downloadCardArt(); return }
    if (!previewUrl) return
    const filename = `cardindex-${data.cardName.replace(/\s+/g, '-').toLowerCase()}.png`

    // Android: skip the share sheet entirely — <a download> saves directly to
    // the Downloads folder (visible in Photos/Gallery immediately).
    // navigator.share on Android shows a share sheet with no "Save" option.
    if (isAndroid) {
      const a = document.createElement('a')
      a.href = previewUrl
      a.download = filename
      a.click()
      return
    }

    // iOS / Web Share API path ─────────────────────────────────────────────────
    // CRITICAL: navigator.share() must be called with NO awaits before it on iOS.
    // We pre-built previewBlob during generation so we can call share() immediately.
    if (isMobile && canNativeShare && previewBlob) {
      try {
        const file = new File([previewBlob], filename, { type: 'image/png' })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `CardIndex — ${data.cardName}` })
          return
        }
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        // Share failed non-cancel — fall through to iOS fallback
      }
    }

    // iOS fallback (share unavailable/failed): open blob URL full-screen
    // so user can long-press the image → Save to Photos.
    // Never use <a download> on iOS — that shows a useless file viewer.
    if (isIOS) {
      window.open(previewUrl, '_blank')
      return
    }

    // Desktop: standard anchor download
    const a = document.createElement('a')
    a.href     = previewUrl
    a.download = filename
    a.click()
  }

  // ── Card-art 3D canvas export ───────────────────────────────────────────────
  async function downloadCardArt() {
    if (!data.imageUrl) return
    setDownloading(true)
    try {
      const CW = 756, CH = 1056, R = 36

      // Step 1: draw card with rounded corners onto an intermediate canvas
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = data.imageUrl
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej })

      const temp = document.createElement('canvas')
      temp.width = CW; temp.height = CH
      const tCtx = temp.getContext('2d')!
      tCtx.clearRect(0, 0, CW, CH)
      tCtx.beginPath()
      tCtx.roundRect(0, 0, CW, CH, R)
      tCtx.clip()
      tCtx.drawImage(img, 0, 0, CW, CH)

      // Flat (no rotation) — output the intermediate canvas directly
      if (roll === 0 && tilt === 0) {
        temp.toBlob(blob => {
          if (!blob) return
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `cardindex-${data.cardName.replace(/\s+/g, '-').toLowerCase()}.png`
          a.click()
          setTimeout(() => URL.revokeObjectURL(url), 2000)
        }, 'image/png', 1.0)
        return
      }

      // Step 2: perspective-project using a dense grid of affine triangles.
      //
      // Two-triangle affine mapping produces visible seams and warping on text
      // because the approximation error accumulates across the whole card.
      // Subdividing into DIVS×DIVS cells limits each cell's z-range to
      // ~(cardSize/DIVS)*sin(angle), making the error sub-pixel at DIVS=24.
      //
      //   At roll=60°, tilt=45°, DIVS=24:
      //   Δz per cell ≈ (756/24)*sin60 + (1056/24)*sin45 ≈ 27+31 ≈ 58px
      //   affine error ≈ (58/1800)² ≈ 0.001  (<1px at 756px width) ✓

      const DIVS = 24
      const pad  = 280
      const OW = CW + pad * 2, OH = CH + pad * 2

      const canvas = document.createElement('canvas')
      canvas.width = OW; canvas.height = OH
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, OW, OH)

      const rollRad = (roll * Math.PI) / 180
      const tiltRad = (tilt * Math.PI) / 180
      // Match the CSS preview exactly:
      //   preview uses perspective(600px) on a 160px-wide card
      //   → scale focal proportionally to the export card width (756px)
      const focal = 600 * (CW / 160)   // ≈ 2835
      const cosR = Math.cos(rollRad), sinR = Math.sin(rollRad)
      const cosT = Math.cos(tiltRad), sinT = Math.sin(tiltRad)

      type P2 = [number, number]

      /** Project a source-canvas point (u, v) through the 3-D transform to screen (px, py). */
      function project(u: number, v: number): P2 {
        const x = u - CW / 2, y = v - CH / 2
        // Rotate around Y (roll — positive rolls right side away from viewer)
        const x1 =  x * cosR
        const z1 = -x * sinR
        // Rotate around X (tilt — positive tips top away from viewer)
        const y2 = y * cosT - z1 * sinT
        const z2 = y * sinT + z1 * cosT
        // Perspective divide: scale = focal / (focal - z)
        // (negative z = away from viewer → scale < 1 → projects smaller, which is correct)
        const s = focal / (focal - z2)
        return [x1 * s + OW / 2, y2 * s + OH / 2]
      }

      /** Affine-map one triangle from source→screen and blit the relevant pixels. */
      function drawTri(p0: P2, p1: P2, p2: P2, u0: P2, u1: P2, u2: P2) {
        const denom = (u2[0]-u0[0])*(u1[1]-u0[1]) - (u1[0]-u0[0])*(u2[1]-u0[1])
        if (Math.abs(denom) < 1e-8) return
        const a  = ((p2[0]-p0[0])*(u1[1]-u0[1]) - (p1[0]-p0[0])*(u2[1]-u0[1])) / denom
        const b  = ((p1[0]-p0[0])*(u2[0]-u0[0]) - (p2[0]-p0[0])*(u1[0]-u0[0])) / denom
        const c  = p0[0] - a*u0[0] - b*u0[1]
        const dd = ((p2[1]-p0[1])*(u1[1]-u0[1]) - (p1[1]-p0[1])*(u2[1]-u0[1])) / denom
        const e  = ((p1[1]-p0[1])*(u2[0]-u0[0]) - (p2[1]-p0[1])*(u1[0]-u0[0])) / denom
        const f  = p0[1] - dd*u0[0] - e*u0[1]
        // Expand the clip path 1px outward from the triangle centroid so that
        // adjacent triangles overlap by ~2px. This buries the anti-aliased
        // fringe that ctx.clip() creates at each boundary, eliminating the
        // visible grid-line seams on high-DPR / mobile displays.
        const cx = (p0[0]+p1[0]+p2[0])/3, cy = (p0[1]+p1[1]+p2[1])/3
        const expand = ([px, py]: P2): P2 => {
          const dx = px - cx, dy = py - cy
          const d  = Math.sqrt(dx*dx + dy*dy) || 1
          return [px + dx/d, py + dy/d]
        }
        const [e0, e1, e2] = [expand(p0), expand(p1), expand(p2)]
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1])
        ctx.closePath(); ctx.clip()
        ctx.transform(a, dd, b, e, c, f)
        ctx.drawImage(temp, 0, 0)
        ctx.restore()
      }

      // Walk the grid — each cell projects its own 4 corners independently,
      // so the affine error stays negligible within each tiny quad.
      for (let row = 0; row < DIVS; row++) {
        for (let col = 0; col < DIVS; col++) {
          const u0 = (col     / DIVS) * CW,  v0 = (row     / DIVS) * CH
          const u1 = ((col+1) / DIVS) * CW,  v1 = ((row+1) / DIVS) * CH

          const p00 = project(u0, v0), p10 = project(u1, v0)
          const p11 = project(u1, v1), p01 = project(u0, v1)

          const S00: P2 = [u0, v0], S10: P2 = [u1, v0]
          const S11: P2 = [u1, v1], S01: P2 = [u0, v1]

          drawTri(p00, p10, p11, S00, S10, S11)
          drawTri(p00, p11, p01, S00, S11, S01)
        }
      }

      canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `cardindex-${data.cardName.replace(/\s+/g, '-').toLowerCase()}.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
      }, 'image/png', 1.0)
    } catch (err) {
      console.error('Card art export failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  const VARIANTS = [
    { key: 'moving-avg'  as Variant, label: 'Moving Avg',   desc: 'Price averages & signal',  icon: '📈' },
    { key: 'score-radar' as Variant, label: 'Score Radar',  desc: 'Spider graph & sparkline',  icon: '🕸️' },
    ...(isAdmin ? [{ key: 'card-art' as Variant, label: 'Card Art', desc: 'Transparent card PNG', icon: '🃏' }] : []),
  ]

  // Reset to moving-avg if card-art is selected but user is not admin
  useEffect(() => {
    if (!isAdmin && variant === 'card-art') setVariant('moving-avg')
  }, [isAdmin, variant])

  const ready    = !generating && !!previewUrl
  const cardArtReady = variant === 'card-art' && !downloading && !!data.imageUrl
  const buttonReady  = variant === 'card-art' ? cardArtReady : ready

  const btnLabel = variant === 'card-art'
    ? (downloading ? 'Rendering…' : 'Export PNG')
    : generating
      ? 'Generating…'
      : isAndroid
        ? 'Save Image'
        : canNativeShare && isMobile
          ? 'Save / Share Image'
          : isIOS && isMobile
            ? 'Open Image to Save'
            : 'Download PNG'
  // On iOS without native share, guide user to long-press after opening
  const showIOSHint = isIOS && isMobile && !canNativeShare && ready

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(6px)' }}
      />

      {/* Sheet — bottom on mobile, centered on desktop */}
      <div style={{
        position: 'fixed', zIndex: 1001,
        ...(isMobile
          ? { bottom: 0, left: 0, right: 0 }
          : { inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }),
      }}>
        <div ref={containerRef} style={{
          pointerEvents: 'auto',
          background: '#0e0e1c', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: isMobile ? '20px 20px 0 0' : 20,
          padding: isMobile ? '20px 20px calc(20px + env(safe-area-inset-bottom))' : 24,
          width: isMobile ? '100%' : '100%', maxWidth: isMobile ? undefined : 500,
          maxHeight: isMobile ? '88vh' : '92vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 16,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
        }}>

          {/* Drag handle (mobile only) */}
          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: -6 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
            </div>
          )}

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#f0f0f8' }}>Save Image</div>
              <div style={{ fontSize: 11, color: '#55556a', marginTop: 2 }}>{data.cardName} · {data.grade}</div>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, color: '#9898b8', fontSize: 18, cursor: 'pointer',
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>×</button>
          </div>

          {/* Variant picker */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${VARIANTS.length}, 1fr)`, gap: 8 }}>
            {VARIANTS.map(({ key, label, desc, icon }) => (
              <button
                key={key}
                onClick={() => setVariant(key)}
                style={{
                  padding: isMobile ? '10px 6px' : '10px 8px',
                  borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
                  textAlign: 'center',
                  background: variant === key ? 'rgba(232,197,71,0.12)' : 'rgba(255,255,255,0.03)',
                  border:     variant === key ? '1.5px solid rgba(232,197,71,0.40)' : '1.5px solid rgba(255,255,255,0.07)',
                  color:      variant === key ? '#e8c547' : '#55556a',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2 }}>{label}</span>
                {!isMobile && <span style={{ fontSize: 10, color: variant === key ? 'rgba(232,197,71,0.6)' : '#33334a', lineHeight: 1.3 }}>{desc}</span>}
              </button>
            ))}
          </div>

          {/* 3D sliders — card-art + admin only */}
          {variant === 'card-art' && isAdmin && (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#55556a', letterSpacing: 1, textTransform: 'uppercase' as const }}>3D Transform</span>
                {(roll !== 0 || tilt !== 0) && (
                  <button
                    onClick={() => { setRoll(0); setTilt(0) }}
                    style={{ fontSize: 10, color: '#e8c547', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >Reset</button>
                )}
              </div>
              {([
                { label: 'Roll',  axis: 'Y-axis', value: roll,  min: -60, max: 60, set: setRoll  },
                { label: 'Tilt',  axis: 'X-axis', value: tilt,  min: -45, max: 45, set: setTilt  },
              ] as const).map(({ label, axis, value, min, max, set }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <span style={{ fontSize: 12, color: '#9898b8', fontWeight: 600 }}>
                      {label} <span style={{ fontSize: 10, color: '#44445a', fontWeight: 400 }}>({axis})</span>
                    </span>
                    <span style={{ fontSize: 12, color: '#e8c547', fontWeight: 700, minWidth: 44, textAlign: 'right' as const }}>
                      {value > 0 ? '+' : ''}{value}°
                    </span>
                  </div>
                  <input
                    type="range" min={min} max={max} value={value}
                    onChange={e => set(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#e8c547', cursor: 'pointer', display: 'block' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    <span style={{ fontSize: 9, color: '#2e2e42' }}>{min}°</span>
                    <span style={{ fontSize: 9, color: '#2e2e42' }}>{max}°</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Preview — CSS 3D for card-art, canvas-generated for data templates */}
          <div style={{
            borderRadius: 12, overflow: variant === 'card-art' ? 'visible' : 'hidden',
            background: variant === 'card-art' ? 'transparent' : '#060610',
            border: variant === 'card-art' ? 'none' : '1px solid rgba(255,255,255,0.06)',
            minHeight: isMobile ? 120 : 180,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: variant === 'card-art' ? '8px 0' : 0,
          }}>
            {variant === 'card-art' && data.imageUrl ? (
              /* Live CSS 3D preview — no canvas needed */
              <div style={{ perspective: 600, perspectiveOrigin: '50% 50%' }}>
                <img
                  src={data.imageUrl}
                  alt={data.cardName}
                  style={{
                    width: isMobile ? 130 : 160,
                    aspectRatio: '63/88',
                    borderRadius: isMobile ? 7 : 9,
                    display: 'block',
                    transform: `rotateY(${roll}deg) rotateX(${tilt}deg)`,
                    transition: 'transform 0.04s linear',
                    boxShadow: `${-roll * 0.6}px ${tilt * 0.4}px 40px rgba(0,0,0,0.85), 0 0 80px rgba(0,0,0,0.6)`,
                    transformOrigin: 'center center',
                  }}
                />
              </div>
            ) : (
              <>
                {generating && (
                  <div style={{ color: '#55556a', fontSize: 13, padding: 24, textAlign: 'center' }}>
                    <div style={{ marginBottom: 6, fontSize: isMobile ? 12 : 13 }}>Generating image…</div>
                    <div style={{ fontSize: 10, color: '#33334a' }}>This takes a few seconds</div>
                  </div>
                )}
                {!generating && previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Share preview"
                    style={{ width: '100%', height: 'auto', display: 'block', maxHeight: isMobile ? 260 : 440, objectFit: 'contain' }}
                  />
                )}
              </>
            )}
          </div>

          {/* Resolution hint for card-art */}
          {variant === 'card-art' && (
            <p style={{ fontSize: 10, color: '#33334a', textAlign: 'center', margin: '-8px 0 0' }}>
              Exports at 756 × 1056 px · transparent background PNG
            </p>
          )}

          {/* Action button */}
          <button
            onClick={download}
            disabled={!buttonReady}
            style={{
              padding: isMobile ? '15px 0' : '14px 0', borderRadius: 12,
              background: buttonReady ? '#e8c547' : 'rgba(232,197,71,0.20)',
              border: 'none', color: '#08080f', fontSize: isMobile ? 15 : 14, fontWeight: 800,
              letterSpacing: 0.4, cursor: buttonReady ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {buttonReady && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {canNativeShare && isMobile
                  ? <><path d="M8 2v9M5 8l3 3 3-3"/><path d="M3 13h10"/><path d="M11 4l-3-3-3 3"/></>
                  : isIOS && isMobile
                    ? <><path d="M8 3v8M5 8l3-3 3 3"/><rect x="2" y="11" width="12" height="3" rx="1"/></>
                    : <><path d="M4 12v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1"/><path d="M8 2v9M5 8l3 3 3-3"/></>
                }
              </svg>
            )}
            {btnLabel}
          </button>

          {/* Hint text */}
          {isMobile && ready && canNativeShare && (
            <p style={{ fontSize: 11, color: '#33334a', textAlign: 'center', margin: '-6px 0 0' }}>
              Tap Save Image to add to your Camera Roll
            </p>
          )}
          {showIOSHint && (
            <p style={{ fontSize: 11, color: '#33334a', textAlign: 'center', margin: '-6px 0 0' }}>
              Image opens full screen — long-press to Save to Photos
            </p>
          )}
        </div>
      </div>
    </>
  )
}
