/**
 * GET /api/tcg/cards?setId=xy1
 * Proxies pokemontcg.io card list for a set with server-side caching.
 * Card lists for a given set never change so we cache for 24h.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const setId = req.nextUrl.searchParams.get('setId')
  if (!setId) return NextResponse.json({ data: [] }, { status: 400 })

  const res = await fetch(
    `https://api.pokemontcg.io/v2/cards?q=set.id:${encodeURIComponent(setId)}&pageSize=250&orderBy=number`,
    { next: { revalidate: 86400 } }
  )
  if (!res.ok) return NextResponse.json({ data: [] }, { status: res.status })
  const json = await res.json()
  return NextResponse.json({ data: json.data ?? [] }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
  })
}
