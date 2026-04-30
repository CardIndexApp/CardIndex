/**
 * GET /api/home/trending
 *
 * Returns the 6 most-recently-viewed distinct cards (card_id + grade)
 * from the search_log, enriched with live price data from search_cache.
 *
 * Cached for 12 hours at the CDN level via Cache-Control and Next.js revalidate.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Next.js ISR: revalidate the route cache every 12 hours
export const revalidate = 43200

interface TrendingCard {
  id: string
  name: string
  set: string
  grade: string
  price: number
  change: number
  img: string
  searchedAt: string
}

export async function GET() {
  try {
    const supabase = createAdminClient()

    // Fetch the 100 most recent search_log entries (last 30 days)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: logs, error: logErr } = await supabase
      .from('search_log')
      .select('card_id, card_name, grade, searched_at')
      .gte('searched_at', since)
      .order('searched_at', { ascending: false })
      .limit(200)

    if (logErr || !logs?.length) {
      return NextResponse.json({ cards: [] }, {
        headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200' },
      })
    }

    // Deduplicate by card_id + grade, keeping the most recent search time per combo
    const seen = new Set<string>()
    const unique: typeof logs = []
    for (const row of logs) {
      if (!row.card_id || !row.grade) continue
      const key = `${row.card_id}:${row.grade}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(row)
        if (unique.length >= 12) break // fetch extra so we have fallbacks after price filter
      }
    }

    // Fetch price + image data from search_cache
    const cacheKeys = unique.map(r => `${r.card_id}:${r.grade}`)
    const { data: cacheRows } = await supabase
      .from('search_cache')
      .select('cache_key, price, price_change_pct, image_url, set_name, card_name')
      .in('cache_key', cacheKeys)

    const cacheMap = new Map((cacheRows ?? []).map(c => [c.cache_key, c]))

    const cards: TrendingCard[] = unique
      .map(log => {
        const cache = cacheMap.get(`${log.card_id}:${log.grade}`)
        if (!cache?.price) return null
        return {
          id: log.card_id,
          name: (cache.card_name || log.card_name || 'Unknown card').trim(),
          set: cache.set_name || '',
          grade: log.grade,
          price: cache.price,
          change: cache.price_change_pct ?? 0,
          img: cache.image_url || '',
          searchedAt: log.searched_at,
        }
      })
      .filter((c): c is TrendingCard => c !== null)
      .slice(0, 6)

    return NextResponse.json({ cards }, {
      headers: { 'Cache-Control': 'public, max-age=43200, stale-while-revalidate=86400' },
    })
  } catch (err) {
    console.error('[/api/home/trending]', err)
    return NextResponse.json({ cards: [] }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
    })
  }
}
