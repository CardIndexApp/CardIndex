import NextImage from 'next/image'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { HomeFAQ } from '@/components/HomeFAQ'

// CardIndex is iOS-first — the hero/CTAs point to the App Store.
// TODO: replace with the real App Store listing URL.
const APP_STORE_URL = 'https://apps.apple.com/app/cardindex/id000000000'

// ── Brand palette (matches the iOS app) ───────────────────────────────────────
const GOLD = '#e8c547'
const GOLD_HI = '#f7df74'
const GREEN = '#3de88a'
const CARD_BG = 'linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.012))'
const CARD_BORDER = '1px solid rgba(255,255,255,0.08)'

// ── Small inline icon helper (stroke style, inherits color) ───────────────────
function Ico({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}

const ComingSoonBadge = () => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 22px', borderRadius: 14, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 12px 30px -12px rgba(0,0,0,0.4)' }}>
    <svg viewBox="0 0 384 512" width="22" height="22" fill="#eeeef8" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
    <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
      <span style={{ display: 'block', fontSize: 9, color: '#b8b8d0', letterSpacing: 0.5, textTransform: 'uppercase' }}>Coming soon to</span>
      <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: '#eeeef8' }}>iOS</span>
    </span>
  </div>
)

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
    <span style={{ width: 22, height: 1, background: `linear-gradient(90deg,transparent,${GOLD})` }} />
    <span style={{ fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 600 }}>{children}</span>
    <span style={{ width: 22, height: 1, background: `linear-gradient(90deg,${GOLD},transparent)` }} />
  </div>
)

const PhoneFrame = ({ src, alt, max = 250, priority = false, sizes: imgSizes }: { src: string; alt: string; max?: number; priority?: boolean; sizes?: string }) => (
  <div style={{ position: 'relative', width: '100%', maxWidth: max, margin: '0 auto' }}>
    <div style={{ position: 'absolute', inset: -28, background: 'radial-gradient(ellipse 75% 55% at 50% 58%, rgba(61,232,138,0.18) 0%, rgba(232,197,71,0.08) 55%, transparent 78%)', filter: 'blur(18px)', pointerEvents: 'none', zIndex: 0 }} />
    <div style={{ position: 'relative', zIndex: 1, borderRadius: max > 270 ? 38 : 30, padding: max > 270 ? 7 : 6, background: 'linear-gradient(180deg,#1c1d25,#0a0b0e)', border: '1px solid rgba(255,255,255,0.13)', boxShadow: max > 270 ? '0 40px 90px -25px rgba(0,0,0,0.8)' : '0 24px 60px -22px rgba(0,0,0,0.7)' }}>
      <div style={{ borderRadius: max > 270 ? 31 : 25, overflow: 'hidden', background: '#000' }}>
        <NextImage src={src} alt={alt} width={max} height={Math.round(max * 19.5 / 9)} style={{ width: '100%', height: 'auto', display: 'block' }} priority={priority} loading={priority ? undefined : 'lazy'} sizes={imgSizes ?? `${max}px`} />
      </div>
    </div>
  </div>
)

// Hero card composition — drop-in until the user supplies the bare card-art image.
// Crop aggressively to land on the Charizard artwork; gradient masks hide phone chrome.
// All key app metrics float as chips around the card.
const HeroCard = () => (
  <div style={{ position: 'relative', width: '100%', maxWidth: 300, margin: '0 auto' }}>
    {/* Gold/green glow — mirrors the card halo in the iOS app */}
    <div style={{ position: 'absolute', inset: -48, background: 'radial-gradient(ellipse 80% 60% at 50% 42%, rgba(232,197,71,0.30) 0%, rgba(61,232,138,0.13) 52%, transparent 72%)', filter: 'blur(26px)', pointerEvents: 'none', zIndex: 0 }} />

    {/* Card image — bare card art, full bleed */}
    <div style={{ position: 'relative', zIndex: 1, borderRadius: 22, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.11)', boxShadow: '0 36px 90px -22px rgba(0,0,0,0.9)', aspectRatio: '300/420' }}>
      <NextImage src="/screenshots/charizard-card.png" alt="Base Set Charizard" width={300} height={420} style={{ width: '100%', height: 'auto', display: 'block' }} priority sizes="(max-width: 880px) 200px, 300px" />
    </div>

    {/* ── Score ring + verdict — right side, upper ── */}
    <div className="hero-chip" style={{ position: 'absolute', top: 40, right: -138, zIndex: 2, background: 'rgba(10,11,14,0.97)', border: '1px solid rgba(61,232,138,0.18)', borderRadius: 22, padding: '14px 16px', backdropFilter: 'blur(8px)', boxShadow: '0 16px 48px -6px rgba(0,0,0,0.9), 0 0 0 1px rgba(61,232,138,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg viewBox="0 0 90 90" width="90" height="90">
        <defs>
          <linearGradient id="heroRingGrad" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3de88a" />
            <stop offset="65%" stopColor="#2dd67a" />
            <stop offset="100%" stopColor="#1a9956" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle cx="45" cy="45" r="36" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
        <circle cx="45" cy="45" r="36" fill="none" stroke="url(#heroRingGrad)" strokeWidth="7" strokeLinecap="round" strokeDasharray="177 226" transform="rotate(-90 45 45)" />
        <text x="45" y="45" textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="700" fill="#eeeef8" fontFamily="Helvetica Neue,Helvetica,Arial,sans-serif">80</text>
      </svg>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, padding: '5px 14px', borderRadius: 8, background: 'rgba(61,232,138,0.12)', border: '1px solid rgba(61,232,138,0.32)', color: GREEN }}>BUY</span>
    </div>

    {/* ── Market price — below card, left corner ── */}
    <div className="hero-chip" style={{ position: 'absolute', bottom: -32, left: 12, zIndex: 2, background: 'rgba(10,11,14,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '12px 16px', backdropFilter: 'blur(8px)', boxShadow: '0 16px 48px -6px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.03)' }}>
      <div style={{ fontSize: 9, color: '#50506a', letterSpacing: 1.5, marginBottom: 5 }}>MARKET PRICE</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#eeeef8', letterSpacing: -1, lineHeight: 1 }}>A$1,142</div>
      <div style={{ fontSize: 11, color: GREEN, marginTop: 5, fontWeight: 600 }}>↑ +47.0% (30d)</div>
    </div>

    {/* ── Trend — above card, right corner ── */}
    <div className="hero-chip" style={{ position: 'absolute', top: -20, right: 12, zIndex: 2, background: 'rgba(10,11,14,0.97)', border: '1px solid rgba(61,232,138,0.22)', borderRadius: 14, padding: '9px 15px', backdropFilter: 'blur(8px)', boxShadow: '0 12px 36px -6px rgba(0,0,0,0.85), 0 0 0 1px rgba(61,232,138,0.05)' }}>
      <div style={{ fontSize: 9, color: '#50506a', letterSpacing: 1.5, marginBottom: 3 }}>TREND</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: GREEN }}>Strong ↑</div>
    </div>

    {/* ── Liquidity — right side, below score ring ── */}
    <div className="hero-chip" style={{ position: 'absolute', top: 220, right: -160, zIndex: 2, width: 200, background: 'rgba(10,11,14,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '13px 15px', backdropFilter: 'blur(8px)', boxShadow: '0 16px 48px -6px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.03)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: '#50506a', letterSpacing: 1.5, marginBottom: 4 }}>LIQUIDITY</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: GREEN, letterSpacing: -0.5 }}>High</div>
        </div>
        <div style={{ fontSize: 10, color: '#50506a', textAlign: 'right', lineHeight: 1.6, marginTop: 2 }}>103 sales<br/>/ 30d</div>
      </div>
      <div style={{ display: 'flex', gap: 4, height: 20, marginBottom: 9 }}>
        {[0.65, 0.8, 0.72, 0.9, 1].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h * 100}%`, alignSelf: 'flex-end', background: GREEN, borderRadius: 3, opacity: 0.7 + i * 0.06 }} />
        ))}
      </div>
      <div style={{ fontSize: 10, color: '#50506a', lineHeight: 1.55 }}>High liquidity — easy to buy or sell quickly at market price.</div>
    </div>

    {/* ── MOBILE CHIPS (hidden on desktop, shown on mobile) ── */}

    {/* Mobile: Score ring + BUY */}
    <div className="hero-chip-sm" style={{ display: 'none', position: 'absolute', top: 22, right: -36, zIndex: 2, background: 'rgba(10,11,14,0.97)', border: '1px solid rgba(61,232,138,0.18)', borderRadius: 16, padding: '10px 11px', backdropFilter: 'blur(8px)', boxShadow: '0 12px 36px -6px rgba(0,0,0,0.9)', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg viewBox="0 0 90 90" width="60" height="60">
        <defs>
          <linearGradient id="heroRingGradSm" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3de88a" />
            <stop offset="65%" stopColor="#2dd67a" />
            <stop offset="100%" stopColor="#1a9956" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle cx="45" cy="45" r="36" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
        <circle cx="45" cy="45" r="36" fill="none" stroke="url(#heroRingGradSm)" strokeWidth="7" strokeLinecap="round" strokeDasharray="177 226" transform="rotate(-90 45 45)" />
        <text x="45" y="45" textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="700" fill="#eeeef8" fontFamily="Helvetica Neue,Helvetica,Arial,sans-serif">80</text>
      </svg>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: '4px 10px', borderRadius: 6, background: 'rgba(61,232,138,0.12)', border: '1px solid rgba(61,232,138,0.32)', color: GREEN }}>BUY</span>
    </div>

    {/* Mobile: Trend */}
    <div className="hero-chip-sm" style={{ display: 'none', position: 'absolute', top: -14, right: 10, zIndex: 2, background: 'rgba(10,11,14,0.97)', border: '1px solid rgba(61,232,138,0.22)', borderRadius: 11, padding: '7px 11px', backdropFilter: 'blur(8px)', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.85)' }}>
      <div style={{ fontSize: 7, color: '#50506a', letterSpacing: 1.5, marginBottom: 2 }}>TREND</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>Strong ↑</div>
    </div>

    {/* Mobile: Market price */}
    <div className="hero-chip-sm" style={{ display: 'none', position: 'absolute', bottom: -14, left: 6, zIndex: 2, background: 'rgba(10,11,14,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '9px 12px', backdropFilter: 'blur(8px)', boxShadow: '0 12px 36px -6px rgba(0,0,0,0.9)' }}>
      <div style={{ fontSize: 8, color: '#50506a', letterSpacing: 1.5, marginBottom: 3 }}>MARKET PRICE</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: '#eeeef8', letterSpacing: -0.5, lineHeight: 1 }}>A$1,142</div>
      <div style={{ fontSize: 9, color: GREEN, marginTop: 3, fontWeight: 600 }}>↑ +47.0% (30d)</div>
    </div>

    {/* Mobile: Liquidity compact */}
    <div className="hero-chip-sm" style={{ display: 'none', position: 'absolute', left: -36, top: 105, zIndex: 2, width: 130, background: 'rgba(10,11,14,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '10px 12px', backdropFilter: 'blur(8px)', boxShadow: '0 12px 36px -6px rgba(0,0,0,0.9)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 7, color: '#50506a', letterSpacing: 1.5, marginBottom: 3 }}>LIQUIDITY</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: GREEN, letterSpacing: -0.3 }}>High</div>
        </div>
        <div style={{ fontSize: 8, color: '#50506a', textAlign: 'right', lineHeight: 1.5 }}>103<br/>sales</div>
      </div>
      <div style={{ display: 'flex', gap: 3, height: 14 }}>
        {[0.65, 0.8, 0.72, 0.9, 1].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h * 100}%`, alignSelf: 'flex-end', background: GREEN, borderRadius: 2, opacity: 0.7 + i * 0.06 }} />
        ))}
      </div>
    </div>
  </div>
)

const FEATURES = [
  { c: GREEN, d: 'M9 12l2 2 4-4|M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', t: 'Verdict engine', b: 'Buy, accumulate, hold, reduce or avoid — scored from real sales.' },
  { c: GOLD, d: 'M9 2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z|M9 7h6|M9 11h6|M9 15h2', t: 'Price check', b: "Enter an asking price — see if it's a steal, fair, or overpriced." },
  { c: GREEN, d: 'M3 3v18h18|M19 9l-5 5-4-4-3 3', t: 'Analysis', b: 'Price cycles, volatility, volume and the PSA 10 premium.' },
  { c: GOLD, d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z|M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', t: 'Watchlists & alerts', b: 'Track cards, get pinged on price targets and verdict changes.' },
  { c: GREEN, d: 'M2 7h20v14H2z|M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', t: 'Portfolio', b: 'Value your collection and watch gains and losers live.' },
  { c: GOLD, d: 'M8 3L4 7l4 4|M4 7h16|M16 21l4-4-4-4|M20 17H4', t: 'Compare & share', b: 'Put cards head-to-head and share clean verdict cards anywhere.' },
]

const PLANS = [
  { name: 'Free', price: '$0', sub: 'forever', accent: '#b8b8d0', feats: ['Card search & prices', 'Market tab', 'Recently viewed', '5-card watchlist'] },
  { name: 'Standard', price: '$9', per: ' /mo', sub: 'or $84/yr · save 22%', accent: '#b8b8d0', feats: ['Everything in Free', '30-card watchlist', 'Price check', 'Analysis tab'] },
  { name: 'Pro', price: '$19', per: ' /mo', sub: 'or $180/yr · save 21%', accent: GOLD, popular: true, feats: ['Everything in Standard', '100 cards · multiple lists', 'Multiple portfolios', 'Compare & share'] },
]

// Verdict labels + colours mirror the app's cardSignal() exactly.
const VERDICTS = [
  { label: 'BUY', color: '#3de88a', bg: 'rgba(61,232,138,0.12)', border: 'rgba(61,232,138,0.35)', desc: 'Strong score with momentum on its side.' },
  { label: 'ACCUMULATE', color: '#a8e88a', bg: 'rgba(168,232,138,0.09)', border: 'rgba(168,232,138,0.25)', desc: 'Solid fundamentals — worth building a position.' },
  { label: 'HOLD', color: '#8c8cb4', bg: 'rgba(140,140,180,0.10)', border: 'rgba(140,140,180,0.22)', desc: 'Fairly priced right now. Sit tight.' },
  { label: 'REDUCE', color: '#e8746e', bg: 'rgba(232,82,74,0.08)', border: 'rgba(232,82,74,0.25)', desc: 'Momentum cooling — consider trimming.' },
  { label: 'AVOID', color: '#e8524a', bg: 'rgba(232,82,74,0.10)', border: 'rgba(232,82,74,0.30)', desc: 'Weak signals. Better options elsewhere.' },
]

export default function Home() {
  return (
    <>
      <Navbar />
      {/* Always-dark, Helvetica Neue — pinned to the iOS app's exact tokens so the
          marketing page is a faithful match (and a solid base hides the global
          body grid; the app is flat dark with soft glows, not gridded). */}
      <main style={{ background: '#0b0c0f', position: 'relative', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '104px 24px 64px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 35% 38%, rgba(232,197,71,0.10) 0%, transparent 62%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 50% at 88% 62%, rgba(61,232,138,0.08) 0%, transparent 62%)', pointerEvents: 'none' }} />
          <div className="hero-grid" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1040, display: 'grid', gridTemplateColumns: '1fr 460px', gap: 40, alignItems: 'center' }}>
            <div>
              <div className="anim d1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 99, padding: '6px 13px', marginBottom: 24, background: 'rgba(232,197,71,0.07)', border: '1px solid rgba(232,197,71,0.35)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, boxShadow: `0 0 8px ${GREEN}` }} />
                <span style={{ fontSize: 10, color: GOLD, letterSpacing: 1.5, fontWeight: 600 }}>TCG MARKET INTELLIGENCE</span>
              </div>
              <h1 className="anim d2" style={{ fontSize: 'clamp(38px,6vw,60px)', fontWeight: 800, lineHeight: 1.03, letterSpacing: '-2px', color: '#eeeef8', marginBottom: 18 }}>
                Know what your cards are<span className="mobile-break" /> <span style={{ color: GOLD }}>actually</span> worth.
              </h1>
              <p className="anim d3" style={{ fontSize: 16, color: '#b8b8d0', maxWidth: 460, lineHeight: 1.65, marginBottom: 30 }}>
                Live market prices, a buy/hold/avoid verdict on every card, and price checks that tell you exactly what&apos;s a fair deal — before you spend a cent.
              </p>
              <div className="anim d4 hero-cta" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
                <ComingSoonBadge />
              </div>
              <div className="anim d5 hero-trust" style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 12, color: '#eeeef8', flexWrap: 'wrap' }}>
                <span><span style={{ color: GREEN }}>✓</span> Free to start</span>
                <span><span style={{ color: GREEN }}>✓</span> 14-day Pro trial</span>
                <span><span style={{ color: GREEN }}>✓</span> No card needed</span>
              </div>
            </div>
            <div className="hero-phone anim d3">
              <HeroCard />
            </div>
          </div>
        </section>

        {/* ── Stat strip ─────────────────────────────────────────── */}
        <div style={{ position: 'relative', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(70% 140% at 50% 0%, rgba(232,197,71,0.06), transparent 70%)', pointerEvents: 'none' }} />
          <div className="stat-strip" style={{ position: 'relative', maxWidth: 1040, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
            {[
              { c: GOLD, d: 'M3 5h14v16H3z|M7 5V3h14v16h-2', n: '20k+', l: 'Cards tracked' },
              { c: GREEN, d: 'M21 12a9 9 0 1 1-3-6.7L21 8|M21 3v5h-5', n: 'Daily', l: 'Price updates' },
              { c: GOLD, d: 'M5 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1z|M9 8h6|M9 12h6', n: 'Real sales', l: 'Behind every verdict' },
            ].map((s, i) => (
              <div key={s.l} className="stat-item" style={{ padding: '26px 26px', display: 'flex', alignItems: 'center', gap: 15, borderRight: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div className="stat-icon" style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.c, background: i % 2 ? 'rgba(61,232,138,0.12)' : 'rgba(232,197,71,0.12)', border: `1px solid ${i % 2 ? 'rgba(61,232,138,0.22)' : 'rgba(232,197,71,0.22)'}` }}>
                  <Ico d={s.d} size={23} />
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1, color: '#eeeef8' }}>{s.n}</div>
                  <div style={{ fontSize: 12, color: '#50506a', marginTop: 6 }}>{s.l}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── How it works ───────────────────────────────────────── */}
        <section style={{ padding: '72px 24px 8px', maxWidth: 1040, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <Eyebrow>HOW IT WORKS</Eyebrow>
            <h2 style={{ fontSize: 'clamp(26px,4vw,32px)', fontWeight: 800, color: '#eeeef8', letterSpacing: '-1px' }}>From card to call in seconds</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
            {[
              { n: '01', t: 'Search any card', b: 'Find any card and grade in seconds — thousands indexed and growing.' },
              { n: '02', t: 'See the verdict & price', b: 'A clear buy/hold/avoid call backed by real sales, plus a price check on any listing.' },
              { n: '03', t: 'Decide with confidence', b: 'Watch it, add it to your portfolio, or walk away — no more guessing.' },
            ].map((s) => (
              <div key={s.n} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: '24px 22px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-2px', lineHeight: 1, marginBottom: 16, color: GOLD }}>{s.n}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#eeeef8', marginBottom: 8 }}>{s.t}</div>
                <p style={{ fontSize: 13, color: '#b8b8d0', lineHeight: 1.65 }}>{s.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── See it in action (real screenshots) ────────────────── */}
        <section style={{ padding: '72px 24px 8px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <Eyebrow>SEE IT IN ACTION</Eyebrow>
            <h2 style={{ fontSize: 'clamp(26px,4vw,32px)', fontWeight: 800, color: '#eeeef8', letterSpacing: '-1px' }}>A verdict, a price check, your whole collection.</h2>
          </div>
          <div className="shots-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28, maxWidth: 920, margin: '0 auto' }}>
            {[
              { src: '/screenshots/price-check-umbreon.png', cap: 'Price-check any listing', alt: 'Price check on Umbreon VMAX showing fair value' },
              { src: '/screenshots/portfolio.png', cap: 'Track your collection', alt: 'Portfolio overview with total return and top performers' },
              { src: '/screenshots/analysis-dragonite.png', cap: 'Dive into the signals', alt: 'Analysis tab with score breakdown and risk rating' },
            ].map((s, i) => (
              <div key={s.src} className={i === 0 ? 'shots-last' : ''} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <PhoneFrame src={s.src} alt={s.alt} max={250} sizes="(max-width: 460px) min(280px, calc(100vw - 48px)), (max-width: 880px) calc(50vw - 36px), 250px" />
                <span style={{ fontSize: 13, color: '#b8b8d0', fontWeight: 500 }}>{s.cap}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────── */}
        <section style={{ padding: '72px 24px 8px', maxWidth: 1040, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <Eyebrow>WHAT YOU GET</Eyebrow>
            <h2 style={{ fontSize: 'clamp(26px,4vw,32px)', fontWeight: 800, color: '#eeeef8', letterSpacing: '-1px' }}>Everything to value a card in seconds</h2>
          </div>
          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
            {FEATURES.map((f) => (
              <div key={f.t} className="feature-card" style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 19, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, color: f.c, background: f.c === GREEN ? 'rgba(61,232,138,0.13)' : 'rgba(232,197,71,0.13)', border: `1px solid ${f.c === GREEN ? 'rgba(61,232,138,0.2)' : 'rgba(232,197,71,0.2)'}` }}>
                  <Ico d={f.d} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#eeeef8', marginBottom: 6 }}>{f.t}</div>
                <div style={{ fontSize: 12.5, color: '#50506a', lineHeight: 1.6 }}>{f.b}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Verdict explainer ──────────────────────────────────── */}
        <section style={{ padding: '64px 24px 8px', maxWidth: 1040, margin: '0 auto' }}>
          <div className="verdict-card" style={{ position: 'relative', background: 'linear-gradient(160deg,rgba(255,255,255,0.045),rgba(255,255,255,0.01))', border: CARD_BORDER, borderRadius: 18, padding: 30, display: 'grid', gridTemplateColumns: '160px 1fr', gap: 32, alignItems: 'center', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -70, left: -40, width: 260, height: 260, background: 'radial-gradient(circle,rgba(61,232,138,0.12),transparent 64%)', pointerEvents: 'none' }} />
            <svg viewBox="0 0 132 132" style={{ width: 150, height: 150, justifySelf: 'center', position: 'relative' }}>
              <defs>
                <linearGradient id="ringGrad" x1="1" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
                  <stop offset="0%" stopColor="#3de88a" />
                  <stop offset="60%" stopColor="#2dd67a" />
                  <stop offset="100%" stopColor="#1a9956" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <circle cx="66" cy="66" r="55" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="11" />
              <circle cx="66" cy="66" r="55" fill="none" stroke="url(#ringGrad)" strokeWidth="11" strokeLinecap="round" strokeDasharray="269 346" transform="rotate(-90 66 66)" />
              <text x="66" y="66" textAnchor="middle" dominantBaseline="central" fontSize="35" fontWeight="700" fill="#eeeef8" fontFamily="Helvetica Neue,Helvetica,Arial">80</text>
            </svg>
            <div style={{ position: 'relative' }}>
              <h2 style={{ fontSize: 21, fontWeight: 700, color: '#eeeef8', marginBottom: 6, letterSpacing: '-0.5px' }}>One score. Four signals.</h2>
              <p style={{ fontSize: 13, color: '#50506a', marginBottom: 18 }}>Every verdict is broken down so you can see exactly why.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { l: 'Trend', v: 'Strong', w: 84, c: GREEN },
                  { l: 'Liquidity', v: 'High', w: 72, c: GREEN },
                  { l: 'Consistency', v: 'Steady', w: 66, c: GOLD },
                  { l: 'Value', v: 'Fair', w: 58, c: GOLD },
                ].map((b) => (
                  <div key={b.l}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: '#b8b8d0' }}>{b.l}</span>
                      <span style={{ color: b.c, fontWeight: 600 }}>{b.v}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: 6, width: `${b.w}%`, background: b.c, borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Verdict legend ─────────────────────────────────────── */}
        <section style={{ padding: '64px 24px 8px', maxWidth: 1040, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <Eyebrow>EVERY CARD, A CLEAR CALL</Eyebrow>
            <h2 style={{ fontSize: 'clamp(26px,4vw,32px)', fontWeight: 800, color: '#eeeef8', letterSpacing: '-1px' }}>Five clear calls. No jargon.</h2>
          </div>
          <div className="verdict-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(178px,1fr))', gap: 12 }}>
            {VERDICTS.map((v) => (
              <div key={v.label} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: '22px 18px', textAlign: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, letterSpacing: '0.09em', color: v.color, background: v.bg, border: `1px solid ${v.border}`, marginBottom: 14 }}>{v.label}</span>
                <p style={{ fontSize: 12.5, color: '#b8b8d0', lineHeight: 1.6 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Price Check spotlight ──────────────────────────────── */}
        <section style={{ padding: '64px 24px 8px', maxWidth: 1040, margin: '0 auto' }}>
          <div className="spotlight-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 52, alignItems: 'center' }}>
            <div>
              <Eyebrow>PRICE CHECK</Eyebrow>
              <h2 style={{ fontSize: 'clamp(26px,4vw,34px)', fontWeight: 800, color: '#eeeef8', letterSpacing: '-1px', marginBottom: 14, lineHeight: 1.1 }}>Is it a good deal? Know in one tap.</h2>
              <p style={{ fontSize: 15, color: '#b8b8d0', lineHeight: 1.65, marginBottom: 24, maxWidth: 440 }}>
                Type in any asking price and CardIndex tells you instantly — steal, fair, or overpriced — and re-scores the card for that exact price.
              </p>
              <div className="spotlight-bullets" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {[
                  'Compares your price against the live market',
                  'Re-scores the card and value at your price',
                  'Shows the fair-value range — and where it becomes a buy',
                ].map((li) => (
                  <div key={li} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: '#b8b8d0', lineHeight: 1.5 }}>
                    <span style={{ color: GREEN, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>✓</span>{li}
                  </div>
                ))}
              </div>
            </div>
            <div className="spotlight-phone">
              <PhoneFrame src="/screenshots/price-check-umbreon.png" alt="Price check on Umbreon VMAX showing fair value at your asking price" max={280} sizes="(max-width: 880px) 200px, 280px" />
            </div>
            {/* Mobile-only 3-icon strip below phone */}
            <div className="spotlight-icon-strip" style={{ display: 'none', gap: 10, gridColumn: '1 / -1' }}>
              {[
                { label: 'Live market price' },
                { label: 'Re-scores at your price' },
                { label: 'Fair-value range' },
              ].map((item) => (
                <div key={item.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 8px', textAlign: 'center' }}>
                  <span style={{ color: GREEN, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>✓</span>
                  <span style={{ fontSize: 11, color: '#b8b8d0', lineHeight: 1.45 }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────────────────── */}
        <section id="pricing" style={{ padding: '64px 24px 64px', maxWidth: 1040, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <Eyebrow>PRICING</Eyebrow>
            <h2 style={{ fontSize: 'clamp(26px,4vw,32px)', fontWeight: 800, color: '#eeeef8', letterSpacing: '-1px' }}>Simple pricing</h2>
            <p style={{ fontSize: 13, color: '#50506a', marginTop: 6 }}>Start free. Upgrade when you&apos;re ready.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            {PLANS.map((p) => (
              <div key={p.name} style={{ position: 'relative', background: p.popular ? 'linear-gradient(165deg,rgba(232,197,71,0.14),rgba(255,255,255,0.012))' : CARD_BG, border: p.popular ? `1.5px solid rgba(232,197,71,0.7)` : CARD_BORDER, borderRadius: 16, padding: 21, boxShadow: p.popular ? '0 0 46px -12px rgba(232,197,71,0.45)' : 'none' }}>
                {p.popular && <div style={{ position: 'absolute', top: -10, right: 17, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: '#0b0c0f', background: `linear-gradient(150deg,${GOLD_HI},#e6c038)`, padding: '4px 11px', borderRadius: 8 }}>MOST POPULAR</div>}
                <div className="pricing-inner" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="pricing-price-col">
                    <div style={{ fontSize: 14, fontWeight: 600, color: p.accent }}>{p.name}</div>
                    <div style={{ fontSize: 31, fontWeight: 800, margin: '9px 0 2px', letterSpacing: '-1px', color: '#eeeef8' }}>{p.price}<span style={{ fontSize: 13, color: '#50506a', fontWeight: 400 }}>{p.per ?? ''}</span></div>
                    <div style={{ fontSize: 11, color: '#50506a' }}>{p.sub}</div>
                  </div>
                  <div className="pricing-feat-col" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 17 }}>
                    {p.feats.map((f) => (
                      <span key={f} style={{ fontSize: 12.5, color: '#b8b8d0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: p.accent === GOLD ? GOLD : GREEN, flexShrink: 0 }}>✓</span>{f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 64px', maxWidth: 640, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Eyebrow>FAQ</Eyebrow>
            <h2 style={{ fontSize: 'clamp(26px,4vw,32px)', fontWeight: 800, color: '#eeeef8', letterSpacing: '-1px' }}>Questions, answered</h2>
          </div>
          <HomeFAQ />
        </section>

        {/* ── CTA band ───────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 80px', maxWidth: 1040, margin: '0 auto' }}>
          <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(232,197,71,0.28)', padding: '56px 40px', textAlign: 'center', boxShadow: '0 0 100px -30px rgba(232,197,71,0.22), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 120% at 15% 50%, rgba(232,197,71,0.16) 0%, transparent 60%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 120% at 85% 50%, rgba(61,232,138,0.10) 0%, transparent 60%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(232,197,71,0.04) 0%, transparent 50%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: GOLD, fontWeight: 600, marginBottom: 18 }}>START FOR FREE</div>
              <h2 style={{ fontSize: 'clamp(30px,5vw,46px)', fontWeight: 800, color: '#eeeef8', letterSpacing: '-2px', marginBottom: 12, lineHeight: 1.03 }}>Stop guessing.<br />Start valuing.</h2>
              <p style={{ fontSize: 15, color: '#b8b8d0', marginBottom: 28, maxWidth: 340, margin: '0 auto 28px' }}>Get a verdict on your first card in under a minute.</p>
              <div style={{ display: 'inline-flex' }}><ComingSoonBadge /></div>
            </div>
          </div>
        </section>

        <Footer />
      </main>

      <style>{`
        .mobile-break { display: none; }
        @media (max-width: 880px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 56px !important; justify-items: center; text-align: center; }
          .hero-grid p { margin-left: auto; margin-right: auto; }
          .hero-cta { justify-content: center !important; }
          .hero-trust { justify-content: center !important; }
          .hero-phone { max-width: 200px !important; }
          .hero-chip { display: none !important; }
          .hero-chip-sm { display: flex !important; }
          .mobile-break { display: block; height: 0; }
          .verdict-card { grid-template-columns: 1fr !important; gap: 22px !important; }
          .spotlight-grid { grid-template-columns: 1fr !important; gap: 24px !important; justify-items: center; text-align: center; }
          .spotlight-grid p { margin-left: auto; margin-right: auto; }
          .spotlight-phone { max-width: 200px !important; }
          section { text-align: center; }
          section p, section h2, section h3, section h4 { margin-left: auto; margin-right: auto; }
          .feature-card { display: flex; flex-direction: column; align-items: center; }
          .spotlight-bullets { text-align: left !important; align-items: flex-start !important; }
          .spotlight-bullets > div { justify-content: flex-start !important; }
          .spotlight-bullets { display: none !important; }
          .spotlight-icon-strip { display: flex !important; }
        }
        @media (max-width: 760px) {
          .stat-strip > div { border-right: none !important; border-bottom: none !important; border-right: 1px solid rgba(255,255,255,0.05) !important; flex-direction: column !important; align-items: center !important; text-align: center !important; padding: 16px 8px !important; gap: 8px !important; }
          .stat-strip > div:last-child { border-right: none !important; }
          .stat-item .stat-icon { width: 36px !important; height: 36px !important; border-radius: 10px !important; }
          .verdict-grid { grid-template-columns: 1fr 1fr !important; }
          .verdict-grid > div:first-child { grid-column: 1 / -1 !important; }
          .features-grid { grid-template-columns: 1fr 1fr !important; }
          .shots-last { display: none !important; }
          .shots-grid { grid-template-columns: 1fr 1fr !important; }
          .pricing-inner { flex-direction: row !important; align-items: flex-start; gap: 14px; }
          .pricing-price-col { flex-shrink: 0; min-width: 80px; padding-right: 14px; border-right: 1px solid rgba(255,255,255,0.07); }
          .pricing-feat-col { margin-top: 0 !important; }
        }
        @media (max-width: 460px) { .shots-grid { grid-template-columns: 1fr !important; max-width: 280px; margin: 0 auto; } }
      `}</style>
    </>
  )
}
