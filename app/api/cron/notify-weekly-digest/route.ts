/**
 * GET /api/cron/notify-weekly-digest
 * Fires every Sunday at 09:00 UTC.
 * Sends a portfolio P&L summary to users with weekly_digest enabled.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/apns'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const log: string[] = []

  const { data: prefs } = await admin
    .from('notification_preferences')
    .select('user_id')
    .eq('weekly_digest', true)

  if (!prefs?.length) return NextResponse.json({ ok: true, log: ['no digest subscribers'] })

  const userIds = prefs.map(p => p.user_id)

  const [
    { data: positions },
    { data: tokens },
  ] = await Promise.all([
    admin.from('portfolios').select('user_id, card_id, grade, purchase_price, quantity, card_name').in('user_id', userIds),
    admin.from('push_tokens').select('user_id, token').in('user_id', userIds),
  ])

  if (!positions?.length) return NextResponse.json({ ok: true, log: ['no portfolios'] })

  // Get current prices
  const keys = [...new Set(positions.map(p => `${p.card_id}:${p.grade}`))]
  const { data: cacheRows } = await admin
    .from('search_cache')
    .select('card_id, grade, price')
    .in('cache_key', keys)

  const priceMap: Record<string, number> = {}
  for (const row of cacheRows ?? []) {
    if (row.price) priceMap[`${row.card_id}:${row.grade}`] = row.price
  }

  const tokenMap: Record<string, string[]> = {}
  for (const t of tokens ?? []) {
    if (!tokenMap[t.user_id]) tokenMap[t.user_id] = []
    tokenMap[t.user_id].push(t.token)
  }

  const byUser: Record<string, typeof positions> = {}
  for (const p of positions) {
    if (!byUser[p.user_id]) byUser[p.user_id] = []
    byUser[p.user_id].push(p)
  }

  let sent = 0
  for (const [userId, userPositions] of Object.entries(byUser)) {
    if (!tokenMap[userId]?.length) continue

    let costBasis = 0, marketValue = 0, pricedCount = 0
    for (const pos of userPositions) {
      const qty     = pos.quantity ?? 1
      const cost    = (pos.purchase_price ?? 0) * qty
      const current = priceMap[`${pos.card_id}:${pos.grade}`]
      costBasis += cost
      if (current) { marketValue += current * qty; pricedCount++ }
    }

    if (!pricedCount) continue

    const gain    = marketValue - costBasis
    const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0
    const dir     = gain >= 0 ? 'up' : 'down'
    const pctStr  = `${Math.abs(gainPct).toFixed(1)}%`
    const valStr  = `$${Math.abs(gain).toFixed(0)}`

    const body = `Your portfolio is ${dir} ${pctStr} (${gain >= 0 ? '+' : '-'}${valStr}) across ${userPositions.length} card${userPositions.length !== 1 ? 's' : ''}.`

    for (const token of tokenMap[userId]) {
      await sendPush(token,
        { title: '📬 Weekly Portfolio Digest', body, data: { screen: 'portfolio' } },
        `digest-${userId}`
      )
    }

    await admin.from('notification_log').insert({
      user_id: userId,
      type:    'weekly_digest',
      payload: { gain, gainPct, costBasis, marketValue, positions: userPositions.length },
    })

    sent++
    log.push(`${userId}: ${body}`)
  }

  return NextResponse.json({ ok: true, sent, log })
}
