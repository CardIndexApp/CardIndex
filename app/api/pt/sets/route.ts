/**
 * GET /api/pt/sets
 * Proxy for Poketrace /sets — keeps API key server-side.
 *
 * Paginates through ALL sets server-side, deduplicates by name (keeps highest
 * cardCount), and returns the full list. Cached 1 hour via CDN.
 *
 * NOTE: Poketrace /sets returns releaseDate: null for all sets.
 *       Era grouping is handled client-side from slug + name matching.
 * NOTE: Poketrace has a burst rate limit — we add a 1.2s delay between pages
 *       and retry once on 429. After the first load the CDN caches the result.
 */
import { NextRequest, NextResponse } from 'next/server'

interface PtSet {
  slug: string
  name: string
  releaseDate: string | null
  cardCount: number
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function GET(_req: NextRequest) {
  if (!process.env.POKETRACE_API_KEY) {
    return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
  }

  const allSets: PtSet[] = []
  let cursor = ''
  let hasMore = true
  const MAX_PAGES = 10

  for (let page = 0; page < MAX_PAGES && hasMore; page++) {
    if (page > 0) await delay(1200) // respect burst rate limit between pages

    const params = new URLSearchParams({ game: 'pokemon', limit: '100' })
    if (cursor) params.set('cursor', cursor)
    const url = `https://api.poketrace.com/v1/sets?${params}`

    let res = await fetch(url, {
      headers: { 'X-API-Key': process.env.POKETRACE_API_KEY },
      next: { revalidate: 3600 },
    })

    // Retry once on burst rate limit
    if (res.status === 429) {
      await delay(1500)
      res = await fetch(url, {
        headers: { 'X-API-Key': process.env.POKETRACE_API_KEY },
        next: { revalidate: 3600 },
      })
    }

    if (!res.ok) break
    const json = await res.json()
    if (!json.data?.length) break

    allSets.push(...json.data)
    hasMore = json.pagination?.hasMore ?? false
    cursor  = json.pagination?.nextCursor ?? ''
  }

  // Deduplicate by name — Poketrace splits old sets into many small variant
  // subsets. Keep the entry with the most cards per unique name.
  const byName = new Map<string, PtSet>()
  for (const s of allSets) {
    if (s.cardCount === 0) continue
    const existing = byName.get(s.name)
    if (!existing || s.cardCount > existing.cardCount) {
      byName.set(s.name, s)
    }
  }

  return NextResponse.json(
    { data: Array.from(byName.values()), pagination: { hasMore: false, count: byName.size } },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' } }
  )
}
