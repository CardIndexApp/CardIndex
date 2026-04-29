'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Tab = 'signin' | 'signup' | 'forgot'
interface Props { onClose: () => void; defaultTab?: Tab }

export default function AuthModal({ onClose, defaultTab = 'signup' }: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (tab === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      })
      if (error) setError(error.message)
      else setSuccess('Check your email for a password reset link.')
      setLoading(false)
      return
    }

    if (tab === 'signup') {
      if (!username.trim()) { setError('Please choose a username.'); setLoading(false); return }
      if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); setLoading(false); return }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { username: username.trim() },
        },
      })
      if (error) setError(error.message)
      else setSuccess('Check your email to confirm your account, then sign in.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else { onClose(); window.location.reload() }
    }

    setLoading(false)
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border2)', padding: 32 }}>
        <button onClick={onClose} style={{ position: 'absolute', marginTop: -16, marginLeft: 320, background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 20 }}>×</button>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
            Card<span style={{ color: 'var(--gold)' }}>Index</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>
            {tab === 'signup' ? 'Create your free account' : tab === 'forgot' ? 'Reset your password' : 'Welcome back'}
          </p>
        </div>

        {/* Tabs — hidden on forgot screen */}
        {tab !== 'forgot' && (
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border2)', marginBottom: 24 }}>
            {(['signin', 'signup'] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t as Tab); setError(''); setSuccess('') }}
                style={{ flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: tab === t ? 'var(--surface2)' : 'transparent', color: tab === t ? 'var(--ink)' : 'var(--ink3)', transition: 'all 0.15s' }}>
                {t === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>
        )}

        {success ? (
          <div style={{ borderRadius: 12, padding: '20px', background: 'rgba(61,232,138,0.06)', border: '1px solid rgba(61,232,138,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>✓</div>
            <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7 }}>{success}</p>
            <button onClick={() => { setSuccess(''); setTab('signin') }} style={{ marginTop: 14, fontSize: 13, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer' }}>Sign in →</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tab === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--ink3)', letterSpacing: 1.5, marginBottom: 7 }}>USERNAME</label>
                <input type="text" required value={username} placeholder="e.g. charizard_collector"
                  minLength={3}
                  onChange={e => setUsername(e.target.value.replace(/\s/g, ''))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')} />
              </div>
            )}

            {/* Email always shown */}
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--ink3)', letterSpacing: 1.5, marginBottom: 7 }}>EMAIL</label>
              <input type="email" required value={email} placeholder="you@example.com"
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')} />
            </div>

            {/* Password only for signin / signup */}
            {tab !== 'forgot' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                  <label style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1.5 }}>PASSWORD</label>
                  {tab === 'signin' && (
                    <button type="button" onClick={() => { setTab('forgot'); setError(''); setSuccess('') }}
                      style={{ fontSize: 11, color: 'var(--ink3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <input type="password" required value={password} placeholder={tab === 'signup' ? 'Min. 8 characters' : '••••••••'}
                  minLength={tab === 'signup' ? 8 : undefined}
                  onChange={e => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')} />
              </div>
            )}

            {error && (
              <div style={{ borderRadius: 8, padding: '10px 14px', background: 'rgba(232,82,74,0.08)', border: '1px solid rgba(232,82,74,0.25)', fontSize: 12, color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ padding: 13, borderRadius: 12, background: loading ? 'rgba(232,197,71,0.5)' : 'var(--gold)', color: '#080810', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, marginTop: 4 }}>
              {loading ? '…' : tab === 'signup' ? 'Create account' : tab === 'forgot' ? 'Send reset link' : 'Sign in'}
            </button>

            {tab === 'forgot' ? (
              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink3)' }}>
                Remember your password?{' '}
                <button type="button" onClick={() => { setTab('signin'); setError('') }}
                  style={{ color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                  Sign in
                </button>
              </p>
            ) : (
              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink3)' }}>
                {tab === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
                <button type="button" onClick={() => { setTab(tab === 'signup' ? 'signin' : 'signup'); setError('') }}
                  style={{ color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                  {tab === 'signup' ? 'Sign in' : 'Sign up free'}
                </button>
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
