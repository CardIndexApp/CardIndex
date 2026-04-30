'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordInner() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const code = searchParams.get('code')

    if (code) {
      // Exchange the PKCE code for a session — this is the primary path when
      // the user clicks the reset link in their email.
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setError('This reset link is invalid or has expired. Please request a new one.')
        } else {
          setSessionReady(true)
        }
      })
    } else {
      // Fallback: check for an existing recovery session (e.g. if the page was
      // reloaded after the code was already exchanged).
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setSessionReady(true)
        } else {
          setError('No valid reset link found. Please request a new password reset.')
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setDone(true)
      setTimeout(() => router.push('/'), 2500)
    }
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
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
            Card<span style={{ color: 'var(--gold)' }}>Index</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink3)', margin: 0 }}>Set a new password</p>
        </div>

        {done ? (
          <div style={{
            borderRadius: 12,
            padding: '24px 20px',
            background: 'rgba(61,232,138,0.06)',
            border: '1px solid rgba(61,232,138,0.2)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
            <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.7, margin: 0 }}>
              Password updated! Redirecting you home…
            </p>
          </div>
        ) : error && !sessionReady ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              borderRadius: 12,
              padding: '20px 16px',
              background: 'rgba(232,82,74,0.06)',
              border: '1px solid rgba(232,82,74,0.18)',
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>🔗</div>
              <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7, margin: 0 }}>
                {error}
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              style={{
                fontSize: 13,
                color: 'var(--gold)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: 2,
              }}
            >
              ← Back to CardIndex
            </button>
          </div>
        ) : !sessionReady ? (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink3)' }}>
            Verifying your reset link…
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--ink3)', letterSpacing: 1.5, marginBottom: 7 }}>
                NEW PASSWORD
              </label>
              <input
                type="password"
                required
                value={password}
                placeholder="Min. 8 characters"
                minLength={8}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--ink3)', letterSpacing: 1.5, marginBottom: 7 }}>
                CONFIRM PASSWORD
              </label>
              <input
                type="password"
                required
                value={confirm}
                placeholder="Repeat new password"
                onChange={e => setConfirm(e.target.value)}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              />
            </div>

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
              {loading ? '…' : 'Set new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Loading…</p>
      </div>
    }>
      <ResetPasswordInner />
    </Suspense>
  )
}
