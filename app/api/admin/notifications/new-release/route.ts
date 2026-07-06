/**
 * POST /api/admin/notifications/new-release
 * Admin-only. Sends a new set release notification to all users
 * who have new_release notifications enabled.
 * Body: { title: string, body: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/apns'

export async function POST(req: NextRequest) {
  const admin = createAdminClient()

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await admin.auth.getUser(authHeader.slice(7))
  if (error || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caller } = await admin
    .from('profiles').select('is_admin').eq('id', data.user.id).single()
  if (!caller?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, body: msgBody } = await req.json()
  if (!title || !msgBody) return NextResponse.json({ error: 'title and body required' }, { status: 400 })

  const { data: prefs } = await admin
    .from('notification_preferences')
    .select('user_id')
    .eq('new_release', true)

  if (!prefs?.length) return NextResponse.json({ ok: true, sent: 0 })

  const userIds = prefs.map(p => p.user_id)
  const { data: tokens } = await admin
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', userIds)

  const allTokens = (tokens ?? []).map(t => t.token)
  const results   = await Promise.all(
    allTokens.map(token =>
      sendPush(token, { title, body: msgBody, data: { screen: 'market' } }, 'new-release')
    )
  )

  const succeeded = results.filter(r => r.success).length

  // Log one entry per user
  const tokenUserMap: Record<string, string> = {}
  for (const t of tokens ?? []) tokenUserMap[t.token] = t.user_id

  const notifiedUsers = [...new Set(
    results.filter(r => r.success).map(r => tokenUserMap[r.token])
  )]
  if (notifiedUsers.length) {
    await admin.from('notification_log').insert(
      notifiedUsers.map(userId => ({
        user_id: userId,
        type:    'new_release',
        payload: { title, body: msgBody },
      }))
    )
  }

  return NextResponse.json({ ok: true, sent: succeeded, total: allTokens.length })
}
