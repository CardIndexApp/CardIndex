'use client'
import { useState } from 'react'

const faqItems = [
  {
    q: 'Where does the data come from?',
    a: 'CardIndex gets its data from eBay last-sold prices. On the rare occasion a card has limited sales on eBay, we switch to TCGplayer and show a dialog to let you know.',
  },
  {
    q: 'How does CardIndex decide on a verdict?',
    a: 'CardIndex uses a proprietary formula built from price history, liquidity, risk ratings and more to land on a verdict.',
  },
  {
    q: 'What if a card sells on eBay for 200% of its value?',
    a: 'CardIndex has built-in outlier detection: if a sale exceeds a set percentage difference, we exclude it from the calculations. If the price stabilises at that new level over time (around 3 days), we re-enter those sales into the calculations.',
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
