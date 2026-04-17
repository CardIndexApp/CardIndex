'use client';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { ArrowLeft, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import PriceChart from '@/components/PriceChart';
import ScoreRing, { scoreColor, scoreLabel } from '@/components/ScoreRing';
import { getCard, fmt } from '@/lib/mockData';

export default function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const card = getCard(id);
  if (!card) return notFound();

  const isUp = card.trend === 'up';
  const firstPrice = card.priceHistory[0].price;
  const lastPrice = card.priceHistory[card.priceHistory.length - 1].price;
  const totalChange = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(1);

  const emojis: Record<string, string> = {
    'charizard-base-psa9': '🔥',
    'lugia-v-alt-psa10': '🌊',
    'eevee-promo-psa10': '⭐',
    'pikachu-illustrator': '⚡',
  };

  return (
    <>
      <Navbar />
      <main className="pt-14 pb-20 min-h-screen">
        <div className="max-w-5xl mx-auto px-6">

          {/* Back */}
          <div className="py-6">
            <Link href="/" className="inline-flex items-center gap-2 text-sm transition-colors" style={{ color: 'var(--ink3)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink3)')}>
              <ArrowLeft size={14} /> Back to market
            </Link>
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-6 mb-8 flex-wrap">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', fontSize: 32 }}>
                {emojis[card.id] || '🃏'}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--ink)', letterSpacing: '-0.5px' }}>{card.name}</h1>
                  <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: 'var(--surface2)', color: 'var(--ink3)', border: '1px solid var(--border)' }}>{card.grade}</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--ink2)' }}>{card.set} · {card.rarity} · {card.year}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display font-bold text-3xl font-mono" style={{ color: 'var(--ink)', letterSpacing: '-1px' }}>{fmt(card.price)}</div>
              <div className="flex items-center justify-end gap-1.5 mt-1">
                {isUp ? <TrendingUp size={14} style={{ color: 'var(--green)' }} /> : <TrendingDown size={14} style={{ color: 'var(--red)' }} />}
                <span className="text-sm font-mono" style={{ color: isUp ? 'var(--green)' : 'var(--red)' }}>
                  {isUp ? '+' : ''}{card.priceChange}% (30d)
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Chart + Verdict */}
            <div className="lg:col-span-2 flex flex-col gap-6">

              {/* Quick stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Current Price', value: fmt(card.price) },
                  { label: '12M Change', value: `${parseFloat(totalChange) >= 0 ? '+' : ''}${totalChange}%`, color: parseFloat(totalChange) >= 0 ? 'var(--green)' : 'var(--red)' },
                  { label: 'Recent Sales', value: `${card.recentSales.length} (30d)` },
                ].map((s, i) => (
                  <div key={i} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="text-xs mb-1.5" style={{ color: 'var(--ink3)' }}>{s.label}</div>
                    <div className="font-mono font-semibold text-base" style={{ color: s.color || 'var(--ink)' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="font-mono text-xs mb-1" style={{ color: 'var(--ink3)', letterSpacing: '1px' }}>PRICE HISTORY</p>
                    <p className="font-semibold" style={{ color: 'var(--ink)' }}>12 Month Chart</p>
                  </div>
                  <div className="flex gap-1">
                    {['1M', '3M', '6M', '1Y'].map((t, i) => (
                      <button key={t} className="text-xs px-2.5 py-1 rounded transition-all"
                        style={i === 3
                          ? { background: 'var(--gold2)', color: 'var(--gold)', border: '1px solid rgba(232,197,71,0.2)' }
                          : { color: 'var(--ink3)', border: '1px solid transparent' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <PriceChart data={card.priceHistory} />
              </div>

              {/* Market Verdict */}
              <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="font-mono text-xs mb-4" style={{ color: 'var(--ink3)', letterSpacing: '1px' }}>MARKET VERDICT</p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="px-3 py-1 rounded-lg text-sm font-semibold"
                    style={isUp
                      ? { background: 'rgba(61,232,138,0.1)', color: 'var(--green)', border: '1px solid rgba(61,232,138,0.2)' }
                      : { background: 'var(--red2)', color: 'var(--red)', border: '1px solid rgba(232,82,74,0.2)' }}>
                    {isUp ? '↑ Bullish' : '↓ Bearish'}
                  </div>
                  <span className="text-sm" style={{ color: 'var(--ink2)' }}>{card.verdictShort}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink2)', lineHeight: 1.8 }}>
                  {card.verdict}
                </p>
              </div>

              {/* Recent Sales */}
              <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="font-mono text-xs mb-4" style={{ color: 'var(--ink3)', letterSpacing: '1px' }}>RECENT SALES</p>
                <div className="flex flex-col gap-0">
                  {card.recentSales.map((sale, i) => (
                    <div key={i} className="flex items-center justify-between py-3"
                      style={{ borderBottom: i < card.recentSales.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono" style={{ color: 'var(--ink3)' }}>{sale.date}</span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface2)', color: 'var(--ink3)' }}>{sale.platform}</span>
                      </div>
                      <span className="font-mono text-sm font-medium" style={{ color: 'var(--ink)' }}>{fmt(sale.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Score */}
            <div className="flex flex-col gap-6">
              <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="font-mono text-xs mb-6 text-center" style={{ color: 'var(--ink3)', letterSpacing: '1px' }}>CARDINDEX SCORE</p>
                <div className="flex justify-center mb-2">
                  <ScoreRing score={card.score} size="lg" />
                </div>
                <p className="text-center text-sm mt-4 mb-6" style={{ color: scoreColor(card.score) }}>
                  {scoreLabel(card.score)} — {card.score}/100
                </p>
                <ScoreRing score={card.score} size="lg" breakdown={card.scoreBreakdown} />
              </div>

              {/* Grade info */}
              <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="font-mono text-xs mb-4" style={{ color: 'var(--ink3)', letterSpacing: '1px' }}>GRADE INFO</p>
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Grade', value: card.grade },
                    { label: 'Set', value: card.set },
                    { label: 'Year', value: card.year },
                    { label: 'Rarity', value: card.rarity },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: 'var(--ink3)' }}>{row.label}</span>
                      <span className="text-xs font-medium" style={{ color: 'var(--ink)' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Search on eBay CTA */}
              <a href="https://ebay.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm transition-all"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink2)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--ink2)'; }}>
                <ExternalLink size={13} /> View on eBay
              </a>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
