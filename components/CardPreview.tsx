'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Card, fmt, scoreColor } from '@/lib/data'
import { tcgImg } from '@/lib/img'

export default function CardPreview({ card }: { card: Card }) {
  const isUp = card.trend === 'up'
  const [imgError, setImgError] = useState(false)

  return (
    <Link href={`/card/${card.id}`} className="card-hover" style={{ display: 'flex', flexDirection: 'column', borderRadius: 16, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none' }}>
      {/* Image */}
      <div style={{ width: '100%', height: 180, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, overflow: 'hidden', flexShrink: 0 }}>
        {card.imageUrl && !imgError ? (
          <img
            src={tcgImg(card.imageUrl)}
            alt={card.name}
            onError={() => setImgError(true)}
            style={{ height: '100%', width: '100%', objectFit: 'contain', padding: 8 }}
          />
        ) : (
          <span style={{ fontSize: 56 }}>{card.emoji}</span>
        )}
      </div>

      {/* Name / set — fixed height so price always aligns */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.3px', minHeight: 36, lineHeight: 1.3 }}>{card.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{card.set} · {card.grade}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{fmt(card.price)}</div>
            <div className="font-num" style={{ fontSize: 11, color: isUp ? 'var(--green)' : 'var(--red)' }}>
              {isUp ? '▲' : '▼'} {Math.abs(card.change)}%
            </div>
          </div>
        </div>
      </div>

      {/* Score — always at bottom */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 0.5 }}>CardIndex Score</span>
          <span className="font-num" style={{ fontSize: 13, fontWeight: 700, color: scoreColor(card.score) }}>{card.score}</span>
        </div>
        <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${card.score}%`, background: scoreColor(card.score), borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
      </div>
    </Link>
  )
}
