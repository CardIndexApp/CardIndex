import Link from 'next/link';
import { CardData, fmt } from '@/lib/mockData';
import { scoreColor } from './ScoreRing';

const CardArt = ({ id }: { id: string }) => {
  const gradients: Record<string, string> = {
    'charizard-base-psa9': 'from-orange-900/40 via-red-900/30 to-amber-900/20',
    'lugia-v-alt-psa10': 'from-blue-900/40 via-indigo-900/30 to-cyan-900/20',
    'eevee-promo-psa10': 'from-amber-900/40 via-yellow-900/30 to-orange-900/20',
    'pikachu-illustrator': 'from-yellow-900/40 via-amber-900/30 to-yellow-800/20',
  };
  const emojis: Record<string, string> = {
    'charizard-base-psa9': '🔥',
    'lugia-v-alt-psa10': '🌊',
    'eevee-promo-psa10': '⭐',
    'pikachu-illustrator': '⚡',
  };
  return (
    <div className={`w-full h-40 rounded-lg bg-gradient-to-br ${gradients[id] || 'from-gray-900/40'} flex items-center justify-center`}
      style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 48 }}>{emojis[id] || '🃏'}</span>
    </div>
  );
};

export default function CardPreview({ card }: { card: CardData }) {
  const isUp = card.trend === 'up';
  return (
    <Link href={`/card/${card.id}`}
      className="block rounded-xl p-4 card-hover"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <CardArt id={card.id} />
      <div className="mt-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <div className="font-display font-600 text-sm" style={{ color: 'var(--ink)' }}>{card.name}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--ink3)' }}>{card.set} · {card.grade}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-mono font-500 text-sm" style={{ color: 'var(--ink)' }}>{fmt(card.price)}</div>
            <div className="text-xs font-mono" style={{ color: isUp ? 'var(--green)' : 'var(--red)' }}>
              {isUp ? '▲' : '▼'} {Math.abs(card.priceChange)}%
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-xs" style={{ color: 'var(--ink3)' }}>CardIndex Score</div>
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${card.score}%`, background: scoreColor(card.score) }} />
            </div>
            <span className="font-mono text-xs font-500" style={{ color: scoreColor(card.score) }}>{card.score}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
