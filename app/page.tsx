'use client';
import { useState } from 'react';
import { Search, TrendingUp, BarChart2, Shield } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Ticker from '@/components/Ticker';
import CardPreview from '@/components/CardPreview';
import AuthModal from '@/components/AuthModal';
import { cards } from '@/lib/mockData';

export default function Home() {
  const [modal, setModal] = useState<'signup' | null>(null);

  return (
    <>
      <Navbar />
      {modal && <AuthModal mode="signup" onClose={() => setModal(null)} />}
      <main className="relative">
        <section className="grid-bg relative min-h-screen flex flex-col items-center justify-center px-6 pt-14 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(232,197,71,0.06) 0%, transparent 70%)' }} />
          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-8 anim d1" style={{ background: 'var(--gold2)', border: '1px solid rgba(232,197,71,0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gold)' }} />
              <span className="font-mono text-xs" style={{ color: 'var(--gold)', letterSpacing: '1px' }}>LIVE MARKET DATA</span>
            </div>
            <h1 className="font-display font-800 leading-none mb-6 anim d2" style={{ fontSize: 'clamp(42px,7vw,80px)', letterSpacing: '-2px', color: 'var(--ink)' }}>
              The market index<br /><span style={{ color: 'var(--gold)' }}>for trading cards</span>
            </h1>
            <p className="text-lg mb-10 anim d3" style={{ color: 'var(--ink2)', maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.6 }}>
              CardIndex scores, real-time pricing intelligence, and market analysis — built for serious collectors and investors.
            </p>
            <div className="relative max-w-xl mx-auto mb-8 anim d4">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink3)' }} />
              <input type="text" placeholder='Search a card (Charizard, Lugia, Eevee…)' className="w-full pl-10 pr-4 py-4 rounded-xl text-sm outline-none" style={{ background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: '15px' }} onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')} onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')} />
            </div>
            <div className="flex items-center justify-center gap-3 anim d5">
              <a href="#featured" className="px-6 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink)' }}>Explore Market</a>
              <button onClick={() => setModal('signup')} className="px-6 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--gold)', color: '#080810' }} onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>Get started free →</button>
            </div>
          </div>
          <div className="relative z-10 w-full max-w-3xl mx-auto mt-20 mb-0 anim d6">
            <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden" style={{ background: 'var(--border)' }}>
              {[{ label: 'Cards tracked', value: '60,000+' }, { label: 'Data sources', value: 'eBay · TCGPlayer · PWCC' }, { label: 'Analysis time', value: '< 2 seconds' }].map((s, i) => (
                <div key={i} className="px-6 py-5 text-center" style={{ background: 'var(--surface)' }}>
                  <div className="font-display font-bold text-lg" style={{ color: 'var(--ink)' }}>{s.value}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ink3)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <Ticker />
        <section id="featured" className="px-6 py-20 max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="font-mono text-xs mb-2" style={{ color: 'var(--gold)', letterSpacing: '2px' }}>FEATURED CARDS</p>
              <h2 className="font-display font-bold text-3xl" style={{ color: 'var(--ink)', letterSpacing: '-1px' }}>Market highlights</h2>
            </div>
            <a href="/market" className="text-sm" style={{ color: 'var(--ink3)' }}>View all →</a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(card => <CardPreview key={card.id} card={card} />)}
          </div>
        </section>
        <section className="px-6 py-16 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: <BarChart2 size={20} />, title: 'CardIndex Score', body: 'A composite 0–100 score measuring growth, liquidity, volatility, and collector demand for any card.' },
              { icon: <TrendingUp size={20} />, title: 'Market Verdicts', body: 'Plain-language analysis backed by real transaction data and trend signals.' },
              { icon: <Shield size={20} />, title: 'Price History', body: 'Up to 12 months of historical price data with daily snapshots and sales volume.' },
            ].map((f, i) => (
              <div key={i} className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style={{ background: 'var(--gold2)', color: 'var(--gold)' }}>{f.icon}</div>
                <div className="font-semibold text-base mb-2" style={{ color: 'var(--ink)' }}>{f.title}</div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink2)' }}>{f.body}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="px-6 py-20">
          <div className="max-w-2xl mx-auto text-center rounded-2xl p-12" style={{ background: 'var(--surface)', border: '1px solid var(--border2)' }}>
            <p className="font-mono text-xs mb-4" style={{ color: 'var(--gold)', letterSpacing: '2px' }}>FREE TO START</p>
            <h2 className="font-display font-bold text-3xl mb-3" style={{ color: 'var(--ink)', letterSpacing: '-1px' }}>Start tracking the market</h2>
            <p className="text-sm mb-8" style={{ color: 'var(--ink2)' }}>CardIndex is free to use. No credit card required.</p>
            <button onClick={() => setModal('signup')} className="px-8 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--gold)', color: '#080810' }} onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>Create free account →</button>
          </div>
        </section>
        <footer className="px-6 py-8 text-center" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="font-display font-bold text-sm mb-1" style={{ color: 'var(--ink)' }}>Card<span style={{ color: 'var(--gold)' }}>Index</span></div>
          <p className="text-xs" style={{ color: 'var(--ink3)' }}>© 2026 card-index.app — The market index for trading cards</p>
        </footer>
      </main>
    </>
  );
}
