/**
 * GET /api/pt/cards?set={slug}&search=&cursor=
 * Proxy for Poketrace /cards — keeps API key server-side.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isCardResult } from '@/lib/cardFilter'

export async function GET(req: NextRequest) {
  if (!process.env.POKETRACE_API_KEY) {
    return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
  }

  const set        = req.nextUrl.searchParams.get('set')         ?? ''
  const search     = req.nextUrl.searchParams.get('search')      ?? ''
  const cardNumber = req.nextUrl.searchParams.get('card_number') ?? ''
  const cursor     = req.nextUrl.searchParams.get('cursor')      ?? ''

  if (!set && !search && !cardNumber) {
    return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
  }

  const params = new URLSearchParams({ game: 'pokemon', market: 'US', limit: '20' })
  if (set)        params.set('set', set)
  if (search)     params.set('search', search)
  if (cardNumber) params.set('card_number', cardNumber)
  if (cursor)     params.set('cursor', cursor)

  try {
    const res = await fetch(`https://api.poketrace.com/v1/cards?${params}`, {
      headers: { 'X-API-Key': process.env.POKETRACE_API_KEY },
      next: { revalidate: 86400 }, // cache 24h — card catalogue data rarely changes
    })
    if (!res.ok) return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
    const json = await res.json()
    // Strip sealed products (booster boxes, tins, decks, etc.) — only return single cards
    const filtered = (json.data ?? []).filter(isCardResult)
    return NextResponse.json(
      { ...json, data: filtered, pagination: { ...json.pagination, count: filtered.length } },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' } }
    )
  } catch {
    return NextResponse.json({ data: [], pagination: { hasMore: false, count: 0 } })
  }
}
