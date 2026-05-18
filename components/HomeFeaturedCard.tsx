'use client'
import { useState } from 'react'
import NextImage from 'next/image'
import { ptImg } from '@/lib/img'

export interface FeaturedCard {
  id: string
  name: string
  set: string
  grade: string
  price: number
  change: number
  score: number
  img: string
}

function scoreColor(s: number) {
  return s >= 80 ? '#3de88a' : s >= 60 ? '#e8c547' : '#e8524a'
}

export function HomeFeaturedCard({ card, priority }: { card: FeaturedCard; priority?: boolean }) {
  const [imgErr, setImgErr] = useState(false)
  const up = card.change >= 0
  const url = `/card/${card.id}?grade=${encodeURIComponent(card.grade)}&name=${encodeURIComponent(card.name)}&set=${encodeURIComponent(card.set)}`

  let urgencyTag: { text: string; color: string } | null = null
  if (card.change >= 10)                       urgencyTag = { text: 'High demand',        color: 'var(--green)' }
  else if (card.change >= 3)                   urgencyTag = { text: 'Momentum building',  color: 'var(--gold)'  }
  else if (card.change < 0 && card.score >= 65) urgencyTag = { text: 'Undervalued',       color: '#4a9eff'      }

  return (
    <a href={url} className="card-hover" style={{ display: 'flex', flexDirection: 'column', borderRadius: 16, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none' }}>
      <div style={{ position: 'relative', width: '100%', height: 180, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', marginBottom: 14, overflow: 'hidden', flexShrink: 0 }}>
        {card.img && !imgErr
          ? <NextImage
              src={ptImg(card.img)}
              alt={card.name}
              fill
              sizes="(max-width: 640px) 45vw, 220px"
              style={{ objectFit: 'contain', padding: 8 }}
              onError={() => setImgErr(true)}
              priority={priority}
            />
          : <span style={{ fontSize: 48, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>🃏</span>}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.3px', minHeight: 36, lineHeight: 1.3 }}>{card.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{card.set}{card.set && card.grade ? ' · ' : ''}{card.grade}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="font-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>${card.price.toLocaleString()}</div>
            <div className="font-num" style={{ fontSize: 11, color: up ? 'var(--green)' : 'var(--red)' }}>
              {up ? '▲' : '▼'} {Math.abs(card.change).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {urgencyTag && (
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 99, background: `${urgencyTag.color}1a`, border: `1px solid ${urgencyTag.color}4d`, color: urgencyTag.color, fontWeight: 600 }}>
            {urgencyTag.text}
          </span>
        </div>
      )}

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 0.5 }}>CardIndex Score</span>
          <span className="font-num" style={{ fontSize: 13, fontWeight: 700, color: scoreColor(card.score) }}>{card.score}</span>
        </div>
        <div style={{ height: 4, borderRadius: 3, background: 'var(--track)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${card.score}%`, background: scoreColor(card.score), borderRadius: 3 }} />
        </div>
      </div>
    </a>
  )
}
