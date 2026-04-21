/**
 * GET /api/pt/sets?search=&cursor=
 * Proxy for Poketrace /sets — keeps API key server-side.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  if (!process.env.POKETRACE_API_KEY) {
    return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
  }

  const search = req.nextUrl.searchParams.get('search') ?? ''
  const cursor = req.nextUrl.searchParams.get('cursor') ?? ''

  const params = new URLSearchParams({ game: 'pokemon', limit: '100' })
  if (search) params.set('search', search)
  if (cursor) params.set('cursor', cursor)

  try {
    const res = await fetch(`https://api.poketrace.com/v1/sets?${params}`, {
      headers: { 'X-API-Key': process.env.POKETRACE_API_KEY },
      next: { revalidate: search ? 300 : 3600 },
    })
    if (!res.ok) return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
    const json = await res.json()
    return NextResponse.json(json, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' },
    })
  } catch {
    return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
  }
}
