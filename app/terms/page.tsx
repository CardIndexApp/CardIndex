import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = { title: 'Terms & Conditions — CardIndex' }

const GOLD = '#e8c547'
const INK = '#eeeef8'
const INK2 = '#b8b8d0'
const INK3 = '#50506a'
const BG = '#0b0c0f'

const SECTIONS = [
  {
    title: 'Acceptance of Terms',
    body: `By accessing or using CardIndex ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the Service. CardIndex is currently in beta and features, pricing, and functionality may change without notice.`,
  },
  {
    title: 'Data Disclaimer',
    body: `All price data, market intelligence scores, signals, buy/hold/sell verdicts, price projections, historical charts, and any other valuation information displayed on CardIndex is provided for informational and display purposes only. It is generated algorithmically from market data and may be inaccurate, incomplete, or out of date. CardIndex makes no representations or warranties about the accuracy, completeness, or reliability of this data. Card values can go down as well as up, and past performance is not indicative of future results. You should not rely on CardIndex data to make buying, selling, or investment decisions without conducting your own independent research.`,
  },
  {
    title: 'No Financial Advice',
    body: `Nothing on CardIndex — including its scores, signals, verdicts, projections, valuations, or any other content — constitutes financial, investment, or trading advice, or a recommendation to buy or sell any item. CardIndex is an informational tool only and does not take your individual circumstances into account. Any decisions you make regarding the purchase or sale of trading cards are made entirely at your own risk. CardIndex accepts no liability for losses arising from decisions made based on information displayed on the platform.`,
  },
  {
    title: 'User Accounts',
    body: `You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorised use of your account. CardIndex reserves the right to terminate accounts that violate these terms or are used for abusive or fraudulent activity.`,
  },
  {
    title: 'Subscriptions and Billing',
    body: `Paid subscription tiers (Standard and Pro) are billed on a monthly or annual basis as selected at checkout. You may cancel your subscription at any time; cancellation takes effect at the end of the current billing period. No refunds are issued for partial periods. Prices are subject to change with 30 days notice.`,
  },
  {
    title: 'Intellectual Property',
    body: `All content, design, code, and branding on CardIndex is the property of CardIndex or its licensors. Pokémon card imagery is property of The Pokémon Company and Nintendo. eBay data is sourced under eBay's developer programme terms. You may not reproduce, distribute, or create derivative works from CardIndex content without express written permission.`,
  },
  {
    title: 'Third-Party Services',
    body: `CardIndex integrates with third-party services including eBay and the Pokémon TCG API. We are not responsible for the availability, accuracy, or content of these third-party services. Use of these integrations is subject to the respective third-party terms of service.`,
  },
  {
    title: 'Limitation of Liability',
    body: `To the fullest extent permitted by law, CardIndex and its operators shall not be liable for any indirect, incidental, consequential, or punitive damages arising from your use of the Service. Our total liability to you for any claim shall not exceed the amount you paid to CardIndex in the twelve months preceding the claim.`,
  },
  {
    title: 'Changes to Terms',
    body: `We may update these Terms from time to time. Continued use of the Service after changes are posted constitutes acceptance of the revised Terms. We will notify users of material changes via email or a notice on the platform.`,
  },
  {
    title: 'Contact',
    body: `If you have questions about these Terms, please contact us via the Contact page or email hello@card-index.app.`,
  },
]

export default function TermsPage() {
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
            <h1 style={{ fontSize: 'clamp(30px,5vw,44px)', fontWeight: 800, color: INK, letterSpacing: '-1.5px', marginBottom: 12, lineHeight: 1.1 }}>Terms &amp; Conditions</h1>
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
