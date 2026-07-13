'use client'
import Link from 'next/link'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import UsernameSetupModal from './UsernameSetupModal'
import { AlertBellButton, AlertCentreModal } from './AlertCentre'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const NAV_LINKS_AUTHED = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Market',    href: '/market' },
  { label: 'Compare',   href: '/compare' },
  { label: 'Watchlist', href: '/watchlist' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Tools',     href: '/tools' },
]

const NAV_LINKS_GUEST = [
  { label: 'Login', href: '/login' },
]

// Web login/sign-up is hidden — CardIndex is iOS-first; guests are funnelled to
// the App Store instead. TODO: replace with the real App Store listing URL.
const APP_STORE_URL = 'https://apps.apple.com/app/cardindex/id000000000'

// Pages that get the desktop sidebar instead of the top nav bar
const SIDEBAR_PATHS = ['/dashboard', '/portfolio', '/watchlist', '/search', '/compare', '/market', '/card/', '/admin']

const SIDEBAR_NAV = [
  {
    label: 'Dashboard', href: '/dashboard',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg>,
  },
  {
    label: 'Portfolio', href: '/portfolio',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="13" width="4" height="6" rx="0.5"/><rect x="8" y="8" width="4" height="11" rx="0.5"/><rect x="14" y="3" width="4" height="16" rx="0.5"/></svg>,
  },
  {
    label: 'Watchlist', href: '/watchlist',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10 14.4l-4.8 2.5.9-5.4L2.2 7.7l5.4-.8z"/></svg>,
  },
  {
    label: 'Market', href: '/market',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="2 14 7 8 11 11 18 4"/><polyline points="14 4 18 4 18 8"/></svg>,
  },
  {
    label: 'Search', href: '/search',
    icon: <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M14 14l-3-3"/></svg>,
  },
  {
    label: 'Compare', href: '/compare',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l-3 3 3 3M15 17l3-3-3-3M2 6h16M2 14h16"/></svg>,
    proOnly: true,
  },
  {
    label: 'Admin', href: '/admin',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10 2l1.8 3.6L16 6.4l-3 2.9.7 4.1L10 11.5l-3.7 1.9.7-4.1-3-2.9 4.2-.8z"/></svg>,
    adminOnly: true,
  },
]

async function fetchProfile(userId: string): Promise<{ username: string | null; is_admin: boolean; tier: string }> {
  const { data } = await createClient()
    .from('profiles')
    .select('username, is_admin, tier')
    .eq('id', userId)
    .single()
  return { username: data?.username ?? null, is_admin: data?.is_admin ?? false, tier: data?.tier ?? 'free' }
}

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userTier, setUserTier] = useState<string>('free')
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [showPwResetBanner, setShowPwResetBanner] = useState(false)
  const [needsUsername, setNeedsUsername] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // getSession() reads from localStorage — no network request, instant
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id).then(p => {
        setUsername(p.username)
        setIsAdmin(p.is_admin)
        setUserTier(p.tier)
        if (!p.username) setNeedsUsername(true)
      })
    })

    // Keep in sync when auth state changes (sign in / sign out in another tab, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (!u) {
        setUsername(null)
        setIsAdmin(false)
        setNeedsUsername(false)
        setShowPwResetBanner(false)
      } else if (event === 'PASSWORD_RECOVERY') {
        // User clicked a password reset link — prompt them to change their password
        setShowPwResetBanner(true)
        fetchProfile(u.id).then(p => { setUsername(p.username); setIsAdmin(p.is_admin); setUserTier(p.tier) })
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchProfile(u.id).then(p => {
          setUsername(p.username)
          setIsAdmin(p.is_admin)
          setUserTier(p.tier)
          if (!p.username) setNeedsUsername(true)
        })
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
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Hide bottom nav when the soft keyboard is open (iOS/Android).
  // visualViewport.height shrinks when the keyboard appears; window.innerHeight stays fixed.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => setKeyboardOpen(vv.height < window.innerHeight * 0.8)
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
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

  const isHomepage = pathname === '/'
  const transparent = isHomepage && !scrolled
  const showSidebar = !!user && SIDEBAR_PATHS.some(p => pathname.startsWith(p))

  useEffect(() => {
    document.body.classList.toggle('has-sidebar', showSidebar)
    return () => document.body.classList.remove('has-sidebar')
  }, [showSidebar])

  return (
    <>
      <nav className="top-nav-bar" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: transparent ? '1px solid transparent' : '1px solid var(--border)',
        background: transparent ? 'transparent' : 'var(--nav-bg)',
        backdropFilter: transparent ? 'none' : 'blur(12px)',
        transition: 'background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease',
      }}>
        {/* Logo */}
        <Link href={user ? '/dashboard' : '/'} onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
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
              {NAV_LINKS_AUTHED.filter(l => l.href !== '/compare' || userTier === 'pro').map(l => (
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

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
            <AlertBellButton userId={user.id} onOpen={() => setShowAlerts(true)} />
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--gold2)', border: '1.5px solid var(--gold)', color: 'var(--gold)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {initials}
              </button>
              {userMenuOpen && (
                <div style={{ position: 'absolute', right: 0, top: 42, width: 200, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden', boxShadow: '0 16px 40px var(--shadow-lg)' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 700, marginBottom: 2 }}>{displayName}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                  </div>
                  <Link href="/watchlist" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--ink2)', textDecoration: 'none' }}>My Watchlist</Link>
                  <Link href="/account" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--ink2)', textDecoration: 'none' }}>Account settings</Link>
                  <Link href="/pricing" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--ink2)', textDecoration: 'none' }}>Upgrade plan</Link>
                  {isAdmin && (
                    <Link href="/admin" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--red)', textDecoration: 'none', borderTop: '1px solid var(--border)', fontWeight: 600 }}>⚙ Admin</Link>
                  )}
                  <button onClick={signOut} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', fontSize: 13, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', borderTop: '1px solid var(--border)' }}>Sign out</button>
                </div>
              )}
            </div>
            </div>
          )}
        </div>

        {/* Mobile guest login button */}
        {!user && (
          <Link href="/login" className="nav-mobile-guest" style={{ display: 'none', fontSize: 13, padding: '7px 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: 'var(--ink)', fontWeight: 600, textDecoration: 'none', alignItems: 'center' }}>
            Login
          </Link>
        )}

        {/* Hamburger (authed users on mobile only) */}
        {user && (
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
        )}
      </nav>

      {/* ── Desktop sidebar (authenticated app pages only) ── */}
      {showSidebar && (
        <aside className="app-sidebar" style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, width: 220,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          zIndex: 50,
          display: 'flex', flexDirection: 'column',
          padding: '28px 0',
        }}>
          {/* Wordmark */}
          <Link href="/dashboard" style={{ padding: '0 24px 32px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', textDecoration: 'none', display: 'block' }}>
            <span style={{ color: 'var(--ink)' }}>Card</span>
            <span style={{ color: 'var(--gold)' }}>Index</span>
          </Link>

          {/* Nav items */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {SIDEBAR_NAV.filter(item => (!item.proOnly || userTier === 'pro') && (!item.adminOnly || isAdmin)).map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.href} href={item.href} style={{
                  padding: '11px 24px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  fontSize: 15, fontWeight: active ? 600 : 500,
                  color: active ? 'var(--ink)' : 'var(--ink3)',
                  background: active ? 'var(--hover-subtle)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'color 0.15s, background 0.15s',
                }}>
                  <span style={{ color: active ? 'var(--gold)' : 'inherit', display: 'flex' }}>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}

            {/* Alerts — opens modal */}
            <button onClick={() => setShowAlerts(true)} style={{
              padding: '11px 24px', display: 'flex', alignItems: 'center', gap: 12,
              fontSize: 15, fontWeight: 500, color: 'var(--ink3)',
              background: 'none', border: 'none', cursor: 'pointer',
              transition: 'color 0.15s',
            }}>
              <span style={{ display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2a6 6 0 0 1 6 6c0 3.5 1.5 5 1.5 5h-15S3 11.5 3 8a6 6 0 0 1 6-6z"/>
                  <path d="M8.5 17.5a1.5 1.5 0 0 0 3 0"/>
                </svg>
              </span>
              Alerts
            </button>
          </div>

          {/* User footer */}
          <div style={{ marginTop: 'auto', padding: '0 24px', position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '12px 0',
                background: 'none', border: 'none', borderTop: '1px solid var(--border)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'var(--gold2)', border: '1.5px solid var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: 'var(--gold)',
              }}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                <div style={{ fontSize: 12, color: 'var(--ink3)', textTransform: 'capitalize' }}>{userTier} plan</div>
              </div>
            </button>
            {userMenuOpen && (
              <div style={{ position: 'absolute', left: '100%', bottom: 0, marginLeft: 8, width: 200, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden', boxShadow: '0 16px 40px var(--shadow-lg)', zIndex: 60 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 700, marginBottom: 2 }}>{displayName}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
                </div>
                <Link href="/account" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--ink2)', textDecoration: 'none' }}>Account settings</Link>
                <Link href="/pricing" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--ink2)', textDecoration: 'none' }}>Upgrade plan</Link>
                {isAdmin && (
                  <Link href="/admin" onClick={() => setUserMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--red)', textDecoration: 'none', borderTop: '1px solid var(--border)', fontWeight: 600 }}>⚙ Admin</Link>
                )}
                <button onClick={signOut} style={{ width: '100%', padding: '10px 16px', textAlign: 'left', fontSize: 13, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', borderTop: '1px solid var(--border)' }}>Sign out</button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Password-reset sign-in banner */}
      {showPwResetBanner && (
        <div style={{
          position: 'fixed', top: 56, left: 0, right: 0, zIndex: 49,
          background: 'rgba(232,197,71,0.10)',
          borderBottom: '1px solid rgba(232,197,71,0.25)',
          backdropFilter: 'blur(8px)',
          padding: '10px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.4 }}>
            🔑 You&apos;re signed in via a reset link — please update your password.
          </span>
          <a
            href="/account"
            onClick={() => setShowPwResetBanner(false)}
            style={{
              fontSize: 12, fontWeight: 700, color: '#080810',
              background: 'var(--gold)', borderRadius: 8,
              padding: '5px 14px', textDecoration: 'none', flexShrink: 0,
            }}
          >
            Change password →
          </a>
          <button
            onClick={() => setShowPwResetBanner(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink3)', fontSize: 18, lineHeight: 1,
              padding: '0 4px', flexShrink: 0,
            }}
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* Mobile drawer */}
      <div className="nav-drawer" style={{ position: 'fixed', top: 56, left: 0, right: 0, bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 49, background: 'var(--nav-solid)', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column', padding: '32px 24px 24px', overflowY: 'auto', transform: open ? 'translateY(0)' : 'translateY(-12px)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.25s, transform 0.25s' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 32 }}>
          {user ? (
            <>
              <Link href="/search" onClick={() => setOpen(false)} style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)', textDecoration: 'none', padding: '10px 0', borderBottom: '1px solid var(--border)', letterSpacing: '-0.5px' }}>Search</Link>
              {NAV_LINKS_AUTHED.filter(l => l.href !== '/compare' || userTier === 'pro').map(l => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', textDecoration: 'none', padding: '10px 0', borderBottom: '1px solid var(--border)', letterSpacing: '-0.5px' }}>{l.label}</Link>
              ))}
            </>
          ) : (
            NAV_LINKS_GUEST.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', textDecoration: 'none', padding: '10px 0', borderBottom: '1px solid var(--border)', letterSpacing: '-0.5px' }}>{l.label}</Link>
            ))
          )}
        </div>

        {user && (
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 700, marginBottom: 2 }}>{displayName}</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{user.email}</div>
            </div>
            {isAdmin && (
              <Link href="/admin" onClick={() => setOpen(false)} style={{ width: '100%', padding: 14, borderRadius: 12, background: 'rgba(232,82,74,0.08)', border: '1px solid rgba(232,82,74,0.25)', color: 'var(--red)', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center', display: 'block' }}>⚙ Admin Dashboard</Link>
            )}
            <button onClick={signOut} style={{ width: '100%', padding: 14, borderRadius: 12, background: 'rgba(232,82,74,0.1)', border: '1px solid rgba(232,82,74,0.3)', color: 'var(--red)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Sign out</button>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .nav-desktop { display: none !important; }
          .nav-hamburger { display: flex !important; }
          .nav-mobile-guest { display: flex !important; }
          /* push page content above the bottom nav */
          main { padding-bottom: calc(108px + env(safe-area-inset-bottom)) !important; }
          .app-sidebar { display: none !important; }
        }
        @media (min-width: 641px) {
          .nav-drawer { display: none !important; }
          .bottom-nav { display: none !important; }
          /* When sidebar is active, hide the top nav bar and shift content */
          body.has-sidebar .top-nav-bar { display: none !important; }
          body.has-sidebar main {
            margin-left: 220px;
            padding-top: 40px !important;
          }
        }
      `}</style>

      {/* ── Bottom tab bar (mobile only, authed) ── */}
      {user && (
        <nav className="bottom-nav" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'var(--bottom-nav)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--nav-border)',
          display: keyboardOpen ? 'none' : 'flex', alignItems: 'stretch',
          paddingBottom: 'env(safe-area-inset-bottom)',
          height: 'calc(84px + env(safe-area-inset-bottom))',
        }}>
          {/* Dashboard */}
          <Link href="/dashboard" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, textDecoration: 'none', color: pathname === '/dashboard' ? 'var(--gold)' : 'var(--nav-inactive)', paddingBottom: 8 }}>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={pathname === '/dashboard' ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="7" height="7" rx="1.5"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: pathname === '/dashboard' ? 700 : 400, letterSpacing: 0.1 }}>Dashboard</span>
          </Link>

          {/* Portfolio */}
          <Link href="/portfolio" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, textDecoration: 'none', color: pathname === '/portfolio' ? 'var(--gold)' : 'var(--nav-inactive)', paddingBottom: 8 }}>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={pathname === '/portfolio' ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="13" width="4" height="6" rx="0.5"/>
              <rect x="8" y="8"  width="4" height="11" rx="0.5"/>
              <rect x="14" y="3" width="4" height="16" rx="0.5"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: pathname === '/portfolio' ? 700 : 400, letterSpacing: 0.1 }}>Portfolio</span>
          </Link>

          {/* Search — raised centre FAB */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, paddingBottom: 8 }}>
            <Link href="/search" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46, borderRadius: '50%', background: pathname === '/search' ? 'var(--gold)' : 'rgba(232,197,71,0.12)', border: `1.5px solid ${pathname === '/search' ? 'var(--gold)' : 'rgba(232,197,71,0.3)'}`, color: pathname === '/search' ? '#080810' : 'var(--gold)', boxShadow: pathname === '/search' ? '0 4px 20px rgba(232,197,71,0.35)' : '0 2px 12px rgba(232,197,71,0.15)', textDecoration: 'none' }}>
              <svg width="19" height="19" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6.5" cy="6.5" r="4.5"/><path d="M14 14l-3-3"/>
              </svg>
            </Link>
            <span style={{ fontSize: 10, color: pathname === '/search' ? 'var(--gold)' : 'var(--nav-inactive)', fontWeight: pathname === '/search' ? 700 : 400, letterSpacing: 0.1 }}>Search</span>
          </div>

          {/* Market */}
          <Link href="/market" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, textDecoration: 'none', color: pathname === '/market' ? 'var(--gold)' : 'var(--nav-inactive)', paddingBottom: 8 }}>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={pathname === '/market' ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2 14 7 8 11 11 18 4"/>
              <polyline points="14 4 18 4 18 8"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: pathname === '/market' ? 700 : 400, letterSpacing: 0.1 }}>Market</span>
          </Link>

          {/* Account */}
          <Link href="/account" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, textDecoration: 'none', color: pathname === '/account' ? 'var(--gold)' : 'var(--nav-inactive)', paddingBottom: 8 }}>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={pathname === '/account' ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="6" r="3.5"/>
              <path d="M3 18c0-3.9 3.1-7 7-7s7 3.1 7 7"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: pathname === '/account' ? 700 : 400, letterSpacing: 0.1 }}>Account</span>
          </Link>
        </nav>
      )}

      {showAlerts && <AlertCentreModal onClose={() => setShowAlerts(false)} />}

      {/* Blocking modal for users who signed up via Google without a username */}
      {needsUsername && user && (
        <UsernameSetupModal
          userId={user.id}
          onComplete={(un) => { setUsername(un); setNeedsUsername(false) }}
        />
      )}
    </>
  )
}
