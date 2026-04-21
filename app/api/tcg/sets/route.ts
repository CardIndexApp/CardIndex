/**
 * GET /api/tcg/sets
 * Proxies pokemontcg.io sets with server-side caching so the browser
 * never waits on an external API — after first load it's instant.
 */
import { NextResponse } from 'next/server'

export async function GET() {
  const res = await fetch(
    'https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250',
    { next: { revalidate: 86400 } } // cache for 24h — sets don't change
  )
  if (!res.ok) return NextResponse.json({ data: [] }, { status: res.status })
  const json = await res.json()
  return NextResponse.json({ data: json.data ?? [] }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
  })
}
