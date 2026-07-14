'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { CURRENCIES, useCurrency, type CurrencyCode } from '@/lib/currency'
import { useTheme } from '@/lib/theme'

type Tier = 'free' | 'standard' | 'pro'

interface Profile {
  email: string
  username: string | null
  tier: Tier
  created_at: string
  stripe_customer_id: string | null
  subscription_status: string | null
}

const TIER_LABELS: Record<Tier, string> = { free: 'Free', standard: 'Standard', pro: 'Pro' }
const TIER_COLORS: Record<Tier, string> = { free: 'var(--ink3)', standard: 'var(--blue)', pro: 'var(--gold)' }

const NAV_SECTIONS = [
  { id: 'profile',  label: 'Profile',            danger: false },
  { id: 'password', label: 'Change Password',     danger: false },
  { id: 'billing',  label: 'Plan & Billing',      danger: false },
  { id: 'display',  label: 'Display & Currency',  danger: false },
  { id: 'danger',   label: 'Danger Zone',         danger: true  },
]

const S = {
  card: { borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', marginBottom: 20, overflow: 'hidden' } as React.CSSProperties,
  cardHead: { padding: '26px 30px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 } as React.CSSProperties,
  cardBody: { padding: '20px 30px 26px' } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 8, display: 'block' } as React.CSSProperties,
  input: { width: '100%', padding: '13px 16px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
  btn: { padding: '12px 20px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
}

function AccountPageInner() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('profile')

  // Username change
  const [usernameInput, setUsernameInput] = useState('')
  const [unLoading, setUnLoading] = useState(false)
  const [unMsg, setUnMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Theme preference
  const { theme, setTheme } = useTheme()

  // Currency preference
  const { currency, setCurrency, rates, ratesLoading } = useCurrency()
  const [currencyMsg, setCurrencyMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Billing portal
  const [portalLoading, setPortalLoading] = useState(false)

  // Reactivation
  const [reactivating, setReactivating] = useState(false)
  const [reactivateMsg, setReactivateMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Post-checkout / reactivation success banner
  const searchParams = useSearchParams()
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('upgraded') === '1') {
      setSuccessBanner("You're now on your new plan. Welcome!")
      // Remove the query param from the URL without triggering a navigation
      const url = new URL(window.location.href)
      url.searchParams.delete('upgraded')
      window.history.replaceState({}, '', url.toString())
    } else if (searchParams.get('reactivated') === '1') {
      setSuccessBanner("Your subscription has been reactivated — glad to have you back!")
      const url = new URL(window.location.href)
      url.searchParams.delete('reactivated')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  async function handleReactivate() {
    setReactivating(true)
    setReactivateMsg(null)
    try {
      const res = await fetch('/api/stripe/reactivate', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        setProfile(p => p ? { ...p, subscription_status: 'active' } : p)
        setReactivateMsg({ type: 'ok', text: 'Subscription reactivated — your plan will continue as normal.' })
      } else {
        setReactivateMsg({ type: 'err', text: json.error ?? 'Something went wrong. Please try again.' })
      }
    } catch {
      setReactivateMsg({ type: 'err', text: 'Network error — please try again.' })
    } finally {
      setReactivating(false)
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const json = await res.json()
      if (json.url) window.location.href = json.url
      else alert(json.error ?? 'Could not open billing portal.')
    } finally {
      setPortalLoading(false)
    }
  }

  // Delete account
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Intersection observer for active nav highlight
  const observerRef = useRef<IntersectionObserver | null>(null)
  useEffect(() => {
    if (loading) return
    const targets = NAV_SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    const visible = new Map<string, number>()

    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          visible.set(e.target.id, e.intersectionRatio)
        })
        let best = 'profile'
        let bestRatio = -1
        NAV_SECTIONS.forEach(s => {
          const r = visible.get(s.id) ?? 0
          if (r > bestRatio) { bestRatio = r; best = s.id }
        })
        if (bestRatio > 0) setActiveSection(best)
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    )
    targets.forEach(t => observerRef.current!.observe(t))
    return () => observerRef.current?.disconnect()
  }, [loading])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      const prof = data ?? { email: user.email ?? '', username: null, tier: 'free', created_at: user.created_at, stripe_customer_id: null, subscription_status: null }
      setProfile(prof)
      setUsernameInput(prof.username ?? '')
      setLoading(false)
    }
    load()
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const offset = 96 // navbar height + breathing room
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })
    setActiveSection(id)
  }

  const handleUsernameChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setUnMsg(null)
    const val = usernameInput.trim()
    if (!val) { setUnMsg({ type: 'err', text: 'Username cannot be empty.' }); return }
    if (val.length < 3) { setUnMsg({ type: 'err', text: 'Username must be at least 3 characters.' }); return }
    setUnLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update({ username: val }).eq('id', user.id)
    setUnLoading(false)
    if (error) setUnMsg({ type: 'err', text: error.message })
    else { setUnMsg({ type: 'ok', text: 'Username updated.' }); setProfile(p => p ? { ...p, username: val } : p) }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg(null)
    if (newPassword !== confirmPassword) { setPwMsg({ type: 'err', text: 'Passwords do not match.' }); return }
    if (newPassword.length < 8) { setPwMsg({ type: 'err', text: 'Password must be at least 8 characters.' }); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwLoading(false)
    if (error) {
      setPwMsg({ type: 'err', text: error.message })
    } else {
      setPwMsg({ type: 'ok', text: 'Password updated successfully. A confirmation email has been sent.' })
      setNewPassword('')
      setConfirmPassword('')
      // Fire-and-forget security notification — don't block the UI on this
      fetch('/api/auth/password-changed', { method: 'POST' }).catch(() => {})
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') { setDeleteError('Type DELETE to confirm.'); return }
    setDeleteLoading(true)
    setDeleteError('')
    const res = await fetch('/api/account/delete', { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      setDeleteError(json.error ?? 'Something went wrong.')
      setDeleteLoading(false)
      return
    }
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : '—'

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

  const navItems = (
    <>
      {NAV_SECTIONS.map(s => {
        const active = activeSection === s.id
        return (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className={`acct-nav-item${active ? ' acct-nav-active' : ''}${s.danger ? ' acct-nav-danger' : ''}`}
          >
            {s.label}
          </button>
        )
      })}
    </>
  )

  return (
    <>
      <Navbar />
      <style>{`
        .acct-nav-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 11px 14px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: var(--ink3);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          white-space: nowrap;
        }
        .acct-nav-item:hover { background: var(--surface2); color: var(--ink2); }
        .acct-nav-active { background: var(--surface2) !important; color: var(--ink) !important; font-weight: 700; }
        .acct-nav-danger { color: var(--red) !important; opacity: 0.8; }
        .acct-nav-danger.acct-nav-active { opacity: 1; background: rgba(232,82,74,0.1) !important; }

        /* Desktop: two-column layout */
        .acct-outer { max-width: 940px; margin: 0 auto; padding: 0 16px; }
        .acct-layout { display: flex; gap: 32px; align-items: flex-start; }
        .acct-sidebar {
          width: 220px;
          flex-shrink: 0;
          position: sticky;
          top: 96px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .acct-sidebar-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--ink3);
          text-transform: uppercase;
          padding: 0 14px;
          margin-bottom: 14px;
        }
        .acct-pills { display: none; }
        .acct-content { flex: 1; min-width: 0; max-width: 640px; }

        /* Mobile: pills instead of sidebar */
        @media (max-width: 700px) {
          .acct-sidebar { display: none; }
          .acct-pills {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            padding: 0 0 12px;
            margin-bottom: 8px;
            scrollbar-width: none;
          }
          .acct-pills::-webkit-scrollbar { display: none; }
          .acct-pills .acct-nav-item {
            width: auto;
            padding: 7px 14px;
            border: 1px solid var(--border2);
            flex-shrink: 0;
            font-size: 12px;
          }
          .acct-pills .acct-nav-active {
            border-color: var(--gold) !important;
            background: rgba(232,197,71,0.08) !important;
            color: var(--gold) !important;
          }
          .acct-pills .acct-nav-danger { color: var(--red) !important; }
          .acct-pills .acct-nav-danger.acct-nav-active {
            border-color: var(--red) !important;
            background: rgba(232,82,74,0.08) !important;
          }
        }
      `}</style>

      <main style={{ paddingTop: 88, paddingBottom: 88, minHeight: '100vh' }}>
        <div className="acct-outer">

          {/* Post-checkout / reactivation success banner */}
          {successBanner && (
            <div style={{ margin: '20px 0 0', padding: '14px 20px', borderRadius: 12, background: 'rgba(61,232,138,0.08)', border: '1px solid rgba(61,232,138,0.25)', fontSize: 13, color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <span>🎉 {successBanner}</span>
              <button onClick={() => setSuccessBanner(null)} style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', fontSize: 16, opacity: 0.6, flexShrink: 0 }}>×</button>
            </div>
          )}

          {/* Header */}
          <div style={{ marginBottom: 28, marginTop: 24 }}>
            <Link href="/" style={{ fontSize: 12, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>← Back</Link>
            <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>Account</h1>
            <p style={{ fontSize: 14, color: 'var(--ink3)', marginTop: 4 }}>Manage your profile, plan, and security settings.</p>
          </div>

          {/* Mobile pill nav */}
          <div className="acct-pills">{navItems}</div>

          <div className="acct-layout">
            {/* Desktop sidebar */}
            <nav className="acct-sidebar" aria-label="Account sections">
              <div className="acct-sidebar-label">SETTINGS</div>
              {navItems}
            </nav>

            {/* Content */}
            <div className="acct-content">

              {/* ── Profile ── */}
              <div id="profile" style={S.card}>
                <div style={S.cardHead}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>Profile</span>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: tier === 'free' ? 'var(--surface2)' : tier === 'pro' ? 'var(--gold2)' : 'rgba(74,158,255,0.1)', color: TIER_COLORS[tier], border: `1px solid ${tier === 'pro' ? 'rgba(232,197,71,0.3)' : tier === 'standard' ? 'rgba(74,158,255,0.3)' : 'var(--border2)'}`, fontWeight: 700 }}>
                    {TIER_LABELS[tier]}
                  </span>
                </div>
                <div style={S.cardBody}>
                  <div style={{ display: 'flex', gap: 60, paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <span style={S.label}>Email</span>
                      <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 600 }}>{profile?.email}</div>
                    </div>
                    <div>
                      <span style={S.label}>Member Since</span>
                      <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 600 }}>{memberSince}</div>
                    </div>
                  </div>
                  <div>
                    <form onSubmit={handleUsernameChange} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={S.label}>USERNAME</label>
                        <input
                          type="text"
                          value={usernameInput}
                          placeholder="e.g. charizard_collector"
                          minLength={3}
                          onChange={e => { setUsernameInput(e.target.value.replace(/\s/g, '')); setUnMsg(null) }}
                          style={S.input}
                          onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                        />
                      </div>
                      {unMsg && (
                        <div style={{ borderRadius: 8, padding: '10px 14px', background: unMsg.type === 'ok' ? 'rgba(61,232,138,0.08)' : 'rgba(232,82,74,0.08)', border: `1px solid ${unMsg.type === 'ok' ? 'rgba(61,232,138,0.2)' : 'rgba(232,82,74,0.25)'}`, fontSize: 13, color: unMsg.type === 'ok' ? 'var(--green)' : 'var(--red)' }}>
                          {unMsg.text}
                        </div>
                      )}
                      <div>
                        <button type="submit" disabled={unLoading} style={{ ...S.btn, background: 'var(--gold)', color: '#080810', opacity: unLoading ? 0.6 : 1 }}>
                          {unLoading ? 'Saving…' : 'Save username'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              {/* ── Change Password ── */}
              <div id="password" style={S.card}>
                <div style={S.cardHead}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>Change Password</span>
                </div>
                <div style={S.cardBody}>
                  <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label style={S.label}>NEW PASSWORD</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="Min. 8 characters"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        style={S.input}
                        onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                      />
                    </div>
                    <div>
                      <label style={S.label}>CONFIRM NEW PASSWORD</label>
                      <input
                        type="password"
                        required
                        placeholder="Repeat new password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        style={S.input}
                        onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                      />
                    </div>
                    {pwMsg && (
                      <div style={{ borderRadius: 8, padding: '10px 14px', background: pwMsg.type === 'ok' ? 'rgba(61,232,138,0.08)' : 'rgba(232,82,74,0.08)', border: `1px solid ${pwMsg.type === 'ok' ? 'rgba(61,232,138,0.2)' : 'rgba(232,82,74,0.25)'}`, fontSize: 13, color: pwMsg.type === 'ok' ? 'var(--green)' : 'var(--red)' }}>
                        {pwMsg.text}
                      </div>
                    )}
                    <div>
                      <button type="submit" disabled={pwLoading} style={{ ...S.btn, background: 'var(--gold)', color: '#080810', opacity: pwLoading ? 0.6 : 1 }}>
                        {pwLoading ? 'Updating…' : 'Update password'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* ── Plan & Billing ── */}
              <div id="billing" style={S.card}>
                <div style={S.cardHead}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>Plan & Billing</span>
                </div>
                <div style={S.cardBody}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: TIER_COLORS[tier], marginBottom: 4 }}>{TIER_LABELS[tier]} plan</div>
                      <div style={{ fontSize: 13, color: 'var(--ink3)' }}>
                        {tier === 'free' && 'Watchlist limited to 5 cards. Upgrade for more features.'}
                        {tier === 'standard' && 'Watchlist up to 30 cards + price history charts.'}
                        {tier === 'pro' && 'Watchlist up to 100 cards + all features included.'}
                      </div>
                    </div>
                    {tier === 'free' ? (
                      <Link href="/pricing" style={{ ...S.btn, background: 'var(--gold)', color: '#080810', textDecoration: 'none', display: 'inline-block' }}>
                        Upgrade plan
                      </Link>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                        <Link href="/pricing" style={{ ...S.btn, background: 'var(--surface2)', color: 'var(--ink2)', border: '1px solid var(--border2)', textDecoration: 'none', display: 'inline-block' }}>
                          Change plan
                        </Link>
                        {profile?.stripe_customer_id && (
                          <button
                            onClick={openBillingPortal}
                            disabled={portalLoading}
                            style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--ink3)', textDecoration: 'underline', cursor: portalLoading ? 'default' : 'pointer', opacity: portalLoading ? 0.6 : 1 }}
                          >
                            {portalLoading ? 'Opening…' : 'Manage billing →'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {tier !== 'free' && profile?.subscription_status && (
                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                      {profile.subscription_status === 'canceling' ? (
                        <div style={{ background: 'rgba(232,197,71,0.06)', border: '1px solid rgba(232,197,71,0.2)', borderRadius: 12, padding: '16px 18px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', marginBottom: 4 }}>
                            Your plan is set to cancel
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.6, marginBottom: 14 }}>
                            You'll keep access until the end of your current billing period. Reactivate anytime to continue without interruption.
                          </div>
                          {reactivateMsg && (
                            <div style={{ marginBottom: 12, borderRadius: 8, padding: '10px 14px', background: reactivateMsg.type === 'ok' ? 'rgba(61,232,138,0.08)' : 'rgba(232,82,74,0.08)', border: `1px solid ${reactivateMsg.type === 'ok' ? 'rgba(61,232,138,0.2)' : 'rgba(232,82,74,0.25)'}`, fontSize: 13, color: reactivateMsg.type === 'ok' ? 'var(--green)' : 'var(--red)' }}>
                              {reactivateMsg.text}
                            </div>
                          )}
                          <button
                            onClick={handleReactivate}
                            disabled={reactivating}
                            style={{ ...S.btn, background: 'var(--gold)', color: '#080810', opacity: reactivating ? 0.6 : 1 }}
                          >
                            {reactivating ? 'Reactivating…' : 'Reactivate plan'}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 24 }}>
                          <div>
                            <span style={S.label}>STATUS</span>
                            <span style={{ fontSize: 13, color: profile.subscription_status === 'active' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                              {profile.subscription_status.charAt(0).toUpperCase() + profile.subscription_status.slice(1)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Display & Currency ── */}
              <div id="display" style={S.card}>
                <div style={S.cardHead}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>Display & Currency</span>
                  {!ratesLoading && currency !== 'USD' && (
                    <span style={{ fontSize: 11, color: 'var(--ink3)' }}>
                      1 USD = {(rates[currency] ?? 1).toLocaleString('en-US', { maximumFractionDigits: 4 })} {currency}
                    </span>
                  )}
                </div>
                <div style={S.cardBody}>
                  {/* Theme toggle */}
                  <div style={{ marginBottom: 28 }}>
                    <span style={S.label}>APPEARANCE</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['dark', 'light'] as const).map(t => {
                        const selected = theme === t
                        return (
                          <button
                            key={t}
                            onClick={() => setTheme(t)}
                            style={{
                              padding: '10px 20px',
                              borderRadius: 10,
                              border: `1.5px solid ${selected ? 'var(--gold)' : 'var(--border2)'}`,
                              background: selected ? 'rgba(232,197,71,0.08)' : 'var(--bg)',
                              color: selected ? 'var(--gold)' : 'var(--ink2)',
                              fontSize: 13,
                              fontWeight: selected ? 700 : 500,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              transition: 'all 0.15s',
                            }}
                          >
                            {t === 'dark' ? '🌙' : '☀️'}
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                    <span style={S.label}>CURRENCY</span>
                    <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.6, marginBottom: 16 }}>
                      Prices are sourced in USD and converted client-side using live exchange rates. Rates update hourly.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                    {(Object.keys(CURRENCIES) as CurrencyCode[]).map(code => {
                      const meta = CURRENCIES[code]
                      const selected = currency === code
                      return (
                        <button
                          key={code}
                          onClick={() => {
                            setCurrency(code)
                            setCurrencyMsg({ type: 'ok', text: `Currency set to ${meta.label}.` })
                            setTimeout(() => setCurrencyMsg(null), 3000)
                          }}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: selected ? 'rgba(232,197,71,0.08)' : 'var(--bg)',
                            border: `1.5px solid ${selected ? 'var(--gold)' : 'var(--border2)'}`,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                          }}
                          onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border)' }}
                          onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border2)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: selected ? 'var(--gold)' : 'var(--ink)' }}>
                              {meta.symbol} {code}
                            </span>
                            {selected && (
                              <span style={{ fontSize: 10, color: 'var(--gold)' }}>✓</span>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{meta.label}</span>
                          {!ratesLoading && code !== 'USD' && rates[code] && (
                            <span style={{ fontSize: 10, color: 'var(--ink3)', opacity: 0.6, marginTop: 2 }}>
                              $100 = {meta.symbol}{(100 * rates[code]).toLocaleString('en-US', { minimumFractionDigits: meta.decimals, maximumFractionDigits: meta.decimals })}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {currencyMsg && (
                    <div style={{ marginTop: 16, borderRadius: 8, padding: '10px 14px', background: 'rgba(61,232,138,0.08)', border: '1px solid rgba(61,232,138,0.2)', fontSize: 13, color: 'var(--green)' }}>
                      {currencyMsg.text}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Danger Zone ── */}
              <div id="danger" style={{ ...S.card, border: '1px solid rgba(232,82,74,0.25)', marginTop: 24 }}>
                <div style={{ ...S.cardHead, borderBottom: '1px solid rgba(232,82,74,0.15)' }}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--red)' }}>Danger Zone</span>
                </div>
                <div style={S.cardBody}>
                  <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.7, marginBottom: 20 }}>
                    Permanently deletes your account, watchlist, and all associated data. This action <strong style={{ color: 'var(--ink2)' }}>cannot be undone</strong>.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ ...S.label, color: 'rgba(232,82,74,0.7)' }}>TYPE "DELETE" TO CONFIRM</label>
                      <input
                        type="text"
                        placeholder="DELETE"
                        value={deleteInput}
                        onChange={e => { setDeleteInput(e.target.value); setDeleteError('') }}
                        style={{ ...S.input, border: '1px solid rgba(232,82,74,0.3)', maxWidth: 240 }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'var(--red)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(232,82,74,0.3)')}
                      />
                    </div>
                    {deleteError && (
                      <div style={{ fontSize: 12, color: 'var(--red)' }}>{deleteError}</div>
                    )}
                    <div>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteInput !== 'DELETE' || deleteLoading}
                        style={{ ...S.btn, background: deleteInput === 'DELETE' ? 'rgba(232,82,74,0.15)' : 'var(--surface2)', color: deleteInput === 'DELETE' ? 'var(--red)' : 'var(--ink3)', border: `1px solid ${deleteInput === 'DELETE' ? 'rgba(232,82,74,0.4)' : 'var(--border2)'}`, cursor: deleteInput !== 'DELETE' ? 'not-allowed' : 'pointer', opacity: deleteLoading ? 0.6 : 1 }}
                      >
                        {deleteLoading ? 'Deleting…' : 'Delete my account'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>{/* /acct-content */}
          </div>{/* /acct-layout */}
        </div>{/* /acct-outer */}
      </main>
    </>
  )
}

// useSearchParams requires Suspense in the App Router
export default function AccountPage() {
  return (
    <Suspense fallback={<></>}>
      <AccountPageInner />
    </Suspense>
  )
}
