'use client'
import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { scoreColor } from '@/lib/data'

type SortKey = 'price' | 'change' | 'score' | 'name'
type Filter = 'all' | 'up' | 'down'

const watchlistItems = [
  {
    id: 'umbreon-vmax-alt-psa10',
    name: 'Umbreon VMAX Alt Art',
    set: 'Evolving Skies',
    grade: 'PSA 10',
    price: 2850,
    change: 5.1,
    changeAbs: 138,
    trend: 'up' as const,
    score: 95,
    img: 'https://images.pokemontcg.io/swsh7/215_hires.png',
    alert: 3100,
    sparkline: [1900, 2050, 2200, 2150, 2300, 2450, 2500, 2600, 2700, 2780, 2850],
  },
  {
    id: 'charizard-base-psa9',
    name: 'Charizard Base Set',
    set: 'Base Set',
    grade: 'PSA 9',
    price: 4850,
    change: 12.4,
    changeAbs: 536,
    trend: 'up' as const,
    score: 87,
    img: 'https://images.pokemontcg.io/base1/4_hires.png',
    alert: null,
    sparkline: [3200, 3450, 3380, 3750, 3900, 4100, 4350, 4480, 4600, 4750, 4850],
  },
  {
    id: 'blastoise-base-psa9',
    name: 'Blastoise Base Set',
    set: 'Base Set',
    grade: 'PSA 9',
    price: 1450,
    change: 2.1,
    changeAbs: 30,
    trend: 'up' as const,
    score: 74,
    img: 'https://images.pokemontcg.io/base1/2_hires.png',
    alert: 1600,
    sparkline: [1100, 1140, 1120, 1180, 1220, 1260, 1300, 1340, 1380, 1420, 1450],
  },
  {
    id: 'espeon-vmax-alt-psa10',
    name: 'Espeon VMAX Alt Art',
    set: 'Evolving Skies',
    grade: 'PSA 10',
    price: 320,
    change: -1.4,
    changeAbs: -5,
    trend: 'down' as const,
    score: 79,
    img: 'https://images.pokemontcg.io/swsh7/208_hires.png',
    alert: null,
    sparkline: [240, 255, 265, 258, 272, 285, 292, 308, 318, 325, 320],
  },
  {
    id: 'lugia-v-alt-psa10',
    name: 'Lugia V Alt Art',
    set: 'Silver Tempest',
    grade: 'PSA 10',
    price: 1740,
    change: -8.2,
    changeAbs: -156,
    trend: 'down' as const,
    score: 71,
    img: 'https://images.pokemontcg.io/swsh12/186_hires.png',
    alert: null,
    sparkline: [2200, 2150, 2050, 2100, 1980, 1920, 1870, 1820, 1790, 1760, 1740],
  },
  {
    id: 'rayquaza-vmax-alt-psa10',
    name: 'Rayquaza VMAX Alt Art',
    set: 'Evolving Skies',
    grade: 'PSA 10',
    price: 420,
    change: 6.4,
    changeAbs: 25,
    trend: 'up' as const,
    score: 83,
    img: 'https://images.pokemontcg.io/swsh7/218_hires.png',
    alert: 500,
    sparkline: [295, 305, 312, 308, 320, 335, 348, 370, 390, 408, 420],
  },
  {
    id: 'sylveon-vmax-alt-psa10',
    name: 'Sylveon VMAX Alt Art',
    set: 'Evolving Skies',
    grade: 'PSA 10',
    price: 275,
    change: 4.7,
    changeAbs: 12,
    trend: 'up' as const,
    score: 76,
    img: 'https://images.pokemontcg.io/swsh7/212_hires.png',
    alert: null,
    sparkline: [185, 195, 202, 198, 210, 220, 232, 250, 260, 265, 275],
  },
  {
    id: 'gengar-vmax-alt-psa10',
    name: 'Gengar VMAX Alt Art',
    set: 'Fusion Strike',
    grade: 'PSA 10',
    price: 260,
    change: 3.1,
    changeAbs: 8,
    trend: 'up' as const,
    score: 72,
    img: 'https://images.pokemontcg.io/swsh8/271_hires.png',
    alert: null,
    sparkline: [185, 190, 196, 202, 210, 218, 228, 242, 250, 255, 260],
  },
]

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const w = 80, h = 32
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  const color = up ? '#3de88a' : '#e8524a'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
    </svg>
  )
}

export default function Watchlist() {
  const [sort, setSort] = useState<SortKey>('score')
  const [filter, setFilter] = useState<Filter>('all')
  const [removed, setRemoved] = useState<Set<string>>(new Set())

  const visible = watchlistItems
    .filter(i => !removed.has(i.id))
    .filter(i => filter === 'all' || (filter === 'up' ? i.trend === 'up' : i.trend === 'down'))
    .sort((a, b) => {
      if (sort === 'price') return b.price - a.price
      if (sort === 'change') return b.change - a.change
      if (sort === 'score') return b.score - a.score
      return a.name.localeCompare(b.name)
    })

  const rising = visible.filter(i => i.trend === 'up').length
  const falling = visible.filter(i => i.trend === 'down').length

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 88, paddingBottom: 96, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 0' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Watchlist</p>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px' }}>My Cards</h1>
            </div>
            <Link href="/search" style={{ padding: '9px 20px', borderRadius: 10, background: 'var(--gold)', color: '#080810', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              + Add card
            </Link>
          </div>

          {/* Summary strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Cards watched', value: String(watchlistItems.length - removed.size), sub: 'on your list' },
              { label: 'Rising today', value: String(rising), sub: 'cards up', color: 'var(--green)' },
              { label: 'Falling today', value: String(falling), sub: 'cards down', color: 'var(--red)' },
            ].map((s, i) => (
              <div key={i} style={{ borderRadius: 12, padding: '16px 18px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 6 }}>{s.label}</div>
                <div className="font-num" style={{ fontSize: 22, fontWeight: 700, color: s.color ?? 'var(--ink)', letterSpacing: '-0.5px' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 3 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            {/* Filter */}
            <div style={{ display: 'flex', gap: 2, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border2)' }}>
              {(['all', 'up', 'down'] as Filter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: filter === f ? 'var(--surface2)' : 'transparent', color: filter === f ? 'var(--ink)' : 'var(--ink3)', transition: 'all 0.15s' }}>
                  {f === 'all' ? 'All' : f === 'up' ? '▲ Rising' : '▼ Falling'}
                </button>
              ))}
            </div>
            {/* Sort */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--ink3)' }}>Sort by</span>
              <div style={{ display: 'flex', gap: 2, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border2)' }}>
                {([['score', 'Score'], ['price', 'Price'], ['change', 'Change'], ['name', 'Name']] as [SortKey, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setSort(key)} style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: sort === key ? 'var(--surface2)' : 'transparent', color: sort === key ? 'var(--ink)' : 'var(--ink3)', transition: 'all 0.15s' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {/* Table header */}
            <div className="wl-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase' }}>Card</span>
              <span style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'right' }}>Price</span>
              <span style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'right' }}>24h Change</span>
              <span className="wl-hide-mobile" style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>30d Trend</span>
              <span className="wl-hide-mobile" style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>Score</span>
              <span />
            </div>

            {visible.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 12 }}>No cards match this filter.</div>
                <button onClick={() => setFilter('all')} style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer' }}>Show all</button>
              </div>
            ) : visible.map((item, i) => (
              <Link
                key={item.id}
                href={`/card/${item.id}`}
                className="wl-row"
                style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', background: 'transparent', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Card name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 7, background: 'var(--surface2)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                    <img src={item.img} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{item.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{item.set}</span>
                      <span style={{ fontSize: 10, color: 'var(--border2)' }}>·</span>
                      <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{item.grade}</span>
                      {item.alert && (
                        <>
                          <span style={{ fontSize: 10, color: 'var(--border2)' }}>·</span>
                          <span style={{ fontSize: 9, color: 'var(--gold)', background: 'var(--gold2)', border: '1px solid rgba(232,197,71,0.2)', borderRadius: 4, padding: '1px 5px', letterSpacing: 0.5 }}>
                            ALERT ${item.alert.toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div style={{ textAlign: 'right' }}>
                  <div className="font-num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>${item.price.toLocaleString()}</div>
                </div>

                {/* 24h change */}
                <div style={{ textAlign: 'right' }}>
                  <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: item.trend === 'up' ? 'var(--green)' : 'var(--red)' }}>
                    {item.trend === 'up' ? '+' : ''}{item.change}%
                  </div>
                  <div className="font-num" style={{ fontSize: 11, color: item.trend === 'up' ? 'var(--green)' : 'var(--red)', opacity: 0.7, marginTop: 1 }}>
                    {item.changeAbs > 0 ? '+' : ''}${item.changeAbs}
                  </div>
                </div>

                {/* Sparkline */}
                <div className="wl-hide-mobile" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Sparkline data={item.sparkline} up={item.trend === 'up'} />
                </div>

                {/* Score */}
                <div className="wl-hide-mobile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span className="font-num" style={{ fontSize: 15, fontWeight: 700, color: scoreColor(item.score) }}>{item.score}</span>
                  <div style={{ width: 40, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${item.score}%`, background: scoreColor(item.score), borderRadius: 2 }} />
                  </div>
                </div>

                {/* Remove */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); setRemoved(prev => new Set([...prev, item.id])) }}
                    style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink3)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink3)' }}
                    title="Remove from watchlist"
                  >
                    ×
                  </button>
                </div>
              </Link>
            ))}
          </div>

          <p style={{ fontSize: 11, color: 'var(--ink3)', textAlign: 'center', marginTop: 24 }}>
            Watchlist is saved locally · Sign up to sync across devices
          </p>
        </div>
      </main>
    </>
  )
}
