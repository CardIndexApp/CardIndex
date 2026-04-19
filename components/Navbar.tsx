'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import AuthModal from './AuthModal'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const NAV_LINKS = [
  { label: 'Market',    href: '/market' },
  { label: 'Watchlist', href: '/watchlist' },
  { label: 'Pricing',   href: '/pricing' },
]

export default function Navbar() {
  const [authModal, setAuthModal] = useState<'signin' | 'signup' | null>(null)
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const close = () => { setOpen(false); setUserMenuOpen(false) }
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUserMenuOpen(false)
    window.location.href = '/'
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <>
      <nav style={{
        position: 'fixed', top: 32, left: 0, right: 0, zIndex: 50,
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(8,8,16,0.92)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Logo */}
        <Link href="/" onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>
            Card<span style={{ color: 'var(--gold)' }}>Index</span>
          </span>
          <span className="font-mono-custom" style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--gold2)', color: 'var(--gold)', border: '1px solid rgba(232,197,71,0.2)', letterSpacing: 1 }}>BETA</span>
        </Link>

        {/* Desktop nav */}
        <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ fontSize: 14, padding: '6px 12px', borderRadius: 8, color: 'var(--ink2)', textDecoration: 'none' }}>{l.label}</Link>
          ))}

          {user ? (
            <div style={{ position: 'relative', marginLeft: 8 }}>
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--gold2)', border: '1.5px solid var(--gold)', color: 'var(--gold)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {initials}
              </button>
              {userMenuOpen && (
                <div style={{ position: 'absolute', right: 0, top: 42, width: 200, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 2 }}>Signed in as</div>
                    <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                  </div>
                  <Link href="/watchlist" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--ink2)', textDecoration: 'none' }}>My Watchlist</Link>
                  <Link href="/pricing" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--ink2)', textDecoration: 'none' }}>Upgrade plan</Link>
                  <button onClick={signOut} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', fontSize: 13, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', borderTop: '1px solid var(--border)' }}>Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button onClick={() => setAuthModal('signin')} style={{ fontSize: 14, padding: '6px 12px', borderRadius: 8, color: 'var(--ink2)', background: 'none', border: 'none', cursor: 'pointer' }}>Log in</button>
              <button onClick={() => setAuthModal('signup')} style={{ fontSize: 14, padding: '7px 16px', borderRadius: 8, background: 'var(--gold)', color: '#080810', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Sign up</button>
            </>
          )}
        </div>

        {/* Hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          style={{ display: 'none', width: 40, height: 40, borderRadius: 10, background: open ? 'var(--surface2)' : 'transparent', border: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 5, padding: 0, transition: 'background 0.2s' }}
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{ display: 'block', width: 18, height: 1.5, background: 'var(--ink)', borderRadius: 2, transition: 'transform 0.25s, opacity 0.25s', transformOrigin: 'center',
              transform: open ? i === 0 ? 'translateY(6.5px) rotate(45deg)' : i === 2 ? 'translateY(-6.5px) rotate(-45deg)' : 'scaleX(0)' : 'none',
              opacity: open && i === 1 ? 0 : 1 }} />
          ))}
        </button>
      </nav>

      {/* Mobile drawer */}
      <div className="nav-drawer" style={{ position: 'fixed', top: 88, left: 0, right: 0, bottom: 0, zIndex: 49, background: 'rgba(8,8,16,0.97)', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column', padding: '32px 24px 40px', transform: open ? 'translateY(0)' : 'translateY(-12px)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.25s, transform 0.25s' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 32 }}>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', textDecoration: 'none', padding: '10px 0', borderBottom: '1px solid var(--border)', letterSpacing: '-0.5px' }}>{l.label}</Link>
          ))}
        </div>

        {user ? (
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 2 }}>Signed in as</div>
              <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{user.email}</div>
            </div>
            <button onClick={signOut} style={{ width: '100%', padding: 14, borderRadius: 12, background: 'rgba(232,82,74,0.1)', border: '1px solid rgba(232,82,74,0.3)', color: 'var(--red)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Sign out</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <button onClick={() => { setOpen(false); setAuthModal('signin') }} style={{ width: '100%', padding: 14, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Log in</button>
            <button onClick={() => { setOpen(false); setAuthModal('signup') }} style={{ width: '100%', padding: 14, borderRadius: 12, background: 'var(--gold)', color: '#080810', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Sign up — it's free</button>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .nav-desktop { display: none !important; }
          .nav-hamburger { display: flex !important; }
        }
        @media (min-width: 641px) {
          .nav-drawer { display: none !important; }
        }
      `}</style>

      {authModal && <AuthModal defaultTab={authModal} onClose={() => setAuthModal(null)} />}
    </>
  )
}
