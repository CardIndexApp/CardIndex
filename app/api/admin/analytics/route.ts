/**
 * GET /api/admin/analytics
 * Returns funnel, retention (DAU/WAU/MAU), daily search volume, and all-time search count.
 * Restricted to users with is_admin = true.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const admin = createAdminClient()

  // ── Dual auth: Bearer token (iOS) or cookie session (browser) ────────────
  let userId: string
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = data.user.id
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
  }

  // Verify admin
  const { data: caller } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (!caller?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()
  const d1  = new Date(now.getTime() - 1  * 86400000)
  const d7  = new Date(now.getTime() - 7  * 86400000)
  const d30 = new Date(now.getTime() - 30 * 86400000)

  // ── Run queries in parallel ───────────────────────────────────────────────
  const [
    { data: funnel },
    { data: dailySearches },
    { data: platformStats },
    { data: profiles },
    { count: liveSearches },
  ] = await Promise.all([
    admin.from('admin_funnel_summary').select('*').single(),
    admin.rpc('search_volume_by_day', { days: 30 }),
    admin.from('platform_stats').select('value').eq('key', 'archived_searches').single(),
    admin.from('profiles').select('last_active_at').not('last_active_at', 'is', null),
    admin.from('search_log').select('*', { count: 'exact', head: true }),
  ])

  // ── Retention (DAU / WAU / MAU) from last_active_at ──────────────────────
  const profileList = profiles ?? []
  const dau = profileList.filter(p => p.last_active_at && new Date(p.last_active_at) >= d1).length
  const wau = profileList.filter(p => p.last_active_at && new Date(p.last_active_at) >= d7).length
  const mau = profileList.filter(p => p.last_active_at && new Date(p.last_active_at) >= d30).length

  const archivedSearches = (platformStats as { value: number } | null)?.value ?? 0
  const totalSearchesAllTime = (liveSearches ?? 0) + archivedSearches

  return NextResponse.json({
    funnel,
    retention: {
      dau,
      wau,
      mau,
      dauWauRatio: wau > 0 ? +((dau / wau) * 100).toFixed(1) : 0,
    },
    searchVolume: dailySearches ?? [],
    totalSearchesAllTime,
  })
}
