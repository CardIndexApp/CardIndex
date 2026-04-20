'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { rising, declining, scoreColor } from '@/lib/data'

type Tier = 'free' | 'standard' | 'pro'

interface Profile {
  email: string
  username: string | null
  tier: Tier
}

interface WatchlistItem {
  id: string
  card_name: string
  set_name: string
  grade: string
}

const QUICK_ACTIONS = [
  {
    label: 'Search Cards',
    desc: 'Find any Pokémon card and get live price data',
    href: '/search',
    icon: (
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6.5" cy="6.5" r="4.5"/><path d="M14 14l-3-3"/>
      </svg>
    ),
    color: 'var(--gold)',
    bg: 'var(--gold2)',
    border: 'rgba(232,197,71,0.2)',
  },
  {
    label: 'My Watchlist',
    desc: 'Track your cards and monitor price movements',
    href: '/watchlist',
    icon: (
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2l1.5 3 3.5.5-2.5 2.5.6 3.5L8 10l-3.1 1.5.6-3.5L3 5.5l3.5-.5z"/>
      </svg>
    ),
    color: 'var(--blue)',
    bg: 'rgba(74,158,255,0.1)',
    border: 'rgba(74,158,255,0.2)',
  },
  {
    label: 'Market',
    desc: 'Browse trending cards and market movers',
    href: '/market',
    icon: (
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 11 5 6 9 8 15 3"/><polyline points="11 3 15 3 15 7"/>
      </svg>
    ),
    color: 'var(--green)',
    bg: 'rgba(61,232,138,0.08)',
    border: 'rgba(61,232,138,0.2)',
  },
  {
    label: 'Account',
    desc: 'Manage your profile, plan, and security',
    href: '/account',
    icon: (
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
      </svg>
    ),
    color: 'var(--ink2)',
    bg: 'var(--surface2)',
    border: 'var(--border2)',
  },
]

const TIER_LABELS: Record<Tier, string> = { free: 'Free', standard: 'Standard', pro: 'Pro' }
const TIER_COLORS: Record<Tier, string> = { free: 'var(--ink3)', standard: 'var(--blue)', pro: 'var(--gold)' }

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }

      const [{ data: prof }, { data: wl }] = await Promise.all([
        supabase.from('profiles').select('email, username, tier').eq('id', user.id).single(),
        supabase.from('watchlists').select('id, card_name, set_name, grade').eq('user_id', user.id).order('added_at', { ascending: false }).limit(5),
      ])

      setProfile(prof ?? { email: user.email ?? '', username: null, tier: 'free' })
      setWatchlist(wl ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    else router.push('/search')
  }

  const displayName = profile?.username ?? profile?.email?.split('@')[0] ?? ''
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
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>

          {/* ── Welcome ── */}
          <div style={{ marginTop: 32, marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 8 }}>WELCOME BACK</p>
                <h1 className="font-display" style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', lineHeight: 1.1 }}>
                  {displayName}
                </h1>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12, background: tier === 'free' ? 'var(--surface2)' : tier === 'pro' ? 'var(--gold2)' : 'rgba(74,158,255,0.08)', border: `1px solid ${tier === 'pro' ? 'rgba(232,197,71,0.25)' : tier === 'standard' ? 'rgba(74,158,255,0.2)' : 'var(--border2)'}` }}>
                <span style={{ fontSize: 12, color: TIER_COLORS[tier], fontWeight: 700 }}>{TIER_LABELS[tier]} plan</span>
                {tier === 'free' && (
                  <Link href="/pricing" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', marginLeft: 4 }}>Upgrade →</Link>
                )}
              </div>
            </div>
          </div>

          {/* ── Search bar ── */}
          <form onSubmit={handleSearch} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', gap: 8, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 14, padding: '6px 6px 6px 16px', alignItems: 'center', transition: 'border-color 0.15s' }}
              onFocus={() => {}} >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="6.5" cy="6.5" r="4.5"/><path d="M14 14l-3-3"/>
              </svg>
              <input
                type="text"
                placeholder="Search for a card, e.g. Charizard Base Set PSA 10…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--ink)', padding: '6px 0' }}
              />
              <button type="submit" style={{ padding: '10px 20px', borderRadius: 10, background: 'var(--gold)', color: '#080810', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                Search
              </button>
            </div>
          </form>

          {/* ── Quick Actions ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
            {QUICK_ACTIONS.map(action => (
              <Link key={action.href} href={action.href} style={{ textDecoration: 'none', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color 0.15s, transform 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = action.border; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 12, background: action.bg, border: `1px solid ${action.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color }}>
                  {action.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{action.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>{action.desc}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Two column: Watchlist + Market movers ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            {/* Watchlist preview */}
            <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>My Watchlist</span>
                <Link href="/watchlist" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none' }}>View all →</Link>
              </div>
              {watchlist.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>☆</div>
                  <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 14 }}>No cards yet</p>
                  <Link href="/search" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Search and add cards →</Link>
                </div>
              ) : (
                <>
                  {watchlist.map((item, i) => (
                    <div key={item.id} style={{ padding: '12px 20px', borderBottom: i < watchlist.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.card_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{item.set_name} · {item.grade}</div>
                      </div>
                    </div>
                  ))}
                  {watchlist.length === 5 && (
                    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)' }}>
                      <Link href="/watchlist" style={{ fontSize: 12, color: 'var(--ink3)', textDecoration: 'none' }}>See all cards →</Link>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Market movers */}
            <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Top Rising Today</span>
                <Link href="/market" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none' }}>Full market →</Link>
              </div>
              {rising.slice(0, 5).map((item, i) => (
                <Link key={i} href={`/card/${item.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span className="font-num" style={{ fontSize: 11, color: 'var(--ink3)', width: 14, flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{item.grade}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span className="font-num" style={{ fontSize: 13, color: 'var(--green)' }}>+{item.change}%</span>
                    <div style={{ width: 32, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${item.score}%`, background: scoreColor(item.score), borderRadius: 2 }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ── Upgrade banner (free users only) ── */}
          {tier === 'free' && (
            <div style={{ marginTop: 24, borderRadius: 16, background: 'var(--gold2)', border: '1px solid rgba(232,197,71,0.2)', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>Unlock the full CardIndex</div>
                <div style={{ fontSize: 13, color: 'rgba(232,197,71,0.7)' }}>Price history charts, trend indicators, unlimited watchlist and more.</div>
              </div>
              <Link href="/pricing" style={{ padding: '10px 22px', borderRadius: 10, background: 'var(--gold)', color: '#080810', textDecoration: 'none', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                See plans
              </Link>
            </div>
          )}

        </div>
      </main>

      <style>{`
        @media (max-width: 640px) {
          .dash-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}
