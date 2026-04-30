import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 72, paddingBottom: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 96px', flex: 1 }}>

          <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Legal</p>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 8 }}>Privacy Policy</h1>
          <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 48 }}>Last updated: April 2026</p>

          {[
            {
              title: '1. Who We Are',
              body: `CardIndex ("we", "us", "our") operates card-index.app, a market intelligence platform for trading card collectors. This policy explains how we collect, use, and protect your personal data when you use our Service.`,
            },
            {
              title: '2. Information We Collect',
              body: `When you create an account we collect your email address and any profile information you provide. When you use the Service we collect usage data including searches performed, cards added to your watchlist, and pages visited. If you subscribe to a paid plan we collect billing information via Stripe — we do not store full card numbers or payment details on our servers. We also collect standard server log data including IP addresses and browser information.`,
            },
            {
              title: '3. How We Use Your Data',
              body: `We use your data to provide and improve the Service, personalise your experience (e.g. syncing your watchlist across devices), send transactional emails such as account verification and payment receipts, send optional marketing emails if you have opted in, enforce our Terms and prevent abuse, and comply with legal obligations.`,
            },
            {
              title: '4. Data Sharing',
              body: `We do not sell your personal data. We share data only with trusted third-party processors necessary to operate the Service: Supabase (database and authentication), Stripe (payment processing), and email delivery providers. All processors are contractually required to handle your data in accordance with applicable data protection law.`,
            },
            {
              title: '5. Search Data',
              body: `Searches you perform on CardIndex are logged to improve our search cache and power features such as "Popular right now." Search logs may be associated with your account if you are signed in, or stored anonymously if you are not. Aggregated and anonymised search data may be used to improve the Service.`,
            },
            {
              title: '6. Cookies',
              body: `We use strictly necessary cookies to maintain your session and authentication state. We do not use third-party advertising or tracking cookies. You can control cookie settings in your browser, but disabling session cookies will prevent you from staying logged in.`,
            },
            {
              title: '7. Data Retention',
              body: `We retain your account data for as long as your account is active. If you delete your account, your personal data will be deleted within 30 days, except where retention is required by law. Anonymised usage data may be retained indefinitely for analytical purposes.`,
            },
            {
              title: '8. Your Rights',
              body: `Depending on your location you may have the right to access, correct, or delete your personal data, object to or restrict certain processing, and request data portability. To exercise these rights please contact us at hello@card-index.app. We will respond within 30 days.`,
            },
            {
              title: '9. Security',
              body: `We implement appropriate technical and organisational measures to protect your data, including encrypted connections (TLS), hashed passwords, and row-level security on our database. No system is completely secure, and we cannot guarantee absolute security.`,
            },
            {
              title: '10. Children',
              body: `CardIndex is not directed at children under the age of 13. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data please contact us and we will delete it promptly.`,
            },
            {
              title: '11. Changes to This Policy',
              body: `We may update this Privacy Policy periodically. We will notify you of significant changes via email or a notice on the platform. Continued use of the Service after changes are posted constitutes acceptance of the updated policy.`,
            },
            {
              title: '12. Contact',
              body: `For privacy-related questions or to exercise your rights, contact us at hello@card-index.app or via the Contact page.`,
            },
          ].map((section, i) => (
            <div key={i} style={{ marginBottom: 36, paddingBottom: 36, borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>{section.title}</h2>
              <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8 }}>{section.body}</p>
            </div>
          ))}
        </div>
        <Footer />
      </main>
    </>
  )
}
