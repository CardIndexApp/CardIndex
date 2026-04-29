'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { ptImg } from '@/lib/img'
import { cacheGet, cacheSet, cacheKey } from '@/lib/searchCache'
import { isCardResult } from '@/lib/cardFilter'

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
  color: string
  match: (slug: string, name: string) => boolean
}

// Ordered newest → oldest (matching pokedata.io era structure)
const ERAS: Era[] = [
  {
    id: 'mega',
    label: 'Mega Evolution',
    color: '#c084fc',
    match: (s, n) => {
      // Specific EN set names for the Mega Evolution TCG series
      if (s.includes('ascended-heroes'))   return true
      if (s.includes('phantasmal-flames')) return true
      if (s.includes('perfect-order'))     return true
      // JP ME-coded slugs: me01-…, me02-…, me03-…, mee-…, mep-…
      if (/^me0\d/.test(s) || s.startsWith('mee-') || s.startsWith('mep-')) return true
      // Name starts with a JP set-code prefix like "ME01:", "ME02:", "ME:", "MEE:", "MEP:"
      if (/^me\d*\s*:/.test(n)) return true
      // Exact "Mega Evolution" set family (not "Mega Battle Deck", "Meganium", etc.)
      if (n === 'mega evolution')                       return true
      if (n.startsWith('mega evolution '))              return true
      if (n.startsWith('me: mega evolution'))           return true
      if (n.startsWith('mee: mega evolution'))          return true
      if (n.startsWith('mep: mega evolution'))          return true
      return false
    },
  },
  {
    id: 'sv',
    label: 'Scarlet & Violet',
    color: '#e8613a',
    match: (s) =>
      s.startsWith('sv') || s.includes('scarlet') || s.includes('violet') ||
      s.includes('paldea') || s.includes('paradox') || s.includes('temporal') ||
      s.includes('obsidian') || s.includes('twilight') || s.includes('stellar') ||
      s.includes('shrouded') || s.includes('surging') || s.includes('prismatic') ||
      s.includes('journey-together') || s.includes('destined-rivals') ||
      s.includes('white-flare') || s.includes('black-bolt') ||
      s.includes('trick-or-trade'),
  },
  {
    id: 'swsh',
    label: 'Sword & Shield',
    color: '#3a7be8',
    match: (s) =>
      s.startsWith('swsh') || s.includes('sword') || s.includes('shield') ||
      s.includes('chilling-reign') || s.includes('evolving-skies') || s.includes('fusion-strike') ||
      s.includes('brilliant-stars') || s.includes('astral-radiance') || s.includes('lost-origin') ||
      s.includes('silver-tempest') || s.includes('crown-zenith') || s.includes('vivid-voltage') ||
      s.includes('darkness-ablaze') || s.includes('rebel-clash') || s.includes('battle-styles') ||
      s.includes('shining-fates') || s.includes('champions-path') || s.includes('pokemon-go') ||
      s.includes('celebrations') || s.includes('trading-card-game-classic'),
  },
  {
    id: 'sm',
    label: 'Sun & Moon',
    color: '#e8b83a',
    match: (s) =>
      s.startsWith('sm') || s.includes('sun-moon') || s.includes('guardians-rising') ||
      s.includes('burning-shadows') || s.includes('shining-legends') ||
      s.includes('crimson-invasion') || s.includes('ultra-prism') || s.includes('forbidden-light') ||
      s.includes('celestial-storm') || s.includes('lost-thunder') || s.includes('team-up') ||
      s.includes('detective-pikachu') || s.includes('unbroken-bonds') ||
      s.includes('unified-minds') || s.includes('hidden-fates') || s.includes('cosmic-eclipse') ||
      s.includes('dragon-majesty'),
  },
  {
    id: 'xy',
    label: 'XY',
    color: '#3ae8c8',
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
    color: '#aaa',
    match: (s) =>
      s.startsWith('bw') || s.includes('black-white') || s.includes('black-and-white') ||
      s.includes('emerging-powers') || s.includes('noble-victories') ||
      s.includes('next-destinies') || s.includes('dark-explorers') ||
      s.includes('dragons-exalted') || s.includes('dragon-vault') ||
      s.includes('boundaries-crossed') || s.includes('plasma-storm') ||
      s.includes('plasma-freeze') || s.includes('plasma-blast') ||
      s.includes('legendary-treasures'),
  },
  {
    id: 'col',
    label: 'Call of Legends',
    color: '#60a5fa',
    match: (s) => s.includes('call-of-legends'),
  },
  {
    id: 'hgss',
    label: 'HeartGold SoulSilver',
    color: '#e8c83a',
    match: (s) =>
      s.startsWith('hgss') || s.includes('heartgold') || s.includes('soulsilver') ||
      s.includes('unleashed') || s.includes('undaunted') || s.includes('triumphant'),
  },
  {
    id: 'pl',
    label: 'Platinum',
    color: '#94a3b8',
    match: (s) =>
      s.includes('platinum') || s.includes('rising-rivals') ||
      s.includes('supreme-victors') || s.includes('arceus') ||
      s.includes('pokemon-rumble') || s.includes('pop-series-9'),
  },
  {
    id: 'dp',
    label: 'Diamond & Pearl',
    color: '#a03ae8',
    match: (s) =>
      s.startsWith('dp') || s.includes('diamond-pearl') || s.includes('diamond-and-pearl') ||
      s.includes('mysterious-treasures') || s.includes('secret-wonders') ||
      s.includes('great-encounters') || s.includes('majestic-dawn') ||
      s.includes('legends-awakened') || s.includes('stormfront') ||
      s.includes('pop-series-6') || s.includes('pop-series-7') || s.includes('pop-series-8'),
  },
  {
    id: 'ex',
    label: 'EX Ruby & Sapphire',
    color: '#e83a7b',
    match: (s) =>
      s.startsWith('ex-') || s.includes('ruby-sapphire') || s.includes('sandstorm') ||
      (s.includes('dragon') && !s.includes('dragons-exalted') && !s.includes('dragon-vault')) ||
      s.includes('team-magma') || s.includes('team-aqua') ||
      s.includes('hidden-legends') || s.includes('firered') || s.includes('leafgreen') ||
      s.includes('deoxys') || s.includes('emerald') || s.includes('unseen-forces') ||
      s.includes('delta-species') || s.includes('legend-maker') || s.includes('holon') ||
      s.includes('crystal-guardians') || s.includes('dragon-frontiers') ||
      s.includes('power-keepers') ||
      s.includes('pop-series-2') || s.includes('pop-series-3') ||
      s.includes('pop-series-4') || s.includes('pop-series-5'),
  },
  {
    id: 'ecard',
    label: 'e-Card',
    color: '#3a8ee8',
    match: (s) =>
      s.includes('expedition') || s.includes('aquapolis') || s.includes('skyridge') ||
      s.includes('pop-series-1'),
  },
  {
    id: 'neo',
    label: 'Neo / Gym',
    color: '#3ae860',
    match: (s) =>
      s.includes('neo') || s.includes('gym-heroes') || s.includes('gym-challenge'),
  },
  {
    id: 'vintage',
    label: 'Vintage (WotC)',
    color: '#e8a03a',
    match: (s) =>
      s.includes('base-set') || s.includes('jungle') || s.includes('fossil') ||
      s.includes('team-rocket') || s.includes('base-set-2') || s.includes('southern') ||
      s.includes('wizards') || s.includes('legendary-collection'),
  },
  {
    id: 'promo',
    label: 'Promo & Other',
    color: '#666',
    match: () => true,
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

// ── Grades ─────────────────────────────────────────────────────────────────────

const PSA_GRADES = [
  { label: 'Raw',    sub: 'Ungraded'  },
  { label: 'PSA 10', sub: 'Gem Mint'  },
  { label: 'PSA 9',  sub: 'Mint'      },
  { label: 'PSA 8',  sub: 'NM-Mint'   },
  { label: 'PSA 7',  sub: 'Near Mint' },
  { label: 'PSA 6',  sub: 'Ex-Mt'     },
  { label: 'PSA 5',  sub: 'Excellent' },
  { label: 'PSA 4',  sub: 'VG-Ex'     },
  { label: 'PSA 3',  sub: 'Very Good' },
  { label: 'PSA 2',  sub: 'Good'      },
  { label: 'PSA 1',  sub: 'Poor'      },
]

const VARIANT_LABELS: Record<string, string> = {
  Holofoil:               'Holo',
  Normal:                 'Normal',
  Reverse_Holofoil:       'Rev Holo',
  '1st_Edition_Holofoil': '1st Ed Holo',
  '1st_Edition':          '1st Ed',
  Unlimited:              'Unlimited',
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function CardThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed || !src) return <div style={{ width: 48, height: 67, borderRadius: 6, flexShrink: 0, background: 'var(--surface2)' }} />
  return (
    <img src={src} alt={alt} onError={() => setFailed(true)}
      style={{ width: 48, height: 67, objectFit: 'contain', borderRadius: 6, flexShrink: 0, background: 'var(--surface2)' }} />
  )
}


function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BrowseSetsPage() {
  const router = useRouter()

  const [sets, setSets]           = useState<PtSet[]>([])
  const [jpSets, setJpSets]       = useState<PtSet[]>([])   // always-fetched JP sets for Mega Era
  const [loading, setLoading]     = useState(true)
  const [filterText, setFilterText] = useState('')
  const [lang, setLang]             = useState<'en' | 'jp'>('en')
  // collapsed era ids (all expanded by default)
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set())

  // Per-set card expansion state
  const [expandedSet, setExpandedSet]     = useState<string | null>(null)
  const [setCards, setSetCards]           = useState<PtCard[]>([])
  const [cardsLoading, setCardsLoading]   = useState(false)
  const [cardsCursor, setCardsCursor]     = useState('')
  const [cardsHasMore, setCardsHasMore]   = useState(false)
  const [selectedCard, setSelectedCard]   = useState<PtCard | null>(null)
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)

  // Always fetch JP sets once (for Mega Evolution era, regardless of lang)
  useEffect(() => {
    const KEY = 'sets_all_pokemon-japanese'
    const cached = cacheGet<PtSet[]>(KEY)
    if (cached) { setJpSets(cached); return }
    fetch('/api/pt/sets?game=pokemon-japanese')
      .then(r => r.json())
      .then(json => {
        const data: PtSet[] = json.data ?? []
        setJpSets(data)
        if (data.length > 0) cacheSet(KEY, data)
      })
      .catch(() => {})
  }, [])

  // Load main sets on lang change
  useEffect(() => {
    setLoading(true)
    setSets([])
    setExpandedSet(null)
    setSetCards([])
    setSelectedCard(null)

    const game = lang === 'jp' ? 'pokemon-japanese' : 'pokemon'
    const KEY = `sets_all_${game}`
    const cached = cacheGet<PtSet[]>(KEY)
    if (cached) {
      setSets(cached)
      setLoading(false)
      return
    }
    fetch(`/api/pt/sets?game=${game}`)
      .then(r => r.json())
      .then(json => {
        const data: PtSet[] = json.data ?? []
        setSets(data)
        if (data.length > 0) cacheSet(KEY, data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lang])

  // Group sets by era, sort each group newest first.
  // For the Mega era, merge EN + JP feeds (deduped by slug) so both EN and JP
  // Mega Evolution sets are always visible regardless of the lang toggle.
  const grouped = useMemo(() => {
    const map = new Map<string, PtSet[]>()
    for (const era of ERAS) map.set(era.id, [])

    // Classify main-lang sets (skip mega — handled separately below)
    for (const s of sets) {
      const era = classifyEra(s.slug, s.name)
      if (era !== 'mega') map.get(era)?.push(s)
    }

    // Mega era: always sourced from the JP feed (those slugs resolve in the
    // cards API with game=pokemon-japanese). Deduplicate by normalised name
    // so "ME: Ascended Heroes" and "Ascended Heroes" collapse into one entry.
    // Strip leading set-code prefixes like "ME01: ", "ME: ", "MEE: " etc.
    const stripPrefix = (n: string) =>
      n.replace(/^(ME\d*|MEE|MEP|ME)\s*:\s*/i, '').trim()

    const megaByNorm = new Map<string, PtSet>()
    const jpMegaSets = (lang === 'jp' ? sets : jpSets)
      .filter(s => classifyEra(s.slug, s.name) === 'mega')
    for (const s of jpMegaSets) {
      const norm = stripPrefix(s.name).toLowerCase()
      const existing = megaByNorm.get(norm)
      if (!existing || s.cardCount > existing.cardCount) megaByNorm.set(norm, s)
    }
    map.set('mega', [...megaByNorm.values()])

    // Sort each group by releaseDate descending
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        if (!a.releaseDate && !b.releaseDate) return 0
        if (!a.releaseDate) return 1
        if (!b.releaseDate) return -1
        return b.releaseDate.localeCompare(a.releaseDate)
      })
    }
    return map
  }, [sets, jpSets, lang])

  // Only eras with sets
  const populatedEras = useMemo(
    () => ERAS.filter(e => (grouped.get(e.id)?.length ?? 0) > 0),
    [grouped]
  )

  // Global filter
  const q = filterText.trim().toLowerCase()
  const isFiltering = q.length > 0

  // Determine which game param to use for a given set slug.
  // Check the grouped mega list directly — more reliable than re-running
  // the classifier on a bare slug (e.g. "me01" wouldn't match the keyword).
  function gameForSlug(slug: string): 'pokemon' | 'pokemon-japanese' {
    const megaSlugs = new Set((grouped.get('mega') ?? []).map(s => s.slug))
    if (megaSlugs.has(slug)) return 'pokemon-japanese'
    return lang === 'jp' ? 'pokemon-japanese' : 'pokemon'
  }

  // Load cards for a set
  async function loadSetCards(slug: string, cursor = '') {
    setCardsLoading(true)
    try {
      interface PageData { cards: PtCard[]; hasMore: boolean; nextCursor: string }

      async function fetchPage(game: 'pokemon' | 'pokemon-japanese') {
        const params = new URLSearchParams({ set: slug, limit: '20', game })
        if (cursor) params.set('cursor', cursor)
        const key = cacheKey(params)
        const cached = cacheGet<PageData>(key)
        if (cached) return { ...cached, cards: cached.cards.filter(isCardResult) }
        const res  = await fetch(`/api/pt/cards?${params}`)
        const json = await res.json()
        const cards = (json.data ?? []).filter(isCardResult)
        const result: PageData = {
          cards,
          hasMore:    json.pagination?.hasMore ?? false,
          nextCursor: json.pagination?.nextCursor ?? '',
        }
        if (cards.length > 0) cacheSet<PageData>(key, result)
        return result
      }

      const primaryGame = gameForSlug(slug)
      let result = await fetchPage(primaryGame)

      // Fallback: if primary returned nothing and we haven't tried the other game yet
      if (result.cards.length === 0 && !cursor) {
        const fallbackGame = primaryGame === 'pokemon-japanese' ? 'pokemon' : 'pokemon-japanese'
        const fallback = await fetchPage(fallbackGame)
        if (fallback.cards.length > 0) result = fallback
      }

      if (cursor) {
        setSetCards(prev => [...prev, ...result.cards])
      } else {
        setSetCards(result.cards)
        setSelectedCard(null)
        setSelectedGrade(null)
      }
      setCardsHasMore(result.hasMore)
      setCardsCursor(result.nextCursor)
    } catch {
      if (!cursor) setSetCards([])
    } finally {
      setCardsLoading(false)
    }
  }

  function handleSetClick(slug: string) {
    if (expandedSet === slug) {
      setExpandedSet(null); setSetCards([]); setSelectedCard(null)
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
    const game = gameForSlug(card.set.slug)
    const params = new URLSearchParams({
      grade, name: card.name, set: card.set.name,
      number: card.cardNumber, set_slug: card.set.slug,
    })
    if (game === 'pokemon-japanese') params.set('game', 'pokemon-japanese')
    router.push(`/card/${card.id}?${params}`)
  }

  function toggleEra(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '72px 16px 100px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <a href="/search" style={{ fontSize: 13, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 18 }}>
            ← Back to search
          </a>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 6 }}>BROWSE</p>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 6, lineHeight: 1.1 }}>
                Browse by set
              </h1>
              <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Pick a set to explore its cards.</p>
            </div>

            {/* EN / JP toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 2,
              background: 'var(--surface)', border: '1.5px solid var(--border2)',
              borderRadius: 10, padding: 3, flexShrink: 0, alignSelf: 'flex-start', marginTop: 4,
            }}>
              {(['en', 'jp'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  padding: '6px 14px', borderRadius: 7,
                  background: lang === l ? (l === 'jp' ? 'rgba(220,50,50,0.15)' : 'rgba(232,197,71,0.12)') : 'transparent',
                  border: `1.5px solid ${lang === l ? (l === 'jp' ? 'rgba(220,50,50,0.6)' : 'var(--gold)') : 'transparent'}`,
                  color: lang === l ? (l === 'jp' ? '#e03232' : 'var(--gold)') : 'var(--ink3)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5, transition: 'all 0.15s',
                }}>
                  {l === 'en' ? '🇺🇸 EN' : '🇯🇵 JP'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Global search */}
        <div style={{ position: 'relative', marginBottom: 28 }}>
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Search all sets…"
            style={{
              width: '100%', padding: '10px 36px 10px 14px', borderRadius: 10,
              background: 'var(--surface)', border: '1.5px solid var(--border2)',
              color: 'var(--ink)', fontSize: 14, outline: 'none',
              boxSizing: 'border-box', WebkitAppearance: 'none', appearance: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
          />
          {filterText && (
            <button onClick={() => setFilterText('')} style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 36,
              background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 18,
            }}>×</button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink3)', fontSize: 14 }}>Loading sets…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {populatedEras.map(era => {
              const eraSets = grouped.get(era.id) ?? []
              const filtered = isFiltering
                ? eraSets.filter(s => s.name.toLowerCase().includes(q))
                : eraSets
              if (isFiltering && filtered.length === 0) return null

              const isCollapsed = collapsed.has(era.id) && !isFiltering

              return (
                <div key={era.id}>
                  {/* Era heading */}
                  <button
                    onClick={() => { if (!isFiltering) toggleEra(era.id) }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      background: 'none', border: 'none', cursor: isFiltering ? 'default' : 'pointer',
                      padding: '0 0 10px', marginBottom: 8,
                      borderBottom: `2px solid ${era.color}33`,
                      textAlign: 'left',
                    }}
                  >
                    {/* Color dot */}
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: era.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: era.color, letterSpacing: 0.5, flex: 1 }}>
                      {era.label.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink3)', marginRight: 6 }}>
                      {filtered.length} set{filtered.length !== 1 ? 's' : ''}
                    </span>
                    {!isFiltering && (
                      <span style={{
                        fontSize: 16, color: 'var(--ink3)', lineHeight: 1,
                        transition: 'transform 0.2s',
                        transform: isCollapsed ? 'none' : 'rotate(90deg)',
                      }}>›</span>
                    )}
                  </button>

                  {/* Sets list */}
                  {!isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {filtered.map(set => {
                        const isExpanded = expandedSet === set.slug
                        return (
                          <div key={set.slug}>
                            <button
                              onClick={() => handleSetClick(set.slug)}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 16px',
                                borderRadius: isExpanded ? '10px 10px 0 0' : 10,
                                background: 'var(--surface)',
                                border: `1.5px solid ${isExpanded ? era.color : 'var(--border)'}`,
                                borderBottom: isExpanded ? '1.5px solid transparent' : undefined,
                                cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
                              }}
                              onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.borderColor = `${era.color}66` }}
                              onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.borderColor = 'var(--border)' }}
                            >
                              {/* Era color accent bar */}
                              <span style={{ width: 3, height: 32, borderRadius: 2, background: era.color, flexShrink: 0, opacity: isExpanded ? 1 : 0.4 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: isExpanded ? era.color : 'var(--ink)', lineHeight: 1.3 }}>{set.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{set.cardCount} cards{set.releaseDate ? ` · ${formatDate(set.releaseDate)}` : ''}</div>
                              </div>
                              <span style={{
                                fontSize: 20, color: isExpanded ? era.color : 'var(--ink3)',
                                flexShrink: 0, lineHeight: 1, transition: 'transform 0.2s, color 0.15s',
                                transform: isExpanded ? 'rotate(90deg)' : 'none',
                              }}>›</span>
                            </button>

                            {isExpanded && (
                              <div className="set-expand-panel" style={{ borderColor: era.color }}>
                                {cardsLoading && setCards.length === 0 ? (
                                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink3)', fontSize: 13 }}>Loading cards…</div>
                                ) : setCards.length === 0 ? (
                                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink3)', fontSize: 13 }}>No cards found</div>
                                ) : (
                                  <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                      {setCards.map(card => {
                                        const isCardSelected = selectedCard?.id === card.id
                                        const variant = card.variant && card.variant !== 'Normal'
                                          ? (VARIANT_LABELS[card.variant] ?? card.variant)
                                          : null
                                        return (
                                          <div key={card.id}>
                                            <button
                                              onClick={() => handleCardClick(card)}
                                              style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                                padding: '10px 12px', minHeight: 60,
                                                borderRadius: isCardSelected ? '10px 10px 0 0' : 8,
                                                background: 'var(--surface2)',
                                                border: `1.5px solid ${isCardSelected ? `${era.color}99` : 'var(--border2)'}`,
                                                borderBottom: isCardSelected ? '1.5px solid transparent' : undefined,
                                                cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
                                              }}
                                              onMouseEnter={e => { if (!isCardSelected) e.currentTarget.style.borderColor = `${era.color}55` }}
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
                                                fontSize: 18, color: isCardSelected ? era.color : 'var(--ink3)',
                                                flexShrink: 0, lineHeight: 1,
                                                transition: 'transform 0.2s, color 0.15s',
                                                transform: isCardSelected ? 'rotate(90deg)' : 'none',
                                              }}>›</span>
                                            </button>

                                            {/* Grade picker */}
                                            {isCardSelected && (
                                              <div style={{
                                                border: `1.5px solid ${era.color}99`, borderTop: 'none',
                                                borderRadius: '0 0 10px 10px',
                                                background: 'var(--surface2)',
                                                padding: '12px 12px 14px',
                                              }}>
                                                <p style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 10 }}>SELECT GRADE</p>
                                                <div className="sets-grade-grid">
                                                  {PSA_GRADES.map(g => (
                                                    <button
                                                      key={g.label}
                                                      onClick={() => handleGrade(g.label, card)}
                                                      style={{
                                                        padding: '10px 4px', borderRadius: 8, minHeight: 52,
                                                        cursor: 'pointer', textAlign: 'center',
                                                        background: selectedGrade === g.label ? `${era.color}18` : 'var(--surface)',
                                                        border: `1.5px solid ${selectedGrade === g.label ? era.color : 'var(--border2)'}`,
                                                        transition: 'all 0.15s',
                                                      }}
                                                      onMouseEnter={e => {
                                                        if (selectedGrade !== g.label) {
                                                          e.currentTarget.style.borderColor = era.color
                                                          e.currentTarget.style.background = `${era.color}0d`
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
                                                        fontSize: g.label === 'Raw' ? 13 : 11, fontWeight: 700, lineHeight: 1.2,
                                                        color: selectedGrade === g.label ? era.color : 'var(--ink)',
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
                                    {cardsHasMore && (
                                      <button
                                        onClick={() => loadSetCards(expandedSet!, cardsCursor)}
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
                </div>
              )
            })}
          </div>
        )}
      </main>

      <style>{`
        .sets-grade-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }
        @media (max-width: 480px) {
          .sets-grade-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
        }
      `}</style>
    </>
  )
}
