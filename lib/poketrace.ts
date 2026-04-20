/**
 * Poketrace Pricing API client
 * Base URL: https://api.poketrace.com/v1
 * Auth: X-API-Key header
 */

const BASE = 'https://api.poketrace.com/v1'

function apiHeaders(): Record<string, string> {
  return {
    'X-API-Key': process.env.POKETRACE_API_KEY!,
    'Content-Type': 'application/json',
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TierPrice {
  avg: number
  low?: number
  high?: number
  saleCount?: number
  lastUpdated: string
  avg1d?: number
  avg7d?: number
  avg30d?: number
  median3d?: number
  median7d?: number
  median30d?: number
  country?: Record<string, { avg: number; low: number; high: number; saleCount: number }>
}

export interface PokétraceCard {
  id: string
  name: string
  cardNumber: string
  set: { slug: string; name: string }
  variant?: string
  rarity: string
  image: string
  game: string
  market: 'US' | 'EU'
  currency: 'USD' | 'EUR'
  prices: {
    ebay?: Record<string, TierPrice>
    tcgplayer?: Record<string, TierPrice>
    cardmarket?: { AGGREGATED: TierPrice }
    cardmarket_unsold?: Record<string, TierPrice>
  }
  gradedOptions?: string[]
  conditionOptions?: string[]
  topPrice?: number
  totalSaleCount?: number
  hasGraded?: boolean
  lastUpdated: string
}

export interface PriceHistoryPoint {
  date: string
  source: string
  avg: number
  low?: number
  high?: number
  saleCount?: number
  avg1d?: number
  avg7d?: number
  avg30d?: number
}

// ── Grade/Tier conversion ──────────────────────────────────────────────────────

/**
 * Convert display grade to Poketrace tier key.
 * "PSA 10" → "PSA_10", "BGS 9.5" → "BGS_9_5", "Raw" → "NEAR_MINT"
 */
export function gradeToTier(grade: string): string {
  if (!grade || grade === 'Raw' || grade === 'Ungraded') return 'NEAR_MINT'
  return grade.trim().replace(/\s+/g, '_').replace(/\./g, '_')
}

/**
 * Pick the best TierPrice from a card's prices object for a given tier.
 * For graded tiers → use ebay source.
 * For raw/condition tiers → prefer tcgplayer, fall back to ebay.
 */
export function getTierPrice(card: PokétraceCard, tier: string): TierPrice | null {
  const rawTiers = ['NEAR_MINT', 'MINT', 'LIGHTLY_PLAYED', 'MODERATELY_PLAYED', 'HEAVILY_PLAYED', 'DAMAGED']
  const isRaw = rawTiers.includes(tier)

  if (card.market === 'EU') {
    return card.prices.cardmarket?.AGGREGATED ?? null
  }

  if (isRaw) {
    const tcp = card.prices.tcgplayer?.[tier]
    if (tcp) return tcp
    return card.prices.ebay?.[tier] ?? null
  }

  // Graded — use eBay
  return card.prices.ebay?.[tier] ?? null
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * Search cards by name (and optionally set slug).
 * Returns up to 20 results.
 */
export async function searchPokétraceCards(
  name: string,
  options: { setSlug?: string; limit?: number } = {}
): Promise<PokétraceCard[]> {
  try {
    const params = new URLSearchParams({
      search: name,
      limit: String(options.limit ?? 20),
    })
    if (options.setSlug) params.set('set', options.setSlug)

    const res = await fetch(`${BASE}/cards?${params}`, {
      headers: apiHeaders(),
      next: { revalidate: 3600 }, // 1h cache on the search results
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.data as PokétraceCard[]) ?? []
  } catch {
    return []
  }
}

/**
 * Get a single card with full pricing by Poketrace card ID.
 */
export async function getPokétraceCard(id: string): Promise<PokétraceCard | null> {
  try {
    const res = await fetch(`${BASE}/cards/${id}`, {
      headers: apiHeaders(),
      next: { revalidate: 0 }, // always fetch fresh pricing
    })
    if (!res.ok) return null
    const json = await res.json()
    return (json.data as PokétraceCard) ?? null
  } catch {
    return null
  }
}

/**
 * Get price history for a card + tier.
 * period: "7d" | "30d" | "90d" | "1y"
 */
export async function getPriceHistory(
  cardId: string,
  tier: string,
  period: '7d' | '30d' | '90d' | '1y' = '30d'
): Promise<PriceHistoryPoint[]> {
  try {
    const res = await fetch(
      `${BASE}/cards/${cardId}/prices/${encodeURIComponent(tier)}/history?period=${period}&limit=90`,
      { headers: apiHeaders() }
    )
    if (!res.ok) return []
    const json = await res.json()
    return (json.data as PriceHistoryPoint[]) ?? []
  } catch {
    return []
  }
}

/**
 * Find the best Poketrace card match for a given card name + set name.
 * Tries exact name match within the same set first, then falls back to
 * closest name match.
 */
export async function findBestMatch(
  cardName: string,
  setName: string
): Promise<PokétraceCard | null> {
  const results = await searchPokétraceCards(cardName, { limit: 20 })
  if (!results.length) return null

  // 1. Try exact name + set name match
  const exactSetMatch = results.find(
    r => r.name.toLowerCase() === cardName.toLowerCase() &&
         r.set.name.toLowerCase() === setName.toLowerCase()
  )
  if (exactSetMatch) return exactSetMatch

  // 2. Exact name match (any set)
  const exactNameMatch = results.find(
    r => r.name.toLowerCase() === cardName.toLowerCase()
  )
  if (exactNameMatch) return exactNameMatch

  // 3. First result
  return results[0]
}
