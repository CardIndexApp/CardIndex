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

const RAW_TIERS = ['NEAR_MINT', 'MINT', 'LIGHTLY_PLAYED', 'MODERATELY_PLAYED', 'HEAVILY_PLAYED', 'DAMAGED']

/**
 * Pick the best TierPrice from a card's prices object for a given tier.
 * Falls back through related tiers if exact match is missing.
 * Returns { tierPrice, resolvedTier } so callers know what was actually used.
 */
export function getTierPrice(
  card: PokétraceCard,
  tier: string
): { tierPrice: TierPrice; resolvedTier: string } | null {
  const isRaw = RAW_TIERS.includes(tier)

  if (card.market === 'EU') {
    const tp = card.prices.cardmarket?.AGGREGATED
    return tp ? { tierPrice: tp, resolvedTier: 'AGGREGATED' } : null
  }

  if (isRaw) {
    // Try exact tier first across both sources
    const exact = card.prices.tcgplayer?.[tier] ?? card.prices.ebay?.[tier]
    if (exact) return { tierPrice: exact, resolvedTier: tier }

    // Fall back through other raw conditions
    for (const fallback of RAW_TIERS) {
      if (fallback === tier) continue
      const fb = card.prices.tcgplayer?.[fallback] ?? card.prices.ebay?.[fallback]
      if (fb) return { tierPrice: fb, resolvedTier: fallback }
    }

    // No raw data — return best graded price if available
    const gradedTier = getBestGradedTier(card)
    if (gradedTier) return gradedTier

    return null
  }

  // Graded — use eBay
  const exact = card.prices.ebay?.[tier]
  if (exact) return { tierPrice: exact, resolvedTier: tier }

  // Graded tier not available — return another graded tier or best raw
  const gradedTier = getBestGradedTier(card)
  if (gradedTier) return gradedTier

  // Last resort — any raw tier
  for (const raw of RAW_TIERS) {
    const rb = card.prices.tcgplayer?.[raw] ?? card.prices.ebay?.[raw]
    if (rb) return { tierPrice: rb, resolvedTier: raw }
  }

  return null
}

/** Return the highest-quality graded tier available on eBay */
function getBestGradedTier(card: PokétraceCard): { tierPrice: TierPrice; resolvedTier: string } | null {
  const preferred = ['PSA_10', 'PSA_9', 'CGC_10', 'CGC_9_5', 'BGS_10', 'BGS_9_5', 'PSA_8', 'CGC_9', 'PSA_7']
  const ebay = card.prices.ebay ?? {}
  for (const t of preferred) {
    if (ebay[t]) return { tierPrice: ebay[t], resolvedTier: t }
  }
  // Any graded tier
  for (const t of Object.keys(ebay)) {
    if (!RAW_TIERS.includes(t)) return { tierPrice: ebay[t], resolvedTier: t }
  }
  return null
}

/** Return all available tier keys for a card (for UI display) */
export function getAvailableTiers(card: PokétraceCard): string[] {
  const tiers = new Set<string>()
  Object.keys(card.prices.ebay ?? {}).forEach(t => tiers.add(t))
  Object.keys(card.prices.tcgplayer ?? {}).forEach(t => tiers.add(t))
  if (card.prices.cardmarket?.AGGREGATED) tiers.add('AGGREGATED')
  return Array.from(tiers)
}

// ── API calls ─────────────────────────────────────────────────────────────────

// ── Set lookup ────────────────────────────────────────────────────────────────

interface PoketraceSet {
  id: string
  slug: string
  name: string
  game?: string
}

/**
 * Look up the Poketrace set slug for a given set name.
 * Poketrace set slugs include a code prefix (e.g. "me02-phantasmal-flames")
 * that pokemontcg.io doesn't have ("Phantasmal Flames").
 */
export async function getPoketraceSetSlug(setName: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({ search: setName, limit: '10' })
    const res = await fetch(`${BASE}/sets?${params}`, {
      headers: apiHeaders(),
      next: { revalidate: 86400 }, // set slugs don't change
    })
    if (!res.ok) return null
    const json = await res.json()
    const sets = (json.data as PoketraceSet[]) ?? []
    if (!sets.length) return null

    const nameLower = setName.toLowerCase()
    const setSlug   = setNameToSlug(setName)

    // 1. Exact name match
    const exact = sets.find(s => s.name.toLowerCase() === nameLower)
    if (exact) return exact.slug

    // 2. Slug of Poketrace set contains or matches our slug
    // e.g. "me02-phantasmal-flames" contains "phantasmal-flames"
    const slugMatch = sets.find(s => {
      const sl = s.slug.toLowerCase()
      return sl === setSlug || sl.includes(setSlug) || setSlug.includes(sl)
    })
    if (slugMatch) return slugMatch.slug

    // 3. Partial name match
    const partial = sets.find(s =>
      s.name.toLowerCase().includes(nameLower) || nameLower.includes(s.name.toLowerCase())
    )
    if (partial) return partial.slug

    return null
  } catch {
    return null
  }
}

/**
 * Convert a card name + set slug + variant + number into a Poketrace card ID (slug).
 * Format: {name-slug}-{set-slug}-{Variant}-{number-hyphenated}
 * e.g. mega-charizard-x-ex-me02-phantasmal-flames-Holofoil-125-094
 *
 * The variant must be a valid Poketrace variant string (e.g. "Holofoil", "Normal").
 * The number uses the Poketrace format with "/" replaced by "-" (e.g. "125/094" → "125-094").
 *
 * Returns null if any required part is missing.
 */
function buildCardSlug(
  cardName: string,
  setSlug: string,
  variant: string,
  poketraceNumber: string // "125/094" format
): string {
  const nameSlug = cardName.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()

  const numberSlug = poketraceNumber.replace(/\//g, '-')

  return `${nameSlug}-${setSlug}-${variant}-${numberSlug}`
}

/** Common Poketrace variant strings to try when we don't know the exact one */
const VARIANT_CANDIDATES = [
  'Holofoil', 'Normal', 'ReverseHolofoil', 'Foil',
  'HoloRare', 'FullArt', 'AlternateArt', 'SecretRare',
]

/**
 * Try to find a Poketrace card by constructing its slug from the set lookup +
 * pokemontcg.io number.  Returns the first variant slug that resolves.
 *
 * ptcgNumber: bare card number from pokemontcg.io (e.g. "125")
 * setTotalCards: total cards in the set (e.g. 94), used to build "125/094"
 */
export async function findByConstructedSlug(
  cardName: string,
  setName: string,
  ptcgNumber: string,
  variants?: string[]
): Promise<PokétraceCard | null> {
  const setSlug = await getPoketraceSetSlug(setName)
  if (!setSlug) return null

  // Try with the number as-is (may already be "125/094") then with padding
  const numberCandidates: string[] = []
  if (ptcgNumber.includes('/')) {
    numberCandidates.push(ptcgNumber)
  } else {
    // We don't know the total — try common padding or just the bare number
    numberCandidates.push(ptcgNumber) // "125" → "125" slug
    // Also try zero-padded in case Poketrace uses it
    numberCandidates.push(ptcgNumber.padStart(3, '0'))
  }

  const variantsToTry = variants?.length ? variants : VARIANT_CANDIDATES

  for (const num of numberCandidates) {
    for (const variant of variantsToTry) {
      const slug = buildCardSlug(cardName, setSlug, variant, num)
      const card = await getPokétraceCard(slug)
      if (card) return card
    }
  }

  return null
}

/**
 * Search cards by name only. Card number is NOT sent to the API because
 * pokemontcg.io uses bare numbers ("125") while Poketrace may use
 * formatted numbers ("125/094") — sending it causes wrong matches.
 * Post-filtering by number is done in pickBest() instead.
 */
export async function searchPokétraceCards(
  name: string,
  options: { limit?: number } = {}
): Promise<PokétraceCard[]> {
  try {
    const params = new URLSearchParams({
      search: name,
      limit: String(options.limit ?? 20),
    })

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
 * Look up a Poketrace card directly by TCGPlayer product ID.
 * This is the most accurate matching method — bypasses name/set ambiguity.
 */
export async function searchByTcgPlayerId(tcgplayerId: string): Promise<PokétraceCard | null> {
  try {
    const params = new URLSearchParams({ tcgplayer_ids: tcgplayerId, limit: '5' })
    const res = await fetch(`${BASE}/cards?${params}`, {
      headers: apiHeaders(),
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const json = await res.json()
    const results = (json.data as PokétraceCard[]) ?? []
    return results[0] ?? null
  } catch {
    return null
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

export interface MatchDebug {
  searched: string
  resultCount: number
  matched: { id: string; name: string; set: string; cardNumber: string } | null
  matchReason: string
}

/**
 * Find the best Poketrace card match using name + set name.
 * Card number is used as a tiebreaker only (NOT sent to the API).
 *
 * Priority:
 *   1. Exact name + exact set name
 *   2. Exact name + set slug match (handles "ME02-Phantasmal Flames" vs "Phantasmal Flames")
 *   3. Exact name + set name contains our set name (partial)
 *   4. Exact name, pick highest-priced result (most likely to be the valuable card)
 *   5. First result
 */
export async function findBestMatch(
  cardName: string,
  setName: string,
  cardNumber?: string
): Promise<{ card: PokétraceCard; debug: MatchDebug } | null> {
  const results = await searchPokétraceCards(cardName, { limit: 20 })

  const debug: MatchDebug = {
    searched: cardName,
    resultCount: results.length,
    matched: null,
    matchReason: 'none',
  }

  if (!results.length) return null

  const nameLower = cardName.toLowerCase()
  const setLower  = setName.toLowerCase()
  const setSlug   = setNameToSlug(setName)

  // Filter to exact name matches first
  const nameMatches = results.filter(r => r.name.toLowerCase() === nameLower)
  const pool = nameMatches.length ? nameMatches : results

  // 1. Exact set name match
  const exactSet = pool.find(r => r.set.name.toLowerCase() === setLower)
  if (exactSet) {
    debug.matched = { id: exactSet.id, name: exactSet.name, set: exactSet.set.name, cardNumber: exactSet.cardNumber }
    debug.matchReason = 'exact name + exact set'
    return { card: exactSet, debug }
  }

  // 2. Set slug match — handles "ME02-Phantasmal Flames" matching "Phantasmal Flames"
  const slugMatch = pool.find(r => {
    const rSlug = setNameToSlug(r.set.name)
    return rSlug === setSlug || rSlug.includes(setSlug) || setSlug.includes(rSlug)
  })
  if (slugMatch) {
    debug.matched = { id: slugMatch.id, name: slugMatch.name, set: slugMatch.set.name, cardNumber: slugMatch.cardNumber }
    debug.matchReason = 'exact name + set slug match'
    return { card: slugMatch, debug }
  }

  // 3. Set name contains our set name (partial)
  const partialSet = pool.find(
    r => r.set.name.toLowerCase().includes(setLower) || setLower.includes(r.set.name.toLowerCase())
  )
  if (partialSet) {
    debug.matched = { id: partialSet.id, name: partialSet.name, set: partialSet.set.name, cardNumber: partialSet.cardNumber }
    debug.matchReason = 'exact name + partial set match'
    return { card: partialSet, debug }
  }

  // 4. If multiple name matches, pick highest avg price (the expensive/notable card)
  if (pool.length > 1) {
    const byPrice = [...pool].sort((a, b) => {
      const aPrice = getTopPrice(a)
      const bPrice = getTopPrice(b)
      return bPrice - aPrice
    })
    const top = byPrice[0]
    debug.matched = { id: top.id, name: top.name, set: top.set.name, cardNumber: top.cardNumber }
    debug.matchReason = 'exact name, highest price selected'
    return { card: top, debug }
  }

  // 5. First result
  const first = pool[0]
  debug.matched = { id: first.id, name: first.name, set: first.set.name, cardNumber: first.cardNumber }
  debug.matchReason = 'first result'
  return { card: first, debug }
}

function getTopPrice(card: PokétraceCard): number {
  let max = 0
  for (const src of [card.prices.ebay, card.prices.tcgplayer]) {
    if (!src) continue
    for (const tp of Object.values(src)) {
      if (tp.avg > max) max = tp.avg
    }
  }
  return max
}
