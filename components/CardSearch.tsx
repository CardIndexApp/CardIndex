'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface TcgCard {
  id: string
  name: string
  number: string
  rarity?: string
  set: { name: string }
  images: { small: string; large: string }
}

export default function CardSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TcgCard[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const router = useRouter()

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current)
    if (!q.trim() || q.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const encoded = encodeURIComponent(`name:${q}*`)
        const res = await fetch(
          `https://api.pokemontcg.io/v2/cards?q=${encoded}&pageSize=12&orderBy=number`
        )
        const data = await res.json()
        setResults(data.data || [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 280)
  }, [])

  return (
    <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto 28px' }}>
      {/* Search icon */}
      <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink3)', fontSize: 15, zIndex: 1, pointerEvents: 'none' }}>
        {loading ? (
          <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--gold)', animation: 'spin 0.7s linear infinite' }} />
        ) : '🔍'}
      </span>

      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); search(e.target.value) }}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder="Search any card (Charizard, Pikachu, Lugia…)"
        style={{ width: '100%', paddingLeft: 44, paddingRight: 16, paddingTop: 14, paddingBottom: 14, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 15, outline: 'none', transition: 'border-color 0.2s' }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
      />

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 14, overflow: 'hidden', zIndex: 200, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', maxHeight: 360, overflowY: 'auto' }}>
          {results.map(card => (
            <button
              key={card.id}
              onMouseDown={() => {
                router.push(`/card/${card.id}`)
                setOpen(false)
              }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {card.images?.small ? (
                <img
                  src={card.images.small}
                  alt={card.name}
                  style={{ width: 32, height: 44, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 32, height: 44, borderRadius: 4, background: 'var(--surface2)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>{card.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
                  #{card.number} · {card.set.name}
                </div>
                {card.rarity && (
                  <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 2 }}>{card.rarity}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
