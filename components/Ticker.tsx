import { ticker, fmt } from '@/lib/data'

export default function Ticker() {
  const items = [...ticker, ...ticker]
  return (
    <div style={{ overflow: 'hidden', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '10px 0' }}>
      <div className="ticker-track" style={{ display: 'flex', gap: 32, whiteSpace: 'nowrap', width: 'max-content' }}>
        {items.map((item, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ color: 'var(--ink3)', fontFamily: 'Helvetica, Arial, sans-serif' }}>{item.name}</span>
            <span className="font-num" style={{ color: 'var(--ink)' }}>{fmt(item.price)}</span>
            <span className="font-num" style={{ color: item.change >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change)}%
            </span>
            <span style={{ color: 'var(--border2)' }}>·</span>
          </span>
        ))}
      </div>
    </div>
  )
}
