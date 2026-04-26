/**
 * POST /api/admin/action-request
 * Admin-only: approve or deny a manual upgrade request.
 *
 * Body: { requestId: string, action: 'approve' | 'deny' }
 * On approve → sets the user's tier to requested_tier and marks actioned.
 * On deny → marks actioned without changing tier.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Tier } from '@/lib/tier'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: caller } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!caller?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { requestId, action } = await req.json() as { requestId: string; action: 'approve' | 'deny' }
  if (!requestId || !['approve', 'deny'].includes(action)) {
    return NextResponse.json({ error: 'requestId and action required' }, { status: 400 })
  }

  // Fetch the request
  const { data: ur, error: fetchErr } = await admin
    .from('upgrade_requests')
    .select('user_id, requested_tier')
    .eq('id', requestId)
    .single()

  if (fetchErr || !ur) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  // If approving, update the user's tier
  if (action === 'approve') {
    await admin
      .from('profiles')
      .update({ tier: ur.requested_tier as Tier, subscription_status: 'active' })
      .eq('id', ur.user_id)
  }

  // Mark the request as actioned
  await admin
    .from('upgrade_requests')
    .update({ actioned_at: new Date().toISOString(), actioned_by: user.id, action })
    .eq('id', requestId)

  return NextResponse.json({ ok: true })
}
