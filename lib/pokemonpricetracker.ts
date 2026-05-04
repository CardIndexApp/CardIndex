/**
 * PokemonPriceTracker API client
 * https://www.pokemonpricetracker.com/api-reference
 *
 * Used as a fallback for JP cards that only have CardMarket AGGREGATED data
 * from Poketrace. Provides eBay sold listing prices for PSA/BGS/CGC grades.
 *
 * Credits: cards_returned × (1 + includeEbay) = 2 per call (limit=1).
 * Results are cached in Supabase for 24h so credits are only spent once per card.
 *
 * Response shape (includeEbay=true):
 * {
 *   data: {                          ← single object (tcgPlayerId) or array (search)
 *     name, setName, prices: { market, ... },
 *     ebay: {
 *       salesByGrade: {
 *         psa10: { averagePrice: 15000, marketTrend: "stable" },
 *         psa9:  { averagePrice: 1500,  marketTrend: "rising" },
 *         ...
 *       }
 *     }
 *   }
 * }
 */

import type { TierPrice } from './poketrace'

const BASE = 'https://www.pokemonpricetracker.com'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PptGrade {
  averagePrice?: number
  marketTrend?:  string
}

interface PptSalesByGrade {
  psa10?:  PptGrade
  psa9?:   PptGrade
  psa8?:   PptGrade
  psa7?:   PptGrade
  psa6?:   PptGrade
  bgs9_5?: PptGrade
  bgs9?:   PptGrade
  bgs8_5?: PptGrade
  cgc10?:  PptGrade
  cgc9_5?: PptGrade
  cgc9?:   PptGrade
  raw?:      PptGrade
  ungraded?: PptGrade
}

interface PptEbayData {
  salesByGrade?: PptSalesByGrade
}

export interface PptCard {
  name: string
  id?:  string
  ebay?: PptEbayData
}

// ── Grade key mapping ─────────────────────────────────────────────────────────

// Maps our Poketrace tier keys → PokemonPriceTracker salesByGrade keys
const TIER_TO_PPT: Record<string, keyof PptSalesByGrade> = {
  PSA_10:           'psa10',
  PSA_9:            'psa9',
  PSA_8:            'psa8',
  PSA_7:            'psa7',
  PSA_6:            'psa6',
  BGS_9_5:          'bgs9_5',
  BGS_9:            'bgs9',
  BGS_8_5:          'bgs8_5',
  CGC_10:           'cgc10',
  CGC_9_5:          'cgc9_5',
  CGC_9:            'cgc9',
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
 * Search PokemonPriceTracker for a JP card by name with eBay graded pricing.
 * Costs 2 credits per call (1 card × (1 base + 1 ebay)).
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
      limit:       '1',
    })
    const res = await fetch(`${BASE}/api/v2/cards?${params}`, {
      headers: apiHeaders(),
      cache:   'no-store',
    })

    if (!res.ok) {
      console.error(`[ppt] HTTP ${res.status} for "${cardName}"`)
      return null
    }

    const json = await res.json()

    // data may be a single object (tcgPlayerId lookup) or an array (search)
    const raw = json.data ?? json.cards ?? json
    const items: unknown[] = Array.isArray(raw) ? raw : [raw]

    if (!items.length) return null

    const cards: PptCard[] = items.map((c: unknown) => {
      const card = c as Record<string, unknown>
      return {
        name: card.name as string,
        id:   card.id   as string | undefined,
        ebay: card.ebay as PptEbayData | undefined,
      }
    })

    console.log(`[ppt] "${cardName}" → ${cards.length} result(s), first: ${cards[0]?.name}, hasSalesByGrade: ${!!(cards[0]?.ebay?.salesByGrade)}`)

    const nameLower = cardName.toLowerCase()
    return cards.find(c => c.name?.toLowerCase() === nameLower) ?? cards[0]
  } catch (err) {
    console.error('[ppt] fetch error:', err)
    return null
  }
}

/**
 * Convert a PokemonPriceTracker eBay entry into our TierPrice shape.
 * Returns null if no data exists for that tier.
 */
export function pptToTierPrice(ebay: PptEbayData, tier: string): TierPrice | null {
  const salesByGrade = ebay.salesByGrade
  if (!salesByGrade) return null

  const key = TIER_TO_PPT[tier]
  if (!key) return null

  const data = salesByGrade[key]
  if (!data?.averagePrice) return null

  return {
    avg:        data.averagePrice,
    confidence: 'medium',
  }
}
