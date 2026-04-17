'use client'
import Link from 'next/link'
import { useState } from 'react'
import AuthModal from './AuthModal'

export default function Navbar() {
  const [modal, setModal] = useState<'login' | 'signup' | null>(null)
  return (
    <>
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'rgba(8,8,16,0.9)', backdropFilter: 'blur(12px)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>
            Card<span style={{ color: 'var(--gold)' }}>Index</span>
          </span>
          <span className="font-mono-custom" style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--gold2)', color: 'var(--gold)', border: '1px solid rgba(232,197,71,0.2)', letterSpacing: 1 }}>BETA</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link href="/market" style={{ fontSize: 14, padding: '6px 12px', borderRadius: 8, color: 'var(--ink2)', textDecoration: 'none' }}>Market</Link>
          <button onClick={() => setModal('login')} style={{ fontSize: 14, padding: '6px 12px', borderRadius: 8, color: 'var(--ink2)', background: 'none', border: 'none', cursor: 'pointer' }}>Log in</button>
          <button onClick={() => setModal('signup')} style={{ fontSize: 14, padding: '7px 16px', borderRadius: 8, background: 'var(--gold)', color: '#080810', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Sign up</button>
        </div>
      </nav>
      {modal && <AuthModal mode={modal} onClose={() => setModal(null)} />}
    </>
  )
}
