/**
 * Debug endpoint — shows raw Poketrace search results.
 * Usage: /api/debug/poketrace?name=Mega+Charizard+X+ex&tcgplayer_id=123456
 * Remove this file before going fully public.
 */
import { NextRequest, NextResponse } from 'next/server'

const BASE = 'https://api.poketrace.com/v1'

export async function GET(req: NextRequest) {
  const name        = req.nextUrl.searchParams.get('name') ?? ''
  const tcgplayerId = req.nextUrl.searchParams.get('tcgplayer_id') ?? ''
  const pokemontcgId = req.nextUrl.searchParams.get('ptcg_id') ?? ''

  const headers = {
    'X-API-Key': process.env.POKETRACE_API_KEY!,
    'Content-Type': 'application/json',
  }

  const results: Record<string, unknown> = {}

  // 1. Search by name
  if (name) {
    const r = await fetch(`${BASE}/cards?search=${encodeURIComponent(name)}&limit=20`, { headers })
    const json = await r.json()
    // Summarise to avoid massive response
    results.nameSearch = {
      count: json.data?.length ?? 0,
      cards: (json.data ?? []).map((c: Record<string, unknown>) => ({
        id: c.id,
        name: c.name,
        set: (c.set as Record<string, unknown>)?.name,
        cardNumber: c.cardNumber,
        variant: c.variant,
        topPrice: c.topPrice,
      })),
    }
  }

  // 1b. Fetch a card directly by its Poketrace ID (slug)
  const directId = req.nextUrl.searchParams.get('direct_id')
  if (directId) {
    const r = await fetch(`${BASE}/cards/${encodeURIComponent(directId)}`, { headers })
    const json = await r.json()
    results.directFetch = {
      status: r.status,
      name: json.data?.name,
      set: json.data?.set?.name,
      cardNumber: json.data?.cardNumber,
      topPrice: json.data?.topPrice,
      availableTiers: [
        ...Object.keys(json.data?.prices?.ebay ?? {}),
        ...Object.keys(json.data?.prices?.tcgplayer ?? {}),
      ],
    }
  }

  // 2. Search by TCGPlayer ID
  if (tcgplayerId) {
    const r = await fetch(`${BASE}/cards?tcgplayer_ids=${tcgplayerId}&limit=5`, { headers })
    results.tcgplayerIdSearch = await r.json()
  }

  // 3. Fetch pokemontcg.io card to get TCGPlayer URL
  if (pokemontcgId) {
    const r = await fetch(`https://api.pokemontcg.io/v2/cards/${pokemontcgId}`)
    const json = await r.json()
    const tcgUrl = json.data?.tcgplayer?.url ?? null
    const match = tcgUrl?.match(/\/product\/(\d+)/)
    const extractedId = match ? match[1] : null
    results.pokemontcgCard = {
      name: json.data?.name,
      set: json.data?.set?.name,
      number: json.data?.number,
      tcgplayerUrl: tcgUrl,
      extractedTcgPlayerId: extractedId,
    }

    // If we got a TCGPlayer ID, also search Poketrace with it
    if (extractedId) {
      const r2 = await fetch(`${BASE}/cards?tcgplayer_ids=${extractedId}&limit=5`, { headers })
      results.tcgplayerIdFromPtcg = await r2.json()
    }
  }

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
