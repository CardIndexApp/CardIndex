import { tickerItems, fmt } from '@/lib/mockData';

export default function Ticker() {
  const items = [...tickerItems, ...tickerItems];
  return (
    <div className="overflow-hidden py-2.5" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className="ticker-track flex gap-8 whitespace-nowrap" style={{ width: 'max-content' }}>
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-2 font-mono text-xs">
            <span style={{ color: 'var(--ink3)' }}>{item.name}</span>
            <span style={{ color: 'var(--ink)' }}>{fmt(item.price)}</span>
            <span style={{ color: item.change >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change)}%
            </span>
            <span style={{ color: 'var(--border2)' }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
