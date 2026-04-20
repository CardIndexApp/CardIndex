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
 * Search cards by name, optionally filtered by set slug and/or card number.
 */
export async function searchPokétraceCards(
  name: string,
  options: { setSlug?: string; cardNumber?: string; limit?: number } = {}
): Promise<PokétraceCard[]> {
  try {
    const params = new URLSearchParams({
      search: name,
      limit: String(options.limit ?? 20),
    })
    if (options.setSlug)    params.set('set', options.setSlug)
    if (options.cardNumber) params.set('card_number', options.cardNumber)

    const res = await fetch(`${BASE}/cards?${params}`, {
      headers: apiHeaders(),
      next: { revalidate: 3600 },
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

/** Normalise a set name to a URL slug for Poketrace set filtering */
function setNameToSlug(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * Find the best Poketrace card match using name, set name, and card number.
 * Priority order:
 *   1. Exact name + exact card number (most specific — correct card guaranteed)
 *   2. Exact name + set name match
 *   3. Exact name only
 *   4. First result (last resort)
 */
export async function findBestMatch(
  cardName: string,
  setName: string,
  cardNumber?: string
): Promise<PokétraceCard | null> {
  const nameLower = cardName.toLowerCase()
  const setLower  = setName.toLowerCase()

  // Pass card_number to Poketrace to narrow results immediately
  const results = await searchPokétraceCards(cardName, {
    limit: 20,
    cardNumber: cardNumber || undefined,
  })

  if (!results.length) {
    // Retry without card_number filter in case Poketrace doesn't index it
    const fallback = await searchPokétraceCards(cardName, { limit: 20 })
    if (!fallback.length) return null
    return pickBest(fallback, nameLower, setLower, cardNumber)
  }

  return pickBest(results, nameLower, setLower, cardNumber)
}

function pickBest(
  results: PokétraceCard[],
  nameLower: string,
  setLower: string,
  cardNumber?: string
): PokétraceCard | null {
  // 1. Exact name + card number + set name — perfect match
  if (cardNumber && setLower) {
    const perfect = results.find(
      r => r.name.toLowerCase() === nameLower &&
           r.cardNumber === cardNumber &&
           r.set.name.toLowerCase() === setLower
    )
    if (perfect) return perfect
  }

  // 2. Exact name + card number (any set)
  if (cardNumber) {
    const byNumber = results.find(
      r => r.name.toLowerCase() === nameLower && r.cardNumber === cardNumber
    )
    if (byNumber) return byNumber
  }

  // 3. Exact name + set name (any number)
  if (setLower) {
    const bySet = results.find(
      r => r.name.toLowerCase() === nameLower &&
           r.set.name.toLowerCase() === setLower
    )
    if (bySet) return bySet

    // 3b. Slug match in case Poketrace set name differs slightly
    const slug = setNameToSlug(setLower)
    const bySlug = results.find(
      r => r.name.toLowerCase() === nameLower &&
           setNameToSlug(r.set.name) === slug
    )
    if (bySlug) return bySlug
  }

  // 4. Exact name, any set
  const byName = results.find(r => r.name.toLowerCase() === nameLower)
  if (byName) return byName

  // 5. First result — last resort
  return results[0]
}
