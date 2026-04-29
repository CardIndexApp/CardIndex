'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

const S = {
  card: { borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border2)', marginBottom: 12, overflow: 'hidden' } as React.CSSProperties,
  cardHead: { padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  cardBody: { padding: '24px' } as React.CSSProperties,
  label: { fontSize: 10, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 8, display: 'block' } as React.CSSProperties,
  input: { width: '100%', padding: '11px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' } as React.CSSProperties,
  btn: { padding: '10px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
}

export default function AccountPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

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
  const { currency, setCurrency, fmtCurrency, rates, ratesLoading } = useCurrency()
  const [currencyMsg, setCurrencyMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Billing portal
  const [portalLoading, setPortalLoading] = useState(false)

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
    if (error) setPwMsg({ type: 'err', text: error.message })
    else { setPwMsg({ type: 'ok', text: 'Password updated successfully.' }); setNewPassword(''); setConfirmPassword('') }
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

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 88, paddingBottom: 88, minHeight: '100vh' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px' }}>

          {/* Header */}
          <div style={{ marginBottom: 32, marginTop: 24 }}>
            <Link href="/" style={{ fontSize: 12, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>← Back</Link>
            <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>Account</h1>
            <p style={{ fontSize: 14, color: 'var(--ink3)', marginTop: 4 }}>Manage your profile, plan, and security settings.</p>
          </div>

          {/* ── Profile ── */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Profile</span>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: tier === 'free' ? 'var(--surface2)' : tier === 'pro' ? 'var(--gold2)' : 'rgba(74,158,255,0.1)', color: TIER_COLORS[tier], border: `1px solid ${tier === 'pro' ? 'rgba(232,197,71,0.3)' : tier === 'standard' ? 'rgba(74,158,255,0.3)' : 'var(--border2)'}`, fontWeight: 700 }}>
                {TIER_LABELS[tier]}
              </span>
            </div>
            <div style={S.cardBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div>
                  <span style={S.label}>EMAIL</span>
                  <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{profile?.email}</div>
                </div>
                <div>
                  <span style={S.label}>MEMBER SINCE</span>
                  <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{memberSince}</div>
                </div>
              </div>
              <div style={{ paddingTop: 20, borderTop: '1px solid var(--border)' }}>
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
          <div style={S.card}>
            <div style={S.cardHead}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Change Password</span>
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
          <div style={S.card}>
            <div style={S.cardHead}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Plan & Billing</span>
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
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', gap: 24 }}>
                  <div>
                    <span style={S.label}>STATUS</span>
                    <span style={{ fontSize: 13, color: profile.subscription_status === 'active' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {profile.subscription_status.charAt(0).toUpperCase() + profile.subscription_status.slice(1)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Display & Currency ── */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Display & Currency</span>
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
          <div style={{ ...S.card, border: '1px solid rgba(232,82,74,0.25)', marginTop: 24 }}>
            <div style={{ ...S.cardHead, borderBottom: '1px solid rgba(232,82,74,0.15)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>Danger Zone</span>
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

        </div>
      </main>
    </>
  )
}
