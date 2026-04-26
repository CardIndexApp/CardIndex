/**
 * POST /api/admin/set-tier
 * Admin-only: manually override a user's tier.
 *
 * Body: { userId: string, tier: 'free' | 'standard' | 'pro' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Tier } from '@/lib/tier'

const VALID_TIERS: Tier[] = ['free', 'standard', 'pro']

export async function POST(req: NextRequest) {
  // Verify the caller is an admin
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

  const { userId, tier } = await req.json() as { userId: string; tier: Tier }
  if (!userId || !VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: 'userId and valid tier required' }, { status: 400 })
  }

  const { error } = await admin
    .from('profiles')
    .update({ tier, subscription_status: tier === 'free' ? null : 'active' })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
