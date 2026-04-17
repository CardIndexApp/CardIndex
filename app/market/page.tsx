'use client';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Ticker from '@/components/Ticker';
import { risingCards, decliningCards, mostTraded } from '@/lib/mockData';
import { scoreColor } from '@/components/ScoreRing';

const ScoreBar = ({ score }: { score: number }) => (
  <div className="flex items-center gap-2">
    <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full rounded-full" style={{ width: `${score}%`, background: scoreColor(score) }} />
    </div>
    <span className="font-mono text-xs" style={{ color: scoreColor(score) }}>{score}</span>
  </div>
);

function MarketTable({ title, items, type }: {
  title: string;
  items: { id: string; name: string; grade: string; change?: number; volume?: number; score: number }[];
  type: 'rising' | 'declining' | 'traded';
}) {
  const icon = type === 'rising' ? <TrendingUp size={16} style={{ color: 'var(--green)' }} />
    : type === 'declining' ? <TrendingDown size={16} style={{ color: 'var(--red)' }} />
    : <Activity size={16} style={{ color: 'var(--blue)' }} />;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        {icon}
        <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{title}</span>
      </div>
      <div>
        {items.map((item, i) => (
          <Link key={item.id} href={`/card/${item.id}`}
            className="flex items-center justify-between px-5 py-3.5 transition-colors"
            style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs w-4 text-right" style={{ color: 'var(--ink3)' }}>{i + 1}</span>
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{item.name}</div>
                <div className="text-xs" style={{ color: 'var(--ink3)' }}>{item.grade}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {item.change !== undefined && (
                <span className="font-mono text-sm" style={{ color: item.change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {item.change >= 0 ? '+' : ''}{item.change}%
                </span>
              )}
              {item.volume !== undefined && (
                <span className="font-mono text-sm" style={{ color: 'var(--ink2)' }}>{item.volume} sales</span>
              )}
              <ScoreBar score={item.score} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Market() {
  return (
    <>
      <Navbar />
      <main className="pt-14 pb-20 min-h-screen">
        <Ticker />
        <div className="max-w-6xl mx-auto px-6 py-12">

          {/* Header */}
          <div className="mb-10">
            <p className="font-mono text-xs mb-2" style={{ color: 'var(--gold)', letterSpacing: '2px' }}>MARKET OVERVIEW</p>
            <h1 className="font-display font-bold text-4xl" style={{ color: 'var(--ink)', letterSpacing: '-1px' }}>
              Today&apos;s market
            </h1>
            <p className="text-sm mt-2" style={{ color: 'var(--ink2)' }}>Live snapshot of the trading card market.</p>
          </div>

          {/* Market Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            {[
              { label: 'Cards Rising', value: '1,284', color: 'var(--green)', icon: '↑' },
              { label: 'Cards Falling', value: '892', color: 'var(--red)', icon: '↓' },
              { label: 'Unchanged', value: '3,112', color: 'var(--ink2)', icon: '→' },
              { label: 'Market Sentiment', value: 'Bullish', color: 'var(--green)', icon: '●' },
            ].map((s, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span style={{ color: s.color, fontSize: 12 }}>{s.icon}</span>
                  <span className="text-xs" style={{ color: 'var(--ink3)' }}>{s.label}</span>
                </div>
                <div className="font-display font-bold text-xl" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <MarketTable title="Top rising (30d)" items={risingCards} type="rising" />
            <MarketTable title="Top declining (30d)" items={decliningCards} type="declining" />
          </div>
          <MarketTable title="Most traded (30d)" items={mostTraded} type="traded" />

          {/* Disclaimer */}
          <p className="text-xs mt-8 text-center" style={{ color: 'var(--ink3)' }}>
            Data shown is for demonstration purposes. CardIndex Beta — card-index.app
          </p>
        </div>
      </main>
    </>
  );
}
