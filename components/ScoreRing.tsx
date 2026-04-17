interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  breakdown?: { growth: number; liquidity: number; volatility: number; demand: number };
}

const scoreColor = (s: number) => s >= 80 ? '#3de88a' : s >= 60 ? '#e8c547' : '#e8524a';
const scoreLabel = (s: number) => s >= 80 ? 'Strong' : s >= 60 ? 'Moderate' : 'Weak';

export default function ScoreRing({ score, size = 'md', breakdown }: Props) {
  const c = scoreColor(score);
  const r = size === 'lg' ? 48 : size === 'md' ? 36 : 24;
  const sw = size === 'lg' ? 5 : 4;
  const circ = 2 * Math.PI * (r - sw);
  const dash = (score / 100) * circ;
  const fs = size === 'lg' ? 22 : size === 'md' ? 16 : 11;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center" style={{ width: r * 2, height: r * 2 }}>
        <svg width={r * 2} height={r * 2} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={r} cy={r} r={r - sw} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
          <circle cx={r} cy={r} r={r - sw} fill="none" stroke={c} strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        </svg>
        <span className="absolute font-display font-700" style={{ fontSize: fs, color: c }}>{score}</span>
      </div>

      {breakdown && size === 'lg' && (
        <div className="w-full grid grid-cols-2 gap-2 mt-2">
          {Object.entries(breakdown).map(([key, val]) => (
            <div key={key} className="rounded-lg p-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div className="text-xs capitalize mb-1.5" style={{ color: 'var(--ink3)', letterSpacing: '0.5px' }}>{key}</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{ width: `${val}%`, background: scoreColor(val), transition: 'width 0.8s ease' }} />
                </div>
                <span className="font-mono text-xs font-500" style={{ color: scoreColor(val) }}>{val}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { scoreColor, scoreLabel };
