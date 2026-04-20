'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import AuthModal from '@/components/AuthModal'
import { scoreColor } from '@/lib/data'
import { tcgImg } from '@/lib/img'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────────────────────

interface WatchlistItem {
  id: string
  user_id: string
  card_id: string
  card_name: string
  set_name: string | null
  grade: string
  image_url: string | null
  alert_price: number | null
  added_at: string
}

interface PriceData {
  price: number
  price_change_pct: number
  price_history: { date: string; price: number }[]
  score: number
}

interface EnrichedItem extends WatchlistItem {
  priceData: PriceData | null
  priceLoading: boolean
}

type SortKey = 'price' | 'change' | 'score' | 'name'
type Filter = 'all' | 'up' | 'down'

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const w = 80, h = 32
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  const color = up ? '#3de88a' : '#e8524a'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
    </svg>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow({ last }: { last: boolean }) {
  return (
    <div
      className="wl-row"
      style={{ borderBottom: last ? 'none' : '1px solid var(--border)' }}
    >
      {/* Card cell */}
      <div className="wl-cell-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0 }} className="sk-pulse" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ width: 140, height: 13, borderRadius: 4, background: 'var(--surface2)' }} className="sk-pulse" />
          <div style={{ width: 90, height: 10, borderRadius: 4, background: 'var(--surface2)' }} className="sk-pulse" />
        </div>
      </div>
      {/* Price */}
      <div className="wl-cell-price" style={{ textAlign: 'right' }}>
        <div style={{ width: 60, height: 15, borderRadius: 4, background: 'var(--surface2)', marginLeft: 'auto' }} className="sk-pulse" />
      </div>
      {/* Change */}
      <div className="wl-cell-change" style={{ textAlign: 'right' }}>
        <div style={{ width: 48, height: 12, borderRadius: 4, background: 'var(--surface2)', marginLeft: 'auto' }} className="sk-pulse" />
      </div>
      {/* Trend (desktop) */}
      <div className="wl-hide-mobile" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: 80, height: 32, borderRadius: 4, background: 'var(--surface2)' }} className="sk-pulse" />
      </div>
      {/* Score (desktop) */}
      <div className="wl-hide-mobile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 30, height: 15, borderRadius: 4, background: 'var(--surface2)' }} className="sk-pulse" />
        <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--surface2)' }} className="sk-pulse" />
      </div>
      {/* Remove button placeholder */}
      <div className="wl-cell-remove" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--surface2)' }} className="sk-pulse" />
      </div>
    </div>
  )
}

// ── Not-signed-in prompt ──────────────────────────────────────────────────────

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{
        maxWidth: 380,
        width: '100%',
        borderRadius: 20,
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        padding: '40px 32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>★</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>
          Sign in to view your watchlist
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.6, marginBottom: 28 }}>
          Track cards you care about, set price alerts, and see live market data in one place.
        </p>
        <button
          onClick={onSignIn}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 12,
            background: 'var(--gold)',
            color: '#080810',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Sign in / Create account
        </button>
        <Link
          href="/search"
          style={{ display: 'block', marginTop: 16, fontSize: 13, color: 'var(--ink3)', textDecoration: 'none' }}
        >
          Browse cards →
        </Link>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Watchlist() {
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const [items, setItems] = useState<EnrichedItem[]>([])
  const [listLoading, setListLoading] = useState(false)

  const [sort, setSort] = useState<SortKey>('score')
  const [filter, setFilter] = useState<Filter>('all')

  // ── Auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setAuthChecked(true)
    })
  }, [])

  // ── Fetch watchlist ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return

    setListLoading(true)
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(({ items: raw }: { items: WatchlistItem[] }) => {
        const enriched: EnrichedItem[] = (raw ?? []).map(item => ({
          ...item,
          priceData: null,
          priceLoading: true,
        }))
        setItems(enriched)
        setListLoading(false)

        // Kick off per-card price fetches
        enriched.forEach(item => {
          const params = new URLSearchParams({ grade: item.grade, name: item.card_name })
          if (item.set_name) params.set('set', item.set_name)
          fetch(`/api/card/${item.card_id}?${params.toString()}`)
            .then(r => r.json())
            .then(({ data }: { data: PriceData }) => {
              setItems(prev =>
                prev.map(p =>
                  p.id === item.id
                    ? { ...p, priceData: data ?? null, priceLoading: false }
                    : p
                )
              )
            })
            .catch(() => {
              setItems(prev =>
                prev.map(p =>
                  p.id === item.id ? { ...p, priceLoading: false } : p
                )
              )
            })
        })
      })
      .catch(() => setListLoading(false))
  }, [user])

  // ── Remove handler ────────────────────────────────────────────────────────
  async function handleRemove(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    // Optimistic removal
    setItems(prev => prev.filter(p => p.id !== id))
    await fetch(`/api/watchlist?id=${id}`, { method: 'DELETE' })
  }

  // ── Derived lists ─────────────────────────────────────────────────────────
  const visible = items
    .filter(item => {
      if (filter === 'all') return true
      const change = item.priceData?.price_change_pct ?? 0
      return filter === 'up' ? change >= 0 : change < 0
    })
    .sort((a, b) => {
      const ap = a.priceData, bp = b.priceData
      if (sort === 'price') return (bp?.price ?? 0) - (ap?.price ?? 0)
      if (sort === 'change') return (bp?.price_change_pct ?? 0) - (ap?.price_change_pct ?? 0)
      if (sort === 'score') return (bp?.score ?? 0) - (ap?.score ?? 0)
      return a.card_name.localeCompare(b.card_name)
    })

  const rising = items.filter(i => (i.priceData?.price_change_pct ?? 0) >= 0).length
  const falling = items.filter(i => (i.priceData?.price_change_pct ?? 0) < 0).length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />
      <style>{`
        @keyframes sk-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .sk-pulse { animation: sk-pulse 1.6s ease-in-out infinite; }

        @media (max-width: 640px) {
          .wl-header > span { display: none !important; }
          .wl-header::before { content: 'CARD'; font-size: 10px; color: var(--ink3); letter-spacing: 1px; text-transform: uppercase; }
          .wl-header::after  { content: 'PRICE / CHANGE'; font-size: 10px; color: var(--ink3); letter-spacing: 1px; text-transform: uppercase; grid-column: 2; text-align: right; }
        }
      `}</style>

      <main style={{ paddingTop: 72, paddingBottom: 96, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 0' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Watchlist</p>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px' }}>My Cards</h1>
            </div>
            <Link href="/search" style={{ padding: '9px 20px', borderRadius: 10, background: 'var(--gold)', color: '#080810', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              + Add card
            </Link>
          </div>

          {/* ── Not logged in ── */}
          {authChecked && !user ? (
            <SignInPrompt onSignIn={() => setShowAuthModal(true)} />
          ) : (
            <>
              {/* Summary strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
                {[
                  { label: 'Cards watched', value: String(items.length), sub: 'on your list' },
                  { label: 'Rising today', value: String(rising), sub: 'cards up', color: 'var(--green)' },
                  { label: 'Falling today', value: String(falling), sub: 'cards down', color: 'var(--red)' },
                ].map((s, i) => (
                  <div key={i} style={{ borderRadius: 12, padding: '16px 18px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 6 }}>{s.label}</div>
                    <div className="font-num" style={{ fontSize: 22, fontWeight: 700, color: s.color ?? 'var(--ink)', letterSpacing: '-0.5px' }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 3 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                {/* Filter */}
                <div style={{ display: 'flex', gap: 2, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border2)' }}>
                  {(['all', 'up', 'down'] as Filter[]).map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: filter === f ? 'var(--surface2)' : 'transparent', color: filter === f ? 'var(--ink)' : 'var(--ink3)', transition: 'all 0.15s' }}>
                      {f === 'all' ? 'All' : f === 'up' ? '▲ Rising' : '▼ Falling'}
                    </button>
                  ))}
                </div>
                {/* Sort */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--ink3)' }}>Sort by</span>
                  <div style={{ display: 'flex', gap: 2, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border2)' }}>
                    {([['score', 'Score'], ['price', 'Price'], ['change', 'Change'], ['name', 'Name']] as [SortKey, string][]).map(([key, label]) => (
                      <button key={key} onClick={() => setSort(key)} style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: sort === key ? 'var(--surface2)' : 'transparent', color: sort === key ? 'var(--ink)' : 'var(--ink3)', transition: 'all 0.15s' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {/* Table header */}
                <div className="wl-header" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase' }}>Card</span>
                  <span style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'right' }}>Price</span>
                  <span style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'right' }}>24h Change</span>
                  <span className="wl-hide-mobile" style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>30d Trend</span>
                  <span className="wl-hide-mobile" style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>Score</span>
                  <span />
                </div>

                {/* Loading skeletons while fetching the list */}
                {listLoading && (
                  [0, 1, 2].map(i => <SkeletonRow key={i} last={i === 2} />)
                )}

                {/* Empty states */}
                {!listLoading && items.length === 0 && (
                  <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 12 }}>Your watchlist is empty.</div>
                    <Link href="/search" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none' }}>Find cards to watch →</Link>
                  </div>
                )}

                {!listLoading && items.length > 0 && visible.length === 0 && (
                  <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 12 }}>No cards match this filter.</div>
                    <button onClick={() => setFilter('all')} style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer' }}>Show all</button>
                  </div>
                )}

                {/* Rows */}
                {!listLoading && visible.map((item, i) => {
                  const pd = item.priceData
                  const change = pd?.price_change_pct ?? 0
                  const up = change >= 0
                  const score = pd?.score ?? 0
                  const history = pd?.price_history?.map(h => h.price) ?? []

                  // Build card page URL with params so live data loads correctly
                  const cardParams = new URLSearchParams({ name: item.card_name, grade: item.grade })
                  if (item.set_name) cardParams.set('set', item.set_name)
                  const cardHref = `/card/${item.card_id}?${cardParams.toString()}`

                  return (
                    <Link
                      key={item.id}
                      href={cardHref}
                      className="wl-row"
                      style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', background: 'transparent', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Card info */}
                      <div className="wl-cell-card" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                          {item.image_url && (
                            <img
                              src={tcgImg(item.image_url)}
                              alt={item.card_name}
                              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }}
                            />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="wl-card-name font-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.card_name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            {item.set_name && <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{item.set_name}</span>}
                            {item.set_name && <span style={{ fontSize: 10, color: 'var(--border2)' }}>·</span>}
                            <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{item.grade}</span>
                          </div>
                          {item.alert_price != null && (
                            <span style={{ display: 'inline-block', marginTop: 4, fontSize: 9, color: 'var(--gold)', background: 'var(--gold2)', border: '1px solid rgba(232,197,71,0.2)', borderRadius: 4, padding: '2px 6px', letterSpacing: 0.5 }}>
                              ⚡ ALERT ${item.alert_price.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="wl-cell-price" style={{ textAlign: 'right' }}>
                        {item.priceLoading ? (
                          <div style={{ width: 60, height: 15, borderRadius: 4, background: 'var(--surface2)', marginLeft: 'auto' }} className="sk-pulse" />
                        ) : pd ? (
                          <div className="font-num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
                            ${pd.price.toLocaleString()}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--ink3)' }}>—</span>
                        )}
                      </div>

                      {/* 24h change */}
                      <div className="wl-cell-change" style={{ textAlign: 'right' }}>
                        {item.priceLoading ? (
                          <div style={{ width: 48, height: 12, borderRadius: 4, background: 'var(--surface2)', marginLeft: 'auto' }} className="sk-pulse" />
                        ) : pd ? (
                          <>
                            <div className="font-num" style={{ fontSize: 12, fontWeight: 600, color: up ? 'var(--green)' : 'var(--red)', lineHeight: 1 }}>
                              {up ? '+' : ''}{change.toFixed(1)}%
                            </div>
                            <div className="font-num" style={{ fontSize: 10, color: up ? 'var(--green)' : 'var(--red)', opacity: 0.65, marginTop: 2 }}>
                              {up ? '+' : ''}${Math.abs(Math.round(pd.price * change / 100)).toLocaleString()}
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--ink3)' }}>—</span>
                        )}
                      </div>

                      {/* Sparkline */}
                      <div className="wl-hide-mobile" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {item.priceLoading ? (
                          <div style={{ width: 80, height: 32, borderRadius: 4, background: 'var(--surface2)' }} className="sk-pulse" />
                        ) : history.length >= 2 ? (
                          <Sparkline data={history} up={up} />
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--ink3)' }}>—</span>
                        )}
                      </div>

                      {/* Score */}
                      <div className="wl-hide-mobile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        {item.priceLoading ? (
                          <>
                            <div style={{ width: 30, height: 15, borderRadius: 4, background: 'var(--surface2)' }} className="sk-pulse" />
                            <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--surface2)' }} className="sk-pulse" />
                          </>
                        ) : pd ? (
                          <>
                            <span className="font-num" style={{ fontSize: 15, fontWeight: 700, color: scoreColor(score) }}>{score}</span>
                            <div style={{ width: 40, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${score}%`, background: scoreColor(score), borderRadius: 2 }} />
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--ink3)' }}>—</span>
                        )}
                      </div>

                      {/* Remove */}
                      <div className="wl-cell-remove" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={e => handleRemove(e, item.id)}
                          style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink3)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink3)' }}
                          title="Remove from watchlist"
                        >
                          ×
                        </button>
                      </div>
                    </Link>
                  )
                })}
              </div>

              <p style={{ fontSize: 11, color: 'var(--ink3)', textAlign: 'center', marginTop: 24 }}>
                Prices updated every 6 hours · Sort and filter to explore your collection
              </p>
            </>
          )}

        </div>
      </main>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} defaultTab="signin" />}
    </>
  )
}
