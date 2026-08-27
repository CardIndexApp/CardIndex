/**
 * GET /api/admin/users
 * Returns all profiles + pending upgrade requests + extended platform stats.
 * Restricted to users with is_admin = true.
 */
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Return the most recent of several ISO timestamps (ignores null/invalid). */
function latestISO(...vals: (string | null | undefined)[]): string | null {
  let bestT = -1
  let bestStr: string | null = null
  for (const v of vals) {
    if (!v) continue
    const t = new Date(v).getTime()
    if (!isNaN(t) && t > bestT) { bestT = t; bestStr = v }
  }
  return bestStr
}

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

  // ── Users ────────────────────────────────────────────────────────────────
  // ── All queries in parallel ───────────────────────────────────────────────
  const now            = new Date()
  const todayStart     = new Date(now); todayStart.setUTCHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const sevenDaysAgo   = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    { data: users, error: usersErr },
    { data: rawRequests },
    { data: portfolioRows },
    { data: wlActivity },
    { data: exactCacheRowsRaw },
    { data: searchLogRows },
    { count: totalApiCalls },
    { count: totalUserSearches },
    { count: apiCallsYesterday },
    { count: userSearchesYesterday },
    { count: cachedCards },
    { count: staleCacheCount },
    { count: openReports },
  ] = await Promise.all([
    admin.from('profiles')
      .select('id, email, username, tier, subscription_status, stripe_customer_id, created_at, is_admin, last_active_at, trial_ends_at')
      .order('created_at', { ascending: false }),
    admin.from('upgrade_requests')
      .select('id, user_id, requested_tier, requested_at, actioned_at, action')
      .order('requested_at', { ascending: false }),
    admin.from('portfolios')
      .select('card_id, card_name, grade, purchase_price, quantity, user_id, added_at'),
    admin.from('watchlists').select('user_id, added_at'),
    admin.from('search_cache').select('cache_key, card_id, price'),
    admin.from('search_log').select('user_id').not('user_id', 'is', null).is('source', null),
    admin.from('search_log').select('*', { count: 'exact', head: true }),
    admin.from('search_log').select('*', { count: 'exact', head: true }).is('source', null),
    admin.from('search_log').select('*', { count: 'exact', head: true })
      .gte('searched_at', yesterdayStart.toISOString()).lt('searched_at', todayStart.toISOString()),
    admin.from('search_log').select('*', { count: 'exact', head: true })
      .is('source', null)
      .gte('searched_at', yesterdayStart.toISOString()).lt('searched_at', todayStart.toISOString()),
    admin.from('search_cache').select('*', { count: 'exact', head: true }),
    admin.from('search_cache').select('*', { count: 'exact', head: true })
      .lt('last_fetched', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
    admin.from('card_reports').select('*', { count: 'exact', head: true }),
  ])

  if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 })

  // ── Build maps from parallel results ─────────────────────────────────────
  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u.email]))
  const requests = (rawRequests ?? []).map(r => ({ ...r, user_email: userMap[r.user_id] ?? null }))

  const rows = portfolioRows ?? []

  const activityMap: Record<string, string | null> = {}
  for (const r of [...rows, ...(wlActivity ?? [])] as { user_id: string; added_at?: string | null }[]) {
    activityMap[r.user_id] = latestISO(activityMap[r.user_id] ?? null, r.added_at ?? null)
  }

  const exactPriceMap = Object.fromEntries(
    (exactCacheRowsRaw ?? []).map(c => [c.cache_key, c.price as number | null])
  )

  const portfolioStats = rows.reduce(
    (acc, row) => {
      const qty      = row.quantity ?? 1
      const cost     = (row.purchase_price ?? 0) * qty
      const mktPrice = exactPriceMap[`${row.card_id}:${row.grade}`] ?? null

      acc.totalCostBasis += cost
      acc.totalPositions += qty
      acc.usersWithPortfolio.add(row.user_id)

      if (mktPrice !== null) {
        acc.totalMarketValue += mktPrice * qty
        acc.pricedPositions  += qty
      }
      return acc
    },
    {
      totalCostBasis:   0,
      totalMarketValue: 0,
      totalPositions:   0,
      pricedPositions:  0,
      usersWithPortfolio: new Set<string>(),
    }
  )

  const usersWithPortfolioCount = portfolioStats.usersWithPortfolio.size
  const avgCardsPerPortfolio    = usersWithPortfolioCount > 0 ? portfolioStats.totalPositions / usersWithPortfolioCount : 0
  const avgPortfolioValue       = usersWithPortfolioCount > 0 ? portfolioStats.totalMarketValue / usersWithPortfolioCount : 0

  const cardTrackMap: Record<string, { card_name: string; count: number }> = {}
  for (const row of rows) {
    if (!cardTrackMap[row.card_id]) cardTrackMap[row.card_id] = { card_name: row.card_name ?? row.card_id, count: 0 }
    cardTrackMap[row.card_id].count += 1
  }
  const topTrackedCards = Object.entries(cardTrackMap)
    .map(([card_id, { card_name, count }]) => ({ card_id, card_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const profileList    = users ?? []
  const newThisWeek    = profileList.filter(u => new Date(u.created_at) >= sevenDaysAgo).length
  const newThisMonth   = profileList.filter(u => new Date(u.created_at) >= thirtyDaysAgo).length
  const ADMIN_STATUSES = new Set(['admin_granted', 'admin_revoked'])
  const paidCount      = profileList.filter(u => u.tier !== 'free' && (u.subscription_status == null || !ADMIN_STATUSES.has(u.subscription_status))).length
  const conversionRate = profileList.length > 0 ? (paidCount / profileList.length) * 100 : 0

  const searchCountMap: Record<string, number> = {}
  for (const row of searchLogRows ?? []) {
    if (row.user_id) searchCountMap[row.user_id] = (searchCountMap[row.user_id] ?? 0) + 1
  }

  const usersWithLastSeen = profileList.map(u => ({
    ...u,
    last_sign_in_at: null,
    last_active_at:  latestISO(u.last_active_at, activityMap[u.id] ?? null),
    search_count:    searchCountMap[u.id] ?? 0,
  }))

  const recentlyActive7d  = usersWithLastSeen.filter(u => u.last_active_at && new Date(u.last_active_at) >= sevenDaysAgo).length
  const recentlyActive30d = usersWithLastSeen.filter(u => u.last_active_at && new Date(u.last_active_at) >= thirtyDaysAgo).length

  return NextResponse.json({
    users: usersWithLastSeen,
    requests,
    portfolioStats: {
      totalCostBasis:       portfolioStats.totalCostBasis,
      totalMarketValue:     portfolioStats.totalMarketValue,
      totalPositions:       portfolioStats.totalPositions,
      pricedPositions:      portfolioStats.pricedPositions,
      usersWithPortfolio:   usersWithPortfolioCount,
      avgCardsPerPortfolio,
      avgPortfolioValue,
    },
    growthStats: {
      newThisWeek,
      newThisMonth,
      recentlyActive7d,
      recentlyActive30d,
      conversionRate,
    },
    usageStats: {
      totalSearches:   totalUserSearches  ?? 0,
      cachedCards:     cachedCards        ?? 0,
      staleCacheCount: staleCacheCount    ?? 0,
      openReports:     openReports        ?? 0,
      topTrackedCards,
      apiCalls:     { total: totalApiCalls     ?? 0, yesterday: apiCallsYesterday     ?? 0 },
      userSearches: { total: totalUserSearches ?? 0, yesterday: userSearchesYesterday ?? 0 },
    },
  })
}
