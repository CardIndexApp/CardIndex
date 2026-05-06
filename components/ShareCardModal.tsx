'use client'

/**
 * ShareCardModal — admin-only
 * Renders a 4:5 or 9:16 shareable PNG of a card's key stats using Canvas 2D.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export interface ShareCardData {
  cardName:   string
  setName:    string
  grade:      string
  score:      number
  scoreLabel: string   // e.g. "Good Buy" | "Hold" | "Undervalued"
  price:      number
  change:     number
  imageUrl:   string
  currency?:  string
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

  const ctx = canvas.getContext('2d')!
  const pad  = 64
  const is916 = ratio === '9:16'

  // ── Background ──────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0,   '#0e0e1c')
  bg.addColorStop(0.6, '#080810')
  bg.addColorStop(1,   '#050510')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // Subtle gold radial glow near top
  const glow = ctx.createRadialGradient(w / 2, h * 0.28, 0, w / 2, h * 0.28, w * 0.7)
  glow.addColorStop(0, 'rgba(232,197,71,0.07)')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  // ── Wordmark ─────────────────────────────────────────────────────────────────
  ctx.textBaseline = 'middle'
  const logoSize = is916 ? 34 : 30
  const logoY    = pad - 4
  ctx.font      = `700 ${logoSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = '#f0f0f8'
  ctx.textAlign = 'left'
  ctx.fillText('Card', pad, logoY)
  const cardW = ctx.measureText('Card').width
  ctx.fillStyle = '#e8c547'
  ctx.fillText('Index', pad + cardW, logoY)

  // URL — right-aligned
  const urlFont = `400 ${is916 ? 20 : 18}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.font      = urlFont
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.textAlign = 'right'
  ctx.fillText('card-index.app', w - pad, logoY)
  ctx.textAlign = 'left'

  // ── Card image ───────────────────────────────────────────────────────────────
  const imgAreaTop = logoY + logoSize / 2 + 44
  const imgW = is916 ? Math.round(w * 0.52) : Math.round(w * 0.50)
  const imgH = Math.round(imgW * (3.5 / 2.5))
  const imgX = Math.round((w - imgW) / 2)
  const imgY = imgAreaTop

  // Draw card image — no clip so the PNG's own natural rounded corners show
  // through, matching how the card results page displays them (objectFit:contain).
  try {
    const img = await loadImage(data.imageUrl)

    // Drop-shadow pass: draw a semi-transparent rect behind the image
    ctx.save()
    ctx.shadowColor   = 'rgba(0,0,0,0.85)'
    ctx.shadowBlur    = 56
    ctx.shadowOffsetY = 20
    ctx.fillStyle     = 'rgba(0,0,0,0.01)'
    roundRect(ctx, imgX + 8, imgY + 8, imgW - 16, imgH - 16, 16)
    ctx.fill()
    ctx.restore()

    // Draw the image directly — the PNG's own corners are already transparent
    ctx.drawImage(img, imgX, imgY, imgW, imgH)
  } catch {
    // Fallback rounded rect placeholder
    ctx.save()
    ctx.fillStyle = '#1a1a2e'
    roundRect(ctx, imgX, imgY, imgW, imgH, 16)
    ctx.fill()
    ctx.restore()
    ctx.font      = '400 40px Helvetica, Arial, sans-serif'
    ctx.fillStyle = '#55556a'
    ctx.textAlign = 'center'
    ctx.fillText('🃏', w / 2, imgY + imgH / 2)
    ctx.textAlign = 'left'
  }

  // ── Card name ────────────────────────────────────────────────────────────────
  let y = imgY + imgH + (is916 ? 52 : 44)

  const nameFontSize = is916 ? 52 : 44
  ctx.font      = `800 ${nameFontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = '#f0f0f8'
  ctx.textAlign = 'center'

  // Simple word-wrap into max 2 lines
  const maxW = w - pad * 2
  const words = data.cardName.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur); cur = word
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)

  for (const line of lines.slice(0, 2)) {
    ctx.fillText(line, w / 2, y)
    y += nameFontSize + 10
  }
  y += 6

  // Set · Grade
  ctx.font      = `400 ${is916 ? 28 : 25}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = '#9898b8'
  ctx.fillText(`${data.setName}  ·  ${data.grade}`, w / 2, y)
  y += is916 ? 60 : 52

  // ── Divider ──────────────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.moveTo(pad, y)
  ctx.lineTo(w - pad, y)
  ctx.stroke()
  y += is916 ? 52 : 46

  // ── Stats row: Price | CI Score | 30D Change ─────────────────────────────────
  const colW       = (w - pad * 2) / 3
  const labelFont  = `400 ${is916 ? 22 : 20}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  const valueFont  = `800 ${is916 ? 58 : 52}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  const valueShift = is916 ? 72 : 64

  const stats = [
    {
      label: 'PRICE',
      value: `$${data.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      color: '#f0f0f8',
    },
    {
      label: 'CI SCORE',
      value: String(Math.round(data.score)),
      color: scoreCol(data.score),
    },
    {
      label: '30D CHANGE',
      value: `${data.change >= 0 ? '+' : ''}${data.change.toFixed(1)}%`,
      color: changeCol(data.change),
    },
  ]

  stats.forEach(({ label, value, color }, i) => {
    const cx = pad + colW * i + colW / 2
    ctx.font      = labelFont
    ctx.fillStyle = '#55556a'
    ctx.textAlign = 'center'
    ctx.fillText(label, cx, y)
    ctx.font      = valueFont
    ctx.fillStyle = color
    ctx.fillText(value, cx, y + valueShift)
  })
  y += valueShift + (is916 ? 60 : 52)

  // Second divider
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.moveTo(pad, y)
  ctx.lineTo(w - pad, y)
  ctx.stroke()
  y += is916 ? 52 : 44

  // ── Score breakdown bars (9:16 only) ─────────────────────────────────────────
  if (is916) {
    const hasBars = [data.trend, data.liquidity, data.consistency, data.value].some(v => v != null)
    if (hasBars) {
      const bars = [
        { label: 'Trend',       val: data.trend       ?? 0 },
        { label: 'Liquidity',   val: data.liquidity   ?? 0 },
        { label: 'Consistency', val: data.consistency ?? 0 },
        { label: 'Value',       val: data.value       ?? 0 },
      ]

      ctx.font      = '600 20px "Helvetica Neue", Helvetica, Arial, sans-serif'
      ctx.fillStyle = '#55556a'
      ctx.textAlign = 'center'
      ctx.fillText('SCORE BREAKDOWN', w / 2, y)
      y += 44

      const barW = w - pad * 2
      const barH = 12
      const gap  = 50

      for (const { label, val } of bars) {
        ctx.font      = '500 24px "Helvetica Neue", Helvetica, Arial, sans-serif'
        ctx.fillStyle = '#9898b8'
        ctx.textAlign = 'left'
        ctx.fillText(label, pad, y)

        ctx.font      = '700 24px "Helvetica Neue", Helvetica, Arial, sans-serif'
        ctx.fillStyle = scoreCol(val)
        ctx.textAlign = 'right'
        ctx.fillText(String(Math.round(val)), w - pad, y)

        y += 20
        // track
        ctx.fillStyle = 'rgba(255,255,255,0.07)'
        roundRect(ctx, pad, y, barW, barH, 6)
        ctx.fill()
        // fill
        const fw = Math.max(0, Math.round(barW * val / 100))
        if (fw > 0) {
          ctx.fillStyle = scoreCol(val)
          roundRect(ctx, pad, y, fw, barH, 6)
          ctx.fill()
        }
        y += barH + gap
      }

      y += 8
    }
  }

  // ── Verdict badge ─────────────────────────────────────────────────────────────
  if (data.scoreLabel) {
    const col  = scoreCol(data.score)
    const text = data.scoreLabel.toUpperCase()
    const bFs  = is916 ? 30 : 26
    ctx.font   = `700 ${bFs}px "Helvetica Neue", Helvetica, Arial, sans-serif`
    const tw   = ctx.measureText(text).width
    const bPad = 30
    const bH   = is916 ? 60 : 54
    const bX   = (w - tw - bPad * 2) / 2

    ctx.fillStyle = `${col}20`
    roundRect(ctx, bX, y, tw + bPad * 2, bH, 30)
    ctx.fill()

    ctx.strokeStyle = `${col}55`
    ctx.lineWidth   = 1.5
    roundRect(ctx, bX, y, tw + bPad * 2, bH, 30)
    ctx.stroke()

    ctx.fillStyle = col
    ctx.textAlign = 'center'
    ctx.fillText(text, w / 2, y + bH / 2)
    y += bH + 32
  }

  // ── Bottom branding ───────────────────────────────────────────────────────────
  ctx.font      = `400 ${is916 ? 24 : 21}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.textAlign = 'center'
  ctx.fillText('CardIndex · Real market data for TCG collectors', w / 2, h - pad + 4)

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
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 1000, backdropFilter: 'blur(4px)' }}
      />

      {/* Modal */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}>
        <div style={{
          pointerEvents: 'auto',
          background: '#111120', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20, padding: 24, width: '100%', maxWidth: 540,
          maxHeight: '92vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#e8c547', letterSpacing: 2, marginBottom: 2, fontWeight: 600 }}>ADMIN — EXPORT</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f8' }}>Share Card</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#55556a', fontSize: 24, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
          </div>

          {/* Ratio toggle */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['4:5', '9:16'] as Ratio[]).map(r => (
              <button
                key={r}
                onClick={() => setRatio(r)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${ratio === r ? '#e8c547' : 'rgba(255,255,255,0.1)'}`,
                  background: ratio === r ? 'rgba(232,197,71,0.1)' : 'transparent',
                  color: ratio === r ? '#e8c547' : '#9898b8',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700 }}>{r}</div>
                <div style={{ fontSize: 10, opacity: 0.65, marginTop: 2 }}>
                  {r === '4:5' ? '1080 × 1350 · Post' : '1080 × 1920 · Story'}
                </div>
              </button>
            ))}
          </div>

          {/* Preview */}
          <div style={{
            borderRadius: 12, overflow: 'hidden',
            background: '#080810', border: '1px solid rgba(255,255,255,0.07)',
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
                  maxHeight: ratio === '9:16' ? 460 : 340,
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
              padding: '14px 0', borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: generating || !previewUrl ? 'rgba(232,197,71,0.3)' : '#e8c547',
              border: 'none', color: '#080810',
              cursor: generating || !previewUrl ? 'default' : 'pointer',
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
