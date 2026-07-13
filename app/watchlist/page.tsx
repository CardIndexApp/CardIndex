'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import AuthModal from '@/components/AuthModal'
import { SetAlertModal } from '@/components/AlertCentre'
import { tcgImg } from '@/lib/img'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { useCurrency } from '@/lib/currency'
import { usePullToRefresh } from '@/lib/usePullToRefresh'
import { cacheGet, cacheSet } from '@/lib/searchCache'
import { getTierLimits } from '@/lib/tier'

// ── Watchlist Group types ──────────────────────────────────────────────────────
interface WatchlistGroup {
  id: string
  user_id: string
  name: string
  created_at: string
}

// ── Types ────────────────────────────────────────────────────────────────────

interface WatchlistItem {
  id: string
  user_id: string
  card_id: string
  card_name: string
  set_name: string | null
  grade: string
  card_number: string | null
  image_url: string | null
  added_at: string
}

interface PriceData {
  price: number
  price_change_pct: number
  price_history: { month: string; price: number; volume?: number }[]
  score: number
  avg7d?: number | null
  avg30d?: number | null
  trend?: 'up' | 'down' | 'stable' | null
}

interface EnrichedItem extends WatchlistItem {
  priceData: PriceData | null
  priceLoading: boolean
  priceError: string | null
}

type SortKey = 'price' | 'change' | 'score' | 'name'
type Filter = 'all' | 'up' | 'down'

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const offset = (1 - score / 100) * 94.25
  const color = score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--gold)' : 'var(--red)'
  return (
    <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
      <svg width="38" height="38" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="19" cy="19" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="19" cy="19" r="15" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray="94.25" strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span style={{ position: 'relative', zIndex: 1, fontSize: 11, fontWeight: 700, color }}>{score}</span>
    </div>
  )
}

function VerdictBadge({ score }: { score: number }) {
  if (score >= 75) return <span className="wl-badge wl-badge-buy">BUY</span>
  if (score >= 50) return <span className="wl-badge wl-badge-hold">HOLD</span>
  return <span className="wl-badge wl-badge-sell">SELL</span>
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow({ last }: { last: boolean }) {
  return (
    <div className="wl-row" style={{ borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      {/* Card cell */}
      <div className="wl-cell-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0 }} className="skeleton" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ width: 140 }} className="skeleton skeleton-text" />
          <div style={{ width: 90 }} className="skeleton skeleton-text" />
        </div>
      </div>
      {/* Score ring (desktop) */}
      <div className="wl-hide-mobile" style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%' }} className="skeleton" />
      </div>
      {/* Price */}
      <div className="wl-cell-price" style={{ textAlign: 'right' }}>
        <div style={{ width: 60, marginLeft: 'auto' }} className="skeleton skeleton-text" />
      </div>
      {/* 7D change (desktop) */}
      <div className="wl-hide-mobile" style={{ textAlign: 'right' }}>
        <div style={{ width: 48, marginLeft: 'auto' }} className="skeleton skeleton-text" />
      </div>
      {/* 30D change (desktop) */}
      <div className="wl-hide-mobile" style={{ textAlign: 'right' }}>
        <div style={{ width: 48, marginLeft: 'auto' }} className="skeleton skeleton-text" />
      </div>
      {/* Verdict (desktop) */}
      <div className="wl-hide-mobile" style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 52, height: 22, borderRadius: 6 }} className="skeleton" />
      </div>
      {/* Remove placeholder */}
      <div className="wl-cell-remove" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 28, height: 28, borderRadius: 7 }} className="skeleton" />
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
          Track cards you care about and see live market data in one place.
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
  const [userTier, setUserTier] = useState<string>('free')

  const [items, setItems] = useState<EnrichedItem[]>([])
  const [listLoading, setListLoading] = useState(false)

  const [sort, setSort] = useState<SortKey>('score')
  const [filter, setFilter] = useState<Filter>('all')

  // Watchlist groups (Pro)
  const [groups, setGroups] = useState<WatchlistGroup[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  // Alert modal
  const [alertItem, setAlertItem] = useState<EnrichedItem | null>(null)

  // Tab: 'overview' | 'cards'
  const [wlTab, setWlTab] = useState<'overview' | 'cards'>('cards')


  const { fmtCurrency } = useCurrency()

  // ── Auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user)
      setAuthChecked(true)
      if (data.user) {
        const { data: prof } = await supabase.from('profiles').select('tier').eq('id', data.user.id).single()
        const tier = prof?.tier ?? 'free'
        setUserTier(tier)
        // Load watchlist groups for Pro users
        if (tier === 'pro') {
          const { data: grps } = await supabase
            .from('watchlist_groups')
            .select('*')
            .eq('user_id', data.user.id)
            .order('created_at', { ascending: true })
          setGroups(grps ?? [])
        }
      }
    })
  }, [])

  // ── Per-card price fetch with auto-retry ─────────────────────────────────
  async function fetchPriceForItem(item: EnrichedItem, bustCache = false, attempt = 0) {
    const localKey = `${item.card_id}:${item.grade}`

    // ── Client-side cache hit (instant, no network) ──────────────────────
    if (attempt === 0 && !bustCache) {
      const hit = cacheGet<PriceData>(localKey)
      if (hit) {
        setItems(prev => prev.map(p => p.id === item.id
          ? { ...p, priceData: hit, priceLoading: false, priceError: null } : p))
        return
      }
    }

    const params = new URLSearchParams({ grade: item.grade, name: item.card_name })
    if (item.set_name)               params.set('set', item.set_name)
    if (item.card_number)            params.set('number', item.card_number)
    if (bustCache || attempt > 0)    params.set('bust_cache', '1')

    if (attempt === 0) {
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, priceLoading: true, priceError: null } : p))
    }

    try {
      const r = await fetch(`/api/card/${item.card_id}?${params.toString()}`)
      const json = await r.json().catch(() => null)

      if (!r.ok || !json?.data) {
        // Rate limited or transient server error — retry up to 2 times with backoff
        if (r.status !== 404 && attempt < 2) {
          const delay = r.status === 429 ? (attempt + 1) * 3000 : (attempt + 1) * 1500
          await new Promise(res => setTimeout(res, delay))
          return fetchPriceForItem(item, bustCache, attempt + 1)
        }

        const raw = json?.error ?? `HTTP ${r.status}`
        const errMsg = raw === 'Card not found on Poketrace'
          ? 'Not in database'
          : raw.startsWith('No price data')
          ? 'No price data'
          : raw === 'POKETRACE_API_KEY not configured'
          ? 'Service unavailable'
          : raw
        setItems(prev => prev.map(p =>
          p.id === item.id ? { ...p, priceLoading: false, priceError: errMsg } : p
        ))
        return
      }

      cacheSet(localKey, json.data)
      setItems(prev => prev.map(p =>
        p.id === item.id ? { ...p, priceData: json.data, priceLoading: false, priceError: null } : p
      ))
    } catch {
      if (attempt < 2) {
        await new Promise(res => setTimeout(res, (attempt + 1) * 1500))
        return fetchPriceForItem(item, bustCache, attempt + 1)
      }
      setItems(prev => prev.map(p =>
        p.id === item.id ? { ...p, priceLoading: false, priceError: 'Network error' } : p
      ))
    }
  }

  function retryItem(item: EnrichedItem) {
    fetchPriceForItem(item, true)
  }

  // ── Fetch watchlist ───────────────────────────────────────────────────────
  const loadWatchlist = useCallback(async () => {
    if (!user) return
    const LIST_KEY = `watchlist:items:${user.id}`

    // ── 1. Render from cache instantly ────────────────────────────────────
    const cachedItems = cacheGet<WatchlistItem[]>(LIST_KEY)
    if (cachedItems) {
      const enriched: EnrichedItem[] = cachedItems.map(item => {
        const hit = cacheGet<PriceData>(`${item.card_id}:${item.grade}`)
        return { ...item, priceData: hit ?? null, priceLoading: !hit, priceError: null }
      })
      setItems(enriched)
      const uncached = enriched.filter(item => !item.priceData)
      uncached.forEach((item, i) => setTimeout(() => fetchPriceForItem(item), i * 600))
    } else {
      setListLoading(true)
    }

    // ── 2. Silently refresh from server ───────────────────────────────────
    try {
      const r = await fetch('/api/watchlist')
      const { items: raw }: { items: WatchlistItem[] } = await r.json()
      const freshItems = raw ?? []
      cacheSet(LIST_KEY, freshItems)

      const enriched: EnrichedItem[] = freshItems.map(item => {
        const hit = cacheGet<PriceData>(`${item.card_id}:${item.grade}`)
        return { ...item, priceData: hit ?? null, priceLoading: !hit, priceError: null }
      })
      setItems(enriched)
      const uncached = enriched.filter(item => !item.priceData)
      uncached.forEach((item, i) => setTimeout(() => fetchPriceForItem(item), i * 600))
    } finally {
      setListLoading(false)
    }
  }, [user])

  useEffect(() => { loadWatchlist() }, [loadWatchlist])

  const { pullY, refreshing } = usePullToRefresh(loadWatchlist)

  // ── Remove handler ────────────────────────────────────────────────────────
  async function handleRemove(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    // Optimistic removal
    setItems(prev => prev.filter(p => p.id !== id))
    await fetch(`/api/watchlist?id=${id}`, { method: 'DELETE' })
    if (user) cacheSet(`watchlist:items:${user.id}`, null)
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
        @keyframes ptr-spin { to { transform: rotate(360deg); } }
        @keyframes sk-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .sk-pulse { animation: sk-pulse 1.6s ease-in-out infinite; }
        .wl-badge {
          display: inline-flex; align-items: center;
          padding: 4px 10px; border-radius: 6px;
          font-size: 11.5px; font-weight: 700; letter-spacing: 0.02em;
        }
        .wl-badge-buy  { background: rgba(74,222,128,.12); color: #4ade80; border: 1px solid rgba(74,222,128,.3); }
        .wl-badge-hold { background: rgba(232,185,35,.12);  color: #e8b923; border: 1px solid rgba(232,185,35,.3); }
        .wl-badge-sell { background: rgba(248,113,113,.12); color: #f87171; border: 1px solid rgba(248,113,113,.3); }
        @media (max-width: 640px) {
          .wl-header > span { display: none !important; }
          .wl-header::before { content: 'CARD'; font-size: 10px; color: var(--ink3); letter-spacing: 1px; text-transform: uppercase; }
          .wl-header::after  { content: 'PRICE'; font-size: 10px; color: var(--ink3); letter-spacing: 1px; text-transform: uppercase; grid-column: 2; text-align: right; }
          .wl-two-col { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 641px) {
          body.has-sidebar main { padding-top: 0 !important; }
        }
      `}</style>

      <main style={{ paddingTop: 72, paddingBottom: 96, minHeight: '100vh' }}>
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
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 0' }}>

          {/* Header */}
          <div className="fade-up-1" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', margin: 0, marginBottom: 6 }}>Watchlist</h1>
              <p style={{ fontSize: 14, color: 'var(--ink3)', margin: 0 }}>
                Tracking {items.length} card{items.length !== 1 ? 's' : ''}{groups.length > 0 ? ` across ${groups.length} list${groups.length !== 1 ? 's' : ''}` : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {userTier === 'pro' ? (
                <button
                  onClick={() => {
                    const visible = items.filter(item => {
                      const pd = item.priceData
                      const change = pd ? pd.price_change_pct : null
                      if (filter === 'up' && (change == null || change < 0)) return false
                      if (filter === 'down' && (change == null || change >= 0)) return false
                      return true
                    })
                    const rows = [
                      ['Card Name', 'Grade', 'Set', 'Current Price (USD)', '24h Change %', 'Score'],
                      ...visible.map(item => [
                        `"${item.card_name}"`,
                        item.grade,
                        `"${item.set_name ?? ''}"`,
                        item.priceData ? item.priceData.price.toFixed(2) : '',
                        item.priceData ? item.priceData.price_change_pct.toFixed(2) : '',
                        item.priceData ? String(item.priceData.score) : '',
                      ])
                    ]
                    const csv = rows.map(r => r.join(',')).join('\n')
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `Watchlist-${new Date().toISOString().slice(0, 10)}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink3)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.color = 'var(--green)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--ink3)' }}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3"/><polyline points="4 6 8 10 12 6"/><line x1="8" y1="1" x2="8" y2="10"/>
                  </svg>
                  Export CSV
                </button>
              ) : user ? (
                <Link href="/pricing" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink3)', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
                  🔒 CSV — Pro
                </Link>
              ) : null}
              <Link href="/search" style={{ padding: '9px 20px', borderRadius: 10, background: 'var(--gold)', color: '#080810', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                + Add card
              </Link>
            </div>
          </div>

          {/* ── Not logged in ── */}
          {authChecked && !user ? (
            <SignInPrompt onSignIn={() => setShowAuthModal(true)} />
          ) : (
            <>
              {/* ── Tabs: Overview / Cards ── */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24, gap: 0 }}>
                {(['overview', 'cards'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setWlTab(t)}
                    style={{
                      padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: wlTab === t ? 700 : 400,
                      color: wlTab === t ? 'var(--gold)' : 'var(--ink3)',
                      borderBottom: `2px solid ${wlTab === t ? 'var(--gold)' : 'transparent'}`,
                      marginBottom: -1, transition: 'all 0.15s',
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* ── Overview Tab ── */}
              {wlTab === 'overview' && (() => {
                const pricedItems = items.filter(i => i.priceData)
                const totalValue  = pricedItems.reduce((s, i) => s + (i.priceData?.price ?? 0), 0)
                const gainers = [...pricedItems].sort((a, b) => (b.priceData?.price_change_pct ?? 0) - (a.priceData?.price_change_pct ?? 0)).filter(i => (i.priceData?.price_change_pct ?? 0) > 0).slice(0, 4)
                const losers  = [...pricedItems].sort((a, b) => (a.priceData?.price_change_pct ?? 0) - (b.priceData?.price_change_pct ?? 0)).filter(i => (i.priceData?.price_change_pct ?? 0) < 0).slice(0, 4)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Summary stats — large numbers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                      {[
                        { label: 'Watching', value: items.length, color: 'var(--ink)' },
                        { label: 'Rising Today', value: rising, color: 'var(--green)' },
                      ].map((s, i) => (
                        <div key={i} style={{ background: 'var(--surface)', padding: '20px 24px' }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
                          <div className="font-num" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: s.color, lineHeight: 1 }}>{s.value}</div>
                          {i === 1 && falling > 0 && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 4 }}>{falling} falling</div>}
                          {i === 0 && totalValue > 0 && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>{fmtCurrency(totalValue)} total value</div>}
                        </div>
                      ))}
                    </div>

                    {/* Two-col: Top Movers + Watchlists */}
                    <div className="wl-two-col" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
                      {/* Top Movers card */}
                      <div style={{ borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px 11px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Top Movers Today</span>
                          <button onClick={() => setWlTab('cards')} style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>All cards →</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                          {/* Gainers */}
                          <div style={{ borderRight: '1px solid var(--border)' }}>
                            <div style={{ padding: '9px 14px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--green)' }}>Gainers</span>
                            </div>
                            {gainers.length > 0 ? gainers.map((item, i) => {
                              const pct = item.priceData?.price_change_pct ?? 0
                              const cardParams = new URLSearchParams({ name: item.card_name, grade: item.grade })
                              if (item.set_name) cardParams.set('set', item.set_name)
                              return (
                                <Link key={item.id} href={`/card/${item.card_id}?${cardParams}`}
                                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < gainers.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', background: 'transparent', transition: 'background 0.12s' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-subtle)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                  <div style={{ width: 30, height: 42, borderRadius: 4, background: 'linear-gradient(135deg, var(--surface2) 0%, rgba(61,232,138,0.1) 100%)', border: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden' }}>
                                    {item.image_url && <img src={tcgImg(item.image_url)} alt={item.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.card_name}</div>
                                    <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 2, fontWeight: 700 }}>+{pct.toFixed(1)}%</div>
                                  </div>
                                  {item.priceData && <div className="font-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>{fmtCurrency(item.priceData.price)}</div>}
                                </Link>
                              )
                            }) : (
                              <div style={{ padding: '24px 14px', textAlign: 'center' as const }}>
                                <div style={{ fontSize: 11, color: 'var(--ink3)' }}>No gainers today</div>
                              </div>
                            )}
                          </div>
                          {/* Losers */}
                          <div>
                            <div style={{ padding: '9px 14px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)' }}>Losers</span>
                            </div>
                            {losers.length > 0 ? losers.map((item, i) => {
                              const pct = item.priceData?.price_change_pct ?? 0
                              const cardParams = new URLSearchParams({ name: item.card_name, grade: item.grade })
                              if (item.set_name) cardParams.set('set', item.set_name)
                              return (
                                <Link key={item.id} href={`/card/${item.card_id}?${cardParams}`}
                                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < losers.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', background: 'transparent', transition: 'background 0.12s' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-subtle)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                  <div style={{ width: 30, height: 42, borderRadius: 4, background: 'linear-gradient(135deg, var(--surface2) 0%, rgba(232,82,74,0.1) 100%)', border: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden' }}>
                                    {item.image_url && <img src={tcgImg(item.image_url)} alt={item.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.card_name}</div>
                                    <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2, fontWeight: 700 }}>{pct.toFixed(1)}%</div>
                                  </div>
                                  {item.priceData && <div className="font-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>{fmtCurrency(item.priceData.price)}</div>}
                                </Link>
                              )
                            }) : (
                              <div style={{ padding: '24px 14px', textAlign: 'center' as const }}>
                                <div style={{ fontSize: 11, color: 'var(--ink3)' }}>No losers today</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Watchlists sidebar */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* My Watchlists */}
                        <div style={{ borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
                          <div style={{ padding: '12px 16px 11px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>My Watchlists</span>
                            {userTier === 'pro' && <button onClick={() => setShowNewGroup(true)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ New</button>}
                          </div>
                          {groups.length > 0 ? groups.map((g, i) => (
                            <button key={g.id} onClick={() => { setActiveGroupId(g.id); setWlTab('cards') }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: i < groups.length - 1 ? '1px solid var(--border)' : 'none', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, transition: 'background 0.12s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-subtle)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{g.name}</div>
                              </div>
                              <div style={{ fontSize: 14, color: 'var(--ink3)' }}>›</div>
                            </button>
                          )) : (
                            /* Default: show all items */
                            <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>All Cards</div>
                                <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{items.length} cards</div>
                              </div>
                              <div style={{ fontSize: 14, color: 'var(--ink3)' }}>›</div>
                            </div>
                          )}
                        </div>

                        {/* Quick add */}
                        <div style={{ borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', padding: '14px 16px' }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 10 }}>Quick Add</div>
                          <Link href="/search" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', textDecoration: 'none', transition: 'border-color 0.12s' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="1.6"><circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14.5" y2="14.5"/></svg>
                            <span style={{ fontSize: 12, color: 'var(--ink3)' }}>Search for a card…</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* ── Cards Tab ── */}
              {wlTab === 'cards' && (
              <>
              {/* Summary strip */}
              {(() => {
                const limit = getTierLimits(userTier).watchlist
                const used = items.length
                const pct = Math.min(used / limit, 1)
                const nearLimit = pct >= 0.8
                const atLimit = used >= limit
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
                    {/* Capacity tile */}
                    <div style={{ borderRadius: 12, padding: '16px 18px', background: 'var(--surface)', border: `1px solid ${atLimit ? 'rgba(232,82,74,0.3)' : nearLimit ? 'rgba(232,197,71,0.25)' : 'var(--border)'}` }}>
                      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 6, textTransform: 'uppercase' }}>Cards watched</div>
                      <div className="font-num" style={{ fontSize: 22, fontWeight: 900, color: atLimit ? 'var(--red)' : nearLimit ? 'var(--gold)' : 'var(--ink)', letterSpacing: '-0.5px' }}>
                        {used}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink3)' }}> / {limit}</span>
                      </div>
                      <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct * 100}%`, borderRadius: 2, background: atLimit ? 'var(--red)' : nearLimit ? 'var(--gold)' : 'var(--green)', transition: 'width 0.4s ease' }} />
                      </div>
                      {atLimit ? (
                        <Link href="/pricing" style={{ fontSize: 9, color: 'var(--red)', textDecoration: 'none', letterSpacing: 0.5, marginTop: 4, display: 'block' }}>LIMIT REACHED — UPGRADE</Link>
                      ) : nearLimit ? (
                        <Link href="/pricing" style={{ fontSize: 9, color: 'var(--gold)', textDecoration: 'none', letterSpacing: 0.5, marginTop: 4, display: 'block' }}>{limit - used} SLOT{limit - used !== 1 ? 'S' : ''} REMAINING</Link>
                      ) : (
                        <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 3 }}>{limit - used} slots remaining</div>
                      )}
                    </div>
                    {/* Rising */}
                    <div style={{ borderRadius: 12, padding: '16px 18px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 6, textTransform: 'uppercase' }}>Rising today</div>
                      <div className="font-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)', letterSpacing: '-0.5px' }}>{rising}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 3 }}>cards up</div>
                    </div>
                    {/* Falling */}
                    <div style={{ borderRadius: 12, padding: '16px 18px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 6, textTransform: 'uppercase' }}>Falling today</div>
                      <div className="font-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--red)', letterSpacing: '-0.5px' }}>{falling}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 3 }}>cards down</div>
                    </div>
                  </div>
                )
              })()}

              {/* ── Watchlist Groups (Pro) ── */}
              {userTier === 'pro' && groups.length > 0 && (
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setActiveGroupId(null)}
                    style={{ padding: '5px 14px', borderRadius: 99, border: `1px solid ${activeGroupId === null ? 'var(--gold)' : 'var(--border2)'}`, background: activeGroupId === null ? 'var(--gold2)' : 'transparent', color: activeGroupId === null ? 'var(--gold)' : 'var(--ink3)', fontSize: 12, fontWeight: activeGroupId === null ? 700 : 400, cursor: 'pointer' }}
                  >All</button>
                  {groups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setActiveGroupId(g.id)}
                      style={{ padding: '5px 14px', borderRadius: 99, border: `1px solid ${activeGroupId === g.id ? 'var(--gold)' : 'var(--border2)'}`, background: activeGroupId === g.id ? 'var(--gold2)' : 'transparent', color: activeGroupId === g.id ? 'var(--gold)' : 'var(--ink3)', fontSize: 12, fontWeight: activeGroupId === g.id ? 700 : 400, cursor: 'pointer' }}
                    >{g.name}</button>
                  ))}
                  <button
                    onClick={() => setShowNewGroup(true)}
                    style={{ padding: '5px 12px', borderRadius: 99, border: '1px dashed var(--border2)', background: 'transparent', color: 'var(--ink3)', fontSize: 12, cursor: 'pointer' }}
                  >+ New Group</button>
                </div>
              )}

              {/* New Group modal */}
              {showNewGroup && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                  onClick={e => { if (e.target === e.currentTarget) { setShowNewGroup(false); setNewGroupName('') } }}>
                  <div style={{ width: '100%', maxWidth: 360, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border2)', padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>New Watchlist</div>
                    <input
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      placeholder="Name…"
                      autoFocus
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && newGroupName.trim() && user) {
                          const { data: g } = await createClient().from('watchlist_groups').insert({ user_id: user.id, name: newGroupName.trim() }).select().single()
                          if (g) setGroups(prev => [...prev, g])
                          setShowNewGroup(false); setNewGroupName('')
                        }
                      }}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setShowNewGroup(false); setNewGroupName('') }} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border2)', fontSize: 13, color: 'var(--ink3)', cursor: 'pointer' }}>Cancel</button>
                      <button onClick={async () => {
                        if (!newGroupName.trim() || !user) return
                        const { data: g } = await createClient().from('watchlist_groups').insert({ user_id: user.id, name: newGroupName.trim() }).select().single()
                        if (g) setGroups(prev => [...prev, g])
                        setShowNewGroup(false); setNewGroupName('')
                      }} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'var(--gold)', color: '#080810', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create</button>
                    </div>
                  </div>
                </div>
              )}

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
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>Card</span>
                  <span className="wl-hide-mobile" style={{ fontSize: 9, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '0.22em', textTransform: 'uppercase' as const, textAlign: 'center' as const }}>Score</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '0.22em', textTransform: 'uppercase' as const, textAlign: 'right' as const }}>Price</span>
                  <span className="wl-hide-mobile" style={{ fontSize: 9, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '0.22em', textTransform: 'uppercase' as const, textAlign: 'right' as const }}>7D Chg</span>
                  <span className="wl-hide-mobile" style={{ fontSize: 9, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '0.22em', textTransform: 'uppercase' as const, textAlign: 'right' as const }}>30D Chg</span>
                  <span className="wl-hide-mobile" style={{ fontSize: 9, fontWeight: 600, color: 'var(--ink3)', letterSpacing: '0.22em', textTransform: 'uppercase' as const, textAlign: 'center' as const }}>Verdict</span>
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
                  const c7  = pd?.avg7d  ? ((pd.price - pd.avg7d)  / pd.avg7d)  * 100 : null
                  const c30 = pd?.avg30d ? ((pd.price - pd.avg30d) / pd.avg30d) * 100 : null

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
                      {/* Col 1: Card */}
                      <div className="wl-cell-card" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                          {item.image_url && (
                            <img src={tcgImg(item.image_url)} alt={item.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="wl-card-name" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.card_name}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--ink3)' }}>
                            {item.set_name ? `${item.set_name} · ` : ''}{item.grade}
                          </div>
                        </div>
                      </div>

                      {/* Col 2: Score ring (desktop only) */}
                      <div className="wl-hide-mobile" style={{ display: 'flex', justifyContent: 'center' }}>
                        {!getTierLimits(userTier).trendIndicators ? (
                          <Link href="/pricing" onClick={e => e.stopPropagation()} style={{ fontSize: 9, color: 'var(--ink3)', textDecoration: 'none', opacity: 0.6 }}>🔒</Link>
                        ) : item.priceLoading ? (
                          <div style={{ width: 38, height: 38, borderRadius: '50%' }} className="skeleton" />
                        ) : pd ? (
                          <ScoreRing score={score} />
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--ink3)' }}>—</span>
                        )}
                      </div>

                      {/* Col 3: Price */}
                      <div className="wl-cell-price" style={{ textAlign: 'right' }}>
                        {item.priceLoading ? (
                          <div style={{ width: 60, marginLeft: 'auto' }} className="skeleton skeleton-text" />
                        ) : pd ? (
                          <>
                            <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{fmtCurrency(pd.price)}</div>
                            <div className="font-num wl-cell-change" style={{ fontSize: 11, color: up ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
                              {up ? '+' : ''}{change.toFixed(1)}%
                            </div>
                          </>
                        ) : item.priceError ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <span style={{ fontSize: 10, color: 'var(--red)', opacity: 0.8 }}>{item.priceError}</span>
                            <button onClick={e => { e.preventDefault(); e.stopPropagation(); retryItem(item) }}
                              style={{ fontSize: 9, color: 'var(--ink3)', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>↺ retry</button>
                          </div>
                        ) : <span style={{ fontSize: 11, color: 'var(--ink3)' }}>—</span>}
                      </div>

                      {/* Col 4: 7D change (desktop only) */}
                      <div className="wl-hide-mobile" style={{ textAlign: 'right' }}>
                        {item.priceLoading ? (
                          <div style={{ width: 48, marginLeft: 'auto' }} className="skeleton skeleton-text" />
                        ) : c7 != null ? (
                          <span className="font-num" style={{ fontSize: 13, fontWeight: 600, color: c7 >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {c7 >= 0 ? '+' : ''}{c7.toFixed(1)}%
                          </span>
                        ) : <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>}
                      </div>

                      {/* Col 5: 30D change (desktop only) */}
                      <div className="wl-hide-mobile" style={{ textAlign: 'right' }}>
                        {item.priceLoading ? (
                          <div style={{ width: 48, marginLeft: 'auto' }} className="skeleton skeleton-text" />
                        ) : c30 != null ? (
                          <span className="font-num" style={{ fontSize: 13, fontWeight: 600, color: c30 >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {c30 >= 0 ? '+' : ''}{c30.toFixed(1)}%
                          </span>
                        ) : <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>}
                      </div>

                      {/* Col 6: Verdict (desktop only) */}
                      <div className="wl-hide-mobile" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {!getTierLimits(userTier).trendIndicators ? (
                          <Link href="/pricing" onClick={e => e.stopPropagation()} style={{ fontSize: 9, color: 'var(--ink3)', textDecoration: 'none', opacity: 0.6 }}>🔒</Link>
                        ) : item.priceLoading ? (
                          <div style={{ width: 52, height: 22, borderRadius: 6 }} className="skeleton" />
                        ) : pd ? (
                          <VerdictBadge score={score} />
                        ) : <span style={{ fontSize: 11, color: 'var(--ink3)' }}>—</span>}
                      </div>

                      {/* Col 7: Bell + Remove */}
                      <div className="wl-cell-remove" style={{ display: 'flex', justifyContent: 'flex-end', gap: 5 }}>
                        {!!user && (
                          <button
                            onClick={e => { e.preventDefault(); e.stopPropagation(); setAlertItem(item) }}
                            style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink3)' }}
                            title="Set price alert"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={e => handleRemove(e, item.id)}
                          style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink3)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink3)' }}
                          title="Remove from watchlist"
                        >×</button>
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
            </>
          )}

        </div>
      </main>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} defaultTab="signin" />}

      {/* Price Alert Modal */}
      {alertItem && (
        <SetAlertModal
          cardId={alertItem.card_id}
          cardName={alertItem.card_name}
          grade={alertItem.grade}
          currentPrice={alertItem.priceData?.price ?? null}
          imageUrl={alertItem.image_url}
          onClose={() => setAlertItem(null)}
          onSaved={() => setAlertItem(null)}
        />
      )}
    </>
  )
}
