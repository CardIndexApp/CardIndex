'use client'
import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const SUBJECTS = [
  'General enquiry',
  'Bug report',
  'Feature request',
  'Billing / subscription',
  'Data issue',
  'Press / partnership',
  'Other',
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: SUBJECTS[0], message: '' })
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // TODO: wire to a form handler (e.g. Resend, Formspree, or a /api/contact route)
    await new Promise(r => setTimeout(r, 900))
    setLoading(false)
    setSent(true)
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 72, paddingBottom: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '56px 24px 96px', flex: 1 }}>

          <p style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Get in touch</p>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px', marginBottom: 8 }}>Contact Us</h1>
          <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.7, marginBottom: 48 }}>
            Questions, feedback, or spotted a data issue? We'd love to hear from you. We aim to respond within 1–2 business days.
          </p>

          {sent ? (
            <div style={{ borderRadius: 16, padding: '40px 32px', background: 'rgba(61,232,138,0.06)', border: '1px solid rgba(61,232,138,0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Message sent</h2>
              <p style={{ fontSize: 13, color: 'var(--ink2)' }}>Thanks for reaching out. We'll get back to you at <strong>{form.email}</strong> shortly.</p>
              <button
                onClick={() => { setSent(false); setForm({ name: '', email: '', subject: SUBJECTS[0], message: '' }) }}
                style={{ marginTop: 24, fontSize: 13, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Name + Email row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { label: 'Your name', key: 'name', type: 'text', placeholder: 'Jane Smith', required: true },
                  { label: 'Email address', key: 'email', type: 'email', placeholder: 'jane@example.com', required: true },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 }}>{f.label}</label>
                    <input
                      type={f.type}
                      required={f.required}
                      placeholder={f.placeholder}
                      value={(form as any)[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                    />
                  </div>
                ))}
              </div>

              {/* Subject */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 }}>Subject</label>
                <select
                  value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                >
                  {SUBJECTS.map(s => <option key={s} value={s} style={{ background: 'var(--surface)' }}>{s}</option>)}
                </select>
              </div>

              {/* Message */}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 }}>Message</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Tell us what's on your mind…"
                  value={form.message}
                  onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 13, outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ padding: '13px 32px', borderRadius: 12, background: loading ? 'rgba(232,197,71,0.5)' : 'var(--gold)', color: '#080810', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, alignSelf: 'flex-start', transition: 'all 0.15s' }}
              >
                {loading ? 'Sending…' : 'Send message →'}
              </button>

              <p style={{ fontSize: 11, color: 'var(--ink3)' }}>
                Or email us directly at <a href="mailto:hello@card-index.app" style={{ color: 'var(--gold)', textDecoration: 'none' }}>hello@card-index.app</a>
              </p>
            </form>
          )}
        </div>
        <Footer />
      </main>
    </>
  )
}
