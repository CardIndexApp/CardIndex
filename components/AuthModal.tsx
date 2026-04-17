'use client';
import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  mode: 'login' | 'signup';
  onClose: () => void;
}

export default function AuthModal({ mode, onClose }: Props) {
  const [view, setView] = useState(mode);
  const [done, setDone] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl p-8 relative"
        style={{ background: 'var(--surface)', border: '1px solid var(--border2)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg transition-colors"
          style={{ color: 'var(--ink3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink3)')}>
          <X size={16} />
        </button>

        {!done ? (
          <>
            <div className="mb-6">
              <div className="font-display font-700 text-xl mb-1" style={{ color: 'var(--ink)' }}>
                Card<span style={{ color: 'var(--gold)' }}>Index</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--ink2)' }}>
                {view === 'login' ? 'Welcome back.' : 'The market index for trading cards.'}
              </p>
            </div>

            <div className="flex gap-1 p-1 rounded-lg mb-6" style={{ background: 'var(--surface2)' }}>
              {(['login', 'signup'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className="flex-1 py-1.5 rounded-md text-sm font-medium capitalize transition-all"
                  style={view === v
                    ? { background: 'var(--gold)', color: '#080810' }
                    : { color: 'var(--ink2)' }}>
                  {v === 'login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 mb-4">
              {view === 'signup' && (
                <input type="text" placeholder="Full name"
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink)' }} />
              )}
              <input type="email" placeholder="Email address"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink)' }} />
              <input type="password" placeholder="Password"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink)' }} />
            </div>

            <button onClick={() => setDone(true)}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: 'var(--gold)', color: '#080810' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              {view === 'login' ? 'Log in' : 'Create account'}
            </button>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-3xl mb-3">✓</div>
            <p className="font-display font-600 text-lg mb-1" style={{ color: 'var(--gold)' }}>You&apos;re in.</p>
            <p className="text-sm mb-6" style={{ color: 'var(--ink2)' }}>CardIndex dashboard coming soon.</p>
            <button onClick={onClose}
              className="px-6 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--ink)' }}>
              Continue to dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
