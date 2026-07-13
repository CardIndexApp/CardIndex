'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { usePullToRefresh } from '@/lib/usePullToRefresh'
import { useCurrency } from '@/lib/currency'
import { cacheGet, cacheSet } from '@/lib/searchCache'
import { tcgImg } from '@/lib/img'
import { scoreColor } from '@/lib/data'

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
    topRising: { card_id: string; card_name: string; grade: string; change: number | null; price: number | null; score: number | null; image_url: string | null }[]
    topFalling: { card_id: string; card_name: string; grade: string; change: number | null; price: number | null; score: number | null; image_url: string | null }[]
    risingCount: number
    fallingCount: number
  } | null>(null)
  const [alerts, setAlerts] = useState<{ id: string; card_name: string; grade: string; target_price: number; direction: 'above' | 'below'; is_active: boolean; triggered_at: string | null }[]>([])
  const [watchlistTotal, setWatchlistTotal] = useState(0)
  const [groupsCount, setGroupsCount] = useState(0)

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
    const [{ data: prof }, { count: wlCount }, { data: pf }, { count: grpCount }] = await Promise.all([
      supabase.from('profiles').select('email, username, tier').eq('id', user.id).single(),
      supabase.from('watchlists').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('portfolios').select('id, card_id, grade, purchase_price, quantity, sold, sale_price').eq('user_id', user.id),
      supabase.from('watchlist_groups').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ])

    const freshProfile: Profile = prof ?? { email: user.email ?? '', username: null, tier: 'free' }
    setProfile(freshProfile)
    setWatchlistTotal(wlCount ?? 0)
    setGroupsCount(grpCount ?? 0)

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
    cacheSet<DashCache>(DASH_KEY, { profile: freshProfile, watchlist: [], portfolioStats: freshStats })

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
          topRising: (d.topRising ?? []).slice(0, 8),
          topFalling: (d.topFalling ?? []).slice(0, 3),
          risingCount: d.stats?.risingCount ?? 0,
          fallingCount: d.stats?.fallingCount ?? 0,
        })
      })
      .catch(() => {})

    // Alerts — non-blocking
    fetch('/api/alerts')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.alerts) setAlerts(d.alerts) })
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

  const activeAlerts  = alerts.filter(a => a.is_active)
  const firedAlerts   = alerts.filter(a => !a.is_active && a.triggered_at).slice(0, 4)

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

        <div className="dash-content" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Page title ── */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)' }}>Dashboard</div>
          </div>

          {/* ── Stat tiles ── */}
          {(() => {
            const hasPrices = (portfolioStats?.cachedCount ?? 0) > 0
            const pfValue   = hasPrices ? portfolioStats?.currentValue : portfolioStats?.costBasis
            const pfLabel   = hasPrices ? 'Portfolio Value' : 'Cost Basis'
            const pfChange  = hasPrices && portfolioStats ? portfolioStats.currentValue - portfolioStats.costBasis : null

            const wlSub = groupsCount > 0 ? `across ${groupsCount} collection${groupsCount !== 1 ? 's' : ''}` : 'in watchlist'
            const alertSub = firedAlerts.length > 0 ? `${firedAlerts.length} triggered today` : 'none triggered'
            const alertSubColor = firedAlerts.length > 0 ? 'var(--red)' : 'var(--ink3)'
            const gainersVal = marketSnap?.risingCount ?? 0
            const gainersColor = gainersVal > 0 ? 'var(--green)' : 'var(--ink)'

            const tiles: { label: string; value: string; valueColor: string; sub: string; subColor: string; change?: number | null; href: string | null }[] = [
              {
                label: pfLabel,
                value: pfValue != null ? fmtCurrency(pfValue) : '—',
                valueColor: 'var(--ink)',
                sub: portfolioStats?.posCount ? `${portfolioStats.posCount} positions${!hasPrices ? ' · visit portfolio' : ''}` : 'No positions yet',
                subColor: 'var(--ink3)',
                change: pfChange,
                href: '/portfolio',
              },
              {
                label: 'Cards Tracked',
                value: watchlistTotal.toString(),
                valueColor: 'var(--ink)',
                sub: wlSub,
                subColor: 'var(--ink3)',
                href: '/watchlist',
              },
              {
                label: 'Active Alerts',
                value: activeAlerts.length.toString(),
                valueColor: 'var(--ink)',
                sub: alertSub,
                subColor: alertSubColor,
                href: null,
              },
              {
                label: "Today's Gainers",
                value: marketSnap ? gainersVal.toString() : '—',
                valueColor: gainersColor,
                sub: marketSnap?.fallingCount != null ? `vs ${marketSnap.fallingCount} losers` : 'from market index',
                subColor: 'var(--ink3)',
                href: '/market',
              },
            ]
            return (
              <div className="dash-stat-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {tiles.map((t, i) => {
                  const inner = (
                    <div style={{ padding: '20px 22px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 10 }}>{t.label}</div>
                      <div className="font-num" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: t.valueColor, lineHeight: 1, marginBottom: 8 }}>{t.value}</div>
                      {t.change != null && (
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.change >= 0 ? 'var(--green)' : 'var(--red)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {t.change >= 0 ? <><line x1="5" y1="9" x2="5" y2="1"/><polyline points="2,4 5,1 8,4"/></> : <><line x1="5" y1="1" x2="5" y2="9"/><polyline points="2,6 5,9 8,6"/></>}
                          </svg>
                          {t.change >= 0 ? '+' : '−'}{fmtCurrency(Math.abs(t.change))} today
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: t.subColor }}>{t.sub}</div>
                    </div>
                  )
                  const tileStyle: React.CSSProperties = { borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', textDecoration: 'none', display: 'block', transition: 'border-color 0.15s' }
                  return t.href ? (
                    <Link key={i} href={t.href} style={tileStyle}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,197,71,0.3)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                    >{inner}</Link>
                  ) : (
                    <div key={i} style={tileStyle}>{inner}</div>
                  )
                })}
              </div>
            )
          })()}

          {/* ── Two-col: Movers table + right sidebar ── */}
          <div className="dash-two-col" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 16, alignItems: 'start' }}>

            {/* TOP MOVERS TODAY — table layout */}
            <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px 11px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Top Movers Today</span>
                <Link href="/market" style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>View all →</Link>
              </div>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 52px', padding: '8px 18px', gap: 8, borderBottom: '1px solid var(--border)' }}>
                {['CARD', 'PRICE', '7D CHG', 'SCORE'].map((h, i) => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', textAlign: i > 0 ? 'right' as const : 'left' as const }}>{h}</div>
                ))}
              </div>
              {/* Rows */}
              {marketSnap && marketSnap.topRising.length > 0 ? marketSnap.topRising.map((item, i) => {
                const params = new URLSearchParams({ name: item.card_name, grade: item.grade })
                const sc = item.score
                const scColor = sc == null ? 'var(--ink3)' : sc >= 75 ? 'var(--green)' : sc >= 50 ? 'var(--gold)' : 'var(--red)'
                const gradients = [
                  'linear-gradient(135deg,#1a3a6e,#2d5aa0)',
                  'linear-gradient(135deg,#6e1a6e,#a03da0)',
                  'linear-gradient(135deg,#2a6e3a,#3d9a52)',
                  'linear-gradient(135deg,#6e3a1a,#a05a2d)',
                  'linear-gradient(135deg,#1a5a6e,#2d8ca0)',
                  'linear-gradient(135deg,#3a6e1a,#5aa03d)',
                  'linear-gradient(135deg,#6e1a3a,#a03d5a)',
                  'linear-gradient(135deg,#1a6e5a,#2da08c)',
                ]
                return (
                  <Link key={i} href={`/card/${item.card_id}?${params}`}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 52px', alignItems: 'center', gap: 8, padding: '11px 18px', borderBottom: i < marketSnap.topRising.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', background: 'transparent', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-subtle)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 8, background: item.image_url ? 'var(--surface2)' : gradients[i % gradients.length], border: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.image_url && <img src={tcgImg(item.image_url)} alt={item.card_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.card_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{item.grade}</div>
                      </div>
                    </div>
                    <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', textAlign: 'right' as const }}>
                      {item.price != null ? fmtCurrency(item.price) : '—'}
                    </div>
                    <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: item.change != null && item.change >= 0 ? 'var(--green)' : 'var(--red)', textAlign: 'right' as const }}>
                      {item.change != null ? `${item.change >= 0 ? '+' : ''}${item.change.toFixed(1)}%` : '—'}
                    </div>
                    <div className="font-num" style={{ fontSize: 15, fontWeight: 700, color: scColor, textAlign: 'right' as const }}>
                      {sc != null ? sc : '—'}
                    </div>
                  </Link>
                )
              }) : Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 52px', alignItems: 'center', gap: 8, padding: '11px 18px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0 }} />
                    <div>
                      <div style={{ height: 13, width: 120, borderRadius: 3, background: 'var(--surface2)', marginBottom: 6 }} />
                      <div style={{ height: 10, width: 70, borderRadius: 3, background: 'var(--surface2)' }} />
                    </div>
                  </div>
                  {[1, 2, 3].map(j => <div key={j} style={{ height: 13, borderRadius: 3, background: 'var(--surface2)', marginLeft: 'auto', width: 50 }} />)}
                </div>
              ))}
            </div>

            {/* Right column — Triggered Alerts + Market Snapshot */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Triggered Alerts */}
              <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px 11px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Triggered Alerts</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: activeAlerts.length > 0 ? 'var(--gold)' : 'var(--ink3)' }}>{activeAlerts.length} active</span>
                </div>
                {firedAlerts.length > 0 ? firedAlerts.map((alert, i) => {
                  const dirLabel = alert.direction === 'above' ? 'crossed above' : 'dropped below'
                  return (
                    <div key={alert.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: i < firedAlerts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', flexShrink: 0, marginTop: 4 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.card_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>Price {dirLabel} {fmtCurrency(alert.target_price)}</div>
                      </div>
                      {alert.triggered_at && <span style={{ fontSize: 10, color: 'var(--ink3)', flexShrink: 0 }}>{timeAgo(alert.triggered_at)}</span>}
                    </div>
                  )
                }) : (
                  <div style={{ padding: '20px 16px', textAlign: 'center' as const }}>
                    <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 8 }}>No alerts triggered yet</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''} watching</div>
                  </div>
                )}
              </div>

              {/* Market Snapshot */}
              {(() => {
                const scores = marketSnap?.topRising.map(r => r.score).filter((s): s is number => s != null) ?? []
                const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null
                const totalTracked = (marketSnap?.risingCount ?? 0) + (marketSnap?.fallingCount ?? 0)
                const holdCount = totalTracked > 0 ? Math.max(0, totalTracked - (marketSnap?.risingCount ?? 0) - (marketSnap?.fallingCount ?? 0)) : null
                const rows: { label: string; value: string | number | null; color: string }[] = [
                  { label: 'Avg score (tracked)', value: avgScore != null ? avgScore.toFixed(1) : null, color: 'var(--green)' },
                  { label: 'BUY signals', value: marketSnap?.risingCount ?? null, color: 'var(--green)' },
                  { label: 'HOLD signals', value: holdCount, color: 'var(--gold)' },
                  { label: 'SELL signals', value: marketSnap?.fallingCount ?? null, color: 'var(--red)' },
                ]
                return (
                  <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px 11px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Market Snapshot</span>
                      <Link href="/market" style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>Full market →</Link>
                    </div>
                    <div style={{ padding: '4px 0' }}>
                      {rows.map((row, i) => row.value != null && (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{row.label}</span>
                          <span className="font-num" style={{ fontSize: 15, fontWeight: 700, color: row.color }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* ── Recently Viewed ── */}
          {recentlyViewed.length > 0 && (
            <div className="dash-recently-viewed">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase' }}>Recently Viewed</span>
                <Link href="/search" style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>Search cards →</Link>
              </div>
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
            </div>
          )}

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
        @media (min-width: 641px) {
          body.has-sidebar main { padding-top: 0 !important; }
          .dash-content { padding-top: 32px !important; }
        }
        @media (max-width: 640px) {
          .dash-stat-tiles { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-two-col { grid-template-columns: 1fr !important; }
          .dash-rv-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .dash-content { padding: 16px 16px 0 !important; gap: 12px !important; }
        }
      `}</style>
    </>
  )
}
