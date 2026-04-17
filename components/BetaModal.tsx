'use client'
import { useEffect } from 'react'

export default function BetaModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,8,16,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 400, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border2)', padding: 40, textAlign: 'center' }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 99, padding: '4px 12px', marginBottom: 24, background: 'var(--gold2)', border: '1px solid rgba(232,197,71,0.2)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }} />
          <span className="font-mono-custom" style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2 }}>BETA</span>
        </div>
        <h2 className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 12 }}>
          Currently in Beta
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7, marginBottom: 28 }}>
          CardIndex is currently in beta. Account creation and full market access are coming soon. Stay tuned for updates.
        </p>
        <button
          onClick={onClose}
          style={{ padding: '10px 28px', borderRadius: 10, background: 'var(--gold)', color: '#080810', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
