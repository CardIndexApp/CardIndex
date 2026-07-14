'use client'
import { useState, useEffect, useCallback } from 'react'
import { useCurrency } from '@/lib/currency'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PriceAlert {
  id: string
  user_id: string
  card_id: string
  card_name: string
  grade: string
  image_url: string | null
  target_price: number
  direction: 'above' | 'below'
  is_active: boolean
  created_at: string
  triggered_at: string | null
}

// ── Alert Bell button (for Navbar) ────────────────────────────────────────────

export function AlertBellButton({
  userId,
  onOpen,
}: {
  userId: string | null
  onOpen: () => void
}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) return
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => setCount((d.alerts ?? []).length))
      .catch(() => {})
  }, [userId])

  if (!userId) return null

  return (
    <button
      onClick={onOpen}
      style={{
        position: 'relative', width: 34, height: 34, borderRadius: '50%',
        background: 'var(--surface2)', border: '1px solid var(--border2)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: count > 0 ? 'var(--gold)' : 'var(--ink3)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = count > 0 ? 'var(--gold)' : 'var(--ink3)' }}
      title="Price Alerts"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={count > 0 ? 'var(--gold)' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {count > 0 && (
        <span style={{
          position: 'absolute', top: -2, right: -2,
          width: 14, height: 14, borderRadius: '50%',
          background: 'var(--red)', fontSize: 8, fontWeight: 700,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}

// ── Set Alert Modal ───────────────────────────────────────────────────────────

export function SetAlertModal({
  cardId,
  cardName,
  grade,
  currentPrice,
  imageUrl,
  onClose,
  onSaved,
}: {
  cardId: string
  cardName: string
  grade: string
  currentPrice: number | null
  imageUrl?: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const { fmtCurrency } = useCurrency()
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [priceInput, setPriceInput] = useState(currentPrice ? currentPrice.toFixed(2) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    const price = parseFloat(priceInput)
    if (!price || price <= 0) { setError('Enter a valid target price.'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id:      cardId,
          card_name:    cardName,
          grade,
          target_price: price,
          direction,
          image_url:    imageUrl ?? null,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setError(j.error ?? 'Failed to save alert.')
        setSaving(false)
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('Network error.')
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 380, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Set Price Alert</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{cardName} · {grade}</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--ink3)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {currentPrice && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--ink3)' }}>Current price: </span>
              <span className="font-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(currentPrice)}</span>
            </div>
          )}

          {/* Direction */}
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>DIRECTION</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(['above', 'below'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  style={{
                    padding: '10px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${direction === d ? (d === 'above' ? 'var(--green)' : 'var(--red)') : 'var(--border2)'}`,
                    background: direction === d ? (d === 'above' ? 'rgba(61,232,138,0.08)' : 'rgba(232,82,74,0.08)') : 'var(--surface2)',
                    color: direction === d ? (d === 'above' ? 'var(--green)' : 'var(--red)') : 'var(--ink3)',
                    fontSize: 13, fontWeight: direction === d ? 700 : 400,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  {d === 'above' ? '↑ Above' : '↓ Below'}
                </button>
              ))}
            </div>
          </div>

          {/* Target price */}
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 8 }}>TARGET PRICE</div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--ink3)', pointerEvents: 'none' }}>$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={priceInput}
                onChange={e => { setPriceInput(e.target.value); setError('') }}
                placeholder="0.00"
                autoFocus
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 24px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 16, outline: 'none' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              />
            </div>
          </div>

          {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%', padding: '13px 0', borderRadius: 12, background: saving ? 'rgba(232,197,71,0.4)' : 'var(--gold)', color: '#080810', border: 'none', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}
          >
            {saving ? 'Saving…' : 'Set Alert'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Alert Centre Modal ────────────────────────────────────────────────────────

export function AlertCentreModal({ onClose }: { onClose: () => void }) {
  const { fmtCurrency } = useCurrency()
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/alerts')
      const d = await r.json()
      setAlerts(d.alerts ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id))
    await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' })
  }

  const active  = alerts.filter(a => a.is_active)
  const fired   = alerts.filter(a => !a.is_active)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 380, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border2)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 4 }}>ALERTS</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>Price Alerts</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--ink3)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 0' }}>
          {loading && (
            <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--ink3)' }}>Loading…</div>
          )}

          {!loading && alerts.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                <line x1="4" y1="4" x2="20" y2="20"/>
              </svg>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>No price alerts</div>
              <div style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.5 }}>
                Click the bell icon on any watchlist card to set a price alert.
              </div>
            </div>
          )}

          {!loading && fired.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ padding: '0 20px 8px', fontSize: 9, letterSpacing: 2, color: 'var(--ink3)' }}>TRIGGERED</div>
              {fired.map((alert, i) => (
                <div key={alert.id} style={{ padding: '12px 20px', borderBottom: i < fired.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(232,197,71,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--gold)" stroke="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.card_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
                      {alert.grade} · {alert.direction === 'above' ? 'Rose above' : 'Dropped below'} {fmtCurrency(alert.target_price)}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(alert.id)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {!loading && active.length > 0 && (
            <div>
              <div style={{ padding: '0 20px 8px', fontSize: 9, letterSpacing: 2, color: 'var(--ink3)' }}>WATCHING</div>
              {active.map((alert, i) => {
                const isAbove = alert.direction === 'above'
                return (
                  <div key={alert.id} style={{ padding: '12px 20px', borderBottom: i < active.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: isAbove ? 'rgba(61,232,138,0.12)' : 'rgba(232,82,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 18, color: isAbove ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{isAbove ? '↑' : '↓'}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.card_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{alert.grade}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 9, color: 'var(--ink3)', marginBottom: 2 }}>{isAbove ? 'above' : 'below'}</div>
                      <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{fmtCurrency(alert.target_price)}</div>
                    </div>
                    <button onClick={() => handleDelete(alert.id)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>×</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
