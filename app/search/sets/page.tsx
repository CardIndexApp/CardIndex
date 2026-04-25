'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { ptImg } from '@/lib/img'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PtSet {
  slug: string
  name: string
  releaseDate: string | null
  cardCount: number
  logo?: string
  symbol?: string
}

interface PtCard {
  id: string
  name: string
  cardNumber: string
  set: { slug: string; name: string }
  variant: string
  rarity: string | null
  image: string
}

// ── Era classification ────────────────────────────────────────────────────────

type Era = {
  id: string
  label: string
  match: (slug: string, name: string) => boolean
}

const ERAS: Era[] = [
  {
    id: 'sv',
    label: 'Scarlet & Violet',
    match: (s) =>
      s.startsWith('sv') || s.includes('scarlet') || s.includes('violet') ||
      s.includes('paldea') || s.includes('paradox') || s.includes('temporal') ||
      s.includes('obsidian') || s.includes('twilight') || s.includes('stellar') ||
      s.includes('shrouded') || s.includes('surging') || s.includes('prismatic'),
  },
  {
    id: 'swsh',
    label: 'Sword & Shield',
    match: (s) =>
      s.startsWith('swsh') || s.includes('sword') || s.includes('shield') ||
      s.includes('chilling-reign') || s.includes('evolving') || s.includes('fusion-strike') ||
      s.includes('brilliant-stars') || s.includes('astral') || s.includes('lost-origin') ||
      s.includes('silver-tempest') || s.includes('crown-zenith') || s.includes('vivid-voltage') ||
      s.includes('darkness-ablaze') || s.includes('rebel-clash') || s.includes('battle-styles') ||
      s.includes('shining-fates') || s.includes('champions-path'),
  },
  {
    id: 'sm',
    label: 'Sun & Moon',
    match: (s) =>
      s.startsWith('sm') || s.includes('sun-moon') || s.includes('guardians-rising') ||
      s.includes('burning-shadows') || s.includes('shining-legends') ||
      s.includes('crimson-invasion') || s.includes('ultra-prism') || s.includes('forbidden-light') ||
      s.includes('celestial-storm') || s.includes('lost-thunder') || s.includes('team-up') ||
      s.includes('detective-pikachu') || s.includes('unbroken-bonds') ||
      s.includes('unified-minds') || s.includes('hidden-fates') || s.includes('cosmic-eclipse'),
  },
  {
    id: 'xy',
    label: 'XY',
    match: (s) =>
      s.startsWith('xy') || s.includes('kalos') || s.includes('flashfire') ||
      s.includes('furious-fists') || s.includes('phantom-forces') || s.includes('primal-clash') ||
      s.includes('roaring-skies') || s.includes('ancient-origins') || s.includes('breakthrough') ||
      s.includes('breakpoint') || s.includes('generations') || s.includes('fates-collide') ||
      s.includes('steam-siege') || s.includes('evolutions') || s.includes('double-crisis'),
  },
  {
    id: 'bw',
    label: 'Black & White',
    match: (s) =>
      s.startsWith('bw') || s.includes('black-white') || s.includes('emerging-powers') ||
      s.includes('noble-victories') || s.includes('next-destinies') || s.includes('dark-explorers') ||
      s.includes('dragons-exalted') || s.includes('dragon-vault') || s.includes('boundaries-crossed') ||
      s.includes('plasma-storm') || s.includes('plasma-freeze') || s.includes('plasma-blast') ||
      s.includes('legendary-treasures') || s.includes('legendary-collection'),
  },
  {
    id: 'hgss',
    label: 'HeartGold & SoulSilver',
    match: (s) =>
      s.startsWith('hgss') || s.includes('heartgold') || s.includes('soulsilver') ||
      s.includes('unleashed') || s.includes('undaunted') || s.includes('triumphant') ||
      s.includes('call-of-legends'),
  },
  {
    id: 'dp',
    label: 'Diamond & Pearl',
    match: (s) =>
      s.startsWith('dp') || s.includes('diamond-pearl') || s.includes('mysterious-treasures') ||
      s.includes('secret-wonders') || s.includes('great-encounters') ||
      s.includes('majestic-dawn') || s.includes('legends-awakened') ||
      s.includes('stormfront') || s.includes('platinum') || s.includes('rising-rivals') ||
      s.includes('supreme-victors') || s.includes('arceus'),
  },
  {
    id: 'ex',
    label: 'EX Series',
    match: (s) =>
      s.startsWith('ex-') || s.includes('ruby-sapphire') || s.includes('sandstorm') ||
      s.includes('dragon') || s.includes('team-magma') || s.includes('team-aqua') ||
      s.includes('hidden-legends') || s.includes('firered') || s.includes('leafgreen') ||
      s.includes('deoxys') || s.includes('emerald') || s.includes('unseen-forces') ||
      s.includes('delta-species') || s.includes('legend-maker') || s.includes('holon') ||
      s.includes('crystal-guardians') || s.includes('dragon-frontiers') ||
      s.includes('power-keepers'),
  },
  {
    id: 'ecard',
    label: 'e-Card',
    match: (s) =>
      s.includes('expedition') || s.includes('aquapolis') || s.includes('skyridge'),
  },
  {
    id: 'neo',
    label: 'Neo / Gym',
    match: (s) =>
      s.includes('neo') || s.includes('gym-heroes') || s.includes('gym-challenge'),
  },
  {
    id: 'vintage',
    label: 'Vintage (WotC)',
    match: (s) =>
      s.includes('base-set') || s.includes('jungle') || s.includes('fossil') ||
      s.includes('team-rocket') || s.includes('base-set-2') || s.includes('southern') ||
      s.includes('wizards') || s.includes('legendary-collection'),
  },
  {
    id: 'promo',
    label: 'Promo & Other',
    match: () => true, // catch-all
  },
]

function classifyEra(slug: string, name: string): string {
  const s = slug.toLowerCase()
  const n = name.toLowerCase()
  for (const era of ERAS) {
    if (era.match(s, n)) return era.id
  }
  return 'promo'
}

// ── Grade constants ────────────────────────────────────────────────────────────

const GRADES = [
  { label: 'Raw',     sub: 'Ungraded'  },
  { label: 'PSA 10',  sub: 'Gem Mint'  },
  { label: 'PSA 9',   sub: 'Mint'      },
  { label: 'PSA 8',   sub: 'NM-Mint'   },
  { label: 'PSA 7',   sub: 'Near Mint' },
  { label: 'BGS 10',  sub: 'Pristine'  },
  { label: 'BGS 9.5', sub: 'Gem Mint'  },
  { label: 'CGC 10',  sub: 'Pristine'  },
  { label: 'CGC 9',   sub: 'Mint'      },
  { label: 'CGC 9.5', sub: 'Gem Mint'  },
]

const VARIANT_LABELS: Record<string, string> = {
  Holofoil:               'Holo',
  Normal:                 'Normal',
  Reverse_Holofoil:       'Rev Holo',
  '1st_Edition_Holofoil': '1st Ed Holo',
  '1st_Edition':          '1st Ed',
  Unlimited:              'Unlimited',
}

// ── Card thumbnail ─────────────────────────────────────────────────────────────

function CardThumb({ src, alt, width = 48, height = 67 }: { src: string; alt: string; width?: number; height?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed || !src) {
    return (
      <div style={{
        width, height, borderRadius: 6, flexShrink: 0,
        background: 'var(--surface2)',
      }} />
    )
  }
  return (
    <img
      src={src} alt={alt} onError={() => setFailed(true)}
      style={{ width, height, objectFit: 'contain', borderRadius: 6, flexShrink: 0, background: 'var(--surface2)' }}
    />
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BrowseSetsPage() {
  const router = useRouter()

  const [sets, setSets]           = useState<PtSet[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeEra, setActiveEra] = useState<string>('sv')
  const [filterText, setFilterText] = useState('')

  // Per-set card state
  const [expandedSet, setExpandedSet]   = useState<string | null>(null)
  const [setCards, setSetCards]         = useState<PtCard[]>([])
  const [cardsLoading, setCardsLoading] = useState(false)
  const [cardsCursor, setCardsCursor]   = useState('')
  const [cardsHasMore, setCardsHasMore] = useState(false)
  const [selectedCard, setSelectedCard] = useState<PtCard | null>(null)
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)

  // Load sets
  useEffect(() => {
    fetch('/api/pt/sets')
      .then(r => r.json())
      .then(json => setSets(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Group sets by era
  const grouped = useMemo(() => {
    const map = new Map<string, PtSet[]>()
    for (const era of ERAS) map.set(era.id, [])
    for (const s of sets) {
      const era = classifyEra(s.slug, s.name)
      map.get(era)?.push(s)
    }
    return map
  }, [sets])

  // Eras that actually have sets
  const activeEras = useMemo(
    () => ERAS.filter(e => (grouped.get(e.id)?.length ?? 0) > 0),
    [grouped]
  )

  // Filtered sets for active era
  const visibleSets = useMemo(() => {
    const all = grouped.get(activeEra) ?? []
    if (!filterText.trim()) return all
    const q = filterText.toLowerCase()
    return all.filter(s => s.name.toLowerCase().includes(q))
  }, [grouped, activeEra, filterText])

  // Load cards for a set
  async function loadSetCards(slug: string, cursor = '') {
    setCardsLoading(true)
    try {
      const params = new URLSearchParams({ set: slug, limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const res  = await fetch(`/api/pt/cards?${params}`)
      const json = await res.json()
      const newCards: PtCard[] = json.data ?? []
      if (cursor) {
        setSetCards(prev => [...prev, ...newCards])
      } else {
        setSetCards(newCards)
        setSelectedCard(null)
        setSelectedGrade(null)
      }
      setCardsHasMore(json.pagination?.hasMore ?? false)
      setCardsCursor(json.pagination?.nextCursor ?? '')
    } catch {
      if (!cursor) setSetCards([])
    } finally {
      setCardsLoading(false)
    }
  }

  function handleSetClick(slug: string) {
    if (expandedSet === slug) {
      setExpandedSet(null)
      setSetCards([])
      setSelectedCard(null)
      return
    }
    setExpandedSet(slug)
    loadSetCards(slug)
  }

  function handleCardClick(card: PtCard) {
    setSelectedCard(prev => prev?.id === card.id ? null : card)
    setSelectedGrade(null)
  }

  function handleGrade(grade: string, card: PtCard) {
    setSelectedGrade(grade)
    const params = new URLSearchParams({
      grade, name: card.name, set: card.set.name,
      number: card.cardNumber, set_slug: card.set.slug,
    })
    router.push(`/card/${card.id}?${params}`)
  }

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '72px 16px 100px' }}>

        {/* Back + header */}
        <div style={{ marginBottom: 24 }}>
          <a
            href="/search"
            style={{ fontSize: 13, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}
          >
            ← Back to search
          </a>
          <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 6 }}>BROWSE</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 6, lineHeight: 1.1 }}>
            Browse by set
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.5 }}>
            Pick an era, then a set to see all its cards.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink3)', fontSize: 14 }}>
            Loading sets…
          </div>
        ) : (
          <>
            {/* Era pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              {activeEras.map(era => (
                <button
                  key={era.id}
                  onClick={() => {
                    setActiveEra(era.id)
                    setExpandedSet(null)
                    setSetCards([])
                    setSelectedCard(null)
                    setFilterText('')
                  }}
                  style={{
                    padding: '6px 14px', borderRadius: 99,
                    border: `1.5px solid ${activeEra === era.id ? 'var(--gold)' : 'var(--border2)'}`,
                    background: activeEra === era.id ? 'rgba(232,197,71,0.1)' : 'var(--surface)',
                    color: activeEra === era.id ? 'var(--gold)' : 'var(--ink3)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  {era.label}
                  <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>
                    {grouped.get(era.id)?.length ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {/* Set filter */}
            {(grouped.get(activeEra)?.length ?? 0) > 6 && (
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <input
                  type="text"
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  placeholder={`Filter ${ERAS.find(e => e.id === activeEra)?.label ?? ''} sets…`}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    background: 'var(--surface)', border: '1.5px solid var(--border2)',
                    color: 'var(--ink)', fontSize: 14, outline: 'none',
                    boxSizing: 'border-box', WebkitAppearance: 'none', appearance: 'none',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                />
                {filterText && (
                  <button
                    onClick={() => setFilterText('')}
                    style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 44, background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 18 }}
                  >×</button>
                )}
              </div>
            )}

            {/* Sets grid */}
            {visibleSets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink3)', fontSize: 14 }}>
                No sets found
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {visibleSets.map(set => {
                  const isExpanded = expandedSet === set.slug

                  return (
                    <div key={set.slug}>
                      {/* Set row */}
                      <button
                        onClick={() => handleSetClick(set.slug)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                          padding: '14px 16px',
                          borderRadius: isExpanded ? '12px 12px 0 0' : 10,
                          background: 'var(--surface)',
                          border: `1.5px solid ${isExpanded ? 'var(--gold)' : 'var(--border)'}`,
                          borderBottom: isExpanded ? '1.5px solid transparent' : undefined,
                          cursor: 'pointer', textAlign: 'left',
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.borderColor = 'rgba(232,197,71,0.4)' }}
                        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.borderColor = 'var(--border)' }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{set.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>{set.cardCount} cards</div>
                        </div>
                        <span style={{
                          fontSize: 20, color: isExpanded ? 'var(--gold)' : 'var(--ink3)',
                          flexShrink: 0, lineHeight: 1,
                          transition: 'transform 0.2s, color 0.15s',
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                        }}>›</span>
                      </button>

                      {/* Expanded: cards */}
                      {isExpanded && (
                        <div style={{
                          border: '1.5px solid var(--gold)', borderTop: 'none',
                          borderRadius: '0 0 12px 12px',
                          background: 'var(--surface)',
                          padding: '12px 14px 14px',
                        }}>
                          {cardsLoading && setCards.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink3)', fontSize: 13 }}>
                              Loading cards…
                            </div>
                          ) : setCards.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink3)', fontSize: 13 }}>
                              No cards found
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {setCards.map(card => {
                                  const isCardSelected = selectedCard?.id === card.id
                                  const variant = card.variant && card.variant !== 'Normal'
                                    ? VARIANT_LABELS[card.variant] ?? card.variant
                                    : null

                                  return (
                                    <div key={card.id}>
                                      <button
                                        onClick={() => handleCardClick(card)}
                                        style={{
                                          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                          padding: '10px 12px',
                                          borderRadius: isCardSelected ? '10px 10px 0 0' : 8,
                                          background: isCardSelected ? 'var(--surface2)' : 'var(--surface2)',
                                          border: `1.5px solid ${isCardSelected ? 'rgba(232,197,71,0.6)' : 'var(--border2)'}`,
                                          borderBottom: isCardSelected ? '1.5px solid transparent' : undefined,
                                          cursor: 'pointer', textAlign: 'left',
                                          transition: 'border-color 0.15s',
                                          minHeight: 60,
                                        }}
                                        onMouseEnter={e => { if (!isCardSelected) e.currentTarget.style.borderColor = 'rgba(232,197,71,0.3)' }}
                                        onMouseLeave={e => { if (!isCardSelected) e.currentTarget.style.borderColor = 'var(--border2)' }}
                                      >
                                        <CardThumb src={ptImg(card.image)} alt={card.name} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{card.name}</span>
                                            <span style={{ fontSize: 11, color: 'var(--ink3)', flexShrink: 0 }}>#{card.cardNumber}</span>
                                          </div>
                                          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
                                            {variant ?? card.rarity ?? ''}
                                          </div>
                                        </div>
                                        <span style={{
                                          fontSize: 18, color: isCardSelected ? 'var(--gold)' : 'var(--ink3)',
                                          flexShrink: 0, lineHeight: 1,
                                          transition: 'transform 0.2s, color 0.15s',
                                          transform: isCardSelected ? 'rotate(90deg)' : 'none',
                                        }}>›</span>
                                      </button>

                                      {/* Inline grade picker */}
                                      {isCardSelected && (
                                        <div style={{
                                          border: '1.5px solid rgba(232,197,71,0.6)', borderTop: 'none',
                                          borderRadius: '0 0 10px 10px',
                                          background: 'var(--surface2)',
                                          padding: '12px 12px 14px',
                                        }}>
                                          <p style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 10 }}>SELECT GRADE</p>
                                          <div className="sets-grade-grid">
                                            {GRADES.map(g => (
                                              <button
                                                key={g.label}
                                                onClick={() => handleGrade(g.label, card)}
                                                style={{
                                                  padding: '10px 4px', borderRadius: 8,
                                                  cursor: 'pointer', textAlign: 'center',
                                                  background: selectedGrade === g.label
                                                    ? 'rgba(232,197,71,0.1)' : 'var(--surface)',
                                                  border: `1.5px solid ${selectedGrade === g.label ? 'var(--gold)' : 'var(--border2)'}`,
                                                  transition: 'all 0.15s',
                                                  minHeight: 52,
                                                }}
                                                onMouseEnter={e => {
                                                  if (selectedGrade !== g.label) {
                                                    e.currentTarget.style.borderColor = 'var(--gold)'
                                                    e.currentTarget.style.background = 'rgba(232,197,71,0.05)'
                                                  }
                                                }}
                                                onMouseLeave={e => {
                                                  if (selectedGrade !== g.label) {
                                                    e.currentTarget.style.borderColor = 'var(--border2)'
                                                    e.currentTarget.style.background = 'var(--surface)'
                                                  }
                                                }}
                                              >
                                                <span style={{
                                                  display: 'block',
                                                  fontSize: g.label === 'Raw' ? 13 : 11,
                                                  fontWeight: 700,
                                                  color: selectedGrade === g.label ? 'var(--gold)' : 'var(--ink)',
                                                  lineHeight: 1.2,
                                                }}>{g.label}</span>
                                                <span style={{ display: 'block', fontSize: 8, color: 'var(--ink3)', marginTop: 2 }}>{g.sub}</span>
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>

                              {/* Load more */}
                              {cardsHasMore && (
                                <button
                                  onClick={() => loadSetCards(set.slug, cardsCursor)}
                                  disabled={cardsLoading}
                                  style={{
                                    width: '100%', marginTop: 10, padding: '10px 0',
                                    borderRadius: 8, border: '1px solid var(--border2)',
                                    background: 'none', color: 'var(--ink3)',
                                    fontSize: 13, cursor: cardsLoading ? 'default' : 'pointer',
                                    opacity: cardsLoading ? 0.5 : 1,
                                  }}
                                >
                                  {cardsLoading ? 'Loading…' : 'Load more cards'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      <style>{`
        /* Grade grid: 5-col desktop → 3-col mobile */
        .sets-grade-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
        }
        @media (max-width: 480px) {
          .sets-grade-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
        }
      `}</style>
    </>
  )
}
