/**
 * GET /api/pt/sets?search=&cursor=
 * Proxy for Poketrace /sets — keeps API key server-side.
 *
 * When no search query: paginates through ALL sets server-side, returns them
 * sorted by releaseDate descending (newest first). Cached 1 hour.
 *
 * When search query: returns first page of results (up to 100), sorted desc.
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

  const search = req.nextUrl.searchParams.get('search') ?? ''

  // When searching, a single page is enough — return as-is
  if (search) {
    const params = new URLSearchParams({ game: 'pokemon', limit: '100', search })
    try {
      const res = await fetch(`https://api.poketrace.com/v1/sets?${params}`, {
        headers: { 'X-API-Key': process.env.POKETRACE_API_KEY },
        next: { revalidate: 300 },
      })
      if (!res.ok) return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
      const json = await res.json()
      const sorted = sortByDateDesc(json.data ?? [])
      return NextResponse.json(
        { data: sorted, pagination: { hasMore: false, count: sorted.length } },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
      )
    } catch {
      return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
    }
  }

  // No search — paginate through all sets server-side
  const allSets: PtSet[] = []
  let cursor = ''
  let hasMore = true
  const MAX_PAGES = 10 // safety cap: 10 × 100 = 1000 sets max

  for (let page = 0; page < MAX_PAGES && hasMore; page++) {
    const params = new URLSearchParams({ game: 'pokemon', limit: '100' })
    if (cursor) params.set('cursor', cursor)

    try {
      const res = await fetch(`https://api.poketrace.com/v1/sets?${params}`, {
        headers: { 'X-API-Key': process.env.POKETRACE_API_KEY },
        next: { revalidate: 3600 },
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

  const sorted = sortByDateDesc(allSets)

  return NextResponse.json(
    { data: sorted, pagination: { hasMore: false, count: sorted.length } },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' } }
  )
}

function sortByDateDesc(sets: PtSet[]): PtSet[] {
  return [...sets].sort((a, b) => {
    if (!a.releaseDate && !b.releaseDate) return 0
    if (!a.releaseDate) return 1
    if (!b.releaseDate) return -1
    return b.releaseDate.localeCompare(a.releaseDate)
  })
}
