/**
 * GET /api/cron/notify-milestones
 * Fires daily at 10:30 UTC (after market-refresh so prices are fresh).
 *
 * Checks two milestone types per user:
 *   1. Portfolio total value crossed a threshold ($500, $1k, $5k, $10k, $25k, $50k, $100k)
 *   2. Any individual card's current price >= 2× its purchase price ("doubled")
 *
 * A milestone fires exactly once (unique constraint on user_id + milestone_key).
 * Respects the user's `milestones` notification preference.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/apns'

const VALUE_THRESHOLDS = [500, 1000, 5000, 10000, 25000, 50000, 100000]

function valueKey(threshold: number) {
  return `value_${threshold}`
}
function doubledKey(cardId: string, grade: string) {
  return `card_doubled:${cardId}:${grade}`
}
function formatValue(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
  return `$${v}`
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const log: string[] = []
  let sent = 0

  // Users who have milestones notifications on (or no preference row yet — default on)
  const { data: allPrefs } = await admin
    .from('notification_preferences')
    .select('user_id, milestones')

  const optedOut = new Set(
    (allPrefs ?? []).filter(p => p.milestones === false).map(p => p.user_id)
  )

  // Load all open portfolio positions with price data
  const { data: positions } = await admin
    .from('portfolios')
    .select('user_id, card_id, card_name, grade, purchase_price, quantity')
    .eq('sold', false)

  if (!positions?.length) return NextResponse.json({ ok: true, log: ['no positions'] })

  // Current prices from search_cache
  const keys = [...new Set(positions.map(p => `${p.card_id}:${p.grade}`))]
  const { data: cacheRows } = await admin
    .from('search_cache')
    .select('card_id, grade, price')
    .in('cache_key', keys)

  const priceMap: Record<string, number> = {}
  for (const row of cacheRows ?? []) {
    if (row.price) priceMap[`${row.card_id}:${row.grade}`] = row.price
  }

  // Push tokens
  const userIds = [...new Set(positions.map(p => p.user_id))]
  const { data: tokens } = await admin
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', userIds)

  const tokenMap: Record<string, string[]> = {}
  for (const t of tokens ?? []) {
    if (!tokenMap[t.user_id]) tokenMap[t.user_id] = []
    tokenMap[t.user_id].push(t.token)
  }

  // Already-achieved milestones (to avoid re-firing)
  const { data: existing } = await admin
    .from('portfolio_milestones')
    .select('user_id, milestone_key')
    .in('user_id', userIds)

  const achieved = new Set(
    (existing ?? []).map(r => `${r.user_id}:${r.milestone_key}`)
  )

  // Group positions by user
  const byUser: Record<string, typeof positions> = {}
  for (const p of positions) {
    if (!byUser[p.user_id]) byUser[p.user_id] = []
    byUser[p.user_id].push(p)
  }

  for (const [userId, userPositions] of Object.entries(byUser)) {
    if (optedOut.has(userId)) continue

    // --- 1. Portfolio value milestones ---
    let totalValue = 0
    for (const pos of userPositions) {
      const price = priceMap[`${pos.card_id}:${pos.grade}`] ?? pos.purchase_price ?? 0
      totalValue += price * (pos.quantity ?? 1)
    }

    for (const threshold of VALUE_THRESHOLDS) {
      if (totalValue < threshold) continue
      const key = valueKey(threshold)
      if (achieved.has(`${userId}:${key}`)) continue

      // New milestone — insert and push
      await admin.from('portfolio_milestones').insert({
        user_id:      userId,
        milestone_key: key,
        pushed_at:    new Date().toISOString(),
        payload:      { threshold, currentValue: totalValue },
      })
      achieved.add(`${userId}:${key}`)

      if (tokenMap[userId]?.length) {
        const label = formatValue(threshold)
        for (const token of tokenMap[userId]) {
          await sendPush(
            token,
            {
              title: `🏆 Collection milestone reached!`,
              body:  `Your collection just crossed ${label} in value.`,
              data:  { screen: 'portfolio', milestone: key },
            },
            `milestone-${userId}-${key}`
          )
        }
        sent++
        log.push(`${userId}: value crossed ${threshold} (current: ${totalValue.toFixed(0)})`)
      }
    }

    // --- 2. Card doubled milestone ---
    for (const pos of userPositions) {
      const purchase = pos.purchase_price
      if (!purchase || purchase <= 0) continue
      const current = priceMap[`${pos.card_id}:${pos.grade}`]
      if (!current || current < purchase * 2) continue

      const key = doubledKey(pos.card_id, pos.grade)
      if (achieved.has(`${userId}:${key}`)) continue

      await admin.from('portfolio_milestones').insert({
        user_id:      userId,
        milestone_key: key,
        pushed_at:    new Date().toISOString(),
        payload:      { cardName: pos.card_name, grade: pos.grade, purchasePrice: purchase, currentPrice: current },
      })
      achieved.add(`${userId}:${key}`)

      if (tokenMap[userId]?.length) {
        for (const token of tokenMap[userId]) {
          await sendPush(
            token,
            {
              title: `🚀 ${pos.card_name ?? 'A card'} doubled!`,
              body:  `${pos.card_name ?? 'Your card'} (${pos.grade}) is now worth 2× what you paid.`,
              data:  { screen: 'portfolio', milestone: key },
            },
            `milestone-${userId}-${key}`
          )
        }
        sent++
        log.push(`${userId}: ${pos.card_name} (${pos.grade}) doubled (${purchase} → ${current})`)
      }
    }
  }

  return NextResponse.json({ ok: true, sent, log })
}
