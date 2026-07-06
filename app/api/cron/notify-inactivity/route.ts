/**
 * GET /api/cron/notify-inactivity
 * Fires daily at 09:00 UTC.
 * Sends a re-engagement nudge to users inactive for 7+ days
 * who haven't received an inactivity notification in the last 7 days.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/apns'

const INACTIVE_DAYS   = 7
const COOLDOWN_DAYS   = 7

const MESSAGES = [
  { title: '👀 Your portfolio misses you', body: 'Check in to see how your cards are performing.' },
  { title: '📊 Market has moved', body: "It's been a while — see what's changed in your portfolio." },
  { title: '🃏 New signals available', body: 'Fresh verdicts are ready for cards on your watchlist.' },
]

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now   = new Date()
  const inactiveCutoff  = new Date(now.getTime() - INACTIVE_DAYS  * 86400000).toISOString()
  const cooldownCutoff  = new Date(now.getTime() - COOLDOWN_DAYS  * 86400000).toISOString()

  // Users inactive for 7+ days with inactivity pref on
  const { data: candidates } = await admin
    .from('profiles')
    .select('id, last_active_at')
    .lt('last_active_at', inactiveCutoff)
    .not('last_active_at', 'is', null)

  if (!candidates?.length) return NextResponse.json({ ok: true, log: ['no inactive users'] })

  const candidateIds = candidates.map(c => c.id)

  const { data: prefs } = await admin
    .from('notification_preferences')
    .select('user_id, inactivity')
    .in('user_id', candidateIds)
    .eq('inactivity', true)

  const enabledUsers = new Set((prefs ?? []).map(p => p.user_id))

  // Exclude users already notified within the cooldown window
  const { data: recentNotifs } = await admin
    .from('notification_log')
    .select('user_id')
    .in('user_id', candidateIds)
    .eq('type', 'inactivity')
    .gte('sent_at', cooldownCutoff)

  const recentlyNotified = new Set((recentNotifs ?? []).map(n => n.user_id))

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
    if (!enabledUsers.has(user.id))        continue
    if (recentlyNotified.has(user.id))     continue
    if (!tokenMap[user.id]?.length)        continue

    const msg = MESSAGES[sent % MESSAGES.length]

    for (const token of tokenMap[user.id]) {
      await sendPush(token, { ...msg, data: { screen: 'home' } }, `inactivity-${user.id}`)
    }

    await admin.from('notification_log').insert({
      user_id: user.id,
      type:    'inactivity',
      payload: { last_active_at: user.last_active_at },
    })

    sent++
    log.push(`${user.id}: inactive since ${user.last_active_at}`)
  }

  return NextResponse.json({ ok: true, sent, log })
}
