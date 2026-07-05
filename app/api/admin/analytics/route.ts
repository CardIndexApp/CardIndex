/**
 * GET /api/admin/analytics
 * Returns funnel, retention, daily search volume, all-time search count, and insights.
 * Restricted to users with is_admin = true.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const LAUNCH_DATE      = '2026-06-30T00:00:00Z'
const POWER_THRESHOLD  = 20

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

  // ── Parallel queries ──────────────────────────────────────────────────────
  const [
    { data: funnel },
    { data: dailySearches },
    { data: platformStats },
    { data: allProfiles },
    { count: liveSearches },
    { data: portfolioUsers },
    { data: watchlistUsers },
    { data: searchLogUsers },
    { data: approvedUpgrades },
  ] = await Promise.all([
    admin.from('admin_funnel_summary').select('*').single(),
    admin.rpc('search_volume_by_day', { days: 30 }),
    admin.from('platform_stats').select('value').eq('key', 'archived_searches').single(),
    admin.from('profiles').select('id, last_active_at, tier, trial_ends_at, stripe_customer_id, created_at'),
    admin.from('search_log').select('*', { count: 'exact', head: true }),
    admin.from('portfolios').select('user_id'),
    admin.from('watchlists').select('user_id'),
    admin.from('search_log').select('user_id').not('user_id', 'is', null),
    admin.from('upgrade_requests').select('user_id').eq('action', 'approve'),
  ])

  const profiles      = allProfiles ?? []
  const postLaunch    = profiles.filter(p => new Date(p.created_at) >= new Date(LAUNCH_DATE))

  // ── Retention ─────────────────────────────────────────────────────────────
  const activeProfiles = profiles.filter(p => p.last_active_at)
  const dau = activeProfiles.filter(p => new Date(p.last_active_at!) >= d1).length
  const wau = activeProfiles.filter(p => new Date(p.last_active_at!) >= d7).length
  const mau = activeProfiles.filter(p => new Date(p.last_active_at!) >= d30).length

  // ── All-time searches ─────────────────────────────────────────────────────
  const archivedSearches   = (platformStats as { value: number } | null)?.value ?? 0
  const totalSearchesAllTime = (liveSearches ?? 0) + archivedSearches

  // ── Trial conversion (post-launch only) ──────────────────────────────────
  const expiredTrials          = postLaunch.filter(p => p.trial_ends_at && new Date(p.trial_ends_at) < now)
  const convertedBeforeExpiry  = expiredTrials.filter(p => p.tier !== 'free')
  const activeTrials           = postLaunch.filter(p => p.trial_ends_at && new Date(p.trial_ends_at) >= now)
  const trialRate              = expiredTrials.length > 0
    ? +((convertedBeforeExpiry.length / expiredTrials.length) * 100).toFixed(1)
    : 0

  // ── Churn (ever paid → now free) ─────────────────────────────────────────
  const approvedUserIds = new Set((approvedUpgrades ?? []).map(r => r.user_id))
  const everPaid        = profiles.filter(p => approvedUserIds.has(p.id) || (p.stripe_customer_id ?? null) !== null)
  const churned         = everPaid.filter(p => p.tier === 'free')
  const churnRate       = everPaid.length > 0
    ? +((churned.length / everPaid.length) * 100).toFixed(1)
    : 0

  // ── Feature adoption (post-launch) ───────────────────────────────────────
  const portfolioSet   = new Set((portfolioUsers ?? []).map(r => r.user_id))
  const watchlistSet   = new Set((watchlistUsers  ?? []).map(r => r.user_id))
  const postLaunchIds  = new Set(postLaunch.map(p => p.id))

  let portfolioOnly = 0, watchlistOnly = 0, both = 0, neither = 0
  for (const id of postLaunchIds) {
    const hasP = portfolioSet.has(id)
    const hasW = watchlistSet.has(id)
    if (hasP && hasW)       both++
    else if (hasP)          portfolioOnly++
    else if (hasW)          watchlistOnly++
    else                    neither++
  }

  // ── Search → Portfolio (post-launch) ─────────────────────────────────────
  const searchedSet            = new Set(
    (searchLogUsers ?? []).map(r => r.user_id).filter(id => postLaunchIds.has(id))
  )
  const searchedAndPortfolio   = [...searchedSet].filter(id => portfolioSet.has(id)).length
  const searchToPortfolioRate  = searchedSet.size > 0
    ? +((searchedAndPortfolio / searchedSet.size) * 100).toFixed(1)
    : 0

  // ── Power users (post-launch, >POWER_THRESHOLD searches) ─────────────────
  const searchCountMap: Record<string, number> = {}
  for (const row of searchLogUsers ?? []) {
    if (row.user_id && postLaunchIds.has(row.user_id)) {
      searchCountMap[row.user_id] = (searchCountMap[row.user_id] ?? 0) + 1
    }
  }
  const powerUsers = Object.values(searchCountMap).filter(c => c > POWER_THRESHOLD).length

  // ── Cache coverage ────────────────────────────────────────────────────────
  const [
    { data: cachedKeys },
    { data: searchedKeys },
  ] = await Promise.all([
    admin.from('search_cache').select('card_id, grade'),
    admin.from('search_log').select('card_id, grade').not('card_id', 'is', null),
  ])

  const cachedSet    = new Set((cachedKeys ?? []).map(r => `${r.card_id}:${r.grade ?? ''}`))
  const searchedCombos = new Set((searchedKeys ?? []).map(r => `${r.card_id}:${r.grade ?? ''}`))
  const cachedCoverage = searchedCombos.size > 0
    ? +([...searchedCombos].filter(k => cachedSet.has(k)).length / searchedCombos.size * 100).toFixed(1)
    : 0

  return NextResponse.json({
    funnel,
    retention: {
      dau,
      wau,
      mau,
      dauWauRatio: wau > 0 ? +((dau / wau) * 100).toFixed(1) : 0,
    },
    searchVolume:        dailySearches ?? [],
    totalSearchesAllTime,
    insights: {
      trialConversion: {
        expiredTrials:         expiredTrials.length,
        convertedBeforeExpiry: convertedBeforeExpiry.length,
        activeTrials:          activeTrials.length,
        rate:                  trialRate,
      },
      churn: {
        everPaid: everPaid.length,
        nowFree:  churned.length,
        rate:     churnRate,
      },
      featureAdoption: {
        portfolioOnly,
        watchlistOnly,
        both,
        neither,
        total: postLaunch.length,
      },
      searchToPortfolio: {
        searchedUsers:         searchedSet.size,
        searchedAndPortfolio,
        rate:                  searchToPortfolioRate,
      },
      powerUsers: {
        count:     powerUsers,
        threshold: POWER_THRESHOLD,
      },
      cacheHitRate: {
        uniqueSearched: searchedCombos.size,
        cached:         cachedSet.size,
        rate:           cachedCoverage,
      },
    },
  })
}
