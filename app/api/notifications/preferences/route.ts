/**
 * GET  /api/notifications/preferences  — fetch user's notification prefs
 * PUT  /api/notifications/preferences  — update one or more prefs
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function resolveUser(req: NextRequest) {
  const admin = createAdminClient()
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const { data, error } = await admin.auth.getUser(authHeader.slice(7))
  if (error || !data.user) return null
  return { admin, userId: data.user.id }
}

export async function GET(req: NextRequest) {
  const ctx = await resolveUser(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await ctx.admin
    .from('notification_preferences')
    .select('price_alert, verdict_change, weekly_digest, inactivity, new_release')
    .eq('user_id', ctx.userId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const ctx = await resolveUser(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['price_alert', 'verdict_change', 'weekly_digest', 'inactivity', 'new_release']
  const updates: Record<string, boolean> = {}
  for (const key of allowed) {
    if (typeof body[key] === 'boolean') updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  updates['updated_at'] = new Date().toISOString() as any

  const { error } = await ctx.admin
    .from('notification_preferences')
    .upsert({ user_id: ctx.userId, ...updates }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
