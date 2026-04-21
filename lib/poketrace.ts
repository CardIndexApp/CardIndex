/**
 * Poketrace Pricing API client
 * Base URL: https://api.poketrace.com/v1
 * Auth: X-API-Key header
 * Spec: https://api.poketrace.com/v1/openapi.json
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
  trend?: 'up' | 'down' | 'stable'
  confidence?: 'high' | 'medium' | 'low'
  avg1d?: number
  avg7d?: number
  avg30d?: number
  median3d?: number
  median7d?: number
  median30d?: number
}

export interface PokétraceCard {
  id: string   // UUID
  name: string
  cardNumber: string
  set: { slug: string; name: string }
  variant?: string
  rarity: string
  image: string
  game: string
  market: 'US' | 'EU'
  currency: 'USD' | 'EUR'
  refs?: {
    tcgplayerId?: string | null
    cardmarketId?: string | null
  }
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
  median3d?: number
  median7d?: number
  median30d?: number
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

// ── Set lookup ─────────────────────────────────────────────────────────────────

interface PoketraceSet {
  slug: string
  name: string
  releaseDate?: string
  cardCount?: number
}

/** Normalise a set name to a slug fragment for matching */
function setNameToSlug(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
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
      next: { revalidate: 86400 },
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

    // 2. Poketrace slug contains our slug fragment
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

// ── Card search ────────────────────────────────────────────────────────────────

/**
 * Valid Poketrace variant enum values (from OpenAPI spec).
 * Used for the `variant` query parameter in GET /cards.
 */
export const POKETRACE_VARIANTS = [
  'Holofoil',
  'Normal',
  'Reverse_Holofoil',
  '1st_Edition_Holofoil',
  '1st_Edition',
  'Unlimited',
] as const

export type PoketraceVariant = typeof POKETRACE_VARIANTS[number]

/**
 * Map pokemontcg.io subtypes/supertypes to valid Poketrace variant strings.
 * Returns variants in most-likely-first order.
 */
export function toPoketraceVariants(subtypes: string[] = [], supertypes: string[] = []): PoketraceVariant[] {
  const all = [...subtypes.map(s => s.toLowerCase()), ...supertypes.map(s => s.toLowerCase())]
  const out: PoketraceVariant[] = []

  if (all.some(s => s.includes('reverse holo')))             out.push('Reverse_Holofoil')
  if (all.some(s => s.includes('1st edition') && s.includes('holo'))) out.push('1st_Edition_Holofoil')
  if (all.some(s => s.includes('1st edition')))              out.push('1st_Edition')
  if (all.some(s => s === 'unlimited'))                      out.push('Unlimited')

  // Holo-type cards (ex, gx, v, vmax, vstar, full art, secret) → Holofoil
  const isHolo = all.some(s =>
    s.includes('holo') || s.includes(' ex') || s.includes(' gx') ||
    s.includes(' v') || s.includes('vmax') || s.includes('vstar') ||
    s.includes('full art') || s.includes('secret') || s.includes('ultra rare')
  )
  if (isHolo && !out.includes('Holofoil')) out.push('Holofoil')

  // Non-holo commons/uncommons → Normal
  const isNormal = all.some(s => s === 'common' || s === 'uncommon' || s === 'trainer' || s === 'energy')
  if (isNormal && !out.includes('Normal')) out.push('Normal')

  // Ensure both main variants are always candidates as fallback
  if (!out.includes('Holofoil')) out.push('Holofoil')
  if (!out.includes('Normal'))   out.push('Normal')

  return out
}

/**
 * Search cards by name only. Returns lightweight card list (no full pricing).
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
      cache: 'no-store',
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.data as PokétraceCard[]) ?? []
  } catch {
    return []
  }
}

/** Build a Poketrace card slug: {name}-{setSlug}-{Variant}-{number-with-hyphens} */
function buildCardSlug(cardName: string, setSlug: string, variant: string, cardNumber: string): string {
  const nameSlug = cardName.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
  const numSlug = cardNumber.replace(/\//g, '-')
  return `${nameSlug}-${setSlug}-${variant}-${numSlug}`
}

/**
 * Find a card using set slug + card number.
 * Tries two approaches concurrently:
 *   A) GET /cards?set={slug}&card_number={num}  — correct API query params
 *   B) GET /cards/{name}-{set}-{variant}-{num}  — slug-style ID (confirmed working)
 *
 * cardName: used for slug construction
 * cardNumber: "125/094" format
 */
export async function findBySetAndNumber(
  cardName: string,
  setSlug: string,
  cardNumber: string,
  variants?: PoketraceVariant[]
): Promise<PokétraceCard | null> {
  try {
    const variantsToTry = variants?.length ? variants : [...POKETRACE_VARIANTS]

    const searches: Promise<PokétraceCard | null>[] = []

    // Approach A: API query params — try each variant and no-variant
    for (const variant of variantsToTry) {
      const params = new URLSearchParams({ set: setSlug, card_number: cardNumber, variant, limit: '5' })
      searches.push(
        fetch(`${BASE}/cards?${params}`, { headers: apiHeaders(), cache: 'no-store' })
          .then(r => r.ok ? r.json() : null)
          .then(json => (json?.data as PokétraceCard[])?.[0] ?? null)
          .catch(() => null)
      )
    }
    // Also without variant filter
    const noVariantParams = new URLSearchParams({ set: setSlug, card_number: cardNumber, limit: '5' })
    searches.push(
      fetch(`${BASE}/cards?${noVariantParams}`, { headers: apiHeaders(), cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(json => (json?.data as PokétraceCard[])?.[0] ?? null)
        .catch(() => null)
    )

    // Approach B: slug-style IDs — confirmed working via debug testing
    // e.g. mega-charizard-x-ex-me02-phantasmal-flames-Holofoil-125-094
    for (const variant of variantsToTry) {
      const slug = buildCardSlug(cardName, setSlug, variant, cardNumber)
      searches.push(getPokétraceCard(slug))
    }

    const results = await Promise.all(searches)
    return results.find(r => r !== null) ?? null
  } catch {
    return null
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
      cache: 'no-store',
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
 * Get a single card with full pricing by Poketrace card UUID.
 */
export async function getPokétraceCard(id: string): Promise<PokétraceCard | null> {
  try {
    const res = await fetch(`${BASE}/cards/${encodeURIComponent(id)}`, {
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
      `${BASE}/cards/${encodeURIComponent(cardId)}/prices/${encodeURIComponent(tier)}/history?period=${period}&limit=90`,
      { headers: apiHeaders() }
    )
    if (!res.ok) return []
    const json = await res.json()
    return (json.data as PriceHistoryPoint[]) ?? []
  } catch {
    return []
  }
}

// ── Best-match fallback ───────────────────────────────────────────────────────

export interface MatchDebug {
  searched: string
  resultCount: number
  matched: { id: string; name: string; set: string; cardNumber: string } | null
  matchReason: string
}

/**
 * When we have multiple candidates from the same set, pick the right one by card number.
 * cardNumber: bare number from URL params e.g. "125"
 */
function pickByNumber(candidates: PokétraceCard[], cardNumber?: string): PokétraceCard {
  if (!cardNumber || candidates.length === 1) return candidates[0]

  // Strip leading zeros and totals for comparison: "125/094" → "125", "013/094" → "13"
  const bare = cardNumber.replace(/\/.*$/, '').replace(/^0+/, '') || cardNumber

  const byNum = candidates.find(c => {
    const cn = (c.cardNumber ?? '').split('/')[0].replace(/^0+/, '')
    return cn === bare
  })
  if (byNum) return byNum

  // Fall back to highest-priced among candidates
  return [...candidates].sort((a, b) => getTopPrice(b) - getTopPrice(a))[0]
}

/**
 * Find the best Poketrace card match using name search + set-name matching.
 * Also accepts an optional tcgplayerId to cross-match against refs.tcgplayerId in results.
 *
 * Priority:
 *   1. refs.tcgplayerId match (most precise — cross-references pokemontcg.io ↔ Poketrace)
 *   2. Exact name + exact set name → pick by card number
 *   3. Exact name + set slug match (handles "ME02: Phantasmal Flames" vs "Phantasmal Flames") → pick by number
 *   4. Exact name + partial set name → pick by number
 *   5. Exact name, pick highest-priced result
 *   6. First result
 */
export async function findBestMatch(
  cardName: string,
  setName: string,
  cardNumber?: string,
  tcgplayerId?: string
): Promise<{ card: PokétraceCard; debug: MatchDebug } | null> {
  const results = await searchPokétraceCards(cardName, { limit: 20 })

  const debug: MatchDebug = {
    searched: cardName,
    resultCount: results.length,
    matched: null,
    matchReason: 'none',
  }

  if (!results.length) return null

  // 1. TCGPlayer ID cross-match — most precise possible
  if (tcgplayerId) {
    const tcgMatch = results.find(r => r.refs?.tcgplayerId === tcgplayerId)
    if (tcgMatch) {
      debug.matched = { id: tcgMatch.id, name: tcgMatch.name, set: tcgMatch.set.name, cardNumber: tcgMatch.cardNumber }
      debug.matchReason = 'refs.tcgplayerId match'
      return { card: tcgMatch, debug }
    }
  }

  const nameLower = cardName.toLowerCase()
  const setLower  = setName.toLowerCase()
  const setSlug   = setNameToSlug(setName)

  // Filter to exact name matches first
  const nameMatches = results.filter(r => r.name.toLowerCase() === nameLower)
  const pool = nameMatches.length ? nameMatches : results

  // 2. Exact set name match → pick by card number among those
  const exactSetGroup = pool.filter(r => r.set.name.toLowerCase() === setLower)
  if (exactSetGroup.length) {
    const pick = pickByNumber(exactSetGroup, cardNumber)
    debug.matched = { id: pick.id, name: pick.name, set: pick.set.name, cardNumber: pick.cardNumber }
    debug.matchReason = 'exact name + exact set'
    return { card: pick, debug }
  }

  // 3. Set slug match — "me02-phantasmal-flames" contains "phantasmal-flames"
  const slugGroup = pool.filter(r => {
    const rSlug     = r.set.slug.toLowerCase()
    const rNameSlug = setNameToSlug(r.set.name)
    return rSlug === setSlug || rSlug.includes(setSlug) || setSlug.includes(rSlug) ||
           rNameSlug === setSlug || rNameSlug.includes(setSlug) || setSlug.includes(rNameSlug)
  })
  if (slugGroup.length) {
    const pick = pickByNumber(slugGroup, cardNumber)
    debug.matched = { id: pick.id, name: pick.name, set: pick.set.name, cardNumber: pick.cardNumber }
    debug.matchReason = 'exact name + set slug match'
    return { card: pick, debug }
  }

  // 4. Partial set name match
  const partialGroup = pool.filter(
    r => r.set.name.toLowerCase().includes(setLower) || setLower.includes(r.set.name.toLowerCase())
  )
  if (partialGroup.length) {
    const pick = pickByNumber(partialGroup, cardNumber)
    debug.matched = { id: pick.id, name: pick.name, set: pick.set.name, cardNumber: pick.cardNumber }
    debug.matchReason = 'exact name + partial set match'
    return { card: pick, debug }
  }

  // 5. Multiple name matches → pick highest-priced
  if (pool.length > 1) {
    const byPrice = [...pool].sort((a, b) => getTopPrice(b) - getTopPrice(a))
    const top = byPrice[0]
    debug.matched = { id: top.id, name: top.name, set: top.set.name, cardNumber: top.cardNumber }
    debug.matchReason = 'exact name, highest price selected'
    return { card: top, debug }
  }

  // 6. First result
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
