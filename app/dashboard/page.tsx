'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { usePullToRefresh } from '@/lib/usePullToRefresh'
import { cacheGet } from '@/lib/searchCache'
import { useCurrency } from '@/lib/currency'

type Tier = 'free' | 'standard' | 'pro'

interface Profile {
  email: string
  username: string | null
  tier: Tier
}

interface WatchlistItem {
  id: string
  card_id: string
  card_name: string
  set_name: string
  grade: string
}

interface RecentlyViewedItem {
  card_id: string
  card_name: string
  grade: string
  set_name: string | null
  viewed_at: string
}

interface PortfolioStats {
  posCount: number
  costBasis: number       // USD
  currentValue: number    // USD, from cache (0 if no cache hits)
  cachedCount: number     // how many positions have a cached price
}

const QUICK_ACTIONS = [
  {
    label: 'Search Cards',
    desc: 'Find any Pokémon card and get live price data',
    href: '/search',
    icon: (
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6.5" cy="6.5" r="4.5"/><path d="M14 14l-3-3"/>
      </svg>
    ),
    color: 'var(--ink2)',
    bg: 'var(--surface2)',
    border: 'var(--border2)',
  },
  {
    label: 'My Watchlist',
    desc: 'Track your cards and monitor price movements',
    href: '/watchlist',
    icon: (
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2l1.5 3 3.5.5-2.5 2.5.6 3.5L8 10l-3.1 1.5.6-3.5L3 5.5l3.5-.5z"/>
      </svg>
    ),
    color: 'var(--gold)',
    bg: 'var(--gold2)',
    border: 'rgba(232,197,71,0.2)',
  },
  {
    label: 'Market',
    desc: 'Browse trending cards and market movers',
    href: '/market',
    icon: (
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 11 5 6 9 8 15 3"/><polyline points="11 3 15 3 15 7"/>
      </svg>
    ),
    color: 'var(--blue)',
    bg: 'rgba(74,158,255,0.1)',
    border: 'rgba(74,158,255,0.2)',
  },
  {
    label: 'Portfolio',
    desc: 'Track P&L, cost basis and market performance',
    href: '/portfolio',
    icon: (
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="10" width="3" height="5" rx="0.5"/>
        <rect x="6" y="6"  width="3" height="9" rx="0.5"/>
        <rect x="11" y="2" width="3" height="13" rx="0.5"/>
      </svg>
    ),
    color: 'var(--green)',
    bg: 'rgba(61,232,138,0.08)',
    border: 'rgba(61,232,138,0.2)',
  },
  {
    label: 'Account',
    desc: 'Manage your profile, plan, and security',
    href: '/account',
    icon: (
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
      </svg>
    ),
    color: 'var(--ink2)',
    bg: 'var(--surface2)',
    border: 'var(--border2)',
  },
]

const TIER_LABELS: Record<Tier, string> = { free: 'Free', standard: 'Standard', pro: 'Pro' }
const TIER_COLORS: Record<Tier, string> = { free: 'var(--ink3)', standard: 'var(--blue)', pro: 'var(--gold)' }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const { fmtCurrency, currency, rates } = useCurrency()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([])
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [marketSnap, setMarketSnap] = useState<{
    signal: string
    level: number | null
    change7d: number | null
    change30d: number | null
    topRising: { card_id: string; card_name: string; grade: string; change: number | null; price: number | null; image_url: string | null }[]
  } | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/'); return }

    const [{ data: prof }, { data: wl }, { data: pf }] = await Promise.all([
      supabase.from('profiles').select('email, username, tier').eq('id', user.id).single(),
      supabase.from('watchlists').select('id, card_id, card_name, set_name, grade').eq('user_id', user.id).order('added_at', { ascending: false }).limit(5),
      supabase.from('portfolios').select('id, card_id, grade, purchase_price, quantity').eq('user_id', user.id),
    ])

    setProfile(prof ?? { email: user.email ?? '', username: null, tier: 'free' })
    setWatchlist(wl ?? [])

    // Portfolio stats — use locally cached prices where available
    const positions = pf ?? []
    let costBasis = 0
    let currentValue = 0
    let cachedCount = 0
    for (const pos of positions) {
      costBasis += (pos.purchase_price as number) * (pos.quantity as number)
      const hit = cacheGet<{ price: number }>(`${pos.card_id}:${pos.grade}`)
      if (hit?.price) {
        currentValue += hit.price * (pos.quantity as number)
        cachedCount++
      }
    }
    setPortfolioStats({ posCount: positions.length, costBasis, currentValue, cachedCount })

    // Recently viewed — stored in localStorage under the user's key
    try {
      const rvKey = `ci_rv_${user.id}`
      const stored: RecentlyViewedItem[] = JSON.parse(localStorage.getItem(rvKey) ?? '[]')
      setRecentlyViewed(stored.slice(0, 5))
    } catch {
      setRecentlyViewed([])
    }

    // Market snapshot — non-blocking, best-effort
    fetch('/api/market')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || d.empty) return
        setMarketSnap({
          signal: d.signal ?? 'stable',
          level: d.indexMetrics?.level ?? null,
          change7d: d.indexMetrics?.change7d ?? null,
          change30d: d.indexMetrics?.change30d ?? null,
          topRising: (d.topRising ?? []).slice(0, 5),
        })
      })
      .catch(() => {})

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const { pullY, refreshing } = usePullToRefresh(load)

  const displayName = profile?.username ?? profile?.email?.split('@')[0] ?? ''
  const tier = (profile?.tier ?? 'free') as Tier

  if (loading) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 88, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Loading…</div>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 88, paddingBottom: 88, minHeight: '100vh' }}>
        {/* Pull-to-refresh indicator */}
        {(pullY > 0 || refreshing) && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
            display: 'flex', justifyContent: 'center',
            transform: `translateY(${refreshing ? 56 : pullY - 8}px)`,
            transition: refreshing ? 'transform 0.2s ease' : 'none',
            pointerEvents: 'none',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--surface)', border: '1px solid var(--border2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none"
                stroke="var(--gold)" strokeWidth="2" strokeLinecap="round"
                style={{ animation: refreshing ? 'ptr-spin 0.7s linear infinite' : 'none',
                         opacity: pullY / 72 > 1 ? 1 : pullY / 72 }}
              >
                {refreshing
                  ? <path d="M7 1a6 6 0 1 0 6 6" />
                  : <path d="M7 1v6M4 4l3 3 3-3" />}
              </svg>
            </div>
          </div>
        )}
        <div className="dash-content" style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column' }}>

          {/* ── Welcome ── */}
          <div style={{ marginTop: 32, marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 8 }}>WELCOME BACK</p>
                <h1 className="font-display" style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', lineHeight: 1.1 }}>
                  {displayName}
                </h1>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12, background: tier === 'free' ? 'var(--surface2)' : tier === 'pro' ? 'var(--gold2)' : 'rgba(74,158,255,0.08)', border: `1px solid ${tier === 'pro' ? 'rgba(232,197,71,0.25)' : tier === 'standard' ? 'rgba(74,158,255,0.2)' : 'var(--border2)'}` }}>
                <span style={{ fontSize: 12, color: TIER_COLORS[tier], fontWeight: 700 }}>{TIER_LABELS[tier]} plan</span>
                {tier === 'free' && (
                  <Link href="/pricing" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', marginLeft: 4 }}>Upgrade →</Link>
                )}
              </div>
            </div>
          </div>

          {/* ── Quick Actions ── */}
          <div className="dash-quick-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: portfolioStats && portfolioStats.posCount > 0 ? 16 : 32 }}>
            {QUICK_ACTIONS.map(action => (
              <Link key={action.href} href={action.href}
                className={action.href === '/account' ? 'dash-qa-account' : undefined}
                style={{ textDecoration: 'none', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color 0.15s, transform 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = action.border; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 12, background: action.bg, border: `1px solid ${action.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color }}>
                  {action.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{action.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>{action.desc}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Portfolio Snapshot ── */}
          {portfolioStats && portfolioStats.posCount > 0 && (() => {
            // fmtCurrency handles USD→local conversion internally — do NOT pre-multiply by rate
            const costUSD    = portfolioStats.costBasis
            const hasPrices  = portfolioStats.cachedCount > 0
            const valueUSD   = portfolioStats.currentValue
            const pnlUSD     = hasPrices ? valueUSD - costUSD : null
            const pnlPct     = pnlUSD != null && costUSD > 0 ? (pnlUSD / costUSD) * 100 : null
            const pnlPos     = pnlUSD == null ? null : pnlUSD >= 0
            return (
              <Link href="/portfolio" className="dash-pf-snap" style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: 16, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden', transition: 'border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(61,232,138,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
              >
                {/* Total Value */}
                <div style={{ padding: '14px 20px', borderRight: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 5, fontWeight: 600 }}>TOTAL VALUE</div>
                  {hasPrices ? (
                    <div className="font-num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(valueUSD)}</div>
                  ) : (
                    <div className="font-num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink3)' }}>—</div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 3 }}>
                    {portfolioStats.posCount} position{portfolioStats.posCount !== 1 ? 's' : ''}
                    {!hasPrices ? ' · visit portfolio to load' : portfolioStats.cachedCount < portfolioStats.posCount ? ` · ${portfolioStats.cachedCount}/${portfolioStats.posCount} priced` : ''}
                  </div>
                </div>
                {/* Total P&L */}
                <div style={{ padding: '14px 20px' }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 5, fontWeight: 600 }}>TOTAL P&amp;L</div>
                  {pnlUSD != null ? (
                    <>
                      <div className="font-num" style={{ fontSize: 20, fontWeight: 700, color: pnlPos ? 'var(--green)' : '#ff6b6b' }}>
                        {pnlPos ? '+' : '−'}{fmtCurrency(Math.abs(pnlUSD))}
                      </div>
                      <div style={{ fontSize: 10, color: pnlPos ? 'var(--green)' : '#ff6b6b', marginTop: 3, opacity: 0.8 }}>
                        {pnlPos ? '+' : ''}{pnlPct?.toFixed(1)}%
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink3)' }}>—</div>
                      <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 3 }}>visit portfolio to load prices</div>
                    </>
                  )}
                </div>
              </Link>
            )
          })()}

          {/* ── Two column: Watchlist + Market movers ── */}
          <div className="dash-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

            {/* Watchlist preview */}
            <div className="dash-watchlist" style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>My Watchlist</span>
                <Link href="/watchlist" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none' }}>View all →</Link>
              </div>
              {watchlist.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>☆</div>
                  <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 14 }}>No cards yet</p>
                  <Link href="/search" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Search and add cards →</Link>
                </div>
              ) : (
                <>
                  {watchlist.map((item, i) => {
                    const params = new URLSearchParams({ name: item.card_name, grade: item.grade })
                    if (item.set_name) params.set('set', item.set_name)
                    return (
                      <Link
                        key={item.id}
                        href={`/card/${item.card_id}?${params.toString()}`}
                        style={{ padding: '12px 20px', borderBottom: i < watchlist.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textDecoration: 'none', background: 'transparent', transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.card_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{item.set_name} · {item.grade}</div>
                        </div>
                        <span style={{ fontSize: 14, color: 'var(--ink3)', flexShrink: 0 }}>›</span>
                      </Link>
                    )
                  })}
                  {watchlist.length === 5 && (
                    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)' }}>
                      <Link href="/watchlist" style={{ fontSize: 12, color: 'var(--ink3)', textDecoration: 'none' }}>See all cards →</Link>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Market Snapshot */}
            {(() => {
              const SIGNAL_COLOR: Record<string, string> = {
                new_high: '#3de88a', rising: '#3de88a', stable: '#8c8cb4', falling: '#e8524a', new_low: '#e8524a',
              }
              const SIGNAL_LABEL: Record<string, string> = {
                new_high: 'New high', rising: 'Rising', stable: 'Stable', falling: 'Falling', new_low: 'New low',
              }
              const sig = marketSnap?.signal ?? 'stable'
              const sigColor = SIGNAL_COLOR[sig] ?? 'var(--ink3)'

              const Chg = ({ v }: { v: number | null | undefined }) => {
                if (v == null) return <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>
                return <span className="font-num" style={{ fontSize: 12, fontWeight: 700, color: v >= 0 ? 'var(--green)' : 'var(--red)' }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span>
              }

              return (
                <div className="dash-top-rising" style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Market Snapshot</span>
                      {marketSnap && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, color: sigColor, background: `${sigColor}18`, border: `1px solid ${sigColor}44` }}>
                          {SIGNAL_LABEL[sig]}
                        </span>
                      )}
                    </div>
                    <Link href="/market" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', flexShrink: 0 }}>Full market →</Link>
                  </div>

                  {/* Index metrics strip */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--border)' }}>
                    {[
                      { label: 'CI Index', value: marketSnap?.level != null ? <span className="font-num" style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>{marketSnap.level.toFixed(2)}</span> : <span style={{ fontSize: 13, color: 'var(--ink3)' }}>—</span> },
                      { label: '7d change', value: <Chg v={marketSnap?.change7d} /> },
                      { label: '30d change', value: <Chg v={marketSnap?.change30d} /> },
                    ].map(({ label, value }, i) => (
                      <div key={i} style={{ padding: '12px 16px', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ fontSize: 9, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
                        {value}
                      </div>
                    ))}
                  </div>

                  {/* Top rising */}
                  {marketSnap && marketSnap.topRising.length > 0 ? (
                    marketSnap.topRising.map((item, i) => {
                      const params = new URLSearchParams({ name: item.card_name, grade: item.grade })
                      return (
                        <Link key={i} href={`/card/${item.card_id}?${params.toString()}`}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: i < marketSnap.topRising.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <span className="font-num" style={{ fontSize: 10, color: 'var(--ink3)', width: 14, flexShrink: 0 }}>{i + 1}</span>
                            {item.image_url && (
                              <div style={{ width: 28, height: 28, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)' }}>
                                <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              </div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.card_name}</div>
                              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{item.grade}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {item.price != null && <span className="font-num" style={{ fontSize: 12, color: 'var(--ink2)' }}>{fmtCurrency(item.price)}</span>}
                            <Chg v={item.change} />
                          </div>
                        </Link>
                      )
                    })
                  ) : (
                    /* Skeleton / empty */
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ width: 14, height: 10, borderRadius: 3, background: 'var(--surface2)' }} />
                        <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--surface2)' }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ height: 12, width: '60%', borderRadius: 3, background: 'var(--surface2)' }} />
                          <div style={{ height: 10, width: '35%', borderRadius: 3, background: 'var(--surface2)' }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )
            })()}
          </div>

          {/* ── Recently Viewed ── */}
          <div className="dash-recently-searched" style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Recently Searched</span>
              <Link href="/search" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none' }}>Search cards →</Link>
            </div>
            {recentlyViewed.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 12 }}>No recent searches yet</p>
                <Link href="/search" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Find your first card →</Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {recentlyViewed.map((item, i) => {
                  const params = new URLSearchParams({ grade: item.grade, name: item.card_name })
                  if (item.set_name) params.set('set', item.set_name)
                  return (
                    <Link
                      key={`${item.card_id}-${i}`}
                      href={`/card/${item.card_id}?${params.toString()}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', textDecoration: 'none', gap: 8 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.card_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
                          {item.set_name ? `${item.set_name} · ` : ''}{item.grade}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--ink3)', flexShrink: 0, whiteSpace: 'nowrap' }}>{timeAgo(item.viewed_at)}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Upgrade banner (free users only) ── */}
          {tier === 'free' && (
            <div style={{ marginTop: 12, borderRadius: 16, background: 'var(--gold2)', border: '1px solid rgba(232,197,71,0.2)', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>Unlock the full CardIndex</div>
                <div style={{ fontSize: 13, color: 'rgba(232,197,71,0.7)' }}>Price history charts, trend indicators, unlimited watchlist and more.</div>
              </div>
              <Link href="/pricing" style={{ padding: '10px 22px', borderRadius: 10, background: 'var(--gold)', color: '#080810', textDecoration: 'none', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                See plans
              </Link>
            </div>
          )}

        </div>
      </main>

      <style>{`
        @keyframes ptr-spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          /* Make the outer column a flex container so order works on all children */
          .dash-content { display: flex !important; flex-direction: column; gap: 10px; }

          /* Dissolve the two-col wrapper so watchlist & top-rising become direct flex children */
          .dash-two-col { display: contents !important; }

          /* ── Quick actions hidden on mobile — same functions live in bottom nav ── */
          .dash-quick-actions { display: none !important; }

          /* ── Order (quick actions removed) ── */
          .dash-pf-snap           { order: 1; }
          .dash-watchlist         { order: 2; }
          .dash-recently-searched { order: 3; }
          .dash-top-rising        { order: 4; }

          /* ── Portfolio snapshot: stack cells vertically → taller card ── */
          .dash-pf-snap {
            grid-template-columns: 1fr !important;
            margin-bottom: 0;
          }
          .dash-pf-snap > div:first-child {
            border-right: none !important;
            border-bottom: 1px solid var(--border);
            padding: 18px 16px 14px !important;
          }
          .dash-pf-snap > div:last-child {
            padding: 14px 16px 18px !important;
          }

          /* Tighten up section inner padding on mobile */
          .dash-watchlist,
          .dash-top-rising,
          .dash-recently-searched {
            border-radius: 14px;
          }
        }
      `}</style>
    </>
  )
}
