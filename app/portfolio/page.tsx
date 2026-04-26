'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { useCurrency, CURRENCIES, type CurrencyCode } from '@/lib/currency'
import { tcgImg } from '@/lib/img'
import { cacheGet, cacheSet } from '@/lib/searchCache'
import type { User } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DbPosition {
  id: string
  user_id: string
  card_id: string
  card_name: string
  set_name: string | null
  grade: string
  card_number: string | null
  image_url: string | null
  purchase_price: number   // USD
  quantity: number
  purchased_at: string | null
  added_at: string
  notes: string | null
}

interface PriceData {
  price: number
  price_change_pct: number
  avg7d: number | null
  avg30d: number | null
  score: number
}

interface Position extends DbPosition {
  priceData: PriceData | null
  priceLoading: boolean
  priceError: string | null
}

interface SearchResult {
  id: string
  name: string
  set: { name: string; slug: string }
  cardNumber?: string
  image?: string
}

type SortKey = 'pl' | 'plpct' | 'current' | 'cost' | 'change24h' | 'change7d' | 'change30d' | 'name'

const GRADES = [
  'Raw', 'PSA 10', 'PSA 9', 'PSA 8', 'PSA 7', 'PSA 6',
  'BGS 9.5', 'BGS 9', 'BGS 8.5', 'BGS 8',
  'CGC 10', 'CGC 9.5', 'CGC 9',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function pctColor(n: number | null) {
  if (n == null) return 'var(--ink3)'
  return n >= 0 ? 'var(--green)' : 'var(--red)'
}
function pctSign(n: number) { return n >= 0 ? '+' : '' }

function fmtPct(n: number | null) {
  if (n == null) return '—'
  return `${pctSign(n)}${n.toFixed(1)}%`
}

/** Format a USD amount with the sign BEFORE the currency symbol (−A$698, not A$−698) */
function fmtSigned(fmtFn: (n: number) => string, usd: number): string {
  return (usd >= 0 ? '+' : '−') + fmtFn(Math.abs(usd))
}

function calcChanges(pd: PriceData) {
  const cur = pd.price
  const c7  = pd.avg7d  ? ((cur - pd.avg7d)  / pd.avg7d)  * 100 : null
  const c30 = pd.avg30d ? ((cur - pd.avg30d) / pd.avg30d) * 100 : null
  return { c24: pd.price_change_pct, c7, c30 }
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ last }: { last: boolean }) {
  return (
    <div className="pf-row" style={{ borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0 }} className="sk-pulse" />
        <div>
          <div style={{ width: 120, height: 12, borderRadius: 4, background: 'var(--surface2)', marginBottom: 6 }} className="sk-pulse" />
          <div style={{ width: 75, height: 10, borderRadius: 4, background: 'var(--surface2)' }} className="sk-pulse" />
        </div>
      </div>
      {[72, 72, 32, 64, 44, 44, 44, 48].map((w, i) => (
        <div key={i} className="pf-hide-mobile" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: w, height: 12, borderRadius: 4, background: 'var(--surface2)' }} className="sk-pulse" />
        </div>
      ))}
      <div className="pf-hide-mobile" />
    </div>
  )
}

// ── Add/Edit Modal ─────────────────────────────────────────────────────────────

interface ModalProps {
  mode: 'add' | 'edit'
  editPosition?: Position
  onClose: () => void
  onSave: (payload: Partial<DbPosition>) => Promise<void>
  currency: CurrencyCode
  rates: Record<string, number>
}

function PositionModal({ mode, editPosition, onClose, onSave, currency, rates }: ModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedCard, setSelectedCard] = useState<SearchResult | null>(null)
  const [selectedGrade, setSelectedGrade] = useState(editPosition?.grade ?? 'Raw')
  const [priceInput, setPriceInput] = useState(
    editPosition ? String((editPosition.purchase_price * (rates[currency] ?? 1)).toFixed(CURRENCIES[currency]?.decimals ?? 2)) : ''
  )
  const [qtyInput, setQtyInput] = useState(String(editPosition?.quantity ?? 1))
  const [dateInput, setDateInput] = useState(editPosition?.purchased_at?.slice(0, 10) ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sym = CURRENCIES[currency]?.symbol ?? '$'

  useEffect(() => {
    if (mode === 'edit' || !searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]); return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const r = await fetch(`/api/pt/cards?search=${encodeURIComponent(searchQuery)}&limit=8`)
        const json = await r.json()
        setSearchResults((json.data ?? []).slice(0, 8))
      } catch { setSearchResults([]) } finally { setSearchLoading(false) }
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery, mode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const priceLocal = parseFloat(priceInput)
    const qty = parseInt(qtyInput, 10)
    if (isNaN(priceLocal) || priceLocal <= 0) { setError('Enter a valid purchase price.'); return }
    if (isNaN(qty) || qty < 1) { setError('Quantity must be at least 1.'); return }
    // Convert local currency → USD for storage
    const priceUSD = priceLocal / (rates[currency] ?? 1)
    setSaving(true)
    try {
      if (mode === 'add') {
        if (!selectedCard) { setError('Select a card first.'); setSaving(false); return }
        await onSave({
          card_id: selectedCard.id,
          card_name: selectedCard.name,
          set_name: selectedCard.set.name,
          grade: selectedGrade,
          card_number: selectedCard.cardNumber ?? null,
          image_url: selectedCard.image ?? null,
          purchase_price: priceUSD,
          quantity: qty,
          purchased_at: dateInput || null,
        })
      } else {
        await onSave({ purchase_price: priceUSD, quantity: qty, purchased_at: dateInput || null })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 480, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
            {mode === 'add' ? 'Add Position' : 'Edit Position'}
          </span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--ink3)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Card search (add mode only) */}
          {mode === 'add' && (
            <div>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>CARD</label>
              {selectedCard ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--gold)', cursor: 'pointer' }}
                  onClick={() => { setSelectedCard(null); setSearchQuery('') }}>
                  {selectedCard.image && (
                    <img src={tcgImg(selectedCard.image)} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedCard.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{selectedCard.set.name}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink3)', flexShrink: 0 }}>Change ×</span>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by card name…"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                  />
                  {(searchLoading || searchResults.length > 0) && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 10, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                      {searchLoading && (
                        <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink3)' }}>Searching…</div>
                      )}
                      {searchResults.map((r, i) => (
                        <button
                          key={r.id} type="button"
                          onClick={() => { setSelectedCard(r); setSearchResults([]) }}
                          style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {r.image && <img src={tcgImg(r.image)} alt="" style={{ width: 30, height: 30, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }} />}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{r.set.name}{r.cardNumber ? ` · #${r.cardNumber}` : ''}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Edit mode: show card info read-only */}
          {mode === 'edit' && editPosition && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{editPosition.card_name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{editPosition.set_name} · {editPosition.grade}</div>
            </div>
          )}

          {/* Grade (add mode only) */}
          {mode === 'add' && (
            <div>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>GRADE</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {GRADES.map(g => (
                  <button
                    key={g} type="button"
                    onClick={() => setSelectedGrade(g)}
                    style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${selectedGrade === g ? 'var(--gold)' : 'var(--border2)'}`, background: selectedGrade === g ? 'rgba(232,197,71,0.1)' : 'var(--bg)', color: selectedGrade === g ? 'var(--gold)' : 'var(--ink2)', fontSize: 12, cursor: 'pointer', fontWeight: selectedGrade === g ? 600 : 400, transition: 'all 0.12s' }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price + Qty row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>
                PURCHASE PRICE ({currency})
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--ink3)', pointerEvents: 'none' }}>
                  {sym}
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={priceInput}
                  onChange={e => setPriceInput(e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%', boxSizing: 'border-box', padding: `11px 14px 11px ${sym.length > 1 ? '30px' : '24px'}`, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>QTY</label>
              <input
                type="number"
                min="1"
                step="1"
                value={qtyInput}
                onChange={e => setQtyInput(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              />
            </div>
          </div>

          {/* Purchase date (optional) */}
          <div>
            <label style={{ display: 'block', fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>
              PURCHASE DATE <span style={{ opacity: 0.5 }}>(optional)</span>
            </label>
            <input
              type="date"
              value={dateInput}
              onChange={e => setDateInput(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none', colorScheme: 'dark' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
            />
          </div>

          {error && (
            <div style={{ borderRadius: 8, padding: '10px 14px', background: 'rgba(232,82,74,0.08)', border: '1px solid rgba(232,82,74,0.25)', fontSize: 13, color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: 'var(--gold)', color: '#080810', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : mode === 'add' ? 'Add to Portfolio' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Change pill ───────────────────────────────────────────────────────────────

function ChangePill({ value }: { value: number | null }) {
  if (value == null) return <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>
  const up = value >= 0
  return (
    <span className="font-num" style={{ fontSize: 12, fontWeight: 600, color: up ? 'var(--green)' : 'var(--red)' }}>
      {pctSign(value)}{value.toFixed(1)}%
    </span>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const supabase = createClient()
  const { currency, rates, fmtCurrency } = useCurrency()

  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [positions, setPositions] = useState<Position[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editPos, setEditPos] = useState<Position | null>(null)
  const [sort, setSort] = useState<SortKey>('pl')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [filter, setFilter] = useState<'all' | 'winning' | 'losing'>('all')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function flash(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setAuthChecked(true)
    })
  }, [])

  // ── Price fetch with auto-retry ───────────────────────────────────────────
  async function fetchPrice(pos: Position, bustCache = false, attempt = 0) {
    const localKey = `${pos.card_id}:${pos.grade}`

    // ── Client-side cache hit (instant) ──────────────────────────────────
    if (attempt === 0 && !bustCache) {
      const hit = cacheGet<PriceData>(localKey)
      if (hit) {
        setPositions(prev => prev.map(p => p.id === pos.id
          ? { ...p, priceData: hit, priceLoading: false, priceError: null } : p))
        return
      }
    }

    const params = new URLSearchParams({ grade: pos.grade, name: pos.card_name })
    if (pos.set_name)              params.set('set', pos.set_name)
    if (pos.card_number)           params.set('number', pos.card_number)
    if (bustCache || attempt > 0)  params.set('bust_cache', '1')

    try {
      const r = await fetch(`/api/card/${pos.card_id}?${params}`)
      const json = await r.json().catch(() => null)
      if (!r.ok || !json?.data) {
        if (r.status !== 404 && attempt < 2) {
          await new Promise(res => setTimeout(res, (attempt + 1) * 1500))
          return fetchPrice(pos, bustCache, attempt + 1)
        }
        setPositions(prev => prev.map(p => p.id === pos.id
          ? { ...p, priceLoading: false, priceError: json?.error ?? `HTTP ${r.status}` } : p))
        return
      }
      cacheSet(localKey, json.data)
      setPositions(prev => prev.map(p => p.id === pos.id
        ? { ...p, priceData: json.data, priceLoading: false, priceError: null } : p))
    } catch {
      if (attempt < 2) {
        await new Promise(res => setTimeout(res, (attempt + 1) * 1500))
        return fetchPrice(pos, bustCache, attempt + 1)
      }
      setPositions(prev => prev.map(p => p.id === pos.id
        ? { ...p, priceLoading: false, priceError: 'Network error' } : p))
    }
  }

  // ── Load portfolio ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return
    setListLoading(true)
    try {
      const r = await fetch('/api/portfolio')
      const json = await r.json()
      const enriched: Position[] = (json.positions ?? []).map((p: DbPosition) => {
        const hit = cacheGet<PriceData>(`${p.card_id}:${p.grade}`)
        return { ...p, priceData: hit ?? null, priceLoading: !hit, priceError: null }
      })
      setPositions(enriched)
      const uncached = enriched.filter(p => !p.priceData)
      uncached.forEach((pos, i) => setTimeout(() => fetchPrice(pos), i * 600))
    } finally {
      setListLoading(false)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // ── Add position ──────────────────────────────────────────────────────────
  async function handleAdd(payload: Partial<DbPosition>) {
    const r = await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await r.json()
    if (!r.ok) throw new Error(json.error ?? 'Failed to add position')
    const hit = cacheGet<PriceData>(`${json.position.card_id}:${json.position.grade}`)
    const newPos: Position = { ...json.position, priceData: hit ?? null, priceLoading: !hit, priceError: null }
    setPositions(prev => [newPos, ...prev])
    if (!hit) setTimeout(() => fetchPrice(newPos), 100)
    flash('ok', 'Position added.')
  }

  // ── Edit position ─────────────────────────────────────────────────────────
  async function handleEdit(payload: Partial<DbPosition>) {
    if (!editPos) return
    const r = await fetch(`/api/portfolio?id=${editPos.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await r.json()
    if (!r.ok) throw new Error(json.error ?? 'Failed to update')
    setPositions(prev => prev.map(p => p.id === editPos.id
      ? { ...p, ...json.position } : p))
    flash('ok', 'Position updated.')
  }

  // ── Remove position ───────────────────────────────────────────────────────
  async function handleRemove(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setPositions(prev => prev.filter(p => p.id !== id))
    await fetch(`/api/portfolio?id=${id}`, { method: 'DELETE' })
    flash('ok', 'Position removed.')
  }

  // ── Sort toggle ───────────────────────────────────────────────────────────
  function handleSort(key: SortKey) {
    if (sort === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSort(key); setSortDir('desc') }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const withData = positions.filter(p => p.priceData)

  const totalCostUSD     = positions.reduce((s, p) => s + p.purchase_price * p.quantity, 0)
  // Only include positions that have loaded market prices — no fallback to purchase price
  const pricedCostUSD    = withData.reduce((s, p) => s + p.purchase_price * p.quantity, 0)
  const totalValueUSD    = withData.reduce((s, p) => s + p.priceData!.price * p.quantity, 0)
  const allPriced        = withData.length === positions.length && positions.length > 0
  const totalPLUSD       = totalValueUSD - pricedCostUSD
  const totalPLPct       = pricedCostUSD > 0 ? (totalPLUSD / pricedCostUSD) * 100 : 0
  const dayGainUSD       = withData.reduce((s, p) => {
    const pd = p.priceData!
    const prev = pd.price / (1 + pd.price_change_pct / 100)
    return s + (pd.price - prev) * p.quantity
  }, 0)

  const filtered = positions
    .filter(p => {
      if (filter === 'all') return true
      if (!p.priceData) return false
      const pl = p.priceData.price - p.purchase_price
      return filter === 'winning' ? pl >= 0 : pl < 0
    })
    .sort((a, b) => {
      const dir = sortDir === 'desc' ? -1 : 1
      const ap = a.priceData, bp = b.priceData
      if (sort === 'name')     return dir * a.card_name.localeCompare(b.card_name)
      if (sort === 'current')  return dir * ((bp?.price ?? 0) - (ap?.price ?? 0))
      if (sort === 'cost')     return dir * (b.purchase_price - a.purchase_price)
      if (sort === 'change24h') return dir * ((bp?.price_change_pct ?? 0) - (ap?.price_change_pct ?? 0))
      if (sort === 'change7d') {
        const ac = ap?.avg7d  ? ((ap.price - ap.avg7d)  / ap.avg7d)  * 100 : 0
        const bc = bp?.avg7d  ? ((bp.price - bp.avg7d)  / bp.avg7d)  * 100 : 0
        return dir * (bc - ac)
      }
      if (sort === 'change30d') {
        const ac = ap?.avg30d ? ((ap.price - ap.avg30d) / ap.avg30d) * 100 : 0
        const bc = bp?.avg30d ? ((bp.price - bp.avg30d) / bp.avg30d) * 100 : 0
        return dir * (bc - ac)
      }
      if (sort === 'plpct') {
        const ap2 = a.priceData?.price ?? a.purchase_price
        const bp2 = b.priceData?.price ?? b.purchase_price
        const apct = ((ap2 - a.purchase_price) / a.purchase_price) * 100
        const bpct = ((bp2 - b.purchase_price) / b.purchase_price) * 100
        return dir * (bpct - apct)
      }
      // sort === 'pl' (default)
      const aPL = ((ap?.price ?? a.purchase_price) - a.purchase_price) * a.quantity
      const bPL = ((bp?.price ?? b.purchase_price) - b.purchase_price) * b.quantity
      return dir * (bPL - aPL)
    })

  // ── Sort header helper ────────────────────────────────────────────────────
  function SortTh({ label, k, right = true }: { label: string; k: SortKey; right?: boolean }) {
    const active = sort === k
    return (
      <button
        onClick={() => handleSort(k)}
        className="pf-hide-mobile"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: right ? 'right' : 'left', fontSize: 10, letterSpacing: 1, color: active ? 'var(--gold)' : 'var(--ink3)', fontWeight: active ? 700 : 500, display: 'flex', alignItems: 'center', justifyContent: right ? 'flex-end' : 'flex-start', gap: 4 }}
      >
        {label}
        {active && <span style={{ fontSize: 9 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>}
      </button>
    )
  }

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (authChecked && !user) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 88, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 380, textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>📈</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>Sign in to view your portfolio</h2>
            <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.6, marginBottom: 28 }}>
              Track every purchase, monitor P&L, and see live market data across your collection.
            </p>
            <Link href="/" style={{ display: 'inline-block', padding: '13px 28px', borderRadius: 12, background: 'var(--gold)', color: '#080810', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
              Sign in
            </Link>
          </div>
        </main>
      </>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />

      <style>{`
        @keyframes sk-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .sk-pulse { animation: sk-pulse 1.6s ease-in-out infinite; }
        .pf-row, .pf-header {
          display: grid;
          grid-template-columns: minmax(180px,2fr) 110px 110px 50px 100px 70px 70px 70px 80px;
          align-items: center;
          padding: 0 20px;
          gap: 8px;
        }
        .pf-header { padding: 10px 20px; }
        .pf-row    { padding: 13px 20px; min-height: 64px; }
        .pf-hide-mobile { display: flex; }
        .pf-act-btn {
          height: 28px; padding: 0 10px; border-radius: 7px;
          border: 1px solid var(--border); background: transparent;
          color: var(--ink3); font-size: 11px; font-weight: 600;
          cursor: pointer; white-space: nowrap; transition: all 0.15s;
        }
        .pf-act-btn:hover { border-color: var(--gold); color: var(--gold); }
        .pf-act-btn.del:hover { border-color: var(--red); color: var(--red); }
        @media (max-width: 760px) {
          .pf-row, .pf-header {
            grid-template-columns: 1fr 88px 64px;
            gap: 4px;
          }
          .pf-hide-mobile { display: none !important; }
          .pf-row { padding: 12px 14px; min-height: 56px; }
          .pf-header { padding: 8px 14px; }
          .pf-stats-bar { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <main style={{ paddingTop: 72, paddingBottom: 96, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 16px 0' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Portfolio</p>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px' }}>My Collection</h1>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              style={{ padding: '9px 20px', borderRadius: 10, background: 'var(--gold)', color: '#080810', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              + Add Position
            </button>
          </div>

          {/* ── Flash message ── */}
          {msg && (
            <div style={{ marginBottom: 16, borderRadius: 10, padding: '11px 16px', background: msg.type === 'ok' ? 'rgba(61,232,138,0.08)' : 'rgba(232,82,74,0.08)', border: `1px solid ${msg.type === 'ok' ? 'rgba(61,232,138,0.2)' : 'rgba(232,82,74,0.25)'}`, fontSize: 13, color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)' }}>
              {msg.text}
            </div>
          )}

          {/* ── Stats bar ── */}
          <div className="pf-stats-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
            {[
              {
                label: 'Market Value',
                value: withData.length > 0 ? fmtCurrency(totalValueUSD) : '—',
                sub: withData.length > 0
                  ? `${positions.length} position${positions.length !== 1 ? 's' : ''}${!allPriced ? ` · ${withData.length}/${positions.length} priced` : ''}`
                  : 'loading prices…',
                color: withData.length > 0 ? 'var(--ink)' : 'var(--ink3)',
              },
              {
                label: 'Cost Basis',
                value: fmtCurrency(totalCostUSD),
                sub: 'total invested',
                color: 'var(--ink)',
              },
              {
                label: 'Total P&L',
                value: withData.length > 0 ? fmtSigned(fmtCurrency, totalPLUSD) : '—',
                sub: withData.length > 0
                  ? `${pctSign(totalPLPct)}${totalPLPct.toFixed(1)}%${allPriced ? ' overall' : ` on ${withData.length}/${positions.length}`}`
                  : 'loading prices…',
                color: withData.length > 0 ? (totalPLUSD >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--ink3)',
              },
              {
                label: "Today's Gain",
                value: withData.length > 0 ? fmtSigned(fmtCurrency, dayGainUSD) : '—',
                sub: '24h change',
                color: withData.length > 0 ? (dayGainUSD >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--ink3)',
              },
            ].map((s, i) => (
              <div key={i} style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
                <div style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>{s.label}</div>
                <div className="font-num" style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: '-0.5px', lineHeight: 1.1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 5 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Controls ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 2, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border2)' }}>
              {(['all', 'winning', 'losing'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: filter === f ? 'var(--surface2)' : 'transparent', color: filter === f ? 'var(--ink)' : 'var(--ink3)', transition: 'all 0.15s' }}>
                  {f === 'all' ? 'All' : f === 'winning' ? '▲ Winning' : '▼ Losing'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
              {positions.filter(p => p.priceData).length}/{positions.length} prices loaded
            </div>
          </div>

          {/* ── Table ── */}
          <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>

            {/* Header */}
            <div className="pf-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <button onClick={() => handleSort('name')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontSize: 10, letterSpacing: 1, color: sort === 'name' ? 'var(--gold)' : 'var(--ink3)', fontWeight: sort === 'name' ? 700 : 500, display: 'flex', gap: 4, alignItems: 'center' }}>
                CARD {sort === 'name' && <span style={{ fontSize: 9 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>}
              </button>
              <SortTh label="MKT VALUE" k="current" />
              <SortTh label="P&amp;L" k="plpct" />
              <div className="pf-hide-mobile" style={{ textAlign: 'right', fontSize: 10, letterSpacing: 1, color: 'var(--ink3)' }}>QTY</div>
              <SortTh label="COST/EA" k="cost" />
              <SortTh label="24H" k="change24h" />
              <SortTh label="7D" k="change7d" />
              <SortTh label="30D" k="change30d" />
              <div className="pf-hide-mobile" />
            </div>

            {/* Loading skeletons */}
            {listLoading && [0, 1, 2].map(i => <SkeletonRow key={i} last={i === 2} />)}

            {/* Empty state */}
            {!listLoading && positions.length === 0 && (
              <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>No positions yet</div>
                <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 24 }}>Add your first card to start tracking your collection's performance.</div>
                <button onClick={() => setShowAdd(true)} style={{ padding: '11px 24px', borderRadius: 12, background: 'var(--gold)', color: '#080810', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  + Add Position
                </button>
              </div>
            )}

            {/* Filter empty */}
            {!listLoading && positions.length > 0 && filtered.length === 0 && (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 12 }}>No positions match this filter.</div>
                <button onClick={() => setFilter('all')} style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer' }}>Show all</button>
              </div>
            )}

            {/* Position rows */}
            {!listLoading && filtered.map((pos, i) => {
              const pd = pos.priceData
              const currentUSD   = pd?.price ?? null
              const costUSD      = pos.purchase_price
              const plPerCardUSD = currentUSD != null ? currentUSD - costUSD : null
              const plTotalUSD   = plPerCardUSD != null ? plPerCardUSD * pos.quantity : null
              const plPct        = plPerCardUSD != null ? (plPerCardUSD / costUSD) * 100 : null
              const changes      = pd ? calcChanges(pd) : null
              const isUp         = (plPct ?? 0) >= 0

              const cardParams = new URLSearchParams({ name: pos.card_name, grade: pos.grade })
              if (pos.set_name) cardParams.set('set', pos.set_name)

              return (
                <div
                  key={pos.id}
                  className="pf-row"
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s', cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Card info */}
                  <Link href={`/card/${pos.card_id}?${cardParams}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, textDecoration: 'none' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                      {pos.image_url && <img src={tcgImg(pos.image_url)} alt={pos.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pos.card_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>
                        {pos.set_name ? `${pos.set_name} · ` : ''}{pos.grade}
                        {pos.purchased_at && <span style={{ opacity: 0.55 }}> · {new Date(pos.purchased_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>}
                      </div>
                      {/* Current price shown in card cell on mobile */}
                      <div className="pf-show-mobile" style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 3, fontWeight: 600 }}>
                        {pd ? fmtCurrency(pd.price) : pos.priceLoading ? '…' : '—'}
                        {pos.quantity > 1 && pd && <span style={{ color: 'var(--ink3)', fontWeight: 400 }}> × {pos.quantity}</span>}
                      </div>
                    </div>
                  </Link>

                  {/* Current (desktop col 2, hidden on mobile — shown in card cell instead) */}
                  <div style={{ textAlign: 'right' }}>
                    {pos.priceLoading ? (
                      <div style={{ width: 56, height: 13, borderRadius: 4, background: 'var(--surface2)', marginLeft: 'auto' }} className="sk-pulse" />
                    ) : pd ? (
                      <>
                        <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(pd.price)}</div>
                        {pos.quantity > 1 && <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>× {pos.quantity}</div>}
                      </>
                    ) : pos.priceError ? (
                      <button onClick={() => fetchPrice(pos, true)} style={{ fontSize: 9, color: 'var(--ink3)', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}>↺ retry</button>
                    ) : <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>}
                  </div>

                  {/* P&L — shown on mobile too */}
                  <div style={{ textAlign: 'right' }}>
                    {pos.priceLoading ? (
                      <div style={{ width: 60, height: 13, borderRadius: 4, background: 'var(--surface2)', marginLeft: 'auto' }} className="sk-pulse" />
                    ) : plTotalUSD != null ? (
                      <>
                        <div className="font-num" style={{ fontSize: 12, fontWeight: 700, color: isUp ? 'var(--green)' : 'var(--red)' }}>
                          {fmtSigned(fmtCurrency, plTotalUSD)}
                        </div>
                        <div className="font-num" style={{ fontSize: 10, color: isUp ? 'var(--green)' : 'var(--red)', opacity: 0.8, marginTop: 2 }}>
                          {fmtPct(plPct)}
                        </div>
                      </>
                    ) : <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>}
                  </div>

                  {/* Qty — desktop only */}
                  <div className="pf-hide-mobile" style={{ textAlign: 'right' }}>
                    <span className="font-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{pos.quantity}</span>
                  </div>

                  {/* Cost/card — desktop only */}
                  <div className="pf-hide-mobile" style={{ textAlign: 'right' }}>
                    <div className="font-num" style={{ fontSize: 12, color: 'var(--ink2)' }}>{fmtCurrency(costUSD)}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>avg cost</div>
                  </div>

                  {/* 24h — desktop only */}
                  <div className="pf-hide-mobile" style={{ textAlign: 'right' }}>
                    {pos.priceLoading ? <div style={{ width: 40, height: 12, borderRadius: 4, background: 'var(--surface2)', marginLeft: 'auto' }} className="sk-pulse" /> : <ChangePill value={changes?.c24 ?? null} />}
                  </div>

                  {/* 7d — desktop only */}
                  <div className="pf-hide-mobile" style={{ textAlign: 'right' }}>
                    {pos.priceLoading ? <div style={{ width: 40, height: 12, borderRadius: 4, background: 'var(--surface2)', marginLeft: 'auto' }} className="sk-pulse" /> : <ChangePill value={changes?.c7 ?? null} />}
                  </div>

                  {/* 30d — desktop only */}
                  <div className="pf-hide-mobile" style={{ textAlign: 'right' }}>
                    {pos.priceLoading ? <div style={{ width: 40, height: 12, borderRadius: 4, background: 'var(--surface2)', marginLeft: 'auto' }} className="sk-pulse" /> : <ChangePill value={changes?.c30 ?? null} />}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button className="pf-act-btn" onClick={() => setEditPos(pos)} title="Edit position">Edit</button>
                    <button className="pf-act-btn del" onClick={e => handleRemove(e, pos.id)} title="Remove position">✕</button>
                  </div>
                </div>
              )
            })}
          </div>

          <p style={{ fontSize: 11, color: 'var(--ink3)', textAlign: 'center', marginTop: 24 }}>
            Prices sourced via Poketrace · P&L based on purchase price vs current market · All values in {currency}
          </p>

        </div>
      </main>

      {/* ── Modals ── */}
      {showAdd && (
        <PositionModal
          mode="add"
          onClose={() => setShowAdd(false)}
          onSave={handleAdd}
          currency={currency}
          rates={rates}
        />
      )}
      {editPos && (
        <PositionModal
          mode="edit"
          editPosition={editPos}
          onClose={() => setEditPos(null)}
          onSave={handleEdit}
          currency={currency}
          rates={rates}
        />
      )}
    </>
  )
}
