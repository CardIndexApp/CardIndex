'use client'
import { useState } from 'react'

interface Props { mode: 'login' | 'signup'; onClose: () => void }

export default function AuthModal({ mode, onClose }: Props) {
  const [view, setView] = useState(mode)
  const [done, setDone] = useState(false)

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: '100%', maxWidth: 360, borderRadius: 20, padding: 32, background: 'var(--surface)', border: '1px solid var(--border2)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        {!done ? (
          <>
            <div style={{ marginBottom: 24 }}>
              <div className="font-display" style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Card<span style={{ color: 'var(--gold)' }}>Index</span></div>
              <p style={{ fontSize: 13, color: 'var(--ink2)' }}>{view === 'login' ? 'Welcome back.' : 'The market index for trading cards.'}</p>
            </div>
            <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'var(--surface2)', marginBottom: 20 }}>
              {(['login', 'signup'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: view === v ? 'var(--gold)' : 'transparent', color: view === v ? '#080810' : 'var(--ink2)' }}>
                  {v === 'login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {view === 'signup' && <input type="text" placeholder="Full name" style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }} />}
              <input type="email" placeholder="Email address" style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }} />
              <input type="password" placeholder="Password" style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }} />
            </div>
            <button onClick={() => setDone(true)} style={{ width: '100%', padding: '11px 0', borderRadius: 10, background: 'var(--gold)', color: '#080810', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              {view === 'login' ? 'Log in' : 'Create account'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
            <p className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>You are in.</p>
            <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 24 }}>CardIndex dashboard coming soon.</p>
            <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink)', cursor: 'pointer', fontSize: 14 }}>Continue to dashboard →</button>
          </div>
        )}
      </div>
    </div>
  )
}
