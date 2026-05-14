'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import { useCurrency } from '@/lib/currency'

interface PackCard {
  id: string
  pack_id: string
  card_name: string
  card_id: string | null
  rarity: string
  pull_rate_pct: number
  price: number
  contribution: number
}

interface Pack {
  id: string
  set_name: string
  pack_name: string
  retail_price_usd: number
  retail_price_aud: number | null
  release_date: string | null
  image_url: string | null
  cards: PackCard[]
  ev_usd: number
}

export default function PacksPage() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { fmtCurrency, currency } = useCurrency()

  useEffect(() => {
    fetch('/api/packs')
      .then(r => r.json())
      .then(d => { setPacks(d.packs ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const retailPrice = (pack: Pack) =>
    currency === 'AUD' && pack.retail_price_aud != null
      ? pack.retail_price_aud
      : pack.retail_price_usd

  const evValue = (pack: Pack) => {
    // ev_usd is always in USD; fmtCurrency will convert via useCurrency
    return pack.ev_usd
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 72, paddingBottom: 40, minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 6 }}>
              Pack EV Analysis
            </h1>
            <p style={{ fontSize: 14, color: 'var(--ink3)', lineHeight: 1.6 }}>
              Expected value of opening a booster pack vs buying singles
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: 20, height: 120, opacity: 0.5 }} />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ borderRadius: 14, background: 'rgba(232,82,74,0.08)', border: '1px solid rgba(232,82,74,0.25)', padding: '20px', color: 'var(--red)', fontSize: 13 }}>
              Failed to load packs: {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && packs.length === 0 && (
            <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
              <p className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
                No packs configured yet
              </p>
              <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.6 }}>
                Add packs in the Admin panel.
              </p>
            </div>
          )}

          {/* Pack cards */}
          {!loading && !error && packs.map(pack => {
            const retail = retailPrice(pack)
            const ev = evValue(pack)
            const evPositive = ev >= retail
            const evColor = evPositive ? 'var(--green)' : 'var(--red)'
            const ratio = retail > 0 ? ev / retail : 0
            const breakevenPacks = ev > 0 && ev < retail ? Math.ceil(retail / ev) : null

            // Top cards by contribution
            const topCards = [...pack.cards]
              .filter(c => c.contribution > 0)
              .sort((a, b) => b.contribution - a.contribution)
              .slice(0, 8)

            return (
              <div key={pack.id} style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', padding: 20, marginBottom: 14 }}>
                {/* Pack header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', marginBottom: 4 }}>
                      {pack.set_name.toUpperCase()}
                    </div>
                    <div className="font-display" style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.3px', marginBottom: 4 }}>
                      {pack.pack_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
                      Retail: <span className="font-num" style={{ color: 'var(--ink2)', fontWeight: 600 }}>{fmtCurrency(retail)}</span>
                    </div>
                  </div>
                  {/* EV badge */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 4 }}>EXPECTED VALUE</div>
                    <div className="font-num" style={{ fontSize: 24, fontWeight: 800, color: evColor, letterSpacing: '-0.5px' }}>
                      {fmtCurrency(ev)}
                    </div>
                    <div style={{ fontSize: 10, color: evColor, marginTop: 2, fontWeight: 600 }}>
                      {evPositive ? '+' : ''}{((ratio - 1) * 100).toFixed(0)}% vs retail
                    </div>
                  </div>
                </div>

                {/* EV metrics */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 4 }}>Value per $1 spent</div>
                    <div className="font-num" style={{ fontSize: 15, fontWeight: 700, color: evColor }}>
                      ${ratio.toFixed(2)}
                    </div>
                  </div>
                  {breakevenPacks != null && (
                    <div style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 4 }}>Packs to break even</div>
                      <div className="font-num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                        ~{breakevenPacks}x
                      </div>
                    </div>
                  )}
                  {evPositive && (
                    <div style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 10, background: 'rgba(61,232,138,0.06)', border: '1px solid rgba(61,232,138,0.2)' }}>
                      <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 4 }}>Positive EV</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>Worth opening</div>
                    </div>
                  )}
                </div>

                {/* Top cards table */}
                {topCards.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>TOP CONTRIBUTORS</div>
                    <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      {/* Table header */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 70px', gap: 0, padding: '7px 12px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                        {['Card', 'Pull Rate', 'Price', 'EV Share'].map(h => (
                          <div key={h} style={{ fontSize: 9, fontWeight: 600, color: 'var(--ink3)', letterSpacing: 0.5 }}>{h}</div>
                        ))}
                      </div>
                      {topCards.map((c, i) => (
                        <div
                          key={c.id}
                          style={{
                            display: 'grid', gridTemplateColumns: '1fr 80px 70px 70px', gap: 0,
                            padding: '8px 12px',
                            borderBottom: i < topCards.length - 1 ? '1px solid var(--border)' : 'none',
                            background: 'transparent',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c.card_name}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{c.rarity}</div>
                          </div>
                          <div className="font-num" style={{ fontSize: 12, color: 'var(--ink2)', alignSelf: 'center' }}>
                            {c.pull_rate_pct.toFixed(2)}%
                          </div>
                          <div className="font-num" style={{ fontSize: 12, color: 'var(--ink2)', alignSelf: 'center' }}>
                            {c.price > 0 ? fmtCurrency(c.price) : '—'}
                          </div>
                          <div className="font-num" style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700, alignSelf: 'center' }}>
                            {fmtCurrency(c.contribution)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pack.release_date && (
                  <div style={{ marginTop: 12, fontSize: 10, color: 'var(--ink3)' }}>
                    Released {new Date(pack.release_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </>
  )
}
