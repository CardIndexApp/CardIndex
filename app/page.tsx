'use client'
import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Ticker from '@/components/Ticker'
import CardPreview from '@/components/CardPreview'
import CardSearch from '@/components/CardSearch'
import AuthModal from '@/components/AuthModal'
import { cards } from '@/lib/data'

export default function Home() {
  const [modal, setModal] = useState(false)

  return (
    <>
      <Navbar />
      {modal && <AuthModal mode="signup" onClose={() => setModal(false)} />}
      <main>
        {/* Hero */}
        <section className="grid-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 24px 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(232,197,71,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 720, width: '100%' }}>
            <div className="anim d1" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 99, padding: '4px 12px', marginBottom: 32, background: 'var(--gold2)', border: '1px solid rgba(232,197,71,0.2)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }} />
              <span className="font-mono-custom" style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2 }}>LIVE MARKET DATA</span>
            </div>
            <h1 className="font-display anim d2" style={{ fontSize: 'clamp(40px,7vw,76px)', fontWeight: 800, lineHeight: 1, letterSpacing: '-2px', color: 'var(--ink)', marginBottom: 12 }}>
              The market index<br /><span style={{ color: 'var(--gold)' }}>for trading cards</span>
            </h1>
            <p className="font-mono-custom anim d3" style={{ fontSize: 11, color: 'var(--ink3)', letterSpacing: 3, margin: '0 auto 32px', textTransform: 'uppercase' }}>
              Card Market Intelligence
            </p>
            <div className="anim d4">
              <CardSearch />
            </div>
            <div className="anim d5" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <a href="#featured" style={{ padding: '11px 24px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Explore Market</a>
              <button onClick={() => setModal(true)} style={{ padding: '11px 24px', borderRadius: 12, background: 'var(--gold)', color: '#080810', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Get started free →</button>
            </div>
          </div>
          <div className="anim d6" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 720, margin: '64px auto 0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, borderRadius: 16, overflow: 'hidden', background: 'var(--border)' }}>
            {[{ label: 'Cards tracked', value: '60,000+' }, { label: 'Data sources', value: 'eBay · TCGPlayer · PWCC' }, { label: 'Analysis time', value: '< 2 seconds' }].map((s, i) => (
              <div key={i} style={{ padding: '20px 24px', textAlign: 'center', background: 'var(--surface)' }}>
                <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <Ticker />

        {/* Featured */}
        <section id="featured" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
            <div>
              <p className="font-mono-custom" style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8 }}>FEATURED CARDS</p>
              <h2 className="font-display" style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-1px' }}>Market highlights</h2>
            </div>
            <a href="/market" style={{ fontSize: 13, color: 'var(--ink3)', textDecoration: 'none' }}>View all →</a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {cards.map(card => <CardPreview key={card.id} card={card} />)}
          </div>
        </section>

        {/* Features */}
        <section style={{ padding: '0 24px 80px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[
              { icon: '📊', title: 'CardIndex Score', body: 'A composite 0–100 score measuring growth, liquidity, volatility, and collector demand for any card.' },
              { icon: '📈', title: 'Market Verdicts', body: 'Plain-language analysis backed by real transaction data and trend signals. Know when to buy and sell.' },
              { icon: '🕒', title: 'Price History', body: 'Up to 12 months of historical price data with daily snapshots, sales volume, and trend indicators.' },
            ].map((f, i) => (
              <div key={i} style={{ borderRadius: 16, padding: 24, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>{f.icon}</div>
                <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{f.title}</div>
                <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', borderRadius: 24, padding: 56, background: 'var(--surface)', border: '1px solid var(--border2)' }}>
            <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2, marginBottom: 16 }}>FREE TO START</p>
            <h2 className="font-display" style={{ fontSize: 30, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 12 }}>Start tracking the market</h2>
            <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 28 }}>CardIndex is free to use. No credit card required.</p>
            <button onClick={() => setModal(true)} style={{ padding: '12px 32px', borderRadius: 12, background: 'var(--gold)', color: '#080810', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Create free account →</button>
          </div>
        </section>

        <footer style={{ borderTop: '1px solid var(--border)', padding: '24px', textAlign: 'center' }}>
          <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Card<span style={{ color: 'var(--gold)' }}>Index</span></div>
          <p style={{ fontSize: 11, color: 'var(--ink3)' }}>© 2026 card-index.app — The market index for trading cards</p>
        </footer>
      </main>
    </>
  )
}
