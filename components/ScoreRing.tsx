import { scoreColor } from '@/lib/data'

interface Props {
  score: number
  size?: 'sm' | 'md' | 'lg'
  breakdown?: { growth: number; liquidity: number; volatility: number; demand: number }
}

export default function ScoreRing({ score, size = 'md', breakdown }: Props) {
  const r = size === 'lg' ? 44 : size === 'md' ? 32 : 22
  const sw = size === 'lg' ? 5 : 4
  const circ = 2 * Math.PI * (r - sw)
  const dash = (score / 100) * circ
  const fs = size === 'lg' ? 20 : size === 'md' ? 14 : 10
  const c = scoreColor(score)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: r * 2, height: r * 2 }}>
        <svg width={r * 2} height={r * 2} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={r} cy={r} r={r - sw} fill="none" stroke="var(--track)" strokeWidth={sw} />
          <circle cx={r} cy={r} r={r - sw} fill="none" stroke={c} strokeWidth={sw}
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
        </svg>
        <span className="font-display" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: fs, fontWeight: 700, color: c }}>{score}</span>
      </div>
      {breakdown && size === 'lg' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
          {Object.entries(breakdown).map(([key, val]) => (
            <div key={key} style={{ borderRadius: 10, padding: 12, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--ink3)', textTransform: 'capitalize', marginBottom: 6, letterSpacing: '0.5px' }}>{key}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--track)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${val}%`, background: scoreColor(val), borderRadius: 2 }} />
                </div>
                <span className="font-mono-custom" style={{ fontSize: 11, color: scoreColor(val) }}>{val}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
