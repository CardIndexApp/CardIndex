'use client'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Ticker from '@/components/Ticker'
import { rising, declining, traded, scoreColor } from '@/lib/data'

function Table({ title, items, type }: { title: string; items: { id: string; name: string; grade: string; change?: number; volume?: number; score: number }[]; type: string }) {
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{title}</span>
      </div>
      {items.map((item, i) => (
        <Link key={i} href={`/card/${item.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="font-num" style={{ fontSize: 11, color: 'var(--ink3)', width: 16 }}>{i + 1}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{item.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{item.grade}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {item.change !== undefined && (
              <span className="font-num" style={{ fontSize: 13, color: item.change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {item.change >= 0 ? '+' : ''}{item.change}%
              </span>
            )}
            {item.volume !== undefined && (
              <span className="font-num" style={{ fontSize: 13, color: 'var(--ink2)' }}>{item.volume} sales</span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 40, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${item.score}%`, background: scoreColor(item.score), borderRadius: 2 }} />
              </div>
              <span className="font-num" style={{ fontSize: 11, color: scoreColor(item.score) }}>{item.score}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function Market() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 72, paddingBottom: 80, minHeight: '100vh' }}>
        <Ticker />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
          <div style={{ marginBottom: 40 }}>
            <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8 }}>MARKET OVERVIEW</p>
            <h1 className="font-display" style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 8 }}>Today&apos;s market</h1>
            <p style={{ fontSize: 13, color: 'var(--ink2)' }}>Live snapshot of the trading card market — updated daily.</p>
          </div>

          {/* Summary cards */}
          <div className="market-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 40 }}>
            {[
              { label: 'Cards Rising', value: '1,284', color: 'var(--green)', icon: '↑' },
              { label: 'Cards Falling', value: '892', color: 'var(--red)', icon: '↓' },
              { label: 'Unchanged', value: '3,112', color: 'var(--ink2)', icon: '→' },
            ].map((s, i) => (
              <div key={i} style={{ borderRadius: 14, padding: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ color: s.color, fontSize: 11 }}>{s.icon}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{s.label}</span>
                </div>
                <div className="font-num" style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="market-tables-grid">
            <Table title="Top rising (30d)" items={rising} type="rising" />
            <Table title="Top declining (30d)" items={declining} type="declining" />
          </div>
          <Table title="Most traded (30d)" items={traded} type="traded" />

        </div>
      </main>
    </>
  )
}
