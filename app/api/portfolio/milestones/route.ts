/**
 * GET  /api/portfolio/milestones  — unacknowledged milestones for the signed-in user
 * POST /api/portfolio/milestones  — acknowledge milestone ids (body: { ids: string[] })
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function resolveUser(req: NextRequest) {
  const admin = createAdminClient()
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const { data, error } = await admin.auth.getUser(auth.slice(7))
  if (error || !data.user) return null
  return { admin, userId: data.user.id }
}

export async function GET(req: NextRequest) {
  const ctx = await resolveUser(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await ctx.admin
    .from('portfolio_milestones')
    .select('id, milestone_key, achieved_at, payload')
    .eq('user_id', ctx.userId)
    .is('acknowledged_at', null)
    .order('achieved_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ milestones: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveUser(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }

  const { error } = await ctx.admin
    .from('portfolio_milestones')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('user_id', ctx.userId)
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
