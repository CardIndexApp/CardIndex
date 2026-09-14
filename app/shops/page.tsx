'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const GOLD = '#e8c547'
const GREEN = '#3de88a'
const RED = '#e8524a'

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
      <span style={{ width: 22, height: 1, background: `linear-gradient(90deg,transparent,${GOLD})` }} />
      <span style={{ fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 600 }}>{children}</span>
      <span style={{ width: 22, height: 1, background: `linear-gradient(90deg,${GOLD},transparent)` }} />
    </div>
  )
}

function QRPattern() {
  return (
    <svg width="64" height="64" viewBox="0 0 80 80" fill="none">
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
  )
}

// ── Shop Dashboard Mockup ─────────────────────────────────────────────────────
function ShopDashboardMockup() {
  const inventory = [
    { name: 'Charizard VMAX', set: 'Sword & Shield', grade: 'PSA 10', market: 'A$420', shopPrice: 'A$449', scans: 38, trend: '+8.2%', up: true },
    { name: 'Pikachu V-Union', set: 'SWSH Promos', grade: 'Raw NM', market: 'A$62', shopPrice: 'A$68', scans: 14, trend: '+2.1%', up: true },
    { name: 'Umbreon VMAX', set: 'Evolving Skies', grade: 'PSA 9', market: 'A$195', shopPrice: 'A$210', scans: 22, trend: '-1.4%', up: false },
    { name: 'Lugia V', set: 'Silver Tempest', grade: 'Raw NM', market: 'A$28', shopPrice: 'A$32', scans: 9, trend: '+0.5%', up: true },
  ]

  return (
    <div style={{ background: '#0d0d16', border: '1px solid #2a2a3d', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)', maxWidth: 780, margin: '0 auto' }}>
      {/* Titlebar */}
      <div style={{ background: '#13131f', borderBottom: '1px solid #1e1e2e', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ffbd2e' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28ca41' }} />
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#5a5a6a', fontWeight: 600 }}>CardIndex for Shops — Dashboard</div>
      </div>

      {/* Sidebar + Content */}
      <div style={{ display: 'flex', minHeight: 400 }}>
        {/* Sidebar */}
        <div style={{ width: 160, background: '#0a0a12', borderRight: '1px solid #1a1a2a', padding: '16px 0', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ padding: '8px 16px', fontSize: 11, color: '#4a4a5a', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>SHOP</div>
          {[
            { icon: '📦', label: 'Inventory', active: true },
            { icon: '🖨️', label: 'Print Labels' },
            { icon: '📊', label: 'Scan Analytics' },
            { icon: '💰', label: 'Pricing' },
            { icon: '⚙️', label: 'Settings' },
          ].map(item => (
            <div key={item.label} style={{ padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8, background: item.active ? 'rgba(232,197,71,0.08)' : 'transparent', borderLeft: item.active ? `2px solid ${GOLD}` : '2px solid transparent', cursor: 'pointer' }}>
              <span style={{ fontSize: 13 }}>{item.icon}</span>
              <span style={{ fontSize: 12, color: item.active ? GOLD : '#6a6a7a', fontWeight: item.active ? 700 : 400 }}>{item.label}</span>
            </div>
          ))}
          <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid #1a1a2a' }}>
            <div style={{ fontSize: 11, color: '#4a4a5a' }}>PokeZone Melbourne</div>
            <div style={{ fontSize: 10, color: '#3a3a4a', marginTop: 2 }}>Pro Plan</div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: '20px', overflowX: 'auto' }}>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Cards Listed', value: '142', sub: '+6 this week' },
              { label: 'Scans Today', value: '83', sub: '↑ 12 from yesterday', green: true },
              { label: 'Avg Shop Margin', value: '8.4%', sub: 'vs market price' },
            ].map(s => (
              <div key={s.label} style={{ background: '#13131f', border: '1px solid #1e1e2e', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: '#5a5a6a', marginBottom: 4, fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f2f2f3', letterSpacing: '-0.5px' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: s.green ? GREEN : '#5a5a6a', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Inventory table */}
          <div style={{ background: '#13131f', border: '1px solid #1e1e2e', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#d0d0e0' }}>Inventory</span>
              <button style={{ padding: '5px 12px', background: GOLD, color: '#09090f', fontSize: 10, fontWeight: 800, borderRadius: 8, border: 'none', cursor: 'pointer' }}>+ Add Card</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a2a' }}>
                  {['Card', 'Grade', 'Market', 'Your Price', 'Scans', 'Trend', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', fontSize: 9, color: '#4a4a5a', fontWeight: 700, textAlign: 'left', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventory.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < inventory.length - 1 ? '1px solid #141420' : 'none' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#e8e8f0' }}>{row.name}</div>
                      <div style={{ fontSize: 9, color: '#4a4a5a' }}>{row.set}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#a0a0c0' }}>{row.grade}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#a0a0c0', fontWeight: 600 }}>{row.market}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: GOLD, fontWeight: 700 }}>{row.shopPrice}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#a0a0c0' }}>{row.scans}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: row.up ? GREEN : RED, fontWeight: 600 }}>{row.trend}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ width: 22, height: 22, background: '#fff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="12" height="12" viewBox="0 0 80 80" fill="none">
                            <rect x="4" y="4" width="28" height="28" rx="2" fill="#09090f"/>
                            <rect x="10" y="10" width="16" height="16" rx="1" fill="#fff"/>
                            <rect x="48" y="4" width="28" height="28" rx="2" fill="#09090f"/>
                            <rect x="54" y="10" width="16" height="16" rx="1" fill="#fff"/>
                            <rect x="4" y="48" width="28" height="28" rx="2" fill="#09090f"/>
                            <rect x="10" y="54" width="16" height="16" rx="1" fill="#fff"/>
                            <rect x="48" y="48" width="8" height="8" fill="#09090f"/>
                            <rect x="64" y="48" width="8" height="8" fill="#09090f"/>
                            <rect x="48" y="64" width="8" height="8" fill="#09090f"/>
                            <rect x="64" y="64" width="8" height="8" fill="#09090f"/>
                          </svg>
                        </div>
                        <div style={{ width: 22, height: 22, background: '#1e1e2e', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✏️</div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Customer Phone Mockup ─────────────────────────────────────────────────────
function CustomerPhoneMockup() {
  const [tab, setTab] = useState<'price' | 'history' | 'sales'>('price')

  const sparkPoints = [38, 35, 42, 39, 44, 41, 48, 45, 50, 47, 52, 55, 51, 58, 54, 61, 58, 63, 59, 65, 62, 68, 65, 72, 69, 75, 71, 78, 74, 80]
  const w = 220, h = 52, pad = 4
  const min = Math.min(...sparkPoints), max = Math.max(...sparkPoints)
  const pts = sparkPoints.map((v, i) => {
    const x = pad + (i / (sparkPoints.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* Phone frame */}
      <div style={{ width: 260, background: 'linear-gradient(180deg,#1c1d25,#0a0b0e)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 40, padding: 8, boxShadow: '0 40px 80px -20px rgba(0,0,0,0.8)' }}>
        {/* Notch */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <div style={{ width: 80, height: 6, background: '#000', borderRadius: 4 }} />
        </div>
        {/* Screen */}
        <div style={{ background: '#09090f', borderRadius: 32, overflow: 'hidden', padding: '16px 14px' }}>

          {/* Shop header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #1a1a2a' }}>
            <div style={{ width: 28, height: 28, background: `linear-gradient(135deg,${GOLD},#c8a020)`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🃏</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f2f2f3' }}>PokeZone Melbourne</div>
              <div style={{ fontSize: 9, color: '#5a5a6a' }}>Live price · Updated just now</div>
            </div>
          </div>

          {/* Card info */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
            {/* Card art placeholder */}
            <div style={{ width: 54, height: 74, background: 'linear-gradient(135deg,#1a2a4a,#2a1a4a)', borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #2a2a3d', fontSize: 22 }}>
              🔥
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f2f2f3', letterSpacing: '-0.3px', lineHeight: 1.2 }}>Charizard VMAX</div>
              <div style={{ fontSize: 10, color: '#7b7b82', marginBottom: 6 }}>Sword & Shield · PSA 10</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: GOLD, letterSpacing: '-1px', lineHeight: 1 }}>A$449</div>
              <div style={{ fontSize: 10, color: '#7b7b82', marginTop: 2 }}>Shop price</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, background: '#13131f', borderRadius: 10, padding: 3, marginBottom: 12 }}>
            {(['price', 'history', 'sales'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '5px 0', borderRadius: 8, border: 'none', background: tab === t ? '#1e1e2e' : 'transparent', color: tab === t ? '#f2f2f3' : '#5a5a6a', fontSize: 9, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                {t === 'price' ? 'Price' : t === 'history' ? 'History' : 'Sales'}
              </button>
            ))}
          </div>

          {tab === 'price' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Market price', value: 'A$420', note: 'Live data' },
                { label: '7-day avg', value: 'A$398', note: '↑ trending' },
                { label: '30-day avg', value: 'A$385', note: '' },
                { label: 'Market trend', value: '+8.2%', note: 'This week', green: true },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: '#13131f', borderRadius: 8 }}>
                  <span style={{ fontSize: 10, color: '#7b7b82' }}>{r.label}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: r.green ? GREEN : '#e8e8f0' }}>{r.value}</span>
                    {r.note && <div style={{ fontSize: 9, color: '#4a4a5a' }}>{r.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'history' && (
            <div>
              <svg width="100%" height={h + 8} viewBox={`0 0 ${w} ${h + 8}`} preserveAspectRatio="none" style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} stopOpacity="0.3"/>
                    <stop offset="100%" stopColor={GOLD} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <polygon points={`${pad},${h} ${pts} ${w - pad},${h}`} fill="url(#sg)" />
                <polyline points={pts} fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#4a4a5a', marginTop: 4 }}>
                <span>30 days ago</span><span>Today</span>
              </div>
            </div>
          )}

          {tab === 'sales' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { price: 'A$428', date: '2 days ago', platform: 'eBay' },
                { price: 'A$415', date: '4 days ago', platform: 'eBay' },
                { price: 'A$440', date: '1 week ago', platform: 'eBay' },
                { price: 'A$398', date: '10 days ago', platform: 'eBay' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#13131f', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#e8e8f0' }}>{s.price}</div>
                    <div style={{ fontSize: 9, color: '#4a4a5a' }}>{s.platform}</div>
                  </div>
                  <div style={{ fontSize: 9, color: '#4a4a5a', textAlign: 'right', alignSelf: 'center' }}>{s.date}</div>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(232,197,71,0.08)', border: `1px solid rgba(232,197,71,0.2)`, borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: GOLD, fontWeight: 700 }}>Interested? Ask in store →</div>
          </div>

        </div>
        {/* Home bar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
          <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#5a5a6a', textAlign: 'center' }}>What customers see after scanning</div>
    </div>
  )
}

// ── Sticker Sheet Mockup ──────────────────────────────────────────────────────
function StickerSheetMockup() {
  const cards = [
    { name: 'Charizard VMAX', grade: 'PSA 10', price: 'A$449' },
    { name: 'Pikachu V-Union', grade: 'Raw NM', price: 'A$68' },
    { name: 'Umbreon VMAX', grade: 'PSA 9', price: 'A$210' },
    { name: 'Lugia V', grade: 'Raw NM', price: 'A$32' },
    { name: 'Rayquaza VMAX', grade: 'PSA 10', price: 'A$890' },
    { name: 'Mewtwo V', grade: 'Raw LP', price: 'A$18' },
  ]
  return (
    <div style={{ background: '#f5f5f0', borderRadius: 16, padding: 20, maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
      <div style={{ fontSize: 10, color: '#999', marginBottom: 12, textAlign: 'center', fontWeight: 600, letterSpacing: 1 }}>PRINT PREVIEW — AVERY L7160</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: '#fff', border: '1px dashed #ddd', borderRadius: 8, padding: '8px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ background: '#fff', padding: 3, borderRadius: 4, border: '1px solid #eee' }}>
              <QRPattern />
            </div>
            <div style={{ fontSize: 7.5, fontWeight: 700, color: '#111', textAlign: 'center', lineHeight: 1.3 }}>{c.name}</div>
            <div style={{ fontSize: 6.5, color: '#666' }}>{c.grade}</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#1a1a1a' }}>{c.price}</div>
            <div style={{ fontSize: 6, color: '#aaa' }}>cardindex.gg</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
      <main style={{ background: '#09090f', minHeight: '100vh', color: '#e8e8f0', fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif', WebkitFontSmoothing: 'antialiased' }}>

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section style={{ padding: '120px 24px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(232,197,71,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
            <Eyebrow>CARDINDEX FOR SHOPS</Eyebrow>
            <h1 style={{ fontSize: 'clamp(34px, 6vw, 60px)', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.06, margin: '0 0 20px', color: '#f2f2f3' }}>
              Turn every card into<br />
              <span style={{ color: GOLD }}>a live price tag</span>
            </h1>
            <p style={{ fontSize: 17, color: '#a0a0c0', lineHeight: 1.75, maxWidth: 520, margin: '0 auto 40px' }}>
              Print QR stickers straight from your dashboard. Customers scan and instantly see live market prices, recent sales, and trend data — no repricing, no spreadsheets, no guesswork.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="#waitlist" style={{ display: 'inline-block', padding: '14px 36px', background: GOLD, color: '#09090f', fontWeight: 800, fontSize: 15, borderRadius: 14, textDecoration: 'none' }}>
                Join the waitlist
              </a>
              <a href="#dashboard" style={{ display: 'inline-block', padding: '14px 28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#d0d0e0', fontWeight: 600, fontSize: 15, borderRadius: 14, textDecoration: 'none' }}>
                See how it works ↓
              </a>
            </div>
          </div>
        </section>

        {/* ── Shop Dashboard section ─────────────────────────────────────────── */}
        <section id="dashboard" style={{ padding: '0 24px 100px', maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <Eyebrow>SHOP DASHBOARD</Eyebrow>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 12px', color: '#f2f2f3' }}>Your whole inventory, one place</h2>
            <p style={{ fontSize: 14, color: '#a0a0c0', maxWidth: 480, margin: '0 auto' }}>Add cards, set your price, generate QR codes, and see which cards customers are scanning most.</p>
          </div>
          <ShopDashboardMockup />
        </section>

        {/* ── Customer view + Sticker sheet ─────────────────────────────────── */}
        <section style={{ padding: '0 24px 100px', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Eyebrow>TWO SIDES OF THE SAME STICKER</Eyebrow>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 12px', color: '#f2f2f3' }}>Print once. Always current.</h2>
            <p style={{ fontSize: 14, color: '#a0a0c0', maxWidth: 480, margin: '0 auto' }}>The sticker never changes — the price behind it does. Customers always see today's market data.</p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, justifyContent: 'center', alignItems: 'flex-start' }}>
            {/* Sticker → phone flow */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <div style={{ fontSize: 12, color: '#5a5a6a', fontWeight: 600, letterSpacing: 1 }}>THE STICKER</div>
              <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 130 }}>
                <QRPattern />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#111', fontWeight: 800 }}>Charizard VMAX</div>
                  <div style={{ fontSize: 8, color: '#666' }}>PSA 10</div>
                  <div style={{ fontSize: 11, color: '#111', fontWeight: 900, marginTop: 2 }}>A$449</div>
                  <div style={{ fontSize: 7, color: '#aaa', marginTop: 1 }}>cardindex.gg</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 2, height: 20, background: 'linear-gradient(180deg,#3a3a4a,transparent)' }} />
                <div style={{ fontSize: 11, color: '#7b7b82' }}>Customer scans →</div>
                <div style={{ width: 2, height: 20, background: 'linear-gradient(180deg,transparent,#3a3a4a)' }} />
              </div>
            </div>

            <CustomerPhoneMockup />
          </div>
        </section>

        {/* ── Print section ─────────────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 100px', maxWidth: 860, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ maxWidth: 340 }}>
              <Eyebrow>PRINT-READY LABELS</Eyebrow>
              <h2 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 16px', color: '#f2f2f3' }}>Sticker sheets in one click</h2>
              <p style={{ fontSize: 14, color: '#a0a0c0', lineHeight: 1.7, marginBottom: 20 }}>
                Select cards from your inventory, generate a print sheet, and it comes out formatted for Avery labels or any standard sticker paper. Each sticker includes the QR code, card name, grade, and your price.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Avery L7160 & standard label formats',
                  'Custom price or auto-fill from market data',
                  'Bulk-print up to 100 stickers at once',
                  'Your shop name on every sticker',
                ].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#c0c0d0' }}>
                    <span style={{ color: GREEN, fontSize: 14, flexShrink: 0 }}>✓</span> {f}
                  </div>
                ))}
              </div>
            </div>
            <StickerSheetMockup />
          </div>
        </section>

        {/* ── Features grid ─────────────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 100px', maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <Eyebrow>FEATURES</Eyebrow>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 48px', color: '#f2f2f3' }}>Built for the way shops work</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {[
              { icon: '📈', title: 'Always up-to-date', body: 'Prices sync from live market data. Stickers you printed 6 months ago still show today\'s price.' },
              { icon: '💰', title: 'Set your own margin', body: 'Override market price per card. The scan page shows both so customers understand the value.' },
              { icon: '📊', title: 'Scan analytics', body: 'See which cards customers look at most. Know what to stock before they ask.' },
              { icon: '🏷️', title: 'Your branding', body: 'Every scan page shows your shop name and logo — every scan reinforces your brand.' },
              { icon: '📦', title: 'Inventory management', body: 'Track your full stock, flag sold items, and keep pricing synced automatically.' },
              { icon: '🔔', title: 'Price alerts', body: 'Get notified when a card in your inventory moves significantly so you can reprice fast.' },
            ].map(f => (
              <div key={f.title} style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.012))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '24px 20px', textAlign: 'left' }}>
                <div style={{ fontSize: 26, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f2f2f3', marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: '#a0a0c0', lineHeight: 1.65 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Perfect for ───────────────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 100px', maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <Eyebrow>PERFECT FOR</Eyebrow>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 16 }}>
            {['Local game stores', 'Market stalls', 'Card expos', 'Display cases', 'Online shops with physical pickups', 'Pop-up events'].map(tag => (
              <span key={tag} style={{ padding: '9px 18px', background: 'rgba(232,197,71,0.06)', border: '1px solid rgba(232,197,71,0.18)', borderRadius: 100, fontSize: 13, color: '#c8c8a0', fontWeight: 500 }}>
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* ── Waitlist ──────────────────────────────────────────────────────── */}
        <section id="waitlist" style={{ padding: '0 24px 120px', maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ background: 'linear-gradient(180deg,rgba(232,197,71,0.06),rgba(232,197,71,0.02))', border: '1px solid rgba(232,197,71,0.15)', borderRadius: 24, padding: '40px 32px' }}>
            <Eyebrow>EARLY ACCESS</Eyebrow>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 10px', color: '#f2f2f3' }}>Get early access</h2>
            <p style={{ fontSize: 14, color: '#a0a0c0', marginBottom: 28, lineHeight: 1.65 }}>
              We're rolling out to shops in early 2027. Join the waitlist and we'll reach out first — and shape what we build.
            </p>

            {status === 'done' ? (
              <div style={{ background: 'rgba(61,232,138,0.06)', border: '1px solid rgba(61,232,138,0.2)', borderRadius: 16, padding: '28px 24px' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: GREEN, marginBottom: 4 }}>You're on the list</div>
                <div style={{ fontSize: 13, color: '#a0a0c0' }}>We'll be in touch when shop access opens.</div>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  placeholder="Tell us about your shop (optional)"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '13px 16px', background: '#13131f', border: '1px solid #2a2a3d', borderRadius: 12, color: '#f2f2f3', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                {status === 'error' && (
                  <div style={{ fontSize: 13, color: RED }}>Something went wrong — please try again.</div>
                )}
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  style={{ padding: '14px 0', background: GOLD, color: '#09090f', fontWeight: 800, fontSize: 15, borderRadius: 12, border: 'none', cursor: status === 'loading' ? 'not-allowed' : 'pointer', opacity: status === 'loading' ? 0.7 : 1, marginTop: 4 }}
                >
                  {status === 'loading' ? 'Submitting…' : 'Join the waitlist'}
                </button>
              </form>
            )}
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
