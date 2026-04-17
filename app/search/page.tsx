'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

interface TcgSet {
  id: string
  name: string
  series: string
  releaseDate: string
  total: number
  images: { logo: string; symbol: string }
}

interface TcgCard {
  id: string
  name: string
  number: string
  rarity?: string
  set: { id: string; name: string }
  images: { small: string; large: string }
}

const GRADES = [
  { label: 'Raw', sub: 'Ungraded' },
  { label: 'PSA 10', sub: 'Gem Mint' },
  { label: 'PSA 9', sub: 'Mint' },
  { label: 'PSA 8', sub: 'NM-Mint' },
  { label: 'PSA 7', sub: 'Near Mint' },
  { label: 'PSA 6', sub: 'Ex-Mt' },
  { label: 'BGS 10', sub: 'Pristine' },
  { label: 'BGS 9.5', sub: 'Gem Mint' },
  { label: 'CGC 10', sub: 'Pristine' },
  { label: 'CGC 9', sub: 'Mint' },
]

type Step = 1 | 2 | 3

export default function SearchPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)

  // Step 1 — Set selection
  const [sets, setSets] = useState<TcgSet[]>([])
  const [setsLoading, setSetsLoading] = useState(true)
  const [setQuery, setSetQuery] = useState('')
  const [selectedSet, setSelectedSet] = useState<TcgSet | null>(null)

  // Step 2 — Card selection
  const [cardQuery, setCardQuery] = useState('')
  const [cards, setCards] = useState<TcgCard[]>([])
  const [cardsLoading, setCardsLoading] = useState(false)
  const [selectedCard, setSelectedCard] = useState<TcgCard | null>(null)

  // Step 3 — Grade selection
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)

  // Load sets on mount
  useEffect(() => {
    fetch('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250')
      .then(r => r.json())
      .then(d => setSets(d.data || []))
      .catch(() => setSets([]))
      .finally(() => setSetsLoading(false))
  }, [])

  // Load all cards in set when set is selected
  useEffect(() => {
    if (!selectedSet) return
    setCardsLoading(true)
    setCards([])
    fetch(`https://api.pokemontcg.io/v2/cards?q=set.id:${selectedSet.id}&pageSize=250&orderBy=number`)
      .then(r => r.json())
      .then(d => setCards(d.data || []))
      .catch(() => setCards([]))
      .finally(() => setCardsLoading(false))
  }, [selectedSet])

  const filteredSets = sets.filter(s =>
    !setQuery.trim() || s.name.toLowerCase().includes(setQuery.toLowerCase()) || s.series.toLowerCase().includes(setQuery.toLowerCase())
  )

  const filteredCards = cards.filter(c =>
    !cardQuery.trim() || c.name.toLowerCase().includes(cardQuery.toLowerCase()) || c.number.includes(cardQuery)
  )

  // Group sets by series
  const seriesGroups = filteredSets.reduce<Record<string, TcgSet[]>>((acc, s) => {
    if (!acc[s.series]) acc[s.series] = []
    acc[s.series].push(s)
    return acc
  }, {})

  const handleSetSelect = (set: TcgSet) => {
    setSelectedSet(set)
    setSelectedCard(null)
    setSelectedGrade(null)
    setStep(2)
  }

  const handleCardSelect = (card: TcgCard) => {
    setSelectedCard(card)
    setSelectedGrade(null)
    setStep(3)
  }

  const handleGradeSelect = (grade: string) => {
    setSelectedGrade(grade)
    if (selectedCard) {
      router.push(`/card/${selectedCard.id}`)
    }
  }

  const stepLabel = (n: number) => {
    if (n < step) return 'done'
    if (n === step) return 'act'
    return ''
  }

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px 100px' }}>
        {/* Steps indicator */}
        <div style={{ display: 'flex', marginBottom: 40, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 13, height: 1, background: 'var(--border)', zIndex: 0 }} />
          {[
            { n: 1, label: 'SET' },
            { n: 2, label: 'CARD' },
            { n: 3, label: 'GRADE' },
          ].map(({ n, label }) => {
            const state = stepLabel(n)
            return (
              <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    background: state === 'act' ? 'var(--gold)' : state === 'done' ? 'rgba(61,232,138,0.1)' : 'var(--bg)',
                    border: `1.5px solid ${state === 'act' ? 'var(--gold)' : state === 'done' ? 'var(--green)' : 'var(--border2)'}`,
                    color: state === 'act' ? '#080810' : state === 'done' ? 'var(--green)' : 'var(--ink3)',
                    boxShadow: state === 'act' ? '0 0 16px rgba(232,197,71,0.3)' : 'none',
                    cursor: state === 'done' ? 'pointer' : 'default',
                  }}
                  onClick={() => state === 'done' && setStep(n as Step)}
                >
                  {state === 'done' ? '✓' : n}
                </div>
                <span
                  className="font-mono-custom"
                  style={{ fontSize: 9, letterSpacing: 1, color: state === 'act' ? 'var(--gold)' : state === 'done' ? 'var(--green)' : 'var(--ink3)' }}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Step 1: Set */}
        {step === 1 && (
          <div>
            <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8 }}>STEP 1 OF 3</p>
            <h2 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 24 }}>Choose a set</h2>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 24 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink3)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                value={setQuery}
                onChange={e => setSetQuery(e.target.value)}
                placeholder="Filter sets…"
                style={{ width: '100%', paddingLeft: 42, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              />
            </div>

            {setsLoading ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--ink3)', fontSize: 13 }}>Loading sets…</div>
            ) : (
              Object.entries(seriesGroups).map(([series, seriesSets]) => (
                <div key={series} style={{ marginBottom: 28 }}>
                  <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 2, marginBottom: 10 }}>{series.toUpperCase()}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                    {seriesSets.map(set => (
                      <button
                        key={set.id}
                        onClick={() => handleSetSelect(set)}
                        style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '11px 12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 3 }}>{set.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{set.releaseDate?.slice(0, 4)} · {set.total} cards</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Step 2: Card */}
        {step === 2 && selectedSet && (
          <div>
            <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
              ← Back to sets
            </button>
            <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8 }}>STEP 2 OF 3</p>
            <h2 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 4 }}>Choose a card</h2>
            <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 24 }}>{selectedSet.name} · {cards.length} cards</p>

            {/* Filter */}
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink3)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                value={cardQuery}
                onChange={e => setCardQuery(e.target.value)}
                placeholder="Filter cards…"
                style={{ width: '100%', paddingLeft: 42, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              />
            </div>

            {cardsLoading ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--ink3)', fontSize: 13 }}>Loading cards…</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))', gap: 10 }}>
                {filteredCards.map(card => (
                  <button
                    key={card.id}
                    onClick={() => handleCardSelect(card)}
                    style={{ background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', padding: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    {card.images?.small ? (
                      <img src={card.images.small} alt={card.name} style={{ width: '100%', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', paddingTop: '140%', background: 'var(--surface2)' }} />
                    )}
                    <div style={{ padding: '7px 9px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{card.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>#{card.number}</div>
                      {card.rarity && <div style={{ fontSize: 9, color: 'var(--gold)', marginTop: 2, fontWeight: 600 }}>{card.rarity}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Grade */}
        {step === 3 && selectedCard && (
          <div>
            <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
              ← Back to cards
            </button>
            <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8 }}>STEP 3 OF 3</p>
            <h2 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 24 }}>Select grade</h2>

            {/* Selected card summary */}
            <div style={{ display: 'flex', gap: 20, background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 14, padding: 18, marginBottom: 28, alignItems: 'flex-start' }}>
              {selectedCard.images?.small ? (
                <img src={selectedCard.images.small} alt={selectedCard.name} style={{ width: 80, borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,0.6)', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 80, height: 112, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0 }} />
              )}
              <div>
                <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{selectedCard.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 8 }}>{selectedCard.set.name} · #{selectedCard.number}</div>
                {selectedCard.rarity && (
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, background: 'rgba(232,197,71,0.08)', border: '1px solid rgba(232,197,71,0.25)', fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>
                    {selectedCard.rarity}
                  </span>
                )}
              </div>
            </div>

            {/* Grade grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {GRADES.map(g => (
                <button
                  key={g.label}
                  onClick={() => handleGradeSelect(g.label)}
                  style={{
                    background: selectedGrade === g.label ? 'rgba(232,197,71,0.08)' : 'var(--surface)',
                    border: `1.5px solid ${selectedGrade === g.label ? 'var(--gold)' : 'var(--border2)'}`,
                    borderRadius: 10, padding: '10px 4px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { if (selectedGrade !== g.label) e.currentTarget.style.borderColor = 'var(--gold)' }}
                  onMouseLeave={e => { if (selectedGrade !== g.label) e.currentTarget.style.borderColor = 'var(--border2)' }}
                >
                  <span className="font-display" style={{ display: 'block', fontSize: g.label === 'Raw' ? 14 : 16, fontWeight: 700, color: selectedGrade === g.label ? 'var(--gold)' : 'var(--ink)', marginBottom: 2 }}>{g.label}</span>
                  <span style={{ display: 'block', fontSize: 9, color: 'var(--ink3)', fontWeight: 500 }}>{g.sub}</span>
                </button>
              ))}
            </div>

            <p style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 16, textAlign: 'center' }}>
              Select a grade to view market analysis →
            </p>
          </div>
        )}
      </main>
    </>
  )
}
