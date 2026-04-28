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

  // Build the cache keys we need and fetch them all in one query
  const cacheKeys = [...new Set(rows.map(r => `${r.card_id}:${r.grade}`))]
  const { data: cacheRows } = cacheKeys.length
    ? await admin.from('search_cache').select('cache_key, price, last_fetched').in('cache_key', cacheKeys)
    : { data: [] }

  const priceMap = Object.fromEntries((cacheRows ?? []).map(c => [c.cache_key, c.price as number | null]))

  const portfolioStats = rows.reduce(
    (acc, row) => {
      const qty        = row.quantity ?? 1
      const cost       = (row.purchase_price ?? 0) * qty
      const mktPrice   = priceMap[`${row.card_id}:${row.grade}`] ?? null

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
