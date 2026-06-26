import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = { title: 'Privacy Policy — CardIndex' }

const GOLD = '#e8c547'
const INK = '#eeeef8'
const INK2 = '#b8b8d0'
const INK3 = '#50506a'
const BG = '#0b0c0f'

const SECTIONS = [
  {
    title: 'Who We Are',
    body: `CardIndex ("we", "us", "our") operates card-index.app, a market intelligence platform for trading card collectors. This policy explains how we collect, use, and protect your personal data when you use our Service.`,
  },
  {
    title: 'Information We Collect',
    body: `When you create an account we collect your email address and any profile information you provide. When you use the Service we collect usage data including searches performed, cards added to your watchlist, and pages visited. If you subscribe to a paid plan we collect billing information via Stripe — we do not store full card numbers or payment details on our servers. We also collect standard server log data including IP addresses and browser information.`,
  },
  {
    title: 'How We Use Your Data',
    body: `We use your data to provide and improve the Service, personalise your experience (e.g. syncing your watchlist across devices), send transactional emails such as account verification and payment receipts, send optional marketing emails if you have opted in, enforce our Terms and prevent abuse, and comply with legal obligations.`,
  },
  {
    title: 'Data Sharing',
    body: `We do not sell your personal data. We share data only with trusted third-party processors necessary to operate the Service: Supabase (database and authentication), Stripe (payment processing), and email delivery providers. All processors are contractually required to handle your data in accordance with applicable data protection law.`,
  },
  {
    title: 'Search Data',
    body: `Searches you perform on CardIndex are logged to improve our search cache and power features such as "Popular right now." Search logs may be associated with your account if you are signed in, or stored anonymously if you are not. Aggregated and anonymised search data may be used to improve the Service.`,
  },
  {
    title: 'Cookies',
    body: `We use strictly necessary cookies to maintain your session and authentication state. We do not use third-party advertising or tracking cookies. You can control cookie settings in your browser, but disabling session cookies will prevent you from staying logged in.`,
  },
  {
    title: 'Data Retention',
    body: `We retain your account data for as long as your account is active. If you delete your account, your personal data will be deleted within 30 days, except where retention is required by law. Anonymised usage data may be retained indefinitely for analytical purposes.`,
  },
  {
    title: 'Your Rights',
    body: `Depending on your location you may have the right to access, correct, or delete your personal data, object to or restrict certain processing, and request data portability. To exercise these rights please contact us at hello@card-index.app. We will respond within 30 days.`,
  },
  {
    title: 'Security',
    body: `We implement appropriate technical and organisational measures to protect your data, including encrypted connections (TLS), hashed passwords, and row-level security on our database. No system is completely secure, and we cannot guarantee absolute security.`,
  },
  {
    title: 'Children',
    body: `CardIndex is not directed at children under the age of 13. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data please contact us and we will delete it promptly.`,
  },
  {
    title: 'Changes to This Policy',
    body: `We may update this Privacy Policy periodically. We will notify you of significant changes via email or a notice on the platform. Continued use of the Service after changes are posted constitutes acceptance of the updated policy.`,
  },
  {
    title: 'Contact',
    body: `For privacy-related questions or to exercise your rights, contact us at hello@card-index.app or via the Contact page.`,
  },
]

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main style={{ background: BG, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

        {/* Header */}
        <div style={{ position: 'relative', paddingTop: 96, paddingBottom: 48, textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse at 50% 0%, rgba(232,197,71,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ height: 1, width: 28, background: `linear-gradient(to right, transparent, ${GOLD})` }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: GOLD }}>Legal</span>
              <div style={{ height: 1, width: 28, background: `linear-gradient(to left, transparent, ${GOLD})` }} />
            </div>
            <h1 style={{ fontSize: 'clamp(30px,5vw,44px)', fontWeight: 800, color: INK, letterSpacing: '-1.5px', marginBottom: 12, lineHeight: 1.1 }}>Privacy Policy</h1>
            <p style={{ fontSize: 13, color: INK3 }}>Last updated: April 2026</p>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, maxWidth: 1040, width: '100%', margin: '0 auto', padding: '0 24px 96px', display: 'grid' }} className="legal-layout">

          {/* TOC sidebar */}
          <nav className="legal-toc" style={{ display: 'none' }}>
            <div style={{ position: 'sticky', top: 96, padding: '24px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
              <p style={{ fontSize: 10, color: INK3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, fontWeight: 600 }}>Contents</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SECTIONS.map((s, i) => (
                  <a key={i} href={`#section-${i}`} className="legal-toc-link">
                    <span style={{ color: GOLD, marginRight: 6, fontWeight: 700 }}>{String(i + 1).padStart(2, '0')}</span>{s.title}
                  </a>
                ))}
              </div>
            </div>
          </nav>

          {/* Sections */}
          <div>
            {SECTIONS.map((s, i) => (
              <div key={i} id={`section-${i}`} style={{ paddingBottom: 32, marginBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 1, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: INK, letterSpacing: '-0.3px' }}>{s.title}</h2>
                </div>
                <p style={{ fontSize: 14, color: INK2, lineHeight: 1.85, paddingLeft: 28 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        <Footer />
      </main>

      <style>{`
        .legal-layout { grid-template-columns: 1fr; }
        @media (min-width: 860px) {
          .legal-layout { grid-template-columns: 220px 1fr; gap: 48px; align-items: start; }
          .legal-toc { display: block !important; }
        }
        .legal-toc-link { font-size: 12px; color: #50506a; text-decoration: none; line-height: 1.4; transition: color 0.15s; }
        .legal-toc-link:hover { color: #b8b8d0; }
      `}</style>
    </>
  )
}
