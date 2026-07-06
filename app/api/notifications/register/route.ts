/**
 * POST /api/notifications/register
 * Upserts a device push token for the authenticated user.
 * Called by iOS on every app launch after permission is granted.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const admin = createAdminClient()

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await admin.auth.getUser(authHeader.slice(7))
  if (error || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token, platform = 'ios' } = await req.json()
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  const { error: upsertErr } = await admin
    .from('push_tokens')
    .upsert(
      { user_id: data.user.id, token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' }
    )

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
