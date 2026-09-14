'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const GOLD = '#e8c547'
const GREEN = '#3de88a'
const BG = '#0b0c0f'
const CARD_BG = 'linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.012))'
const CARD_BORDER = '1px solid rgba(255,255,255,0.08)'

function Ico({ d, size = 18, stroke = 1.7 }: { d: string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
      <span style={{ width: 22, height: 1, background: `linear-gradient(90deg,transparent,${GOLD})` }} />
      <span style={{ fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 600 }}>{children}</span>
      <span style={{ width: 22, height: 1, background: `linear-gradient(90deg,${GOLD},transparent)` }} />
    </div>
  )
}

function QRPattern({ size = 64 }: { size?: number }) {
  const s = size / 80
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
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

// ── Shop Dashboard Mockup (mobile) ───────────────────────────────────────────
function ShopDashboardMockupMobile() {
  const cards = [
    { name: 'Charizard VMAX', grade: 'PSA 10', price: 'A$449', trend: '+8.2%', up: true },
    { name: 'Pikachu V-Union', grade: 'Raw NM', price: 'A$68',  trend: '+2.1%', up: true },
    { name: 'Umbreon VMAX',   grade: 'PSA 9',   price: 'A$210', trend: '-1.4%', up: false },
  ]
  return (
    <div style={{ background: '#0d0d16', border: '1px solid #1e1e2e', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.6)' }}>
      <div style={{ background: '#13131f', borderBottom: '1px solid #1a1a2a', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />)}
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#3a3a4a', fontWeight: 600 }}>CardIndex for Shops</div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[{ label: 'Cards Listed', value: '142', sub: '+6 this week' }, { label: 'Scans Today', value: '83', sub: '12 more than yesterday', hi: true }].map(s => (
            <div key={s.label} style={{ background: '#13131f', border: '1px solid #1a1a2a', borderRadius: 10, padding: '10px 11px' }}>
              <div style={{ fontSize: 8.5, color: '#4a4a5a', marginBottom: 3, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#eeeef8', letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ fontSize: 8.5, color: s.hi ? GREEN : '#4a4a5a', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#13131f', border: '1px solid #1a1a2a', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '9px 12px', borderBottom: '1px solid #1a1a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#c0c0d8' }}>Inventory</span>
            <button style={{ padding: '4px 9px', background: GOLD, color: '#09090f', fontSize: 9, fontWeight: 800, borderRadius: 6, border: 'none' }}>+ Add Card</button>
          </div>
          {cards.map((c, i) => (
            <div key={i} style={{ padding: '10px 12px', borderBottom: i < cards.length - 1 ? '1px solid #0f0f1a' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e0e0f0' }}>{c.name}</div>
                <div style={{ fontSize: 9, color: '#3a3a4a', marginTop: 1 }}>{c.grade}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{c.price}</div>
                <div style={{ fontSize: 9, color: c.up ? GREEN : '#e8524a', marginTop: 1 }}>{c.trend}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Shop Dashboard Mockup ─────────────────────────────────────────────────────
function ShopDashboardMockup() {
  const inventory = [
    { name: 'Charizard VMAX', set: 'Sword & Shield', grade: 'PSA 10', market: 'A$420', shopPrice: 'A$449', scans: 38, trend: '+8.2%', up: true },
    { name: 'Pikachu V-Union', set: 'SWSH Promos',   grade: 'Raw NM',  market: 'A$62',  shopPrice: 'A$68',  scans: 14, trend: '+2.1%', up: true },
    { name: 'Umbreon VMAX',   set: 'Evolving Skies', grade: 'PSA 9',   market: 'A$195', shopPrice: 'A$210', scans: 22, trend: '-1.4%', up: false },
    { name: 'Lugia V',        set: 'Silver Tempest', grade: 'Raw NM',  market: 'A$28',  shopPrice: 'A$32',  scans: 9,  trend: '+0.5%', up: true },
  ]

  return (
    <div style={{ background: '#0d0d16', border: '1px solid #1e1e2e', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)', maxWidth: 780, margin: '0 auto' }}>
      {/* Titlebar */}
      <div style={{ background: '#13131f', borderBottom: '1px solid #1a1a2a', padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#3a3a4a', fontWeight: 600, letterSpacing: 0.3 }}>CardIndex for Shops</div>
      </div>

      <div style={{ display: 'flex', minHeight: 380 }}>
        {/* Sidebar */}
        <div style={{ width: 152, background: '#0a0a12', borderRight: '1px solid #141420', padding: '14px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '6px 14px', fontSize: 9, color: '#3a3a4a', fontWeight: 700, letterSpacing: 1.5, marginBottom: 6 }}>SHOP</div>
          {[
            { icon: 'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z|M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16', label: 'Inventory', active: true },
            { icon: 'M6 9V2h12v7|M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2|M6 14h12v8H6z', label: 'Print Labels' },
            { icon: 'M3 3v18h18|M19 9l-5 5-4-4-3 3', label: 'Scan Analytics' },
            { icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z|M12 6v6l4 2', label: 'Settings' },
          ].map(item => (
            <div key={item.label} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, background: item.active ? 'rgba(232,197,71,0.07)' : 'transparent', borderLeft: item.active ? `2px solid ${GOLD}` : '2px solid transparent' }}>
              <span style={{ color: item.active ? GOLD : '#3a3a4a' }}><Ico d={item.icon} size={13} /></span>
              <span style={{ fontSize: 11, color: item.active ? GOLD : '#4a4a5a', fontWeight: item.active ? 700 : 400 }}>{item.label}</span>
            </div>
          ))}
          <div style={{ marginTop: 'auto', padding: '10px 14px', borderTop: '1px solid #141420' }}>
            <div style={{ fontSize: 10, color: '#3a3a4a', fontWeight: 600 }}>PokeZone Melbourne</div>
            <div style={{ fontSize: 9, color: '#2a2a3a', marginTop: 1 }}>Pro Plan</div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '18px', overflowX: 'auto' }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
            {[
              { label: 'Cards Listed', value: '142', sub: '+6 this week', highlight: false },
              { label: 'Scans Today',  value: '83',  sub: '12 more than yesterday', highlight: true },
              { label: 'Avg Margin',   value: '8.4%', sub: 'above market price', highlight: false },
            ].map(s => (
              <div key={s.label} style={{ background: '#13131f', border: '1px solid #1a1a2a', borderRadius: 10, padding: '11px 12px' }}>
                <div style={{ fontSize: 9, color: '#4a4a5a', marginBottom: 4, fontWeight: 600, letterSpacing: 0.5 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#eeeef8', letterSpacing: '-0.5px' }}>{s.value}</div>
                <div style={{ fontSize: 9, color: s.highlight ? GREEN : '#4a4a5a', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ background: '#13131f', border: '1px solid #1a1a2a', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#c0c0d8' }}>Inventory</span>
              <button style={{ padding: '5px 11px', background: GOLD, color: '#09090f', fontSize: 9, fontWeight: 800, borderRadius: 7, border: 'none', cursor: 'pointer', letterSpacing: 0.3 }}>+ Add Card</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #141420' }}>
                  {['Card', 'Grade', 'Market', 'Your Price', 'Scans', 'Trend', ''].map(h => (
                    <th key={h} style={{ padding: '7px 12px', fontSize: 8.5, color: '#3a3a4a', fontWeight: 700, textAlign: 'left', letterSpacing: 0.8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventory.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < inventory.length - 1 ? '1px solid #0f0f1a' : 'none' }}>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#e0e0f0' }}>{row.name}</div>
                      <div style={{ fontSize: 9, color: '#3a3a4a', marginTop: 1 }}>{row.set}</div>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 10, color: '#8080a0' }}>{row.grade}</td>
                    <td style={{ padding: '9px 12px', fontSize: 10, color: '#8080a0', fontWeight: 600 }}>{row.market}</td>
                    <td style={{ padding: '9px 12px', fontSize: 10, color: GOLD, fontWeight: 700 }}>{row.shopPrice}</td>
                    <td style={{ padding: '9px 12px', fontSize: 10, color: '#8080a0' }}>{row.scans}</td>
                    <td style={{ padding: '9px 12px', fontSize: 10, color: row.up ? GREEN : '#e8524a', fontWeight: 600 }}>{row.trend}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <div style={{ width: 22, height: 22, background: '#fff', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <QRPattern size={14} />
                        </div>
                        <div style={{ width: 22, height: 22, background: '#1a1a2a', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4a5a' }}>
                          <Ico d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7|M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" size={11} />
                        </div>
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 210, background: 'linear-gradient(180deg,#1c1d25,#0a0b0e)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 44, padding: 7, boxShadow: '0 48px 80px -20px rgba(0,0,0,0.9)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 7 }}>
          <div style={{ width: 64, height: 17, background: '#000', borderRadius: 9 }} />
        </div>
        <div style={{ background: '#09090f', borderRadius: 37, overflow: 'hidden', padding: '18px 13px 22px' }}>

          {/* Shop */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: 20, height: 20, background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD }}>
              <Ico d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M9 22V12h6v10" size={11} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#b0b0c8', letterSpacing: '-0.1px' }}>PokeZone Melbourne</div>
          </div>

          {/* Card placeholder */}
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ width: 58, height: 80, background: 'linear-gradient(160deg,#141428,#1a1030)', borderRadius: 7, margin: '0 auto 11px', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 10px 28px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.1)' }}>
              <Ico d="M9 2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" size={22} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#eeeef8', letterSpacing: '-0.4px' }}>Charizard VMAX</div>
            <div style={{ fontSize: 9, color: '#3a3a4a', marginTop: 3 }}>Sword & Shield · PSA 10</div>
          </div>

          {/* Price + stock block */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 12px', marginBottom: 10 }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: '#3a3a4a', marginBottom: 4, fontWeight: 600, letterSpacing: 1 }}>PRICE</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: GOLD, letterSpacing: '-1.5px', lineHeight: 1 }}>A$449</div>
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 12 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#3a3a4a', marginBottom: 4, fontWeight: 600, letterSpacing: 1 }}>IN STOCK</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: GREEN }}>3 available</div>
            </div>
          </div>

          {/* CTA */}
          <div style={{ background: GOLD, borderRadius: 10, padding: '10px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#09090f', letterSpacing: '-0.2px' }}>Ask in store to purchase</div>
          </div>

        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 7 }}>
          <div style={{ width: 50, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#3a3a4a', textAlign: 'center', letterSpacing: 0.5, fontWeight: 600 }}>WHAT CUSTOMERS SEE</div>
    </div>
  )
}

// ── Sticker Sheet Mockup ──────────────────────────────────────────────────────
function StickerSheetMockup() {
  const cards = [
    { name: 'Charizard VMAX', grade: 'PSA 10' },
    { name: 'Pikachu V-Union', grade: 'Raw NM' },
    { name: 'Umbreon VMAX', grade: 'PSA 9' },
    { name: 'Lugia V', grade: 'Raw NM' },
    { name: 'Rayquaza VMAX', grade: 'PSA 10' },
    { name: 'Mewtwo V', grade: 'Raw LP' },
  ]
  return (
    <div style={{ background: '#eeecea', borderRadius: 20, padding: '18px 16px', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.55)', border: '1px solid #dddbd5' }}>
      <div style={{ fontSize: 8.5, color: '#b0ada8', marginBottom: 12, textAlign: 'center', fontWeight: 700, letterSpacing: 1.5 }}>PRINT PREVIEW — AVERY L7160</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: '#fff', border: '1.5px dashed #dddbd5', borderRadius: 10, padding: '10px 8px 9px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ background: '#f8f7f5', padding: 6, borderRadius: 7, border: '1px solid #eae8e4' }}>
              <QRPattern size={58} />
            </div>
            <div style={{ fontSize: 7.5, fontWeight: 800, color: '#1a1a16', textAlign: 'center', lineHeight: 1.25, letterSpacing: '-0.1px' }}>{c.name}</div>
            <div style={{ fontSize: 7, color: '#9a9890', fontWeight: 500 }}>{c.grade}</div>
            <div style={{ fontSize: 7, color: '#c0bdb8', fontWeight: 500 }}>Scan for price</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  { c: GOLD,  d: 'M3 3v18h18|M19 9l-5 5-4-4-3 3',                                                      t: 'Always up-to-date',    b: "Prices sync from live market data. A sticker you printed months ago still shows today's price." },
  { c: GREEN, d: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z|M12 8v4l3 3',                               t: 'Real-time stock levels', b: 'Customers see live stock counts. Mark a card sold and it updates instantly on every sticker.' },
  { c: GOLD,  d: 'M6 9V2h12v7|M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2|M6 14h12v8H6z', t: 'Print-ready labels',    b: 'One-click sticker sheets for Avery labels and standard label printers. Batch-print up to 100 at once.' },
  { c: GREEN, d: 'M12 2v20|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',                        t: 'Set your own price',    b: 'Override market price per card. The scan page shows your price clearly.' },
  { c: GOLD,  d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z|M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', t: 'Scan analytics',       b: 'See which cards customers look at most so you know what to restock.' },
  { c: GREEN, d: 'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z|M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16', t: 'Your branding',        b: 'Every scan page shows your shop name. Each scan reinforces your identity.' },
]

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ShopsPage() {
  const [email, setEmail]     = useState('')
  const [shopName, setShopName] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

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
    } catch { setStatus('error') }
  }

  return (
    <>
      <Navbar />
      <main style={{ background: BG, minHeight: '100vh', color: '#e8e8f0', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", WebkitFontSmoothing: 'antialiased' }}>
        <style>{`
          .shops-hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
          .shops-dashboard-scroll { }
          .shops-dashboard-mobile { display: none; }
          .shops-scan-flow { display: flex; flex-wrap: wrap; gap: 0; justify-content: center; align-items: center; }
          .shops-print-row { display: flex; flex-wrap: wrap; gap: 56px; align-items: center; justify-content: center; }
          @media (max-width: 600px) {
            .shops-scan-flow { flex-direction: column; gap: 24px; }
            .shops-scan-arrow { flex-direction: row !important; gap: 8px !important; padding: 0 !important; }
            .shops-scan-arrow svg { transform: rotate(90deg); }
            .shops-print-row { gap: 32px; }
            .shops-dashboard-scroll { display: none; }
            .shops-dashboard-mobile { display: block; }
          }
        `}</style>

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section style={{ padding: '120px 24px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(232,197,71,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', maxWidth: 660, margin: '0 auto' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 99, padding: '6px 13px', marginBottom: 24, background: 'rgba(232,197,71,0.07)', border: '1px solid rgba(232,197,71,0.25)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, boxShadow: `0 0 8px ${GREEN}` }} />
              <span style={{ fontSize: 10, color: GOLD, letterSpacing: 1.5, fontWeight: 600 }}>CARDINDEX FOR SHOPS</span>
            </div>
            <h1 style={{ fontSize: 'clamp(34px,6vw,58px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.06, margin: '0 0 20px', color: '#eeeef8' }}>
              Turn every card into<br /><span style={{ color: GOLD }}>a live price tag</span>
            </h1>
            <p style={{ fontSize: 17, color: '#b8b8d0', lineHeight: 1.7, maxWidth: 500, margin: '0 auto 36px' }}>
              Print QR stickers from your dashboard. Customers scan to see the current price and stock level — updated automatically, no repricing required.
            </p>
            <div className="shops-hero-btns">
              <a href="#waitlist" style={{ display: 'inline-block', padding: '12px 32px', background: GOLD, color: '#09090f', fontWeight: 700, fontSize: 14, borderRadius: 12, textDecoration: 'none', letterSpacing: '-0.2px', boxShadow: '0 4px 20px rgba(232,197,71,0.25)' }}>
                Join the waitlist
              </a>
              <a href="#dashboard" style={{ display: 'inline-block', padding: '12px 24px', background: 'rgba(255,255,255,0.05)', border: CARD_BORDER, color: '#b8b8d0', fontWeight: 600, fontSize: 14, borderRadius: 12, textDecoration: 'none' }}>
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* ── Dashboard ─────────────────────────────────────────────────────── */}
        <section id="dashboard" style={{ padding: '0 24px 100px', maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <Eyebrow>SHOP DASHBOARD</Eyebrow>
            <h2 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 10px', color: '#eeeef8' }}>Your whole inventory, one place</h2>
            <p style={{ fontSize: 14, color: '#b8b8d0', maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>Add cards, set your price, generate QR labels, and see which cards customers are scanning most.</p>
          </div>
          <div className="shops-dashboard-scroll"><ShopDashboardMockup /></div>
          <div className="shops-dashboard-mobile"><ShopDashboardMockupMobile /></div>
        </section>

        {/* ── Scan flow ─────────────────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 100px', maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Eyebrow>THE CUSTOMER EXPERIENCE</Eyebrow>
            <h2 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 10px', color: '#eeeef8' }}>Print once. Always current.</h2>
            <p style={{ fontSize: 14, color: '#b8b8d0', maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>The sticker never changes — the price behind it does. Every scan shows live data.</p>
          </div>

          <div className="shops-scan-flow">
            {/* Sticker */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '0 28px' }}>
              <div style={{ fontSize: 9, color: '#3a3a4a', fontWeight: 700, letterSpacing: 1.5 }}>THE STICKER</div>
              <div style={{ background: '#fff', borderRadius: 18, padding: '16px 14px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 134 }}>
                <div style={{ background: '#f8f7f5', padding: 7, borderRadius: 10, border: '1px solid #eae8e4' }}>
                  <QRPattern size={62} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#111', fontWeight: 800 }}>Charizard VMAX</div>
                  <div style={{ fontSize: 8.5, color: '#999', marginTop: 1 }}>PSA 10</div>
                  <div style={{ fontSize: 7.5, color: '#ccc', marginTop: 5 }}>Scan for price</div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="shops-scan-arrow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '0 4px' }}>
              <div style={{ fontSize: 9, color: '#2a2a3a', fontWeight: 600, letterSpacing: 0.5 }}>customer scans</div>
              <svg width="44" height="16" viewBox="0 0 44 16" fill="none">
                <path d="M2 8 H36 M30 2 L42 8 L30 14" stroke="#2a2a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <div style={{ padding: '0 28px' }}>
              <CustomerPhoneMockup />
            </div>
          </div>
        </section>

        {/* ── Print labels ──────────────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 100px', maxWidth: 860, margin: '0 auto' }}>
          <div className="shops-print-row">
            <div style={{ maxWidth: 320 }}>
              <Eyebrow>PRINT-READY LABELS</Eyebrow>
              <h2 style={{ fontSize: 'clamp(22px,4vw,32px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 14px', color: '#eeeef8' }}>Sticker sheets in one click</h2>
              <p style={{ fontSize: 14, color: '#b8b8d0', lineHeight: 1.7, marginBottom: 20 }}>
                Select cards from your inventory and export a formatted sheet ready for Avery labels or any standard sticker paper. Name, grade, and QR code — nothing else.
              </p>
              {['Avery L7160 and standard formats', 'Batch-print up to 100 at once', 'Auto-fills from your inventory', 'Your shop name on every label'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#b8b8d0', marginBottom: 8 }}>
                  <span style={{ color: GREEN, flexShrink: 0 }}><Ico d="M20 6L9 17l-5-5" size={14} /></span>{f}
                </div>
              ))}
            </div>
            <StickerSheetMockup />
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 100px', maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <Eyebrow>FEATURES</Eyebrow>
          <h2 style={{ fontSize: 'clamp(24px,4vw,34px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 44px', color: '#eeeef8' }}>Built for the way shops work</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {FEATURES.map(f => (
              <div key={f.t} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: '22px 20px', textAlign: 'left' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `rgba(${f.c === GOLD ? '232,197,71' : '61,232,138'},0.08)`, border: `1px solid rgba(${f.c === GOLD ? '232,197,71' : '61,232,138'},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.c, marginBottom: 14 }}>
                  <Ico d={f.d} size={16} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#eeeef8', marginBottom: 6 }}>{f.t}</div>
                <div style={{ fontSize: 13, color: '#b8b8d0', lineHeight: 1.65 }}>{f.b}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Perfect for ───────────────────────────────────────────────────── */}
        <section style={{ padding: '0 24px 100px', maxWidth: 660, margin: '0 auto', textAlign: 'center' }}>
          <Eyebrow>PERFECT FOR</Eyebrow>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            {['Local game stores', 'Market stalls', 'Card expos', 'Display cases', 'Online shops with physical pickups', 'Pop-up events'].map(tag => (
              <span key={tag} style={{ padding: '8px 16px', background: 'rgba(232,197,71,0.05)', border: '1px solid rgba(232,197,71,0.14)', borderRadius: 100, fontSize: 13, color: '#b8b8c0', fontWeight: 500 }}>
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* ── Waitlist ──────────────────────────────────────────────────────── */}
        <section id="waitlist" style={{ padding: '0 24px 120px', maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ background: 'linear-gradient(180deg,rgba(232,197,71,0.05),rgba(232,197,71,0.02))', border: '1px solid rgba(232,197,71,0.12)', borderRadius: 24, padding: '40px 32px' }}>
            <Eyebrow>EARLY ACCESS</Eyebrow>
            <h2 style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 10px', color: '#eeeef8' }}>Get early access</h2>
            <p style={{ fontSize: 14, color: '#b8b8d0', marginBottom: 28, lineHeight: 1.65 }}>
              Rolling out to shops in early 2027. Join the waitlist and we'll reach out first.
            </p>

            {status === 'done' ? (
              <div style={{ background: 'rgba(61,232,138,0.06)', border: '1px solid rgba(61,232,138,0.18)', borderRadius: 14, padding: '26px 20px' }}>
                <div style={{ color: GREEN, marginBottom: 8 }}><Ico d="M20 6L9 17l-5-5" size={24} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: GREEN, marginBottom: 4 }}>You're on the list</div>
                <div style={{ fontSize: 13, color: '#b8b8d0' }}>We'll be in touch when shop access opens.</div>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { placeholder: 'Shop name', value: shopName, onChange: (v: string) => setShopName(v), type: 'text', required: false },
                  { placeholder: 'Email address', value: email, onChange: (v: string) => setEmail(v), type: 'email', required: true },
                ].map(f => (
                  <input key={f.placeholder} type={f.type} placeholder={f.placeholder} value={f.value} onChange={e => f.onChange(e.target.value)} required={f.required}
                    style={{ width: '100%', padding: '12px 15px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#eeeef8', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                ))}
                <textarea placeholder="Tell us about your shop (optional)" value={message} onChange={e => setMessage(e.target.value)} rows={3}
                  style={{ width: '100%', padding: '12px 15px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#eeeef8', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                {status === 'error' && <div style={{ fontSize: 13, color: '#e8524a' }}>Something went wrong — please try again.</div>}
                <button type="submit" disabled={status === 'loading'}
                  style={{ padding: '13px 0', background: GOLD, color: '#09090f', fontWeight: 700, fontSize: 14, borderRadius: 10, border: 'none', cursor: status === 'loading' ? 'not-allowed' : 'pointer', opacity: status === 'loading' ? 0.7 : 1, marginTop: 4, letterSpacing: '-0.2px', boxShadow: '0 4px 20px rgba(232,197,71,0.2)' }}
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
