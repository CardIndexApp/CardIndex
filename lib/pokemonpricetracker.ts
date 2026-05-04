/**
 * PokemonPriceTracker API client
 * https://www.pokemonpricetracker.com/api-reference
 *
 * Used as a fallback for JP cards that only have CardMarket AGGREGATED data
 * from Poketrace. Provides eBay sold listing prices for PSA/BGS/CGC grades.
 *
 * Credits: 1 (base) + 1 (includeEbay) = 2 per card lookup.
 * Results are cached in Supabase for 24h so credits are only spent once per card.
 */

import type { TierPrice } from './poketrace'

const BASE = 'https://www.pokemonpricetracker.com'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PptGrade {
  avg?: number
  low?: number
  high?: number
  count?: number
}

interface PptEbayData {
  psa10?: PptGrade
  psa9?:  PptGrade
  psa8?:  PptGrade
  psa7?:  PptGrade
  psa6?:  PptGrade
  bgs9_5?: PptGrade
  bgs9?:  PptGrade
  bgs8_5?: PptGrade
  cgc10?: PptGrade
  cgc9_5?: PptGrade
  cgc9?:  PptGrade
  raw?:   PptGrade
}

export interface PptCard {
  name: string
  id?: string
  ebay?: PptEbayData
}

// ── Grade key mapping ─────────────────────────────────────────────────────────

// Maps our Poketrace tier keys → PokemonPriceTracker eBay grade keys
const TIER_TO_PPT: Record<string, keyof PptEbayData> = {
  PSA_10:  'psa10',
  PSA_9:   'psa9',
  PSA_8:   'psa8',
  PSA_7:   'psa7',
  PSA_6:   'psa6',
  BGS_9_5: 'bgs9_5',
  BGS_9:   'bgs9',
  BGS_8_5: 'bgs8_5',
  CGC_10:  'cgc10',
  CGC_9_5: 'cgc9_5',
  CGC_9:   'cgc9',
  // Raw conditions all map to ungraded eBay sales
  NEAR_MINT:        'raw',
  MINT:             'raw',
  LIGHTLY_PLAYED:   'raw',
  MODERATELY_PLAYED:'raw',
  HEAVILY_PLAYED:   'raw',
  DAMAGED:          'raw',
}

// ── API helpers ───────────────────────────────────────────────────────────────

function apiHeaders(): HeadersInit {
  return { Authorization: `Bearer ${process.env.POKEMON_PRICE_TRACKER_API_KEY}` }
}

/**
 * Search PokemonPriceTracker for a card by name, returning the best name match
 * with eBay graded pricing included.
 *
 * language: 'japanese' searches JP sets. Costs 2 credits (base + ebay).
 */
export async function getPptCard(
  cardName: string,
  language: 'japanese' | 'english' = 'japanese',
): Promise<PptCard | null> {
  if (!process.env.POKEMON_PRICE_TRACKER_API_KEY) return null

  try {
    const params = new URLSearchParams({
      search:      cardName,
      language,
      includeEbay: 'true',
      limit:       '5',
    })
    const url = `${BASE}/api/v2/cards?${params}`
    const res = await fetch(url, {
      headers: apiHeaders(),
      cache:   'no-store',
    })

    if (!res.ok) {
      console.error(`[ppt] HTTP ${res.status} for "${cardName}"`)
      return null
    }

    const json = await res.json()
    console.log('[ppt] raw response keys:', JSON.stringify(Object.keys(json)))

    // Handle multiple possible response shapes:
    //   { data: [...] }  |  { cards: [...] }  |  bare array
    const rawList: unknown[] = Array.isArray(json) ? json : (json.data ?? json.cards ?? [])
    console.log(`[ppt] "${cardName}" → ${rawList.length} results`)

    if (!rawList.length) return null

    // Normalise: ebay data may be at card.ebay or card.prices.ebay
    const cards: PptCard[] = rawList.map((c: unknown) => {
      const card = c as Record<string, unknown>
      const ebay = (card.ebay ?? (card.prices as Record<string, unknown>)?.ebay) as PptEbayData | undefined
      return { name: card.name as string, id: card.id as string | undefined, ebay }
    })

    console.log('[ppt] first card:', JSON.stringify({ name: cards[0]?.name, hasEbay: !!cards[0]?.ebay, ebayKeys: cards[0]?.ebay ? Object.keys(cards[0].ebay) : [] }))

    // Prefer exact name match; fall back to first result
    const nameLower = cardName.toLowerCase()
    return cards.find(c => c.name?.toLowerCase() === nameLower) ?? cards[0]
  } catch (err) {
    console.error('[ppt] fetch error:', err)
    return null
  }
}

/**
 * Convert a PokemonPriceTracker eBay grade entry into our TierPrice shape.
 * Returns null if no data exists for that tier.
 */
export function pptToTierPrice(ebay: PptEbayData, tier: string): TierPrice | null {
  const key = TIER_TO_PPT[tier]
  if (!key) return null

  const data = ebay[key]
  if (!data?.avg) return null

  return {
    avg:        data.avg,
    low:        data.low,
    high:       data.high,
    saleCount:  data.count,
    confidence: data.count && data.count >= 5 ? 'high' : 'medium',
  }
}
