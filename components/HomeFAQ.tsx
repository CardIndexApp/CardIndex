'use client'
import { useState } from 'react'

const faqItems = [
  {
    q: 'What trading cards are supported?',
    a: 'We currently focus on Pokémon TCG, with support for sports cards and other trading card games coming soon. Thousands of cards are already indexed.',
  },
  {
    q: 'Is CardIndex free to use?',
    a: 'Yes — the core features including search, price history, and CardIndex Scores are completely free. No credit card required to get started.',
  },
  {
    q: 'How accurate is the price data?',
    a: 'Prices are sourced from real completed eBay sales, updated daily. We only use verified sold listings — not asking prices or estimates.',
  },
]

export function HomeFAQ() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderRadius: 16, overflow: 'hidden', background: 'var(--border)' }}>
      {faqItems.map((item, i) => (
        <div key={i} style={{ background: 'var(--surface)' }}>
          <button
            onClick={() => setOpenFaq(openFaq === i ? null : i)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{item.q}</span>
            <span style={{ fontSize: 16, color: 'var(--ink3)', flexShrink: 0, transition: 'transform 0.2s', display: 'inline-block', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
          </button>
          {openFaq === i && (
            <div style={{ padding: '0 24px 20px' }}>
              <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.75 }}>{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
