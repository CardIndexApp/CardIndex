'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { tcgImg } from '@/lib/img'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string
  name: string
  set: { name: string; slug: string }
  number?: string
  image?: string
}

interface LiveData {
  price: number
  price_change_pct: number
  avg7d?: number | null
  avg30d?: number | null
  price_range_low?: number
  price_range_high?: number
  price_history?: { month: string; price: number }[]
  score?: number
  sales_count_30d?: number
}

interface CompareCard {
  id: string
  name: string
  setName: string
  grade: string
  imageUrl?: string
  data: LiveData | null
  loading: boolean
  error: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_COLORS = ['#e8c547', '#3de88a', '#8b5cf6', '#60a5fa']

const GRADES = [
  'Raw', 'PSA 10', 'PSA 9', 'PSA 8', 'PSA 7', 'PSA 6',
  'BGS 9.5', 'BGS 9', 'BGS 8.5', 'BGS 8',
  'CGC 10', 'CGC 9.5', 'CGC 9',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function pctColor(n: number | null | undefined) {
  if (n == null) return 'var(--ink3)'
  return n >= 0 ? 'var(--green)' : 'var(--red)'
}

function pctSign(n: number) { return n >= 0 ? '+' : '' }

function scoreColor(s: number | undefined) {
  if (s == null) return 'var(--ink3)'
  if (s >= 80) return 'var(--green)'
  if (s >= 60) return 'var(--gold)'
  return 'var(--red)'
}

function encodeCardParam(id: string, grade: string, name: string) {
  return `${id}:${encodeURIComponent(grade)}:${encodeURIComponent(name)}`
}

function decodeCardParam(param: string): { id: string; grade: string; name: string } | null {
  const parts = param.split(':')
  if (parts.length < 3) return null
  const id = parts[0]
  const grade = decodeURIComponent(parts[1])
  const name = decodeURIComponent(parts.slice(2).join(':'))
  return { id, grade, name }
}

// ── Build combined chart data from multiple cards ─────────────────────────────

function buildChartData(
  cards: CompareCard[],
  windowMonths: number
): Record<string, string | number>[] {
  const cardsWithHistory = cards.filter(c => c.data?.price_history?.length)
  if (cardsWithHistory.length < 2) return []

  const allMonthsSet = new Set<string>()
  for (const c of cardsWithHistory) {
    for (const h of c.data!.price_history!) allMonthsSet.add(h.month)
  }

  const parseTs = (m: string) => new Date(m).getTime()
  const sorted = Array.from(allMonthsSet).sort((a, b) => parseTs(a) - parseTs(b))
  const sliced = windowMonths > 0 ? sorted.slice(-windowMonths) : sorted

  return sliced.map(month => {
    const row: Record<string, string | number> = { month }
    for (const c of cardsWithHistory) {
      const hist = c.data!.price_history!
      const histMap = new Map(hist.map(h => [h.month, h.price]))
      const monthTs = parseTs(month)
      let price = histMap.get(month)
      if (price == null) {
        const candidates = hist
          .filter(h => parseTs(h.month) <= monthTs)
          .sort((a, b) => parseTs(b.month) - parseTs(a.month))
        price = candidates[0]?.price ?? c.data!.price
      }
      row[c.id + ':' + c.grade] = price
    }
    return row
  })
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 56, height: 78, borderRadius: 8, background: 'var(--surface2)' }} className="cmp-sk" />
        <div style={{ flex: 1 }}>
          <div style={{ width: '70%', height: 14, borderRadius: 4, background: 'var(--surface2)', marginBottom: 8 }} className="cmp-sk" />
          <div style={{ width: '50%', height: 11, borderRadius: 4, background: 'var(--surface2)', marginBottom: 6 }} className="cmp-sk" />
          <div style={{ width: 60, height: 20, borderRadius: 6, background: 'var(--surface2)' }} className="cmp-sk" />
        </div>
      </div>
      {[1,2,3,4].map(i => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ width: 80, height: 11, borderRadius: 4, background: 'var(--surface2)' }} className="cmp-sk" />
          <div style={{ width: 60, height: 11, borderRadius: 4, background: 'var(--surface2)' }} className="cmp-sk" />
        </div>
      ))}
    </div>
  )
}

// ── Comparison card ───────────────────────────────────────────────────────────

function ComparisonCardPanel({
  card,
  color,
  onRemove,
}: {
  card: CompareCard
  color: string
  onRemove: () => void
}) {
  if (card.loading) return <SkeletonCard />

  const d = card.data
  const change7d  = d?.avg7d  && d.price ? ((d.price - d.avg7d)  / d.avg7d)  * 100 : null
  const change30d = d?.avg30d && d.price ? ((d.price - d.avg30d) / d.avg30d) * 100 : null
  const imgSrc    = card.imageUrl ? tcgImg(card.imageUrl) : null

  return (
    <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden', position: 'relative' }}>
      {/* Color accent bar */}
      <div style={{ height: 3, background: color }} />

      <div style={{ padding: 20 }}>
        {/* Remove button */}
        <button
          onClick={onRemove}
          style={{ position: 'absolute', top: 14, right: 14, width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--ink3)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
        >
          ×
        </button>

        {/* Card header: image + meta + score */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'flex-start' }}>
          {/* Image */}
          {imgSrc ? (
            <img src={imgSrc} alt={card.name}
              style={{ width: 64, height: 90, objectFit: 'contain', borderRadius: 7, flexShrink: 0, background: 'var(--surface2)' }} />
          ) : (
            <div style={{ width: 64, height: 90, borderRadius: 7, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 24 }}>🃏</div>
          )}

          {/* Name + set + grade */}
          <div style={{ flex: 1, minWidth: 0, paddingRight: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 4 }}>{card.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.setName}</div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.25)', color: 'var(--gold)' }}>
              {card.grade}
            </span>
          </div>

          {/* CI Score — large, anchored right */}
          {d?.score != null && (
            <div style={{ flexShrink: 0, textAlign: 'center', paddingTop: 4 }}>
              <div className="font-num" style={{ fontSize: 36, fontWeight: 900, color: scoreColor(d.score), lineHeight: 1 }}>{d.score}</div>
              <div style={{ fontSize: 9, color: 'var(--ink3)', letterSpacing: 1, marginTop: 3 }}>CI SCORE</div>
            </div>
          )}
        </div>

        {card.error && (
          <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', borderRadius: 8, background: 'rgba(232,82,74,0.07)', border: '1px solid rgba(232,82,74,0.2)', marginBottom: 16 }}>
            Failed to load price data
          </div>
        )}

        {d && (
          <>
            {/* Current price block */}
            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 4 }}>CURRENT PRICE</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div className="font-num" style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>{fmt(d.price)}</div>
                {d.price_change_pct != null && (
                  <div className="font-num" style={{ fontSize: 13, fontWeight: 600, color: pctColor(d.price_change_pct) }}>
                    {pctSign(d.price_change_pct)}{d.price_change_pct.toFixed(1)}% 24h
                  </div>
                )}
              </div>
            </div>

            {/* Stats rows */}
            <div>
              {[
                { label: '7D Change',    value: change7d  != null ? `${pctSign(change7d)}${change7d.toFixed(1)}%`   : '—', color: pctColor(change7d) },
                { label: '30D Change',   value: change30d != null ? `${pctSign(change30d)}${change30d.toFixed(1)}%` : '—', color: pctColor(change30d) },
                {
                  label: 'Price Range',
                  value: (d.price_range_low != null && d.price_range_high != null)
                    ? `${fmt(d.price_range_low)} – ${fmt(d.price_range_high)}`
                    : '—',
                  color: 'var(--ink)',
                },
                { label: '30D Sales', value: d.sales_count_30d != null ? String(d.sales_count_30d) : '—', color: 'var(--ink)' },
              ].map((row, i, arr) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{row.label}</span>
                  <span className="font-num" style={{ fontSize: 12, fontWeight: 600, color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Multi-line chart tooltip ───────────────────────────────────────────────────

function MultiTooltip({
  active,
  payload,
  label,
  cards,
  colors,
}: {
  active?: boolean
  payload?: { dataKey: string; value: number; color: string }[]
  label?: string
  cards: CompareCard[]
  colors: string[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#181828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', minWidth: 160 }}>
      <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>{label}</div>
      {payload.map((p, i) => {
        const key = p.dataKey
        const card = cards.find(c => (c.id + ':' + c.grade) === key)
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[cards.findIndex(c => (c.id + ':' + c.grade) === key)] ?? p.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--ink3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{card?.name ?? key}</span>
            <span className="font-num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{fmt(p.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CompareClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [cards, setCards] = useState<CompareCard[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [pendingGrade, setPendingGrade] = useState('Raw')
  const [chartWindow, setChartWindow] = useState<3 | 6 | 12>(6)
  const [initialized, setInitialized] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // ── URL sync ────────────────────────────────────────────────────────────────

  function updateUrl(updatedCards: CompareCard[]) {
    const params = new URLSearchParams()
    for (const c of updatedCards) {
      params.append('c', encodeCardParam(c.id, c.grade, c.name))
    }
    const qs = params.toString()
    router.replace(qs ? `/compare?${qs}` : '/compare', { scroll: false })
  }

  // ── Fetch live data for a card ──────────────────────────────────────────────

  const fetchCardData = useCallback(async (card: CompareCard) => {
    setCards(prev => prev.map(c =>
      c.id === card.id && c.grade === card.grade
        ? { ...c, loading: true, error: null }
        : c
    ))
    try {
      const params = new URLSearchParams({ grade: card.grade, name: card.name })
      if (card.setName) params.set('set', card.setName)
      const r = await fetch(`/api/card/${card.id}?${params}`)
      const json = await r.json().catch(() => null)
      if (!r.ok || !json?.data) {
        setCards(prev => prev.map(c =>
          c.id === card.id && c.grade === card.grade
            ? { ...c, loading: false, error: json?.error ?? `HTTP ${r.status}` }
            : c
        ))
        return
      }
      setCards(prev => prev.map(c =>
        c.id === card.id && c.grade === card.grade
          ? { ...c, loading: false, data: json.data, imageUrl: c.imageUrl ?? json.data.image_url }
          : c
      ))
    } catch {
      setCards(prev => prev.map(c =>
        c.id === card.id && c.grade === card.grade
          ? { ...c, loading: false, error: 'Network error' }
          : c
      ))
    }
  }, [])

  // ── Init from URL params ─────────────────────────────────────────────────────

  useEffect(() => {
    if (initialized) return
    setInitialized(true)
    const cParams = searchParams.getAll('c')
    if (!cParams.length) return
    const initialCards: CompareCard[] = cParams
      .slice(0, 4)
      .map(param => {
        const parsed = decodeCardParam(param)
        if (!parsed) return null
        return {
          id: parsed.id,
          name: parsed.name,
          setName: '',
          grade: parsed.grade,
          data: null,
          loading: true,
          error: null,
        }
      })
      .filter(Boolean) as CompareCard[]
    if (initialCards.length) {
      setCards(initialCards)
      initialCards.forEach(c => fetchCardData(c))
    }
  }, [searchParams, initialized, fetchCardData])

  // ── Search ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const r = await fetch(`/api/pt/cards?search=${encodeURIComponent(searchQuery)}&limit=12`)
        const json = await r.json()
        setSearchResults((json.data ?? []).slice(0, 12))
        setShowDropdown(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  // ── Click-outside to close dropdown ─────────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Add card ────────────────────────────────────────────────────────────────

  function addCard(result: SearchResult, grade: string) {
    if (cards.length >= 4) return
    // Don't add duplicates (same id + grade)
    if (cards.some(c => c.id === result.id && c.grade === grade)) return
    const newCard: CompareCard = {
      id: result.id,
      name: result.name,
      setName: result.set.name,
      grade,
      imageUrl: result.image,
      data: null,
      loading: true,
      error: null,
    }
    const updatedCards = [...cards, newCard]
    setCards(updatedCards)
    updateUrl(updatedCards)
    fetchCardData(newCard)
    setSearchQuery('')
    setSearchResults([])
    setShowDropdown(false)
  }

  // ── Remove card ─────────────────────────────────────────────────────────────

  function removeCard(id: string, grade: string) {
    const updatedCards = cards.filter(c => !(c.id === id && c.grade === grade))
    setCards(updatedCards)
    updateUrl(updatedCards)
  }

  // ── Clear all ───────────────────────────────────────────────────────────────

  function clearAll() {
    setCards([])
    router.replace('/compare', { scroll: false })
  }

  // ── Chart data ──────────────────────────────────────────────────────────────

  const chartData = buildChartData(cards, chartWindow)
  const cardsWithHistory = cards.filter(c => c.data?.price_history?.length)
  const showChart = cardsWithHistory.length >= 2

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes cmp-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .cmp-sk { animation: cmp-pulse 1.6s ease-in-out infinite; }
        @media (max-width: 640px) {
          .cmp-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Navbar />

      <main style={{ paddingTop: 72, paddingBottom: 80, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 16px 0' }}>

          {/* ── Page header ── */}
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Compare</p>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 6 }}>Compare Cards</h1>
            <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Side-by-side price &amp; score analysis</p>
          </div>

          {/* ── Search bar ── */}
          {cards.length < 4 && (
            <div ref={searchRef} style={{ position: 'relative', marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Grade selector */}
                <select
                  value={pendingGrade}
                  onChange={e => setPendingGrade(e.target.value)}
                  style={{ flexShrink: 0, padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
                >
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>

                {/* Search input */}
                <div style={{ position: 'relative', flex: 1 }}>
                  <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    {searchLoading
                      ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="2" strokeLinecap="round" style={{ animation: 'cmp-pulse 0.7s linear infinite' }}><path d="M8 1a7 7 0 1 0 7 7"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M14 14l-3-3"/></svg>
                    }
                  </div>
                  <input
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); if (e.target.value.length >= 2) setShowDropdown(true) }}
                    onFocus={() => { if (searchResults.length) setShowDropdown(true) }}
                    placeholder="Search for a card to compare…"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 36px', borderRadius: showDropdown && searchResults.length > 0 ? '10px 10px 0 0' : 10, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }}
                    onKeyDown={e => { if (e.key === 'Escape') { setShowDropdown(false); setSearchQuery('') } }}
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => { setSearchQuery(''); setSearchResults([]); setShowDropdown(false) }}
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 38, background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  )}
                </div>
              </div>

              {/* Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border2)', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {searchResults.map((r, i) => {
                      const alreadyAdded = cards.some(c => c.id === r.id && c.grade === pendingGrade)
                      return (
                        <button
                          key={r.id}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => !alreadyAdded && addCard(r, pendingGrade)}
                          style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none', cursor: alreadyAdded ? 'default' : 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, opacity: alreadyAdded ? 0.4 : 1, transition: 'background 0.1s' }}
                          onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          {r.image && (
                            <img src={tcgImg(r.image)} alt="" style={{ width: 32, height: 44, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{r.set.name}{r.number ? ` · #${r.number}` : ''}</div>
                          </div>
                          {alreadyAdded ? (
                            <span style={{ fontSize: 10, color: 'var(--ink3)', flexShrink: 0 }}>Added</span>
                          ) : (
                            <span style={{ fontSize: 10, color: 'var(--gold)', background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.25)', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>
                              + {pendingGrade}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Selected card chips ── */}
          {cards.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24, alignItems: 'center' }}>
              {cards.map((c, i) => (
                <div
                  key={c.id + ':' + c.grade}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 8px', borderRadius: 99, background: 'var(--surface)', border: `1px solid ${CARD_COLORS[i] ?? 'var(--border2)'}`, fontSize: 12, color: 'var(--ink)' }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: CARD_COLORS[i] ?? 'var(--border2)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: 'var(--ink3)', fontSize: 10 }}>{c.grade}</span>
                  <button
                    onClick={() => removeCard(c.id, c.grade)}
                    style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 0 0 2px', display: 'flex', alignItems: 'center' }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={clearAll}
                style={{ padding: '5px 12px', borderRadius: 99, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--ink3)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                Clear all
              </button>
            </div>
          )}

          {/* ── Empty state ── */}
          {cards.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 24px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⚖️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Add cards above to start comparing</div>
              <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Search for up to 4 cards and see them side by side</div>
            </div>
          )}

          {/* ── Comparison grid ── */}
          {cards.length > 0 && (
            <div
              className="cmp-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(cards.length, 2)}, 1fr)`,
                gap: 12,
                marginBottom: 24,
              }}
            >
              {cards.map((c, i) => (
                <ComparisonCardPanel
                  key={c.id + ':' + c.grade}
                  card={c}
                  color={CARD_COLORS[i] ?? 'var(--border2)'}
                  onRemove={() => removeCard(c.id, c.grade)}
                />
              ))}
            </div>
          )}

          {/* ── Price history chart ── */}
          {showChart && (
            <div style={{ borderRadius: 14, padding: '20px 20px 12px', background: 'var(--surface)', border: '1px solid var(--border2)', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Price History</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([3, 6, 12] as const).map(w => (
                    <button
                      key={w}
                      onClick={() => setChartWindow(w)}
                      style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                        borderColor: chartWindow === w ? 'var(--gold)' : 'var(--border2)',
                        background: chartWindow === w ? 'rgba(232,197,71,0.1)' : 'transparent',
                        color: chartWindow === w ? 'var(--gold)' : 'var(--ink3)' }}
                    >
                      {w}M
                    </button>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                {cardsWithHistory.map((c, i) => {
                  const colorIdx = cards.findIndex(cc => cc.id === c.id && cc.grade === c.grade)
                  return (
                    <div key={c.id + ':' + c.grade} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink3)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: CARD_COLORS[colorIdx] ?? '#fff' }} />
                      {c.name} <span style={{ opacity: 0.6 }}>({c.grade})</span>
                    </div>
                  )
                })}
              </div>

              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--ink3)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--ink3)' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={48} />
                    <Tooltip content={<MultiTooltip cards={cards} colors={CARD_COLORS} />} />
                    {cardsWithHistory.map(c => {
                      const colorIdx = cards.findIndex(cc => cc.id === c.id && cc.grade === c.grade)
                      return (
                        <Line
                          key={c.id + ':' + c.grade}
                          type="monotone"
                          dataKey={c.id + ':' + c.grade}
                          stroke={CARD_COLORS[colorIdx] ?? '#fff'}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 12, color: 'var(--ink3)' }}>
                  Not enough price history data to render chart.
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </>
  )
}
