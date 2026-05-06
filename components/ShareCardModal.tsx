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
  imageUrl:   string   // proxied /api/img?url=... or direct pokemontcg URL
  currency?:  string
  // Score breakdown (0-100 each)
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

// ── Colours ───────────────────────────────────────────────────────────────────

function scoreCol(s: number) {
  return s >= 80 ? '#3de88a' : s >= 60 ? '#e8c547' : '#e8524a'
}
function changeCol(c: number) {
  return c >= 0 ? '#3de88a' : '#e8524a'
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

// ── Main draw function ────────────────────────────────────────────────────────

async function drawCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  ratio: Ratio,
) {
  const { w, h } = RATIO_DIMS[ratio]
  canvas.width  = w
  canvas.height = h

  const ctx = canvas.getContext('2d')!
  const pad = 64

  // ── Background ──────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0,   '#0c0c1a')
  bg.addColorStop(0.5, '#080810')
  bg.addColorStop(1,   '#0a0a14')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // Subtle radial glow in the centre
  const glow = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, w * 0.7)
  glow.addColorStop(0, 'rgba(232,197,71,0.06)')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  // ── CardIndex wordmark ───────────────────────────────────────────────────────
  ctx.textBaseline = 'middle'
  const logoY = pad + 16

  // "Card" in white
  ctx.font      = `700 ${ratio === '9:16' ? 36 : 32}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = '#f0f0f8'
  ctx.fillText('Card', pad, logoY)
  const cardW = ctx.measureText('Card').width

  // "Index" in gold
  ctx.fillStyle = '#e8c547'
  ctx.fillText('Index', pad + cardW, logoY)

  // Separator dot
  const totalLogoW = cardW + ctx.measureText('Index').width
  ctx.font      = '400 20px Helvetica, Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillText('  ·  card-index.app', pad + totalLogoW, logoY)

  // ── Card image ───────────────────────────────────────────────────────────────
  const imgAreaTop = logoY + 48

  // Card images are ~2.5:3.5 (portrait). We make them fill ~60% of width.
  const imgW  = ratio === '9:16' ? Math.round(w * 0.58) : Math.round(w * 0.55)
  const imgH  = Math.round(imgW * (3.5 / 2.5))
  const imgX  = Math.round((w - imgW) / 2)
  const imgY  = imgAreaTop

  try {
    const img = await loadImage(data.imageUrl)

    // Drop shadow
    ctx.shadowColor   = 'rgba(0,0,0,0.7)'
    ctx.shadowBlur    = 60
    ctx.shadowOffsetY = 20
    roundRect(ctx, imgX, imgY, imgW, imgH, 18)
    ctx.clip()

    ctx.drawImage(img, imgX, imgY, imgW, imgH)
    ctx.restore()

    // Reset shadow
    ctx.shadowColor  = 'transparent'
    ctx.shadowBlur   = 0
    ctx.shadowOffsetY = 0
  } catch {
    // Fallback: grey card outline
    ctx.fillStyle = '#1a1a2e'
    roundRect(ctx, imgX, imgY, imgW, imgH, 18)
    ctx.fill()
    ctx.font      = '400 28px Helvetica, Arial, sans-serif'
    ctx.fillStyle = '#55556a'
    ctx.textAlign = 'center'
    ctx.fillText('🃏', w / 2, imgY + imgH / 2)
    ctx.textAlign = 'left'
  }

  const statsTop = imgY + imgH + 40

  // ── Card name + set · grade ──────────────────────────────────────────────────
  const nameFontSize = ratio === '9:16' ? 48 : 42
  const metaFontSize = ratio === '9:16' ? 28 : 26

  ctx.font      = `800 ${nameFontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = '#f0f0f8'
  ctx.textAlign = 'center'

  // Wrap name if too long
  const maxNameW = w - pad * 2
  const words = data.cardName.split(' ')
  let line1 = '', line2 = ''
  let currentLine = ''
  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(test).width > maxNameW && currentLine) {
      if (!line1) { line1 = currentLine; currentLine = word }
      else         { line2 = test; currentLine = '' }
    } else {
      currentLine = test
    }
  }
  if (currentLine && !line1) line1 = currentLine
  else if (currentLine)       line2 += (line2 ? ' ' : '') + currentLine

  let nameY = statsTop
  ctx.fillText(line1, w / 2, nameY)
  if (line2) {
    nameY += nameFontSize + 8
    ctx.fillText(line2, w / 2, nameY)
  }

  // Set · Grade
  nameY += nameFontSize + 14
  ctx.font      = `400 ${metaFontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = '#9898b8'
  ctx.fillText(`${data.setName}  ·  ${data.grade}`, w / 2, nameY)

  // ── Divider ──────────────────────────────────────────────────────────────────
  nameY += 36
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.moveTo(pad, nameY)
  ctx.lineTo(w - pad, nameY)
  ctx.stroke()
  nameY += 44

  // ── Stats row: Price | CI Score | Change ─────────────────────────────────────
  const col = w / 3
  const statLabelFont = `400 ${ratio === '9:16' ? 22 : 20}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  const statValueFont = `800 ${ratio === '9:16' ? 52 : 46}px "Helvetica Neue", Helvetica, Arial, sans-serif`

  const statData = [
    {
      label: 'PRICE',
      value: `$${data.price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      color: '#f0f0f8',
    },
    {
      label: 'CI SCORE',
      value: String(Math.round(data.score)),
      color: scoreCol(data.score),
    },
    {
      label: '30D CHANGE',
      value: `${data.change >= 0 ? '▲' : '▼'} ${Math.abs(data.change).toFixed(1)}%`,
      color: changeCol(data.change),
    },
  ]

  statData.forEach(({ label, value, color }, i) => {
    const cx = col * i + col / 2

    ctx.font      = statLabelFont
    ctx.fillStyle = '#55556a'
    ctx.textAlign = 'center'
    ctx.fillText(label, cx, nameY)

    ctx.font      = statValueFont
    ctx.fillStyle = color
    ctx.fillText(value, cx, nameY + (ratio === '9:16' ? 62 : 56))
  })

  nameY += ratio === '9:16' ? 130 : 116

  // ── Score breakdown bars (9:16 only) ─────────────────────────────────────────
  if (ratio === '9:16' && (data.trend || data.liquidity || data.consistency || data.value)) {
    const bars = [
      { label: 'Trend',       val: data.trend       ?? 0 },
      { label: 'Liquidity',   val: data.liquidity   ?? 0 },
      { label: 'Consistency', val: data.consistency ?? 0 },
      { label: 'Value',       val: data.value       ?? 0 },
    ]

    const barW    = w - pad * 2
    const barH    = 10
    const barGap  = 36
    const lblFont = '500 22px "Helvetica Neue", Helvetica, Arial, sans-serif'
    const numFont = '700 22px "Helvetica Neue", Helvetica, Arial, sans-serif'

    // section title
    ctx.font      = '400 20px "Helvetica Neue", Helvetica, Arial, sans-serif'
    ctx.fillStyle = '#55556a'
    ctx.textAlign = 'center'
    ctx.fillText('SCORE BREAKDOWN', w / 2, nameY)
    nameY += 36

    bars.forEach(({ label, val }) => {
      // label
      ctx.font      = lblFont
      ctx.fillStyle = '#9898b8'
      ctx.textAlign = 'left'
      ctx.fillText(label, pad, nameY)

      // value
      ctx.font      = numFont
      ctx.fillStyle = scoreCol(val)
      ctx.textAlign = 'right'
      ctx.fillText(String(Math.round(val)), w - pad, nameY)

      // track
      nameY += 14
      roundRect(ctx, pad, nameY, barW, barH, 5)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fill()

      // fill
      const fillW = Math.max(0, Math.round(barW * val / 100))
      if (fillW > 0) {
        roundRect(ctx, pad, nameY, fillW, barH, 5)
        ctx.fillStyle = scoreCol(val)
        ctx.fill()
      }

      nameY += barH + barGap
    })

    nameY += 8
  }

  // ── Verdict badge ─────────────────────────────────────────────────────────────
  if (data.scoreLabel) {
    const col       = scoreCol(data.score)
    const badgeText = data.scoreLabel.toUpperCase()
    ctx.font        = `700 ${ratio === '9:16' ? 26 : 24}px "Helvetica Neue", Helvetica, Arial, sans-serif`
    ctx.textAlign   = 'center'
    const tw        = ctx.measureText(badgeText).width
    const bPad      = 22
    const bH        = ratio === '9:16' ? 52 : 48
    const bX        = (w - tw - bPad * 2) / 2
    const bY        = nameY

    // badge bg
    ctx.fillStyle = `${col}20`
    roundRect(ctx, bX, bY, tw + bPad * 2, bH, 24)
    ctx.fill()

    // badge border
    ctx.strokeStyle = `${col}60`
    ctx.lineWidth   = 1.5
    roundRect(ctx, bX, bY, tw + bPad * 2, bH, 24)
    ctx.stroke()

    // badge text
    ctx.fillStyle = col
    ctx.fillText(badgeText, w / 2, bY + bH / 2)

    nameY += bH + 40
  }

  // ── Bottom branding ──────────────────────────────────────────────────────────
  const brandY = h - pad - 16
  ctx.font      = `500 ${ratio === '9:16' ? 26 : 24}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.textAlign = 'center'
  ctx.fillText('card-index.app  ·  Real market data for TCG collectors', w / 2, brandY)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

// ── Modal component ───────────────────────────────────────────────────────────

export default function ShareCardModal({
  data,
  onClose,
}: {
  data: ShareCardData
  onClose: () => void
}) {
  const [ratio, setRatio]         = useState<Ratio>('4:5')
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const generate = useCallback(async (r: Ratio) => {
    if (!canvasRef.current) return
    setGenerating(true)
    setPreviewUrl(null)
    try {
      await drawCard(canvasRef.current, data, r)
      const url = canvasRef.current.toDataURL('image/png')
      setPreviewUrl(url)
    } finally {
      setGenerating(false)
    }
  }, [data])

  // Generate on mount and when ratio changes
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
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, backdropFilter: 'blur(4px)' }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, pointerEvents: 'none',
      }}>
        <div style={{
          pointerEvents: 'auto',
          background: '#111120', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20, padding: 24, width: '100%', maxWidth: 540,
          maxHeight: '90vh', overflow: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#e8c547', letterSpacing: 2, marginBottom: 2 }}>ADMIN — EXPORT</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#f0f0f8' }}>Share Card</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#55556a', fontSize: 22, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
          </div>

          {/* Ratio toggle */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['4:5', '9:16'] as Ratio[]).map(r => (
              <button
                key={r}
                onClick={() => setRatio(r)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  border: `1.5px solid ${ratio === r ? '#e8c547' : 'rgba(255,255,255,0.1)'}`,
                  background: ratio === r ? 'rgba(232,197,71,0.1)' : 'transparent',
                  color: ratio === r ? '#e8c547' : '#9898b8',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {r}
                <span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: 0.7 }}>
                  {r === '4:5' ? '1080 × 1350 · Post' : '1080 × 1920 · Story'}
                </span>
              </button>
            ))}
          </div>

          {/* Preview */}
          <div style={{
            borderRadius: 12, overflow: 'hidden',
            background: '#080810', border: '1px solid rgba(255,255,255,0.07)',
            minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                  // Keep the preview at a readable size regardless of actual px dimensions
                  maxHeight: ratio === '9:16' ? 420 : 320,
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
              padding: '13px 0', borderRadius: 12, background: generating || !previewUrl ? 'rgba(232,197,71,0.3)' : '#e8c547',
              border: 'none', color: '#080810', fontSize: 14, fontWeight: 700,
              cursor: generating || !previewUrl ? 'default' : 'pointer',
            }}
          >
            {generating ? 'Generating…' : `Download ${ratio} PNG`}
          </button>

          {/* Hidden canvas used for rendering */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>
    </>
  )
}
