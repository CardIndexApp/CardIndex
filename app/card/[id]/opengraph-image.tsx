import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@/lib/supabase/server'

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

// ── Types ─────────────────────────────────────────────────────────────────────
type Props = {
  params:       Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function sp(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

interface CacheMeta {
  card_name:        string | null
  set_name:         string | null
  grade:            string | null
  image_url:        string | null
  price:            number | null
  score:            number | null
  price_change_pct: number | null
}

async function getCardMeta(id: string, grade: string): Promise<CacheMeta | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('search_cache')
      .select('card_name, set_name, grade, image_url, price, score, price_change_pct')
      .eq('cache_key', `${id}:${grade}`)
      .single()
    return data ?? null
  } catch {
    return null
  }
}

function scoreColor(s: number): string {
  return s >= 80 ? '#3de88a' : s >= 60 ? '#e8c547' : '#e8524a'
}

function scoreLabel(s: number): string {
  return s >= 80 ? 'Strong' : s >= 60 ? 'Moderate' : 'Weak'
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

// ── Image ─────────────────────────────────────────────────────────────────────
export default async function Image({ params, searchParams }: Props) {
  const { id } = await params
  const raw     = await searchParams

  const urlName  = sp(raw.name)
  const urlGrade = sp(raw.grade) ?? 'PSA 10'
  const urlSet   = sp(raw.set)

  const cached = await getCardMeta(id, urlGrade)

  const name   = urlName  ?? cached?.card_name ?? 'Trading Card'
  const grade  = urlGrade ?? cached?.grade     ?? 'PSA 10'
  const set    = urlSet   ?? cached?.set_name  ?? null
  const price  = cached?.price            ?? null
  const change = cached?.price_change_pct ?? null
  const score  = cached?.score            ?? null
  const img    = cached?.image_url        ?? null

  // Load Inter fonts
  const { regular: fontRegular, bold: fontBold, extrabold: fontExtrabold } = await loadFonts()

  const priceStr = price != null
    ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null

  const changePos = change != null && change >= 0
  const changeStr = change != null
    ? `${changePos ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%`
    : null

  // Scale card name font size to fit
  const nameFontSize = name.length > 30 ? 40 : name.length > 22 ? 48 : 56

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#080810',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Inter',
        }}
      >
        {/* Subtle gold glow — top-right area */}
        <div style={{
          position: 'absolute',
          top: -80, right: -80,
          width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,197,71,0.07) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* ── Main content ── */}
        <div style={{ display: 'flex', flex: 1, padding: '52px 64px 0 56px', gap: 52 }}>

          {/* Left: Card image */}
          <div style={{
            width: 200, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {img ? (
              <img
                src={img}
                width={190}
                height={266}
                style={{ borderRadius: 14, objectFit: 'contain' }}
              />
            ) : (
              <div style={{
                width: 190, height: 266, borderRadius: 14,
                background: '#111120',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 52, color: '#e8c547',
              }}>
                🃏
              </div>
            )}
          </div>

          {/* Right: Card info */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0 }}>

            {/* Grade + set row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                padding: '5px 14px', borderRadius: 8,
                background: 'rgba(232,197,71,0.12)',
                border: '1px solid rgba(232,197,71,0.35)',
                fontSize: 14, fontWeight: 700, color: '#e8c547',
                display: 'flex',
              }}>
                {grade}
              </div>
              {set && (
                <div style={{ fontSize: 15, color: '#55556a', display: 'flex' }}>
                  {truncate(set, 40)}
                </div>
              )}
            </div>

            {/* Card name */}
            <div style={{
              fontSize: nameFontSize,
              fontWeight: 800,
              color: '#f0f0f8',
              letterSpacing: '-1px',
              lineHeight: 1.1,
              marginBottom: 32,
              display: 'flex',
            }}>
              {truncate(name, 34)}
            </div>

            {/* Divider */}
            <div style={{
              height: 1, background: 'rgba(255,255,255,0.07)',
              marginBottom: 28, display: 'flex',
            }} />

            {/* Stats row */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 48 }}>

              {/* Price */}
              {priceStr && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: '#55556a', letterSpacing: '0.15em', display: 'flex' }}>
                    MARKET PRICE
                  </div>
                  <div style={{
                    fontSize: 46, fontWeight: 800, color: '#f0f0f8',
                    letterSpacing: '-1.5px', lineHeight: 1, display: 'flex',
                  }}>
                    {priceStr}
                  </div>
                </div>
              )}

              {/* 30d change */}
              {changeStr && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: '#55556a', letterSpacing: '0.15em', display: 'flex' }}>
                    30D CHANGE
                  </div>
                  <div style={{
                    fontSize: 32, fontWeight: 700,
                    color: changePos ? '#3de88a' : '#e8524a',
                    letterSpacing: '-0.5px', lineHeight: 1, display: 'flex',
                  }}>
                    {changeStr}
                  </div>
                </div>
              )}

              {/* CardIndex Score */}
              {score != null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: '#55556a', letterSpacing: '0.15em', display: 'flex' }}>
                    CI SCORE
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <div style={{
                      fontSize: 32, fontWeight: 800,
                      color: scoreColor(score),
                      letterSpacing: '-0.5px', lineHeight: 1, display: 'flex',
                    }}>
                      {score}
                    </div>
                    <div style={{ fontSize: 14, color: '#55556a', display: 'flex' }}>/100</div>
                    <div style={{
                      marginLeft: 4, padding: '3px 10px', borderRadius: 6,
                      background: `${scoreColor(score)}18`,
                      border: `1px solid ${scoreColor(score)}44`,
                      fontSize: 11, fontWeight: 700, color: scoreColor(score),
                      display: 'flex', alignItems: 'center',
                    }}>
                      {scoreLabel(score)}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── Footer bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 56px',
          height: 80,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          marginTop: 24,
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: '#141428',
              border: '1.5px solid rgba(232,197,71,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* Bar chart icon — 3 rects */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, paddingBottom: 3 }}>
                <div style={{ width: 4, height: 8,  background: '#e8c547', opacity: 0.48, borderRadius: 1, display: 'flex' }} />
                <div style={{ width: 4, height: 13, background: '#e8c547', opacity: 0.76, borderRadius: 1, display: 'flex' }} />
                <div style={{ width: 4, height: 18, background: '#e8c547', borderRadius: 1, display: 'flex' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#f0f0f8', display: 'flex' }}>Card</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#e8c547', display: 'flex' }}>Index</span>
            </div>
          </div>

          {/* Right: live indicator + URL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#3de88a',
                display: 'flex',
              }} />
              <span style={{ fontSize: 12, color: '#9898b8', display: 'flex' }}>
                Live eBay market data
              </span>
            </div>
            <div style={{
              width: 1, height: 14, background: 'rgba(255,255,255,0.1)', display: 'flex',
            }} />
            <span style={{ fontSize: 13, color: '#55556a', display: 'flex' }}>
              card-index.app
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Inter', data: fontRegular,   style: 'normal', weight: 400 },
        { name: 'Inter', data: fontBold,      style: 'normal', weight: 700 },
        { name: 'Inter', data: fontExtrabold, style: 'normal', weight: 800 },
      ],
    }
  )
}
