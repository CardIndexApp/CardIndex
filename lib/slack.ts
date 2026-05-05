/**
 * Slack webhook helpers.
 * Set SLACK_WEBHOOK_URL in your environment variables.
 * Optionally set SLACK_WEBHOOK_REPORTS_URL for a separate reports channel.
 * Falls back to SLACK_WEBHOOK_URL if the specific one isn't set.
 */

async function post(webhookUrl: string, payload: object): Promise<void> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[slack] webhook returned ${res.status}:`, text)
    }
  } catch (err) {
    console.error('[slack] webhook fetch failed:', err)
  }
}

export async function notifyNewUser(user: {
  email: string
  provider?: string
  createdAt?: string
}): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) return

  await post(url, {
    text: '🎉 New user signed up',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🎉 New user signed up*\n*Email:* ${user.email}\n*Provider:* ${user.provider ?? 'email'}\n*Time:* ${user.createdAt ? new Date(user.createdAt).toUTCString() : new Date().toUTCString()}`,
        },
      },
    ],
  })
}

export async function notifyReport(report: {
  card_id: string
  card_name?: string | null
  grade?: string | null
  report_type: string
  description?: string | null
  page_url?: string | null
}): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_REPORTS_URL ?? process.env.SLACK_WEBHOOK_URL
  if (!url) {
    console.warn('[slack] notifyReport: no webhook URL set (SLACK_WEBHOOK_URL or SLACK_WEBHOOK_REPORTS_URL)')
    return
  }

  const typeLabel: Record<string, string> = {
    price_error: '💸 Price error',
    wrong_card:  '🃏 Wrong card',
    other:       '❓ Other',
  }

  const lines = [
    `*${typeLabel[report.report_type] ?? report.report_type}*`,
    `*Card:* ${report.card_name ?? report.card_id}${report.grade ? ` · ${report.grade}` : ''}`,
    report.description ? `*Details:* ${report.description}` : null,
    report.page_url    ? `*URL:* ${report.page_url}` : null,
  ].filter(Boolean).join('\n')

  await post(url, {
    text: `New issue report: ${report.report_type}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: lines },
      },
    ],
  })
}
