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

export const maxDuration = 60

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
  const todayStart = new Date(now); todayStart.setUTCHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)

  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000)

  const [
    { data: funnel },
    { data: dailySearches },
    { data: platformStats },
    { data: allProfiles },
    { count: liveApiCalls },
    { count: liveUserSearches },
    { count: apiCallsYesterday },
    { count: userSearchesYesterday },
    { data: portfolioUsers },
    { data: watchlistUsers },
    { data: searchLogUsers },
    { data: approvedUpgrades },
    { data: recentSearchLog },
    { data: featureUsedEvents },
    { data: paywallEvents },
  ] = await Promise.all([
    admin.from('admin_funnel_summary').select('*').single(),
    admin.rpc('search_volume_by_day', { days: 30 }),
    admin.from('platform_stats').select('value').eq('key', 'archived_searches').single(),
    admin.from('profiles').select('id, last_active_at, tier, trial_ends_at, stripe_customer_id, apple_original_transaction_id, created_at'),
    admin.from('search_log').select('*', { count: 'exact', head: true }),
    admin.from('search_log').select('*', { count: 'exact', head: true }).is('source', null),
    admin.from('search_log').select('*', { count: 'exact', head: true })
      .gte('searched_at', yesterdayStart.toISOString())
      .lt('searched_at', todayStart.toISOString()),
    admin.from('search_log').select('*', { count: 'exact', head: true })
      .is('source', null)
      .gte('searched_at', yesterdayStart.toISOString())
      .lt('searched_at', todayStart.toISOString()),
    admin.from('portfolios').select('user_id'),
    admin.from('watchlists').select('user_id'),
    admin.from('search_log').select('user_id').not('user_id', 'is', null).is('source', null),
    admin.from('upgrade_requests').select('user_id').eq('action', 'approve'),
    admin.from('search_log')
      .select('user_id, card_id, card_name, searched_at')
      .is('source', null)
      .not('user_id', 'is', null)
      .gte('searched_at', ninetyDaysAgo.toISOString()),
    admin.from('app_events').select('user_id, properties').eq('event_name', 'feature_used'),
    admin.from('app_events').select('user_id, properties').eq('event_name', 'paywall_shown'),
  ])

  const profiles      = allProfiles ?? []
  const postLaunch    = profiles.filter(p => new Date(p.created_at) >= new Date(LAUNCH_DATE))

  // ── Retention ─────────────────────────────────────────────────────────────
  const activeProfiles = profiles.filter(p => p.last_active_at)
  const dau = activeProfiles.filter(p => new Date(p.last_active_at!) >= d1).length
  const wau = activeProfiles.filter(p => new Date(p.last_active_at!) >= d7).length
  const mau = activeProfiles.filter(p => new Date(p.last_active_at!) >= d30).length

  // ── All-time counts ───────────────────────────────────────────────────────
  const archivedSearches     = (platformStats as { value: number } | null)?.value ?? 0
  const totalApiCallsAllTime = (liveApiCalls ?? 0) + archivedSearches
  const totalSearchesAllTime = liveUserSearches ?? 0

  // ── Trial conversion (post-launch only) ──────────────────────────────────
  const expiredTrials          = postLaunch.filter(p => p.trial_ends_at && new Date(p.trial_ends_at) < now)
  const convertedBeforeExpiry  = expiredTrials.filter(p => p.tier !== 'free')
  const activeTrials           = postLaunch.filter(p => p.trial_ends_at && new Date(p.trial_ends_at) >= now)
  const trialRate              = expiredTrials.length > 0
    ? +((convertedBeforeExpiry.length / expiredTrials.length) * 100).toFixed(1)
    : 0

  // ── Churn (ever paid → now free) ─────────────────────────────────────────
  const approvedUserIds = new Set((approvedUpgrades ?? []).map(r => r.user_id))
  const everPaid        = profiles.filter(p =>
    approvedUserIds.has(p.id) ||
    (p.stripe_customer_id ?? null) !== null ||
    (p.apple_original_transaction_id ?? null) !== null
  )
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

  // ── Cohort retention by signup week (last 6 weeks) ───────────────────────
  const sixWeeksAgo = new Date(now.getTime() - 42 * 86400000)
  const weekFloor = (d: Date): string => {
    const copy = new Date(d)
    copy.setUTCHours(0, 0, 0, 0)
    copy.setUTCDate(copy.getUTCDate() - copy.getUTCDay()) // floor to Sunday
    return copy.toISOString().slice(0, 10)
  }
  const recentSignups = profiles.filter(p => new Date(p.created_at) >= sixWeeksAgo)
  const cohortMap: Record<string, { signups: number; searched: number; portfolio: number; paid: number }> = {}
  for (const p of recentSignups) {
    const week = weekFloor(new Date(p.created_at))
    if (!cohortMap[week]) cohortMap[week] = { signups: 0, searched: 0, portfolio: 0, paid: 0 }
    cohortMap[week].signups++
    if (searchedSet.has(p.id)) cohortMap[week].searched++
    if (portfolioSet.has(p.id)) cohortMap[week].portfolio++
    if (p.tier !== 'free') cohortMap[week].paid++
  }
  const cohortRetention = Object.entries(cohortMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, d]) => ({
      week,
      signups:       d.signups,
      searched:      d.searched,
      portfolio:     d.portfolio,
      paid:          d.paid,
      searchRate:    d.signups > 0 ? +((d.searched  / d.signups) * 100).toFixed(1) : 0,
      portfolioRate: d.signups > 0 ? +((d.portfolio / d.signups) * 100).toFixed(1) : 0,
    }))

  // ── Trial day-by-day engagement ───────────────────────────────────────────
  // For each user with a trial, bucket searches by day relative to trial start (ends_at - 7d)
  const trialProfileMap: Record<string, Date> = {}
  for (const p of profiles) {
    if (p.trial_ends_at) {
      const trialStart = new Date(new Date(p.trial_ends_at).getTime() - 7 * 86400000)
      trialProfileMap[p.id] = trialStart
    }
  }
  const dayBuckets: Record<number, { searches: number; users: Set<string> }> = {}
  for (let i = 0; i <= 6; i++) dayBuckets[i] = { searches: 0, users: new Set() }
  for (const row of recentSearchLog ?? []) {
    if (!row.user_id || !row.searched_at) continue
    const trialStart = trialProfileMap[row.user_id]
    if (!trialStart) continue
    const dayOffset = Math.floor(
      (new Date(row.searched_at).getTime() - trialStart.getTime()) / 86400000
    )
    if (dayOffset >= 0 && dayOffset <= 6) {
      dayBuckets[dayOffset].searches++
      dayBuckets[dayOffset].users.add(row.user_id)
    }
  }
  const trialDayEngagement = Array.from({ length: 7 }, (_, i) => ({
    day:         i,
    searches:    dayBuckets[i].searches,
    uniqueUsers: dayBuckets[i].users.size,
  }))

  // ── Top 10 searched cards (last 90 days) ──────────────────────────────────
  const cardCountMap: Record<string, { cardName: string; count: number }> = {}
  for (const row of recentSearchLog ?? []) {
    if (!row.card_id) continue
    const key = row.card_id as string
    if (!cardCountMap[key]) cardCountMap[key] = { cardName: (row.card_name as string | null) ?? key, count: 0 }
    cardCountMap[key].count++
  }
  const topSearchedCards = Object.entries(cardCountMap)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([cardId, { cardName, count }]) => ({ cardId, cardName, count }))

  // ── Median hours: signup → first search ──────────────────────────────────
  const firstSearchMap: Record<string, number> = {}
  for (const row of recentSearchLog ?? []) {
    if (!row.user_id || !row.searched_at) continue
    const ts = new Date(row.searched_at).getTime()
    if (!(row.user_id in firstSearchMap) || ts < firstSearchMap[row.user_id]) {
      firstSearchMap[row.user_id] = ts
    }
  }
  const profileCreatedMap: Record<string, number> = {}
  for (const p of profiles) profileCreatedMap[p.id] = new Date(p.created_at).getTime()

  const hoursToFirstSearch: number[] = []
  for (const [uid, firstTs] of Object.entries(firstSearchMap)) {
    const createdTs = profileCreatedMap[uid]
    if (createdTs != null) {
      const hours = (firstTs - createdTs) / 3600000
      if (hours >= 0) hoursToFirstSearch.push(hours)
    }
  }
  hoursToFirstSearch.sort((a, b) => a - b)
  const medianHoursToFirstSearch = hoursToFirstSearch.length > 0
    ? +hoursToFirstSearch[Math.floor(hoursToFirstSearch.length / 2)].toFixed(1)
    : null

  // ── Paywall impressions ────────────────────────────────────────────────────
  const proUserIds = new Set(profiles.filter(p => p.tier !== 'free').map(p => p.id))
  const paywallContextMap: Record<string, { impressions: number; uniqueUsers: Set<string>; converted: number }> = {}
  for (const row of paywallEvents ?? []) {
    const ctx = (row.properties as { context?: string })?.context ?? 'unknown'
    if (!paywallContextMap[ctx]) paywallContextMap[ctx] = { impressions: 0, uniqueUsers: new Set(), converted: 0 }
    paywallContextMap[ctx].impressions++
    if (row.user_id) {
      paywallContextMap[ctx].uniqueUsers.add(row.user_id)
      if (proUserIds.has(row.user_id)) paywallContextMap[ctx].converted++
    }
  }
  const paywallImpressions = Object.entries(paywallContextMap)
    .sort(([, a], [, b]) => b.impressions - a.impressions)
    .map(([context, d]) => ({
      context,
      impressions:  d.impressions,
      uniqueUsers:  d.uniqueUsers.size,
      converted:    d.converted,
      conversionRate: d.uniqueUsers.size > 0
        ? +((d.converted / d.uniqueUsers.size) * 100).toFixed(1)
        : 0,
    }))

  // ── Pro feature adoption ───────────────────────────────────────────────────
  const featureUserMap: Record<string, Set<string>> = {}
  for (const row of featureUsedEvents ?? []) {
    if (!row.user_id) continue
    const feat = (row.properties as { feature?: string })?.feature ?? 'unknown'
    if (!featureUserMap[feat]) featureUserMap[feat] = new Set()
    featureUserMap[feat].add(row.user_id)
  }
  const proTotal = proUserIds.size
  const proFeatureAdoption = Object.entries(featureUserMap)
    .map(([feature, users]) => {
      const proUsers = [...users].filter(id => proUserIds.has(id)).length
      return {
        feature,
        users:    proUsers,
        proTotal,
        rate:     proTotal > 0 ? +((proUsers / proTotal) * 100).toFixed(1) : 0,
      }
    })
    .sort((a, b) => b.users - a.users)

  // ── Zombie trials (expired, never searched) ────────────────────────────────
  const zombieTrialCount = expiredTrials.filter(p => !searchedSet.has(p.id)).length

  // ── D1 / D3 / D7 return rates ─────────────────────────────────────────────
  // Build user_id → set of day offsets (relative to signup) where they searched
  const userSearchDayOffsets: Record<string, Set<number>> = {}
  for (const row of recentSearchLog ?? []) {
    if (!row.user_id || !row.searched_at) continue
    const created = profileCreatedMap[row.user_id]
    if (created == null) continue
    const offset = Math.floor((new Date(row.searched_at).getTime() - created) / 86400000)
    if (offset < 0 || offset > 90) continue
    if (!userSearchDayOffsets[row.user_id]) userSearchDayOffsets[row.user_id] = new Set()
    userSearchDayOffsets[row.user_id].add(offset)
  }

  const computeReturnRate = (dayN: number) => {
    // Only consider users signed up >= dayN days ago and <= 90 days (within recentSearchLog window)
    const cohort = postLaunch.filter(p => {
      const days = (now.getTime() - new Date(p.created_at).getTime()) / 86400000
      return days >= dayN && days <= 90
    })
    const returned = cohort.filter(p => userSearchDayOffsets[p.id]?.has(dayN)).length
    return { dayN, cohortSize: cohort.length, returned, rate: cohort.length > 0 ? +((returned / cohort.length) * 100).toFixed(1) : 0 }
  }
  const dayNReturnRates = [computeReturnRate(1), computeReturnRate(3), computeReturnRate(7)]

  // ── At-risk churners ───────────────────────────────────────────────────────
  const atRiskChurners = profiles.filter(p =>
    p.tier !== 'free' && (!p.last_active_at || new Date(p.last_active_at) < d30)
  ).length

  // ── Search depth distribution (post-launch) ───────────────────────────────
  const depthBuckets = { zero: 0, low: 0, mid: 0, high: 0, power: 0 }
  for (const id of postLaunchIds) {
    const c = searchCountMap[id] ?? 0
    if (c === 0)       depthBuckets.zero++
    else if (c <= 5)   depthBuckets.low++
    else if (c <= 20)  depthBuckets.mid++
    else if (c <= 50)  depthBuckets.high++
    else               depthBuckets.power++
  }
  const searchDepth = { ...depthBuckets, total: postLaunch.length }

  // ── Trending cards (this week vs last week) ────────────────────────────────
  const oneWeekAgo  = new Date(now.getTime() - 7  * 86400000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000)
  const thisWeekMap: Record<string, { cardName: string; count: number }> = {}
  const lastWeekMap: Record<string, number> = {}
  for (const row of recentSearchLog ?? []) {
    if (!row.card_id || !row.searched_at) continue
    const ts  = new Date(row.searched_at)
    const key = row.card_id as string
    const name = (row.card_name as string | null) ?? key
    if (ts >= oneWeekAgo) {
      if (!thisWeekMap[key]) thisWeekMap[key] = { cardName: name, count: 0 }
      thisWeekMap[key].count++
    } else if (ts >= twoWeeksAgo) {
      lastWeekMap[key] = (lastWeekMap[key] ?? 0) + 1
    }
  }
  const trendingCards = Object.entries(thisWeekMap)
    .map(([cardId, { cardName, count }]) => ({
      cardId,
      cardName,
      thisWeek: count,
      lastWeek: lastWeekMap[cardId] ?? 0,
      delta:    count - (lastWeekMap[cardId] ?? 0),
    }))
    .sort((a, b) => b.thisWeek - a.thisWeek)
    .slice(0, 10)

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
    apiCalls: {
      total:     totalApiCallsAllTime,
      yesterday: apiCallsYesterday ?? 0,
    },
    userSearches: {
      total:     totalSearchesAllTime,
      yesterday: userSearchesYesterday ?? 0,
    },
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
      cohortRetention,
      trialDayEngagement,
      topSearchedCards,
      medianHoursToFirstSearch,
      paywallImpressions,
      proFeatureAdoption,
      zombieTrials:   zombieTrialCount,
      dayNReturnRates,
      atRiskChurners,
      searchDepth,
      trendingCards,
    },
  })
}
