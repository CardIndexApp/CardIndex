/**
 * GET /api/cron/notify-search-reengagement
 * Fires daily at 11:00 UTC.
 * Finds users who searched a card 44–52 hours ago, haven't added it to their
 * portfolio or watchlist, and sends a personalised price-movement push.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/apns'

const COOLDOWN_DAYS = 14

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now   = new Date()
  const lo    = new Date(now.getTime() - 52 * 3600000).toISOString()
  const hi    = new Date(now.getTime() - 44 * 3600000).toISOString()
  const cooldownCutoff = new Date(now.getTime() - COOLDOWN_DAYS * 86400000).toISOString()

  // Profiles with a last_search_at in the 44–52h window
  const { data: candidates, error: qErr } = await admin
    .from('profiles')
    .select('id, last_search_card_id, last_search_card_name, last_search_grade, last_search_price_usd')
    .gte('last_search_at', lo)
    .lte('last_search_at', hi)
    .not('last_search_card_id', 'is', null)
    .limit(200)

  if (qErr) {
    console.error('[search-reengagement] query error:', qErr.message)
    return NextResponse.json({ error: qErr.message }, { status: 500 })
  }
  if (!candidates?.length) return NextResponse.json({ ok: true, sent: 0, log: ['no candidates'] })

  const candidateIds = candidates.map(c => c.id)

  // Exclude users already notified recently
  const { data: recentNotifs } = await admin
    .from('notification_log')
    .select('user_id')
    .in('user_id', candidateIds)
    .eq('type', 'search_reengagement')
    .gte('sent_at', cooldownCutoff)
  const recentlyNotified = new Set((recentNotifs ?? []).map(n => n.user_id))

  // Exclude users who already added the searched card to portfolio or watchlist
  const { data: portfolioRows } = await admin
    .from('portfolios')
    .select('user_id, card_id')
    .in('user_id', candidateIds)
  const portfolioSet = new Set((portfolioRows ?? []).map(r => `${r.user_id}:${r.card_id}`))

  const { data: watchlistRows } = await admin
    .from('watchlists')
    .select('user_id, card_id')
    .in('user_id', candidateIds)
  const watchlistSet = new Set((watchlistRows ?? []).map(r => `${r.user_id}:${r.card_id}`))

  // Fetch current prices from search_cache for the searched cards
  const cacheKeys = [...new Set(
    candidates
      .filter(c => c.last_search_card_id && c.last_search_grade)
      .map(c => `${c.last_search_card_id}:${c.last_search_grade}`)
  )]
  const { data: cacheRows } = await admin
    .from('search_cache')
    .select('card_id, grade, price')
    .in('cache_key', cacheKeys)
  const priceMap: Record<string, number> = {}
  for (const row of cacheRows ?? []) {
    if (row.price) priceMap[`${row.card_id}:${row.grade}`] = row.price
  }

  // Push tokens
  const { data: tokens } = await admin
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', candidateIds)
  const tokenMap: Record<string, string[]> = {}
  for (const t of tokens ?? []) {
    if (!tokenMap[t.user_id]) tokenMap[t.user_id] = []
    tokenMap[t.user_id].push(t.token)
  }

  const log: string[] = []
  let sent = 0

  for (const user of candidates) {
    if (recentlyNotified.has(user.id))                        continue
    if (!tokenMap[user.id]?.length)                          continue
    if (!user.last_search_card_id || !user.last_search_grade) continue

    // Skip if they already engaged with the card
    const portfolioKey = `${user.id}:${user.last_search_card_id}`
    const watchlistKey = `${user.id}:${user.last_search_card_id}`
    if (portfolioSet.has(portfolioKey) || watchlistSet.has(watchlistKey)) continue

    const currentPrice = priceMap[`${user.last_search_card_id}:${user.last_search_grade}`]
    const prevPrice    = user.last_search_price_usd ? Number(user.last_search_price_usd) : null
    const cardName     = user.last_search_card_name ?? 'A card you looked at'
    const grade        = user.last_search_grade

    let title: string
    let body: string

    if (currentPrice && prevPrice && prevPrice > 0) {
      const pct = ((currentPrice - prevPrice) / prevPrice) * 100
      const sign = pct >= 0 ? '+' : ''
      const absPct = Math.abs(pct)

      if (absPct < 1) {
        // Flat — nudge to add
        title = `${cardName} — ${grade}`
        body  = `Price is holding steady. Add it to your watchlist to track it.`
      } else {
        title = `${cardName} moved ${sign}${absPct.toFixed(0)}%`
        body  = pct > 0
          ? `Up to $${currentPrice.toFixed(0)} since you last looked. Still tracking it?`
          : `Down to $${currentPrice.toFixed(0)} since you last looked. Good time to buy?`
      }
    } else {
      title = `${cardName} — ${grade}`
      body  = `Fresh market data is in. Tap to see the latest price.`
    }

    for (const token of tokenMap[user.id]) {
      await sendPush(token, {
        title,
        body,
        data: { screen: 'card', card_id: user.last_search_card_id, grade },
      }, `search-reengagement-${user.id}`)
    }

    await admin.from('notification_log').insert({
      user_id: user.id,
      type:    'search_reengagement',
      payload: { card_id: user.last_search_card_id, grade, current_price: currentPrice },
    })

    sent++
    log.push(`${user.id}: ${cardName} ${grade}`)
  }

  console.log(`[search-reengagement] sent ${sent}/${candidates.length}`)
  return NextResponse.json({ ok: true, sent, total: candidates.length, log })
}
