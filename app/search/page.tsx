'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import BetaModal from '@/components/BetaModal'
import { ptImg } from '@/lib/img'
import { cacheGet, cacheSet, cacheKey } from '@/lib/searchCache'
import { isCardResult } from '@/lib/cardFilter'
import { anonLimitReached, incrementAnonSearchCount, anonWindowRemainingMs } from '@/lib/anonSearchLimit'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PtCard {
  id: string
  name: string
  cardNumber: string
  set: { slug: string; name: string }
  variant: string
  rarity: string | null
  image: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GRADES = [
  { label: 'Raw',     sub: 'Ungraded',  graded: false },
  { label: 'PSA 10',  sub: 'Gem Mint',  graded: true  },
  { label: 'PSA 9',   sub: 'Mint',      graded: true  },
  { label: 'PSA 8',   sub: 'NM-Mint',   graded: true  },
  { label: 'PSA 7',   sub: 'Near Mint', graded: true  },
  { label: 'BGS 10',  sub: 'Pristine',  graded: true  },
  { label: 'BGS 9.5', sub: 'Gem Mint',  graded: true  },
  { label: 'CGC 10',  sub: 'Pristine',  graded: true  },
  { label: 'CGC 9',   sub: 'Mint',      graded: true  },
  { label: 'CGC 9.5', sub: 'Gem Mint',  graded: true  },
]

const VARIANT_LABELS: Record<string, string> = {
  Holofoil:               'Holo',
  Normal:                 'Normal',
  Reverse_Holofoil:       'Rev Holo',
  '1st_Edition_Holofoil': '1st Ed Holo',
  '1st_Edition':          '1st Ed',
  Unlimited:              'Unlimited',
}

const MIN_CHARS = 2
const DEBOUNCE_MS = 320

// ── Query parser ──────────────────────────────────────────────────────────────

function parseQuery(q: string): { name: string; number: string | null } {
  const t = q.trim()
  const hashMatch = t.match(/^(.*?)\s*#(\d+)(?:\/\d+)?\s*$/)
  if (hashMatch && hashMatch[1].trim()) return { name: hashMatch[1].trim(), number: hashMatch[2] }
  const trailMatch = t.match(/^(.*?)\s+(\d+(?:\/\d+)?)$/)
  if (trailMatch && trailMatch[1].trim()) return { name: trailMatch[1].trim(), number: trailMatch[2].split('/')[0] }
  return { name: t, number: null }
}

// ── Relevance sort ────────────────────────────────────────────────────────────

function sortByRelevance(cards: PtCard[], q: string): PtCard[] {
  const lq = q.toLowerCase().trim()
  return [...cards].sort((a, b) => {
    const an = a.name.toLowerCase(), bn = b.name.toLowerCase()
    const ra = an === lq ? 0 : an.startsWith(lq) ? 1 : 2
    const rb = bn === lq ? 0 : bn.startsWith(lq) ? 1 : 2
    return ra - rb
  })
}

// ── Card thumbnail ─────────────────────────────────────────────────────────────

function CardThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed || !src) return <div className="search-thumb" style={{ background: 'var(--surface2)', borderRadius: 6, flexShrink: 0 }} />
  return (
    <img
      src={src} alt={alt} onError={() => setFailed(true)}
      className="search-thumb"
      style={{ objectFit: 'contain', borderRadius: 6, flexShrink: 0, background: 'var(--surface2)' }}
    />
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter()

  const [query, setQuery]                   = useState('')
  const [results, setResults]               = useState<PtCard[]>([])
  // staleResults: last non-empty result set — shown as fallback while a new
  // search is loading so the list never flashes to empty mid-type.
  const [staleResults, setStaleResults]     = useState<PtCard[]>([])
  const [loading, setLoading]               = useState(false)
  // committedQuery: the query string whose results are currently displayed.
  // "No results" is only shown when this matches what the user has typed,
  // preventing false empties while the user is still mid-word.
  const [committedQuery, setCommittedQuery] = useState('')
  const [selectedCard, setSelectedCard]     = useState<PtCard | null>(null)
  const [selectedGrade, setSelectedGrade]   = useState<string | null>(null)
  const [isMobile, setIsMobile]             = useState(false)

  // Auth + anon rate-limit
  // null = still resolving auth; true/false = known
  const [isLoggedIn, setIsLoggedIn]       = useState<boolean | null>(null)
  // Keep a ref in sync so runSearch can read the latest value without being
  // recreated every time isLoggedIn changes (which would restart the debounce).
  const isLoggedInRef                     = useRef<boolean | null>(null)
  const [blocked, setBlocked]             = useState(false)   // anon limit reached
  const [showSignup, setShowSignup]       = useState(false)   // auth modal open
  const [cooldownMins, setCooldownMins]   = useState(0)

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef     = useRef<AbortController | null>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const selectedRef  = useRef<HTMLDivElement>(null)

  // Detect mobile + resolve auth on mount
  useEffect(() => {
    setIsMobile(window.matchMedia('(max-width: 700px)').matches)
    createClient().auth.getUser().then(({ data }) => {
      const loggedIn = !!data.user
      setIsLoggedIn(loggedIn)
      isLoggedInRef.current = loggedIn
    })
  }, [])

  // ── Search ────────────────────────────────────────────────────────────────
  // runSearch has NO dependency on isLoggedIn state — it reads from the ref
  // instead. This means runSearch never gets a new reference mid-session,
  // which prevents the debounce useEffect below from re-firing and aborting
  // in-flight requests whenever auth resolves.
  const runSearch = useCallback(async (raw: string) => {
    const { name, number } = parseQuery(raw)
    if (name.length < MIN_CHARS) {
      setResults([])
      setStaleResults([])
      setCommittedQuery('')
      setLoading(false)
      return
    }

    // Cancel any in-flight request so stale responses never overwrite newer ones
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSelectedCard(null)
    setSelectedGrade(null)

    const params = new URLSearchParams({ search: name })
    if (number) params.set('card_number', number)

    // ── Cache check first (never counts toward the rate limit) ───────────────
    const key    = cacheKey(params)
    const cached = cacheGet<PtCard[]>(key)
    if (cached) {
      if (controller.signal.aborted) return
      const filtered = cached.filter(isCardResult)
      setBlocked(false)
      setResults(filtered)
      if (filtered.length > 0) setStaleResults(filtered)
      setCommittedQuery(raw.trim())
      setLoading(false)
      return
    }

    // ── Anon rate-limit gate (only applies to live API calls) ────────────────
    // Read from ref so this closure never goes stale.
    if (isLoggedInRef.current === false && anonLimitReached()) {
      setCooldownMins(Math.ceil(anonWindowRemainingMs() / 60_000))
      setBlocked(true)
      setLoading(false)
      return
    }

    try {
      const res  = await fetch(`/api/pt/cards?${params}`, { signal: controller.signal })
      if (controller.signal.aborted) return
      const json = await res.json()
      const data: PtCard[] = json.data ?? []
      const sorted = sortByRelevance(data, name)
      setBlocked(false)
      setResults(sorted)
      if (sorted.length > 0) {
        setStaleResults(sorted)
        cacheSet(key, data)
        // Only count fresh, successful API calls toward the anon limit
        if (isLoggedInRef.current === false) incrementAnonSearchCount()
      }
      setCommittedQuery(raw.trim())
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setResults([])
      setCommittedQuery(raw.trim())
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, []) // stable — reads isLoggedIn via ref, never recreated

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      // Abort any in-flight fetch immediately when the box is cleared
      if (abortRef.current) abortRef.current.abort()
      setResults([])
      setStaleResults([])
      setCommittedQuery('')
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(() => runSearch(query), DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, runSearch])

  // Scroll selected card + grade picker into view on mobile
  useEffect(() => {
    if (selectedCard && selectedRef.current) {
      setTimeout(() => {
        selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 80)
    }
  }, [selectedCard])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleGrade(grade: string, card: PtCard) {
    setSelectedGrade(grade)
    const params = new URLSearchParams({
      grade, name: card.name, set: card.set.name,
      number: card.cardNumber, set_slug: card.set.slug,
    })
    router.push(`/card/${card.id}?${params}`)
  }

  function handleCardClick(card: PtCard) {
    setSelectedCard(prev => prev?.id === card.id ? null : card)
    setSelectedGrade(null)
  }

  function clearSearch() {
    setQuery(''); setResults([]); setStaleResults([]); setCommittedQuery('')
    inputRef.current?.focus()
  }

  // While a new search is loading, keep showing the previous results so the
  // list never flashes to empty mid-type.
  const displayResults = results.length > 0 ? results : (loading ? staleResults : [])

  const { name: parsedName, number: parsedNumber } = parseQuery(query)
  const showHint = parsedNumber !== null && query.trim().length >= MIN_CHARS

  return (
    <>
      <Navbar />
      {showSignup && <BetaModal onClose={() => setShowSignup(false)} />}
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '72px 16px 100px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 6 }}>SEARCH</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 6, lineHeight: 1.1 }}>
            Find a card
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.5 }}>
            Type a name or add a number — e.g. <em style={{ color: 'var(--ink2)' }}>Charizard ex 6</em>
          </p>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
            {loading
              ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="2" strokeLinecap="round" style={{ animation: 'srch-spin 0.7s linear infinite', display: 'block' }}><path d="M8 1a7 7 0 1 0 7 7"/></svg>
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><circle cx="6.5" cy="6.5" r="4.5"/><path d="M14 14l-3-3"/></svg>
            }
          </div>
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pikachu · Charizard ex 6 · Umbreon #17"
            autoFocus={!isMobile}
            style={{
              width: '100%', padding: '15px 48px 15px 42px',
              borderRadius: 14, background: 'var(--surface)',
              border: '1.5px solid var(--border2)', color: 'var(--ink)',
              fontSize: 16, outline: 'none', boxSizing: 'border-box',
              WebkitAppearance: 'none', appearance: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
          />
          {query && (
            <button
              onClick={clearSearch}
              style={{
                position: 'absolute', right: 0, top: 0, bottom: 0,
                width: 48, background: 'none', border: 'none',
                color: 'var(--ink3)', cursor: 'pointer', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label="Clear search"
            >×</button>
          )}
        </div>

        {/* Parsed hint */}
        {showHint && (
          <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 14, paddingLeft: 2 }}>
            Searching <span style={{ color: 'var(--ink2)' }}>"{parsedName}"</span> · card #{parsedNumber}
          </p>
        )}

        {/* Empty state — browse fallback */}
        {!committedQuery && !loading && (
          <div style={{ textAlign: 'center', marginTop: 56, padding: '0 8px' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <p style={{ fontSize: 14, color: 'var(--ink2)', fontWeight: 600, marginBottom: 6 }}>
              Search any Pokémon card
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 28, lineHeight: 1.6 }}>
              Results appear as you type.<br />Add a card number to get exact matches.
            </p>
            <a
              href="/search/sets"
              className="srch-browse-btn"
              style={{
                display: 'block', padding: '14px 0', borderRadius: 12,
                background: 'var(--surface)', border: '1px solid var(--border2)',
                color: 'var(--ink2)', fontSize: 14, fontWeight: 600,
                textDecoration: 'none', transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
            >
              Browse by set →
            </a>
          </div>
        )}

        {/* Anon rate-limit wall */}
        {blocked && !loading && (
          <div style={{ textAlign: 'center', marginTop: 40, padding: '32px 24px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border2)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
              Free search limit reached
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.65, marginBottom: 24 }}>
              You&apos;ve used your 1 free search.{' '}
              {cooldownMins > 1
                ? <>Try again in <strong style={{ color: 'var(--ink2)' }}>{cooldownMins} minutes</strong>, or</>
                : 'Sign up for free to'}
              {' '}unlock unlimited searches.
            </p>
            <button
              onClick={() => setShowSignup(true)}
              style={{ display: 'block', width: '100%', maxWidth: 280, margin: '0 auto', padding: '13px 0', borderRadius: 12, background: 'var(--gold)', color: '#080810', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              Sign up free — unlimited searches
            </button>
            <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 12 }}>No credit card required</p>
          </div>
        )}

        {/* No results — only shown when the committed (fetched) query matches
            what the user currently has typed, preventing false empties mid-word */}
        {!blocked && committedQuery && committedQuery === query.trim() && !loading && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>¯\_(ツ)_/¯</div>
            <p style={{ fontSize: 14, color: 'var(--ink2)', fontWeight: 600, marginBottom: 6 }}>
              No cards found for "{committedQuery}"
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink3)' }}>
              Try a different name, or remove the number
            </p>
          </div>
        )}

        {/* Results list */}
        {!blocked && displayResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: showHint ? 0 : 16 }}>
            <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 4, paddingLeft: 2 }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>

            {results.length >= 20 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
                <a
                  href={`/search/results?q=${encodeURIComponent(query.trim())}`}
                  style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600, letterSpacing: 0.3 }}
                >
                  View all results →
                </a>
              </div>
            )}

            {displayResults.map(card => {
              const isSelected = selectedCard?.id === card.id
              const variant = card.variant && card.variant !== 'Normal'
                ? VARIANT_LABELS[card.variant] ?? card.variant
                : null

              return (
                <div key={card.id} ref={isSelected ? selectedRef : undefined}>

                  {/* Result row */}
                  <button
                    onClick={() => handleCardClick(card)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 14px',
                      borderRadius: isSelected ? '12px 12px 0 0' : 12,
                      background: isSelected ? 'var(--surface)' : 'var(--surface)',
                      border: `1.5px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                      borderBottom: isSelected ? '1.5px solid transparent' : `1.5px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color 0.15s',
                      minHeight: 72,   // comfortable tap target
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(232,197,71,0.4)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <CardThumb src={ptImg(card.image)} alt={card.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{card.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink3)', flexShrink: 0 }}>#{card.cardNumber}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {card.set.name}{variant ? ` · ${variant}` : ''}
                      </div>
                      {card.rarity && (
                        <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 3, fontWeight: 600 }}>{card.rarity}</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 20, color: isSelected ? 'var(--gold)' : 'var(--ink3)',
                      flexShrink: 0, lineHeight: 1,
                      transition: 'transform 0.2s, color 0.15s',
                      transform: isSelected ? 'rotate(90deg)' : 'none',
                    }}>›</span>
                  </button>

                  {/* Inline grade picker */}
                  {isSelected && (
                    <div style={{
                      border: '1.5px solid var(--gold)', borderTop: 'none',
                      borderRadius: '0 0 12px 12px',
                      background: 'var(--surface)',
                      padding: '14px 14px 16px',
                    }}>
                      <p style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 12 }}>
                        SELECT GRADE
                      </p>
                      <div className="srch-grade-grid">
                        {GRADES.map(g => (
                          <button
                            key={g.label}
                            disabled={g.graded}
                            onClick={() => !g.graded && handleGrade(g.label, card)}
                            style={{
                              padding: '10px 4px', borderRadius: 8,
                              cursor: g.graded ? 'default' : 'pointer', textAlign: 'center',
                              background: g.graded
                                ? 'rgba(255,255,255,0.02)'
                                : selectedGrade === g.label
                                  ? 'rgba(232,197,71,0.1)' : 'var(--surface2)',
                              border: `1.5px solid ${g.graded ? 'rgba(255,255,255,0.06)' : selectedGrade === g.label ? 'var(--gold)' : 'var(--border2)'}`,
                              transition: 'all 0.15s',
                              minHeight: 52,
                              opacity: g.graded ? 0.45 : 1,
                            }}
                            onMouseEnter={e => {
                              if (!g.graded && selectedGrade !== g.label) {
                                e.currentTarget.style.borderColor = 'var(--gold)'
                                e.currentTarget.style.background = 'rgba(232,197,71,0.05)'
                              }
                            }}
                            onMouseLeave={e => {
                              if (!g.graded && selectedGrade !== g.label) {
                                e.currentTarget.style.borderColor = 'var(--border2)'
                                e.currentTarget.style.background = 'var(--surface2)'
                              }
                            }}
                          >
                            <span style={{
                              display: 'block',
                              fontSize: g.label === 'Raw' ? 13 : 11,
                              fontWeight: 700,
                              color: g.graded ? 'var(--ink3)' : selectedGrade === g.label ? 'var(--gold)' : 'var(--ink)',
                              lineHeight: 1.2,
                            }}>{g.label}</span>
                            <span style={{ display: 'block', fontSize: 8, color: 'var(--ink3)', marginTop: 2 }}>
                              {g.graded ? 'coming soon' : g.sub}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </main>

      <style>{`
        @keyframes srch-spin { to { transform: rotate(360deg); } }

        /* Thumbnail size */
        .search-thumb { width: 48px; height: 67px; }

        /* Grade grid: 5-col desktop → 3-col mobile */
        .srch-grade-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
        }

        /* Browse button: auto-width desktop → full-width mobile */
        .srch-browse-btn { max-width: 240px; margin: 0 auto; }

        /* Hide native search cancel button (Chrome/Safari) */
        input[type="search"]::-webkit-search-cancel-button { display: none; }
        input[type="search"]::-webkit-search-decoration { display: none; }

        @media (max-width: 480px) {
          .srch-grade-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
          .search-thumb { width: 42px; height: 59px; }
          .srch-browse-btn { max-width: 100% !important; }
        }
      `}</style>
    </>
  )
}
