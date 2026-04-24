'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

// ── Types from Poketrace API ─────────────────────────────────────────────────

interface PtSet {
  slug: string
  name: string
  releaseDate: string | null
  cardCount: number
}

interface PtCard {
  id: string          // Poketrace UUID — used directly as card page ID
  name: string
  cardNumber: string
  set: { slug: string; name: string }
  variant: string
  rarity: string | null
  image: string
}

interface Pagination {
  hasMore: boolean
  nextCursor: string | null
  count: number
}

// ── Era groupings ────────────────────────────────────────────────────────────
// Poketrace releaseDate is always null for all sets. We derive era from a
// combination of slug prefix patterns and known named slugs from the live API.
// Listed newest → oldest.

const ERAS = [
  { key: 'me',    label: 'Mega Evolution'         },
  { key: 'sv',    label: 'Scarlet & Violet'      },
  { key: 'swsh',  label: 'Sword & Shield'         },
  { key: 'sm',    label: 'Sun & Moon'             },
  { key: 'xy',    label: 'XY'                     },
  { key: 'bw',    label: 'Black & White'          },
  { key: 'hgss',  label: 'HeartGold & SoulSilver' },
  { key: 'dp',    label: 'Diamond & Pearl'        },
  { key: 'ex',    label: 'EX Series'              },
  { key: 'ecard', label: 'E-Card'                 },
  { key: 'classic', label: 'Classic'              },
  { key: 'other', label: 'Other'                  },
]

// Named slugs that don't carry an era prefix — mapped by era (newest first).
// Derived from live Poketrace API dump (452 sets, game=pokemon).
const NAMED_ERA: Record<string, string> = {
  // ── Mega Evolution ────────────────────────────────────────────────────────
  'mega-evolution': 'me', 'mega-evolution-additionals': 'me',
  'mega-evolution-energies': 'me', 'mega-evolution-products': 'me',
  // ── Scarlet & Violet ──────────────────────────────────────────────────────
  '151': 'sv', 'paldea-evolved': 'sv', 'paldean-fates': 'sv',
  'paradox-rift': 'sv', 'obsidian-flames': 'sv', 'twilight-masquerade': 'sv',
  'stellar-crown': 'sv', 'shrouded-fable': 'sv', 'journey-together': 'sv',
  'journey-together-additionals': 'sv', 'destined-rivals': 'sv',
  'destined-rivals-additionals': 'sv', 'ascended-heroes': 'sv',
  'ascended-heroes-additionals': 'sv', 'phantasmal-flames': 'sv',
  'phantasmal-flames-additionals': 'sv', 'perfect-order': 'sv',
  'perfect-order-additionals': 'sv', 'brilliant-fantasy': 'sv',
  'black-bolt': 'sv', 'black-bolt-additionals': 'sv',
  'white-flare': 'sv', 'white-flare-additionals': 'sv',
  'chaos-rising': 'sv', 'alternate-art-promos': 'sv',
  // ── Sword & Shield ────────────────────────────────────────────────────────
  'sword-and-shield': 'swsh', 'rebel-clash': 'swsh',
  'darkness-ablaze': 'swsh', 'vivid-voltage': 'swsh',
  'battle-styles': 'swsh', 'chilling-reign': 'swsh',
  'evolving-skies': 'swsh', 'fusion-strike': 'swsh',
  'brilliant-stars': 'swsh', 'astral-radiance': 'swsh',
  'lost-origin': 'swsh', 'silver-tempest': 'swsh',
  'crown-zenith': 'swsh', 'crown-zenith-galarian-gallery': 'swsh',
  'celebrations': 'swsh', 'celebrations-classic-collection': 'swsh',
  'champions-path': 'swsh', 'shining-fates': 'swsh', 'pokemon-go': 'swsh',
  // ── Sun & Moon ────────────────────────────────────────────────────────────
  'sun-and-moon': 'sm', 'guardians-rising': 'sm', 'burning-shadows': 'sm',
  'crimson-invasion': 'sm', 'ultra-prism': 'sm', 'forbidden-light': 'sm',
  'celestial-storm': 'sm', 'dragon-majesty': 'sm', 'lost-thunder': 'sm',
  'team-up': 'sm', 'unbroken-bonds': 'sm', 'unified-minds': 'sm',
  'cosmic-eclipse': 'sm', 'hidden-fates': 'sm',
  'hidden-fates-shiny-vault': 'sm', 'shining-legends': 'sm',
  // ── XY ───────────────────────────────────────────────────────────────────
  'flashfire': 'xy', 'furious-fists': 'xy', 'phantom-forces': 'xy',
  'primal-clash': 'xy', 'roaring-skies': 'xy', 'ancient-origins': 'xy',
  'breakpoint': 'xy', 'breakthrough': 'xy', 'fates-collide': 'xy',
  'steam-siege': 'xy', 'evolutions': 'xy', 'generations': 'xy',
  'generations-radiant-collection': 'xy', 'kalos-starter-set': 'xy',
  'double-crisis': 'xy',
  // ── Black & White ─────────────────────────────────────────────────────────
  'black-and-white': 'bw', 'black-white': 'bw', 'emerging-powers': 'bw',
  'noble-victories': 'bw', 'next-destinies': 'bw', 'dark-explorers': 'bw',
  'dragons-exalted': 'bw', 'dragon-vault': 'bw', 'boundaries-crossed': 'bw',
  'plasma-storm': 'bw', 'plasma-freeze': 'bw', 'plasma-blast': 'bw',
  'legendary-treasures': 'bw', 'legendary-treasures-radiant-collection': 'bw',
  // ── HeartGold & SoulSilver ────────────────────────────────────────────────
  'heartgold-soulsilver': 'hgss', 'unleashed': 'hgss',
  'undaunted': 'hgss', 'triumphant': 'hgss', 'call-of-legends': 'hgss',
  // ── Diamond & Pearl / Platinum ────────────────────────────────────────────
  'diamond-and-pearl': 'dp', 'diamond-pearl': 'dp',
  'mysterious-treasures': 'dp', 'secret-wonders': 'dp',
  'great-encounters': 'dp', 'majestic-dawn': 'dp',
  'legends-awakened': 'dp', 'stormfront': 'dp',
  'platinum': 'dp', 'rising-rivals': 'dp', 'supreme-victors': 'dp',
  'arceus': 'dp',
  // ── EX Series ─────────────────────────────────────────────────────────────
  'sandstorm': 'ex', 'deoxys': 'ex', 'emerald': 'ex',
  'firered-and-leafgreen': 'ex', 'hidden-legends': 'ex',
  'holon-phantoms': 'ex', 'crystal-guardians': 'ex',
  'legend-maker': 'ex', 'delta-species': 'ex', 'dragon-frontiers': 'ex',
  'power-keepers': 'ex', 'team-rocket-returns': 'ex',
  // ── E-Card ────────────────────────────────────────────────────────────────
  'aquapolis': 'ecard', 'skyridge': 'ecard',
  'expedition': 'ecard', 'expedition-base-set': 'ecard',
  'legendary-collection': 'ecard',
  // ── Classic ───────────────────────────────────────────────────────────────
  'base-set': 'classic', 'base-set-shadowless': 'classic',
  'base-set-2': 'classic', 'jungle': 'classic', 'fossil': 'classic',
  'team-rocket': 'classic', 'gym-heroes': 'classic', 'gym-challenge': 'classic',
  'neo-genesis': 'classic', 'neo-discovery': 'classic',
  'neo-revelation': 'classic', 'neo-destiny': 'classic',
}

// Accent colour per era — used for card left-borders, section headers, and filter pills
const ERA_COLORS: Record<string, string> = {
  me:      '#a855f7', // violet
  sv:      '#ef4444', // red
  swsh:    '#14b8a6', // teal
  sm:      '#f97316', // orange
  xy:      '#3b82f6', // blue
  bw:      '#8b8fa8', // slate
  hgss:    '#eab308', // gold
  dp:      '#818cf8', // indigo
  ex:      '#e11d48', // rose-red
  ecard:   '#22c55e', // green
  classic: '#d97706', // amber
  other:   '#4b5563', // gray
}

function getSetEra(slug: string): string {
  // 1. Named lookup (most accurate)
  if (NAMED_ERA[slug]) return NAMED_ERA[slug]
  // 2. Prefix patterns
  if (/^sv\d|^sv-|^sve-/.test(slug)) return 'sv'
  if (/^me\d|^me-|^mee-|^mep-/.test(slug)) return 'me'
  if (/^swsh/.test(slug)) return 'swsh'
  if (/^sm\d|^sm-/.test(slug)) return 'sm'
  if (/^xy/.test(slug)) return 'xy'
  if (/^bw/.test(slug)) return 'bw'
  if (/^hgss|^hs-/.test(slug)) return 'hgss'
  if (/^dp-|^dp\d/.test(slug)) return 'dp'
  if (/^ex-/.test(slug)) return 'ex'
  if (/^sandstorm-/.test(slug)) return 'ex' // EX Sandstorm variants
  return 'other'
}

// ── Constants ────────────────────────────────────────────────────────────────

const GRADES = [
  { label: 'Raw',     sub: 'Ungraded'  },
  { label: 'PSA 10',  sub: 'Gem Mint'  },
  { label: 'PSA 9',   sub: 'Mint'      },
  { label: 'PSA 8',   sub: 'NM-Mint'   },
  { label: 'PSA 7',   sub: 'Near Mint' },
  { label: 'PSA 6',   sub: 'Ex-Mt'     },
  { label: 'BGS 10',  sub: 'Pristine'  },
  { label: 'BGS 9.5', sub: 'Gem Mint'  },
  { label: 'CGC 10',  sub: 'Pristine'  },
  { label: 'CGC 9',   sub: 'Mint'      },
]

const VARIANT_LABELS: Record<string, string> = {
  Holofoil:            'Holo',
  Normal:              'Normal',
  Reverse_Holofoil:    'Rev Holo',
  '1st_Edition_Holofoil': '1st Ed Holo',
  '1st_Edition':       '1st Ed',
  Unlimited:           'Unlimited',
}

type Step = 1 | 2 | 3

// ── Components ───────────────────────────────────────────────────────────────


function CardImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed || !src) {
    return <div style={{ width: '100%', paddingTop: '140%', background: 'var(--surface2)' }} />
  }
  return (
    <img
      src={src}
      alt={alt}
      style={{ width: '100%', display: 'block' }}
      onError={() => setFailed(true)}
    />
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)

  // Step 1 — Set selection
  const [sets, setSets] = useState<PtSet[]>([])
  const [setsLoading, setSetsLoading] = useState(true)
  const [setQuery, setSetQuery] = useState('')
  const [selectedSet, setSelectedSet] = useState<PtSet | null>(null)
  const [selectedEra, setSelectedEra] = useState<string | null>(null)

  // Step 2 — Card selection
  const [cards, setCards] = useState<PtCard[]>([])
  const [cardsPagination, setCardsPagination] = useState<Pagination>({ hasMore: false, nextCursor: null, count: 0 })
  const [cardsLoading, setCardsLoading] = useState(false)
  const [cardsLoadingMore, setCardsLoadingMore] = useState(false)
  const [cardQuery, setCardQuery] = useState('')
  const [selectedCard, setSelectedCard] = useState<PtCard | null>(null)
  const cardSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 3 — Grade selection
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)

  // ── All sets (loaded once) ────────────────────────────────────────────────
  const [allSets, setAllSets] = useState<PtSet[]>([])

  useEffect(() => {
    fetch('/api/pt/sets')
      .then(r => r.json())
      .then(d => {
        const data = d.data ?? []
        setAllSets(data)
        setSets(data) // set both at once — avoids flash of "No sets found"
      })
      .catch(() => { setAllSets([]); setSets([]) })
      .finally(() => setSetsLoading(false))
  }, [])

  // ── Filter sets client-side when query changes ────────────────────────────
  const setSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (setSearchTimeout.current) clearTimeout(setSearchTimeout.current)
    const q = setQuery.trim().toLowerCase()
    if (!q) {
      setSets(allSets)
      return
    }
    setSearchTimeout.current = setTimeout(() => {
      setSets(allSets.filter(s => s.name.toLowerCase().includes(q)))
    }, 150)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setQuery, allSets])

  // ── Load cards when set selected ──────────────────────────────────────────
  const loadCardsForSet = useCallback((slug: string, cursor?: string) => {
    const url = `/api/pt/cards?set=${encodeURIComponent(slug)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    return fetch(url).then(r => r.json())
  }, [])

  const handleSetSelect = useCallback((set: PtSet) => {
    setSelectedSet(set)
    setSelectedCard(null)
    setSelectedGrade(null)
    setCardQuery('')
    setCards([])
    setStep(2)
    setCardsLoading(true)
    loadCardsForSet(set.slug)
      .then(d => { setCards(d.data ?? []); setCardsPagination(d.pagination ?? { hasMore: false }) })
      .catch(() => setCards([]))
      .finally(() => setCardsLoading(false))
  }, [loadCardsForSet])

  // ── Debounced card search within set ─────────────────────────────────────
  useEffect(() => {
    if (!selectedSet) return
    if (cardSearchTimeout.current) clearTimeout(cardSearchTimeout.current)

    const q = cardQuery.trim()
    if (!q) {
      // Reset to full set listing
      setCardsLoading(true)
      loadCardsForSet(selectedSet.slug)
        .then(d => { setCards(d.data ?? []); setCardsPagination(d.pagination ?? { hasMore: false }) })
        .catch(() => setCards([]))
        .finally(() => setCardsLoading(false))
      return
    }

    cardSearchTimeout.current = setTimeout(() => {
      setCardsLoading(true)
      // If the query looks like a card number (digits, optional leading #, optional /total),
      // pass it as card_number rather than search (which is name-only in the Poketrace API).
      const isNumber = /^#?\d+(?:\/\d+)?$/.test(q)
      const qClean   = q.replace(/^#/, '') // strip leading # from number queries
      const qParam   = isNumber
        ? `card_number=${encodeURIComponent(qClean)}`
        : `search=${encodeURIComponent(q)}`
      fetch(`/api/pt/cards?set=${encodeURIComponent(selectedSet.slug)}&${qParam}`)
        .then(r => r.json())
        .then(d => { setCards(d.data ?? []); setCardsPagination(d.pagination ?? { hasMore: false }) })
        .catch(() => setCards([]))
        .finally(() => setCardsLoading(false))
    }, 300)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardQuery, selectedSet])

  // ── Load more cards ───────────────────────────────────────────────────────
  const loadMoreCards = useCallback(async () => {
    if (!selectedSet || !cardsPagination.nextCursor || cardsLoadingMore) return
    setCardsLoadingMore(true)
    const q        = cardQuery.trim()
    const isNumber = /^#?\d+(?:\/\d+)?$/.test(q)
    const qClean   = q.replace(/^#/, '')
    const qParam   = q ? (isNumber ? `&card_number=${encodeURIComponent(qClean)}` : `&search=${encodeURIComponent(q)}`) : ''
    const url = `/api/pt/cards?set=${encodeURIComponent(selectedSet.slug)}&cursor=${encodeURIComponent(cardsPagination.nextCursor)}${qParam}`
    fetch(url)
      .then(r => r.json())
      .then(d => { setCards(prev => [...prev, ...(d.data ?? [])]); setCardsPagination(d.pagination ?? { hasMore: false }) })
      .catch(() => {})
      .finally(() => setCardsLoadingMore(false))
  }, [selectedSet, cardsPagination.nextCursor, cardsLoadingMore, cardQuery])

  const handleCardSelect = useCallback((card: PtCard) => {
    setSelectedCard(card)
    setSelectedGrade(null)
    setStep(3)
  }, [])

  const handleGradeSelect = useCallback((grade: string, card: PtCard | null) => {
    setSelectedGrade(grade)
    if (!card) return
    const params = new URLSearchParams({
      grade,
      name: card.name,
      set:  card.set.name,
      number: card.cardNumber,
    })
    // Use Poketrace UUID as the card page ID — no translation needed
    router.push(`/card/${card.id}?${params.toString()}`)
  }, [router])

  // ── Set grouping by era (slug-derived, newest → oldest) ──────────────────
  const eraGroups = useMemo(() => {
    const groups: Record<string, PtSet[]> = {}
    for (const s of sets) {
      const key = getSetEra(s.slug)
      if (!groups[key]) groups[key] = []
      groups[key].push(s)
    }
    // Within each era sort by slug descending (sv09 > sv08 > sv01 etc.)
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => b.slug.localeCompare(a.slug))
    }
    return ERAS
      .filter(e => groups[e.key]?.length > 0)
      .map(e => ({ key: e.key, label: e.label, sets: groups[e.key] }))
  }, [sets])

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
          {[{ n: 1, label: 'SET' }, { n: 2, label: 'CARD' }, { n: 3, label: 'GRADE' }].map(({ n, label }) => {
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
                <span className="font-mono-custom" style={{ fontSize: 9, letterSpacing: 1, color: state === 'act' ? 'var(--gold)' : state === 'done' ? 'var(--green)' : 'var(--ink3)' }}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        {/* ── Step 1: Set ──────────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8 }}>STEP 1 OF 3</p>
            <h2 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 20 }}>Choose a set</h2>

            <input
              type="text"
              value={setQuery}
              onChange={e => { setSetQuery(e.target.value); setSelectedEra(null) }}
              placeholder="Search sets…"
              autoFocus
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
            />

            {setsLoading ? (
              /* ── Skeleton loader ─────────────────────────────────────────── */
              <div>
                {[6, 8, 5].map((count, i) => (
                  <div key={i} style={{ marginBottom: 32 }}>
                    <div style={{ width: 120, height: 10, background: 'var(--surface2)', borderRadius: 4, marginBottom: 14, opacity: 0.5 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                      {Array.from({ length: count }).map((_, j) => (
                        <div key={j} style={{ height: 58, background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--border2)', borderRadius: 8, opacity: 0.45 }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : sets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink3)', fontSize: 13 }}>No sets found</div>
            ) : (
              <>
                {/* ── Era filter pills ─────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 28, scrollbarWidth: 'none' }}>
                  <button
                    onClick={() => setSelectedEra(null)}
                    style={{
                      padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                      background: !selectedEra ? 'var(--gold)' : 'var(--surface)',
                      border: `1px solid ${!selectedEra ? 'var(--gold)' : 'var(--border2)'}`,
                      color: !selectedEra ? '#080810' : 'var(--ink3)',
                      transition: 'all 0.15s', whiteSpace: 'nowrap',
                    }}
                  >All eras</button>
                  {eraGroups.map(({ key, label }) => {
                    const c = ERA_COLORS[key] ?? ERA_COLORS.other
                    const active = selectedEra === key
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedEra(active ? null : key)}
                        style={{
                          padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                          background: active ? `${c}22` : 'var(--surface)',
                          border: `1px solid ${active ? c : 'var(--border2)'}`,
                          color: active ? c : 'var(--ink3)',
                          transition: 'all 0.15s', whiteSpace: 'nowrap',
                        }}
                      >{label}</button>
                    )
                  })}
                </div>

                {/* ── Era groups ───────────────────────────────────────────── */}
                {eraGroups
                  .filter(g => !selectedEra || g.key === selectedEra)
                  .map(({ key, label, sets: eraSets }) => {
                    const eraColor = ERA_COLORS[key] ?? ERA_COLORS.other
                    return (
                      <div key={key} style={{ marginBottom: 36 }}>

                        {/* Era heading */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <div style={{ width: 3, height: 16, borderRadius: 2, background: eraColor, flexShrink: 0 }} />
                          <span className="font-mono-custom" style={{ fontSize: 10, fontWeight: 700, color: eraColor, letterSpacing: 1.5 }}>
                            {label.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--ink3)' }}>· {eraSets.length} sets</span>
                        </div>

                        {/* Set cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                          {eraSets.map(set => (
                            <button
                              key={set.slug}
                              onClick={() => handleSetSelect(set)}
                              style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderLeft: `3px solid ${eraColor}`,
                                borderRadius: 8,
                                padding: '12px 14px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'var(--gold)'
                                e.currentTarget.style.borderLeftColor = eraColor
                                e.currentTarget.style.transform = 'translateY(-2px)'
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'var(--border)'
                                e.currentTarget.style.borderLeftColor = eraColor
                                e.currentTarget.style.transform = 'none'
                                e.currentTarget.style.boxShadow = 'none'
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
                                {set.name}
                              </span>
                              <span style={{ fontSize: 10, color: 'var(--ink3)' }}>
                                {set.cardCount.toLocaleString()} cards
                              </span>
                            </button>
                          ))}
                        </div>

                      </div>
                    )
                  })}
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Card ──────────────────────────────────────────────────── */}
        {step === 2 && selectedSet && (
          <div>
            <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
              ← Back to sets
            </button>
            <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8 }}>STEP 2 OF 3</p>
            <h2 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 4 }}>Choose a card</h2>
            <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 20 }}>{selectedSet.name} · {selectedSet.cardCount} cards</p>

            <input
              type="text"
              value={cardQuery}
              onChange={e => setCardQuery(e.target.value)}
              placeholder="Search by name or number…"
              autoFocus
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none', marginBottom: 20, boxSizing: 'border-box' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
            />

            {cardsLoading ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--ink3)', fontSize: 13 }}>Loading cards…</div>
            ) : cards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--ink3)', fontSize: 13 }}>No cards found</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))', gap: 10 }}>
                  {cards.map(card => (
                    <button
                      key={card.id}
                      onClick={() => handleCardSelect(card)}
                      style={{ background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', padding: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                      <CardImage src={card.image} alt={card.name} />
                      <div style={{ padding: '7px 9px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{card.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>#{card.cardNumber}</div>
                        {card.variant && card.variant !== 'Normal' && (
                          <div style={{ fontSize: 9, color: 'var(--ink3)', marginTop: 2 }}>{VARIANT_LABELS[card.variant] ?? card.variant}</div>
                        )}
                        {card.rarity && (
                          <div style={{ fontSize: 9, color: 'var(--gold)', marginTop: 2, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.rarity}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {cardsPagination.hasMore && (
                  <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <button
                      onClick={loadMoreCards}
                      disabled={cardsLoadingMore}
                      style={{ padding: '10px 28px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink3)', fontSize: 12, cursor: 'pointer' }}
                    >
                      {cardsLoadingMore ? 'Loading…' : `Load more cards`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Step 3: Grade ────────────────────────────────────────────────── */}
        {step === 3 && selectedCard && (
          <div>
            <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
              ← Back to cards
            </button>
            <p className="font-mono-custom" style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8 }}>STEP 3 OF 3</p>
            <h2 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 24 }}>Select grade</h2>

            <div className="search-card-summary" style={{ display: 'flex', gap: 20, background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 14, padding: 18, marginBottom: 28, alignItems: 'flex-start' }}>
              {selectedCard.image ? (
                <img src={selectedCard.image} alt={selectedCard.name} style={{ width: 80, borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,0.6)', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 80, height: 112, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0 }} />
              )}
              <div>
                <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{selectedCard.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 6 }}>{selectedCard.set.name} · #{selectedCard.cardNumber}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selectedCard.variant && (
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', fontSize: 11, color: 'var(--ink3)' }}>
                      {VARIANT_LABELS[selectedCard.variant] ?? selectedCard.variant}
                    </span>
                  )}
                  {selectedCard.rarity && (
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, background: 'rgba(232,197,71,0.08)', border: '1px solid rgba(232,197,71,0.25)', fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>
                      {selectedCard.rarity}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="search-grade-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {GRADES.map(g => (
                <button
                  key={g.label}
                  onClick={() => handleGradeSelect(g.label, selectedCard)}
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

      <style>{`
        @media (max-width: 480px) {
          .search-grade-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .search-card-summary { flex-direction: column; align-items: center; text-align: center; }
        }
      `}</style>
    </>
  )
}
