'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import NextImage from 'next/image'
import Navbar from '@/components/Navbar'
import { tcgImg, ptImg } from '@/lib/img'

// Lazy-load below-fold components so their JS doesn't block the main thread
// during initial parse. They're never needed for LCP or FCP.
const Ticker      = dynamic(() => import('@/components/Ticker'),   { ssr: false })
const EbayLogo    = dynamic(() => import('@/components/EbayLogo'), { ssr: false })
const Footer      = dynamic(() => import('@/components/Footer'),   { ssr: false })

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeaturedCard {
  id: string
  name: string
  set: string
  grade: string
  price: number
  change: number
  score: number
  img: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface TrendingCard {
  id: string
  name: string
  set: string
  grade: string
  price: number
  change: number
  img: string
  searchedAt: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const TRENDING_CACHE_KEY  = 'ci_trending_v1'
const FEATURED_CACHE_KEY  = 'ci_featured_v1'
const FEATURED_TTL_MS     = 43_200_000 // 12 hours
const TRENDING_TTL_MS     = 43_200_000 // 12 hours

// ── FeaturedCardItem ──────────────────────────────────────────────────────────

function scoreColor(s: number) {
  return s >= 80 ? '#3de88a' : s >= 60 ? '#e8c547' : '#e8524a'
}

function FeaturedCardItem({ card, priority }: { card: FeaturedCard; priority?: boolean }) {
  const [imgErr, setImgErr] = useState(false)
  const up = card.change >= 0
  const url = `/card/${card.id}?grade=${encodeURIComponent(card.grade)}&name=${encodeURIComponent(card.name)}&set=${encodeURIComponent(card.set)}`
  return (
    <a href={url} className="card-hover" style={{ display: 'flex', flexDirection: 'column', borderRadius: 16, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none' }}>
      {/* Image */}
      <div style={{ position: 'relative', width: '100%', height: 180, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', marginBottom: 14, overflow: 'hidden', flexShrink: 0 }}>
        {card.img && !imgErr
          ? <NextImage
              src={ptImg(card.img)}
              alt={card.name}
              fill
              sizes="(max-width: 640px) 45vw, 220px"
              style={{ objectFit: 'contain', padding: 8 }}
              onError={() => setImgErr(true)}
              priority={priority}
            />
          : <span style={{ fontSize: 48, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>🃏</span>}
      </div>
      {/* Name / price */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.3px', minHeight: 36, lineHeight: 1.3 }}>{card.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{card.set}{card.set && card.grade ? ' · ' : ''}{card.grade}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>${card.price.toLocaleString()}</div>
            <div className="font-num" style={{ fontSize: 11, color: up ? 'var(--green)' : 'var(--red)' }}>
              {up ? '▲' : '▼'} {Math.abs(card.change).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
      {/* Score bar */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 0.5 }}>CardIndex Score</span>
          <span className="font-num" style={{ fontSize: 13, fontWeight: 700, color: scoreColor(card.score) }}>{card.score}</span>
        </div>
        <div style={{ height: 4, borderRadius: 3, background: 'var(--track)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${card.score}%`, background: scoreColor(card.score), borderRadius: 3 }} />
        </div>
      </div>
    </a>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

const faqItems = [
  {
    q: 'What trading cards are supported?',
    a: 'We currently focus on Pokémon TCG, with support for sports cards and other trading card games coming soon. Thousands of cards are already indexed.',
  },
  {
    q: 'Is CardIndex free to use?',
    a: 'Yes — the core features including search, price history, and CardIndex Scores are completely free. No credit card required to get started.',
  },
  {
    q: 'How accurate is the price data?',
    a: 'Prices are sourced from real completed eBay sales, updated daily. We only use verified sold listings — not asking prices or estimates.',
  },
]

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const router = useRouter()

  const [featured, setFeatured]           = useState<FeaturedCard[]>([])
  const [featuredLoading, setFeaturedLoading] = useState(true)

  const [trending, setTrending]           = useState<TrendingCard[]>([])
  const [trendingLoading, setTrendingLoading] = useState(true)

  useEffect(() => {
    // Featured cards — 12h localStorage cache
    try {
      const raw = localStorage.getItem(FEATURED_CACHE_KEY)
      if (raw) {
        const { data, ts } = JSON.parse(raw) as { data: FeaturedCard[]; ts: number }
        if (Date.now() - ts < FEATURED_TTL_MS && Array.isArray(data) && data.length > 0) {
          setFeatured(data)
          setFeaturedLoading(false)
          return
        }
      }
    } catch { /* ignore */ }
    fetch('/api/home/featured')
      .then(r => r.json())
      .then(({ cards }: { cards: FeaturedCard[] }) => {
        if (Array.isArray(cards) && cards.length > 0) {
          setFeatured(cards)
          try { localStorage.setItem(FEATURED_CACHE_KEY, JSON.stringify({ data: cards, ts: Date.now() })) } catch { /* full */ }
        }
      })
      .catch(() => {})
      .finally(() => setFeaturedLoading(false))
  }, [])

  useEffect(() => {
    // Try localStorage cache first (12h TTL) so repeat visitors get instant render
    try {
      const raw = localStorage.getItem(TRENDING_CACHE_KEY)
      if (raw) {
        const { data, ts } = JSON.parse(raw) as { data: TrendingCard[]; ts: number }
        if (Date.now() - ts < TRENDING_TTL_MS && Array.isArray(data) && data.length > 0) {
          setTrending(data)
          setTrendingLoading(false)
          return
        }
      }
    } catch { /* ignore parse errors */ }

    // Fetch fresh data
    fetch('/api/home/trending')
      .then(r => r.json())
      .then(({ cards }: { cards: TrendingCard[] }) => {
        if (Array.isArray(cards) && cards.length > 0) {
          setTrending(cards)
          try { localStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({ data: cards, ts: Date.now() })) } catch { /* storage full */ }
        }
      })
      .catch(() => { /* silently fail — section stays hidden */ })
      .finally(() => setTrendingLoading(false))
  }, [])

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="grid-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '88px 24px 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(232,197,71,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 720, width: '100%' }}>
            <div className="anim d1" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 99, padding: '4px 12px', marginBottom: 32, background: 'var(--gold2)', border: '1px solid rgba(232,197,71,0.2)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }} />
              <span style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2 }}>LIVE MARKET DATA</span>
            </div>
            <h1 className="anim d2" style={{ fontSize: 'clamp(40px,7vw,76px)', fontWeight: 800, lineHeight: 1, letterSpacing: '-2px', color: 'var(--ink)', marginBottom: 20 }}>
              The market index<br /><span style={{ color: 'var(--gold)' }}>for trading cards</span>
            </h1>
            <p className="anim d3" style={{ fontSize: 11, color: 'var(--ink3)', letterSpacing: 3, margin: '0 auto 36px', textTransform: 'uppercase' }}>
              Card Market Intelligence
            </p>
            <div className="anim d4" style={{ marginBottom: 28 }}>
              <button
                onClick={() => router.push('/search')}
                style={{ padding: '14px 40px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 15, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              >
                <span>Search cards</span>
                <span style={{ color: 'var(--ink3)', fontSize: 13 }}>→</span>
              </button>
            </div>
            <div className="anim d5" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <a href="/market" style={{ padding: '11px 24px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Explore Market</a>
              <button onClick={() => router.push('/search')} style={{ padding: '11px 24px', borderRadius: 12, background: 'var(--gold)', color: '#080810', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Get started free →</button>
            </div>
          </div>

        </section>

        <Ticker />

        {/* Featured */}
        <section id="featured" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Featured Cards</p>
              <h2 style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-1px' }}>Market highlights</h2>
            </div>
            <a href="/market" style={{ fontSize: 13, color: 'var(--ink3)', textDecoration: 'none' }}>View all →</a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
            {featuredLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ borderRadius: 16, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ width: '100%', height: 180, borderRadius: 10, background: 'var(--surface2)' }} />
                    <div style={{ height: 14, width: '70%', borderRadius: 4, background: 'var(--surface2)' }} />
                    <div style={{ height: 10, width: '50%', borderRadius: 4, background: 'var(--surface2)' }} />
                    <div style={{ height: 4, borderRadius: 3, background: 'var(--surface2)', marginTop: 'auto' }} />
                  </div>
                ))
              : featured.length > 0
                ? featured.map((card, i) => <FeaturedCardItem key={card.id + card.grade} card={card} priority={i < 2} />)
                : null
            }
          </div>
        </section>

        {/* Live Sales Data from eBay */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', boxShadow: '0 0 6px var(--green)' }} />
              <span style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1 }}>LIVE</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 500 }}>Sales Data from</span>
            <EbayLogo height={22} />
          </div>
          <div className="home-sales-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, borderRadius: 16, overflow: 'hidden', background: 'var(--border)' }}>
            {[
              { card: 'Charizard Base Set', grade: 'PSA 9', price: '$4,250', delta: '+3.2%', up: true },
              { card: 'Pikachu Illustrator', grade: 'PSA 7', price: '$38,000', delta: '+1.8%', up: true },
              { card: 'Lugia V Alt Art', grade: 'PSA 10', price: '$680', delta: '-0.5%', up: false },
            ].map((s, i) => (
              <div key={i} style={{ padding: '16px 18px', background: 'var(--surface)' }}>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 4 }}>{s.card}</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 6, opacity: 0.6 }}>{s.grade}</div>
                <div className="font-num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{s.price}</div>
                <div className="font-num" style={{ fontSize: 11, color: s.up ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
                  {s.up ? '▲' : '▼'} {s.delta}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recently Searched — hidden while loading or if no data */}
        {(trendingLoading || trending.length > 0) && (
        <section style={{ padding: '0 24px 80px', maxWidth: 1100, margin: '0 auto' }}>
          <div className="home-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Recently Searched</p>
              <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>Popular right now</h2>
            </div>
            <a href="/search" style={{ fontSize: 13, color: 'var(--ink3)', textDecoration: 'none' }}>Search cards →</a>
          </div>
          <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {trendingLoading
              /* Skeleton rows while fetching */
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ height: 12, width: '45%', borderRadius: 4, background: 'var(--surface2)' }} />
                      <div style={{ height: 10, width: '30%', borderRadius: 4, background: 'var(--surface2)' }} />
                    </div>
                    <div style={{ width: 48, height: 14, borderRadius: 4, background: 'var(--surface2)' }} />
                  </div>
                ))
              /* Real rows */
              : trending.map((item, i, arr) => {
                  const up = item.change >= 0
                  const cardUrl = `/card/${item.id}?grade=${encodeURIComponent(item.grade)}&name=${encodeURIComponent(item.name)}&set=${encodeURIComponent(item.set)}`
                  return (
                    <a key={item.id + item.grade} href={cardUrl} className="home-recent-row"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', background: 'transparent', transition: 'background 0.15s', gap: 12 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-subtle)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="home-recent-left" style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                        <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                          {item.img && <NextImage src={ptImg(item.img)} alt={item.name} fill sizes="40px" style={{ objectFit: 'contain', padding: 3 }} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink3)', whiteSpace: 'nowrap' }}>{item.set}{item.set && item.grade ? ' · ' : ''}{item.grade}</div>
                        </div>
                      </div>
                      <div className="home-recent-right" style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                        <span className="home-recent-ago" style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'right' }}>{timeAgo(item.searchedAt)}</span>
                        <span className="font-num" style={{ fontSize: 12, color: up ? 'var(--green)' : 'var(--red)', textAlign: 'right', minWidth: 48 }}>
                          {up ? '▲' : '▼'} {Math.abs(item.change).toFixed(1)}%
                        </span>
                        <span className="font-num home-recent-price" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', textAlign: 'right', minWidth: 56 }}>${item.price.toLocaleString()}</span>
                      </div>
                    </a>
                  )
                })
            }
          </div>
        </section>
        )}

        {/* How it works */}
        <section style={{ padding: '0 24px 96px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>How it works</p>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 14 }}>Three steps to smarter collecting</h2>
            <p style={{ fontSize: 14, color: 'var(--ink2)', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
              No finance experience needed. CardIndex does the hard analysis — you make the call.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 2, borderRadius: 20, overflow: 'hidden', background: 'var(--border)' }}>
            {[
              {
                n: '01',
                title: 'Search any card',
                body: 'Type a card name, set, or number. We cover thousands of Pokémon and trading cards across every major set.',
                detail: 'Supports Pokémon TCG · More coming soon',
              },
              {
                n: '02',
                title: 'See the full picture',
                body: 'Get price history, recent eBay sales, market trends, and a 0–100 score — all on one page, no spreadsheets needed.',
                detail: 'Up to 12 months of price data',
              },
              {
                n: '03',
                title: 'Know what to do',
                body: 'Our plain-English verdict tells you whether now is a good time to buy, hold, or sell — backed by real data.',
                detail: 'Buy · Hold · Sell verdicts',
              },
            ].map((step, i) => (
              <div key={i} style={{ padding: '36px 32px', background: 'var(--surface)', position: 'relative' }}>
                <div className="font-num" style={{ fontSize: 52, fontWeight: 800, color: 'var(--gold)', letterSpacing: '-2px', lineHeight: 1, marginBottom: 20, opacity: 0.85 }}>{step.n}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>{step.title}</div>
                <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.75, marginBottom: 16 }}>{step.body}</p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 99, padding: '4px 12px', background: 'rgba(61,232,138,0.1)', border: '1px solid rgba(61,232,138,0.25)' }}>
                  <span style={{ fontSize: 10, color: 'var(--green)', letterSpacing: 0.5, fontWeight: 500 }}>{step.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Verdict preview */}
        <section style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '96px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 64, alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>Market Verdicts</p>
              <h2 style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 16, lineHeight: 1.1 }}>Plain English.<br />No guesswork.</h2>
              <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.8, marginBottom: 28 }}>
                Every card gets a verdict backed by real transaction data. We translate market signals so you always know what to do — whether you've been collecting for 20 years or 20 minutes.
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  'No jargon — verdicts written in plain language',
                  'Based on real eBay sold listings, not estimates',
                  'Updated daily so you\'re never working from stale data',
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
                    <span style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1, fontWeight: 700 }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Mock verdict card */}
            <div style={{ borderRadius: 20, padding: 28, background: 'var(--bg)', border: '1px solid var(--border2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
                <div style={{ position: 'relative', width: 52, height: 52, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                  <NextImage src={tcgImg('https://images.pokemontcg.io/base1/4_hires.png')} alt="Charizard" fill sizes="52px" style={{ objectFit: 'contain' }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Charizard Base Set</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)' }}>PSA 9 · Base Set · #4/102</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>CardIndex Score</div>
                  <div className="font-num" style={{ fontSize: 32, fontWeight: 800, color: 'var(--green)', letterSpacing: '-1px' }}>87</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>Verdict</div>
                  <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: 99, background: 'rgba(61,232,138,0.12)', border: '1px solid rgba(61,232,138,0.3)', fontSize: 13, fontWeight: 700, color: 'var(--green)', letterSpacing: 0.5 }}>
                    Good time to buy
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Price up 12% over the last 30 days',
                  'PSA 9 supply tightening — fewer listings than usual',
                  'Strong collector demand, not yet overvalued',
                ].map((point, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--ink2)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }}>→</span>
                    {point}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--ink3)', letterSpacing: 0.5 }}>
                Based on 47 eBay sales · Updated today
              </div>
            </div>
          </div>
        </section>

        {/* Score explainer */}
        <section style={{ padding: '96px 24px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 64, alignItems: 'center' }}>
            {/* Score visual */}
            <div style={{ borderRadius: 20, padding: 36, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>CardIndex Score</div>
                  <div className="font-num" style={{ fontSize: 56, fontWeight: 800, color: 'var(--green)', letterSpacing: '-2px', lineHeight: 1 }}>87</div>
                  <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>out of 100</div>
                </div>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'conic-gradient(var(--green) 0% 87%, var(--track) 87% 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--surface)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Price Growth', val: 91, color: 'var(--green)' },
                  { label: 'Market Liquidity', val: 78, color: 'var(--green)' },
                  { label: 'Demand Signal', val: 85, color: 'var(--green)' },
                  { label: 'Volatility', val: 62, color: 'var(--gold)' },
                ].map((f, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--ink2)' }}>{f.label}</span>
                      <span className="font-num" style={{ fontSize: 12, color: f.color }}>{f.val}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: 'var(--track)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${f.val}%`, background: f.color, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>CardIndex Score</p>
              <h2 style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 16, lineHeight: 1.1 }}>One number.<br />The whole story.</h2>
              <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.8, marginBottom: 28 }}>
                The CardIndex Score is a 0–100 rating that combines four market signals into one number. A high score means a card is growing in value, has strong demand, trades frequently, and isn't wildly volatile.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Price Growth', desc: 'How much the price has moved recently' },
                  { label: 'Liquidity', desc: 'How easy it is to buy or sell quickly' },
                  { label: 'Demand', desc: 'Collector interest vs available supply' },
                  { label: 'Volatility', desc: 'How stable or erratic the price has been' },
                ].map((f, i) => (
                  <div key={i} style={{ borderRadius: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section style={{ padding: '0 24px 96px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Tools</p>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px' }}>Understand the market</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[
              { title: 'CardIndex Score', body: 'A composite 0–100 score measuring growth, liquidity, volatility, and collector demand for any card.' },
              { title: 'Market Verdicts', body: 'Plain-language analysis backed by real transaction data and trend signals. Know when to buy and sell.' },
              { title: 'Price History', body: 'Up to 12 months of historical price data with daily snapshots, sales volume, and trend indicators.' },
            ].map((f, i) => (
              <div key={i} style={{ borderRadius: 16, padding: 24, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{f.title}</div>
                <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: '0 24px 96px', maxWidth: 720, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>FAQ</p>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px' }}>Common questions</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderRadius: 16, overflow: 'hidden', background: 'var(--border)' }}>
            {faqItems.map((item, i) => (
              <div key={i} style={{ background: 'var(--surface)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{item.q}</span>
                  <span style={{ fontSize: 16, color: 'var(--ink3)', flexShrink: 0, transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 24px 20px' }}>
                    <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.75 }}>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '0 24px 96px' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', borderRadius: 24, padding: 56, background: 'var(--surface)', border: '1px solid var(--border2)' }}>
            <p style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase' }}>Free to start</p>
            <h2 style={{ fontSize: 30, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 12 }}>Start tracking the market</h2>
            <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 28 }}>CardIndex is free to use. No credit card required.</p>
            <button onClick={() => router.push('/search')} style={{ padding: '12px 32px', borderRadius: 12, background: 'var(--gold)', color: '#080810', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Get started free →</button>
          </div>
        </section>

        <Footer />
      </main>

      <style>{`
        /* ── Mobile: Samsung S24+ and similar narrow viewports ── */
        @media (max-width: 640px) {

          /* Hero section: tighter padding */
          section:first-of-type {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          /* Hero sales mock: single column */
          .home-sales-grid {
            grid-template-columns: 1fr !important;
          }

          /* "Popular right now" rows */
          .home-recent-row {
            padding: 12px 16px !important;
            gap: 10px !important;
          }
          .home-recent-left {
            min-width: 0;
            flex: 1 1 0;
          }
          .home-recent-right {
            gap: 10px !important;
          }
          /* Hide "ago" timestamp on narrow screens */
          .home-recent-ago {
            display: none !important;
          }

          /* Section horizontal padding */
          section {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          /* CTA block: reduce inner padding */
          section:last-of-type > div {
            padding: 32px 20px !important;
          }
        }
      `}</style>
    </>
  )
}
