'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { tcgImg } from '@/lib/img'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/lib/currency'
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

interface ScoreBreakdown {
  total: number
  trend: number
  liquidity: number
  consistency: number
  value: number
  label: string
  summary: string
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
  score_breakdown?: ScoreBreakdown | null
  sales_count_30d?: number
  currency?: string | null
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

const CARD_COLORS = ['#e8c547', '#3de88a', '#8b5cf6', '#60a5fa', '#f97316']

const GRADES = [
  'Raw', 'PSA 10', 'PSA 9', 'PSA 8', 'PSA 7', 'PSA 6',
  'BGS 9.5', 'BGS 9', 'BGS 8.5', 'BGS 8',
  'CGC 10', 'CGC 9.5', 'CGC 9',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function labelColor(label: string) {
  const l = label.toLowerCase()
  if (l === 'strong' || l === 'excellent') return 'var(--green)'
  if (l === 'good' || l === 'fair') return 'var(--gold)'
  return 'var(--red)'
}

function encodeCardParam(id: string, grade: string, name: string) {
  return `${id}:${encodeURIComponent(grade)}:${encodeURIComponent(name)}`
}

function decodeCardParam(param: string): { id: string; grade: string; name: string } | null {
  const parts = param.split(':')
  if (parts.length < 3) return null
  return {
    id: parts[0],
    grade: decodeURIComponent(parts[1]),
    name: decodeURIComponent(parts.slice(2).join(':')),
  }
}

// ── Build combined chart data ─────────────────────────────────────────────────

function buildChartData(
  cards: CompareCard[],
  windowMonths: number
): Record<string, string | number>[] {
  const cardsWithHistory = cards.filter(c => c.data?.price_history?.length)
  if (cardsWithHistory.length < 2) return []

  const allMonthsSet = new Set<string>()
  for (const c of cardsWithHistory)
    for (const h of c.data!.price_history!) allMonthsSet.add(h.month)

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

// ── Comparison table ──────────────────────────────────────────────────────────

function ComparisonTable({
  cards,
  colors,
  onRemove,
  onReorder,
  showDragHandles,
  fmtPrice,
}: {
  cards: CompareCard[]
  colors: string[]
  onRemove: (id: string, grade: string) => void
  onReorder: (from: number, to: number) => void
  showDragHandles: boolean
  fmtPrice: (amount: number, nativeCurrency?: string | null) => string
}) {
  const N = cards.length
  if (!N) return null

  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const rowGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${N}, 1fr)`,
    gap: '0 12px',
  }

  // Column-aware cell style — dims dragged col, highlights drop target
  function cs(i: number): React.CSSProperties {
    const dragging  = dragIdx === i
    const dropTarget = dragOverIdx === i && dragIdx !== null && dragIdx !== i
    return {
      background: dragging ? 'rgba(255,255,255,0.01)' : 'var(--surface)',
      borderLeft:  `1px solid ${dropTarget ? 'rgba(232,197,71,0.55)' : 'var(--border2)'}`,
      borderRight: `1px solid ${dropTarget ? 'rgba(232,197,71,0.55)' : 'var(--border2)'}`,
      opacity: dragging ? 0.4 : 1,
      transition: 'opacity 0.15s, border-color 0.15s',
    }
  }

  // Drag-over / drop handlers (spread on every cell so full card is a target)
  function dh(i: number) {
    return {
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (dragOverIdx !== i) setDragOverIdx(i) },
      onDrop:     (e: React.DragEvent) => {
        e.preventDefault()
        if (dragIdx !== null && dragIdx !== i) onReorder(dragIdx, i)
        setDragIdx(null)
        setDragOverIdx(null)
      },
    }
  }

  const hasSomeBreakdown = cards.some(c => c.data?.score_breakdown)

  return (
    <div>

      {/* ── Drag handle / color bar ── */}
      <div style={rowGrid}>
        {cards.map((c, i) => {
          const isOver = dragOverIdx === i && dragIdx !== null && dragIdx !== i
          return (
            <div
              key={c.id + c.grade + 'cb'}
              draggable={showDragHandles}
              onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragIdx(i); setDragOverIdx(i) }}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
              {...dh(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: showDragHandles ? 22 : 3,
                background: dragIdx === i ? 'rgba(255,255,255,0.18)' : colors[i] ?? 'var(--border2)',
                border: `1px solid ${isOver ? 'rgba(232,197,71,0.8)' : 'var(--border2)'}`,
                borderBottom: 'none',
                borderRadius: '14px 14px 0 0',
                cursor: showDragHandles ? (dragIdx === i ? 'grabbing' : 'grab') : 'default',
                transition: 'background 0.15s',
                userSelect: 'none',
              }}
            >
              {showDragHandles && (
                <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
                  {([2, 7, 12] as const).map(x => ([2, 6] as const).map(y => (
                    <circle key={`${x}${y}`} cx={x} cy={y} r="1.2" fill="rgba(0,0,0,0.35)" />
                  )))}
                </svg>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Image + remove button ── */}
      <div style={rowGrid}>
        {cards.map((c, i) => {
          const imgSrc = c.imageUrl ? tcgImg(c.imageUrl) : null
          return (
            <div key={c.id + c.grade + 'img'} {...dh(i)} style={{
              ...cs(i),
              padding: '16px 16px 12px',
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              minHeight: 192,
            }}>
              <button
                onClick={() => onRemove(c.id, c.grade)}
                aria-label="Remove"
                style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--ink3)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
              >×</button>
              {c.loading
                ? <div style={{ width: 115, height: 160, borderRadius: 8, background: 'var(--surface2)' }} className="cmp-sk" />
                : imgSrc
                  ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={imgSrc} alt={c.name} style={{ height: 160, width: 'auto', maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
                  : <div style={{ height: 160, width: 115, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🃏</div>
              }
            </div>
          )
        })}
      </div>

      {/* ── CI Score ── */}
      <div style={rowGrid}>
        {cards.map((c, i) => {
          const d = c.data
          return (
            <div key={c.id + c.grade + 'sc'} {...dh(i)} style={{ ...cs(i), textAlign: 'center', padding: '10px 12px 6px' }}>
              {c.loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 60, height: 48, borderRadius: 6, background: 'var(--surface2)' }} className="cmp-sk" />
                  <div style={{ width: 50, height: 10, borderRadius: 4, background: 'var(--surface2)' }} className="cmp-sk" />
                </div>
              ) : d?.score != null ? (
                <>
                  <div className="font-num" style={{ fontSize: 48, fontWeight: 900, color: scoreColor(d.score), lineHeight: 1 }}>{d.score}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1.5, marginTop: 4 }}>CI SCORE</div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--ink3)', padding: '14px 0' }}>—</div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Card name ── */}
      <div style={rowGrid}>
        {cards.map((c, i) => (
          <div key={c.id + c.grade + 'nm'} {...dh(i)} style={{ ...cs(i), textAlign: 'center', padding: '8px 12px 2px' }}>
            {c.loading
              ? <div style={{ width: '65%', height: 14, borderRadius: 4, background: 'var(--surface2)', margin: '0 auto' }} className="cmp-sk" />
              : <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{c.name}</div>
            }
          </div>
        ))}
      </div>

      {/* ── Set name ── */}
      <div style={rowGrid}>
        {cards.map((c, i) => (
          <div key={c.id + c.grade + 'sn'} {...dh(i)} style={{ ...cs(i), textAlign: 'center', padding: '2px 12px 8px' }}>
            {c.loading
              ? <div style={{ width: '45%', height: 11, borderRadius: 4, background: 'var(--surface2)', margin: '0 auto' }} className="cmp-sk" />
              : <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{c.setName || '—'}</div>
            }
          </div>
        ))}
      </div>

      {/* ── Grade chip ── */}
      <div style={rowGrid}>
        {cards.map((c, i) => (
          <div key={c.id + c.grade + 'gr'} {...dh(i)} style={{ ...cs(i), textAlign: 'center', padding: '0 12px 16px' }}>
            {c.loading
              ? <div style={{ width: 56, height: 22, borderRadius: 11, background: 'var(--surface2)', margin: '0 auto' }} className="cmp-sk" />
              : <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 99, background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.25)', color: 'var(--gold)' }}>{c.grade}</span>
            }
          </div>
        ))}
      </div>

      {/* ── Current price ── */}
      <div style={rowGrid}>
        {cards.map((c, i) => {
          const d = c.data
          return (
            <div key={c.id + c.grade + 'pr'} {...dh(i)} style={{ ...cs(i), textAlign: 'center', padding: '14px 12px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 6 }}>CURRENT PRICE</div>
              {c.loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: '55%', height: 26, borderRadius: 6, background: 'var(--surface2)' }} className="cmp-sk" />
                  <div style={{ width: '35%', height: 12, borderRadius: 4, background: 'var(--surface2)' }} className="cmp-sk" />
                </div>
              ) : d ? (
                <>
                  <div className="font-num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', lineHeight: 1 }}>
                    {fmtPrice(d.price, d.currency)}
                  </div>
                  {d.price_change_pct != null && (
                    <div className="font-num" style={{ fontSize: 12, fontWeight: 600, color: pctColor(d.price_change_pct), marginTop: 6 }}>
                      {pctSign(d.price_change_pct)}{d.price_change_pct.toFixed(1)}% 24h
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--ink3)' }}>—</div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Stat rows ── */}
      {([
        {
          key: '7d', label: '7D Change',
          fn: (c: CompareCard) => {
            const d = c.data
            const v = d?.avg7d && d.price ? ((d.price - d.avg7d) / d.avg7d) * 100 : null
            return v != null ? { text: `${pctSign(v)}${v.toFixed(1)}%`, color: pctColor(v) } : null
          },
        },
        {
          key: '30d', label: '30D Change',
          fn: (c: CompareCard) => {
            const d = c.data
            const v = d?.avg30d && d.price ? ((d.price - d.avg30d) / d.avg30d) * 100 : null
            return v != null ? { text: `${pctSign(v)}${v.toFixed(1)}%`, color: pctColor(v) } : null
          },
        },
        {
          key: 'range', label: 'Price Range',
          fn: (c: CompareCard) => {
            const d = c.data
            if (!d || d.price_range_low == null || d.price_range_high == null) return null
            return {
              text: `${fmtPrice(d.price_range_low, d.currency)} – ${fmtPrice(d.price_range_high, d.currency)}`,
              color: 'var(--ink)',
            }
          },
        },
        {
          key: 'sales', label: '30D Sales',
          fn: (c: CompareCard) => {
            const d = c.data
            if (!d || d.sales_count_30d == null) return null
            return { text: String(d.sales_count_30d), color: 'var(--ink)' }
          },
        },
      ] as { key: string; label: string; fn: (c: CompareCard) => { text: string; color: string } | null }[]).map(row => (
        <div key={row.key} style={rowGrid}>
          {cards.map((c, i) => {
            const val = row.fn(c)
            return (
              <div key={c.id + c.grade + row.key} {...dh(i)} style={{ ...cs(i), display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{row.label}</span>
                {c.loading
                  ? <div style={{ width: 55, height: 11, borderRadius: 4, background: 'var(--surface2)' }} className="cmp-sk" />
                  : <span className="font-num" style={{ fontSize: 12, fontWeight: 600, color: val?.color ?? 'var(--ink3)' }}>{val?.text ?? '—'}</span>
                }
              </div>
            )
          })}
        </div>
      ))}

      {/* ── Score breakdown ── */}
      {hasSomeBreakdown && (
        <>
          <div style={rowGrid}>
            {cards.map((c, i) => {
              const sb = c.data?.score_breakdown
              return (
                <div key={c.id + c.grade + 'bkh'} {...dh(i)} style={{ ...cs(i), display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px 8px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)' }}>SCORE BREAKDOWN</span>
                  {sb && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: labelColor(sb.label), background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 5 }}>
                      {sb.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {([
            { key: 'trend', label: 'TREND',       fn: (sb: ScoreBreakdown) => Math.round(sb.trend / 30 * 100) },
            { key: 'liq',   label: 'LIQUIDITY',   fn: (sb: ScoreBreakdown) => Math.round(sb.liquidity / 25 * 100) },
            { key: 'con',   label: 'CONSISTENCY', fn: (sb: ScoreBreakdown) => Math.round(sb.consistency / 25 * 100) },
            { key: 'val',   label: 'VALUE',        fn: (sb: ScoreBreakdown) => Math.round(sb.value / 20 * 100) },
          ]).map(brow => (
            <div key={brow.key} style={rowGrid}>
              {cards.map((c, i) => {
                const sb = c.data?.score_breakdown
                const val = sb ? brow.fn(sb) : null
                const color = val != null ? scoreColor(val) : 'var(--ink3)'
                return (
                  <div key={c.id + c.grade + brow.key} {...dh(i)} style={{ ...cs(i), padding: '6px 14px 8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontSize: 10, letterSpacing: 1, color: 'var(--ink3)', fontWeight: 600 }}>{brow.label}</span>
                      <span className="font-num" style={{ fontSize: 11, color, fontWeight: 700 }}>{val ?? '—'}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      {val != null && (
                        <div style={{ height: '100%', width: `${val}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </>
      )}

      {/* ── Bottom cap ── */}
      <div style={rowGrid}>
        {cards.map((c, i) => (
          <div key={c.id + c.grade + 'bot'} style={{
            height: 4,
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border2)',
            borderRight: '1px solid var(--border2)',
            borderBottom: '1px solid var(--border2)',
            borderRadius: '0 0 14px 14px',
          }} />
        ))}
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
  fmtPrice,
}: {
  active?: boolean
  payload?: { dataKey: string; value: number; color: string }[]
  label?: string
  cards: CompareCard[]
  colors: string[]
  fmtPrice: (amount: number, nativeCurrency?: string | null) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#181828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', minWidth: 160 }}>
      <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>{label}</div>
      {payload.map((p, i) => {
        const key = p.dataKey
        const card = cards.find(c => (c.id + ':' + c.grade) === key)
        const colorIdx = cards.findIndex(c => (c.id + ':' + c.grade) === key)
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[colorIdx] ?? p.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--ink3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{card?.name ?? key}</span>
            <span className="font-num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
              {fmtPrice(p.value, card?.data?.currency)}
            </span>
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
  const { fmtCurrency, rates } = useCurrency()

  // ── Price formatter — converts native-currency prices to user's preferred ──
  const fmtPrice = useCallback((amount: number, nativeCurrency?: string | null): string => {
    if (nativeCurrency && nativeCurrency !== 'USD') {
      // Price is in a non-USD native currency (e.g. AUD from Poketrace AU sets).
      // Convert to USD first using the exchange rate, then format in the user's currency.
      const rate = rates[nativeCurrency] ?? 1
      const usdEquiv = amount / rate
      return fmtCurrency(usdEquiv)
    }
    return fmtCurrency(amount)
  }, [fmtCurrency, rates])

  // ── Auth gate ────────────────────────────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false)
  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/')
      setAuthChecked(true)
    })
  }, [router])

  // ── Mobile detection ─────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const MAX_CARDS = isMobile ? 2 : 5

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
    for (const c of updatedCards) params.append('c', encodeCardParam(c.id, c.grade, c.name))
    const qs = params.toString()
    router.replace(qs ? `/compare?${qs}` : '/compare', { scroll: false })
  }

  // ── Trim to mobile max ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!initialized || !isMobile) return
    if (cards.length > 2) {
      const trimmed = cards.slice(0, 2)
      setCards(trimmed)
      const params = new URLSearchParams()
      for (const c of trimmed) params.append('c', encodeCardParam(c.id, c.grade, c.name))
      const qs = params.toString()
      router.replace(qs ? `/compare?${qs}` : '/compare', { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, initialized])

  // ── Fetch live data ──────────────────────────────────────────────────────────

  const fetchCardData = useCallback(async (card: CompareCard) => {
    setCards(prev => prev.map(c =>
      c.id === card.id && c.grade === card.grade ? { ...c, loading: true, error: null } : c
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
        c.id === card.id && c.grade === card.grade ? { ...c, loading: false, error: 'Network error' } : c
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
      .slice(0, 5)
      .map(param => {
        const parsed = decodeCardParam(param)
        if (!parsed) return null
        return { id: parsed.id, name: parsed.name, setName: '', grade: parsed.grade, data: null, loading: true, error: null }
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

  // ── Click-outside ────────────────────────────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Add / remove / clear ─────────────────────────────────────────────────────

  function addCard(result: SearchResult, grade: string) {
    if (cards.length >= MAX_CARDS) return
    if (cards.some(c => c.id === result.id && c.grade === grade)) return
    const newCard: CompareCard = {
      id: result.id, name: result.name, setName: result.set.name,
      grade, imageUrl: result.image, data: null, loading: true, error: null,
    }
    const updated = [...cards, newCard]
    setCards(updated)
    updateUrl(updated)
    fetchCardData(newCard)
    setSearchQuery('')
    setSearchResults([])
    setShowDropdown(false)
  }

  function removeCard(id: string, grade: string) {
    const updated = cards.filter(c => !(c.id === id && c.grade === grade))
    setCards(updated)
    updateUrl(updated)
  }

  function clearAll() {
    setCards([])
    router.replace('/compare', { scroll: false })
  }

  // ── Reorder (drag-and-drop) ──────────────────────────────────────────────────

  function reorderCards(from: number, to: number) {
    const next = [...cards]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setCards(next)
    updateUrl(next)
  }

  // ── Chart ────────────────────────────────────────────────────────────────────

  const chartData = buildChartData(cards, chartWindow)
  const cardsWithHistory = cards.filter(c => c.data?.price_history?.length)
  const showChart = cardsWithHistory.length >= 2
  const atMax = cards.length >= MAX_CARDS

  if (!authChecked) return null

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes cmp-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .cmp-sk { animation: cmp-pulse 1.6s ease-in-out infinite; }
      `}</style>

      <Navbar />

      <main style={{ paddingTop: 72, paddingBottom: 80, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 16px 0' }}>

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Compare</p>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 6 }}>Compare Cards</h1>
            <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Side-by-side price &amp; score analysis</p>
          </div>

          {/* Search bar — hidden when at max */}
          {!atMax && (
            <div ref={searchRef} style={{ position: 'relative', marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={pendingGrade}
                  onChange={e => setPendingGrade(e.target.value)}
                  style={{ flexShrink: 0, padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
                >
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
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
                    placeholder={`Search for a card to compare… (${MAX_CARDS - cards.length} slot${MAX_CARDS - cards.length !== 1 ? 's' : ''} left)`}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 36px', borderRadius: showDropdown && searchResults.length > 0 ? '10px 10px 0 0' : 10, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }}
                    onKeyDown={e => { if (e.key === 'Escape') { setShowDropdown(false); setSearchQuery('') } }}
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => { setSearchQuery(''); setSearchResults([]); setShowDropdown(false) }}
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 38, background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  )}
                </div>
              </div>

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
                          style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none', cursor: alreadyAdded ? 'default' : 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, opacity: alreadyAdded ? 0.4 : 1 }}
                          onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          {r.image && <img src={tcgImg(r.image)} alt="" style={{ width: 32, height: 44, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{r.set.name}{r.number ? ` · #${r.number}` : ''}</div>
                          </div>
                          {alreadyAdded
                            ? <span style={{ fontSize: 10, color: 'var(--ink3)', flexShrink: 0 }}>Added</span>
                            : <span style={{ fontSize: 10, color: 'var(--gold)', background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.25)', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>+ {pendingGrade}</span>
                          }
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chips */}
          {cards.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24, alignItems: 'center' }}>
              {cards.map((c, i) => (
                <div key={c.id + ':' + c.grade} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 8px', borderRadius: 8, background: 'var(--surface)', border: `1px solid ${CARD_COLORS[i] ?? 'var(--border2)'}`, fontSize: 12, color: 'var(--ink)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: CARD_COLORS[i] ?? 'var(--border2)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: 'var(--ink3)', fontSize: 10 }}>{c.grade}</span>
                  <button onClick={() => removeCard(c.id, c.grade)} style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 0 0 2px', display: 'flex', alignItems: 'center' }}>×</button>
                </div>
              ))}
              <button onClick={clearAll} style={{ padding: '5px 12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--ink3)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Clear all
              </button>
            </div>
          )}

          {/* Empty state */}
          {cards.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 24px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⚖️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Add cards above to start comparing</div>
              <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Search for up to {MAX_CARDS} cards and see them side by side</div>
            </div>
          )}

          {/* Comparison table */}
          {cards.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: 24 }}>
              <div style={{ minWidth: `${Math.max(cards.length * 160, 320)}px` }}>
                <ComparisonTable
                  cards={cards}
                  colors={CARD_COLORS}
                  onRemove={removeCard}
                  onReorder={reorderCards}
                  showDragHandles={!isMobile}
                  fmtPrice={fmtPrice}
                />
              </div>
            </div>
          )}

          {/* Price history chart */}
          {showChart && (
            <div style={{ borderRadius: 14, padding: '20px 20px 12px', background: 'var(--surface)', border: '1px solid var(--border2)', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Price History</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([3, 6, 12] as const).map(w => (
                    <button key={w} onClick={() => setChartWindow(w)}
                      style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                        borderColor: chartWindow === w ? 'var(--gold)' : 'var(--border2)',
                        background: chartWindow === w ? 'rgba(232,197,71,0.1)' : 'transparent',
                        color: chartWindow === w ? 'var(--gold)' : 'var(--ink3)' }}>
                      {w}M
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                {cardsWithHistory.map(c => {
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
                    <YAxis tick={{ fontSize: 10, fill: 'var(--ink3)' }} tickLine={false} axisLine={false} tickFormatter={v => fmtPrice(v)} width={56} />
                    <Tooltip content={<MultiTooltip cards={cards} colors={CARD_COLORS} fmtPrice={fmtPrice} />} />
                    {cardsWithHistory.map(c => {
                      const colorIdx = cards.findIndex(cc => cc.id === c.id && cc.grade === c.grade)
                      return (
                        <Line key={c.id + ':' + c.grade} type="monotone" dataKey={c.id + ':' + c.grade}
                          stroke={CARD_COLORS[colorIdx] ?? '#fff'} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
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
