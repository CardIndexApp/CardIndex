'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const GOLD = '#e8c547'
const INK = '#eeeef8'
const INK2 = '#b8b8d0'
const INK3 = '#50506a'
const GREEN = '#3de88a'
const BG = '#0b0c0f'

function LoginForm() {
  const router = useRouter()
  const supabase = createClient()

  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(
    searchParams.get('tab') === 'signup' ? 'signup' : 'signin'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const routeAfterAuth = async () => {
    const res = await fetch('/api/admin/users')
    router.replace(res.ok ? '/admin' : '/dashboard')
  }

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

    if (mode === 'signup') {
      if (password !== confirm) {
        setError('Passwords do not match')
        setLoading(false)
        return
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signUp({ email, password })
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
    padding: '12px 14px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: INK,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: BG,
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(232,197,71,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{
        width: '100%',
        maxWidth: 400,
        position: 'relative',
      }}>
        {/* Card */}
        <div style={{
          borderRadius: 20,
          background: 'linear-gradient(165deg, rgba(255,255,255,0.045), rgba(255,255,255,0.01))',
          border: '1px solid rgba(232,197,71,0.3)',
          padding: '36px 32px 32px',
          boxShadow: '0 0 60px -16px rgba(232,197,71,0.25), 0 24px 64px rgba(0,0,0,0.5)',
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: INK, letterSpacing: '-0.5px', marginBottom: 8 }}>
              Card<span style={{ color: GOLD }}>Index</span>
            </div>
            <p style={{ fontSize: 13, color: INK3, margin: 0 }}>
              {mode === 'forgot' ? 'Reset your password' : mode === 'signup' ? 'Create your account' : 'Sign in to your account'}
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 28 }} />

          {sent ? (
            <div style={{
              borderRadius: 12,
              padding: '24px 20px',
              background: 'rgba(61,232,138,0.06)',
              border: '1px solid rgba(61,232,138,0.2)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 26, color: GREEN, marginBottom: 10 }}>✓</div>
              <p style={{ fontSize: 14, color: INK2, lineHeight: 1.7, margin: 0 }}>
                {mode === 'signup'
                  ? <>Check your inbox — we sent a confirmation link to <strong style={{ color: INK }}>{email}</strong>.</>
                  : <>If an account exists for <strong style={{ color: INK }}>{email}</strong>, a reset link is on its way.</>
                }
              </p>
              <button
                onClick={() => { setSent(false); setMode('signin'); setConfirm('') }}
                style={{ marginTop: 18, fontSize: 12, color: GOLD, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: INK3, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 7, fontWeight: 600 }}>
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  placeholder="you@example.com"
                  onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = GOLD)}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>

              {mode !== 'forgot' && (
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: INK3, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 7, fontWeight: 600 }}>
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    placeholder="••••••••"
                    onChange={e => setPassword(e.target.value)}
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = GOLD)}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                </div>
              )}

              {mode === 'signup' && (
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: INK3, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 7, fontWeight: 600 }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    placeholder="••••••••"
                    onChange={e => setConfirm(e.target.value)}
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = GOLD)}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
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
                  color: '#e8524a',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: 13,
                  borderRadius: 12,
                  background: loading ? 'rgba(232,197,71,0.45)' : GOLD,
                  color: '#080810',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  marginTop: 4,
                  transition: 'opacity 0.15s',
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                }}
              >
                {loading ? '…' : mode === 'forgot' ? 'Send reset link' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>

              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => { setError(''); setMode('forgot') }}
                  style={{ fontSize: 12, color: INK3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
                >
                  Forgot your password?
                </button>
              )}

              {mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => { setError(''); setMode('signin') }}
                  style={{ fontSize: 12, color: INK3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
                >
                  ← Back to sign in
                </button>
              )}
            </form>
          )}

          {/* Sign in / Sign up toggle */}
          {!sent && mode !== 'forgot' && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: INK3 }}>
                {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
              </span>
              <button
                onClick={() => { setError(''); setConfirm(''); setPassword(''); setMode(mode === 'signup' ? 'signin' : 'signup') }}
                style={{ fontSize: 13, color: GOLD, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
              >
                {mode === 'signup' ? 'Sign in' : 'Sign up'}
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: INK3, marginTop: 20 }}>
          Also available on iOS — CardIndex for iPhone
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
