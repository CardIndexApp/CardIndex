'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { useCurrency, CURRENCIES, type CurrencyCode } from '@/lib/currency'
import { tcgImg } from '@/lib/img'
import { cacheGet, cacheSet } from '@/lib/searchCache'
import type { User } from '@supabase/supabase-js'
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

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
  sold: boolean
  sale_price: number | null  // USD
  sold_at: string | null
}

interface PriceData {
  price: number
  price_change_pct: number
  avg7d: number | null
  avg30d: number | null
  score: number
  price_history?: Array<{ month: string; price: number; volume?: number }>
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
        <div style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0 }} className="skeleton" />
        <div>
          <div style={{ width: 120, marginBottom: 6 }} className="skeleton skeleton-text" />
          <div style={{ width: 75 }} className="skeleton skeleton-text" />
        </div>
      </div>
      {/* placeholder cells for cols 2–7 */}
      {[38, 68, 68, 68, 56, 20].map((w, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: w }} className="skeleton skeleton-text" />
        </div>
      ))}
    </div>
  )
}

// ── Add/Edit Modal ─────────────────────────────────────────────────────────────

interface ModalProps {
  mode: 'add' | 'edit'
  editPosition?: Position
  onClose: () => void
  onRemove?: () => void
  onMarkSold?: () => void
  onSave: (payload: Partial<DbPosition>) => Promise<void>
  currency: CurrencyCode
  rates: Record<string, number>
}

function PositionModal({ mode, editPosition, onClose, onSave, onRemove, onMarkSold, currency, rates }: ModalProps) {
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
        const r = await fetch(`/api/pt/cards?search=${encodeURIComponent(searchQuery)}&limit=20`)
        const json = await r.json()
        setSearchResults((json.data ?? []).slice(0, 20))
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
      <div style={{ width: '100%', maxWidth: 480, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
            {mode === 'add' ? 'Add Position' : 'Edit Position'}
          </span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--ink3)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto', flex: 1 }}>

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
                <div>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                      {searchLoading
                        ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="2" strokeLinecap="round" style={{ animation: 'srch-spin 0.7s linear infinite', display: 'block' }}><path d="M8 1a7 7 0 1 0 7 7"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><circle cx="6.5" cy="6.5" r="4.5"/><path d="M14 14l-3-3"/></svg>
                      }
                    </div>
                    <input
                      autoFocus
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search by card name…"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 36px', borderRadius: searchResults.length > 0 ? '10px 10px 0 0' : 10, background: 'var(--bg)', border: '1px solid var(--border2)', borderBottom: searchResults.length > 0 ? '1px solid var(--border)' : '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                      onBlur={e => (e.currentTarget.style.borderColor = searchResults.length > 0 ? 'var(--border2)' : 'var(--border2)')}
                    />
                    {searchQuery && (
                      <button type="button" onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    )}
                  </div>
                  {searchResults.length > 0 && (
                    <div style={{ borderRadius: '0 0 10px 10px', background: 'var(--bg)', border: '1px solid var(--border2)', borderTop: 'none', overflow: 'hidden' }}>
                      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                        {searchResults.map((r, i) => (
                          <button
                            key={r.id} type="button"
                            onClick={() => { setSelectedCard(r); setSearchResults([]) }}
                            style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            {r.image && <img src={tcgImg(r.image)} alt="" style={{ width: 32, height: 44, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }} />}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{r.set.name}{r.cardNumber ? ` · #${r.cardNumber}` : ''}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                      {searchResults.length >= 20 && (
                        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--ink3)', textAlign: 'center' }}>
                          Showing top 20 — type more to narrow results
                        </div>
                      )}
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

          {mode === 'edit' && onMarkSold && (
            <button
              type="button"
              onClick={() => { onClose(); onMarkSold() }}
              style={{ width: '100%', padding: '11px 0', borderRadius: 12, border: '1px solid rgba(232,197,71,0.3)', background: 'rgba(232,197,71,0.06)', color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,197,71,0.12)'; e.currentTarget.style.borderColor = 'rgba(232,197,71,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(232,197,71,0.06)'; e.currentTarget.style.borderColor = 'rgba(232,197,71,0.3)' }}
            >
              Mark as Sold →
            </button>
          )}

          {mode === 'edit' && onRemove && (
            <button
              type="button"
              onClick={() => { onRemove(); onClose() }}
              style={{ width: '100%', padding: '11px 0', borderRadius: 12, border: '1px solid rgba(232,82,74,0.3)', background: 'rgba(232,82,74,0.06)', color: 'var(--red)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,82,74,0.12)'; e.currentTarget.style.borderColor = 'rgba(232,82,74,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(232,82,74,0.06)'; e.currentTarget.style.borderColor = 'rgba(232,82,74,0.3)' }}
            >
              Remove position
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

// ── Sell Modal ────────────────────────────────────────────────────────────────

interface SellModalProps {
  position: Position
  onClose: () => void
  onSell: (salePrice: number, soldAt: string | null) => Promise<void>
  currency: CurrencyCode
  rates: Record<string, number>
  fmtCurrency: (n: number) => string
}

function SellModal({ position, onClose, onSell, currency, rates, fmtCurrency }: SellModalProps) {
  const [priceInput, setPriceInput]   = useState('')
  const [dateInput,  setDateInput]    = useState(new Date().toISOString().slice(0, 10))
  const [saving,     setSaving]       = useState(false)
  const [error,      setError]        = useState('')
  const sym = CURRENCIES[currency]?.symbol ?? '$'

  const purchaseLocal = position.purchase_price * (rates[currency] ?? 1)
  const marketLocal   = position.priceData ? position.priceData.price * (rates[currency] ?? 1) : null

  const priceLocalVal = parseFloat(priceInput)
  const priceUSDVal   = !isNaN(priceLocalVal) ? priceLocalVal / (rates[currency] ?? 1) : null
  const plUSD         = priceUSDVal != null ? (priceUSDVal - position.purchase_price) * position.quantity : null
  const plPct         = priceUSDVal != null && position.purchase_price > 0
    ? ((priceUSDVal - position.purchase_price) / position.purchase_price) * 100
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isNaN(priceLocalVal) || priceLocalVal <= 0) { setError('Enter a valid sale price.'); return }
    setSaving(true)
    try {
      await onSell(priceLocalVal / (rates[currency] ?? 1), dateInput || null)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 400, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Mark as Sold</span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--ink3)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Card summary */}
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{position.card_name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
              {position.set_name ? `${position.set_name} · ` : ''}{position.grade}
              {position.quantity > 1 ? ` · Qty ${position.quantity}` : ''}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4, display: 'flex', gap: 12 }}>
              <span>Cost: <span className="font-num" style={{ color: 'var(--ink2)' }}>{sym}{purchaseLocal.toFixed(2)}</span></span>
              {marketLocal != null && (
                <span>Market: <span className="font-num" style={{ color: 'var(--ink2)' }}>{sym}{marketLocal.toFixed(2)}</span></span>
              )}
            </div>
          </div>

          {/* Sale price */}
          <div>
            <label style={{ display: 'block', fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>
              SALE PRICE PER CARD ({currency})
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--ink3)', pointerEvents: 'none' }}>{sym}</span>
              <input
                type="number" min="0.01" step="0.01" autoFocus required
                value={priceInput}
                onChange={e => { setPriceInput(e.target.value); setError('') }}
                placeholder="0.00"
                style={{ width: '100%', boxSizing: 'border-box', padding: `11px 14px 11px ${sym.length > 1 ? '30px' : '24px'}`, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              />
            </div>
          </div>

          {/* Sale date */}
          <div>
            <label style={{ display: 'block', fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>
              SALE DATE <span style={{ opacity: 0.5 }}>(optional)</span>
            </label>
            <input
              type="date" value={dateInput}
              onChange={e => setDateInput(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none', colorScheme: 'dark' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
            />
          </div>

          {/* Live P&L preview */}
          {plUSD != null && !isNaN(plUSD) && (
            <div style={{ borderRadius: 10, padding: '12px 14px', background: plUSD >= 0 ? 'rgba(61,232,138,0.06)' : 'rgba(232,82,74,0.06)', border: `1px solid ${plUSD >= 0 ? 'rgba(61,232,138,0.2)' : 'rgba(232,82,74,0.2)'}` }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 6, textTransform: 'uppercase' }}>REALIZED P&amp;L</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="font-num" style={{ fontSize: 18, fontWeight: 700, color: plUSD >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {plUSD >= 0 ? '+' : '−'}{fmtCurrency(Math.abs(plUSD))}
                </span>
                {plPct != null && (
                  <span className="font-num" style={{ fontSize: 13, color: plUSD >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {plPct >= 0 ? '+' : ''}{plPct.toFixed(1)}%
                  </span>
                )}
              </div>
              {position.quantity > 1 && priceUSDVal != null && (
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>
                  {sym}{(priceLocalVal - purchaseLocal).toFixed(2)}/ea × {position.quantity}
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ borderRadius: 8, padding: '10px 14px', background: 'rgba(232,82,74,0.08)', border: '1px solid rgba(232,82,74,0.25)', fontSize: 13, color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={saving}
            style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: 'var(--gold)', color: '#080810', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Confirm Sale →'}
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

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const offset = (1 - score / 100) * 94.25
  const color = score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--gold)' : 'var(--red)'
  return (
    <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
      <svg width="38" height="38" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="19" cy="19" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="19" cy="19" r="15" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray="94.25" strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span style={{ position: 'relative', zIndex: 1, fontSize: 11, fontWeight: 700, color }}>{score}</span>
    </div>
  )
}

function verdictBadge(score: number) {
  if (score >= 75) return <span className="badge badge-buy">BUY</span>
  if (score >= 50) return <span className="badge badge-hold">HOLD</span>
  return <span className="badge badge-sell">SELL</span>
}

// ── Portfolio Chart helpers ───────────────────────────────────────────────────

function parseMonthKey(m: string): number {
  // "Apr 2025" → Date timestamp for sorting
  return new Date(m).getTime()
}

function buildPortfolioHistory(
  positions: Position[],
  windowDays: number   // 7 | 30 | 90
): { month: string; value: number; cost: number }[] {
  const posWithHistory = positions.filter(p => p.priceData?.price_history?.length)
  const totalCost = positions.reduce((s, p) => s + p.purchase_price * p.quantity, 0)

  // ── Full monthly history path ─────────────────────────────────────────────
  if (posWithHistory.length > 0) {
    const allMonthsSet = new Set<string>()
    for (const pos of posWithHistory) {
      for (const h of pos.priceData!.price_history!) allMonthsSet.add(h.month)
    }
    const sortedMonths = Array.from(allMonthsSet)
      .sort((a, b) => parseMonthKey(a) - parseMonthKey(b))
    // Convert days → months (7d → 1mo, 30d → 1mo, 90d → 3mo)
    const windowMonths = Math.max(1, Math.ceil(windowDays / 30))
    const sliced = sortedMonths.slice(-windowMonths)

    return sliced.map(month => {
      let value = 0
      for (const pos of posWithHistory) {
        const histMap = new Map(pos.priceData!.price_history!.map(h => [h.month, h.price]))
        const monthTs = parseMonthKey(month)
        let price = histMap.get(month)
        if (price == null) {
          const candidates = pos.priceData!.price_history!
            .filter(h => parseMonthKey(h.month) <= monthTs)
            .sort((a, b) => parseMonthKey(b.month) - parseMonthKey(a.month))
          price = candidates[0]?.price ?? pos.priceData!.price
        }
        value += price * pos.quantity
      }
      for (const pos of positions.filter(p => !p.priceData?.price_history?.length && p.priceData)) {
        value += pos.priceData!.price * pos.quantity
      }
      return { month, value, cost: totalCost }
    })
  }

  // ── Synthetic fallback: back-calculate from avg30d / avg7d / price ────────
  const posWithData = positions.filter(p => p.priceData)
  if (!posWithData.length) return []
  const hasAvg = posWithData.some(p => p.priceData!.avg30d != null || p.priceData!.avg7d != null)
  if (!hasAvg) return []

  const now = Date.now()
  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Returns portfolio value at a given daysAgo, using the best available avg
  function valueAt(daysAgo: number): number {
    let v = 0
    for (const pos of posWithData) {
      const pd = pos.priceData!
      let price: number
      if (daysAgo === 0)      price = pd.price
      else if (daysAgo <= 7)  price = pd.avg7d  ?? pd.price
      else                    price = pd.avg30d  ?? pd.avg7d ?? pd.price
      v += price * pos.quantity
    }
    return v
  }

  // Anchor points (oldest first) filtered to the selected window
  const allAnchors = [
    { daysAgo: 30 },
    { daysAgo: 7  },
    { daysAgo: 0  },
  ].filter(a => a.daysAgo <= windowDays)

  if (allAnchors.length < 2) return []

  // Interpolate daily points between each pair of anchors so every day is
  // a hover target, not just the two endpoints.
  const points: { month: string; value: number; cost: number }[] = []

  for (let i = 0; i < allAnchors.length - 1; i++) {
    const from = allAnchors[i]    // older (larger daysAgo)
    const to   = allAnchors[i + 1]
    const span = from.daysAgo - to.daysAgo  // number of days in this segment
    const fromVal = valueAt(from.daysAgo)
    const toVal   = valueAt(to.daysAgo)

    for (let d = 0; d < span; d++) {
      const t = d / span
      const daysAgo = from.daysAgo - d
      const label = fmtDate(now - daysAgo * 86_400_000)
      points.push({ month: label, value: fromVal + (toVal - fromVal) * t, cost: totalCost })
    }
  }

  // Final point — today
  points.push({ month: 'Today', value: valueAt(0), cost: totalCost })

  return points
}

interface PortfolioChartProps {
  positions: Position[]
  fmtCurrency: (n: number) => string
}

function PortfolioChart({ positions, fmtCurrency }: PortfolioChartProps) {
  // Auto-select shortest window with ≥ 2 data points
  const autoWindow = useMemo((): 7 | 30 | 90 => {
    for (const w of [7, 30, 90] as const) {
      if (buildPortfolioHistory(positions, w).length >= 2) return w
    }
    return 90
  }, [positions])

  const [userWindow, setUserWindow] = useState<7 | 30 | 90 | null>(null)
  const chartWindow = userWindow ?? autoWindow
  const data = buildPortfolioHistory(positions, chartWindow)

  const stillLoading = positions.some(p => p.priceLoading)
  const anyPriced    = positions.some(p => p.priceData)

  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink3)', fontSize: 13 }}>
        {stillLoading || !anyPriced
          ? 'Loading price history…'
          : 'Extended price history will appear once more monthly data has been collected.'}
      </div>
    )
  }

  // Exclude zero/near-zero cost (bad data guard) so the line isn't pushed to the floor
  const positiveCosts = data.map(d => d.cost).filter(c => c > 1)
  const costFloor     = positiveCosts.length ? Math.min(...positiveCosts) : Math.min(...data.map(d => d.value))
  const valueFloor    = Math.min(...data.map(d => d.value))
  const chartMin      = Math.min(costFloor, valueFloor) * 0.97
  const chartMax      = Math.max(...data.map(d => d.value)) * 1.03

  // Compact Y-axis label derived from fmtCurrency (so it respects the user's currency)
  const yFmt = (v: number) => {
    const full  = fmtCurrency(v)                       // e.g. "A$1,063.79" or "$683.44"
    const sym   = full.match(/^[^\d]*/)?.[0] ?? '$'    // leading non-digits = currency symbol
    const num   = parseFloat(full.replace(/[^\d.]/g, ''))
    if (!isFinite(num)) return full
    if (num >= 10_000) return `${sym}${(num / 1_000).toFixed(0)}k`
    if (num >= 1_000)  return `${sym}${(num / 1_000).toFixed(1)}k`
    return `${sym}${Math.round(num)}`
  }

  const latestValue = data[data.length - 1]?.value ?? 0
  const firstValue  = data[0]?.value ?? 0
  const totalChange = firstValue > 0 ? ((latestValue - firstValue) / firstValue) * 100 : 0
  const isUp = totalChange >= 0

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    const val  = payload.find(p => p.dataKey === 'value')?.value ?? 0
    const cost = payload.find(p => p.dataKey === 'cost')?.value ?? 0
    const pl   = val - cost
    return (
      <div style={{ background: '#181828', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', minWidth: 160 }}>
        <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{fmtCurrency(val)}</div>
        <div style={{ fontSize: 11, color: 'var(--ink3)' }}>Cost: {fmtCurrency(cost)}</div>
        <div style={{ fontSize: 11, color: pl >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
          P&L: {pl >= 0 ? '+' : ''}{fmtCurrency(pl)}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Chart header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="font-num" style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>{fmtCurrency(latestValue)}</span>
          <span className="font-num" style={{ fontSize: 13, fontWeight: 600, color: isUp ? 'var(--green)' : 'var(--red)' }}>
            {isUp ? '+' : ''}{totalChange.toFixed(1)}% over period
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {([7, 30, 90] as const).map(w => (
            <button key={w} onClick={() => setUserWindow(w)}
              style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                borderColor: chartWindow === w ? 'var(--gold)' : 'var(--border2)',
                background: chartWindow === w ? 'var(--gold2)' : 'transparent',
                color: chartWindow === w ? 'var(--gold)' : 'var(--ink3)' }}>
              {w}D
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink3)' }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--gold)', opacity: 0.7 }} /> Portfolio Value
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink3)' }}>
          <div style={{ width: 12, height: 2, background: 'rgba(255,255,255,0.25)' }} /> Cost Basis
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#e8c547" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#e8c547" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--ink3)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={[chartMin, chartMax]} tick={{ fontSize: 10, fill: 'var(--ink3)' }} tickLine={false} axisLine={false} tickFormatter={yFmt} width={56} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="value" stroke="#e8c547" strokeWidth={2} fill="url(#portfolioGrad)" dot={false} activeDot={{ r: 4, fill: '#e8c547' }} />
          <Line type="monotone" dataKey="cost"  stroke="rgba(255,255,255,0.45)" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const supabase = createClient()
  const { currency, rates, fmtCurrency } = useCurrency()

  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [userTier, setUserTier] = useState<string>('free')
  const [positions, setPositions] = useState<Position[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editPos, setEditPos] = useState<Position | null>(null)
  const [sellPos, setSellPos] = useState<Position | null>(null)
  const [showSold, setShowSold] = useState(true)
  const [sort, setSort] = useState<SortKey>('change24h')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [filter, setFilter] = useState<'all' | 'winning' | 'losing'>('all')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showChart, setShowChart] = useState(true)

  // Portfolio tabs
  const [pfTab, setPfTab] = useState<'overview' | 'positions' | 'history'>('overview')

  // Portfolio groups (Pro)
  interface PortfolioGroup { id: string; user_id: string; name: string; created_at: string }
  const [pfGroups, setPfGroups] = useState<PortfolioGroup[]>([])
  const [activePfGroupId, setActivePfGroupId] = useState<string | null>(null)
  const [showNewPfGroup, setShowNewPfGroup] = useState(false)
  const [newPfGroupName, setNewPfGroupName] = useState('')

  function flash(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user)
      if (data.user) {
        const { data: prof } = await supabase.from('profiles').select('tier').eq('id', data.user.id).single()
        const tier = prof?.tier ?? 'free'
        setUserTier(tier)
        // Load portfolio groups for Pro users
        if (tier === 'pro') {
          const { data: grps } = await supabase
            .from('portfolio_groups')
            .select('*')
            .eq('user_id', data.user.id)
            .order('created_at', { ascending: true })
          setPfGroups(grps ?? [])
        }
      }
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

    // ── 1. Show cached positions instantly (stale-while-revalidate) ──────────
    const POSITIONS_KEY = `portfolio:positions:${user.id}`
    const cachedPositions = cacheGet<DbPosition[]>(POSITIONS_KEY)
    if (cachedPositions) {
      const enriched: Position[] = cachedPositions.map((p: DbPosition) => {
        const hit = cacheGet<PriceData>(`${p.card_id}:${p.grade}`)
        return { ...p, priceData: hit ?? null, priceLoading: !hit, priceError: null }
      })
      setPositions(enriched)
      // Fetch prices for any uncached entries in the background
      const uncached = enriched.filter(p => !p.priceData)
      uncached.forEach((pos, i) => setTimeout(() => fetchPrice(pos), i * 600))
    } else {
      // No cache — show spinner on true first load
      setListLoading(true)
    }

    // ── 2. Silently fetch fresh positions from the server ─────────────────────
    try {
      const r = await fetch('/api/portfolio')
      const json = await r.json()
      const freshPositions: DbPosition[] = json.positions ?? []
      cacheSet(POSITIONS_KEY, freshPositions)

      const enriched: Position[] = freshPositions.map((p: DbPosition) => {
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

  // Bust the positions list cache after any mutation so next page load is fresh
  function invalidatePositionsCache() {
    if (user) cacheSet(`portfolio:positions:${user.id}`, null)
  }

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
    invalidatePositionsCache()
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
    invalidatePositionsCache()
    flash('ok', 'Position updated.')
  }

  // ── Remove position ───────────────────────────────────────────────────────
  async function handleRemove(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setPositions(prev => prev.filter(p => p.id !== id))
    await fetch(`/api/portfolio?id=${id}`, { method: 'DELETE' })
    invalidatePositionsCache()
    flash('ok', 'Position removed.')
  }

  // ── Sell position ─────────────────────────────────────────────────────────
  async function handleSell(pos: Position, salePrice: number, soldAt: string | null) {
    const r = await fetch(`/api/portfolio?id=${pos.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sold: true, sale_price: salePrice, sold_at: soldAt }),
    })
    const json = await r.json()
    if (!r.ok) throw new Error(json.error ?? 'Failed to mark as sold')
    setPositions(prev => prev.map(p => p.id === pos.id
      ? { ...p, sold: true, sale_price: salePrice, sold_at: soldAt } : p))
    invalidatePositionsCache()
    flash('ok', 'Position marked as sold.')
  }

  // ── Reopen sold position ──────────────────────────────────────────────────
  async function handleReopen(pos: Position) {
    const r = await fetch(`/api/portfolio?id=${pos.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sold: false, sale_price: null, sold_at: null }),
    })
    const json = await r.json()
    if (!r.ok) { flash('err', json.error ?? 'Failed to reopen position.'); return }
    setPositions(prev => prev.map(p => p.id === pos.id
      ? { ...p, sold: false, sale_price: null, sold_at: null } : p))
    invalidatePositionsCache()
    flash('ok', 'Position reopened.')
  }

  // ── Sort toggle ───────────────────────────────────────────────────────────
  function handleSort(key: SortKey) {
    if (sort === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSort(key); setSortDir('desc') }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const openPositions    = positions.filter(p => !p.sold)
  const soldPositions    = positions.filter(p => p.sold)
  const withData         = openPositions.filter(p => p.priceData)

  const totalCostUSD     = openPositions.reduce((s, p) => s + p.purchase_price * p.quantity, 0)
  // Only include positions that have loaded market prices — no fallback to purchase price
  const pricedCostUSD    = withData.reduce((s, p) => s + p.purchase_price * p.quantity, 0)
  const totalValueUSD    = withData.reduce((s, p) => s + p.priceData!.price * p.quantity, 0)
  const allPriced        = withData.length === openPositions.length && openPositions.length > 0
  const totalPLUSD       = totalValueUSD - pricedCostUSD
  const totalPLPct       = pricedCostUSD > 0 ? (totalPLUSD / pricedCostUSD) * 100 : 0
  const dayGainUSD       = withData.reduce((s, p) => {
    const pd = p.priceData!
    const prev = pd.price / (1 + pd.price_change_pct / 100)
    return s + (pd.price - prev) * p.quantity
  }, 0)
  const realizedPLUSD    = soldPositions.reduce((s, p) =>
    p.sale_price != null ? s + (p.sale_price - p.purchase_price) * p.quantity : s, 0)

  const filtered = openPositions
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
      if (sort === 'change24h') return dir * ((ap?.price_change_pct ?? -Infinity) - (bp?.price_change_pct ?? -Infinity))
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
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleSort(k)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSort(k)}
        className="pf-hide-mobile"
        style={{ cursor: 'pointer', fontSize: 10, letterSpacing: '0.22em', color: active ? 'var(--gold)' : 'var(--ink3)', fontWeight: active ? 700 : 500, display: 'flex', alignItems: 'center', justifyContent: right ? 'flex-end' : 'flex-start', gap: 4 }}
      >
        {label}
        {active && <span style={{ fontSize: 9 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>}
      </div>
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

  // ── Pro gate ──────────────────────────────────────────────────────────────
  if (authChecked && user && userTier !== 'pro') {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 88, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 440, textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
            <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 99, background: 'var(--gold2)', border: '1px solid rgba(232,197,71,0.3)', fontSize: 11, fontWeight: 700, color: 'var(--gold)', letterSpacing: 1, marginBottom: 16 }}>PRO FEATURE</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.5px' }}>Portfolio tracking is a Pro feature</h2>
            <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.7, marginBottom: 28 }}>
              Track every purchase, monitor P&L in real time, and see full market performance across your collection. Upgrade to Pro to unlock portfolio tracking.
            </p>
            <Link href="/pricing" style={{ display: 'inline-block', padding: '13px 28px', borderRadius: 12, background: 'var(--gold)', color: '#080810', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
              Upgrade to Pro →
            </Link>
            <div style={{ marginTop: 16 }}>
              <Link href="/dashboard" style={{ fontSize: 12, color: 'var(--ink3)', textDecoration: 'none' }}>← Back to dashboard</Link>
            </div>
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
          grid-template-columns: minmax(180px,1fr) 70px 110px 110px 110px 90px 40px;
          align-items: center;
          padding: 0 20px;
          gap: 8px;
        }
        .pf-header { padding: 10px 20px; }
        .pf-row    { padding: 14px 20px; min-height: 64px; }
        .pf-hide-mobile { display: block; }
        .pf-show-mobile { display: none; }
        .pf-act-btn {
          height: 28px; padding: 0 10px; border-radius: 7px;
          border: 1px solid var(--border); background: transparent;
          color: var(--ink3); font-size: 11px; font-weight: 600;
          cursor: pointer; white-space: nowrap; transition: all 0.15s;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .pf-act-btn:hover { border-color: var(--gold); color: var(--gold); }
        .pf-act-btn.del:hover { border-color: var(--red); color: var(--red); }
        .badge {
          display: inline-flex; align-items: center;
          padding: 4px 10px; border-radius: 6px;
          font-size: 11.5px; font-weight: 700; letter-spacing: 0.02em;
        }
        .badge-buy  { background: rgba(74,222,128,.12); color: #4ade80; border: 1px solid rgba(74,222,128,.3); }
        .badge-hold { background: rgba(232,185,35,.12);  color: #e8b923; border: 1px solid rgba(232,185,35,.3); }
        .badge-sell { background: rgba(248,113,113,.12); color: #f87171; border: 1px solid rgba(248,113,113,.3); }
        @media (max-width: 760px) {
          .pf-row, .pf-header {
            grid-template-columns: 1fr 100px 40px;
            gap: 4px;
          }
          .pf-hide-mobile { display: none !important; }
          .pf-show-mobile { display: block !important; }
          .pf-show-mobile-flex { display: flex !important; }
          .pf-row { padding: 12px 14px; min-height: 56px; }
          .pf-header { padding: 8px 14px; }
          .pf-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (min-width: 641px) {
          body.has-sidebar main { padding-top: 0 !important; }
        }
      `}</style>

      <main style={{ paddingTop: 72, paddingBottom: 96, minHeight: '100vh' }}>

        {/* Page header — desktop only, hidden on mobile */}
        <div className="pf-page-header" style={{ display: 'none' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 16px 0' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', margin: 0, marginBottom: 6 }}>Portfolio</h1>
              <p style={{ fontSize: 14, color: 'var(--ink3)', margin: 0 }}>Your collection performance at a glance</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={() => {
                  const rows = [
                    ['Card Name', 'Grade', 'Set', 'Qty', 'Cost/ea (USD)', 'Market Price (USD)', 'P&L (USD)', 'P&L %', 'Added'],
                    ...positions.map(p => {
                      const mkt = p.priceData?.price ?? null
                      const pl = mkt != null ? (mkt - p.purchase_price) * p.quantity : ''
                      const plPct = mkt != null && p.purchase_price > 0 ? ((mkt - p.purchase_price) / p.purchase_price * 100).toFixed(2) : ''
                      return [
                        `"${p.card_name}"`,
                        p.grade,
                        `"${p.set_name ?? ''}"`,
                        String(p.quantity),
                        p.purchase_price.toFixed(2),
                        mkt != null ? mkt.toFixed(2) : '',
                        pl !== '' ? (pl as number).toFixed(2) : '',
                        plPct,
                        p.purchased_at ? p.purchased_at.slice(0, 10) : '',
                      ]
                    })
                  ]
                  const csv = rows.map(r => r.join(',')).join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `Portfolio-${new Date().toISOString().slice(0, 10)}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink3)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.color = 'var(--green)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--ink3)' }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3"/><polyline points="4 6 8 10 12 6"/><line x1="8" y1="1" x2="8" y2="10"/>
                </svg>
                Export CSV
              </button>
              <button
                onClick={() => setShowAdd(true)}
                style={{ padding: '9px 20px', borderRadius: 10, background: 'var(--gold)', color: '#080810', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                + Add Position
              </button>
            </div>
          </div>

          {/* ── Flash message ── */}
          {msg && (
            <div style={{ marginBottom: 16, borderRadius: 10, padding: '11px 16px', background: msg.type === 'ok' ? 'rgba(61,232,138,0.08)' : 'rgba(232,82,74,0.08)', border: `1px solid ${msg.type === 'ok' ? 'rgba(61,232,138,0.2)' : 'rgba(232,82,74,0.25)'}`, fontSize: 13, color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)' }}>
              {msg.text}
            </div>
          )}

          {/* ── Portfolio Groups (Pro) ── */}
          {userTier === 'pro' && pfGroups.length > 0 && (
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setActivePfGroupId(null)} style={{ padding: '5px 14px', borderRadius: 99, border: `1px solid ${activePfGroupId === null ? 'var(--gold)' : 'var(--border2)'}`, background: activePfGroupId === null ? 'var(--gold2)' : 'transparent', color: activePfGroupId === null ? 'var(--gold)' : 'var(--ink3)', fontSize: 12, fontWeight: activePfGroupId === null ? 700 : 400, cursor: 'pointer' }}>All</button>
              {pfGroups.map(g => (
                <button key={g.id} onClick={() => setActivePfGroupId(g.id)} style={{ padding: '5px 14px', borderRadius: 99, border: `1px solid ${activePfGroupId === g.id ? 'var(--gold)' : 'var(--border2)'}`, background: activePfGroupId === g.id ? 'var(--gold2)' : 'transparent', color: activePfGroupId === g.id ? 'var(--gold)' : 'var(--ink3)', fontSize: 12, fontWeight: activePfGroupId === g.id ? 700 : 400, cursor: 'pointer' }}>{g.name}</button>
              ))}
              <button onClick={() => setShowNewPfGroup(true)} style={{ padding: '5px 12px', borderRadius: 99, border: '1px dashed var(--border2)', background: 'transparent', color: 'var(--ink3)', fontSize: 12, cursor: 'pointer' }}>+ New Portfolio</button>
            </div>
          )}

          {showNewPfGroup && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
              onClick={e => { if (e.target === e.currentTarget) { setShowNewPfGroup(false); setNewPfGroupName('') } }}>
              <div style={{ width: '100%', maxWidth: 360, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border2)', padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>New Portfolio</div>
                <input value={newPfGroupName} onChange={e => setNewPfGroupName(e.target.value)} placeholder="Name…" autoFocus style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setShowNewPfGroup(false); setNewPfGroupName('') }} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border2)', fontSize: 13, color: 'var(--ink3)', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={async () => {
                    if (!newPfGroupName.trim() || !user) return
                    const { data: g } = await supabase.from('portfolio_groups').insert({ user_id: user.id, name: newPfGroupName.trim() }).select().single()
                    if (g) setPfGroups(prev => [...prev, g])
                    setShowNewPfGroup(false); setNewPfGroupName('')
                  }} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'var(--gold)', color: '#080810', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24, gap: 0 }}>
            {(['overview', 'positions', 'history'] as const).map(t => (
              <button key={t} onClick={() => setPfTab(t)} style={{ padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: pfTab === t ? 700 : 400, color: pfTab === t ? 'var(--gold)' : 'var(--ink3)', borderBottom: `2px solid ${pfTab === t ? 'var(--gold)' : 'transparent'}`, marginBottom: -1, transition: 'all 0.15s', textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>

          {/* ── History Tab ── */}
          {pfTab === 'history' && (() => {
            const allPos = [...positions].sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime())
            return (
              <div style={{ borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 70px 100px 50px 110px 100px', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
                  {['CARD', 'TYPE', 'PRICE/EA', 'QTY', 'DATE', 'REALIZED P&L'].map(h => (
                    <div key={h} style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)' }}>{h}</div>
                  ))}
                </div>
                {allPos.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: 'var(--ink3)' }}>No transactions yet.</div>
                ) : allPos.map((pos, i) => {
                  const isSell = pos.sold
                  const plUSD  = isSell && pos.sale_price != null ? (pos.sale_price - pos.purchase_price) * pos.quantity : null
                  const plPct  = plUSD != null && pos.purchase_price > 0 ? ((pos.sale_price! - pos.purchase_price) / pos.purchase_price) * 100 : null
                  const cardParams = new URLSearchParams({ name: pos.card_name, grade: pos.grade })
                  if (pos.set_name) cardParams.set('set', pos.set_name)
                  return (
                    <div key={pos.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 70px 100px 50px 110px 100px', padding: '12px 16px', borderBottom: i < allPos.length - 1 ? '1px solid var(--border)' : 'none', gap: 8, alignItems: 'center' }}>
                      <Link href={`/card/${pos.card_id}?${cardParams}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, textDecoration: 'none' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 7, background: 'var(--surface2)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                          {pos.image_url && <img src={tcgImg(pos.image_url)} alt={pos.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pos.card_name}</div>
                          <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 1 }}>{pos.grade}</div>
                        </div>
                      </Link>
                      <div>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, background: isSell ? 'rgba(232,82,74,0.1)' : 'rgba(61,232,138,0.1)', color: isSell ? 'var(--red)' : 'var(--green)', border: `1px solid ${isSell ? 'rgba(232,82,74,0.3)' : 'rgba(61,232,138,0.3)'}` }}>
                          {isSell ? 'SELL' : 'BUY'}
                        </span>
                      </div>
                      <div className="font-num" style={{ fontSize: 12, color: 'var(--ink)' }}>
                        {fmtCurrency(isSell ? (pos.sale_price ?? pos.purchase_price) : pos.purchase_price)}
                      </div>
                      <div className="font-num" style={{ fontSize: 12, color: 'var(--ink2)' }}>{pos.quantity}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
                        {isSell
                          ? pos.sold_at ? new Date(pos.sold_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'
                          : pos.purchased_at ? new Date(pos.purchased_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : new Date(pos.added_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </div>
                      <div>
                        {plUSD != null ? (
                          <div className="font-num" style={{ fontSize: 12, fontWeight: 700, color: plUSD >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {plUSD >= 0 ? '+' : '−'}{fmtCurrency(Math.abs(plUSD))}
                            {plPct != null && <span style={{ fontSize: 10, opacity: 0.8 }}> ({plPct.toFixed(1)}%)</span>}
                          </div>
                        ) : <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* ── Stats bar (Overview + Positions tabs) ── */}
          {pfTab !== 'history' && (
          <>

          {/* ── Stat grid ── */}
          {(() => {
            const bestPos = withData.length > 0 ? [...withData].sort((a, b) => {
              const ap = ((a.priceData!.price - a.purchase_price) / a.purchase_price) * 100
              const bp = ((b.priceData!.price - b.purchase_price) / b.purchase_price) * 100
              return bp - ap
            })[0] : null
            const bestGainPct = bestPos ? ((bestPos.priceData!.price - bestPos.purchase_price) / bestPos.purchase_price) * 100 : null
            const bestGainAbs = bestPos ? (bestPos.priceData!.price - bestPos.purchase_price) * bestPos.quantity : null
            const avgCost = openPositions.length > 0 ? totalCostUSD / openPositions.length : 0
            const statCells = [
              {
                label: 'Total Value',
                value: withData.length > 0 ? fmtCurrency(totalValueUSD) : '—',
                sub: withData.length > 0
                  ? `${openPositions.length} card${openPositions.length !== 1 ? 's' : ''}${!allPriced ? ` · ${withData.length}/${openPositions.length} priced` : ''}`
                  : openPositions.length === 0 ? 'no positions yet' : 'loading…',
                subColor: 'var(--ink3)',
                color: withData.length > 0 ? 'var(--ink)' : 'var(--ink3)',
              },
              {
                label: 'Total Cost',
                value: openPositions.length > 0 ? fmtCurrency(totalCostUSD) : '—',
                sub: openPositions.length > 0 ? `avg ${fmtCurrency(avgCost)}` : 'no positions yet',
                subColor: 'var(--ink3)',
                color: 'var(--ink)',
              },
              {
                label: 'Unrealised P&L',
                value: withData.length > 0 ? fmtSigned(fmtCurrency, totalPLUSD) : '—',
                sub: withData.length > 0 ? `${pctSign(totalPLPct)}${totalPLPct.toFixed(1)}%${allPriced ? '' : ` · ${withData.length}/${openPositions.length}`}` : 'loading…',
                subColor: withData.length > 0 ? (totalPLUSD >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--ink3)',
                color: withData.length > 0 ? (totalPLUSD >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--ink3)',
              },
              {
                label: 'Best Performer',
                value: bestPos ? bestPos.card_name : '—',
                valueSm: true,
                sub: bestGainAbs != null && bestGainPct != null
                  ? `+${fmtCurrency(bestGainAbs)} (+${bestGainPct.toFixed(0)}%)`
                  : withData.length === 0 ? 'loading…' : 'no data',
                subColor: bestPos ? 'var(--green)' : 'var(--ink3)',
                color: 'var(--ink)',
              },
            ]
            return (
              <div className="pf-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {statCells.map((s, i) => (
                  <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 14, padding: '18px 20px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 10 }}>{s.label}</div>
                    <div className="font-num" style={{ fontSize: s.valueSm ? 18 : 24, fontWeight: 800, letterSpacing: '-0.5px', color: s.color, lineHeight: 1, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</div>
                    <div style={{ fontSize: 12.5, color: s.subColor ?? 'var(--ink3)', marginTop: 0 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* ── Invested vs Current (overview tab) ── */}
          {pfTab === 'overview' && withData.length > 0 && (() => {
            const invested = totalCostUSD
            const current  = totalValueUSD
            const pl       = totalPLUSD
            const plPct    = totalPLPct
            const maxVal   = Math.max(invested, current)
            const barPct   = maxVal > 0 ? (Math.min(invested, current) / maxVal) * 100 : 0
            const isUp     = pl >= 0
            return (
              <div style={{ borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)' }}>Invested vs Current Value</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, color: isUp ? 'var(--green)' : 'var(--red)', background: isUp ? 'rgba(61,232,138,0.1)' : 'rgba(232,82,74,0.1)', border: `1px solid ${isUp ? 'rgba(61,232,138,0.3)' : 'rgba(232,82,74,0.3)'}` }}>
                    {isUp ? '+' : ''}{plPct.toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden', marginBottom: 14 }}>
                  <div style={{ height: '100%', width: `${barPct}%`, borderRadius: 3, background: isUp ? 'var(--green)' : 'var(--red)', transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 4 }}>Invested</div>
                    <div className="font-num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(invested)}</div>
                  </div>
                  <div style={{ textAlign: 'center' as const }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 4 }}>P&amp;L</div>
                    <div className="font-num" style={{ fontSize: 15, fontWeight: 700, color: isUp ? 'var(--green)' : 'var(--red)' }}>{fmtSigned(fmtCurrency, pl)}</div>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 4 }}>Current</div>
                    <div className="font-num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(current)}</div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── Portfolio Health + Top Performers (Overview tab) ── */}
          {pfTab === 'overview' && withData.length > 0 && (() => {
            const sorted = [...withData].sort((a, b) => {
              const ap = a.priceData!, bp = b.priceData!
              return ((bp.price - b.purchase_price) / b.purchase_price) - ((ap.price - a.purchase_price) / a.purchase_price)
            })
            const best  = sorted[0]
            const worst = sorted[sorted.length - 1]
            const winners = withData.filter(p => p.priceData && p.priceData.price >= p.purchase_price).length
            const losers  = withData.length - winners
            const winRate = withData.length > 0 ? (winners / withData.length) * 100 : 0
            const uniqueSets  = new Set(openPositions.map(p => p.set_name).filter(Boolean)).size
            const gradedCount = openPositions.filter(p => /^(PSA|BGS|CGC|ACE)\s/.test(p.grade)).length
            const avgPlPct = withData.length > 0
              ? withData.reduce((sum, p) => sum + ((p.priceData!.price - p.purchase_price) / p.purchase_price) * 100, 0) / withData.length
              : 0
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 16, marginBottom: 16 }}>
                {/* Portfolio Health card */}
                <div style={{ borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Portfolio Health</span>
                    <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{openPositions.length} positions</span>
                  </div>
                  {/* Cards / Sets / Graded */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--border)' }}>
                    {[
                      { num: openPositions.length, label: 'Cards' },
                      { num: uniqueSets, label: 'Sets' },
                      { num: gradedCount, label: 'Graded', gold: true },
                    ].map((h, i) => (
                      <div key={i} style={{ padding: '14px 12px', borderRight: i < 2 ? '1px solid var(--border)' : 'none', textAlign: 'center' as const }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: h.gold ? 'var(--gold)' : 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>{h.num}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink3)', textTransform: 'uppercase' }}>{h.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* P&L box */}
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 4 }}>Total P&amp;L</div>
                      <div className="font-num" style={{ fontSize: 16, fontWeight: 700, color: totalPLUSD >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtSigned(fmtCurrency, totalPLUSD)}</div>
                    </div>
                    <div style={{ textAlign: 'right' as const }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 4 }}>Return</div>
                      <div className="font-num" style={{ fontSize: 16, fontWeight: 700, color: totalPLUSD >= 0 ? 'var(--green)' : 'var(--red)' }}>{pctSign(totalPLPct)}{totalPLPct.toFixed(1)}%</div>
                    </div>
                  </div>
                  {/* Win rate */}
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 3 }}>Win Rate</div>
                        <div className="font-num" style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{winRate.toFixed(0)}%</div>
                        <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{winners}W · {losers}L</div>
                      </div>
                      <div style={{ textAlign: 'right' as const }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 3 }}>Avg P&amp;L</div>
                        <div className="font-num" style={{ fontSize: 16, fontWeight: 800, color: avgPlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>{pctSign(avgPlPct)}{avgPlPct.toFixed(1)}%</div>
                        <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>per position</div>
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${winRate}%`, borderRadius: 2, background: 'var(--green)' }} />
                    </div>
                  </div>
                  {/* Best / Worst */}
                  {best?.priceData && (() => {
                    const bestPct  = ((best.priceData.price - best.purchase_price) / best.purchase_price) * 100
                    const worstPct = worst?.priceData ? ((worst.priceData.price - worst.purchase_price) / worst.purchase_price) * 100 : null
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ width: 4, height: 28, borderRadius: 2, background: 'var(--green)', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink3)', textTransform: 'uppercase' }}>Best</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{best.card_name}</div>
                          </div>
                          <div className="font-num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>+{bestPct.toFixed(1)}%</div>
                        </div>
                        {worst?.priceData && worstPct != null && worst.id !== best.id && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
                            <div style={{ width: 4, height: 28, borderRadius: 2, background: 'var(--red)', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink3)', textTransform: 'uppercase' }}>Worst</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{worst.card_name}</div>
                            </div>
                            <div className="font-num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>{worstPct.toFixed(1)}%</div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>

                {/* Top Performers card */}
                <div style={{ borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Top Performers</span>
                    <button onClick={() => setPfTab('positions')} style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View all →</button>
                  </div>
                  {sorted.slice(0, 6).map((pos, i) => {
                    if (!pos.priceData) return null
                    const pct = ((pos.priceData.price - pos.purchase_price) / pos.purchase_price) * 100
                    const isUp = pct >= 0
                    const params = new URLSearchParams({ name: pos.card_name, grade: pos.grade })
                    if (pos.set_name) params.set('set', pos.set_name)
                    return (
                      <Link key={pos.id} href={`/card/${pos.card_id}?${params}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < Math.min(sorted.length, 6) - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', background: 'transparent', transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-subtle)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ width: 32, height: 44, borderRadius: 4, background: `linear-gradient(135deg, var(--surface2) 0%, rgba(${isUp ? '61,232,138' : '232,82,74'},0.1) 100%)`, border: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {pos.image_url && <img src={tcgImg(pos.image_url)} alt={pos.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.card_name}</div>
                          <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{pos.grade}{pos.set_name ? ` · ${pos.set_name}` : ''}</div>
                        </div>
                        <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                          <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(pos.priceData.price)}</div>
                          <div className="font-num" style={{ fontSize: 11, fontWeight: 700, color: isUp ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>{isUp ? '+' : ''}{pct.toFixed(1)}%</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ── Performance Chart ── */}
          {openPositions.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={() => setShowChart(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1px solid var(--border2)', background: showChart ? 'var(--surface2)' : 'transparent', color: showChart ? 'var(--gold)' : 'var(--ink3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', marginBottom: showChart ? 12 : 0 }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="1 12 5 7 9 10 15 3"/></svg>
                Performance Chart
                <span style={{ marginLeft: 2, fontSize: 10 }}>{showChart ? '▲' : '▼'}</span>
              </button>

              {showChart && (
                <div style={{ borderRadius: 14, padding: '20px 20px 8px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
                  <PortfolioChart positions={openPositions} fmtCurrency={fmtCurrency} />
                </div>
              )}
            </div>
          )}

          {/* ── Controls (Positions tab) ── */}
          {pfTab === 'positions' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 2, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border2)' }}>
              {(['all', 'winning', 'losing'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: filter === f ? 'var(--surface2)' : 'transparent', color: filter === f ? 'var(--ink)' : 'var(--ink3)', transition: 'all 0.15s' }}>
                  {f === 'all' ? 'All' : f === 'winning' ? '▲ Winning' : '▼ Losing'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
              {openPositions.filter(p => p.priceData).length}/{openPositions.length} prices loaded
            </div>
          </div>
          )}

          {/* ── Table (Positions tab) ── */}
          {pfTab === 'positions' && (<>
          <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>

            {/* Header */}
            <div className="pf-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <div role="button" tabIndex={0} onClick={() => handleSort('name')} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSort('name')} style={{ cursor: 'pointer', fontSize: 10, letterSpacing: '0.22em', color: sort === 'name' ? 'var(--gold)' : 'var(--ink3)', fontWeight: sort === 'name' ? 700 : 500, display: 'flex', gap: 4, alignItems: 'center' }}>
                CARD {sort === 'name' && <span style={{ fontSize: 9 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>}
              </div>
              {/* Mobile-only P&L label */}
              <div className="pf-show-mobile" style={{ textAlign: 'right', fontSize: 10, letterSpacing: '0.22em', color: 'var(--ink3)' }}>P&amp;L</div>
              <div className="pf-show-mobile" />
              {/* Desktop columns */}
              <div className="pf-hide-mobile" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--ink3)', textAlign: 'center' }}>SCORE</div>
              <SortTh label="PAID" k="cost" />
              <SortTh label="VALUE" k="current" />
              <SortTh label="P&amp;L" k="plpct" />
              <div className="pf-hide-mobile" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--ink3)' }}>VERDICT</div>
              <div />
            </div>

            {/* Loading skeletons */}
            {listLoading && [0, 1, 2].map(i => <SkeletonRow key={i} last={i === 2} />)}

            {/* Empty state */}
            {!listLoading && openPositions.length === 0 && (
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
            {!listLoading && openPositions.length > 0 && filtered.length === 0 && (
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
                  {/* Col 1: Card */}
                  <Link href={`/card/${pos.card_id}?${cardParams}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, textDecoration: 'none' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                      {pos.image_url && <img src={tcgImg(pos.image_url)} alt={pos.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pos.card_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>
                        {pos.set_name ? `${pos.set_name} · ` : ''}{pos.grade}
                      </div>
                    </div>
                  </Link>

                  {/* Col 2: Score ring — desktop only; mobile shows P&L */}
                  <div className="pf-hide-mobile" style={{ display: 'flex', justifyContent: 'center' }}>
                    {pos.priceLoading ? (
                      <div style={{ width: 38, height: 38, borderRadius: '50%' }} className="sk-pulse" />
                    ) : pd?.score != null ? (
                      <ScoreRing score={pd.score} />
                    ) : pos.priceError ? (
                      <button onClick={() => fetchPrice(pos, true)} style={{ fontSize: 9, color: 'var(--ink3)', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}>↺</button>
                    ) : <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>}
                  </div>

                  {/* Mobile P&L (replaces score on mobile) */}
                  <div className="pf-show-mobile" style={{ textAlign: 'right' }}>
                    {pos.priceLoading ? (
                      <div style={{ width: 56, height: 13, borderRadius: 4, background: 'var(--surface2)', marginLeft: 'auto' }} className="sk-pulse" />
                    ) : plTotalUSD != null ? (
                      <>
                        <div className="font-num" style={{ fontSize: 12, fontWeight: 700, color: isUp ? 'var(--green)' : 'var(--red)' }}>{fmtSigned(fmtCurrency, plTotalUSD)}</div>
                        <div className="font-num" style={{ fontSize: 10, color: isUp ? 'var(--green)' : 'var(--red)', opacity: 0.8, marginTop: 2 }}>{fmtPct(plPct)}</div>
                      </>
                    ) : <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>}
                  </div>

                  {/* Col 3: Paid — desktop only */}
                  <div className="pf-hide-mobile" style={{ textAlign: 'right' }}>
                    <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(costUSD)}</div>
                    {pos.quantity > 1 && <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>× {pos.quantity}</div>}
                  </div>

                  {/* Col 4: Value — desktop only */}
                  <div className="pf-hide-mobile" style={{ textAlign: 'right' }}>
                    {pos.priceLoading ? (
                      <div style={{ width: 56, height: 13, borderRadius: 4, background: 'var(--surface2)', marginLeft: 'auto' }} className="sk-pulse" />
                    ) : pd ? (
                      <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(pd.price)}</div>
                    ) : <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>}
                  </div>

                  {/* Col 5: P&L — desktop only */}
                  <div className="pf-hide-mobile" style={{ textAlign: 'right' }}>
                    {pos.priceLoading ? (
                      <div style={{ width: 60, height: 13, borderRadius: 4, background: 'var(--surface2)', marginLeft: 'auto' }} className="sk-pulse" />
                    ) : plTotalUSD != null ? (
                      <>
                        <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: isUp ? 'var(--green)' : 'var(--red)' }}>{fmtSigned(fmtCurrency, plTotalUSD)}</div>
                        <div className="font-num" style={{ fontSize: 10, color: isUp ? 'var(--green)' : 'var(--red)', opacity: 0.8, marginTop: 2 }}>{fmtPct(plPct)}</div>
                      </>
                    ) : <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>}
                  </div>

                  {/* Col 6: Verdict badge — desktop only */}
                  <div className="pf-hide-mobile">
                    {pos.priceLoading ? (
                      <div style={{ width: 44, height: 22, borderRadius: 6 }} className="sk-pulse" />
                    ) : pd?.score != null ? (
                      verdictBadge(pd.score)
                    ) : <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>}
                  </div>

                  {/* Col 7: Dots menu */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <button
                      onClick={() => setEditPos(pos)}
                      title="Edit position"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', padding: '4px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink3)')}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="16" height="16">
                        <circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Sold Positions ── */}
          {soldPositions.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <button
                onClick={() => setShowSold(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1px solid var(--border2)', background: showSold ? 'var(--surface2)' : 'transparent', color: showSold ? 'var(--ink)' : 'var(--ink3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', marginBottom: showSold ? 12 : 0 }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2 5 8 11 14 5"/></svg>
                Sold Positions
                <span style={{ marginLeft: 4, padding: '1px 7px', borderRadius: 99, background: 'rgba(255,255,255,0.08)', fontSize: 10 }}>{soldPositions.length}</span>
                <span style={{ marginLeft: 2, fontSize: 10, color: realizedPLUSD >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {realizedPLUSD >= 0 ? '+' : '−'}{fmtCurrency(Math.abs(realizedPLUSD))} realized
                </span>
                <span style={{ marginLeft: 2, fontSize: 10 }}>{showSold ? '▲' : '▼'}</span>
              </button>

              {showSold && (
                <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {/* Sold table header */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 50px 100px 100px 110px 90px 80px', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid var(--border)', gap: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)' }}>CARD</div>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', textAlign: 'right' }}>QTY</div>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', textAlign: 'right' }}>AVG COST</div>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', textAlign: 'right' }}>SOLD AT</div>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', textAlign: 'right' }}>REALIZED P&amp;L</div>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', textAlign: 'right' }}>DATE SOLD</div>
                    <div />
                  </div>

                  {soldPositions.map((pos, i) => {
                    const saleLocal = pos.sale_price  // USD — fmtCurrency handles conversion
                    const costLocal = pos.purchase_price  // USD — fmtCurrency handles conversion
                    const plUSD     = pos.sale_price != null ? (pos.sale_price - pos.purchase_price) * pos.quantity : null
                    const plPct     = pos.sale_price != null && pos.purchase_price > 0
                      ? ((pos.sale_price - pos.purchase_price) / pos.purchase_price) * 100 : null
                    const isUp      = (plPct ?? 0) >= 0
                    const cardParams = new URLSearchParams({ name: pos.card_name, grade: pos.grade })
                    if (pos.set_name) cardParams.set('set', pos.set_name)

                    return (
                      <div key={pos.id}
                        style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 50px 100px 100px 110px 90px 80px', alignItems: 'center', padding: '12px 20px', borderBottom: i < soldPositions.length - 1 ? '1px solid var(--border)' : 'none', gap: 8, opacity: 0.85 }}>

                        {/* Card info */}
                        <Link href={`/card/${pos.card_id}?${cardParams}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, textDecoration: 'none' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 7, background: 'var(--surface2)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                            {pos.image_url && <img src={tcgImg(pos.image_url)} alt={pos.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pos.card_name}</div>
                            <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 1 }}>{pos.set_name ? `${pos.set_name} · ` : ''}{pos.grade}</div>
                          </div>
                        </Link>

                        {/* Qty */}
                        <div style={{ textAlign: 'right' }}>
                          <span className="font-num" style={{ fontSize: 12, color: 'var(--ink2)' }}>{pos.quantity}</span>
                        </div>

                        {/* Avg cost */}
                        <div style={{ textAlign: 'right' }}>
                          <span className="font-num" style={{ fontSize: 12, color: 'var(--ink3)' }}>{fmtCurrency(costLocal)}</span>
                        </div>

                        {/* Sold at */}
                        <div style={{ textAlign: 'right' }}>
                          {saleLocal != null
                            ? <span className="font-num" style={{ fontSize: 12, color: 'var(--ink)' }}>{fmtCurrency(saleLocal)}</span>
                            : <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>}
                        </div>

                        {/* Realized P&L */}
                        <div style={{ textAlign: 'right' }}>
                          {plUSD != null ? (
                            <>
                              <div className="font-num" style={{ fontSize: 12, fontWeight: 700, color: isUp ? 'var(--green)' : 'var(--red)' }}>
                                {fmtSigned(fmtCurrency, plUSD)}
                              </div>
                              <div className="font-num" style={{ fontSize: 10, color: isUp ? 'var(--green)' : 'var(--red)', opacity: 0.8, marginTop: 1 }}>
                                {fmtPct(plPct)}
                              </div>
                            </>
                          ) : <span style={{ fontSize: 12, color: 'var(--ink3)' }}>—</span>}
                        </div>

                        {/* Date sold */}
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 11, color: 'var(--ink3)' }}>
                            {pos.sold_at
                              ? new Date(pos.sold_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                              : '—'}
                          </span>
                        </div>

                        {/* Reopen */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            className="pf-act-btn"
                            onClick={() => handleReopen(pos)}
                            title="Reopen position"
                            style={{ fontSize: 10 }}
                          >Reopen</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          </>
          )}

          <p style={{ fontSize: 11, color: 'var(--ink3)', textAlign: 'center', marginTop: 24 }}>
            Prices sourced via Poketrace · P&L based on purchase price vs current market · All values in {currency}
          </p>

          </>
          )}

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
          onRemove={() => { setPositions(prev => prev.filter(p => p.id !== editPos.id)); setEditPos(null) }}
          onMarkSold={() => { setSellPos(editPos); setEditPos(null) }}
          currency={currency}
          rates={rates}
        />
      )}
      {sellPos && (
        <SellModal
          position={sellPos}
          onClose={() => setSellPos(null)}
          onSell={(salePrice, soldAt) => handleSell(sellPos, salePrice, soldAt)}
          currency={currency}
          rates={rates}
          fmtCurrency={fmtCurrency}
        />
      )}
    </>
  )
}
