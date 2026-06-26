'use client'

// Shown to non-admin accounts that sign in on the web. CardIndex is iOS-first,
// so the web app is reserved for the admin dashboard — everyone else is pointed
// to the App Store.

// TODO: replace with the real App Store listing URL.
const APP_STORE_URL = 'https://apps.apple.com/app/cardindex/id000000000'

export default function UseAppPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        borderRadius: 20,
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        padding: 36,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 18 }}>
          Card<span style={{ color: 'var(--gold)' }}>Index</span>
        </div>

        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 18px',
          background: 'rgba(232,197,71,0.12)', border: '1px solid rgba(232,197,71,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>
          📱
        </div>

        <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px' }}>
          Please use the iOS app
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.7, margin: '0 0 24px' }}>
          CardIndex lives on your phone. Download the iOS app to search cards,
          see verdicts and track your collection.
        </p>

        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'var(--gold)', color: '#080810',
            padding: '12px 22px', borderRadius: 13, fontWeight: 700, fontSize: 15,
            textDecoration: 'none',
          }}
        >
          Download on the App Store
        </a>
      </div>
    </div>
  )
}
