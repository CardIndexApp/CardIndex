'use client'
import { useState, useEffect, useCallback } from 'react'
import { useCurrency } from '@/lib/currency'
import { tcgImg } from '@/lib/img'
import type { PriceAlert } from '@/components/AlertCentre'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function StatusBadge({ alert }: { alert: PriceAlert }) {
  if (alert.triggered_at) {
    return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em', background: 'rgba(248,113,113,.12)', color: '#f87171', border: '1px solid rgba(248,113,113,.35)' }}>TRIGGERED</span>
  }
  if (!alert.is_active) {
    return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em', background: '#1c1c1f', color: '#6b6b72', border: '1px solid #2a2a2e' }}>SNOOZED</span>
  }
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em', background: '#1c1c1f', color: '#9a9aa2', border: '1px solid #2a2a2e' }}>WATCHING</span>
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{ width: 40, height: 22, borderRadius: 999, position: 'relative', cursor: 'pointer', flexShrink: 0, background: on ? '#3ba85a' : '#2a2a2e', transition: 'background 0.15s' }}
    >
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: on ? 20 : 2, transition: 'left 0.15s' }} />
    </div>
  )
}

export default function AlertsPage() {
  const { fmtCurrency } = useCurrency()
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/alerts')
      if (r.status === 401) { setIsLoggedIn(false); setAuthChecked(true); return }
      const d = await r.json()
      setAlerts(d.alerts ?? [])
      setIsLoggedIn(true)
    } finally {
      setLoading(false)
      setAuthChecked(true)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(alert: PriceAlert) {
    const next = !alert.is_active
    setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, is_active: next } : a))
    await fetch(`/api/alerts?id=${alert.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: next }),
    })
  }

  async function handleDelete(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id))
    await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' })
  }

  useEffect(() => {
    document.body.classList.add('has-sidebar')
    return () => document.body.classList.remove('has-sidebar')
  }, [])

  const triggered = alerts.filter(a => a.triggered_at)
  const active    = alerts.filter(a => !a.triggered_at && a.is_active)
  const snoozed   = alerts.filter(a => !a.triggered_at && !a.is_active)
  const todayTriggered = alerts.filter(a => {
    if (!a.triggered_at) return false
    return Date.now() - new Date(a.triggered_at).getTime() < 86_400_000
  }).length

  return (
    <>
      <style>{`
        body.has-sidebar main { padding-top: 0 !important; }
        body.has-sidebar main > * { padding-top: 48px; }
        @media (min-width: 768px) {
          body.has-sidebar main > * { padding-top: 0; }
        }
        .alert-row:hover { background: rgba(255,255,255,0.02); }
        .dots-btn { opacity: 0; transition: opacity 0.15s; }
        .alert-row:hover .dots-btn { opacity: 1; }
      `}</style>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 24px 60px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 6, lineHeight: 1.1 }}>
            Alerts
          </h1>
          {authChecked && isLoggedIn && !loading && (
            <p style={{ fontSize: 14, color: 'var(--ink3)' }}>
              {active.length} active{todayTriggered > 0 ? ` · ${todayTriggered} triggered today` : ''}
            </p>
          )}
          {authChecked && isLoggedIn && loading && (
            <p style={{ fontSize: 14, color: 'var(--ink3)' }}>Loading…</p>
          )}
        </div>

        {/* Not logged in */}
        {authChecked && !isLoggedIn && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: 15, color: 'var(--ink2)', fontWeight: 600, marginBottom: 8 }}>Sign in to view your alerts</p>
            <a href="/login" style={{ fontSize: 14, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Log in →</a>
          </div>
        )}

        {/* Empty */}
        {authChecked && isLoggedIn && !loading && alerts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16, display: 'block', margin: '0 auto 16px' }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>No alerts yet</p>
            <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Set a price alert from any card page or your watchlist.</p>
          </div>
        )}

        {/* Table */}
        {isLoggedIn && alerts.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) 160px 110px 90px 80px', alignItems: 'center', padding: '14px 20px 12px', gap: 8, borderBottom: '1px solid var(--border)' }}>
              {['CARD', 'CONDITION', 'STATUS', 'TRIGGERED', 'ACTIVE'].map(h => (
                <div key={h} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--ink3)' }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {[...triggered, ...active, ...snoozed].map((alert, i, arr) => (
              <div
                key={alert.id}
                className="alert-row"
                style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) 160px 110px 90px 80px', alignItems: 'center', padding: '14px 20px', gap: 8, borderTop: i > 0 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
              >
                {/* Card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {alert.image_url
                    ? <img src={tcgImg(alert.image_url)} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'contain', flexShrink: 0, background: 'var(--surface2)' }} />
                    : <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0 }} />
                  }
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{alert.card_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>{alert.grade} · Price Threshold</div>
                  </div>
                </div>

                {/* Condition */}
                <div style={{ fontSize: 14, color: 'var(--ink2)' }}>
                  Price {alert.direction === 'above' ? '≥' : '≤'} {fmtCurrency(alert.target_price)}
                </div>

                {/* Status */}
                <div><StatusBadge alert={alert} /></div>

                {/* Triggered */}
                <div style={{ fontSize: 13, color: 'var(--ink3)' }}>
                  {alert.triggered_at ? timeAgo(alert.triggered_at) : 'Never'}
                </div>

                {/* Active + dots */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Toggle on={alert.is_active} onChange={() => handleToggle(alert)} />
                  <button
                    className="dots-btn"
                    onClick={() => handleDelete(alert.id)}
                    title="Delete alert"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', padding: 2, display: 'flex', alignItems: 'center' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Skeleton */}
        {loading && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) 160px 110px 90px 80px', alignItems: 'center', padding: '14px 20px', gap: 8, borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 8 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="skeleton skeleton-text" style={{ width: 120 }} />
                    <div className="skeleton skeleton-text" style={{ width: 80 }} />
                  </div>
                </div>
                <div className="skeleton skeleton-text" style={{ width: 100 }} />
                <div className="skeleton skeleton-text" style={{ width: 70 }} />
                <div className="skeleton skeleton-text" style={{ width: 50 }} />
                <div className="skeleton" style={{ width: 40, height: 22, borderRadius: 999 }} />
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  )
}
