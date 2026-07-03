/**
 * GET /api/cron/prune
 *
 * Called by Vercel Cron weekly (Sunday 03:00 UTC, configured in vercel.json).
 *
 * Prunes two high-growth tables to keep the Supabase free-tier DB small:
 *
 *   search_log  — deletes rows older than 90 days.
 *                 Keeps 3 months of search history for analytics.
 *
 *   search_cache — deletes rows not updated in 30+ days whose card_id
 *                  does NOT appear in any active portfolio or watchlist.
 *                  Active cards stay cached so portfolio/watchlist prices
 *                  keep working without a re-fetch.
 *
 * Authentication: Vercel sets Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SEARCH_LOG_MAX_AGE_DAYS  = 90
const SEARCH_CACHE_MAX_AGE_DAYS = 30

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const log: string[] = []
  let totalDeleted = 0

  // ── 1. Prune search_log (archive count first) ─────────────────────────────

  const searchLogCutoff = new Date()
  searchLogCutoff.setDate(searchLogCutoff.getDate() - SEARCH_LOG_MAX_AGE_DAYS)

  // Count rows about to be deleted and add to the running total BEFORE deleting,
  // so the all-time search count in the admin dashboard stays accurate.
  const { count: expiredCount } = await admin
    .from('search_log')
    .select('*', { count: 'exact', head: true })
    .lt('searched_at', searchLogCutoff.toISOString())

  if ((expiredCount ?? 0) > 0) {
    await admin.rpc('increment_archived_searches', { amount: expiredCount })
  }

  const { count: logDeleted, error: logErr } = await admin
    .from('search_log')
    .delete({ count: 'exact' })
    .lt('searched_at', searchLogCutoff.toISOString())

  if (logErr) {
    log.push(`search_log error: ${logErr.message}`)
  } else {
    const n = logDeleted ?? 0
    totalDeleted += n
    log.push(`search_log: archived ${expiredCount ?? 0}, deleted ${n} rows older than ${SEARCH_LOG_MAX_AGE_DAYS}d`)
  }

  // ── 2. Prune search_cache (cold + not referenced) ─────────────────────────

  // Collect card_ids actively used in portfolios or watchlists.
  const [{ data: portfolioRows }, { data: watchlistRows }] = await Promise.all([
    admin.from('portfolios').select('card_id'),
    admin.from('watchlists').select('card_id'),
  ])

  const activeCardIds = new Set([
    ...(portfolioRows ?? []).map(r => r.card_id as string),
    ...(watchlistRows  ?? []).map(r => r.card_id as string),
  ])

  const cacheCutoff = new Date()
  cacheCutoff.setDate(cacheCutoff.getDate() - SEARCH_CACHE_MAX_AGE_DAYS)

  // Fetch candidate stale cache entries (card_id + last_fetched only).
  const { data: staleRows, error: staleErr } = await admin
    .from('search_cache')
    .select('card_id')
    .lt('last_fetched', cacheCutoff.toISOString())

  if (staleErr) {
    log.push(`search_cache fetch error: ${staleErr.message}`)
  } else {
    // Filter out card_ids still referenced by active portfolios/watchlists.
    const prunableIds = (staleRows ?? [])
      .map(r => r.card_id as string)
      .filter(id => !activeCardIds.has(id))

    if (prunableIds.length === 0) {
      log.push('search_cache: nothing to prune')
    } else {
      // Delete in batches of 500 to avoid query size limits.
      let cacheDeleted = 0
      for (let i = 0; i < prunableIds.length; i += 500) {
        const batch = prunableIds.slice(i, i + 500)
        const { count, error: delErr } = await admin
          .from('search_cache')
          .delete({ count: 'exact' })
          .in('card_id', batch)
          .lt('last_fetched', cacheCutoff.toISOString())

        if (delErr) {
          log.push(`search_cache batch ${i / 500 + 1} error: ${delErr.message}`)
        } else {
          cacheDeleted += count ?? 0
        }
      }
      totalDeleted += cacheDeleted
      log.push(
        `search_cache: deleted ${cacheDeleted} cold rows (>${SEARCH_CACHE_MAX_AGE_DAYS}d, not in portfolio/watchlist). ` +
        `Skipped ${activeCardIds.size} active card(s).`
      )
    }
  }

  return NextResponse.json({ ok: true, totalDeleted, log })
}
