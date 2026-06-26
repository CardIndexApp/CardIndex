'use client'
import Link from 'next/link'

const GOLD = '#e8c547'
const INK = '#eeeef8'
const INK2 = '#b8b8d0'
const INK3 = '#50506a'
const BORDER = 'rgba(255,255,255,0.07)'

export default function Footer() {
  return (
    <footer style={{
      borderTop: `1px solid ${BORDER}`,
      background: '#0b0c0f',
      padding: '48px 24px 32px',
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Main grid */}
        <div className="footer-grid" style={{ marginBottom: 40 }}>

          {/* Brand col */}
          <div className="footer-brand">
            <div style={{ fontSize: 18, fontWeight: 800, color: INK, letterSpacing: '-0.5px', marginBottom: 10 }}>
              Card<span style={{ color: GOLD }}>Index</span>
            </div>
            <p style={{ fontSize: 12, color: INK3, lineHeight: 1.7, maxWidth: 240, marginBottom: 0 }}>
              The market intelligence platform for trading card collectors and investors.
            </p>
          </div>

          {/* Company col */}
          <div>
            <p style={{ fontSize: 10, color: INK3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>Company</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[{ label: 'Contact Us', href: '/contact' }].map(l => (
                <Link key={l.href} href={l.href}
                  style={{ fontSize: 13, color: INK2, textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = INK)}
                  onMouseLeave={e => (e.currentTarget.style.color = INK2)}
                >{l.label}</Link>
              ))}
            </div>
          </div>

          {/* Legal col */}
          <div>
            <p style={{ fontSize: 10, color: INK3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>Legal</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Terms & Conditions', href: '/terms' },
                { label: 'Privacy Policy', href: '/privacy' },
              ].map(l => (
                <Link key={l.href} href={l.href}
                  style={{ fontSize: 13, color: INK2, textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = INK)}
                  onMouseLeave={e => (e.currentTarget.style.color = INK2)}
                >{l.label}</Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <p style={{ fontSize: 11, color: INK3 }}>© 2026 Creos Labs. All rights reserved.</p>
          <p style={{ fontSize: 11, color: INK3, opacity: 0.55 }}>
            Not affiliated with Pokémon, Nintendo, PSA, BGS or eBay.
          </p>
        </div>
      </div>

      <style>{`
        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 40px;
        }
        @media (max-width: 640px) {
          .footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
          .footer-brand { grid-column: 1 / -1; }
        }
      `}</style>
    </footer>
  )
}
