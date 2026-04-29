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

  // Portfolio stats — fetch all positions + join against search_cache for market prices
  const { data: portfolioRows } = await admin
    .from('portfolios')
    .select('card_id, grade, purchase_price, quantity, user_id')

  const rows = portfolioRows ?? []

  // ── Exact lookup: cache_key = card_id:grade ──────────────────────────────
  const exactKeys = [...new Set(rows.map(r => `${r.card_id}:${r.grade}`))]
  const { data: exactCacheRows } = exactKeys.length
    ? await admin.from('search_cache').select('cache_key, card_id, price, last_fetched').in('cache_key', exactKeys)
    : { data: [] }

  const exactPriceMap = Object.fromEntries(
    (exactCacheRows ?? []).map(c => [c.cache_key, c.price as number | null])
  )

  // ── Fallback: for positions with no exact cache hit, look up any priced
  //    cache entry for that card_id (covers stale keys, grade format drift,
  //    and entries written before the DB migration fixed the upsert).
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

  // For each missing card_id, prefer a matching-grade row, then take the
  // most-recently-fetched row as a best-effort fallback.
  const fallbackPriceMap: Record<string, number> = {}
  for (const row of (fallbackCacheRows ?? [])) {
    const key = row.card_id
    if (!fallbackPriceMap[key]) {
      // first row is most recent — use it unless we find a grade match later
      fallbackPriceMap[key] = row.price as number
    }
  }
  // Prefer exact grade match where available
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

  return NextResponse.json({
    users: users ?? [],
    requests,
    portfolioStats: {
      totalCostBasis:    portfolioStats.totalCostBasis,
      totalMarketValue:  portfolioStats.totalMarketValue,
      totalPositions:    portfolioStats.totalPositions,
      pricedPositions:   portfolioStats.pricedPositions,
      usersWithPortfolio: portfolioStats.usersWithPortfolio.size,
    },
  })
}
