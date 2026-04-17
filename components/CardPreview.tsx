'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Card, fmt, scoreColor } from '@/lib/data'

export default function CardPreview({ card }: { card: Card }) {
  const isUp = card.trend === 'up'
  const [imgError, setImgError] = useState(false)

  return (
    <Link href={`/card/${card.id}`} className="card-hover" style={{ display: 'block', borderRadius: 16, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none' }}>
      <div style={{ width: '100%', height: 180, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, overflow: 'hidden' }}>
        {card.imageUrl && !imgError ? (
          <img
            src={card.imageUrl}
            alt={card.name}
            onError={() => setImgError(true)}
            style={{ height: '100%', width: '100%', objectFit: 'contain', padding: 8 }}
          />
        ) : (
          <span style={{ fontSize: 56 }}>{card.emoji}</span>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
        <div>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.3px' }}>{card.name}</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{card.set} · {card.grade}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="font-mono-custom" style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{fmt(card.price)}</div>
          <div className="font-mono-custom" style={{ fontSize: 11, color: isUp ? 'var(--green)' : 'var(--red)' }}>
            {isUp ? '▲' : '▼'} {Math.abs(card.change)}%
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, color: 'var(--ink3)' }}>CardIndex Score</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 56, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${card.score}%`, background: scoreColor(card.score), borderRadius: 2 }} />
          </div>
          <span className="font-mono-custom" style={{ fontSize: 11, color: scoreColor(card.score) }}>{card.score}</span>
        </div>
      </div>
    </Link>
  )
}
