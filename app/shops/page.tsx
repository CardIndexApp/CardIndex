'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const GOLD = '#e8c547'
const CARD_BG = 'linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.012))'
const CARD_BORDER = '1px solid rgba(255,255,255,0.08)'

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
      <span style={{ width: 22, height: 1, background: `linear-gradient(90deg,transparent,${GOLD})` }} />
      <span style={{ fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 600 }}>{children}</span>
      <span style={{ width: 22, height: 1, background: `linear-gradient(90deg,${GOLD},transparent)` }} />
    </div>
  )
}

const steps = [
  {
    n: '01',
    title: 'Search your card',
    body: 'Find any Pokémon card in the CardIndex database. Every graded and raw card is covered.',
    icon: '🔍',
  },
  {
    n: '02',
    title: 'Print a QR sticker',
    body: 'Generate a print-ready QR sticker from your shop dashboard. Stick it on the case, sleeve, or display.',
    icon: '🖨️',
  },
  {
    n: '03',
    title: 'Customers scan live prices',
    body: 'Every scan shows the current market price, trend direction, and recent sales — updated automatically.',
    icon: '📱',
  },
]

const features = [
  {
    icon: '📈',
    title: 'Always up-to-date pricing',
    body: 'No manual repricing. Prices sync from live market data so your stickers are never out of date.',
  },
  {
    icon: '🏪',
    title: 'Shop dashboard',
    body: 'Manage your entire inventory, override prices for individual cards, and track what your customers are scanning.',
  },
  {
    icon: '🖨️',
    title: 'Print-ready sticker sheets',
    body: 'Generate formatted sheets optimised for Avery labels and standard sticker printers.',
  },
  {
    icon: '💰',
    title: 'Set your own price',
    body: 'Override the market price with your own — the QR page shows both so customers understand the value.',
  },
  {
    icon: '📊',
    title: 'Scan analytics',
    body: 'See which cards customers are looking at most so you know what to stock next.',
  },
  {
    icon: '🔗',
    title: 'Your branding',
    body: 'QR landing pages carry your shop name so every scan reinforces your brand.',
  },
]

export default function ShopsPage() {
  const [email, setEmail] = useState('')
  const [shopName, setShopName] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/shops/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, shop_name: shopName, message }),
      })
      setStatus(res.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <Navbar />
      <main style={{ background: '#09090f', minHeight: '100vh', color: '#e8e8f0', fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif' }}>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section style={{ paddingTop: 120, paddingBottom: 80, textAlign: 'center', padding: '120px 24px 80px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(232,197,71,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
            <Eyebrow>FOR CARD SHOPS</Eyebrow>
            <h1 style={{ fontSize: 'clamp(32px, 6vw, 58px)', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.08, margin: '0 0 20px', color: '#f2f2f3' }}>
              Turn every card into<br />
              <span style={{ color: GOLD }}>a live price tag</span>
            </h1>
            <p style={{ fontSize: 17, color: '#a0a0c0', lineHeight: 1.7, maxWidth: 520, margin: '0 auto 40px' }}>
              Print QR stickers for your display cases. Customers scan to see real-time market prices, recent sales, and trend data — no repricing, no spreadsheets.
            </p>
            <a
              href="#waitlist"
              style={{ display: 'inline-block', padding: '14px 36px', background: GOLD, color: '#09090f', fontWeight: 800, fontSize: 15, borderRadius: 14, textDecoration: 'none', letterSpacing: '-0.2px' }}
            >
              Join the waitlist
            </a>
          </div>
        </section>

        {/* ── QR preview mockup ─────────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 80px', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 24, padding: '40px 32px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 40, justifyContent: 'center' }}>
            {/* Sticker mockup */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 120, height: 120, background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                {/* QR pattern placeholder */}
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <rect x="4" y="4" width="28" height="28" rx="3" fill="#09090f"/>
                  <rect x="10" y="10" width="16" height="16" rx="1" fill="#fff"/>
                  <rect x="48" y="4" width="28" height="28" rx="3" fill="#09090f"/>
                  <rect x="54" y="10" width="16" height="16" rx="1" fill="#fff"/>
                  <rect x="4" y="48" width="28" height="28" rx="3" fill="#09090f"/>
                  <rect x="10" y="54" width="16" height="16" rx="1" fill="#fff"/>
                  <rect x="42" y="42" width="8" height="8" fill="#09090f"/>
                  <rect x="54" y="42" width="8" height="8" fill="#09090f"/>
                  <rect x="66" y="42" width="8" height="8" fill="#09090f"/>
                  <rect x="42" y="54" width="8" height="8" fill="#09090f"/>
                  <rect x="66" y="54" width="8" height="8" fill="#09090f"/>
                  <rect x="42" y="66" width="8" height="8" fill="#09090f"/>
                  <rect x="54" y="66" width="8" height="8" fill="#09090f"/>
                  <rect x="66" y="66" width="8" height="8" fill="#09090f"/>
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#7b7b82', fontWeight: 600 }}>SCAN FOR PRICE</div>
                <div style={{ fontSize: 10, color: '#5a5a6a' }}>Powered by CardIndex</div>
              </div>
            </div>

            {/* Arrow */}
            <div style={{ fontSize: 28, color: '#3a3a4a' }}>→</div>

            {/* Phone scan result mockup */}
            <div style={{ background: '#13131f', border: '1px solid #2a2a3d', borderRadius: 20, padding: '20px 24px', minWidth: 220, maxWidth: 280 }}>
              <div style={{ fontSize: 11, color: '#7b7b82', marginBottom: 4 }}>Charizard VMAX · PSA 10</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: GOLD, letterSpacing: '-1px' }}>A$420.00</div>
              <div style={{ fontSize: 12, color: '#3de88a', marginBottom: 16 }}>▲ 8.2% this week</div>
              <div style={{ height: 1, background: '#2a2a3d', marginBottom: 12 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#7b7b82' }}>30-day avg</span>
                <span style={{ color: '#e8e8f0' }}>A$398</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                <span style={{ color: '#7b7b82' }}>Recent sales</span>
                <span style={{ color: '#e8e8f0' }}>14 this week</span>
              </div>
              <div style={{ marginTop: 14, padding: '8px 12px', background: 'rgba(232,197,71,0.08)', border: '1px solid rgba(232,197,71,0.2)', borderRadius: 10, textAlign: 'center', fontSize: 12, color: GOLD, fontWeight: 700 }}>
                Shop price: A$449
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 80px', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <Eyebrow>HOW IT WORKS</Eyebrow>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 48px', color: '#f2f2f3' }}>Three steps to smarter pricing</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {steps.map(s => (
              <div key={s.n} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 20, padding: '28px 24px', textAlign: 'left' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{s.icon}</div>
                <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>{s.n}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f2f2f3', marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: '#a0a0c0', lineHeight: 1.6 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 80px', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <Eyebrow>FEATURES</Eyebrow>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 48px', color: '#f2f2f3' }}>Built for the way shops work</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {features.map(f => (
              <div key={f.title} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: '24px 20px', textAlign: 'left' }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f2f2f3', marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: '#a0a0c0', lineHeight: 1.6 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Use cases ─────────────────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 80px', maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <Eyebrow>PERFECT FOR</Eyebrow>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 16 }}>
            {['Local game stores', 'Market stalls', 'Card expos', 'Display cases', 'Online shops with physical pickups', 'Pop-up events'].map(tag => (
              <span key={tag} style={{ padding: '8px 16px', background: 'rgba(232,197,71,0.06)', border: '1px solid rgba(232,197,71,0.18)', borderRadius: 100, fontSize: 13, color: '#c8c8a0', fontWeight: 500 }}>
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* ── Waitlist form ─────────────────────────────────────────────────── */}
        <section id="waitlist" style={{ padding: '0 24px 120px', maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
          <Eyebrow>EARLY ACCESS</Eyebrow>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 12px', color: '#f2f2f3' }}>Get early access</h2>
          <p style={{ fontSize: 14, color: '#a0a0c0', marginBottom: 32, lineHeight: 1.6 }}>
            We're rolling out to shops in early 2027. Leave your details and we'll reach out first.
          </p>

          {status === 'done' ? (
            <div style={{ background: 'rgba(61,232,138,0.06)', border: '1px solid rgba(61,232,138,0.2)', borderRadius: 16, padding: '28px 24px' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#3de88a', marginBottom: 4 }}>You're on the list</div>
              <div style={{ fontSize: 13, color: '#a0a0c0' }}>We'll be in touch when shop access opens.</div>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="Shop name"
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                style={{ width: '100%', padding: '13px 16px', background: '#13131f', border: '1px solid #2a2a3d', borderRadius: 12, color: '#f2f2f3', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '13px 16px', background: '#13131f', border: '1px solid #2a2a3d', borderRadius: 12, color: '#f2f2f3', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              <textarea
                placeholder="Anything else you'd like us to know? (optional)"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '13px 16px', background: '#13131f', border: '1px solid #2a2a3d', borderRadius: 12, color: '#f2f2f3', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              {status === 'error' && (
                <div style={{ fontSize: 13, color: '#e8524a' }}>Something went wrong — please try again.</div>
              )}
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{ padding: '14px 0', background: GOLD, color: '#09090f', fontWeight: 800, fontSize: 15, borderRadius: 12, border: 'none', cursor: status === 'loading' ? 'not-allowed' : 'pointer', opacity: status === 'loading' ? 0.7 : 1 }}
              >
                {status === 'loading' ? 'Submitting…' : 'Join the waitlist'}
              </button>
            </form>
          )}
        </section>

      </main>
      <Footer />
    </>
  )
}
