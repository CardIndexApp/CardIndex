'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { usePullToRefresh } from '@/lib/usePullToRefresh'
import { useCurrency } from '@/lib/currency'
import { cacheGet, cacheSet } from '@/lib/searchCache'

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
  posCount: number        // open positions only
  soldCount: number       // sold positions
  costBasis: number       // USD, open positions only
  currentValue: number    // USD, from cache (0 if no cache hits)
  cachedCount: number     // how many open positions have a cached price
  realizedPL: number      // USD, from sold positions
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
    topRising: { card_id: string; card_name: string; grade: string; change: number | null; price: number | null }[]
  } | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/'); return }

    const DASH_KEY = `dashboard:data:${user.id}`

    // ── 1. Render from cache instantly ────────────────────────────────────
    type DashCache = { profile: Profile; watchlist: WatchlistItem[]; portfolioStats: PortfolioStats }
    const cached = cacheGet<DashCache>(DASH_KEY)
    if (cached) {
      setProfile(cached.profile)
      setWatchlist(cached.watchlist)
      setPortfolioStats(cached.portfolioStats)
      setLoading(false)
    }

    // Recently viewed is always from localStorage — read it immediately
    try {
      const rvKey = `ci_rv_${user.id}`
      const stored: RecentlyViewedItem[] = JSON.parse(localStorage.getItem(rvKey) ?? '[]')
      setRecentlyViewed(stored.slice(0, 5))
    } catch {
      setRecentlyViewed([])
    }

    // ── 2. Silently refresh from server ───────────────────────────────────
    const [{ data: prof }, { data: wl }, { data: pf }] = await Promise.all([
      supabase.from('profiles').select('email, username, tier').eq('id', user.id).single(),
      supabase.from('watchlists').select('id, card_id, card_name, set_name, grade').eq('user_id', user.id).order('added_at', { ascending: false }).limit(5),
      supabase.from('portfolios').select('id, card_id, grade, purchase_price, quantity, sold, sale_price').eq('user_id', user.id),
    ])

    const freshProfile: Profile = prof ?? { email: user.email ?? '', username: null, tier: 'free' }
    setProfile(freshProfile)
    setWatchlist(wl ?? [])

    // Portfolio stats — pull prices from search_cache (same source as portfolio page)
    const positions = pf ?? []
    const openPositions = positions.filter(p => !p.sold)
    const soldPositions = positions.filter(p => p.sold)

    let costBasis = 0
    let currentValue = 0
    let cachedCount = 0
    let realizedPL = 0

    for (const pos of openPositions) {
      costBasis += (pos.purchase_price as number) * (pos.quantity as number)
    }
    for (const pos of soldPositions.filter(p => p.sale_price != null)) {
      realizedPL += ((pos.sale_price as number) - (pos.purchase_price as number)) * (pos.quantity as number)
    }

    if (openPositions.length > 0) {
      const cacheKeys = openPositions.map(p => `${p.card_id}:${p.grade}`)
      const { data: priceRows } = await supabase
        .from('search_cache')
        .select('cache_key, price')
        .in('cache_key', cacheKeys)

      const priceMap = new Map<string, number>()
      for (const row of priceRows ?? []) {
        if (row.price != null && row.price > 0) priceMap.set(row.cache_key, row.price)
      }

      for (const pos of openPositions) {
        const price = priceMap.get(`${pos.card_id}:${pos.grade}`)
        if (price) {
          currentValue += price * (pos.quantity as number)
          cachedCount++
        }
      }
    }

    const freshStats: PortfolioStats = { posCount: openPositions.length, soldCount: soldPositions.length, costBasis, currentValue, cachedCount, realizedPL }
    setPortfolioStats(freshStats)

    // Save fresh data to cache for next visit
    cacheSet<DashCache>(DASH_KEY, { profile: freshProfile, watchlist: wl ?? [], portfolioStats: freshStats })

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

        {/* Page header — shown on desktop, hidden on mobile (top nav provides context) */}
        <div className="dash-page-header" style={{ padding: '28px 32px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--gold)', marginBottom: 4, textTransform: 'uppercase' }}>Dashboard</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--ink)', margin: 0 }}>{displayName}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 99,
              color: TIER_COLORS[tier],
              background: tier === 'pro' ? 'rgba(232,197,71,0.1)' : tier === 'standard' ? 'rgba(74,158,255,0.1)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${tier === 'pro' ? 'rgba(232,197,71,0.3)' : tier === 'standard' ? 'rgba(74,158,255,0.25)' : 'var(--border2)'}`,
            }}>{TIER_LABELS[tier]}</span>
            {tier === 'free' && (
              <Link href="/pricing" style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 99, color: 'var(--gold)', background: 'rgba(232,197,71,0.08)', border: '1px solid rgba(232,197,71,0.2)', textDecoration: 'none' }}>Upgrade →</Link>
            )}
          </div>
        </div>

        <div className="dash-content" style={{ maxWidth: 960, margin: '0 auto', padding: '24px 24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Hero: Portfolio Value ── */}
          {portfolioStats && (portfolioStats.posCount > 0 || portfolioStats.realizedPL !== 0) && (() => {
            const costUSD       = portfolioStats.costBasis
            const hasPrices     = portfolioStats.cachedCount > 0
            const allPriced     = portfolioStats.cachedCount === portfolioStats.posCount && portfolioStats.posCount > 0
            const valueUSD      = portfolioStats.currentValue
            const unrealizedUSD = hasPrices ? valueUSD - costUSD : null
            const unrealizedPct = unrealizedUSD != null && costUSD > 0 ? (unrealizedUSD / costUSD) * 100 : null
            const unrealizedPos = unrealizedUSD == null ? null : unrealizedUSD >= 0
            const realizedUSD   = portfolioStats.realizedPL
            const realizedPos   = realizedUSD >= 0
            const showRealized  = portfolioStats.realizedPL !== 0
            return (
              <Link href="/portfolio" className="dash-pf-hero" style={{ textDecoration: 'none', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden', transition: 'border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(61,232,138,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
              >
                <div style={{ padding: '22px 24px 18px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 10 }}>Total Portfolio Value</div>
                  {hasPrices ? (
                    <>
                      <div className="font-num" style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: 'var(--ink)', lineHeight: 1, marginBottom: 8 }}>{fmtCurrency(valueUSD)}</div>
                      {unrealizedUSD != null && (
                        <div style={{ fontSize: 14, fontWeight: 700, color: unrealizedPos ? 'var(--green)' : 'var(--red)' }}>
                          {unrealizedPos ? '+' : '−'}{fmtCurrency(Math.abs(unrealizedUSD))} ({unrealizedPos ? '+' : ''}{unrealizedPct?.toFixed(1)}% unrealized)
                          {!allPriced && <span style={{ color: 'var(--ink3)', fontWeight: 500, marginLeft: 8, fontSize: 12 }}>{portfolioStats.cachedCount}/{portfolioStats.posCount} priced</span>}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="font-num" style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: 'var(--ink3)', lineHeight: 1, marginBottom: 8 }}>{fmtCurrency(costUSD)}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Cost basis · visit portfolio to load prices</div>
                    </>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: showRealized ? '1fr 1fr 1fr' : '1fr 1fr', borderTop: '1px solid var(--border)' }}>
                  <div style={{ padding: '13px 20px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 5 }}>Positions</div>
                    <div className="font-num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{portfolioStats.posCount}</div>
                  </div>
                  <div style={{ padding: '13px 20px', borderRight: showRealized ? '1px solid var(--border)' : undefined }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 5 }}>Cost Basis</div>
                    <div className="font-num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(costUSD)}</div>
                  </div>
                  {showRealized && (
                    <div style={{ padding: '13px 20px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 5 }}>Realized P&amp;L</div>
                      <div className="font-num" style={{ fontSize: 18, fontWeight: 700, color: realizedPos ? 'var(--green)' : 'var(--red)' }}>
                        {realizedPos ? '+' : '−'}{fmtCurrency(Math.abs(realizedUSD))}
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            )
          })()}

          {/* ── Two column: Movers + Market Index ── */}
          <div className="dash-two-col" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>

            {/* Watchlist Movers */}
            <div className="dash-movers" style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px 11px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Watchlist Movers Today</span>
                <Link href="/watchlist" style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>View watchlist →</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                {/* Gainers — top rising from market */}
                <div style={{ borderRight: '1px solid var(--border)' }}>
                  <div style={{ padding: '9px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--green)' }}>Top Rising</span>
                  </div>
                  {marketSnap && marketSnap.topRising.length > 0 ? marketSnap.topRising.slice(0, 4).map((item, i) => {
                    const params = new URLSearchParams({ name: item.card_name, grade: item.grade })
                    return (
                      <Link key={i} href={`/card/${item.card_id}?${params}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < Math.min(marketSnap.topRising.length, 4) - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', background: 'transparent', transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-subtle)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ width: 32, height: 44, borderRadius: 4, background: 'linear-gradient(135deg, var(--surface2) 0%, rgba(61,232,138,0.08) 100%)', border: '1px solid var(--border)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.card_name}</div>
                          <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{item.grade}</div>
                        </div>
                        <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                          {item.price != null && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(item.price)}</div>}
                          {item.change != null && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', marginTop: 2 }}>+{item.change.toFixed(1)}%</div>}
                        </div>
                      </Link>
                    )
                  }) : Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 32, height: 44, borderRadius: 4, background: 'var(--surface2)', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 11, width: '70%', borderRadius: 3, background: 'var(--surface2)', marginBottom: 5 }} />
                        <div style={{ height: 9, width: '40%', borderRadius: 3, background: 'var(--surface2)' }} />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Watchlist */}
                <div>
                  <div style={{ padding: '9px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)' }}>Watching</span>
                  </div>
                  {watchlist.length > 0 ? watchlist.slice(0, 4).map((item, i) => {
                    const params = new URLSearchParams({ name: item.card_name, grade: item.grade })
                    if (item.set_name) params.set('set', item.set_name)
                    return (
                      <Link key={item.id} href={`/card/${item.card_id}?${params}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < Math.min(watchlist.length, 4) - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', background: 'transparent', transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-subtle)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ width: 32, height: 44, borderRadius: 4, background: 'linear-gradient(135deg, var(--surface2) 0%, rgba(232,197,71,0.08) 100%)', border: '1px solid var(--border)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.card_name}</div>
                          <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{item.set_name ?? item.grade}</div>
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--ink3)', flexShrink: 0 }}>›</div>
                      </Link>
                    )
                  }) : (
                    <div style={{ padding: '28px 16px', textAlign: 'center' as const }}>
                      <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 10 }}>No cards yet</div>
                      <Link href="/search" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Add cards →</Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Market Index */}
            {(() => {
              const SIGNAL_COLOR: Record<string, string> = { new_high: '#3de88a', rising: '#3de88a', stable: '#8c8cb4', falling: '#e8524a', new_low: '#e8524a' }
              const SIGNAL_LABEL: Record<string, string> = { new_high: 'New High', rising: 'Rising', stable: 'Stable', falling: 'Falling', new_low: 'New Low' }
              const sig = marketSnap?.signal ?? 'stable'
              const sigColor = SIGNAL_COLOR[sig] ?? 'var(--ink3)'
              const Chg = ({ v }: { v: number | null | undefined }) => {
                if (v == null) return <span className="font-num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink3)' }}>—</span>
                return <span className="font-num" style={{ fontSize: 16, fontWeight: 700, color: v >= 0 ? 'var(--green)' : 'var(--red)' }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span>
              }
              return (
                <div className="dash-market" style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '12px 18px 11px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>CI Market Index</span>
                    <Link href="/market" style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>Full market →</Link>
                  </div>
                  {/* Index level */}
                  <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 10 }}>Index Level</div>
                    <div className="font-num" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: 'var(--gold)', lineHeight: 1, marginBottom: 6 }}>
                      {marketSnap?.level != null ? marketSnap.level.toFixed(2) : '—'}
                    </div>
                    {marketSnap && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, color: sigColor, background: `${sigColor}18`, border: `1px solid ${sigColor}44` }}>
                        {SIGNAL_LABEL[sig]}
                      </span>
                    )}
                  </div>
                  {/* 7d / 30d */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border)' }}>
                    {[
                      { label: '7D Change', value: marketSnap?.change7d },
                      { label: '30D Change', value: marketSnap?.change30d },
                    ].map((m, i) => (
                      <div key={i} style={{ padding: '14px 16px', borderRight: i === 0 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 8 }}>{m.label}</div>
                        <Chg v={m.value} />
                      </div>
                    ))}
                  </div>
                  {/* Top rising items in market */}
                  <div style={{ flex: 1 }}>
                    {marketSnap && marketSnap.topRising.length > 0 ? marketSnap.topRising.slice(0, 3).map((item, i) => {
                      const params = new URLSearchParams({ name: item.card_name, grade: item.grade })
                      return (
                        <Link key={i} href={`/card/${item.card_id}?${params}`}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', textDecoration: 'none', background: 'transparent', transition: 'background 0.12s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-subtle)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.card_name}</div>
                            <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{item.grade}</div>
                          </div>
                          <div style={{ textAlign: 'right' as const, flexShrink: 0, marginLeft: 8 }}>
                            {item.price != null && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(item.price)}</div>}
                            {item.change != null && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)' }}>+{item.change.toFixed(1)}%</div>}
                          </div>
                        </Link>
                      )
                    }) : Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 11, width: '70%', borderRadius: 3, background: 'var(--surface2)', marginBottom: 5 }} />
                          <div style={{ height: 9, width: '40%', borderRadius: 3, background: 'var(--surface2)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ── Recently Viewed — card thumbnail grid ── */}
          <div className="dash-recently-viewed">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase' }}>Recently Viewed</span>
              <Link href="/search" style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>Search cards →</Link>
            </div>
            {recentlyViewed.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center' as const }}>
                <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 12 }}>No recent searches yet</p>
                <Link href="/search" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Find your first card →</Link>
              </div>
            ) : (
              <div className="dash-rv-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                {recentlyViewed.map((item, i) => {
                  const params = new URLSearchParams({ grade: item.grade, name: item.card_name })
                  if (item.set_name) params.set('set', item.set_name)
                  return (
                    <Link key={`${item.card_id}-${i}`} href={`/card/${item.card_id}?${params.toString()}`}
                      style={{ textDecoration: 'none', transition: 'opacity 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: 6, background: 'linear-gradient(160deg, var(--surface2) 0%, rgba(100,100,180,0.12) 100%)', border: '1px solid var(--border2)', marginBottom: 8 }} />
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.card_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{item.grade}</div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Upgrade banner (free users only) ── */}
          {tier === 'free' && (
            <div style={{ borderRadius: 14, background: 'var(--gold2)', border: '1px solid rgba(232,197,71,0.2)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)', marginBottom: 3 }}>Unlock the full CardIndex</div>
                <div style={{ fontSize: 12, color: 'rgba(232,197,71,0.7)' }}>Price history charts, trend indicators, unlimited watchlist and more.</div>
              </div>
              <Link href="/pricing" style={{ padding: '9px 20px', borderRadius: 10, background: 'var(--gold)', color: '#080810', textDecoration: 'none', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                See plans
              </Link>
            </div>
          )}

        </div>
      </main>

      <style>{`
        @keyframes ptr-spin { to { transform: rotate(360deg); } }

        /* Desktop: page header visible, no top padding (sidebar handles nav) */
        @media (min-width: 641px) {
          body.has-sidebar .dash-page-header { display: flex !important; }
          body.has-sidebar main { padding-top: 0 !important; }
        }

        @media (max-width: 640px) {
          .dash-page-header { display: none !important; }
          .dash-two-col { grid-template-columns: 1fr !important; }
          .dash-rv-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .dash-content { padding: 16px 16px 0 !important; gap: 12px !important; }
        }
      `}</style>
    </>
  )
}
