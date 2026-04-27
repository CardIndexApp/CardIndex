'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import BetaModal from '@/components/BetaModal'
import { createClient } from '@/lib/supabase/client'

const tiers = [
  {
    name: 'Free',
    tagline: 'Enough to explore and understand the platform',
    monthlyPrice: 0,
    annualPrice: 0,
    cta: 'Get started free',
    highlight: false,
    features: [
      { text: 'Basic card search', included: true },
      { text: 'Basic pricing information', included: true },
      { text: 'Recently viewed cards on home page', included: true },
      { text: 'Watchlist (up to 5 cards)', included: true },
      { text: 'Price history charts', included: false },
      { text: 'Trend indicators', included: false },
      { text: 'Saved searches', included: false },
      { text: 'Email alerts', included: false },
      { text: 'Portfolio & P&L tracking', included: false },
      { text: 'Real-time alerts', included: false },
    ],
  },
  {
    name: 'Standard',
    tagline: 'For collectors who want to track and act on the market',
    monthlyPrice: 9,
    annualPrice: 7,
    cta: 'Start Standard',
    highlight: true,
    badge: 'Most popular',
    features: [
      { text: 'Everything in Free', included: true },
      { text: 'Watchlist (up to 30 cards)', included: true },
      { text: 'Full price history charts', included: true },
      { text: 'Trend indicators (% change, momentum)', included: true },
      { text: 'Saved searches', included: true },
      { text: 'Email alerts for price movement', included: true },
      { text: 'Faster data refresh', included: true },
      { text: 'Advanced analytics', included: false },
      { text: 'Portfolio & P&L tracking', included: false },
      { text: 'Real-time alerts', included: false },
    ],
  },
  {
    name: 'Pro',
    tagline: 'For serious investors managing large collections',
    monthlyPrice: 19,
    annualPrice: 15,
    cta: 'Start Pro',
    highlight: false,
    features: [
      { text: 'Everything in Standard', included: true },
      { text: 'Watchlist (up to 100 cards)', included: true },
      { text: 'Real-time price alerts', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Portfolio tracking', included: true },
      { text: 'Profit & loss reporting', included: true },
      { text: 'Priority data refresh', included: true },
      { text: 'Early access to new features', included: true },
      { text: 'Priority support', included: true },
      { text: 'Data export (CSV)', included: true },
      { text: 'Portfolio import via CSV upload', included: true },
    ],
  },
]

const faqs = [
  {
    q: 'Can I switch plans later?',
    a: 'Yes — you can upgrade, downgrade, or cancel at any time. Changes take effect at the start of your next billing cycle.',
  },
  {
    q: 'What\'s the difference between Standard and Pro?',
    a: 'Standard gives you the tools to track and act on the market — watchlists, price charts, trend indicators, and email alerts. Pro adds real-time alerts, advanced analytics, and full portfolio and profit & loss tracking for serious investors.',
  },
  {
    q: 'Can I cancel my subscription?',
    a: 'Yes — you can cancel at any time from your account settings. Your plan stays active until the end of the current billing period, then reverts to Free.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit and debit cards. Annual plans are charged upfront and save you up to 22%.',
  },
]

type UserTier = 'free' | 'standard' | 'pro' | null

export default function Pricing() {
  const [annual, setAnnual] = useState(false)
  const [showBeta, setShowBeta] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [userTier, setUserTier] = useState<UserTier>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const { data: prof } = await supabase
        .from('profiles').select('tier').eq('id', data.user.id).single()
      setUserTier((prof?.tier ?? 'free') as UserTier)
    })
  }, [])

  // Map tier name + billing cycle → Stripe price ID
  const PRICE_IDS: Record<string, Record<string, string>> = {
    standard: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD_MONTHLY ?? '',
      annual:  process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD_ANNUAL  ?? '',
    },
    pro: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? '',
      annual:  process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL  ?? '',
    },
  }

  async function handleCheckout(tierName: string) {
    if (!userId) { setShowBeta(true); return }
    setRequesting(true)
    setCheckoutError(null)
    try {
      const cycle = annual ? 'annual' : 'monthly'
      const priceId = PRICE_IDS[tierName.toLowerCase()]?.[cycle]
      console.log('[checkout] tierName:', tierName, 'cycle:', cycle, 'priceId:', priceId)
      if (!priceId) {
        setCheckoutError('Price ID not configured — check Vercel environment variables.')
        return
      }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const json = await res.json()
      console.log('[checkout] response:', json)
      if (json.url) {
        window.location.href = json.url
      } else {
        setCheckoutError(json.error ?? 'Something went wrong. Please try again.')
      }
    } catch (err) {
      console.error('[checkout] error:', err)
      setCheckoutError('Network error — please try again.')
    } finally {
      setRequesting(false)
    }
  }

  return (
    <>
      <Navbar />
      {showBeta && <BetaModal onClose={() => setShowBeta(false)} />}
      <main style={{ paddingTop: 72, paddingBottom: 96, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px 0' }}>

          {/* Checkout error banner */}
          {checkoutError && (
            <div style={{ marginBottom: 24, padding: '14px 20px', borderRadius: 12, background: 'rgba(232,82,74,0.08)', border: '1px solid rgba(232,82,74,0.25)', fontSize: 13, color: '#ff6b6b', textAlign: 'center' }}>
              {checkoutError}
            </div>
          )}

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>Pricing</p>
            <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1.5px', marginBottom: 14, lineHeight: 1.05 }}>
              Simple, transparent pricing
            </h1>
            <p style={{ fontSize: 15, color: 'var(--ink2)', maxWidth: 440, margin: '0 auto 32px', lineHeight: 1.7 }}>
              Start free. Upgrade when you need more. No hidden fees.
            </p>

            {/* Billing toggle */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, borderRadius: 99, padding: '4px 6px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <button
                onClick={() => setAnnual(false)}
                style={{ padding: '6px 18px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: !annual ? 'var(--surface2)' : 'transparent', color: !annual ? 'var(--ink)' : 'var(--ink3)', transition: 'all 0.15s' }}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                style={{ padding: '6px 18px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: annual ? 'var(--surface2)' : 'transparent', color: annual ? 'var(--ink)' : 'var(--ink3)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                Annual
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', background: 'rgba(61,232,138,0.12)', border: '1px solid rgba(61,232,138,0.25)', borderRadius: 99, padding: '1px 7px', letterSpacing: 0.5 }}>
                  SAVE 22%
                </span>
              </button>
            </div>
          </div>

          {/* Tier cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 80, alignItems: 'stretch' }}>
            {tiers.map((tier, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 20,
                  padding: 28,
                  background: tier.highlight ? 'var(--surface)' : 'var(--surface)',
                  border: tier.highlight ? '1px solid rgba(232,197,71,0.4)' : '1px solid var(--border)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: tier.highlight ? '0 0 40px rgba(232,197,71,0.06)' : 'none',
                }}
              >
                {tier.badge && userTier !== tier.name.toLowerCase() && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--gold)', color: '#080810', fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: '3px 12px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                    {tier.badge.toUpperCase()}
                  </div>
                )}
                {userTier === tier.name.toLowerCase() && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: '#080810', fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: '3px 12px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                    YOUR PLAN
                  </div>
                )}

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{tier.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>{tier.tagline}</div>
                </div>

                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                    <span className="font-num" style={{ fontSize: 44, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-2px', lineHeight: 1 }}>
                      ${annual ? tier.annualPrice : tier.monthlyPrice}
                    </span>
                    {tier.monthlyPrice > 0 && (
                      <span style={{ fontSize: 13, color: 'var(--ink3)', paddingBottom: 6 }}>/mo</span>
                    )}
                  </div>
                  {tier.monthlyPrice > 0 && annual && (
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>
                      Billed ${tier.annualPrice * 12}/year
                    </div>
                  )}
                  {tier.monthlyPrice === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>Free forever</div>
                  )}
                </div>

                {(() => {
                  const isCurrent = userTier === tier.name.toLowerCase()
                  const isFree = tier.name === 'Free'
                  const label = isCurrent
                    ? 'Your current plan'
                    : requesting
                    ? 'Redirecting…'
                    : tier.cta + ' →'
                  return (
                    <button
                      disabled={isCurrent || requesting}
                      onClick={() => isFree ? null : handleCheckout(tier.name)}
                      style={{
                        width: '100%',
                        padding: '11px 0',
                        borderRadius: 12,
                        border: tier.highlight ? 'none' : '1px solid var(--border2)',
                        background: isCurrent
                          ? 'rgba(255,255,255,0.04)'
                          : tier.highlight ? 'var(--gold)' : 'transparent',
                        color: isCurrent
                          ? 'var(--ink3)'
                          : tier.highlight ? '#080810' : 'var(--ink)',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: isCurrent || isFree ? 'default' : 'pointer',
                        marginBottom: 28,
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.opacity = '0.85' }}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      {label}
                    </button>
                  )
                })()}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {tier.features.map((f, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                        background: f.included ? 'rgba(61,232,138,0.12)' : 'rgba(255,255,255,0.04)',
                        color: f.included ? 'var(--green)' : 'var(--ink3)',
                        border: f.included ? '1px solid rgba(61,232,138,0.25)' : '1px solid rgba(255,255,255,0.06)',
                      }}>
                        {f.included ? '✓' : '–'}
                      </span>
                      <span style={{ fontSize: 13, color: f.included ? 'var(--ink2)' : 'var(--ink3)' }}>{f.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Feature comparison note */}
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 99, padding: '8px 20px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: 'var(--ink2)' }}>Cancel anytime — no lock-in contracts</span>
            </div>
          </div>

          {/* FAQ */}
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>Questions about pricing</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderRadius: 16, overflow: 'hidden', background: 'var(--border)' }}>
              {faqs.map((item, i) => (
                <div key={i} style={{ background: 'var(--surface)' }}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{item.q}</span>
                    <span style={{ fontSize: 18, color: 'var(--ink3)', flexShrink: 0, transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'none', display: 'inline-block' }}>+</span>
                  </button>
                  {openFaq === i && (
                    <div style={{ padding: '0 22px 18px' }}>
                      <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.75 }}>{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
