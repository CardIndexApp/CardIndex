'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Unlinked sign-in page. CardIndex is iOS-first, so there is no public-facing
 * login/sign-up in the nav — this route exists purely so admins (and existing
 * accounts) can sign in to reach the web admin dashboard. There is deliberately
 * no sign-up option here.
 */
export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'signin' | 'forgot'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  // Admins go to /admin; existing non-admin accounts get full web app access at /dashboard.
  // /api/admin/users is service-role gated, so a non-ok response = not an admin.
  const routeAfterAuth = async () => {
    const res = await fetch('/api/admin/users')
    router.replace(res.ok ? '/admin' : '/dashboard')
  }

  // Already signed in? Route based on whether they're an admin.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) routeAfterAuth()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      setLoading(false)
      if (error) setError(error.message)
      else setSent(true)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }
    await routeAfterAuth()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    background: 'var(--bg)',
    border: '1px solid var(--border2)',
    color: 'var(--ink)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        borderRadius: 20,
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        padding: 32,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
            Card<span style={{ color: 'var(--gold)' }}>Index</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink3)', margin: 0 }}>
            {mode === 'forgot' ? 'Reset your password' : 'Sign in to continue'}
          </p>
        </div>

        {sent ? (
          <div style={{
            borderRadius: 12,
            padding: '24px 20px',
            background: 'rgba(61,232,138,0.06)',
            border: '1px solid rgba(61,232,138,0.2)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.7, margin: 0 }}>
              If an account exists for {email}, a reset link is on its way.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--ink3)', letterSpacing: 1.5, marginBottom: 7 }}>
                EMAIL
              </label>
              <input
                type="email"
                required
                value={email}
                placeholder="you@example.com"
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              />
            </div>

            {mode === 'signin' && (
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--ink3)', letterSpacing: 1.5, marginBottom: 7 }}>
                  PASSWORD
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  placeholder="••••••••"
                  onChange={e => setPassword(e.target.value)}
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                />
              </div>
            )}

            {error && (
              <div style={{
                borderRadius: 8,
                padding: '10px 14px',
                background: 'rgba(232,82,74,0.08)',
                border: '1px solid rgba(232,82,74,0.25)',
                fontSize: 12,
                color: 'var(--red)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: 13,
                borderRadius: 12,
                background: loading ? 'rgba(232,197,71,0.5)' : 'var(--gold)',
                color: '#080810',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 700,
                marginTop: 4,
              }}
            >
              {loading ? '…' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={() => { setError(''); setMode(mode === 'forgot' ? 'signin' : 'forgot') }}
              style={{ fontSize: 12, color: 'var(--ink3)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {mode === 'forgot' ? '← Back to sign in' : 'Forgot your password?'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
