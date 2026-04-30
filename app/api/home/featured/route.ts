/**
 * GET /api/home/featured
 *
 * Returns the top 6 cards for the "Market highlights" section.
 * Priority order:
 *   1. Cards in market_constituents joined with live search_cache data
 *   2. Fallback: top-scored cards directly from search_cache
 *
 * Cached for 12 hours.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 43200

export interface FeaturedCard {
  id: string
  name: string
  set: string
  grade: string
  price: number
  change: number
  score: number
  img: string
}

export async function GET() {
  try {
    const supabase = createAdminClient()

    // ── 1. Try market_constituents ──────────────────────────────────────────
    const { data: constituents } = await supabase
      .from('market_constituents')
      .select('card_id, grade, card_name, set_name, image_url')
      .limit(100)

    let cards: FeaturedCard[] = []

    if (constituents && constituents.length > 0) {
      const cacheKeys = constituents.map(c => `${c.card_id}:${c.grade}`)
      const { data: cacheRows } = await supabase
        .from('search_cache')
        .select('cache_key, price, price_change_pct, score, image_url, card_name, set_name')
        .in('cache_key', cacheKeys)
        .gt('price', 0)

      const cacheMap = new Map((cacheRows ?? []).map(r => [r.cache_key, r]))

      cards = constituents
        .map(c => {
          const cache = cacheMap.get(`${c.card_id}:${c.grade}`)
          if (!cache?.price) return null
          return {
            id: c.card_id,
            name: (cache.card_name || c.card_name || '').trim(),
            set: cache.set_name || c.set_name || '',
            grade: c.grade,
            price: cache.price,
            change: cache.price_change_pct ?? 0,
            score: cache.score ?? 0,
            img: cache.image_url || c.image_url || '',
          }
        })
        .filter((c): c is FeaturedCard => c !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
    }

    // ── 2. Fallback: top-scored cards from search_cache ─────────────────────
    if (cards.length < 6) {
      const need = 6 - cards.length
      const existingIds = new Set(cards.map(c => `${c.id}:${c.grade}`))

      const { data: topRows } = await supabase
        .from('search_cache')
        .select('cache_key, card_id, card_name, set_name, grade, price, price_change_pct, score, image_url')
        .gt('price', 0)
        .not('score', 'is', null)
        .order('score', { ascending: false })
        .limit(50)

      const extras = (topRows ?? [])
        .filter(r => !existingIds.has(`${r.card_id}:${r.grade}`) && r.price > 0)
        .slice(0, need)
        .map(r => ({
          id: r.card_id,
          name: (r.card_name || '').trim(),
          set: r.set_name || '',
          grade: r.grade,
          price: r.price,
          change: r.price_change_pct ?? 0,
          score: r.score ?? 0,
          img: r.image_url || '',
        }))

      cards = [...cards, ...extras]
    }

    return NextResponse.json({ cards }, {
      headers: { 'Cache-Control': 'public, max-age=43200, stale-while-revalidate=86400' },
    })
  } catch (err) {
    console.error('[/api/home/featured]', err)
    return NextResponse.json({ cards: [] }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
    })
  }
}
