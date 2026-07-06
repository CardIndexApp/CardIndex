/**
 * GET /api/cron/notify-verdict-changes
 * Fires daily at 09:00 UTC.
 * Compares current search_cache verdict against watchlist_verdicts snapshot.
 * Notifies users when a watchlisted card's verdict has changed, then updates snapshot.
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

  const { data: watchlist } = await admin
    .from('watchlists')
    .select('user_id, card_id, grade, card_name')

  if (!watchlist?.length) return NextResponse.json({ ok: true, log: ['no watchlist items'] })

  // Load current verdicts from search_cache
  const keys = [...new Set(watchlist.map(w => `${w.card_id}:${w.grade ?? ''}`))]
  const { data: cacheRows } = await admin
    .from('search_cache')
    .select('card_id, grade, verdict')
    .in('cache_key', keys)

  const verdictMap: Record<string, string | null> = {}
  for (const row of cacheRows ?? []) {
    verdictMap[`${row.card_id}:${row.grade ?? ''}`] = row.verdict ?? null
  }

  // Load stored verdicts
  const { data: snapshots } = await admin
    .from('watchlist_verdicts')
    .select('user_id, card_id, grade, verdict')

  const snapshotMap: Record<string, string | null> = {}
  for (const s of snapshots ?? []) {
    snapshotMap[`${s.user_id}:${s.card_id}:${s.grade}`] = s.verdict ?? null
  }

  // Load prefs + tokens
  const { data: prefs } = await admin
    .from('notification_preferences')
    .select('user_id, verdict_change')
    .eq('verdict_change', true)

  const enabledUsers = new Set((prefs ?? []).map(p => p.user_id))

  const { data: tokens } = await admin
    .from('push_tokens')
    .select('user_id, token')

  const tokenMap: Record<string, string[]> = {}
  for (const t of tokens ?? []) {
    if (!tokenMap[t.user_id]) tokenMap[t.user_id] = []
    tokenMap[t.user_id].push(t.token)
  }

  // Group changes by user
  const changesByUser: Record<string, { card_id: string; grade: string; card_name: string; from: string | null; to: string | null }[]> = {}
  const snapshotUpserts: { user_id: string; card_id: string; grade: string; verdict: string | null }[] = []

  for (const item of watchlist) {
    const key      = `${item.card_id}:${item.grade ?? ''}`
    const snapKey  = `${item.user_id}:${item.card_id}:${item.grade ?? ''}`
    const current  = verdictMap[key] ?? null
    const previous = snapshotMap[snapKey]

    // Always upsert snapshot to keep it current
    snapshotUpserts.push({ user_id: item.user_id, card_id: item.card_id, grade: item.grade ?? '', verdict: current })

    if (previous === undefined) continue  // first time — just record, no notification
    if (current === previous)   continue  // no change

    if (!enabledUsers.has(item.user_id)) continue
    if (!tokenMap[item.user_id]?.length)  continue

    if (!changesByUser[item.user_id]) changesByUser[item.user_id] = []
    changesByUser[item.user_id].push({
      card_id:   item.card_id,
      grade:     item.grade ?? '',
      card_name: item.card_name ?? item.card_id,
      from:      previous,
      to:        current,
    })
  }

  // Upsert snapshots in bulk
  if (snapshotUpserts.length) {
    await admin.from('watchlist_verdicts').upsert(snapshotUpserts, { onConflict: 'user_id,card_id,grade' })
  }

  let sent = 0
  for (const [userId, changes] of Object.entries(changesByUser)) {
    const top   = changes[0]
    const toStr = top.to ?? 'updated'
    const body  = changes.length === 1
      ? `${top.card_name} is now ${toStr}`
      : `${top.card_name} is now ${toStr} and ${changes.length - 1} more on your watchlist`

    for (const token of tokenMap[userId]) {
      await sendPush(token,
        { title: '🔔 Watchlist Update', body, data: { screen: 'watchlist' } },
        `verdict-${userId}`
      )
    }

    await admin.from('notification_log').insert({
      user_id: userId,
      type:    'verdict_change',
      payload: { changes },
    })

    sent++
    log.push(`${userId}: ${body}`)
  }

  return NextResponse.json({ ok: true, sent, log })
}
