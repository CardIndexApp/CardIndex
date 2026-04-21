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

// ── API Error class ───────────────────────────────────────────────────────────

/**
 * Thrown when the Poketrace API returns a non-success HTTP status that
 * indicates a problem with the request or service (not just "card not found").
 * Callers should distinguish this from a null/empty result (card not found).
 */
export class PoketraceApiError extends Error {
  constructor(public readonly status: number, url: string) {
    super(`Poketrace API error ${status} at ${url}`)
    this.name = 'PoketraceApiError'
  }
}

/**
 * Throws PoketraceApiError only for statuses that indicate a systemic API failure:
 *   401 / 403 — bad or missing API key (all cards will fail)
 *   429       — rate limited (retry later)
 *   5xx       — server error (service is down)
 *
 * Does NOT throw on 400 Bad Request or 404 Not Found — these mean the specific
 * card/set/number doesn't exist, which is a valid "not found" result, not an API fault.
 */
function assertOkOrNotFound(res: Response): void {
  if (res.ok) return
  if (res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500) {
    throw new PoketraceApiError(res.status, res.url)
  }
  // 400, 404, and other 4xx are treated as "not found" — no throw
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
 * Return ALL Poketrace set slugs that match a pokemontcg.io set name.
 * Returns multiple because Poketrace splits sets (e.g. "Prismatic Evolutions" →
 * "prismatic-evolutions", "sv-prismatic-evolutions", "prismatic-evolutions-additionals").
 * Callers should try each slug until they find a card match.
 * Results are ordered: exact name match first, then slug/partial matches.
 */
export async function getPoketraceSetSlugs(setName: string): Promise<string[]> {
  try {
    const params = new URLSearchParams({ search: setName, limit: '20', game: 'pokemon' })
    const res = await fetch(`${BASE}/sets?${params}`, {
      headers: apiHeaders(),
      cache: 'no-store',
    })
    assertOkOrNotFound(res)
    if (!res.ok) return []
    const json = await res.json()
    const sets = (json.data as PoketraceSet[]) ?? []
    if (!sets.length) return []

    const nameLower = setName.toLowerCase()
    const setSlug   = setNameToSlug(setName)

    const tier1: string[] = [] // exact name match
    const tier2: string[] = [] // slug contains our fragment (or vice versa)
    const tier3: string[] = [] // partial name match

    for (const s of sets) {
      const sl      = s.slug.toLowerCase()
      const snLower = s.name.toLowerCase()
      const snSlug  = setNameToSlug(s.name)

      if (snLower === nameLower) {
        tier1.push(s.slug)
      } else if (
        sl === setSlug || sl.includes(setSlug) || setSlug.includes(sl) ||
        snSlug === setSlug || snSlug.includes(setSlug) || setSlug.includes(snSlug)
      ) {
        tier2.push(s.slug)
      } else if (snLower.includes(nameLower) || nameLower.includes(snLower)) {
        tier3.push(s.slug)
      }
    }

    return [...tier1, ...tier2, ...tier3]
  } catch (err) {
    if (err instanceof PoketraceApiError) throw err
    return []
  }
}

/** @deprecated Use getPoketraceSetSlugs (returns all matches). Kept for compatibility. */
export async function getPoketraceSetSlug(setName: string): Promise<string | null> {
  const slugs = await getPoketraceSetSlugs(setName)
  return slugs[0] ?? null
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
 * Search cards by name. Returns lightweight card list (no full pricing).
 * API max limit is 20. Always targets US market.
 * Pass setSlug to narrow results when searching for a card from a known set.
 */
export async function searchPokétraceCards(
  name: string,
  options: { setSlug?: string; hasGraded?: boolean } = {}
): Promise<PokétraceCard[]> {
  try {
    const params = new URLSearchParams({
      search: name,
      limit: '20',   // API hard max is 20
      market: 'US',
      game: 'pokemon',
    })
    if (options.setSlug)   params.set('set', options.setSlug)
    if (options.hasGraded) params.set('has_graded', 'true')

    const res = await fetch(`${BASE}/cards?${params}`, {
      headers: apiHeaders(),
      cache: 'no-store',
    })
    assertOkOrNotFound(res)
    if (!res.ok) return []
    const json = await res.json()
    return (json.data as PokétraceCard[]) ?? []
  } catch (err) {
    if (err instanceof PoketraceApiError) throw err
    return []
  }
}

/**
 * Find a card using set slug(s) + card number.
 * Accepts multiple set slugs because Poketrace splits sets — e.g. "Prismatic Evolutions"
 * maps to "prismatic-evolutions", "sv-prismatic-evolutions", and "prismatic-evolutions-additionals".
 * Tries each slug with each variant until a match is found.
 * NOTE: GET /cards/:id requires a UUID — only query params are used here.
 */
export async function findBySetAndNumber(
  _cardName: string,
  setSlugs: string | string[],
  cardNumber: string,
  variants?: PoketraceVariant[]
): Promise<PokétraceCard | null> {
  const slugList   = Array.isArray(setSlugs) ? setSlugs : [setSlugs]
  const variantsToTry = variants?.length ? variants : [...POKETRACE_VARIANTS]

  for (const setSlug of slugList) {
    try {
      const searches: Promise<PokétraceCard | null>[] = []

      // Try each variant with set + card_number filter
      for (const variant of variantsToTry) {
        const params = new URLSearchParams({
          set: setSlug, card_number: cardNumber, variant,
          market: 'US', game: 'pokemon', limit: '20',
        })
        searches.push(
          fetch(`${BASE}/cards?${params}`, { headers: apiHeaders(), cache: 'no-store' })
            .then(r => { assertOkOrNotFound(r); return r.ok ? r.json() : null })
            .then(json => (json?.data as PokétraceCard[])?.[0] ?? null)
            .catch(err => { if (err instanceof PoketraceApiError) throw err; return null })
        )
      }

      // Also try without variant filter — catches unexpected variant values
      const noVariantParams = new URLSearchParams({
        set: setSlug, card_number: cardNumber,
        market: 'US', game: 'pokemon', limit: '20',
      })
      searches.push(
        fetch(`${BASE}/cards?${noVariantParams}`, { headers: apiHeaders(), cache: 'no-store' })
          .then(r => { assertOkOrNotFound(r); return r.ok ? r.json() : null })
          .then(json => (json?.data as PokétraceCard[])?.[0] ?? null)
          .catch(err => { if (err instanceof PoketraceApiError) throw err; return null })
      )

      const results = await Promise.all(searches)
      const found = results.find(r => r !== null)
      if (found) return found
      // No match for this slug — try next slug
    } catch (err) {
      if (err instanceof PoketraceApiError) throw err
      // Network error on this slug — try next
    }
  }

  return null
}

/**
 * Look up a Poketrace card directly by TCGPlayer product ID.
 * This is the most accurate matching method — bypasses name/set ambiguity.
 */
export async function searchByTcgPlayerId(tcgplayerId: string): Promise<PokétraceCard | null> {
  try {
    const params = new URLSearchParams({
      tcgplayer_ids: tcgplayerId,
      market: 'US',
      limit: '20',
    })
    const res = await fetch(`${BASE}/cards?${params}`, {
      headers: apiHeaders(),
      cache: 'no-store',
    })
    assertOkOrNotFound(res)
    if (!res.ok) return null
    const json = await res.json()
    const results = (json.data as PokétraceCard[]) ?? []
    return results[0] ?? null
  } catch (err) {
    if (err instanceof PoketraceApiError) throw err
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
      cache: 'no-store',
    })
    // Throws PoketraceApiError for 401/403/429/5xx
    assertOkOrNotFound(res)
    if (!res.ok) return null
    const json = await res.json()
    return (json.data as PokétraceCard) ?? null
  } catch (err) {
    if (err instanceof PoketraceApiError) throw err
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

/** Normalise a card name for fuzzy matching: lowercase, collapse spaces, strip hyphens */
function normaliseCardName(name: string): string {
  return name.toLowerCase()
    .replace(/[‐‑‒–—-]/g, ' ')  // all dash variants → space
    .replace(/\s+/g, ' ')
    .trim()
}

/** Check whether two card names are equivalent (handles EX/ex, GX/gx, V/v case variants) */
function namesMatch(a: string, b: string): boolean {
  return normaliseCardName(a) === normaliseCardName(b)
}

/**
 * Find the best Poketrace card match using name search + set-name matching.
 * Also accepts an optional tcgplayerId to cross-match against refs.tcgplayerId in results.
 *
 * Priority:
 *   1. refs.tcgplayerId match (most precise — cross-references pokemontcg.io ↔ Poketrace)
 *   2. Normalised name + exact set name → pick by card number
 *   3. Normalised name + set slug match → pick by number
 *   4. Normalised name + partial set name → pick by number
 *   5. Normalised name, pick highest-priced result
 *   6. Broader search using first word of card name (handles name differences)
 *   7. First result from original search
 */
/** Build name variants to try — handles "Umbreon ex" ↔ "Umbreon EX", "Charizard-EX" etc. */
function nameVariants(name: string): string[] {
  const variants = new Set<string>([name])
  // lowercase suffix → uppercase (pokemontcg.io uses lowercase ex/gx/v/vmax/vstar)
  const upper = name.replace(/\s+(ex|gx|v|vmax|vstar|v-union)$/i, (_, s) => ' ' + s.toUpperCase())
  if (upper !== name) variants.add(upper)
  // uppercase → lowercase
  const lower = name.replace(/\s+(EX|GX|V|VMAX|VSTAR)$/, (_, s) => ' ' + s.toLowerCase())
  if (lower !== name) variants.add(lower)
  // bare name (first word only) as last resort
  const bare = name.split(' ')[0]
  if (bare && bare !== name) variants.add(bare)
  return Array.from(variants)
}

export async function findBestMatch(
  cardName: string,
  setName: string,
  cardNumber?: string,
  tcgplayerId?: string,
  poketraceSetSlug?: string,  // pass this to narrow the search when set slug is known
): Promise<{ card: PokétraceCard; debug: MatchDebug } | null> {
  const nameVars = nameVariants(cardName)
  let results: PokétraceCard[] = []
  let searchedWith = cardName

  // First attempt: search with set slug to narrow results (avoids the 20-item limit problem)
  // This is critical for common card names like "Charizard" that return many results
  if (poketraceSetSlug) {
    for (const variant of nameVars) {
      const r = await searchPokétraceCards(variant, { setSlug: poketraceSetSlug })
      if (r.length) { results = r; searchedWith = variant; break }
    }
  }

  // Second attempt: search without set slug (set slug might be wrong or missing)
  if (!results.length) {
    for (const variant of nameVars) {
      const r = await searchPokétraceCards(variant)
      if (r.length) { results = r; searchedWith = variant; break }
    }
  }

  const debug: MatchDebug = {
    searched: searchedWith !== cardName ? `${cardName} (tried: ${nameVars.join(', ')})` : cardName,
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

  const setLower = setName.toLowerCase()
  const setSlug  = setNameToSlug(setName)

  // Filter to name matches (normalised comparison handles EX/ex etc.)
  const nameMatches = results.filter(r => namesMatch(r.name, cardName))
  const pool = nameMatches.length ? nameMatches : results

  // 2. Exact set name match → pick by card number among those
  const exactSetGroup = pool.filter(r => r.set.name.toLowerCase() === setLower)
  if (exactSetGroup.length) {
    const pick = pickByNumber(exactSetGroup, cardNumber)
    debug.matched = { id: pick.id, name: pick.name, set: pick.set.name, cardNumber: pick.cardNumber }
    debug.matchReason = 'name + exact set'
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
    debug.matchReason = 'name + set slug match'
    return { card: pick, debug }
  }

  // 4. Partial set name match
  const partialGroup = pool.filter(
    r => r.set.name.toLowerCase().includes(setLower) || setLower.includes(r.set.name.toLowerCase())
  )
  if (partialGroup.length) {
    const pick = pickByNumber(partialGroup, cardNumber)
    debug.matched = { id: pick.id, name: pick.name, set: pick.set.name, cardNumber: pick.cardNumber }
    debug.matchReason = 'name + partial set match'
    return { card: pick, debug }
  }

  // 5. Name matches but no set match → pick highest-priced (most likely to be the famous version)
  if (nameMatches.length) {
    const byPrice = [...nameMatches].sort((a, b) => getTopPrice(b) - getTopPrice(a))
    const top = byPrice[0]
    debug.matched = { id: top.id, name: top.name, set: top.set.name, cardNumber: top.cardNumber }
    debug.matchReason = 'name match, highest price selected'
    return { card: top, debug }
  }

  // 6. First result from full pool
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
