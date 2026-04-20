'use client'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)', padding: '56px 24px 32px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Main grid */}
        <div className="footer-grid" style={{ marginBottom: 48 }}>

          {/* Brand col */}
          <div className="footer-brand">
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 10 }}>
              Card<span style={{ color: 'var(--gold)' }}>Index</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.7, maxWidth: 240, marginBottom: 16 }}>
              The market intelligence platform for trading card collectors and investors.
            </p>
          </div>

          {/* Product col */}
          <div>
            <p style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, fontWeight: 600 }}>Product</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Market', href: '/market' },
                { label: 'Watchlist', href: '/watchlist' },
                { label: 'Search Cards', href: '/search' },
                { label: 'Pricing', href: '/pricing' },
              ].map(l => (
                <Link key={l.href} href={l.href} style={{ fontSize: 13, color: 'var(--ink2)', textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink2)')}
                >{l.label}</Link>
              ))}
            </div>
          </div>

          {/* Company col */}
          <div>
            <p style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, fontWeight: 600 }}>Company</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Contact Us', href: '/contact' },
              ].map(l => (
                <Link key={l.href} href={l.href} style={{ fontSize: 13, color: 'var(--ink2)', textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink2)')}
                >{l.label}</Link>
              ))}
            </div>
          </div>

          {/* Legal col */}
          <div>
            <p style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, fontWeight: 600 }}>Legal</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Terms & Conditions', href: '/terms' },
                { label: 'Privacy Policy', href: '/privacy' },
              ].map(l => (
                <Link key={l.href} href={l.href} style={{ fontSize: 13, color: 'var(--ink2)', textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink2)')}
                >{l.label}</Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--ink3)' }}>© 2026 CardIndex. All rights reserved.</p>
          <p style={{ fontSize: 11, color: 'var(--ink3)', opacity: 0.5 }}>
            Not affiliated with Pokémon, Nintendo, PSA, BGS or eBay.
          </p>
        </div>
      </div>

      <style>{`
        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 40px;
        }
        @media (max-width: 640px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr;
            gap: 36px;
          }
          .footer-brand {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </footer>
  )
}
