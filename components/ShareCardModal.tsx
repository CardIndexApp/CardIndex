'use client'

/**
 * ShareCardModal — admin-only
 * Renders a 4:5 or 9:16 shareable PNG using Canvas 2D.
 * Breakdown values (trend/liquidity/consistency/value) must be passed as 0-100.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export interface ShareCardData {
  cardName:     string
  setName:      string
  grade:        string
  score:        number
  scoreLabel:   string
  price:        number        // raw USD (for colour decisions)
  priceDisplay: string        // pre-formatted with user currency + symbol
  change:       number
  imageUrl:     string
  // 0-100 normalised (caller normalises from raw breakdown values)
  trend?:       number
  liquidity?:   number
  consistency?: number
  value?:       number
}

type Ratio = '4:5' | '9:16'

const RATIO_DIMS: Record<Ratio, { w: number; h: number }> = {
  '4:5':  { w: 1080, h: 1350 },
  '9:16': { w: 1080, h: 1920 },
}

function scoreCol(s: number) {
  return s >= 80 ? '#3de88a' : s >= 60 ? '#e8c547' : '#e8524a'
}
function changeCol(c: number) { return c >= 0 ? '#3de88a' : '#e8524a' }

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
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

// Fit a string into maxWidth by reducing font size
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startFz: number,
  minFz = 24,
  weight = '800',
) {
  let fz = startFz
  ctx.font = `${weight} ${fz}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  while (ctx.measureText(text).width > maxWidth && fz > minFz) {
    fz -= 2
    ctx.font = `${weight} ${fz}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  }
  return fz
}

async function drawCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  ratio: Ratio,
) {
  const { w, h } = RATIO_DIMS[ratio]
  canvas.width  = w
  canvas.height = h

  const ctx   = canvas.getContext('2d')!
  const pad   = 56
  const is916 = ratio === '9:16'
  const accent = scoreCol(data.score)

  // ── Background ───────────────────────────────────────────────────────────────
  ctx.fillStyle = '#080810'
  ctx.fillRect(0, 0, w, h)

  // Subtle radial glow tinted by score colour in the upper area
  const glowR = ctx.createRadialGradient(w / 2, h * 0.22, 0, w / 2, h * 0.22, w * 0.6)
  glowR.addColorStop(0,   accent + '18')
  glowR.addColorStop(0.7, accent + '04')
  glowR.addColorStop(1,   'transparent')
  ctx.fillStyle = glowR
  ctx.fillRect(0, 0, w, h)

  // ── Logo bar ─────────────────────────────────────────────────────────────────
  ctx.textBaseline = 'middle'
  const logoSz = is916 ? 30 : 28
  const logoY  = 52
  ctx.font      = `700 ${logoSz}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = '#f0f0f8'
  ctx.textAlign = 'left'
  ctx.fillText('Card', pad, logoY)
  const cw = ctx.measureText('Card').width
  ctx.fillStyle = '#e8c547'
  ctx.fillText('Index', pad + cw, logoY)
  ctx.font      = `400 15px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.textAlign = 'right'
  ctx.fillText('card-index.app', w - pad, logoY)

  const sepY = logoY + logoSz / 2 + 22
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth   = 1
  ctx.beginPath(); ctx.moveTo(pad, sepY); ctx.lineTo(w - pad, sepY); ctx.stroke()

  // ── Two-column: Card image (left) | Stats (right) ────────────────────────────
  const sectionTop = sepY + (is916 ? 36 : 28)

  // Card image column — 38% of canvas width
  const cardColW = Math.round(w * (is916 ? 0.37 : 0.38))
  const cardH    = Math.round(cardColW * (3.5 / 2.5))
  const cardX    = pad
  const cardY    = sectionTop
  // Corner radius: ~9% of card width — matching the thumbnail proportion (8px on 88px container)
  const cardR    = Math.round(cardColW * 0.09)

  try {
    const img = await loadImage(data.imageUrl)
    // Drop shadow
    ctx.save()
    ctx.shadowColor   = 'rgba(0,0,0,0.88)'
    ctx.shadowBlur    = 40
    ctx.shadowOffsetY = 14
    ctx.fillStyle     = 'rgba(0,0,0,0.01)'
    roundRect(ctx, cardX + 8, cardY + 8, cardColW - 16, cardH - 16, cardR)
    ctx.fill()
    ctx.restore()
    // Clip & draw
    ctx.save()
    roundRect(ctx, cardX, cardY, cardColW, cardH, cardR)
    ctx.clip()
    ctx.drawImage(img, cardX, cardY, cardColW, cardH)
    ctx.restore()
  } catch {
    ctx.save()
    ctx.fillStyle = '#1a1a2e'
    roundRect(ctx, cardX, cardY, cardColW, cardH, cardR)
    ctx.fill()
    ctx.restore()
    ctx.font      = '400 44px Helvetica, Arial, sans-serif'
    ctx.fillStyle = '#55556a'
    ctx.textAlign = 'center'
    ctx.fillText('🃏', cardX + cardColW / 2, cardY + cardH / 2)
  }

  // ── Right column: CI Score + Price ───────────────────────────────────────────
  const rightGap = is916 ? 48 : 40
  const rightX   = pad + cardColW + rightGap
  const rightW   = w - rightX - pad

  // Font sizes
  const scoreFz   = is916 ? 108 : 96
  const priceFz   = is916 ? 54  : 50
  const changeFz  = is916 ? 28  : 24
  const labelFz   = is916 ? 17  : 15

  // Measure total content height so we can vertically centre it in the card column
  const blockGap   = is916 ? 44 : 36    // gap between score block and price block
  const innerGap   = is916 ? 10 : 8     // gap between label and value
  const contentH   = labelFz + innerGap + scoreFz + blockGap + labelFz + innerGap + priceFz + 12 + changeFz
  const rightStartY = cardY + Math.round((cardH - contentH) / 2)

  let ry = rightStartY

  // Helper: draw left-aligned text with textBaseline = 'middle' at centre y
  const drawLeft = (text: string, cy: number, fz: number, wt: string, colour: string) => {
    ctx.font      = `${wt} ${fz}px "Helvetica Neue", Helvetica, Arial, sans-serif`
    ctx.fillStyle = colour
    ctx.textAlign = 'left'
    ctx.fillText(text, rightX, cy)
  }

  // CARDINDEX SCORE label
  drawLeft('CARDINDEX SCORE', ry, labelFz, '600', '#55556a')
  ry += labelFz / 2 + innerGap + scoreFz / 2

  // Score
  fitFont(ctx, String(Math.round(data.score)), rightW, scoreFz, 48, '800')
  ctx.fillStyle = accent
  ctx.textAlign = 'left'
  ctx.fillText(String(Math.round(data.score)), rightX, ry)
  ry += scoreFz / 2 + blockGap + labelFz / 2

  // MARKET PRICE label
  drawLeft('MARKET PRICE', ry, labelFz, '600', '#55556a')
  ry += labelFz / 2 + innerGap + priceFz / 2

  // Price — shrink to fit
  const actualPriceFz = fitFont(ctx, data.priceDisplay, rightW, priceFz, 24, '800')
  ctx.fillStyle = '#f0f0f8'
  ctx.textAlign = 'left'
  ctx.fillText(data.priceDisplay, rightX, ry)
  ry += actualPriceFz / 2 + 14 + changeFz / 2

  // Change % with (30d)
  const changeStr = `${data.change >= 0 ? '+' : ''}${data.change.toFixed(1)}% (30d)`
  drawLeft(changeStr, ry, changeFz, '700', changeCol(data.change))

  // ── Below two columns ─────────────────────────────────────────────────────────
  let y = cardY + cardH + (is916 ? 52 : 40)

  // Card name + set · grade (compact, centred)
  const nameFz = is916 ? 28 : 24
  const metaFz = is916 ? 17 : 15
  ctx.font      = `700 ${nameFz}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = '#f0f0f8'
  ctx.textAlign = 'center'
  ctx.fillText(data.cardName, w / 2, y)
  y += nameFz / 2 + 10 + metaFz / 2

  ctx.font      = `400 ${metaFz}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = '#55556a'
  ctx.fillText(`${data.setName}  ·  ${data.grade}`, w / 2, y)
  y += metaFz / 2 + (is916 ? 44 : 36)

  // Divider
  const drawRule = () => {
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth   = 1
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke()
  }
  drawRule(); y += is916 ? 52 : 40

  // ── Score breakdown bars ──────────────────────────────────────────────────────
  const hasBars = [data.trend, data.liquidity, data.consistency, data.value]
    .some(v => v != null)

  if (hasBars) {
    const bars = [
      { label: 'Trend',       val: data.trend       ?? 0 },
      { label: 'Liquidity',   val: data.liquidity   ?? 0 },
      { label: 'Consistency', val: data.consistency ?? 0 },
      { label: 'Value',       val: data.value       ?? 0 },
    ]

    const blFz  = is916 ? 32 : 28   // bar label font size
    const barH  = is916 ? 14 : 12
    const barW  = w - pad * 2
    const barGap = is916 ? 52 : 44  // gap between bottom of bar and top of next label

    for (const { label, val } of bars) {
      const col = scoreCol(val)

      // Label (left) + value (right) on same baseline
      ctx.font      = `700 ${blFz}px "Helvetica Neue", Helvetica, Arial, sans-serif`
      ctx.fillStyle = '#f0f0f8'
      ctx.textAlign = 'left'
      ctx.fillText(label, pad, y)
      ctx.fillStyle = col
      ctx.textAlign = 'right'
      ctx.fillText(String(Math.round(val)), w - pad, y)

      // Advance from text centre to bar top
      const textToBar = Math.round(blFz / 2) + 10
      const barTop    = y + textToBar

      // Track
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      roundRect(ctx, pad, barTop, barW, barH, Math.floor(barH / 2))
      ctx.fill()

      // Fill with gradient
      const fw = Math.max(0, Math.round(barW * val / 100))
      if (fw > 0) {
        const grad = ctx.createLinearGradient(pad, 0, pad + fw, 0)
        grad.addColorStop(0, col + 'bb')
        grad.addColorStop(1, col)
        ctx.fillStyle = grad
        roundRect(ctx, pad, barTop, fw, barH, Math.floor(barH / 2))
        ctx.fill()
      }

      y = barTop + barH + barGap
    }
    // Remove trailing gap, add a small bottom margin
    y -= barGap
    y += is916 ? 44 : 36
  }

  // ── Branding ──────────────────────────────────────────────────────────────────
  ctx.font      = `400 17px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.textAlign = 'center'
  ctx.fillText('CardIndex · Real market data for TCG collectors', w / 2, h - 36)

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
  const [ratio, setRatio]           = useState<Ratio>('9:16')
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const generate = useCallback(async (r: Ratio) => {
    if (!canvasRef.current) return
    setGenerating(true)
    setPreviewUrl(null)
    try {
      await drawCard(canvasRef.current, data, r)
      setPreviewUrl(canvasRef.current.toDataURL('image/png'))
    } finally {
      setGenerating(false)
    }
  }, [data])

  useEffect(() => { generate(ratio) }, [ratio, generate])

  function download() {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href     = previewUrl
    a.download = `cardindex-${data.cardName.replace(/\s+/g, '-').toLowerCase()}-${ratio.replace(':', 'x')}.png`
    a.click()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
      />

      {/* Panel */}
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
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: '#e8c547', marginBottom: 3 }}>ADMIN — EXPORT</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f8' }}>Share Card</div>
              <div style={{ fontSize: 11, color: '#55556a', marginTop: 3 }}>{data.cardName}</div>
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

          {/* Ratio toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['4:5', '9:16'] as Ratio[]).map(r => (
              <button
                key={r}
                onClick={() => setRatio(r)}
                style={{
                  padding: '10px 0', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${ratio === r ? '#e8c547' : 'rgba(255,255,255,0.08)'}`,
                  background: ratio === r ? 'rgba(232,197,71,0.08)' : 'rgba(255,255,255,0.02)',
                  color: ratio === r ? '#e8c547' : '#55556a',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700 }}>{r}</div>
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
                  {r === '4:5' ? '1080 × 1350 · Post' : '1080 × 1920 · Story'}
                </div>
              </button>
            ))}
          </div>

          {/* Preview */}
          <div style={{
            borderRadius: 12, overflow: 'hidden',
            background: '#060610', border: '1px solid rgba(255,255,255,0.06)',
            minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {generating && <div style={{ color: '#55556a', fontSize: 13 }}>Generating…</div>}
            {!generating && previewUrl && (
              <img
                src={previewUrl}
                alt="Share preview"
                style={{
                  width: '100%', height: 'auto', display: 'block',
                  maxHeight: ratio === '9:16' ? 500 : 380,
                  objectFit: 'contain',
                }}
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
            {generating ? 'Generating…' : `Download ${ratio} PNG`}
          </button>

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>
    </>
  )
}
