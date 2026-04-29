import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'CardIndex — TCG Market Intelligence'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

async function loadFonts() {
  const base = join(process.cwd(), 'node_modules/@fontsource/inter/files')
  const [regular, bold, extrabold] = await Promise.all([
    readFile(join(base, 'inter-latin-400-normal.woff')),
    readFile(join(base, 'inter-latin-700-normal.woff')),
    readFile(join(base, 'inter-latin-800-normal.woff')),
  ])
  return { regular, bold, extrabold }
}

export default async function Image() {
  const { regular, bold, extrabold } = await loadFonts()

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#080810',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow — centre */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800, height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,197,71,0.055) 0%, transparent 65%)',
          display: 'flex',
        }} />

        {/* Subtle top-right accent */}
        <div style={{
          position: 'absolute',
          top: -120, right: -120,
          width: 500, height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(61,232,138,0.04) 0%, transparent 65%)',
          display: 'flex',
        }} />

        {/* ── Logo ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28 }}>
          {/* Icon */}
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: '#141428',
            border: '2px solid rgba(232,197,71,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, paddingBottom: 4 }}>
              <div style={{ width: 6, height: 12, background: '#e8c547', opacity: 0.48, borderRadius: 2, display: 'flex' }} />
              <div style={{ width: 6, height: 20, background: '#e8c547', opacity: 0.76, borderRadius: 2, display: 'flex' }} />
              <div style={{ width: 6, height: 28, background: '#e8c547', borderRadius: 2, display: 'flex' }} />
            </div>
          </div>
          {/* Wordmark */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
            <span style={{ fontSize: 52, fontWeight: 800, color: '#f0f0f8', display: 'flex' }}>Card</span>
            <span style={{ fontSize: 52, fontWeight: 800, color: '#e8c547', display: 'flex' }}>Index</span>
          </div>
        </div>

        {/* ── Tagline ── */}
        <div style={{
          fontSize: 22, fontWeight: 400, color: '#9898b8',
          letterSpacing: '0.1em',
          marginBottom: 52,
          display: 'flex',
        }}>
          TCG MARKET INTELLIGENCE
        </div>

        {/* ── Feature pills ── */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 56 }}>
          {[
            { icon: '📈', label: 'Real-time eBay prices' },
            { icon: '🏆', label: 'CardIndex scores' },
            { icon: '🔍', label: 'Grade comparisons' },
          ].map(({ icon, label }) => (
            <div
              key={label}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '18px 32px', borderRadius: 16,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.11)',
              }}
            >
              <span style={{ fontSize: 26, display: 'flex' }}>{icon}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#c8c8e0', display: 'flex' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: 68,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 56px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#3de88a', display: 'flex',
            }} />
            <span style={{ fontSize: 14, color: '#9898b8', display: 'flex' }}>
              Live eBay market data
            </span>
          </div>
          <span style={{ fontSize: 14, color: '#55556a', display: 'flex' }}>
            card-index.app
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Inter', data: regular,   style: 'normal', weight: 400 },
        { name: 'Inter', data: bold,      style: 'normal', weight: 700 },
        { name: 'Inter', data: extrabold, style: 'normal', weight: 800 },
      ],
    }
  )
}
