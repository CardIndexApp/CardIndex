/**
 * GET /api/cron/notify-trial-expiry
 * Fires daily at 10:00 UTC.
 * Sends trial expiry reminder emails at day 5 (2 days left) and day 6 (1 day left).
 * Uses Resend for email delivery.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key  = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL ?? 'CardIndex <noreply@cardindex.gg>'
  if (!key) {
    console.warn('[notify-trial-expiry] RESEND_API_KEY not set — skipping')
    return NextResponse.json({ ok: true, skipped: true })
  }

  const admin = createAdminClient()
  const now = new Date()

  // Find users whose trial ends in 1 or 2 days (inclusive 24h windows)
  const in1dayStart = new Date(now.getTime() + 0 * 86400000).toISOString()
  const in1dayEnd   = new Date(now.getTime() + 1 * 86400000).toISOString()
  const in2dayStart = new Date(now.getTime() + 1 * 86400000).toISOString()
  const in2dayEnd   = new Date(now.getTime() + 2 * 86400000).toISOString()

  const { data: expiringUsers } = await admin
    .from('profiles')
    .select('id, email, trial_ends_at, tier')
    .or(`trial_ends_at.gte.${in1dayStart},trial_ends_at.lte.${in2dayEnd}`)
    .not('trial_ends_at', 'is', null)
    .neq('tier', 'standard')
    .neq('tier', 'pro')

  if (!expiringUsers?.length) return NextResponse.json({ ok: true, sent: 0 })

  const log: string[] = []

  for (const u of expiringUsers) {
    if (!u.email || !u.trial_ends_at) continue

    const endsAt = new Date(u.trial_ends_at)
    const msLeft = endsAt.getTime() - now.getTime()
    const daysLeft = Math.ceil(msLeft / 86400000)

    if (daysLeft < 1 || daysLeft > 2) continue

    // Check we haven't already sent this type in the last 23h (dedup via notification_log)
    const logType = `trial_expiry_${daysLeft}d`
    const dedupeWindow = new Date(now.getTime() - 23 * 3600000).toISOString()
    const { data: recent } = await admin
      .from('notification_log')
      .select('id')
      .eq('user_id', u.id)
      .eq('type', logType)
      .gte('created_at', dedupeWindow)
      .limit(1)

    if (recent?.length) { log.push(`skip:${u.id}:already_sent`); continue }

    const subject = daysLeft === 1
      ? 'Your CardIndex Pro trial ends tomorrow'
      : 'Your CardIndex Pro trial ends in 2 days'

    const headline = daysLeft === 1
      ? 'Last chance — trial ends tomorrow'
      : 'Your Pro trial ends in 2 days'

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#09090f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090f;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0"
             style="background:#13131f;border:1px solid #2a2a3d;border-radius:20px;width:100%;max-width:500px;padding:44px 36px;">
        <tr><td>
          <div style="text-align:center;margin-bottom:32px;">
            <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#e8e8f0;">
              Card<span style="color:#e8c547;">Index</span>
            </span>
          </div>

          <div style="text-align:center;margin-bottom:20px;">
            <div style="display:inline-block;width:52px;height:52px;border-radius:14px;background:rgba(232,197,71,0.08);border:1px solid rgba(232,197,71,0.2);text-align:center;line-height:52px;font-size:24px;">⏳</div>
          </div>

          <h1 style="text-align:center;margin:0 0 12px;font-size:22px;font-weight:800;color:#e8e8f0;letter-spacing:-0.5px;">
            ${headline}
          </h1>

          <p style="text-align:center;margin:0 0 28px;font-size:14px;color:#a0a0c0;line-height:1.7;max-width:360px;margin-left:auto;margin-right:auto;">
            Your 7-day Pro trial expires on <strong style="color:#e8c547;">${endsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</strong>.
            Upgrade now to keep access to everything you've been using.
          </p>

          <div style="background:#1a1a2e;border:1px solid #2a2a3d;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
            <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a0a0c0;">What you'll keep</p>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div style="font-size:13px;color:#e8e8f0;">📈 <strong>Price history</strong> — track trends over time</div>
              <div style="font-size:13px;color:#e8e8f0;">📊 <strong>Trend indicators</strong> — rising &amp; falling signals</div>
              <div style="font-size:13px;color:#e8e8f0;">💼 <strong>Portfolio tracking</strong> — P&amp;L and valuations</div>
              <div style="font-size:13px;color:#e8e8f0;">🔎 <strong>Price Check</strong> — compare your price to market</div>
            </div>
          </div>

          <div style="text-align:center;margin-bottom:32px;">
            <a href="https://cardindex.gg/pricing"
               style="display:inline-block;padding:14px 36px;background:#e8c547;color:#09090f;font-size:15px;font-weight:800;border-radius:12px;text-decoration:none;letter-spacing:-0.2px;">
              Upgrade to Pro
            </a>
          </div>

          <div style="height:1px;background:#2a2a3d;margin-bottom:24px;"></div>

          <p style="text-align:center;margin:0;font-size:11px;color:#3e3e5a;line-height:1.7;">
            CardIndex · Card Market Intelligence<br />
            <a href="https://cardindex.gg/settings" style="color:#3e3e5a;">Manage notifications</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [u.email], subject, html }),
      })

      if (res.ok) {
        await admin.from('notification_log').insert({ user_id: u.id, type: logType, payload: { daysLeft } })
        log.push(`sent:${u.id}:${daysLeft}d`)
      } else {
        const body = await res.text()
        console.error('[notify-trial-expiry] Resend error', res.status, body)
        log.push(`error:${u.id}:${res.status}`)
      }
    } catch (err) {
      console.error('[notify-trial-expiry] fetch error', err)
      log.push(`error:${u.id}:network`)
    }
  }

  return NextResponse.json({ ok: true, sent: log.filter(l => l.startsWith('sent')).length, log })
}
