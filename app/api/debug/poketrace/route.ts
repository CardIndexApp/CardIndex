/**
 * Debug endpoint — shows raw Poketrace search results.
 *
 * Usage:
 *   ?name=Mega+Charizard+X+ex           → name search
 *   ?tcgplayer_id=123456                 → TCGPlayer ID lookup
 *   ?set_search=Phantasmal+Flames        → set slug lookup
 *   ?ptcg_id=sv9pt5-125                  → full pokemontcg.io card info + all matching strategies
 *   ?direct_id=UUID                      → fetch card by Poketrace UUID
 *   ?set=me02-phantasmal-flames&num=125/094 → set+number lookup
 *
 * Remove this file before going fully public.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPoketraceSetSlug, findBySetAndNumber, toPoketraceVariants } from '@/lib/poketrace'

const BASE = 'https://api.poketrace.com/v1'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const name          = searchParams.get('name') ?? ''
  const tcgplayerId   = searchParams.get('tcgplayer_id') ?? ''
  const pokemontcgId  = searchParams.get('ptcg_id') ?? ''
  const directId      = searchParams.get('direct_id') ?? ''
  const setSearchTerm = searchParams.get('set_search') ?? ''
  const setSlugParam  = searchParams.get('set') ?? ''
  const numParam      = searchParams.get('num') ?? ''

  // ── 0. Environment / health check (always runs) ────────────────────────────
  const apiKey = process.env.POKETRACE_API_KEY
  const results: Record<string, unknown> = {
    env: {
      POKETRACE_API_KEY: apiKey ? `SET (starts with ${apiKey.slice(0, 6)}...)` : 'NOT SET ❌',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET ✓' : 'NOT SET',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET ✓' : 'NOT SET',
    },
  }

  // Health check
  try {
    const health = await fetch('https://api.poketrace.com/v1/health', {
      headers: { 'X-API-Key': apiKey ?? '' },
    })
    results.health = { status: health.status, ok: health.ok, body: await health.text() }
  } catch (e) {
    results.health = { error: String(e) }
  }

  const headers = {
    'X-API-Key': apiKey ?? '',
    'Content-Type': 'application/json',
  }

  // ── 1. Name search ──────────────────────────────────────────────────────────
  if (name) {
    const r = await fetch(`${BASE}/cards?search=${encodeURIComponent(name)}&limit=20`, { headers })
    const json = await r.json()
    results.nameSearch = {
      status: r.status,
      count: json.data?.length ?? 0,
      cards: (json.data ?? []).map((c: Record<string, unknown>) => ({
        id: c.id,
        name: c.name,
        set: (c.set as Record<string, unknown>)?.name,
        setSlug: (c.set as Record<string, unknown>)?.slug,
        cardNumber: c.cardNumber,
        variant: c.variant,
        topPrice: c.topPrice,
        refs: c.refs,
      })),
    }
  }

  // ── 2. TCGPlayer ID search ──────────────────────────────────────────────────
  if (tcgplayerId) {
    const r = await fetch(`${BASE}/cards?tcgplayer_ids=${tcgplayerId}&limit=5`, { headers })
    const json = await r.json()
    results.tcgplayerIdSearch = {
      status: r.status,
      count: json.data?.length ?? 0,
      cards: (json.data ?? []).map((c: Record<string, unknown>) => ({
        id: c.id,
        name: c.name,
        set: (c.set as Record<string, unknown>)?.name,
        setSlug: (c.set as Record<string, unknown>)?.slug,
        cardNumber: c.cardNumber,
        variant: c.variant,
        topPrice: c.topPrice,
      })),
    }
  }

  // ── 3. Direct card fetch by UUID ────────────────────────────────────────────
  if (directId) {
    const r = await fetch(`${BASE}/cards/${encodeURIComponent(directId)}`, { headers })
    const json = await r.json()
    results.directFetch = {
      status: r.status,
      id: json.data?.id,
      name: json.data?.name,
      set: json.data?.set?.name,
      setSlug: json.data?.set?.slug,
      cardNumber: json.data?.cardNumber,
      variant: json.data?.variant,
      topPrice: json.data?.topPrice,
      refs: json.data?.refs,
      availableTiers: [
        ...Object.keys(json.data?.prices?.ebay ?? {}),
        ...Object.keys(json.data?.prices?.tcgplayer ?? {}),
      ],
    }
  }

  // ── 4. Set slug lookup ──────────────────────────────────────────────────────
  if (setSearchTerm) {
    const r = await fetch(`${BASE}/sets?search=${encodeURIComponent(setSearchTerm)}&limit=10`, { headers })
    const json = await r.json()
    const resolvedSlug = await getPoketraceSetSlug(setSearchTerm)
    results.setSearch = {
      status: r.status,
      query: setSearchTerm,
      resolvedSlug,
      sets: (json.data ?? []).map((s: Record<string, unknown>) => ({
        slug: s.slug,
        name: s.name,
        cardCount: s.cardCount,
      })),
    }
  }

  // ── 5. Set + number lookup ──────────────────────────────────────────────────
  if (setSlugParam && numParam) {
    const r = await fetch(
      `${BASE}/cards?set=${encodeURIComponent(setSlugParam)}&card_number=${encodeURIComponent(numParam)}&limit=10`,
      { headers }
    )
    const json = await r.json()
    results.setAndNumberSearch = {
      status: r.status,
      query: { set: setSlugParam, card_number: numParam },
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

  // ── 6. Full pokemontcg.io card info + all strategies ───────────────────────
  if (pokemontcgId) {
    const r = await fetch(`https://api.pokemontcg.io/v2/cards/${pokemontcgId}`)
    const json = await r.json()
    const data = json.data

    const tcgUrl = data?.tcgplayer?.url ?? null
    const tcgMatch = tcgUrl?.match(/\/product\/(\d+)/)
    const extractedTcgPlayerId = tcgMatch ? tcgMatch[1] : null

    const number = data?.number as string | undefined
    const printedTotal = data?.set?.printedTotal as number | undefined
    const total = printedTotal ?? data?.set?.total as number | undefined
    const numPart = number?.replace(/[^0-9]/g, '') ?? ''
    const fullNumber = total
      ? `${numPart.padStart(3, '0')}/${String(total).padStart(3, '0')}`
      : number ?? null

    const variants = toPoketraceVariants(data?.subtypes ?? [], data?.supertypes ?? [])
    const setName  = data?.set?.name as string | undefined

    results.pokemontcgCard = {
      name: data?.name,
      set: setName,
      number: data?.number,
      fullNumber,
      subtypes: data?.subtypes,
      supertypes: data?.supertypes,
      derivedVariants: variants,
      tcgplayerUrl: tcgUrl,
      extractedTcgPlayerId,
    }

    // Strategy A: TCGPlayer ID
    if (extractedTcgPlayerId) {
      const r2 = await fetch(`${BASE}/cards?tcgplayer_ids=${extractedTcgPlayerId}&limit=5`, { headers })
      const json2 = await r2.json()
      results.strategyA_tcgplayerId = {
        status: r2.status,
        found: (json2.data?.length ?? 0) > 0,
        card: json2.data?.[0] ? {
          id: json2.data[0].id,
          name: json2.data[0].name,
          set: json2.data[0].set?.name,
          cardNumber: json2.data[0].cardNumber,
          variant: json2.data[0].variant,
        } : null,
      }
    }

    // Strategy B: Set slug + card number
    if (setName && fullNumber) {
      const setSlug = await getPoketraceSetSlug(setName)
      if (setSlug) {
        const found = await findBySetAndNumber(data?.name ?? '', setSlug, fullNumber, variants)
        results.strategyB_setAndNumber = {
          resolvedSetSlug: setSlug,
          fullNumber,
          variants,
          found: !!found,
          card: found ? {
            id: found.id,
            name: found.name,
            set: found.set.name,
            cardNumber: found.cardNumber,
            variant: found.variant,
            topPrice: found.topPrice,
          } : null,
        }
      } else {
        results.strategyB_setAndNumber = { resolvedSetSlug: null, reason: 'set slug not found' }
      }
    }
  }

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
