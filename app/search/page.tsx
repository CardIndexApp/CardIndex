'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { ptImg } from '@/lib/img'

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

const MIN_CHARS = 2
const DEBOUNCE_MS = 320

// ── Query parser ──────────────────────────────────────────────────────────────
// "Charizard 4"      → { name: "Charizard",    number: "4"  }
// "Pikachu #25"      → { name: "Pikachu",      number: "25" }
// "Charizard ex 6"   → { name: "Charizard ex", number: "6"  }
// "Charizard ex"     → { name: "Charizard ex", number: null }

function parseQuery(q: string): { name: string; number: string | null } {
  const t = q.trim()
  // Explicit hash: "Pikachu #25" or "Charizard #4/102"
  const hashMatch = t.match(/^(.*?)\s*#(\d+)(?:\/\d+)?\s*$/)
  if (hashMatch && hashMatch[1].trim()) {
    return { name: hashMatch[1].trim(), number: hashMatch[2] }
  }
  // Trailing number not part of a known suffix (ex, gx, v, vmax, vstar, etc.)
  const trailMatch = t.match(/^(.*?)\s+(\d+(?:\/\d+)?)$/)
  if (trailMatch && trailMatch[1].trim()) {
    return { name: trailMatch[1].trim(), number: trailMatch[2].split('/')[0] }
  }
  return { name: t, number: null }
}

// ── Card image with fallback ───────────────────────────────────────────────────

function CardThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed || !src) {
    return (
      <div style={{ width: 44, height: 62, borderRadius: 6, background: 'var(--surface2)', flexShrink: 0 }} />
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      style={{ width: 44, height: 62, objectFit: 'contain', borderRadius: 6, flexShrink: 0, background: 'var(--surface2)' }}
    />
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PtCard[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedCard, setSelectedCard] = useState<PtCard | null>(null)
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Search ────────────────────────────────────────────────────────────────
  const runSearch = useCallback(async (raw: string) => {
    const { name, number } = parseQuery(raw)
    if (name.length < MIN_CHARS) {
      setResults([])
      setHasSearched(false)
      return
    }

    setLoading(true)
    setSelectedCard(null)
    setSelectedGrade(null)

    const params = new URLSearchParams({ search: name })
    if (number) params.set('card_number', number)

    try {
      const res = await fetch(`/api/pt/cards?${params}`)
      const json = await res.json()
      setResults(json.data ?? [])
      setHasSearched(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setHasSearched(false)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => runSearch(query), DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, runSearch])

  // ── Grade select → navigate ───────────────────────────────────────────────
  function handleGrade(grade: string, card: PtCard) {
    setSelectedGrade(grade)
    const params = new URLSearchParams({
      grade,
      name: card.name,
      set: card.set.name,
      number: card.cardNumber,
      set_slug: card.set.slug,
    })
    router.push(`/card/${card.id}?${params}`)
  }

  // ── Card select ───────────────────────────────────────────────────────────
  function handleCardClick(card: PtCard) {
    setSelectedCard(prev => prev?.id === card.id ? null : card)
    setSelectedGrade(null)
  }

  const { name: parsedName, number: parsedNumber } = parseQuery(query)
  const showParsedHint = parsedNumber !== null && query.trim().length >= MIN_CHARS

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '80px 16px 100px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8 }}>SEARCH</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 6 }}>
            Find a card
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>
            Search by name, or include a number to narrow results — e.g. <em style={{ color: 'var(--ink2)' }}>Charizard ex 6</em>
          </p>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            {loading
              ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="1.8" strokeLinecap="round" style={{ animation: 'spin 0.7s linear infinite' }}><path d="M8 1a7 7 0 1 0 7 7" /></svg>
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M14 14l-3-3"/></svg>
            }
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Charizard ex · Pikachu 25 · Umbreon #17"
            autoFocus
            style={{
              width: '100%', padding: '14px 44px 14px 40px',
              borderRadius: 14, background: 'var(--surface)', border: '1.5px solid var(--border2)',
              color: 'var(--ink)', fontSize: 16, outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); setHasSearched(false); inputRef.current?.focus() }}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
            >×</button>
          )}
        </div>

        {/* Parsed hint */}
        {showParsedHint && (
          <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 16, paddingLeft: 4 }}>
            Searching <span style={{ color: 'var(--ink2)' }}>"{parsedName}"</span> · card #{parsedNumber}
          </p>
        )}

        {/* Browse by set fallback */}
        {!hasSearched && !loading && (
          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 16 }}>
              Prefer to browse a specific set?
            </p>
            <a
              href="/search/sets"
              style={{ display: 'inline-block', padding: '9px 22px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink2)', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
            >
              Browse by set →
            </a>
          </div>
        )}

        {/* Results */}
        {hasSearched && !loading && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink3)', fontSize: 13 }}>
            No cards found for <strong style={{ color: 'var(--ink2)' }}>"{query}"</strong>
            <br />
            <span style={{ fontSize: 12, marginTop: 8, display: 'block' }}>Try a different name or remove the card number</span>
          </div>
        )}

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: showParsedHint ? 0 : 16 }}>
            <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8, paddingLeft: 2 }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            {results.map(card => {
              const isSelected = selectedCard?.id === card.id
              const variant = card.variant && card.variant !== 'Normal' ? VARIANT_LABELS[card.variant] ?? card.variant : null

              return (
                <div key={card.id}>
                  {/* Result row */}
                  <button
                    onClick={() => handleCardClick(card)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 14px', borderRadius: isSelected ? '12px 12px 0 0' : 12,
                      background: isSelected ? 'var(--surface)' : 'var(--surface)',
                      border: `1.5px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                      borderBottom: isSelected ? '1.5px solid transparent' : `1.5px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                      cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(232,197,71,0.4)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <CardThumb src={ptImg(card.image)} alt={card.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{card.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink3)' }}>#{card.cardNumber}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {card.set.name}
                        {variant ? ` · ${variant}` : ''}
                      </div>
                      {card.rarity && (
                        <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 3, fontWeight: 600 }}>{card.rarity}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 18, color: isSelected ? 'var(--gold)' : 'var(--ink3)', flexShrink: 0, transition: 'transform 0.2s, color 0.15s', transform: isSelected ? 'rotate(90deg)' : 'none' }}>›</span>
                  </button>

                  {/* Inline grade picker */}
                  {isSelected && (
                    <div style={{
                      border: '1.5px solid var(--gold)', borderTop: 'none',
                      borderRadius: '0 0 12px 12px', background: 'var(--surface)',
                      padding: '16px 14px 14px',
                    }}>
                      <p style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 12 }}>SELECT GRADE</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                        {GRADES.map(g => (
                          <button
                            key={g.label}
                            onClick={() => handleGrade(g.label, card)}
                            style={{
                              padding: '8px 4px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                              background: selectedGrade === g.label ? 'rgba(232,197,71,0.1)' : 'var(--surface2)',
                              border: `1.5px solid ${selectedGrade === g.label ? 'var(--gold)' : 'var(--border2)'}`,
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { if (selectedGrade !== g.label) { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'rgba(232,197,71,0.05)' } }}
                            onMouseLeave={e => { if (selectedGrade !== g.label) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface2)' } }}
                          >
                            <span style={{ display: 'block', fontSize: g.label === 'Raw' ? 12 : 11, fontWeight: 700, color: selectedGrade === g.label ? 'var(--gold)' : 'var(--ink)' }}>{g.label}</span>
                            <span style={{ display: 'block', fontSize: 8, color: 'var(--ink3)', marginTop: 1 }}>{g.sub}</span>
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
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 480px) {
          .grade-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>
    </>
  )
}
