/**
 * GET /api/cron/notify-price-alerts
 * Fires daily at 09:00 UTC.
 * Sends a push notification to users whose portfolio contains a card
 * that has moved ±5% since the last price-alert notification.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/apns'

const THRESHOLD = 0.05

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const log: string[] = []

  // Load all portfolio positions with cached prices
  const { data: positions } = await admin
    .from('portfolios')
    .select('user_id, card_id, card_name, grade, purchase_price')

  if (!positions?.length) return NextResponse.json({ ok: true, log: ['no positions'] })

  const keys = [...new Set(positions.map(p => `${p.card_id}:${p.grade}`))]
  const { data: cacheRows } = await admin
    .from('search_cache')
    .select('card_id, grade, price')
    .in('cache_key', keys)

  const priceMap: Record<string, number> = {}
  for (const row of cacheRows ?? []) {
    if (row.price) priceMap[`${row.card_id}:${row.grade}`] = row.price
  }

  // Load last price-alert notification per user (to compute delta)
  const { data: lastNotifs } = await admin
    .from('notification_log')
    .select('user_id, payload, sent_at')
    .eq('type', 'price_alert')
    .order('sent_at', { ascending: false })

  const lastNotifMap: Record<string, Record<string, number>> = {}
  for (const n of lastNotifs ?? []) {
    if (!lastNotifMap[n.user_id]) {
      lastNotifMap[n.user_id] = (n.payload as any)?.prices ?? {}
    }
  }

  // Load preferences and tokens
  const { data: prefs } = await admin
    .from('notification_preferences')
    .select('user_id, price_alert')
    .eq('price_alert', true)

  const enabledUsers = new Set((prefs ?? []).map(p => p.user_id))

  const { data: tokens } = await admin
    .from('push_tokens')
    .select('user_id, token')

  const tokenMap: Record<string, string[]> = {}
  for (const t of tokens ?? []) {
    if (!tokenMap[t.user_id]) tokenMap[t.user_id] = []
    tokenMap[t.user_id].push(t.token)
  }

  // Group positions by user
  const byUser: Record<string, typeof positions> = {}
  for (const p of positions) {
    if (!byUser[p.user_id]) byUser[p.user_id] = []
    byUser[p.user_id].push(p)
  }

  let sent = 0
  for (const [userId, userPositions] of Object.entries(byUser)) {
    if (!enabledUsers.has(userId)) continue
    if (!tokenMap[userId]?.length) continue

    const lastPrices = lastNotifMap[userId] ?? {}
    const alerts: { name: string; pct: number }[] = []
    const currentPrices: Record<string, number> = {}

    for (const pos of userPositions) {
      const key       = `${pos.card_id}:${pos.grade}`
      const current   = priceMap[key]
      if (!current) continue
      currentPrices[key] = current
      const previous  = lastPrices[key] ?? pos.purchase_price
      if (!previous) continue
      const pct = (current - previous) / previous
      if (Math.abs(pct) >= THRESHOLD) {
        alerts.push({ name: pos.card_name ?? pos.card_id, pct })
      }
    }

    if (!alerts.length) continue

    alerts.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    const top    = alerts[0]
    const dir    = top.pct >= 0 ? 'up' : 'down'
    const pctStr = `${Math.abs(top.pct * 100).toFixed(0)}%`
    const title  = top.pct >= 0 ? '📈 Portfolio Alert' : '📉 Portfolio Alert'
    const body   = alerts.length === 1
      ? `${top.name} is ${dir} ${pctStr}`
      : `${top.name} is ${dir} ${pctStr} and ${alerts.length - 1} more card${alerts.length > 2 ? 's' : ''}`

    for (const token of tokenMap[userId]) {
      await sendPush(token, { title, body, data: { screen: 'portfolio' } }, `price-alert-${userId}`)
    }

    await admin.from('notification_log').insert({
      user_id: userId,
      type:    'price_alert',
      payload: { prices: currentPrices, alerts },
    })

    sent++
    log.push(`${userId}: ${body}`)
  }

  return NextResponse.json({ ok: true, sent, log })
}
