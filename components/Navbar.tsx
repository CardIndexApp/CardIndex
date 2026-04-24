'use client'
import Link from 'next/link'
import { useState, useEffect, useCallback, useMemo } from 'react'
import AuthModal from './AuthModal'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const NAV_LINKS_AUTHED = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Market',    href: '/market' },
  { label: 'Watchlist', href: '/watchlist' },
]

const NAV_LINKS_GUEST = [
  { label: 'Market',    href: '/market' },
  { label: 'Watchlist', href: '/watchlist' },
  { label: 'Pricing',   href: '/pricing' },
]

async function fetchUsername(userId: string): Promise<string | null> {
  const { data } = await createClient()
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single()
  return data?.username ?? null
}

export default function Navbar() {
  const [authModal, setAuthModal] = useState<'signin' | 'signup' | null>(null)
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // getSession() reads from localStorage — no network request, instant
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchUsername(u.id).then(setUsername)
    })

    // Keep in sync when auth state changes (sign in / sign out in another tab, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (!u) {
        setUsername(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchUsername(u.id).then(setUsername)
      }
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

  const signOut = useCallback(async () => {
    await createClient().auth.signOut()
    setUserMenuOpen(false)
    window.location.href = '/'
  }, [])

  const displayName = useMemo(
    () => username ?? user?.email?.split('@')[0] ?? '',
    [username, user]
  )
  const initials = useMemo(
    () => displayName.slice(0, 2).toUpperCase() || '?',
    [displayName]
  )

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(8,8,16,0.92)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Logo */}
        <Link href={user ? '/dashboard' : '/'} onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect width="32" height="32" rx="6" fill="#141428"/>
            <rect x="5" y="3" width="22" height="26" rx="3.5" fill="#0d0d1e" stroke="#e8c547" strokeWidth="1.5"/>
            <rect x="8"  y="22" width="4" height="5"  rx="1" fill="#e8c547" opacity="0.48"/>
            <rect x="14" y="17" width="4" height="10" rx="1" fill="#e8c547" opacity="0.76"/>
            <rect x="20" y="11" width="4" height="16" rx="1" fill="#e8c547"/>
          </svg>
          <span className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>
            Card<span style={{ color: 'var(--gold)' }}>Index</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Link href="/search" style={{ fontSize: 13, padding: '7px 14px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink2)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M14 14l-3-3"/></svg>
                Search
              </Link>
              {NAV_LINKS_AUTHED.map(l => (
                <Link key={l.href} href={l.href} style={{ fontSize: 14, padding: '6px 12px', borderRadius: 8, color: 'var(--ink2)', textDecoration: 'none' }}>{l.label}</Link>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {NAV_LINKS_GUEST.map(l => (
                <Link key={l.href} href={l.href} style={{ fontSize: 14, padding: '6px 12px', borderRadius: 8, color: 'var(--ink2)', textDecoration: 'none' }}>{l.label}</Link>
              ))}
            </div>
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--gold2)', border: '1.5px solid var(--gold)', color: 'var(--gold)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {initials}
              </button>
              {userMenuOpen && (
                <div style={{ position: 'absolute', right: 0, top: 42, width: 200, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 700, marginBottom: 2 }}>{displayName}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                  </div>
                  <Link href="/watchlist" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--ink2)', textDecoration: 'none' }}>My Watchlist</Link>
                  <Link href="/account" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--ink2)', textDecoration: 'none' }}>Account settings</Link>
                  <Link href="/pricing" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--ink2)', textDecoration: 'none' }}>Upgrade plan</Link>
                  <button onClick={signOut} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', fontSize: 13, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', borderTop: '1px solid var(--border)' }}>Sign out</button>
                </div>
              )}
            </div>
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
      <div className="nav-drawer" style={{ position: 'fixed', top: 56, left: 0, right: 0, bottom: 0, zIndex: 49, background: 'rgba(8,8,16,0.97)', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column', padding: '32px 24px 40px', transform: open ? 'translateY(0)' : 'translateY(-12px)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.25s, transform 0.25s' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 32 }}>
          {user ? (
            <>
              <Link href="/search" onClick={() => setOpen(false)} style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)', textDecoration: 'none', padding: '10px 0', borderBottom: '1px solid var(--border)', letterSpacing: '-0.5px' }}>Search</Link>
              {NAV_LINKS_AUTHED.map(l => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', textDecoration: 'none', padding: '10px 0', borderBottom: '1px solid var(--border)', letterSpacing: '-0.5px' }}>{l.label}</Link>
              ))}
            </>
          ) : (
            NAV_LINKS_GUEST.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', textDecoration: 'none', padding: '10px 0', borderBottom: '1px solid var(--border)', letterSpacing: '-0.5px' }}>{l.label}</Link>
            ))
          )}
        </div>

        {user ? (
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 700, marginBottom: 2 }}>{displayName}</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{user.email}</div>
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
