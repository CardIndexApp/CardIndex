'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'

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

          {/* Flash message */}
          {msg && (
            <div style={{ marginBottom: 16, borderRadius: 10, padding: '12px 16px', background: msg.type === 'ok' ? 'rgba(61,232,138,0.08)' : 'rgba(232,82,74,0.08)', border: `1px solid ${msg.type === 'ok' ? 'rgba(61,232,138,0.2)' : 'rgba(232,82,74,0.25)'}`, fontSize: 13, color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)' }}>
              {msg.text}
            </div>
          )}

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
          <div style={S.card}>
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

        </div>
      </main>
    </>
  )
}
