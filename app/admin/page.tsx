'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { tcgImg } from '@/lib/img'

type Tier = 'free' | 'standard' | 'pro'

interface UserRow {
  id: string
  email: string
  username: string | null
  tier: Tier
  subscription_status: string | null
  stripe_customer_id: string | null
  created_at: string
  is_admin: boolean
}

interface UpgradeRequest {
  id: string
  user_id: string
  requested_tier: string
  requested_at: string
  actioned_at: string | null
  action: string | null
  user_email?: string
}

interface PortfolioStats {
  totalCostBasis: number
  totalMarketValue: number
  totalPositions: number
  pricedPositions: number
  usersWithPortfolio: number
}

interface Constituent {
  id: string
  card_id: string
  grade: string
  card_name: string
  set_name: string | null
  image_url: string | null
  added_at: string
  price: number | null
  price_change_pct: number | null
  last_fetched: string | null
}

interface TcgCard {
  id: string
  name: string
  set: { name: string; id: string }
  number: string
  images: { small: string; large: string }
  rarity?: string
}

type AdminTab = 'users' | 'market'

const TIER_COLORS: Record<Tier, string> = {
  free: 'var(--ink3)',
  standard: 'var(--blue, #4a9eff)',
  pro: 'var(--gold)',
}

const S = {
  card: { borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border2)', marginBottom: 16, overflow: 'hidden' } as React.CSSProperties,
  head: { padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  body: { padding: 22 } as React.CSSProperties,
  pill: (tier: Tier) => ({
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
    padding: '2px 9px',
    borderRadius: 99,
    color: TIER_COLORS[tier],
    background: tier === 'pro' ? 'rgba(232,197,71,0.1)' : tier === 'standard' ? 'rgba(74,158,255,0.1)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${tier === 'pro' ? 'rgba(232,197,71,0.3)' : tier === 'standard' ? 'rgba(74,158,255,0.3)' : 'rgba(255,255,255,0.12)'}`,
  } as React.CSSProperties),
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // ── Market Index tab ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const [constituents, setConstituents] = useState<Constituent[]>([])
  const [constitLoading, setConstitLoading] = useState(false)
  const [cardSearch, setCardSearch] = useState('')
  const [cardResults, setCardResults] = useState<TcgCard[]>([])
  const [cardSearching, setCardSearching] = useState(false)
  const [addingGrade, setAddingGrade] = useState<Record<string, string>>({})
  const [addingId, setAddingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState<{ done: number; total: number } | null>(null)
  const [seeding, setSeeding] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/'); return }

    // Verify admin via profile — fetch via API to use service role
    const res = await fetch('/api/admin/users')
    if (!res.ok) { router.replace('/dashboard'); return }
    const json = await res.json()
    setUsers(json.users ?? [])
    setRequests(json.requests ?? [])
    if (json.portfolioStats) setPortfolioStats(json.portfolioStats)
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  async function setTier(userId: string, tier: Tier) {
    setSavingId(userId)
    try {
      const res = await fetch('/api/admin/set-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier } : u))
      flash('ok', 'Tier updated.')
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Error')
    } finally {
      setSavingId(null)
    }
  }

  async function actionRequest(requestId: string, action: 'approve' | 'deny') {
    setActingId(requestId)
    try {
      const res = await fetch('/api/admin/action-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, actioned_at: new Date().toISOString(), action } : r))
      flash('ok', `Request ${action}d.`)
      // Reload to reflect tier change
      load()
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Error')
    } finally {
      setActingId(null)
    }
  }

  // ── Market index helpers ──────────────────────────────────────────────────
  const loadConstituents = useCallback(async () => {
    setConstitLoading(true)
    try {
      const r = await fetch('/api/admin/market/constituents')
      if (r.ok) {
        const json = await r.json()
        setConstituents(json.constituents ?? [])
      }
    } finally {
      setConstitLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'market' && constituents.length === 0 && !constitLoading) {
      loadConstituents()
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCardSearchInput(val: string) {
    setCardSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!val.trim()) { setCardResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setCardSearching(true)
      try {
        const r = await fetch(
          `https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(val.trim() + '*')}&pageSize=20&orderBy=-set.releaseDate`
        )
        const json = await r.json()
        setCardResults(json.data ?? [])
      } finally {
        setCardSearching(false)
      }
    }, 400)
  }

  async function addConstituent(card: TcgCard) {
    const grade = addingGrade[card.id] || 'PSA 10'
    setAddingId(card.id)
    try {
      const r = await fetch('/api/admin/market/constituents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: card.id,
          grade,
          card_name: card.name,
          set_name: card.set.name,
          image_url: card.images.small,
        }),
      })
      const json = await r.json()
      if (!r.ok) { flash('err', json.error ?? 'Error adding card'); return }
      flash('ok', `${card.name} (${grade}) added to index`)
      setCardResults([])
      setCardSearch('')
      loadConstituents()
    } finally {
      setAddingId(null)
    }
  }

  async function removeConstituent(id: string) {
    setRemovingId(id)
    try {
      const r = await fetch(`/api/admin/market/constituents?id=${id}`, { method: 'DELETE' })
      if (!r.ok) { flash('err', 'Failed to remove'); return }
      setConstituents(prev => prev.filter(c => c.id !== id))
    } finally {
      setRemovingId(null)
    }
  }

  async function seedIndex() {
    if (!confirm('This will upsert the CI-100 default card list into the database. Continue?')) return
    setSeeding(true)
    try {
      const r = await fetch('/api/admin/market/seed', { method: 'POST' })
      const json = await r.json()
      if (!r.ok) { flash('err', json.error ?? 'Seed failed'); return }
      flash('ok', `Seed complete — ${json.inserted} inserted, ${json.failed} failed${json.errors?.length ? ` (${json.errors[0]})` : ''}`)
      loadConstituents()
    } finally {
      setSeeding(false)
    }
  }

  async function refreshAllPrices() {
    const stale = constituents.filter(c => {
      if (!c.last_fetched) return true
      const age = Date.now() - new Date(c.last_fetched).getTime()
      return age > 6 * 60 * 60 * 1000 // older than 6h
    })
    if (stale.length === 0) { flash('ok', 'All prices are fresh (< 6h old)'); return }
    setRefreshing(true)
    setRefreshProgress({ done: 0, total: stale.length })
    let ok = 0, failed = 0
    let firstErrMsg = ''
    for (const c of stale) {
      try {
        const params = new URLSearchParams({ grade: c.grade, name: c.card_name })
        if (c.set_name) params.set('set', c.set_name)
        const r = await fetch(`/api/card/${c.card_id}?${params.toString()}`)
        if (r.ok) {
          ok++
        } else {
          failed++
          if (!firstErrMsg) {
            const body = await r.json().catch(() => ({}))
            firstErrMsg = `${c.card_name} (${c.card_id}) → ${r.status}: ${body?.error ?? 'unknown'}`
            console.error('[refresh] first failure:', firstErrMsg, body)
          }
        }
      } catch (e) {
        failed++
        if (!firstErrMsg) firstErrMsg = `${c.card_name}: network error`
        console.error(`[refresh] ${c.card_name} network error`, e)
      }
      setRefreshProgress({ done: ok + failed, total: stale.length })
      // Respect Poketrace rate limit — 500ms between requests
      await new Promise(r => setTimeout(r, 500))
    }
    setRefreshing(false)
    setRefreshProgress(null)
    if (failed === 0) {
      flash('ok', `Refreshed ${ok} card prices`)
    } else if (ok === 0) {
      flash('err', `All ${failed} failed. First: ${firstErrMsg}`)
    } else {
      flash('ok', `${ok} refreshed, ${failed} failed. First failure: ${firstErrMsg}`)
    }
    loadConstituents()
  }

  const filteredUsers = users.filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.username ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const pendingRequests = requests.filter(r => !r.actioned_at)

  if (loading) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 88, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--ink3)' }}>Loading admin…</span>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 88, paddingBottom: 88, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>

          {/* Header */}
          <div style={{ marginTop: 24, marginBottom: 32 }}>
            <Link href="/dashboard" style={{ fontSize: 12, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>← Dashboard</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>Admin</h1>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: '3px 10px', borderRadius: 99, background: 'rgba(232,82,74,0.1)', color: 'var(--red)', border: '1px solid rgba(232,82,74,0.25)' }}>
                ADMIN ACCESS
              </span>
            </div>
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderRadius: 10, padding: 4, background: 'var(--surface)', border: '1px solid var(--border2)', width: 'fit-content' }}>
            {([['users', 'Users'], ['market', 'Market Index']] as [AdminTab, string][]).map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: '7px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: activeTab === tab ? 'var(--surface2)' : 'transparent',
                color: activeTab === tab ? 'var(--ink)' : 'var(--ink3)',
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>

          {/* Flash message */}
          {msg && (
            <div style={{ marginBottom: 16, borderRadius: 10, padding: '12px 16px', background: msg.type === 'ok' ? 'rgba(61,232,138,0.08)' : 'rgba(232,82,74,0.08)', border: `1px solid ${msg.type === 'ok' ? 'rgba(61,232,138,0.2)' : 'rgba(232,82,74,0.25)'}`, fontSize: 13, color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)' }}>
              {msg.text}
            </div>
          )}

          {activeTab === 'users' && <>

          {/* Stats row — users by tier */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
            {(['free', 'standard', 'pro'] as Tier[]).map(t => (
              <div key={t} style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 6 }}>{t}</div>
                <div className="font-num" style={{ fontSize: 28, fontWeight: 800, color: TIER_COLORS[t] }}>
                  {users.filter(u => u.tier === t).length}
                </div>
              </div>
            ))}
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 6 }}>Total Users</div>
              <div className="font-num" style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>{users.length}</div>
            </div>
          </div>

          {/* Portfolio stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
            {/* Market value — primary stat */}
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid rgba(232,197,71,0.25)' }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 6 }}>
                Total Market Value
              </div>
              <div className="font-num" style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>
                {portfolioStats
                  ? `$${portfolioStats.totalMarketValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>
                {portfolioStats
                  ? `From search_cache · ${portfolioStats.pricedPositions}/${portfolioStats.totalPositions} cards priced`
                  : 'Live prices from search_cache'}
              </div>
            </div>

            {/* Cost basis */}
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 6 }}>
                Total Cost Basis
              </div>
              <div className="font-num" style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>
                {portfolioStats
                  ? `$${portfolioStats.totalCostBasis.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : '—'}
              </div>
              {portfolioStats && portfolioStats.totalCostBasis > 0 && (
                <div style={{
                  fontSize: 11, marginTop: 4,
                  color: portfolioStats.totalMarketValue >= portfolioStats.totalCostBasis ? 'var(--green)' : 'var(--red)',
                }}>
                  {portfolioStats.totalMarketValue >= portfolioStats.totalCostBasis ? '+' : ''}
                  {(((portfolioStats.totalMarketValue - portfolioStats.totalCostBasis) / portfolioStats.totalCostBasis) * 100).toFixed(1)}% unrealised
                </div>
              )}
            </div>

            {/* Cards tracked */}
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 6 }}>
                Total Cards Tracked
              </div>
              <div className="font-num" style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>
                {portfolioStats ? portfolioStats.totalPositions.toLocaleString() : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>Across all portfolios</div>
            </div>

            {/* Active users */}
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 6 }}>
                Active Portfolio Users
              </div>
              <div className="font-num" style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>
                {portfolioStats ? portfolioStats.usersWithPortfolio : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>Users with ≥1 position</div>
            </div>
          </div>

          {/* Pending upgrade requests */}
          {pendingRequests.length > 0 && (
            <div style={S.card}>
              <div style={S.head}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                  Upgrade Requests
                  <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(232,197,71,0.12)', color: 'var(--gold)', border: '1px solid rgba(232,197,71,0.3)' }}>
                    {pendingRequests.length} pending
                  </span>
                </span>
              </div>
              <div style={S.body}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pendingRequests.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{r.user_email ?? r.user_id}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
                          Requesting <strong style={{ color: 'var(--gold)' }}>{r.requested_tier}</strong> · {new Date(r.requested_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          disabled={actingId === r.id}
                          onClick={() => actionRequest(r.id, 'approve')}
                          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'rgba(61,232,138,0.15)', color: 'var(--green)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Approve
                        </button>
                        <button
                          disabled={actingId === r.id}
                          onClick={() => actionRequest(r.id, 'deny')}
                          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'rgba(232,82,74,0.1)', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* User table */}
          <div style={S.card} id="users-table">
            <div style={S.head}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Users ({filteredUsers.length})</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search email or username…"
                style={{ padding: '7px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 12, outline: 'none', width: 220 }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Email', 'Username', 'Tier', 'Status', 'Joined', 'Change Tier'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, letterSpacing: 1, color: 'var(--ink3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--border)' : 'none', background: 'transparent' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--ink)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                        {u.is_admin && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: 'var(--red)', letterSpacing: 0.5 }}>ADMIN</span>}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--ink2)' }}>{u.username ?? '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={S.pill(u.tier)}>{u.tier.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: u.subscription_status === 'active' ? 'var(--green)' : 'var(--ink3)', fontSize: 12 }}>
                        {u.subscription_status ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--ink3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(['free', 'standard', 'pro'] as Tier[]).map(t => (
                            <button
                              key={t}
                              disabled={u.tier === t || savingId === u.id}
                              onClick={() => setTier(u.id, t)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 6,
                                border: `1px solid ${u.tier === t ? TIER_COLORS[t] : 'var(--border2)'}`,
                                background: u.tier === t ? (t === 'pro' ? 'rgba(232,197,71,0.1)' : t === 'standard' ? 'rgba(74,158,255,0.1)' : 'rgba(255,255,255,0.06)') : 'transparent',
                                color: u.tier === t ? TIER_COLORS[t] : 'var(--ink3)',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: u.tier === t ? 'default' : 'pointer',
                                opacity: savingId === u.id && u.tier !== t ? 0.5 : 1,
                                transition: 'all 0.15s',
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          </> /* end activeTab === 'users' */}

          {/* ── Market Index tab ───────────────────────────────────────────── */}
          {activeTab === 'market' && (() => {
            const priced = constituents.filter(c => c.price != null)
            const stale  = constituents.filter(c => !c.last_fetched || Date.now() - new Date(c.last_fetched).getTime() > 6 * 3600 * 1000)

            return (
              <>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Index cards',   value: constituents.length, sub: 'of 100 target', color: 'var(--ink)' },
                    { label: 'Priced',        value: priced.length, sub: 'with live price', color: 'var(--green)' },
                    { label: 'Stale / missing', value: stale.length, sub: '> 6h old or unpriced', color: stale.length > 0 ? 'var(--gold)' : 'var(--ink3)' },
                  ].map((s, i) => (
                    <div key={i} style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
                      <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
                      <div className="font-num" style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>{s.sub}</div>
                    </div>
                  ))}
                  {/* Progress bar tile */}
                  <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
                    <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 10 }}>Coverage</div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', width: `${(priced.length / Math.max(constituents.length, 1)) * 100}%`, background: 'var(--green)', borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>{priced.length}/{constituents.length} priced</div>
                  </div>
                </div>

                {/* Add cards panel */}
                <div style={{ ...S.card, marginBottom: 16 }}>
                  <div style={S.head}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Add cards to index</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={seedIndex}
                        disabled={seeding}
                        style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(232,197,71,0.3)', background: 'rgba(232,197,71,0.07)', color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: seeding ? 0.5 : 1 }}
                      >
                        {seeding ? 'Seeding…' : '⬇ Seed CI-100'}
                      </button>
                      {refreshProgress ? (
                        <span style={{ fontSize: 12, color: 'var(--ink3)', padding: '7px 0' }}>
                          Refreshing {refreshProgress.done}/{refreshProgress.total}…
                        </span>
                      ) : (
                        <button
                          onClick={refreshAllPrices}
                          disabled={refreshing || constituents.length === 0}
                          style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--ink2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: refreshing ? 0.5 : 1 }}
                        >
                          {refreshing ? 'Refreshing…' : `↺ Refresh stale (${stale.length})`}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={S.body}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <input
                        value={cardSearch}
                        onChange={e => handleCardSearchInput(e.target.value)}
                        placeholder="Search card name e.g. Charizard…"
                        style={{ flex: 1, padding: '9px 14px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                      />
                      {cardSearch && (
                        <button onClick={() => { setCardSearch(''); setCardResults([]) }}
                          style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--ink3)', fontSize: 13, cursor: 'pointer' }}>
                          ✕
                        </button>
                      )}
                    </div>

                    {cardSearching && (
                      <div style={{ fontSize: 12, color: 'var(--ink3)', padding: '8px 0' }}>Searching pokemontcg.io…</div>
                    )}

                    {cardResults.length > 0 && (
                      <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                        {cardResults.map((card, i) => {
                          const alreadyAdded = constituents.some(c => c.card_id === card.id && c.grade === (addingGrade[card.id] || 'PSA 10'))
                          return (
                            <div key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < cardResults.length - 1 ? '1px solid var(--border)' : 'none', background: alreadyAdded ? 'rgba(61,232,138,0.03)' : 'transparent' }}>
                              <div style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)' }}>
                                <img src={tcgImg(card.images.small)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{card.set.name} · #{card.number}{card.rarity ? ` · ${card.rarity}` : ''}</div>
                              </div>
                              <select
                                value={addingGrade[card.id] || 'PSA 10'}
                                onChange={e => setAddingGrade(prev => ({ ...prev, [card.id]: e.target.value }))}
                                style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, cursor: 'pointer' }}
                              >
                                {['PSA 10', 'PSA 9', 'PSA 8', 'BGS 9.5', 'BGS 9', 'CGC 10', 'Raw'].map(g => (
                                  <option key={g} value={g}>{g}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => addConstituent(card)}
                                disabled={!!addingId || alreadyAdded}
                                style={{
                                  padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: alreadyAdded ? 'default' : 'pointer',
                                  background: alreadyAdded ? 'rgba(61,232,138,0.1)' : 'var(--gold)',
                                  color: alreadyAdded ? 'var(--green)' : '#080810',
                                  opacity: addingId && addingId !== card.id ? 0.5 : 1,
                                  flexShrink: 0,
                                }}
                              >
                                {alreadyAdded ? '✓ Added' : addingId === card.id ? '…' : '+ Add'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Constituent list */}
                <div style={S.card}>
                  <div style={S.head}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                      Index constituents ({constituents.length})
                    </span>
                    <button onClick={loadConstituents} disabled={constitLoading}
                      style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--ink3)', fontSize: 11, cursor: 'pointer', opacity: constitLoading ? 0.5 : 1 }}>
                      {constitLoading ? 'Loading…' : '↺ Reload'}
                    </button>
                  </div>
                  {constitLoading ? (
                    <div style={{ padding: 22, fontSize: 12, color: 'var(--ink3)' }}>Loading…</div>
                  ) : constituents.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                      <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 12 }}>📈</div>
                      <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 6 }}>No cards in the index yet</div>
                      <div style={{ fontSize: 11, color: 'var(--ink3)', opacity: 0.7 }}>Search for cards above and add them to build your CI-100 index</div>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            {['Card', 'Grade', 'Price', '30d Chg', 'Last updated', ''].map(h => (
                              <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 9, letterSpacing: 1, color: 'var(--ink3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h.toUpperCase()}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {constituents.map((c, i) => {
                            const isStale = !c.last_fetched || Date.now() - new Date(c.last_fetched).getTime() > 6 * 3600 * 1000
                            return (
                              <tr key={c.id} style={{ borderBottom: i < constituents.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {c.image_url && (
                                      <div style={{ width: 28, height: 28, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
                                        <img src={tcgImg(c.image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                      </div>
                                    )}
                                    <div>
                                      <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 12 }}>{c.card_name}</div>
                                      {c.set_name && <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{c.set_name}</div>}
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--ink2)', whiteSpace: 'nowrap' }}>{c.grade}</td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span className="font-num" style={{ fontWeight: 700, color: c.price != null ? 'var(--ink)' : 'var(--ink3)' }}>
                                    {c.price != null ? `$${c.price.toFixed(2)}` : '—'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  {c.price_change_pct != null ? (
                                    <span className="font-num" style={{ color: c.price_change_pct >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                                      {c.price_change_pct >= 0 ? '+' : ''}{c.price_change_pct.toFixed(1)}%
                                    </span>
                                  ) : <span style={{ color: 'var(--ink3)' }}>—</span>}
                                </td>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  {c.last_fetched ? (
                                    <span style={{ fontSize: 11, color: isStale ? 'var(--gold)' : 'var(--ink3)' }}>
                                      {isStale ? '⚠ ' : ''}{new Date(c.last_fetched).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 11, color: 'var(--red)' }}>⚠ Not priced</span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => removeConstituent(c.id)}
                                    disabled={removingId === c.id}
                                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink3)', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink3)' }}
                                  >
                                    {removingId === c.id ? '…' : 'Remove'}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )
          })()}

        </div>
      </main>
    </>
  )
}
