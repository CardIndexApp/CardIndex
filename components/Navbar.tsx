'use client';
import Link from 'next/link';
import { useState } from 'react';
import AuthModal from './AuthModal';

export default function Navbar() {
  const [modal, setModal] = useState<'login' | 'signup' | null>(null);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(8,8,16,0.85)', backdropFilter: 'blur(12px)' }}>
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display font-800 text-lg tracking-tight" style={{ color: 'var(--ink)' }}>
            Card<span style={{ color: 'var(--gold)' }}>Index</span>
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--gold2)', color: 'var(--gold)', border: '1px solid rgba(232,197,71,0.2)', fontSize: '9px', letterSpacing: '1px' }}>BETA</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/market" className="text-sm px-3 py-1.5 rounded transition-colors"
            style={{ color: 'var(--ink2)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink2)')}>
            Market
          </Link>
          <button onClick={() => setModal('login')} className="text-sm px-3 py-1.5 rounded transition-colors"
            style={{ color: 'var(--ink2)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink2)')}>
            Log in
          </button>
          <button onClick={() => setModal('signup')}
            className="text-sm px-4 py-1.5 rounded font-medium transition-all"
            style={{ background: 'var(--gold)', color: '#080810' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            Sign up
          </button>
        </div>
      </nav>

      {modal && <AuthModal mode={modal} onClose={() => setModal(null)} />}
    </>
  );
}
