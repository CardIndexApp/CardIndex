import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 72, paddingBottom: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 96px', flex: 1 }}>

          <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Legal</p>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 8 }}>Terms & Conditions</h1>
          <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 48 }}>Last updated: April 2026</p>

          {[
            {
              title: '1. Acceptance of Terms',
              body: `By accessing or using CardIndex ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the Service. CardIndex is currently in beta and features, pricing, and functionality may change without notice.`,
            },
            {
              title: '2. Data Disclaimer',
              body: `All price data, market intelligence scores, historical charts, and any other financial or valuation information displayed on CardIndex is provided for informational and display purposes only. CardIndex makes no representations or warranties about the accuracy, completeness, or reliability of this data. You should not rely on CardIndex data to make buying, selling, or investment decisions without conducting your own independent research.`,
            },
            {
              title: '3. No Financial Advice',
              body: `Nothing on CardIndex constitutes financial, investment, or trading advice. CardIndex is an informational tool only. Any decisions you make regarding the purchase or sale of trading cards are made entirely at your own risk. CardIndex accepts no liability for losses arising from decisions made based on information displayed on the platform.`,
            },
            {
              title: '4. User Accounts',
              body: `You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorised use of your account. CardIndex reserves the right to terminate accounts that violate these terms or are used for abusive or fraudulent activity.`,
            },
            {
              title: '5. Subscriptions and Billing',
              body: `Paid subscription tiers (Standard and Pro) are billed on a monthly or annual basis as selected at checkout. You may cancel your subscription at any time; cancellation takes effect at the end of the current billing period. No refunds are issued for partial periods. Prices are subject to change with 30 days notice.`,
            },
            {
              title: '6. Intellectual Property',
              body: `All content, design, code, and branding on CardIndex is the property of CardIndex or its licensors. Pokémon card imagery is property of The Pokémon Company and Nintendo. eBay data is sourced under eBay's developer programme terms. You may not reproduce, distribute, or create derivative works from CardIndex content without express written permission.`,
            },
            {
              title: '7. Third-Party Services',
              body: `CardIndex integrates with third-party services including eBay and the Pokémon TCG API. We are not responsible for the availability, accuracy, or content of these third-party services. Use of these integrations is subject to the respective third-party terms of service.`,
            },
            {
              title: '8. Limitation of Liability',
              body: `To the fullest extent permitted by law, CardIndex and its operators shall not be liable for any indirect, incidental, consequential, or punitive damages arising from your use of the Service. Our total liability to you for any claim shall not exceed the amount you paid to CardIndex in the twelve months preceding the claim.`,
            },
            {
              title: '9. Changes to Terms',
              body: `We may update these Terms from time to time. Continued use of the Service after changes are posted constitutes acceptance of the revised Terms. We will notify users of material changes via email or a notice on the platform.`,
            },
            {
              title: '10. Contact',
              body: `If you have questions about these Terms, please contact us via the Contact page or email hello@card-index.app.`,
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
