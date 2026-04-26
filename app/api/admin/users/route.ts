/**
 * GET /api/admin/users
 * Returns all profiles + pending upgrade requests.
 * Restricted to users with is_admin = true.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify admin
  const { data: caller } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!caller?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // All users
  const { data: users, error: usersErr } = await admin
    .from('profiles')
    .select('id, email, username, tier, subscription_status, stripe_customer_id, created_at, is_admin')
    .order('created_at', { ascending: false })

  if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 })

  // Upgrade requests with the requester's email joined in
  const { data: rawRequests } = await admin
    .from('upgrade_requests')
    .select('id, user_id, requested_tier, requested_at, actioned_at, action')
    .order('requested_at', { ascending: false })

  // Attach email to each request
  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u.email]))
  const requests = (rawRequests ?? []).map(r => ({ ...r, user_email: userMap[r.user_id] ?? null }))

  return NextResponse.json({ users: users ?? [], requests })
}
