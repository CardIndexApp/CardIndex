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
  price:        number        // raw USD value (used for color decisions)
  priceDisplay: string        // pre-formatted with user's currency + symbol
  change:       number
  imageUrl:     string
  // 0-100 normalized (caller normalises from raw breakdown values)
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

// Exact thresholds from lib/data.ts → scoreColor
function scoreCol(s: number) {
  return s >= 80 ? '#3de88a' : s >= 60 ? '#e8c547' : '#e8524a'
}
function changeCol(c: number) {
  return c >= 0 ? '#3de88a' : '#e8524a'
}

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

async function drawCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  ratio: Ratio,
) {
  const { w, h } = RATIO_DIMS[ratio]
  canvas.width  = w
  canvas.height = h

  const ctx    = canvas.getContext('2d')!
  const pad    = 60
  const is916  = ratio === '9:16'
  const accent = scoreCol(data.score)

  // ─── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#080810'
  ctx.fillRect(0, 0, w, h)

  // Faint score-coloured radial glow centred on where the card will be
  const glowCY = h * (is916 ? 0.30 : 0.32)
  const glow   = ctx.createRadialGradient(w / 2, glowCY, 0, w / 2, glowCY, w * 0.65)
  glow.addColorStop(0,   accent + '22')  // ~13 % opacity
  glow.addColorStop(0.5, accent + '08')  // ~3 %
  glow.addColorStop(1,   'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  // ─── Logo bar ────────────────────────────────────────────────────────────────
  const logoSz = is916 ? 32 : 28
  const logoY  = 52
  ctx.textBaseline = 'middle'
  ctx.textAlign    = 'left'
  ctx.font      = `700 ${logoSz}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = '#f0f0f8'
  ctx.fillText('Card', pad, logoY)
  const cardW = ctx.measureText('Card').width
  ctx.fillStyle = '#e8c547'
  ctx.fillText('Index', pad + cardW, logoY)

  ctx.font      = `400 ${is916 ? 17 : 15}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.textAlign = 'right'
  ctx.fillText('card-index.app', w - pad, logoY)
  ctx.textAlign = 'left'

  // Thin separator below logo
  const sepY = logoY + logoSz / 2 + 20
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth   = 1
  ctx.beginPath(); ctx.moveTo(pad, sepY); ctx.lineTo(w - pad, sepY); ctx.stroke()

  // ─── Card image ──────────────────────────────────────────────────────────────
  const imgTop = sepY + 28
  // 4:5 → 50% width · 9:16 → 54% width
  const imgW   = is916 ? Math.round(w * 0.54) : Math.round(w * 0.50)
  const imgH   = Math.round(imgW * (3.5 / 2.5))
  const imgX   = Math.round((w - imgW) / 2)
  const imgY   = imgTop
  // Proportionally match the lightbox `borderRadius:16` at max-width 420 px
  const imgR   = Math.round(16 / 420 * imgW)

  try {
    const img = await loadImage(data.imageUrl)

    // Accent glow behind card
    ctx.save()
    ctx.shadowColor   = accent + '55'
    ctx.shadowBlur    = 72
    ctx.shadowOffsetY = 8
    ctx.fillStyle     = 'rgba(0,0,0,0.01)'
    roundRect(ctx, imgX, imgY, imgW, imgH, imgR)
    ctx.fill()
    ctx.restore()

    // Drop shadow
    ctx.save()
    ctx.shadowColor   = 'rgba(0,0,0,0.90)'
    ctx.shadowBlur    = 44
    ctx.shadowOffsetY = 18
    ctx.fillStyle     = 'rgba(0,0,0,0.01)'
    roundRect(ctx, imgX + 10, imgY + 10, imgW - 20, imgH - 20, imgR)
    ctx.fill()
    ctx.restore()

    // Clip to the same radius the lightbox uses, then draw
    ctx.save()
    roundRect(ctx, imgX, imgY, imgW, imgH, imgR)
    ctx.clip()
    ctx.drawImage(img, imgX, imgY, imgW, imgH)
    ctx.restore()

  } catch {
    ctx.save()
    ctx.fillStyle = '#1a1a2e'
    roundRect(ctx, imgX, imgY, imgW, imgH, imgR)
    ctx.fill()
    ctx.restore()
    ctx.font      = '400 52px Helvetica, Arial, sans-serif'
    ctx.fillStyle = '#55556a'
    ctx.textAlign = 'center'
    ctx.fillText('🃏', w / 2, imgY + imgH / 2)
    ctx.textAlign = 'left'
  }

  // ─── Card name + set/grade ───────────────────────────────────────────────────
  let y = imgY + imgH + (is916 ? 44 : 36)

  const nameFz = is916 ? 46 : 44
  ctx.font      = `800 ${nameFz}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = '#f0f0f8'
  ctx.textAlign = 'center'

  // Word-wrap into at most 2 lines
  const maxTW = w - pad * 2
  const words  = data.cardName.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (ctx.measureText(test).width > maxTW && cur) { lines.push(cur); cur = word }
    else cur = test
  }
  if (cur) lines.push(cur)
  for (const line of lines.slice(0, 2)) {
    ctx.fillText(line, w / 2, y)
    y += nameFz + 8
  }
  y += 2

  ctx.font      = `400 ${is916 ? 25 : 23}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = '#9898b8'
  ctx.fillText(`${data.setName}  ·  ${data.grade}`, w / 2, y)
  y += (is916 ? 25 : 23) + (is916 ? 46 : 42)

  // ─── Divider ─────────────────────────────────────────────────────────────────
  const drawRule = (cy: number) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth   = 1
    ctx.beginPath(); ctx.moveTo(pad, cy); ctx.lineTo(w - pad, cy); ctx.stroke()
  }
  drawRule(y); y += is916 ? 48 : 42

  // ─── Stats row: PRICE | CI SCORE | 30D CHANGE ────────────────────────────────
  const colW      = (w - pad * 2) / 3
  const labelFz   = is916 ? 18 : 16
  const valueFz   = is916 ? 54 : 50
  const valueShift = is916 ? 66 : 60

  const stats = [
    {
      label: 'PRICE',
      value: data.priceDisplay,
      color: '#f0f0f8',
    },
    {
      label: 'CI SCORE',
      value: String(Math.round(data.score)),
      color: accent,
    },
    {
      label: '30D CHANGE',
      value: `${data.change >= 0 ? '+' : ''}${data.change.toFixed(1)}%`,
      color: changeCol(data.change),
    },
  ]

  const statLabelFont = `600 ${labelFz}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  const statValueFont = `800 ${valueFz}px "Helvetica Neue", Helvetica, Arial, sans-serif`

  stats.forEach(({ label, value, color }, i) => {
    const cx = pad + colW * i + colW / 2
    ctx.font = statLabelFont; ctx.fillStyle = '#55556a'; ctx.textAlign = 'center'
    ctx.fillText(label, cx, y)
    ctx.font = statValueFont; ctx.fillStyle = color
    ctx.fillText(value, cx, y + valueShift)
  })
  y += valueShift + (is916 ? 54 : 48)

  drawRule(y); y += is916 ? 48 : 40

  // ─── Score breakdown bars (9:16 only) ────────────────────────────────────────
  if (is916) {
    const hasBars = [data.trend, data.liquidity, data.consistency, data.value]
      .some(v => v != null)

    if (hasBars) {
      const bars = [
        { label: 'Trend',       val: data.trend       ?? 0 },
        { label: 'Liquidity',   val: data.liquidity   ?? 0 },
        { label: 'Consistency', val: data.consistency ?? 0 },
        { label: 'Value',       val: data.value       ?? 0 },
      ]

      ctx.font      = `600 17px "Helvetica Neue", Helvetica, Arial, sans-serif`
      ctx.fillStyle = '#55556a'
      ctx.textAlign = 'center'
      ctx.fillText('SCORE BREAKDOWN', w / 2, y)
      y += 44

      const barW = w - pad * 2
      const barH = 10
      const gap  = 46

      for (const { label, val } of bars) {
        const barCol = scoreCol(val)
        ctx.font      = `500 22px "Helvetica Neue", Helvetica, Arial, sans-serif`
        ctx.fillStyle = '#9898b8'; ctx.textAlign = 'left'
        ctx.fillText(label, pad, y)
        ctx.font      = `700 22px "Helvetica Neue", Helvetica, Arial, sans-serif`
        ctx.fillStyle = barCol; ctx.textAlign = 'right'
        ctx.fillText(String(Math.round(val)), w - pad, y)
        y += 18

        // Track
        ctx.fillStyle = 'rgba(255,255,255,0.07)'
        roundRect(ctx, pad, y, barW, barH, 5); ctx.fill()
        // Fill — with a subtle gradient along the bar
        const fw = Math.max(0, Math.round(barW * val / 100))
        if (fw > 0) {
          const barGrad = ctx.createLinearGradient(pad, 0, pad + fw, 0)
          barGrad.addColorStop(0, barCol + 'cc')  // slightly dimmer at start
          barGrad.addColorStop(1, barCol)
          ctx.fillStyle = barGrad
          roundRect(ctx, pad, y, fw, barH, 5); ctx.fill()
        }
        y += barH + gap
      }

      y += 4
      drawRule(y); y += 48
    }
  }

  // ─── Verdict badge ───────────────────────────────────────────────────────────
  if (data.scoreLabel) {
    const text  = data.scoreLabel.toUpperCase()
    const bFz   = is916 ? 28 : 25
    const bH    = is916 ? 58 : 52
    const bPadX = 32
    ctx.font    = `700 ${bFz}px "Helvetica Neue", Helvetica, Arial, sans-serif`
    const tw    = ctx.measureText(text).width
    const bX    = (w - tw - bPadX * 2) / 2

    // Badge fill
    ctx.fillStyle = accent + '1a'
    roundRect(ctx, bX, y, tw + bPadX * 2, bH, 30); ctx.fill()
    // Badge border
    ctx.strokeStyle = accent + '55'; ctx.lineWidth = 1.5
    roundRect(ctx, bX, y, tw + bPadX * 2, bH, 30); ctx.stroke()
    // Badge text
    ctx.fillStyle = accent; ctx.textAlign = 'center'
    ctx.fillText(text, w / 2, y + bH / 2)
    y += bH + 28
  }

  // ─── Bottom branding ─────────────────────────────────────────────────────────
  ctx.font      = `400 ${is916 ? 21 : 19}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.textAlign = 'center'
  ctx.fillText('CardIndex · Real market data for TCG collectors', w / 2, h - 38)

  // Reset
  ctx.textAlign    = 'left'
  ctx.textBaseline = 'alphabetic'
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function ShareCardModal({
  data,
  onClose,
}: {
  data:    ShareCardData
  onClose: () => void
}) {
  const [ratio, setRatio]           = useState<Ratio>('4:5')
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
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(6px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, pointerEvents: 'none',
      }}>
        <div style={{
          pointerEvents: 'auto',
          background: '#0e0e1c',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 24,
          width: '100%', maxWidth: 520,
          maxHeight: '92vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: '#e8c547', marginBottom: 3 }}>
                ADMIN — EXPORT
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f8' }}>Share Card</div>
              <div style={{ fontSize: 11, color: '#55556a', marginTop: 3 }}>{data.cardName}</div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, color: '#9898b8', fontSize: 18, cursor: 'pointer',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
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
                <div style={{ fontSize: 10, opacity: 0.65, marginTop: 2 }}>
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
            {generating && (
              <div style={{ color: '#55556a', fontSize: 13 }}>Generating…</div>
            )}
            {!generating && previewUrl && (
              <img
                src={previewUrl}
                alt="Card share preview"
                style={{
                  width: '100%', height: 'auto', display: 'block',
                  maxHeight: ratio === '9:16' ? 480 : 360,
                  objectFit: 'contain',
                }}
              />
            )}
          </div>

          {/* Download button */}
          <button
            onClick={download}
            disabled={generating || !previewUrl}
            style={{
              padding: '14px 0', borderRadius: 12,
              background: generating || !previewUrl ? 'rgba(232,197,71,0.25)' : '#e8c547',
              border: 'none', color: '#08080f',
              fontSize: 14, fontWeight: 800, letterSpacing: 0.5,
              cursor: generating || !previewUrl ? 'default' : 'pointer',
              transition: 'opacity 0.15s',
            }}
          >
            {generating ? 'Generating…' : `Download ${ratio} PNG`}
          </button>

          {/* Hidden canvas */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>
    </>
  )
}
