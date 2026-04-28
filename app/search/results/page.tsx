'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import { ptImg } from '@/lib/img'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PtCard {
  id: string
  name: string
  cardNumber: string
  set: { slug: string; name: string }
  variant: string
  rarity: string | null
  image: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseQuery(q: string): { name: string; number: string | null } {
  const t = q.trim()
  const hashMatch  = t.match(/^(.*?)\s*#(\d+)(?:\/\d+)?\s*$/)
  if (hashMatch && hashMatch[1].trim()) return { name: hashMatch[1].trim(), number: hashMatch[2] }
  const trailMatch = t.match(/^(.*?)\s+(\d+(?:\/\d+)?)$/)
  if (trailMatch && trailMatch[1].trim()) return { name: trailMatch[1].trim(), number: trailMatch[2].split('/')[0] }
  return { name: t, number: null }
}

function sortByRelevance(cards: PtCard[], q: string): PtCard[] {
  const lq = q.toLowerCase()
  return [...cards].sort((a, b) => {
    const an = a.name.toLowerCase(), bn = b.name.toLowerCase()
    const ra = an === lq ? 0 : an.startsWith(lq) ? 1 : 2
    const rb = bn === lq ? 0 : bn.startsWith(lq) ? 1 : 2
    return ra - rb
  })
}

// ── Card image with fallback ───────────────────────────────────────────────────

function CardImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed || !src) {
    return (
      <div style={{
        width: '100%', height: '100%', borderRadius: 8,
        background: 'var(--surface2)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 28,
      }}>
        🃏
      </div>
    )
  }
  return (
    <img
      src={src} alt={alt}
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block', background: 'var(--surface2)' }}
    />
  )
}

// ── Grade picker modal ─────────────────────────────────────────────────────────

function GradePicker({
  card,
  selectedGrade,
  onGrade,
  onClose,
}: {
  card: PtCard
  selectedGrade: string | null
  onGrade: (grade: string, card: PtCard) => void
  onClose: () => void
}) {
  const variant = card.variant && card.variant !== 'Normal'
    ? VARIANT_LABELS[card.variant] ?? card.variant
    : null

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border2)',
        borderRadius: 16, padding: '20px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
      }}>
        {/* Modal header */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
          <img
            src={ptImg(card.image)} alt={card.name}
            style={{ width: 52, borderRadius: 6, flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
              {card.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
              {card.set.name}{variant ? ` · ${variant}` : ''} · #{card.cardNumber}
            </div>
            {card.rarity && (
              <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 600, marginTop: 3 }}>{card.rarity}</div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)',
              border: '1px solid var(--border2)', color: 'var(--ink3)',
              fontSize: 16, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              lineHeight: 1, padding: 0,
            }}
            aria-label="Close"
          >×</button>
        </div>

        {/* Grade label */}
        <p style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 12 }}>SELECT GRADE</p>

        {/* Grade grid */}
        <div className="srch-grade-grid">
          {GRADES.map(g => (
            <button
              key={g.label}
              disabled={g.graded}
              onClick={() => !g.graded && onGrade(g.label, card)}
              style={{
                padding: '10px 4px', borderRadius: 8,
                cursor: g.graded ? 'default' : 'pointer', textAlign: 'center',
                background: g.graded
                  ? 'rgba(255,255,255,0.02)'
                  : selectedGrade === g.label
                    ? 'rgba(232,197,71,0.1)' : 'var(--surface2)',
                border: `1.5px solid ${g.graded
                  ? 'rgba(255,255,255,0.06)'
                  : selectedGrade === g.label ? 'var(--gold)' : 'var(--border2)'}`,
                transition: 'all 0.15s', minHeight: 52,
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
    </div>
  )
}

// ── Inner page ─────────────────────────────────────────────────────────────────

function SearchResultsInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const rawQuery     = searchParams.get('q') ?? ''

  const { name, number } = parseQuery(rawQuery)

  const [results, setResults]           = useState<PtCard[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedCard, setSelectedCard] = useState<PtCard | null>(null)
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)
  const [nextCursor, setNextCursor]     = useState<string | null>(null)
  const [hasMore, setHasMore]           = useState(false)
  const [loadingMore, setLoadingMore]   = useState(false)

  // ── Fetch page ───────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (searchCursor?: string) => {
    const params = new URLSearchParams({ search: name, limit: '50' })
    if (number) params.set('card_number', number)
    if (searchCursor) params.set('cursor', searchCursor)

    const res  = await fetch(`/api/pt/cards?${params}`)
    const json = await res.json()
    const newCards = (json.data ?? []) as PtCard[]

    setResults(prev => {
      const combined = searchCursor ? [...prev, ...newCards] : newCards
      return sortByRelevance(combined, name)
    })
    // Poketrace paginates via `nextCursor`
    setNextCursor(json.pagination?.nextCursor ?? null)
    setHasMore(json.pagination?.hasMore ?? false)
  }, [name, number])

  // Initial fetch
  useEffect(() => {
    if (!name) { setLoading(false); return }
    setLoading(true)
    fetchPage().finally(() => setLoading(false))
  }, [rawQuery, fetchPage])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleGrade = useCallback((grade: string, card: PtCard) => {
    setSelectedGrade(grade)
    const params = new URLSearchParams({
      grade, name: card.name, set: card.set.name,
      number: card.cardNumber, set_slug: card.set.slug,
    })
    router.push(`/card/${card.id}?${params}`)
  }, [router])

  const handleCardClick = useCallback((card: PtCard) => {
    setSelectedCard(card)
    setSelectedGrade(null)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedCard(null)
    setSelectedGrade(null)
  }, [])

  const handleLoadMore = useCallback(() => {
    if (!nextCursor) return
    setLoadingMore(true)
    fetchPage(nextCursor).finally(() => setLoadingMore(false))
  }, [nextCursor, fetchPage])

  const showNumberHint = number !== null && rawQuery.trim().length > 0

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 20px 120px' }}>

        {/* Back link */}
        <a
          href={`/search?q=${encodeURIComponent(rawQuery)}`}
          style={{ fontSize: 13, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink2)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink3)')}
        >
          ← Back to search
        </a>

        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 6 }}>SEARCH RESULTS</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 6 }}>
            Results for &ldquo;{rawQuery}&rdquo;
          </h1>
          {showNumberHint && (
            <p style={{ fontSize: 11, color: 'var(--ink3)' }}>
              Searching <span style={{ color: 'var(--ink2)' }}>&ldquo;{name}&rdquo;</span> · card #{number}
            </p>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 64 }}>
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="2" strokeLinecap="round" style={{ animation: 'res-spin 0.7s linear infinite' }}>
              <path d="M8 1a7 7 0 1 0 7 7"/>
            </svg>
          </div>
        )}

        {/* No results */}
        {!loading && results.length === 0 && rawQuery.trim() && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>¯\_(ツ)_/¯</div>
            <p style={{ fontSize: 14, color: 'var(--ink2)', fontWeight: 600, marginBottom: 6 }}>
              No cards found for &ldquo;{rawQuery}&rdquo;
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Try a different name, or remove the number</p>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <>
            <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 16 }}>
              {results.length}{hasMore ? '+' : ''} result{results.length !== 1 ? 's' : ''}
            </p>

            {/* ── Card grid (desktop) / list (mobile) ── */}
            <div className="res-grid">
              {results.map(card => {
                const variant = card.variant && card.variant !== 'Normal'
                  ? VARIANT_LABELS[card.variant] ?? card.variant
                  : null
                const isSelected = selectedCard?.id === card.id

                return (
                  <div key={card.id} className="res-grid-item">
                    {/* Desktop grid card */}
                    <button
                      className="res-card-btn"
                      onClick={() => handleCardClick(card)}
                      style={{
                        border: `1.5px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                        boxShadow: isSelected ? '0 0 0 1px rgba(232,197,71,0.2), 0 8px 24px rgba(0,0,0,0.4)' : 'none',
                      }}
                    >
                      <div className="res-card-img-wrap">
                        <CardImage src={ptImg(card.image)} alt={card.name} />
                      </div>
                      <div className="res-card-meta">
                        <div className="res-card-name">{card.name}</div>
                        <div className="res-card-set">
                          {card.set.name}{variant ? ` · ${variant}` : ''}
                        </div>
                        <div className="res-card-num">#{card.cardNumber}</div>
                        {card.rarity && (
                          <div className="res-card-rarity">{card.rarity}</div>
                        )}
                      </div>
                    </button>

                  </div>
                )
              })}
            </div>

            {/* Load more */}
            {hasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    padding: '13px 36px', borderRadius: 12,
                    background: 'var(--surface)', border: '1.5px solid var(--border2)',
                    color: 'var(--ink2)', fontSize: 14, fontWeight: 600,
                    cursor: loadingMore ? 'default' : 'pointer',
                    transition: 'border-color 0.15s',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseEnter={e => { if (!loadingMore) e.currentTarget.style.borderColor = 'var(--gold)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
                >
                  {loadingMore
                    ? <><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'res-spin 0.7s linear infinite' }}><path d="M8 1a7 7 0 1 0 7 7"/></svg> Loading…</>
                    : 'Load more results'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Grade picker modal */}
      {selectedCard && (
        <GradePicker
          card={selectedCard}
          selectedGrade={selectedGrade}
          onGrade={handleGrade}
          onClose={handleClose}
        />
      )}

      <style>{`
        @keyframes res-spin { to { transform: rotate(360deg); } }

        /* ── Grid layout ─────────────────────────────────── */
        .res-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 18px;
        }

        .res-grid-item {
          display: flex;
          flex-direction: column;
        }

        /* Card button — vertical card layout on all breakpoints */
        .res-card-btn {
          width: 100%;
          height: 100%;
          background: var(--surface);
          border-radius: 12px;
          padding: 10px;
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .res-card-btn:hover {
          border-color: rgba(232,197,71,0.5) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.45) !important;
        }

        .res-card-img-wrap {
          width: 100%;
          border-radius: 8px;
          overflow: hidden;
          background: var(--surface2);
          /* Explicit image area — card ratio ≈ 1.4:1 */
          aspect-ratio: 5 / 7;
        }

        .res-card-meta {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .res-card-name {
          font-size: 12px;
          font-weight: 700;
          color: var(--ink);
          line-height: 1.3;
        }
        .res-card-set {
          font-size: 9px;
          color: var(--ink3);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .res-card-num {
          font-size: 9px;
          color: var(--ink3);
        }
        .res-card-rarity {
          font-size: 9px;
          font-weight: 600;
          color: var(--gold);
          margin-top: 2px;
        }

        /* Modal shown on all breakpoints — no inline picker */
        .res-modal-wrap { display: block; }
        .res-inline-picker { display: none !important; }

        /* Grade grid */
        .srch-grade-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
        }

        /* ── Mobile: 2-column card grid ───────────────────── */
        @media (max-width: 640px) {
          .res-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }

          .res-card-btn {
            padding: 8px;
            gap: 6px;
            border-radius: 10px;
          }
          .res-card-btn:hover { transform: none; }

          .res-card-name { font-size: 11px; }
          .res-card-set  { font-size: 9px; }

          .srch-grade-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
        }
      `}</style>
    </>
  )
}

// ── Default export — wrapped in Suspense for useSearchParams ──────────────────

export default function SearchResultsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
        <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="2" strokeLinecap="round" style={{ animation: 'res-spin 0.7s linear infinite' }}>
          <path d="M8 1a7 7 0 1 0 7 7"/>
        </svg>
        <style>{`@keyframes res-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <SearchResultsInner />
    </Suspense>
  )
}
