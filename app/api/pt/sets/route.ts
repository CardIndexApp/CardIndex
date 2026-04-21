/**
 * GET /api/pt/sets?search=
 * Proxy for Poketrace /sets — keeps API key server-side.
 *
 * NOTE: Poketrace /sets returns releaseDate: null for all sets.
 * Era grouping is handled client-side from slug prefix.
 *
 * No search  → paginates through ALL sets, deduplicates by name (keeps highest
 *              cardCount entry), returns combined list. Cached 1 hour via CDN.
 * With search → client-side filters the cached full list; this endpoint is not
 *              called for search.
 */
import { NextRequest, NextResponse } from 'next/server'

interface PtSet {
  slug: string
  name: string
  releaseDate: string | null
  cardCount: number
}

export async function GET(req: NextRequest) {
  if (!process.env.POKETRACE_API_KEY) {
    return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
  }

  // Search is handled client-side against the cached full list.
  // If somehow called with search, hit the API directly.
  const search = req.nextUrl.searchParams.get('search') ?? ''
  if (search) {
    const params = new URLSearchParams({ game: 'pokemon', limit: '100', search })
    try {
      const res = await fetch(`https://api.poketrace.com/v1/sets?${params}`, {
        headers: { 'X-API-Key': process.env.POKETRACE_API_KEY },
        cache: 'no-store',
      })
      if (!res.ok) return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
      const json = await res.json()
      return NextResponse.json({ data: json.data ?? [], pagination: { hasMore: false, count: (json.data ?? []).length } })
    } catch {
      return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
    }
  }

  // Paginate through ALL sets. Use cache: 'no-store' so each paginated request
  // is actually made (not collapsed by Next.js fetch deduplication).
  const allSets: PtSet[] = []
  let cursor = ''
  let hasMore = true
  const MAX_PAGES = 10 // 10 × 100 = 1000 sets max

  for (let page = 0; page < MAX_PAGES && hasMore; page++) {
    const params = new URLSearchParams({ game: 'pokemon', limit: '100' })
    if (cursor) params.set('cursor', cursor)

    try {
      const res = await fetch(`https://api.poketrace.com/v1/sets?${params}`, {
        headers: { 'X-API-Key': process.env.POKETRACE_API_KEY },
        cache: 'no-store',
      })
      if (!res.ok) break
      const json = await res.json()
      allSets.push(...(json.data ?? []))
      hasMore = json.pagination?.hasMore ?? false
      cursor  = json.pagination?.nextCursor ?? ''
    } catch {
      break
    }
  }

  // Deduplicate by name — Poketrace splits old sets into many variant subsets
  // (e.g. 30+ "Aquapolis" entries each with 2 cards). Keep the one with the
  // most cards so users see a clean list of real sets.
  const byName = new Map<string, PtSet>()
  for (const s of allSets) {
    if (s.cardCount === 0) continue
    const existing = byName.get(s.name)
    if (!existing || s.cardCount > existing.cardCount) {
      byName.set(s.name, s)
    }
  }
  const deduped = Array.from(byName.values())

  return NextResponse.json(
    { data: deduped, pagination: { hasMore: false, count: deduped.length } },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' } }
  )
}
