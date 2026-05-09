'use client'
/**
 * Blocking modal shown to authenticated users who have no username yet.
 * Cannot be dismissed — the user MUST choose a username to continue.
 * Triggered for Google OAuth sign-ups and any other path that bypasses
 * the AuthModal username field.
 */
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Status = 'idle' | 'checking' | 'available' | 'taken' | 'short'

interface Props {
  userId: string
  onComplete: (username: string) => void
}

export default function UsernameSetupModal({ userId, onComplete }: Props) {
  const [username, setUsername]   = useState('')
  const [status, setStatus]       = useState<Status>('idle')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  // Live availability check
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const val = username.trim()
    if (!val)          { setStatus('idle');  return }
    if (val.length < 3) { setStatus('short'); return }
    setStatus('checking')
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(val)}`)
        const { available } = await res.json()
        setStatus(available ? 'available' : 'taken')
      } catch {
        setStatus('idle')
      }
    }, 400)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [username])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const val = username.trim()
    if (!val || val.length < 3) { setError('Username must be at least 3 characters.'); return }
    if (status === 'taken')     { setError('That username is already taken.'); return }
    if (status === 'checking')  { setError('Still checking availability — please wait a moment.'); return }
    if (status !== 'available') { setError('Please choose a valid username.'); return }

    setSaving(true)
    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ username: val })
      .eq('id', userId)
    setSaving(false)

    if (dbErr) { setError(dbErr.message); return }
    onComplete(val)
  }

  const statusColor = status === 'available' ? '#3de88a' : status === 'taken' ? 'var(--red)' : 'var(--ink3)'
  const statusText  = status === 'checking' ? '…checking' : status === 'available' ? '✓ Available' : status === 'taken' ? '✗ Taken' : status === 'short' ? 'Min. 3 characters' : ''

  return (
    /* No onClick on backdrop — intentionally non-dismissible */
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border2)', padding: 36 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>
            Card<span style={{ color: 'var(--gold)' }}>Index</span>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>One last step</p>
          <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.6 }}>
            Choose a username to finish setting up your account. This is how you&apos;ll appear on CardIndex.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
              <label style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1.5, fontWeight: 600 }}>USERNAME</label>
              {username.trim().length > 0 && (
                <span style={{ fontSize: 11, color: statusColor }}>{statusText}</span>
              )}
            </div>
            <input
              type="text"
              autoFocus
              required
              value={username}
              placeholder="e.g. charizard_collector"
              minLength={3}
              maxLength={32}
              onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'var(--bg)', border: `1px solid ${status === 'available' ? 'rgba(61,232,138,0.4)' : status === 'taken' ? 'rgba(232,82,74,0.4)' : 'var(--border2)'}`, color: 'var(--ink)', fontSize: 14, outline: 'none', transition: 'border-color 0.15s' }}
            />
            <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 6 }}>Letters, numbers and underscores only.</p>
          </div>

          {error && (
            <div style={{ borderRadius: 8, padding: '10px 14px', background: 'rgba(232,82,74,0.08)', border: '1px solid rgba(232,82,74,0.25)', fontSize: 12, color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || status !== 'available'}
            style={{ padding: 13, borderRadius: 12, background: status === 'available' && !saving ? 'var(--gold)' : 'rgba(232,197,71,0.3)', color: status === 'available' && !saving ? '#080810' : 'var(--ink3)', border: 'none', cursor: status === 'available' && !saving ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700, transition: 'all 0.15s' }}
          >
            {saving ? 'Saving…' : 'Continue →'}
          </button>
        </form>
      </div>
    </div>
  )
}
