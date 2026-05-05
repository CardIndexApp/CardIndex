/**
 * GET /api/admin/users
 * Returns all profiles + pending upgrade requests + extended platform stats.
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

  // ── Users ────────────────────────────────────────────────────────────────
  const { data: users, error: usersErr } = await admin
    .from('profiles')
    .select('id, email, username, tier, subscription_status, stripe_customer_id, created_at, is_admin')
    .order('created_at', { ascending: false })

  if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 })

  // ── Upgrade requests ─────────────────────────────────────────────────────
  const { data: rawRequests } = await admin
    .from('upgrade_requests')
    .select('id, user_id, requested_tier, requested_at, actioned_at, action')
    .order('requested_at', { ascending: false })

  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u.email]))
  const requests = (rawRequests ?? []).map(r => ({ ...r, user_email: userMap[r.user_id] ?? null }))

  // ── Portfolio stats ───────────────────────────────────────────────────────
  const { data: portfolioRows } = await admin
    .from('portfolios')
    .select('card_id, card_name, grade, purchase_price, quantity, user_id')

  const rows = portfolioRows ?? []

  const exactKeys = [...new Set(rows.map(r => `${r.card_id}:${r.grade}`))]
  const { data: exactCacheRows } = exactKeys.length
    ? await admin.from('search_cache').select('cache_key, card_id, price, last_fetched').in('cache_key', exactKeys)
    : { data: [] }

  const exactPriceMap = Object.fromEntries(
    (exactCacheRows ?? []).map(c => [c.cache_key, c.price as number | null])
  )

  const missingCardIds = [...new Set(
    rows
      .filter(r => (exactPriceMap[`${r.card_id}:${r.grade}`] ?? null) === null)
      .map(r => r.card_id)
  )]

  const { data: fallbackCacheRows } = missingCardIds.length
    ? await admin
        .from('search_cache')
        .select('card_id, grade, price, last_fetched')
        .in('card_id', missingCardIds)
        .not('price', 'is', null)
        .order('last_fetched', { ascending: false })
    : { data: [] }

  const fallbackPriceMap: Record<string, number> = {}
  for (const row of (fallbackCacheRows ?? [])) {
    const key = row.card_id
    if (!fallbackPriceMap[key]) fallbackPriceMap[key] = row.price as number
  }
  for (const row of (fallbackCacheRows ?? [])) {
    const missingRow = rows.find(r => r.card_id === row.card_id)
    if (missingRow && row.grade === missingRow.grade) {
      fallbackPriceMap[row.card_id] = row.price as number
    }
  }

  const portfolioStats = rows.reduce(
    (acc, row) => {
      const qty      = row.quantity ?? 1
      const cost     = (row.purchase_price ?? 0) * qty
      const mktPrice = exactPriceMap[`${row.card_id}:${row.grade}`]
        ?? fallbackPriceMap[row.card_id]
        ?? null

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
  const avgCardsPerPortfolio = usersWithPortfolioCount > 0
    ? portfolioStats.totalPositions / usersWithPortfolioCount
    : 0
  const avgPortfolioValue = usersWithPortfolioCount > 0
    ? portfolioStats.totalMarketValue / usersWithPortfolioCount
    : 0

  // ── Top tracked cards (by number of users tracking) ──────────────────────
  const cardTrackMap: Record<string, { card_name: string; count: number }> = {}
  for (const row of rows) {
    if (!cardTrackMap[row.card_id]) {
      cardTrackMap[row.card_id] = { card_name: row.card_name ?? row.card_id, count: 0 }
    }
    cardTrackMap[row.card_id].count += 1
  }
  const topTrackedCards = Object.entries(cardTrackMap)
    .map(([card_id, { card_name, count }]) => ({ card_id, card_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // ── Growth metrics ────────────────────────────────────────────────────────
  const now = new Date()
  const sevenDaysAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const profileList = users ?? []
  const newThisWeek  = profileList.filter(u => new Date(u.created_at) >= sevenDaysAgo).length
  const newThisMonth = profileList.filter(u => new Date(u.created_at) >= thirtyDaysAgo).length

  const paidCount      = profileList.filter(u => u.tier !== 'free').length
  const conversionRate = profileList.length > 0 ? (paidCount / profileList.length) * 100 : 0

  // Recently active users via auth.admin
  let recentlyActive7d  = 0
  let recentlyActive30d = 0
  try {
    const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    recentlyActive7d  = authUsers.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= sevenDaysAgo).length
    recentlyActive30d = authUsers.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= thirtyDaysAgo).length
  } catch { /* non-fatal */ }

  // ── Usage / health metrics ────────────────────────────────────────────────
  const [
    { count: totalSearches },
    { count: cachedCards },
    { count: staleCacheCount },
    { count: openReports },
  ] = await Promise.all([
    admin.from('search_log').select('*', { count: 'exact', head: true }),
    admin.from('search_cache').select('*', { count: 'exact', head: true }),
    admin.from('search_cache')
      .select('*', { count: 'exact', head: true })
      .lt('last_fetched', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
    admin.from('card_reports').select('*', { count: 'exact', head: true }),
  ])

  return NextResponse.json({
    users: users ?? [],
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
      totalSearches:  totalSearches  ?? 0,
      cachedCards:    cachedCards    ?? 0,
      staleCacheCount: staleCacheCount ?? 0,
      openReports:    openReports    ?? 0,
      topTrackedCards,
    },
  })
}
