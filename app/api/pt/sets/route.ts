/**
 * GET /api/pt/sets?search=
 * Proxy for Poketrace /sets — keeps API key server-side.
 *
 * NOTE: Poketrace /sets always returns releaseDate: null for all sets.
 * Sorting/grouping by era is handled client-side from the slug prefix.
 *
 * No search: paginates through ALL sets server-side and returns the full list.
 * With search: filters client-side (caller passes full list, but search
 *   hits the API for server-side keyword matching as a fallback).
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  if (!process.env.POKETRACE_API_KEY) {
    return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
  }

  const search = req.nextUrl.searchParams.get('search') ?? ''

  // When searching, hit the API directly (keyword match)
  if (search) {
    const params = new URLSearchParams({ game: 'pokemon', limit: '100', search })
    try {
      const res = await fetch(`https://api.poketrace.com/v1/sets?${params}`, {
        headers: { 'X-API-Key': process.env.POKETRACE_API_KEY },
        next: { revalidate: 300 },
      })
      if (!res.ok) return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
      const json = await res.json()
      return NextResponse.json(
        { data: json.data ?? [], pagination: { hasMore: false, count: (json.data ?? []).length } },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
      )
    } catch {
      return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
    }
  }

  // No search — paginate through all sets server-side and return combined list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSets: any[] = []
  let cursor = ''
  let hasMore = true
  const MAX_PAGES = 10 // safety cap (10 × 100 = 1000 sets)

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

  return NextResponse.json(
    { data: allSets, pagination: { hasMore: false, count: allSets.length } },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' } }
  )
}
