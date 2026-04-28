'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import { ptImg } from '@/lib/img'
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

// ── Query parser ──────────────────────────────────────────────────────────────

function parseQuery(q: string): { name: string; number: string | null } {
  const t = q.trim()
  const hashMatch = t.match(/^(.*?)\s*#(\d+)(?:\/\d+)?\s*$/)
  if (hashMatch && hashMatch[1].trim()) return { name: hashMatch[1].trim(), number: hashMatch[2] }
  const trailMatch = t.match(/^(.*?)\s+(\d+(?:\/\d+)?)$/)
  if (trailMatch && trailMatch[1].trim()) return { name: trailMatch[1].trim(), number: trailMatch[2].split('/')[0] }
  return { name: t, number: null }
}

// ── Relevance sort ─────────────────────────────────────────────────────────────

function sortByRelevance(cards: PtCard[], queryName: string): PtCard[] {
  const lower = queryName.toLowerCase()
  return [...cards].sort((a, b) => {
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()
    const rankA = aName === lower ? 0 : aName.startsWith(lower) ? 1 : 2
    const rankB = bName === lower ? 0 : bName.startsWith(lower) ? 1 : 2
    return rankA - rankB
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

// ── Inner page (uses useSearchParams) ─────────────────────────────────────────

function SearchResultsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawQuery = searchParams.get('q') ?? ''

  const { name, number } = parseQuery(rawQuery)

  const [results, setResults]           = useState<PtCard[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedCard, setSelectedCard] = useState<PtCard | null>(null)
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)
  const [cursor, setCursor]             = useState<string | null>(null)
  const [hasMore, setHasMore]           = useState(false)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [isLoggedIn, setIsLoggedIn]     = useState<boolean | null>(null)

  const selectedRef = useRef<HTMLDivElement>(null)

  // Resolve auth on mount
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user)
    })
  }, [])

  // Fetch function
  async function fetchPage(searchCursor?: string) {
    const params = new URLSearchParams({ search: name, limit: '50' })
    if (number) params.set('card_number', number)
    if (searchCursor) params.set('cursor', searchCursor)
    const res = await fetch(`/api/pt/cards?${params}`)
    const json = await res.json()
    const newCards = (json.data ?? []) as PtCard[]
    setResults(prev => {
      const combined = searchCursor ? [...prev, ...newCards] : newCards
      return sortByRelevance(combined, name)
    })
    setCursor(json.pagination?.cursor ?? null)
    setHasMore(json.pagination?.hasMore ?? false)
  }

  // Initial fetch on mount
  useEffect(() => {
    if (!name) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchPage().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawQuery])

  // Scroll selected card into view on mobile
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

  const showNumberHint = number !== null && rawQuery.trim().length > 0

  // Suppress unused warning — isLoggedIn is resolved for future use / consistency with search/page
  void isLoggedIn

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '72px 16px 100px' }}>

        {/* Back link */}
        <div style={{ marginBottom: 20 }}>
          <a
            href={`/search?q=${encodeURIComponent(rawQuery)}`}
            style={{ fontSize: 13, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink2)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink3)')}
          >
            ← Back to search
          </a>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 6 }}>SEARCH RESULTS</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 6, lineHeight: 1.1 }}>
            Results for &ldquo;{rawQuery}&rdquo;
          </h1>
          {showNumberHint && (
            <p style={{ fontSize: 11, color: 'var(--ink3)', paddingLeft: 2 }}>
              Searching <span style={{ color: 'var(--ink2)' }}>&ldquo;{name}&rdquo;</span> · card #{number}
            </p>
          )}
        </div>

        {/* Loading spinner */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="2" strokeLinecap="round" style={{ animation: 'srch-spin 0.7s linear infinite' }}>
              <path d="M8 1a7 7 0 1 0 7 7"/>
            </svg>
          </div>
        )}

        {/* No results */}
        {!loading && results.length === 0 && rawQuery.trim() && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>¯\_(ツ)_/¯</div>
            <p style={{ fontSize: 14, color: 'var(--ink2)', fontWeight: 600, marginBottom: 6 }}>
              No cards found for &ldquo;{rawQuery}&rdquo;
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink3)' }}>
              Try a different name, or remove the number
            </p>
          </div>
        )}

        {/* Results list */}
        {!loading && results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: showNumberHint ? 8 : 0 }}>
            <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 4, paddingLeft: 2 }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>

            {results.map(card => {
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
                      background: 'var(--surface)',
                      border: `1.5px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                      borderBottom: isSelected ? '1.5px solid transparent' : `1.5px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color 0.15s',
                      minHeight: 72,
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

            {/* Load more */}
            {hasMore && (
              <button
                onClick={() => {
                  setLoadingMore(true)
                  fetchPage(cursor ?? undefined).finally(() => setLoadingMore(false))
                }}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 12,
                  background: 'var(--surface)', border: '1px solid var(--border2)',
                  color: 'var(--ink2)', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', marginTop: 8,
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more results'}
              </button>
            )}
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

        @media (max-width: 480px) {
          .srch-grade-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
          .search-thumb { width: 42px; height: 59px; }
        }
      `}</style>
    </>
  )
}

// ── Main export — wraps inner component in Suspense for useSearchParams ────────

export default function SearchResultsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
        <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="2" strokeLinecap="round" style={{ animation: 'srch-spin 0.7s linear infinite' }}>
          <path d="M8 1a7 7 0 1 0 7 7"/>
        </svg>
        <style>{`@keyframes srch-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <SearchResultsInner />
    </Suspense>
  )
}
