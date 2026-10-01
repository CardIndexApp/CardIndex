/**
 * GET /api/cron/welcome-email
 *
 * Runs hourly. Finds users who signed up 20–28 hours ago and haven't
 * received a welcome email yet, then sends one via Resend.
 *
 * SETUP: add RESEND_API_KEY and RESEND_FROM_EMAIL to your environment.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key  = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL ?? 'CardIndex <hello@cardindex.gg>'
  if (!key) {
    console.warn('[welcome-email] RESEND_API_KEY not set — skipping')
    return NextResponse.json({ ok: true, skipped: true })
  }

  const admin = createAdminClient()
  const now   = new Date()
  const lo    = new Date(now.getTime() - 28 * 60 * 60 * 1000).toISOString()
  const hi    = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString()

  // Profiles created in the 20–28h window that haven't been emailed yet
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, email, created_at')
    .eq('welcome_email_sent', false)
    .gte('created_at', lo)
    .lte('created_at', hi)
    .limit(50)

  if (error) {
    console.error('[welcome-email] query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  for (const profile of profiles ?? []) {
    if (!profile.email) continue
    const html = buildEmail(profile.email)
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [profile.email],
          subject: 'One thing to try in CardIndex',
          html,
        }),
      })
      if (!res.ok) {
        console.error(`[welcome-email] Resend error for ${profile.id}:`, await res.text())
        continue
      }
      await admin.from('profiles').update({ welcome_email_sent: true }).eq('id', profile.id)
      sent++
    } catch (err) {
      console.error(`[welcome-email] fetch error for ${profile.id}:`, err)
    }
  }

  console.log(`[welcome-email] sent ${sent}/${(profiles ?? []).length}`)
  return NextResponse.json({ ok: true, sent, total: (profiles ?? []).length })
}

function buildEmail(email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>One thing to try in CardIndex</title>
</head>
<body style="margin:0;padding:0;background:#0c0c14;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c14;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                <span style="color:#ffffff;">Card</span><span style="color:#f5c842;">Index</span>
              </span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding-bottom:16px;">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;line-height:1.2;">
                Search for a card you own.
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding-bottom:28px;">
              <p style="margin:0;font-size:15px;color:#a0a0c0;line-height:1.6;">
                Most people open CardIndex, look around, and leave — because they haven't found their card yet.
                The moment you search for something you actually own, the app clicks.
              </p>
              <p style="margin:16px 0 0;font-size:15px;color:#a0a0c0;line-height:1.6;">
                Try typing a Pokémon name: <strong style="color:#ffffff;">Charizard</strong>, <strong style="color:#ffffff;">Pikachu</strong>, <strong style="color:#ffffff;">Umbreon</strong> — or whatever's in your binder.
                You'll see live prices across every grade in seconds.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding-bottom:40px;">
              <a href="https://card-index.app"
                 style="display:inline-block;background:#f5c842;color:#0c0c14;font-size:15px;font-weight:700;
                        text-decoration:none;padding:14px 28px;border-radius:10px;letter-spacing:-0.2px;">
                Open CardIndex →
              </a>
            </td>
          </tr>

          <!-- What you can track -->
          <tr>
            <td style="padding-bottom:32px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#16162a;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 16px;font-size:11px;font-weight:600;color:#6060a0;letter-spacing:0.06em;text-transform:uppercase;">
                      Once you find your cards
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#c0c0e0;">
                          ★&nbsp;&nbsp;<strong style="color:#ffffff;">Watchlist</strong> — follow price moves on cards you want
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#c0c0e0;">
                          📊&nbsp;&nbsp;<strong style="color:#ffffff;">Portfolio</strong> — track P&amp;L on cards you own (5 free)
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#c0c0e0;">
                          🔔&nbsp;&nbsp;<strong style="color:#ffffff;">Alerts</strong> — get notified when a price hits your target
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td>
              <p style="margin:0;font-size:12px;color:#404060;line-height:1.6;">
                You're receiving this because you signed up at card-index.app with ${email}.<br/>
                No more emails from us unless something important happens to your account.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
