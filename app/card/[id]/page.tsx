'use client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import PriceChart from '@/components/PriceChart'
import ScoreRing from '@/components/ScoreRing'
import { getCard, fmt, scoreColor, scoreLabel } from '@/lib/data'

export default function CardPage() {
  const { id } = useParams<{ id: string }>()
  const card = getCard(id)
  if (!card) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: 'var(--ink2)' }}>Card not found</p>
      <Link href="/" style={{ color: 'var(--gold)', textDecoration: 'none' }}>← Back home</Link>
    </div>
  )

  const isUp = card.trend === 'up'
  const firstPrice = card.history[0].price
  const lastPrice = card.history[card.history.length - 1].price
  const totalChange = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(1)

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 56, paddingBottom: 80, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px' }}>

          <div style={{ padding: '24px 0' }}>
            <Link href="/" style={{ fontSize: 13, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>← Back to market</Link>
          </div>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>{card.emoji}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h1 className="font-display" style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>{card.name}</h1>
                  <span className="font-mono-custom" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--ink3)' }}>{card.grade}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink2)' }}>{card.set} · {card.rarity} · {card.year}</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px' }}>{fmt(card.price)}</div>
              <div className="font-mono-custom" style={{ fontSize: 13, color: isUp ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
                {isUp ? '▲' : '▼'} {Math.abs(card.change)}% (30d)
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Current Price', value: fmt(card.price), color: 'var(--ink)' },
                  { label: '12M Change', value: `${parseFloat(totalChange) >= 0 ? '+' : ''}${totalChange}%`, color: parseFloat(totalChange) >= 0 ? 'var(--green)' : 'var(--red)' },
                  { label: 'Recent Sales', value: `${card.sales.length} (30d)`, color: 'var(--ink)' },
                ].map((s, i) => (
                  <div key={i} style={{ borderRadius: 12, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 6 }}>{s.label}</div>
                    <div className="font-mono-custom" style={{ fontSize: 16, fontWeight: 500, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div style={{ borderRadius: 16, padding: 24, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 4 }}>PRICE HISTORY</p>
                    <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>12 Month Chart</p>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['1M', '3M', '6M', '1Y'].map((t, i) => (
                      <button key={t} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: i === 3 ? '1px solid rgba(232,197,71,0.2)' : '1px solid transparent', background: i === 3 ? 'var(--gold2)' : 'transparent', color: i === 3 ? 'var(--gold)' : 'var(--ink3)', cursor: 'pointer' }}>{t}</button>
                    ))}
                  </div>
                </div>
                <PriceChart data={card.history} />
              </div>

              {/* Verdict */}
              <div style={{ borderRadius: 16, padding: 24, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 16 }}>MARKET VERDICT</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 13, padding: '4px 12px', borderRadius: 8, fontWeight: 600, background: isUp ? 'rgba(61,232,138,0.1)' : 'rgba(232,82,74,0.1)', color: isUp ? 'var(--green)' : 'var(--red)', border: `1px solid ${isUp ? 'rgba(61,232,138,0.2)' : 'rgba(232,82,74,0.2)'}` }}>
                    {isUp ? '↑ Bullish' : '↓ Bearish'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{card.verdictShort}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8 }}>{card.verdict}</p>
              </div>

              {/* Recent Sales */}
              <div style={{ borderRadius: 16, padding: 24, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 16 }}>RECENT SALES</p>
                {card.sales.map((sale, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < card.sales.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="font-mono-custom" style={{ fontSize: 11, color: 'var(--ink3)' }}>{sale.date}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'var(--surface2)', color: 'var(--ink3)' }}>{sale.platform}</span>
                    </div>
                    <span className="font-mono-custom" style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{fmt(sale.price)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ borderRadius: 16, padding: 24, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 20, textAlign: 'center' }}>CARDINDEX SCORE</p>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <ScoreRing score={card.score} size="lg" />
                </div>
                <p style={{ textAlign: 'center', fontSize: 13, color: scoreColor(card.score), margin: '12px 0 20px' }}>
                  {scoreLabel(card.score)} — {card.score}/100
                </p>
                <ScoreRing score={card.score} size="lg" breakdown={card.breakdown} />
              </div>

              <div style={{ borderRadius: 16, padding: 24, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 16 }}>CARD INFO</p>
                {[{ label: 'Grade', value: card.grade }, { label: 'Set', value: card.set }, { label: 'Year', value: card.year }, { label: 'Rarity', value: card.rarity }].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{row.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
