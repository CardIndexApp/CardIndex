/**
 * POST /api/auth/password-changed
 *
 * Sends a security notification email to the authenticated user after a
 * successful password change. Silently no-ops if RESEND_API_KEY is not set.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL ?? 'CardIndex <noreply@cardindex.gg>'

  // Resolve the authenticated user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  // If Resend is not configured yet, skip silently rather than erroring
  if (!key) {
    console.warn('[password-changed] RESEND_API_KEY not set — skipping notification email')
    return NextResponse.json({ ok: true, skipped: true })
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Your CardIndex password was changed</title>
</head>
<body style="margin:0;padding:0;background:#09090f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090f;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0"
             style="background:#13131f;border:1px solid #2a2a3d;border-radius:20px;width:100%;max-width:500px;padding:44px 36px;">
        <tr><td>
          <!-- Logo -->
          <div style="text-align:center;margin-bottom:32px;">
            <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#e8e8f0;">
              Card<span style="color:#e8c547;">Index</span>
            </span>
          </div>

          <!-- Icon -->
          <div style="text-align:center;margin-bottom:20px;">
            <div style="display:inline-block;width:52px;height:52px;border-radius:14px;background:rgba(232,197,71,0.08);border:1px solid rgba(232,197,71,0.2);text-align:center;line-height:52px;font-size:24px;">🔒</div>
          </div>

          <!-- Heading -->
          <h1 style="text-align:center;margin:0 0 12px;font-size:22px;font-weight:800;color:#e8e8f0;letter-spacing:-0.5px;">
            Password changed
          </h1>

          <!-- Body -->
          <p style="text-align:center;margin:0 0 28px;font-size:14px;color:#a0a0c0;line-height:1.7;max-width:360px;margin-left:auto;margin-right:auto;">
            The password for your CardIndex account (<strong style="color:#c8c8e0;">${user.email}</strong>) was just changed.
            If this was you, no further action is needed.
          </p>

          <!-- Warning box -->
          <div style="background:rgba(232,82,74,0.06);border:1px solid rgba(232,82,74,0.2);border-radius:12px;padding:16px 20px;margin-bottom:32px;">
            <p style="margin:0;font-size:13px;color:#e8524a;line-height:1.65;text-align:center;">
              <strong>Wasn't you?</strong> Contact us immediately at
              <a href="mailto:support@cardindex.gg" style="color:#e8c547;text-decoration:none;">support@cardindex.gg</a>
              to secure your account.
            </p>
          </div>

          <!-- Divider -->
          <div style="height:1px;background:#2a2a3d;margin-bottom:24px;"></div>

          <!-- Footer -->
          <p style="text-align:center;margin:0;font-size:11px;color:#3e3e5a;line-height:1.7;">
            CardIndex · Card Market Intelligence<br />
            You're receiving this because your account password was changed.
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
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject: 'Your CardIndex password was changed',
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[password-changed] Resend error', res.status, body)
      return NextResponse.json({ ok: false, error: 'Email send failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[password-changed] fetch error', err)
    return NextResponse.json({ ok: false, error: 'Network error' }, { status: 500 })
  }
}
