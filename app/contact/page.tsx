'use client'
import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const GOLD = '#e8c547'
const INK = '#eeeef8'
const INK2 = '#b8b8d0'
const INK3 = '#50506a'
const GREEN = '#3de88a'
const BG = '#0b0c0f'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.08)'

const SUBJECTS = [
  'General enquiry',
  'Bug report',
  'Feature request',
  'Billing / subscription',
  'Data issue',
  'Press / partnership',
  'Other',
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: INK,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: INK3,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  marginBottom: 7,
  fontWeight: 600,
}

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: SUBJECTS[0], message: '' })
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    setLoading(false)
    setSent(true)
  }

  return (
    <>
      <Navbar />
      <main style={{ background: BG, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

        {/* Page header */}
        <div style={{ position: 'relative', paddingTop: 96, paddingBottom: 48, textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse at 50% 0%, rgba(232,197,71,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            {/* Eyebrow */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ height: 1, width: 28, background: `linear-gradient(to right, transparent, ${GOLD})` }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: GOLD }}>Get in touch</span>
              <div style={{ height: 1, width: 28, background: `linear-gradient(to left, transparent, ${GOLD})` }} />
            </div>
            <h1 style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 800, color: INK, letterSpacing: '-1.5px', marginBottom: 14, lineHeight: 1.1 }}>Contact Us</h1>
            <p style={{ fontSize: 15, color: INK2, lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>
              Questions, feedback, or spotted a data issue? We aim to respond within 1–2 business days.
            </p>
          </div>
        </div>

        {/* Form area */}
        <div style={{ flex: 1, maxWidth: 680, width: '100%', margin: '0 auto', padding: '0 24px 96px' }}>

          {sent ? (
            <div style={{ borderRadius: 20, padding: '48px 36px', background: 'rgba(61,232,138,0.05)', border: '1px solid rgba(61,232,138,0.18)', textAlign: 'center', boxShadow: '0 0 60px -20px rgba(61,232,138,0.2)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(61,232,138,0.12)', border: '1px solid rgba(61,232,138,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 22, color: GREEN }}>✓</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: INK, marginBottom: 10, letterSpacing: '-0.5px' }}>Message sent</h2>
              <p style={{ fontSize: 14, color: INK2, lineHeight: 1.7 }}>
                Thanks for reaching out. We'll get back to you at{' '}
                <strong style={{ color: INK }}>{form.email}</strong> shortly.
              </p>
              <button
                onClick={() => { setSent(false); setForm({ name: '', email: '', subject: SUBJECTS[0], message: '' }) }}
                style={{ marginTop: 24, fontSize: 13, color: GOLD, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Send another message →
              </button>
            </div>
          ) : (
            <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 20, padding: '36px 32px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Name + Email row */}
                <div className="contact-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {[
                    { label: 'Your name', key: 'name', type: 'text', placeholder: 'Jane Smith', required: true },
                    { label: 'Email address', key: 'email', type: 'email', placeholder: 'jane@example.com', required: true },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={labelStyle}>{f.label}</label>
                      <input
                        type={f.type}
                        required={f.required}
                        placeholder={f.placeholder}
                        value={(form as any)[f.key]}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        style={inputStyle}
                        onFocus={e => (e.currentTarget.style.borderColor = GOLD)}
                        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                      />
                    </div>
                  ))}
                </div>

                {/* Subject */}
                <div>
                  <label style={labelStyle}>Subject</label>
                  <select
                    value={form.subject}
                    onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2350506a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}
                    onFocus={e => (e.currentTarget.style.borderColor = GOLD)}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                  >
                    {SUBJECTS.map(s => <option key={s} value={s} style={{ background: '#141519' }}>{s}</option>)}
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label style={labelStyle}>Message</label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Tell us what's on your mind…"
                    value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.65 }}
                    onFocus={e => (e.currentTarget.style.borderColor = GOLD)}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: '13px 28px',
                      borderRadius: 12,
                      background: loading ? 'rgba(232,197,71,0.45)' : GOLD,
                      color: '#080810',
                      border: 'none',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: 14,
                      fontWeight: 700,
                      transition: 'opacity 0.15s',
                      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                    }}
                  >
                    {loading ? 'Sending…' : 'Send message →'}
                  </button>
                  <p style={{ fontSize: 12, color: INK3, margin: 0 }}>
                    Or email{' '}
                    <a href="mailto:hello@card-index.app" style={{ color: GOLD, textDecoration: 'none' }}>hello@card-index.app</a>
                  </p>
                </div>

              </form>
            </div>
          )}
        </div>

        <Footer />
      </main>

      <style>{`
        @media (max-width: 560px) {
          .contact-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}
