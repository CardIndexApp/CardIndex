import NextImage from 'next/image'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Ticker from '@/components/Ticker'
import Footer from '@/components/Footer'
import { HomeFeaturedCard, type FeaturedCard } from '@/components/HomeFeaturedCard'
import { HomeFAQ } from '@/components/HomeFAQ'
import { tcgImg, ptImg } from '@/lib/img'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL)          return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

// ── Server-side data fetching ─────────────────────────────────────────────────

async function getFeaturedCards(): Promise<FeaturedCard[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/home/featured`, {
      next: { revalidate: 300 }, // ISR: refresh at most every 5 min
    })
    if (!res.ok) return []
    const { cards } = await res.json()
    return Array.isArray(cards) ? cards : []
  } catch {
    return []
  }
}

async function getTrendingCards(): Promise<TrendingCard[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/home/trending`, {
      next: { revalidate: 43200 }, // ISR: refresh at most every 12 h
    })
    if (!res.ok) return []
    const { cards } = await res.json()
    return Array.isArray(cards) ? cards : []
  } catch {
    return []
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  // Both fetches run in parallel — data is ready before the HTML is sent
  const [featured, trending] = await Promise.all([
    getFeaturedCards(),
    getTrendingCards(),
  ])

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="grid-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '88px 24px 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(232,197,71,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 720, width: '100%' }}>
            <div className="anim d1" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 99, padding: '4px 12px', marginBottom: 32, background: 'rgba(232,197,71,0.15)', border: '1px solid rgba(232,197,71,0.4)' }}>
              <span style={{ fontSize: 12 }}>🚀</span>
              <span style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 1.5, fontWeight: 600 }}>50% off early access — limited spots</span>
            </div>
            <h1 className="anim d2" style={{ fontSize: 'clamp(40px,7vw,76px)', fontWeight: 800, lineHeight: 1, letterSpacing: '-2px', color: 'var(--ink)', marginBottom: 20 }}>
              Stop guessing. Start investing in <span style={{ color: 'var(--gold)' }}>trading cards.</span>
            </h1>
            <p className="anim d3" style={{ fontSize: 17, color: 'var(--ink2)', maxWidth: 560, margin: '0 auto', lineHeight: 1.7, marginBottom: 36 }}>
              Instantly see if a card is a good buy, hold, or sell — powered by real market data.
            </p>
            <div className="anim d4" style={{ marginBottom: 16 }}>
              <a
                href="/search"
                style={{ padding: '14px 40px', borderRadius: 14, background: 'var(--gold)', border: 'none', color: '#080810', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
              >
                Get your first verdict free
              </a>
            </div>
            <div className="anim d5" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <a href="/market" style={{ padding: '11px 24px', borderRadius: 12, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Explore live market</a>
            </div>
          </div>
        </section>

        {/* Verdict Example */}
        <section style={{ padding: '0 24px 64px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 520, borderRadius: 20, padding: 28, background: 'var(--surface)', border: '1px solid var(--border2)', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase' }}>Example verdict</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>Charizard Base Set</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)' }}>PSA 9 · Base Set · #4/102</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 4 }}>SCORE</div>
                <div className="font-num" style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', lineHeight: 1 }}>87</div>
              </div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 99, background: 'rgba(61,232,138,0.12)', border: '1px solid rgba(61,232,138,0.3)', marginBottom: 18 }}>
              <span style={{ fontSize: 14 }}>✅</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>Good time to buy</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Price up 12% over the last 30 days', 'PSA 9 supply tightening — fewer listings than usual', 'Strong collector demand, not yet overvalued'].map((pt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--ink2)', lineHeight: 1.55 }}>
                  <span style={{ color: 'var(--green)', flexShrink: 0, fontWeight: 700 }}>•</span>
                  {pt}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 0.5 }}>Based on 47 eBay sales · Updated today</span>
              <a href="/search" style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>Get yours →</a>
            </div>
          </div>
        </section>

        {/* Urgency chips */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', padding: '0 24px 40px' }}>
          {[
            { icon: '🚀', text: '50% off early access — limited spots' },
            { icon: '⚡', text: 'High demand cards trending now' },
            { icon: '📉', text: 'Recently dropped — potential buys available' },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--border2)', fontSize: 11, color: 'var(--ink2)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        <Ticker />

        {/* Featured — rendered server-side, no loading spinner */}
        {featured.length > 0 && (
          <section id="featured" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Trending Opportunities</p>
                <h2 style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-1px' }}>🔥 Trending Opportunities</h2>
              </div>
              <a href="/market" style={{ fontSize: 13, color: 'var(--ink3)', textDecoration: 'none' }}>View market →</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
              {featured.map((card, i) => (
                <div key={card.id + card.grade} className={i === 4 ? 'featured-card-5th' : undefined} style={{ display: 'contents' }}>
                  <HomeFeaturedCard card={card} priority={i < 2} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recently Searched — rendered server-side */}
        {trending.length > 0 && (
          <section style={{ padding: '0 24px 80px', maxWidth: 1100, margin: '0 auto' }}>
            <div className="home-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Recently Searched</p>
                <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>Popular right now</h2>
              </div>
              <a href="/search" style={{ fontSize: 13, color: 'var(--ink3)', textDecoration: 'none' }}>Get your verdict →</a>
            </div>
            <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {trending.map((item, i, arr) => {
                const up = item.change >= 0
                const cardUrl = `/card/${item.id}?grade=${encodeURIComponent(item.grade)}&name=${encodeURIComponent(item.name)}&set=${encodeURIComponent(item.set)}`
                return (
                  <a key={item.id + item.grade} href={cardUrl} className="home-recent-row"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', gap: 12 }}
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
              })}
            </div>
          </section>
        )}

        {/* How it works */}
        <section style={{ padding: '0 24px 96px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>How it works</p>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 14 }}>Three steps. Clear decisions.</h2>
            <p style={{ fontSize: 14, color: 'var(--ink2)', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>No finance experience needed. Real market data, plain English.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 2, borderRadius: 20, overflow: 'hidden', background: 'var(--border)' }}>
            {[
              { n: '01', title: 'Search any card',    body: 'Find any Pokémon card instantly.',                                           detail: 'Pokémon TCG · More games coming soon' },
              { n: '02', title: 'Get the full picture', body: 'See price trends, demand, and market signals in seconds.',                detail: 'Up to 12 months of price data' },
              { n: '03', title: 'Know what to do',    body: 'Get a clear verdict: Buy, Hold, or Sell.',                                 detail: 'Buy · Hold · Sell verdicts' },
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
                We translate complex market data into clear decisions — so you always know what to do, whether you&apos;ve been collecting for 20 years or 20 minutes.
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
                {['Price up 12% over the last 30 days', 'PSA 9 supply tightening — fewer listings than usual', 'Strong collector demand, not yet overvalued'].map((point, i) => (
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
                  { label: 'Price Growth',     val: 91, color: 'var(--green)' },
                  { label: 'Market Liquidity', val: 78, color: 'var(--green)' },
                  { label: 'Demand Signal',    val: 85, color: 'var(--green)' },
                  { label: 'Volatility',       val: 62, color: 'var(--gold)'  },
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
                The CardIndex Score is a 0–100 rating that combines four market signals into one number. A high score means a card is growing in value, has strong demand, trades frequently, and isn&apos;t wildly volatile.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Price Growth', desc: 'How much the price has moved recently' },
                  { label: 'Liquidity',    desc: 'How easy it is to buy or sell quickly' },
                  { label: 'Demand',       desc: 'Collector interest vs available supply' },
                  { label: 'Volatility',   desc: 'How stable or erratic the price has been' },
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
              { title: 'Price History',   body: 'Up to 12 months of historical price data with daily snapshots, sales volume, and trend indicators.' },
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
          <HomeFAQ />
        </section>

        {/* CTA */}
        <section style={{ padding: '0 24px 96px' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', borderRadius: 24, padding: 56, background: 'var(--surface)', border: '1px solid var(--border2)' }}>
            <p style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase' }}>Free to start</p>
            <h2 style={{ fontSize: 30, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 12 }}>Know exactly what to do with your cards.</h2>
            <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 28 }}>Get your first verdict free. No credit card required.</p>
            <a href="/search" style={{ padding: '12px 32px', borderRadius: 12, background: 'var(--gold)', color: '#080810', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>Get your verdict →</a>
          </div>
        </section>

        <Footer />
      </main>

      <style>{`
        /* Hide 5th featured card on mobile so the grid stays a clean 2×2 */
        @media (max-width: 640px) { .featured-card-5th { display: none !important; } }

        @media (max-width: 640px) {
          section:first-of-type { padding-left: 16px !important; padding-right: 16px !important; }
          .home-sales-grid { grid-template-columns: 1fr !important; }
          .home-recent-row { padding: 12px 16px !important; gap: 10px !important; }
          .home-recent-left { min-width: 0; flex: 1 1 0; }
          .home-recent-right { gap: 10px !important; }
          .home-recent-ago { display: none !important; }
          section { padding-left: 16px !important; padding-right: 16px !important; }
          section:last-of-type > div { padding: 32px 20px !important; }
        }

        /* CSS hover for trending rows — no JS needed */
        .home-recent-row:hover { background: var(--hover-subtle) !important; }
      `}</style>
    </>
  )
}
