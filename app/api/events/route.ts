/**
 * POST /api/events
 * Logs a single analytics event from the iOS app.
 * Requires a valid Bearer token. Inserts into app_events table.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const admin = createAdminClient()

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.slice(7)
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { event?: unknown; properties?: unknown } | null = null
  try { body = await req.json() } catch { /* empty body */ }

  const eventName = typeof body?.event === 'string' ? body.event.slice(0, 100) : null
  if (!eventName) return NextResponse.json({ error: 'event required' }, { status: 400 })

  const properties = body?.properties && typeof body.properties === 'object' && !Array.isArray(body.properties)
    ? body.properties
    : {}

  await admin.from('app_events').insert({
    user_id:    data.user.id,
    event_name: eventName,
    properties,
  })

  return NextResponse.json({ ok: true })
}
