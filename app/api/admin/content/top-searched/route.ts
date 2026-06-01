/**
 * GET /api/admin/content/top-searched
 * Returns the top 5 most-searched cards in the last 7 days,
 * enriched with price, score, and verdict from search_cache.
 * Admin-only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7)
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

  // Fetch search_log entries from the last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: logs } = await admin
    .from('search_log')
    .select('card_id, card_name, grade, searched_at')
    .gte('searched_at', weekAgo)

  // Count searches per card_id + grade combo
  const countMap: Record<string, { card_id: string; card_name: string; grade: string; count: number }> = {}
  for (const row of logs ?? []) {
    if (!row.card_id || !row.grade) continue
    const key = `${row.card_id}:${row.grade}`
    if (!countMap[key]) {
      countMap[key] = { card_id: row.card_id, card_name: row.card_name ?? '', grade: row.grade, count: 0 }
    }
    countMap[key].count++
  }

  const top5 = Object.values(countMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  if (top5.length === 0) {
    return NextResponse.json({ cards: [], weekNum: getISOWeek(new Date()), year: new Date().getFullYear(), dateStr: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) })
  }

  // Enrich with cache data
  const cacheKeys = top5.map(c => `${c.card_id}:${c.grade}`)
  const { data: cacheRows } = await admin
    .from('search_cache')
    .select('cache_key, card_name, set_name, image_url, price, price_change_pct, score, score_breakdown, currency')
    .in('cache_key', cacheKeys)

  const cacheMap = Object.fromEntries((cacheRows ?? []).map(r => [r.cache_key, r]))

  const now = new Date()
  const cards = top5.map((c, i) => {
    const cache = cacheMap[`${c.card_id}:${c.grade}`] ?? {}
    const sb = cache.score_breakdown as { label?: string; total?: number } | null
    return {
      rank:        i + 1,
      card_id:     c.card_id,
      card_name:   (cache.card_name || c.card_name || 'Unknown').trim(),
      grade:       c.grade,
      set_name:    cache.set_name ?? null,
      image_url:   cache.image_url ?? null,
      price:       cache.price ?? null,
      price_change_pct: cache.price_change_pct ?? null,
      score:       cache.score ?? null,
      verdict:     sb?.label ?? null,
      currency:    cache.currency ?? 'USD',
      search_count: c.count,
    }
  })

  return NextResponse.json({
    cards,
    weekNum: getISOWeek(now),
    year:    now.getFullYear(),
    dateStr: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  })
}
