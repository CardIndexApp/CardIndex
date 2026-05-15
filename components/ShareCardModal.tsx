'use client'

/**
 * ShareCardModal — renders a 1080×1350 shareable PNG matching the CI single-card template.
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
  // Breakdown bars (0-100)
  trend?:        number
  liquidity?:    number
  consistency?:  number
  value?:        number
  // Averages
  avg1d?:        number
  avg7d?:        number
  avg30d?:       number
  // Market stats
  salesCount30d?:  number
  liquidityLabel?: string   // e.g. "Very High"
  priceRangeLow?:  number
  priceRangeHigh?: number
  // Grading ROI (raw prices)
  psa10price?:   number
  psa9price?:    number
  psa8price?:    number
  // Projections
  proj30d?:      number
  proj60d?:      number
  proj90d?:      number
  // Formatter (passed in so currency matches user preference)
  fmtFn?:        (n: number) => string
}

const W = 1080
const H = 1350
const PAD = 56
const GOLD   = '#d7aa3c'
const GREEN  = '#3cb87a'
const RED    = '#e05252'
const BORDER = 'rgba(255,255,255,0.07)'
const SURF   = 'rgba(255,255,255,0.025)'
const INK    = '#ffffff'
const INK2   = 'rgba(255,255,255,0.45)'
const INK3   = 'rgba(255,255,255,0.28)'
const INK4   = 'rgba(255,255,255,0.22)'

function scoreCol(s: number) {
  return s >= 70 ? GREEN : s >= 50 ? GOLD : RED
}
function changeCol(c: number) { return c >= 0 ? GREEN : RED }

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const safeR = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + safeR, y)
  ctx.lineTo(x + w - safeR, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + safeR)
  ctx.lineTo(x + w, y + h - safeR)
  ctx.quadraticCurveTo(x + w, y + h, x + w - safeR, y + h)
  ctx.lineTo(x + safeR, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - safeR)
  ctx.lineTo(x, y + safeR)
  ctx.quadraticCurveTo(x, y, x + safeR, y)
  ctx.closePath()
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load: ${src}`))
    img.src = src
  })
}

function font(ctx: CanvasRenderingContext2D, sz: number, wt: string | number = 400) {
  ctx.font = `${wt} ${sz}px "Helvetica Neue", Helvetica, Arial, sans-serif`
}

function fillText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  colour: string, sz: number, wt: string | number = 400,
  align: CanvasTextAlign = 'left',
) {
  font(ctx, sz, wt)
  ctx.fillStyle = colour
  ctx.textAlign = align
  ctx.fillText(text, x, y)
}

// Draw a surface card (rounded rect with border)
function drawSurface(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r = 12,
  bg = SURF, border = BORDER,
) {
  ctx.save()
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = bg
  ctx.fill()
  ctx.strokeStyle = border
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

async function drawCard(canvas: HTMLCanvasElement, d: ShareCardData) {
  canvas.width  = W
  canvas.height = H

  const ctx = canvas.getContext('2d')!
  const fmt = d.fmtFn ?? ((n: number) => `$${n.toFixed(2)}`)
  const accent = scoreCol(d.score)

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0b0c0e'
  ctx.fillRect(0, 0, W, H)

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.022)'
  ctx.lineWidth = 1
  const gs = 54
  for (let x = 0; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  // Glow
  const glow = ctx.createRadialGradient(W / 2, H * 0.26, 0, W / 2, H * 0.26, 400)
  glow.addColorStop(0, 'rgba(215,170,60,0.07)')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // ── Top bar (0–80) ─────────────────────────────────────────────────────────
  ctx.textBaseline = 'middle'
  const logoY = 40
  font(ctx, 28, 700)
  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  const cw = ctx.measureText('Card').width
  const iw = ctx.measureText('Index').width
  const totalW = cw + iw
  const logoStartX = W / 2 - totalW / 2
  ctx.fillStyle = INK;   ctx.textAlign = 'left'; ctx.fillText('Card',  logoStartX, logoY)
  ctx.fillStyle = GOLD;                           ctx.fillText('Index', logoStartX + cw, logoY)

  // Separator
  ctx.strokeStyle = BORDER; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, 80); ctx.lineTo(W - PAD, 80); ctx.stroke()

  // ── Top section (card image + identity) ────────────────────────────────────
  const secTop = 116   // 80 topbar + 36 padding
  const cardThumbW = 240
  const cardThumbH = Math.round(cardThumbW * 88 / 63)  // ≈ 335
  const cardThumbR = 14

  // Drop shadow
  ctx.save()
  ctx.shadowColor   = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur    = 32
  ctx.shadowOffsetY = 10
  ctx.fillStyle     = 'rgba(0,0,0,0.01)'
  roundRect(ctx, PAD + 4, secTop + 4, cardThumbW - 8, cardThumbH - 8, cardThumbR)
  ctx.fill()
  ctx.restore()

  // Card image
  try {
    const img = await loadImage(d.imageUrl)
    ctx.save()
    roundRect(ctx, PAD, secTop, cardThumbW, cardThumbH, cardThumbR)
    ctx.clip()
    ctx.drawImage(img, PAD, secTop, cardThumbW, cardThumbH)
    ctx.restore()
  } catch {
    drawSurface(ctx, PAD, secTop, cardThumbW, cardThumbH, cardThumbR, 'rgba(255,255,255,0.03)', BORDER)
    fillText(ctx, '🃏', PAD + cardThumbW / 2, secTop + cardThumbH / 2, INK3, 48, 400, 'center')
  }

  // Card identity (right of image)
  const idX = PAD + cardThumbW + 36
  let idY = secTop + 4

  // Set + grade chip
  font(ctx, 12, 600)
  ctx.fillStyle = INK4; ctx.textAlign = 'left'
  ctx.fillText(d.setName.toUpperCase(), idX, idY + 8)
  const setW = ctx.measureText(d.setName.toUpperCase()).width
  // Grade chip
  const chipX = idX + setW + 10
  const chipW = 80
  drawSurface(ctx, chipX, idY, chipW, 22, 4, 'rgba(215,170,60,0.08)', 'rgba(215,170,60,0.18)')
  font(ctx, 11, 600)
  ctx.fillStyle = 'rgba(215,170,60,0.65)'; ctx.textAlign = 'center'
  ctx.fillText(d.grade, chipX + chipW / 2, idY + 11)
  idY += 30

  // Card name (multiline: break on & or wrap)
  const nameParts = d.cardName.split(/(&)/).map(p => p.trim()).filter(Boolean)
  let nameFz = nameParts.length > 1 ? 36 : 42
  // Reduce if too wide
  font(ctx, nameFz, 700)
  const maxNameW = W - idX - PAD
  while (nameFz > 22 && nameParts.some(p => ctx.measureText(p === '&' ? '' : p).width > maxNameW)) {
    nameFz -= 2; font(ctx, nameFz, 700)
  }
  ctx.fillStyle = INK; ctx.textAlign = 'left'
  const nameLineH = Math.round(nameFz * 1.05)
  const nameLines: string[] = []
  if (nameParts.length <= 1) {
    nameLines.push(d.cardName)
  } else {
    // join back as lines like the template: "Moltres &\nZapdos &\nArticuno GX"
    let cur = ''
    for (const p of nameParts) {
      if (p === '&') { nameLines.push(cur.trim() + ' &'); cur = '' }
      else { cur += p + ' ' }
    }
    if (cur.trim()) nameLines.push(cur.trim())
  }
  for (const line of nameLines) {
    font(ctx, nameFz, 700)
    ctx.fillStyle = INK; ctx.textAlign = 'left'
    ctx.fillText(line, idX, idY + nameFz * 0.8)
    idY += nameLineH
  }
  idY += 16

  // Price
  font(ctx, 50, 700)
  ctx.fillStyle = INK; ctx.textAlign = 'left'
  ctx.fillText(d.priceDisplay, idX, idY + 40)
  idY += 60

  // Change + avgs
  const changeStr = `${d.change >= 0 ? '+' : ''}${d.change.toFixed(1)}% 30d`
  font(ctx, 18, 600)
  ctx.fillStyle = changeCol(d.change); ctx.textAlign = 'left'
  ctx.fillText(changeStr, idX, idY + 14)

  if (d.avg7d || d.avg30d) {
    const avgStr = [
      d.avg7d  ? `7D ${fmt(d.avg7d)}`  : '',
      d.avg30d ? `30D ${fmt(d.avg30d)}` : '',
    ].filter(Boolean).join(' · ')
    font(ctx, 13, 400)
    ctx.fillStyle = INK3; ctx.textAlign = 'left'
    ctx.fillText(avgStr, idX, idY + 36)
  }

  // ── Score row ──────────────────────────────────────────────────────────────
  const srTop = secTop + cardThumbH + 18
  const srH   = 148
  drawSurface(ctx, PAD, srTop, W - PAD * 2, srH, 12)

  // Score circle (left)
  const circleX = PAD + 24 + 48   // center x
  const circleY = srTop + srH / 2
  const circleR = 48
  ctx.save()
  ctx.beginPath()
  ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2)
  ctx.strokeStyle = accent; ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()

  // Score label above circle
  font(ctx, 11, 600)
  ctx.fillStyle = INK4; ctx.textAlign = 'center'
  ctx.fillText('SCORE', circleX, srTop + 18)

  // Score number
  font(ctx, 42, 700)
  ctx.fillStyle = accent; ctx.textAlign = 'center'
  ctx.fillText(String(Math.round(d.score)), circleX, circleY + 14)

  // Score sublabel
  font(ctx, 10, 600)
  ctx.fillStyle = 'rgba(215,170,60,0.45)'; ctx.textAlign = 'center'
  ctx.fillText(d.scoreLabel.toUpperCase(), circleX, circleY + 28)

  // Breakdown bars (right)
  const barsX = PAD + 24 + 96 + 36
  const barsW = W - PAD - 24 - barsX
  const bars  = [
    { label: 'Trend',       val: d.trend       ?? 0 },
    { label: 'Liquidity',   val: d.liquidity   ?? 0 },
    { label: 'Consistency', val: d.consistency ?? 0 },
    { label: 'Value',       val: d.value       ?? 0 },
  ]
  const barH    = 6
  const barSlot = (srH - 8) / 4
  for (let i = 0; i < bars.length; i++) {
    const { label, val } = bars[i]
    const by = srTop + 4 + i * barSlot + barSlot / 2
    const col = scoreCol(val)
    // Label
    font(ctx, 14, 600)
    ctx.fillStyle = INK2; ctx.textAlign = 'left'
    ctx.fillText(label, barsX, by)
    // Value
    font(ctx, 15, 700)
    ctx.fillStyle = col; ctx.textAlign = 'right'
    ctx.fillText(String(Math.round(val)), W - PAD - 24, by)
    // Bar track
    const trackX = barsX + 120
    const trackW = barsW - 120 - 40
    const trackY = by + 10
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    roundRect(ctx, trackX, trackY, trackW, barH, 3)
    ctx.fill()
    // Bar fill
    const fw = Math.max(0, Math.round(trackW * val / 100))
    if (fw > 0) {
      const grad = ctx.createLinearGradient(trackX, 0, trackX + fw, 0)
      grad.addColorStop(0, col + 'bb'); grad.addColorStop(1, col)
      ctx.fillStyle = grad
      roundRect(ctx, trackX, trackY, fw, barH, 3)
      ctx.fill()
    }
  }

  // ── Badges grid (6 badges, 3 cols) ─────────────────────────────────────────
  const bgTop  = srTop + srH + 14
  const bgColW = (W - PAD * 2 - 20) / 3
  const bgH    = 64
  const bgData = [
    { label: 'Liquidity',      value: d.liquidityLabel ?? '—',           colour: d.liquidityLabel ? GREEN : INK },
    { label: '30D Sales',      value: d.salesCount30d ? String(d.salesCount30d) : '—', colour: GOLD },
    { label: 'Price Position', value: (() => {
        if (!d.priceRangeLow || !d.priceRangeHigh) return '—'
        const pos = (d.price - d.priceRangeLow) / (d.priceRangeHigh - d.priceRangeLow)
        return pos < 0.33 ? 'Near low' : pos > 0.66 ? 'Near high' : 'Near midpoint'
      })(), colour: INK2 },
    { label: 'PSA 10 Prem.',   value: d.psa10price && d.price > 0 ? `${(d.psa10price / d.price).toFixed(2)}×` : '—', colour: GOLD },
    { label: 'PSA 9/10 Ratio', value: d.psa10price && d.psa9price ? `${(d.psa9price / d.psa10price).toFixed(2)}×` : '—', colour: INK },
    { label: 'Grading Upside', value: d.psa10price && d.price > 0 ? `+${Math.round((d.psa10price / d.price - 1) * 100)}%` : '—', colour: d.psa10price && d.psa10price > d.price ? GREEN : INK2 },
  ]
  for (let i = 0; i < 6; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const bx  = PAD + col * (bgColW + 10)
    const by  = bgTop + row * (bgH + 10)
    drawSurface(ctx, bx, by, bgColW, bgH, 10)
    font(ctx, 10, 600)
    ctx.fillStyle = INK4; ctx.textAlign = 'left'
    ctx.fillText(bgData[i].label.toUpperCase(), bx + 18, by + 18)
    font(ctx, 19, 700)
    ctx.fillStyle = bgData[i].colour
    ctx.fillText(bgData[i].value, bx + 18, by + 48)
  }

  // ── Moving Average Signal ──────────────────────────────────────────────────
  const ssTop = bgTop + bgH * 2 + 10 + 14
  const ssH   = 110
  const isBullish = (d.avg7d ?? d.price) >= (d.avg30d ?? d.price)
  drawSurface(ctx, PAD, ssTop, W - PAD * 2, ssH, 12)
  // Title
  font(ctx, 10, 600)
  ctx.fillStyle = INK4; ctx.textAlign = 'left'
  ctx.fillText('MOVING AVERAGE SIGNAL', PAD + 22, ssTop + 20)
  // Signal badge
  const sbLabel = isBullish ? '▲ Bullish' : '▼ Bearish'
  const sbCol   = isBullish ? GREEN : RED
  const sbBg    = isBullish ? 'rgba(60,184,122,0.1)' : 'rgba(229,82,82,0.1)'
  const sbBrd   = isBullish ? 'rgba(60,184,122,0.22)' : 'rgba(229,82,82,0.22)'
  font(ctx, 12, 700); const sbW = ctx.measureText(sbLabel).width + 28
  drawSurface(ctx, W - PAD - 22 - sbW, ssTop + 10, sbW, 26, 5, sbBg, sbBrd)
  ctx.fillStyle = sbCol; ctx.textAlign = 'center'
  ctx.fillText(sbLabel, W - PAD - 22 - sbW / 2, ssTop + 23)
  // Avg boxes
  const avgBoxes = [
    { label: 'Current', val: d.priceDisplay,           amber: true },
    { label: '1D Avg',  val: d.avg1d  ? fmt(d.avg1d)  : '—', amber: false },
    { label: '7D Avg',  val: d.avg7d  ? fmt(d.avg7d)  : '—', amber: false },
    { label: '30D Avg', val: d.avg30d ? fmt(d.avg30d) : '—', amber: false },
  ]
  const abW = (W - PAD * 2 - 22 * 2 - 30) / 4
  for (let i = 0; i < 4; i++) {
    const ax = PAD + 22 + i * (abW + 10)
    const ay = ssTop + 38
    drawSurface(ctx, ax, ay, abW, 56, 8, 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.06)')
    font(ctx, 10, 600); ctx.fillStyle = INK4; ctx.textAlign = 'left'
    ctx.fillText(avgBoxes[i].label.toUpperCase(), ax + 16, ay + 16)
    font(ctx, 17, 700)
    ctx.fillStyle = avgBoxes[i].amber ? GOLD : INK
    ctx.fillText(avgBoxes[i].val, ax + 16, ay + 42)
  }

  // ── Projected Price ─────────────────────────────────────────────────────────
  const ppTop = ssTop + ssH + 14
  const ppH   = 110
  drawSurface(ctx, PAD, ppTop, W - PAD * 2, ppH, 12, 'rgba(215,170,60,0.04)', 'rgba(215,170,60,0.16)')
  // Header
  font(ctx, 10, 600)
  ctx.fillStyle = 'rgba(215,170,60,0.6)'; ctx.textAlign = 'left'
  ctx.fillText('PROJECTED PRICE', PAD + 22, ppTop + 20)
  font(ctx, 10, 500)
  ctx.fillStyle = INK4; ctx.textAlign = 'right'
  ctx.fillText(`Based on 30D trend · ${d.grade}`, W - PAD - 22, ppTop + 20)
  // Projection cols
  const projs = [
    { label: '30D Forecast', price: d.proj30d },
    { label: '60D Forecast', price: d.proj60d },
    { label: '90D Forecast', price: d.proj90d },
  ]
  const pcW = (W - PAD * 2 - 22 * 2 - 20) / 3
  for (let i = 0; i < 3; i++) {
    const px   = PAD + 22 + i * (pcW + 10)
    const py   = ppTop + 36
    const prc  = projs[i].price
    const pct  = prc && d.price > 0 ? ((prc - d.price) / d.price * 100) : 0
    const up   = pct >= 0
    const pbg  = up ? 'rgba(60,184,122,0.06)'  : 'rgba(255,255,255,0.03)'
    const pbrd = up ? 'rgba(60,184,122,0.18)'  : 'rgba(255,255,255,0.07)'
    drawSurface(ctx, px, py, pcW, 58, 8, pbg, pbrd)
    font(ctx, 10, 600); ctx.fillStyle = INK3; ctx.textAlign = 'left'
    ctx.fillText(projs[i].label.toUpperCase(), px + 16, py + 16)
    font(ctx, 21, 700)
    ctx.fillStyle = up ? GREEN : INK
    ctx.fillText(prc ? fmt(prc) : '—', px + 16, py + 42)
    if (prc) {
      font(ctx, 12, 600)
      ctx.fillStyle = up ? 'rgba(60,184,122,0.7)' : 'rgba(255,255,255,0.3)'
      ctx.fillText(`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, px + 16 + (ctx.measureText(fmt(prc)).width) + 8, py + 42)
    }
  }

  // ── Grading ROI ─────────────────────────────────────────────────────────────
  const grTop = ppTop + ppH + 14
  const grH   = 116
  // Header
  font(ctx, 10, 600)
  ctx.fillStyle = INK4; ctx.textAlign = 'left'
  ctx.fillText('GRADING ROI', PAD, grTop + 10)
  font(ctx, 10, 500)
  ctx.fillStyle = INK4; ctx.textAlign = 'right'
  ctx.fillText('Economy · $22 · 45–60 days', W - PAD, grTop + 10)

  const gradingCost = 22
  const tiers = [
    { label: 'PSA 10', price: d.psa10price },
    { label: 'PSA 9',  price: d.psa9price  },
    { label: 'PSA 8',  price: d.psa8price  },
  ]
  const gtW = (W - PAD * 2 - 20) / 3
  for (let i = 0; i < 3; i++) {
    const gx  = PAD + i * (gtW + 10)
    const gy  = grTop + 24
    const gh  = grH - 24
    const gp  = tiers[i].price
    const netGain = gp ? gp - d.price - gradingCost : 0
    const roi     = gp && (d.price + gradingCost) > 0 ? (netGain / (d.price + gradingCost) * 100) : 0
    const isBest  = i === 0 && gp && gp > d.price + gradingCost
    const isLoss  = !gp || netGain < 0
    const gbg  = isBest ? 'rgba(60,184,122,0.07)'  : isLoss ? 'rgba(229,82,82,0.04)'  : SURF
    const gbrd = isBest ? 'rgba(60,184,122,0.25)'  : isLoss ? 'rgba(229,82,82,0.14)'  : BORDER
    drawSurface(ctx, gx, gy, gtW, gh, 10, gbg, gbrd)

    // Grade label
    font(ctx, 15, 700)
    ctx.fillStyle = isBest ? GREEN : isLoss ? 'rgba(229,82,82,0.7)' : INK2
    ctx.textAlign = 'left'
    ctx.fillText(tiers[i].label, gx + 16, gy + 26)

    if (isBest) {
      font(ctx, 9, 700)
      ctx.fillStyle = GREEN
      ctx.textAlign = 'right'
      ctx.fillText('BEST', gx + gtW - 14, gy + 26)
    }

    // Graded price
    font(ctx, 24, 700)
    ctx.fillStyle = isBest ? GREEN : isLoss ? 'rgba(229,82,82,0.8)' : INK
    ctx.textAlign = 'left'
    ctx.fillText(gp ? fmt(gp) : '—', gx + 16, gy + 56)

    // ROI line
    if (gp) {
      const roiStr = `${roi >= 0 ? '+' : ''}${Math.round(roi)}% ROI · ${netGain >= 0 ? '+' : ''}${fmt(netGain)}`
      font(ctx, 13, 700)
      ctx.fillStyle = isBest ? GREEN : RED
      ctx.fillText(roiStr, gx + 16, gy + 78)
    }
  }

  // ── Bottom bar ─────────────────────────────────────────────────────────────
  ctx.strokeStyle = BORDER; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, H - 72); ctx.lineTo(W - PAD, H - 72); ctx.stroke()

  font(ctx, 12, 400)
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.textAlign = 'left'
  ctx.fillText('Pokémon TCG · card-index.app', PAD, H - 36)
  ctx.textAlign = 'right'
  ctx.fillText('card-index.app', W - PAD, H - 36)

  ctx.textAlign    = 'left'
  ctx.textBaseline = 'alphabetic'
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function ShareCardModal({
  data,
  onClose,
}: {
  data:    ShareCardData
  onClose: () => void
}) {
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const generate = useCallback(async () => {
    if (!canvasRef.current) return
    setGenerating(true)
    setPreviewUrl(null)
    try {
      await drawCard(canvasRef.current, data)
      setPreviewUrl(canvasRef.current.toDataURL('image/png'))
    } finally {
      setGenerating(false)
    }
  }, [data])

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
        <div style={{
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

          {/* Preview */}
          <div style={{
            borderRadius: 12, overflow: 'hidden',
            background: '#060610', border: '1px solid rgba(255,255,255,0.06)',
            minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {generating && <div style={{ color: '#55556a', fontSize: 13 }}>Generating…</div>}
            {!generating && previewUrl && (
              <img
                src={previewUrl}
                alt="Share preview"
                style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 440, objectFit: 'contain' }}
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
            {generating ? 'Generating…' : 'Download 1080×1350 PNG'}
          </button>

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>
    </>
  )
}
