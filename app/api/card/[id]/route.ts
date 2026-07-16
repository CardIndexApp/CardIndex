/**
 * GET /api/card/[id]?grade=PSA+10&name=Charizard&set=Base+Set&number=4
 *
 * Returns card price data + CardIndex score via Poketrace API.
 * Primary data source: eBay sold listings. TCGPlayer used as fallback only.
 * Checks search_cache first (6h TTL), falls back to live fetch.
 *
 * Matching strategy (in order):
 *   1. TCGPlayer ID  → GET /cards?tcgplayer_ids={id}            (most accurate)
 *   2. Set slug + number → findBySetAndNumber                   (deterministic)
 *   3. Name search fallback → findBestMatch                     (fuzzy, last resort)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  searchByTcgPlayerId,
  findBestMatch,
  findBySetAndNumber,
  getPokétraceCard,
  getPriceHistory,
  getPoketraceSetSlugs,
  gradeToTier,
  getTierPrice,
  tierToGrade,
  toPoketraceVariants,
  PoketraceApiError,
  type PoketraceVariant,
  type PokétraceCard,
  type PriceHistoryPoint,
} from '@/lib/poketrace'
import { computeScore } from '@/lib/score'

/**
 * Recompute data_warning + data_source from stored eBay sale count + eBay avg price.
 * Used to backfill warnings on pre-migration cache rows that don't have these columns yet.
 */
function recomputeWarning(ebaySaleCount: number, ebayAvgUSD: number, currentSource: string) {
  if (currentSource === 'tcgplayer') {
    // Already fell back to TCGPlayer — determine why
    return { data_warning: 'low_volume_tcg_fallback', data_source: 'tcgplayer' }
  }
  if (ebaySaleCount >= 30) return { data_warning: null, data_source: 'ebay' }
  if (ebaySaleCount >= 10) return { data_warning: 'limited_sales', data_source: 'ebay' }
  if (ebayAvgUSD > 5000)   return { data_warning: 'rare_asset', data_source: 'ebay' }
  if (ebayAvgUSD >= 1000)  return { data_warning: 'high_value_limited', data_source: 'ebay' }
  return { data_warning: 'low_volume_no_fallback', data_source: 'ebay' }
}

/** Map a Poketrace HTTP error status to a user-readable message */
function poketraceApiMessage(status: number): string {
  if (status === 401 || status === 403) return 'Pricing service authentication failed — please contact support'
  if (status === 429) return 'Pricing service rate limit reached — please try again in a moment'
  return `Pricing service error (${status}) — please try again`
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

interface PokemonTcgCardInfo {
  tcgplayerId: string | null
  /** Full Poketrace-style number e.g. "004/102" */
  fullNumber: string | null
  /** Bare number e.g. "4" */
  bareNumber: string | null
  subtypes: string[]
  supertypes: string[]
  imageUrl: string | null
}

/** Shared 8-second timeout for all external API calls */
function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

/** Fetch pokemontcg.io card, extract TCGPlayer product ID + card number + subtypes */
async function getPokemonTcgCardInfo(pokemontcgId: string): Promise<PokemonTcgCardInfo> {
  try {
    const res = await fetchWithTimeout(`https://api.pokemontcg.io/v2/cards/${pokemontcgId}`, {
      next: { revalidate: 3600 }, // 1h — short enough to pick up new cards/TCGPlayer IDs
    })
    if (!res.ok) return { tcgplayerId: null, fullNumber: null, bareNumber: null, subtypes: [], supertypes: [], imageUrl: null }
    const json = await res.json()
    const data = json.data

    // Extract TCGPlayer ID from URL e.g. https://www.tcgplayer.com/product/123456/...
    const url: string | undefined = data?.tcgplayer?.url
    const tcgMatch = url?.match(/\/product\/(\d+)/)
    const tcgplayerId = tcgMatch ? tcgMatch[1] : null

    // Build full card number "number/printedTotal" e.g. "004/102"
    const number = data?.number as string | undefined
    const printedTotal = data?.set?.printedTotal as number | undefined
    const totalCards   = data?.set?.total as number | undefined
    let fullNumber: string | null = null
    let bareNumber: string | null = null

    if (number) {
      bareNumber = number
      const total = printedTotal ?? totalCards
      if (total) {
        const numPart  = number.replace(/[^0-9]/g, '')
        const totalStr = String(total).padStart(3, '0')
        const numStr   = numPart.padStart(3, '0')
        fullNumber = `${numStr}/${totalStr}`
      } else {
        fullNumber = number
      }
    }

    return {
      tcgplayerId,
      fullNumber,
      bareNumber,
      subtypes:   data?.subtypes  ?? [],
      supertypes: data?.supertypes ?? [],
      imageUrl:   (data?.images?.large ?? data?.images?.small) as string | null ?? null,
    }
  } catch {
    return { tcgplayerId: null, fullNumber: null, bareNumber: null, subtypes: [], supertypes: [], imageUrl: null }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const grade      = req.nextUrl.searchParams.get('grade')    ?? 'Raw'
  const cardName   = req.nextUrl.searchParams.get('name')     ?? ''
  const setName    = req.nextUrl.searchParams.get('set')      ?? ''
  const cardNumber = req.nextUrl.searchParams.get('number')   ?? ''
  const urlSetSlug = req.nextUrl.searchParams.get('set_slug') ?? ''
  const urlGame    = req.nextUrl.searchParams.get('game')     ?? 'pokemon'
  const bustCache  = req.nextUrl.searchParams.get('bust_cache') === '1'
  const allTiers   = req.nextUrl.searchParams.get('all_tiers')  === '1'
  const isRefresh  = req.nextUrl.searchParams.get('source') === 'refresh'

  if (!cardName) {
    return NextResponse.json({ error: 'name param required' }, { status: 400 })
  }

  // Require authentication — try Bearer token (iOS) then cookie session (web).
  let searchUserId: string | null = null
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const { data } = await adminClient().auth.getUser(authHeader.slice(7))
    searchUserId = data.user?.id ?? null
  } else {
    const cookieStore = await cookies()
    const serverClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet) => toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    )
    const { data } = await serverClient.auth.getUser()
    searchUserId = data.user?.id ?? null
  }
  if (!searchUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cacheKey = `${id}:${grade}`
  const supabase = adminClient()

  // ── 1. Check cache ────────────────────────────────────────────────────────
  const { data: cached } = await supabase
    .from('search_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .single()

  if (cached && !bustCache) {
    const age = Date.now() - new Date(cached.last_fetched).getTime()
    // Treat rows with missing price_history as stale so they pick up the field on next fetch
    const missingHistory = !cached.price_history || (cached.price_history as unknown[]).length === 0
    if (age < CACHE_TTL_MS && !missingHistory) {
      await supabase.from('search_log').insert({ card_id: id, card_name: cardName, grade, user_id: searchUserId, ...(isRefresh ? { source: 'refresh' } : {}) })
      // Recompute warning from stored fields if not already present (pre-migration rows)
      const recomputed = cached.data_warning !== undefined ? cached : {
        ...cached,
        ...recomputeWarning(cached.ebay_sale_count ?? cached.sales_count_30d, cached.ebay_avg_usd ?? cached.price, cached.data_source ?? 'ebay'),
      }
      // Derive confidence if missing
      const cachedWithWarning = recomputed.confidence ? recomputed : {
        ...recomputed,
        confidence: (
          recomputed.data_warning === null             ? 'high'   :
          recomputed.data_warning === 'limited_sales'  ? 'medium' :
          recomputed.data_warning === 'rare_asset'     ? 'medium' :
          recomputed.data_warning === 'high_value_limited' ? 'medium' :
          'low'
        ),
      }
      // Fall back to last_fetched when last_updated_pt is missing (pre-migration rows)
      const cachedWithDate = cachedWithWarning.last_updated_pt ? cachedWithWarning : {
        ...cachedWithWarning,
        last_updated_pt: cachedWithWarning.last_fetched ?? null,
      }
      return NextResponse.json({ source: 'cache', data: cachedWithDate }, {
        headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=3600' },
      })
    }
  }

  if (!process.env.POKETRACE_API_KEY) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({ error: 'POKETRACE_API_KEY not configured' }, { status: 503 })
  }

  // ── Fast path: Poketrace search result (from new search page) ───────────────
  // Detected by: (a) UUID format, OR (b) set_slug param present (only passed by
  // our search page, which gets IDs directly from Poketrace's own API),
  // OR (c) Poketrace market-prefixed format e.g. "eu_469909", "us_12345".
  const isPoketraceId = !!urlSetSlug
    || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    || /^[a-z]{2}_\d+$/i.test(id)  // Poketrace market-prefixed IDs

  // Infer game/market from the ID prefix when not explicitly provided.
  // eu_* = CardMarket (JP), us_* = eBay US (EN). urlGame takes precedence if set.
  const inferredGame = urlGame !== 'pokemon'
    ? urlGame
    : /^eu_/i.test(id) ? 'pokemon-japanese' : 'pokemon'

  let matchedCard: PokétraceCard | null = null
  let matchReason = ''
  const tried: string[] = []
  let ptcgInfo: PokemonTcgCardInfo = { tcgplayerId: null, fullNumber: null, bareNumber: null, subtypes: [], supertypes: [], imageUrl: null }
  let poketraceSetSlugs: string[] = []
  let variants: PoketraceVariant[] = []

  if (isPoketraceId) {
    // ID came from our search page (Poketrace's own API) — trust it directly.
    matchedCard = { id } as PokétraceCard
    matchReason = 'direct-uuid'
  } else {
    // pokemontcg.io ID — use strategies A (TCGPlayer ID), B (set+number), C (name search)
    // to find the matching Poketrace card.

    // ── 2. Fetch pokemontcg.io info + all matching Poketrace set slugs in parallel ──
    // Skip pokemontcg.io lookup when the id is a Poketrace UUID — it won't resolve there.
    const [ptcgInfoResult, slugResult] = await Promise.allSettled([
      isPoketraceId ? Promise.resolve({ tcgplayerId: null, fullNumber: null, bareNumber: null, subtypes: [], supertypes: [], imageUrl: null } as PokemonTcgCardInfo) : getPokemonTcgCardInfo(id),
      setName ? getPoketraceSetSlugs(setName, inferredGame) : Promise.resolve([] as string[]),
    ])

    if (slugResult.status === 'rejected') {
      const err = slugResult.reason
      if (err instanceof PoketraceApiError) {
        if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
        return NextResponse.json({ error: poketraceApiMessage(err.status) }, { status: 503 })
      }
    }

    ptcgInfo          = ptcgInfoResult.status === 'fulfilled' ? ptcgInfoResult.value : { tcgplayerId: null, fullNumber: null, bareNumber: null, subtypes: [], supertypes: [], imageUrl: null }
    poketraceSetSlugs = slugResult.status === 'fulfilled' ? (slugResult.value ?? []) : []
    variants          = toPoketraceVariants(ptcgInfo.subtypes, ptcgInfo.supertypes)

    // Each strategy is wrapped independently so a failure in A doesn't prevent B or C.
    // PoketraceApiError (401/403/429/5xx) always propagates to the outer handler below.

    // ── Strategy A: TCGPlayer ID (most precise) ───────────────────────────────
    if (!matchedCard && ptcgInfo.tcgplayerId) {
      tried.push(`tcgplayer_id:${ptcgInfo.tcgplayerId}`)
      try {
        const found = await searchByTcgPlayerId(ptcgInfo.tcgplayerId)
        if (found) { matchedCard = found; matchReason = `tcgplayer_id:${ptcgInfo.tcgplayerId}` }
      } catch (err) {
        if (err instanceof PoketraceApiError) {
          if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
          return NextResponse.json({ error: poketraceApiMessage(err.status) }, { status: 503 })
        }
      }
    }

    // ── Strategy B: Set slug(s) + card number (deterministic) ───────────────
    if (!matchedCard && poketraceSetSlugs.length) {
      const numbersToTry = [
        ptcgInfo.fullNumber,
        ptcgInfo.bareNumber,
        cardNumber || null,
      ].filter((n, i, a): n is string => !!n && a.indexOf(n) === i)

      for (const num of numbersToTry) {
        tried.push(`set_slugs:[${poketraceSetSlugs.join(',')}]+number:${num}`)
        try {
          // findBySetAndNumber tries each slug in poketraceSetSlugs sequentially
          const found = await findBySetAndNumber(cardName, poketraceSetSlugs, num, variants, inferredGame)
          if (found) { matchedCard = found; matchReason = `set_slug:${found.set.slug}+number:${num}`; break }
        } catch (err) {
          if (err instanceof PoketraceApiError) {
            if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
            return NextResponse.json({ error: poketraceApiMessage(err.status) }, { status: 503 })
          }
          break
        }
      }
    }

    // ── Strategy C: Name search with set/number filtering (fuzzy fallback) ────
    if (!matchedCard) {
      tried.push(`name_search:${cardName}`)
      try {
        const matchResult = await findBestMatch(
          cardName,
          setName,
          ptcgInfo.fullNumber ?? cardNumber,
          ptcgInfo.tcgplayerId ?? undefined,
          poketraceSetSlugs[0] ?? undefined,
          inferredGame,
        )
        if (matchResult) { matchedCard = matchResult.card; matchReason = matchResult.debug.matchReason }
      } catch (err) {
        if (err instanceof PoketraceApiError) {
          if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
          return NextResponse.json({ error: poketraceApiMessage(err.status) }, { status: 503 })
        }
      }
    }
  }

  const isDev = process.env.NODE_ENV === 'development'

  if (!matchedCard) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({
      error: 'Card not found on Poketrace',
      ...(isDev && {
        debug: {
          searched: cardName,
          setName,
          cardNumber,
          tcgplayerId: ptcgInfo.tcgplayerId,
          fullNumber: ptcgInfo.fullNumber,
          poketraceSetSlugs,
          tried,
        }
      }),
    }, { status: 404 })
  }

  // ── 3. Fetch full card pricing ────────────────────────────────────────────
  let fullCard
  try {
    fullCard = await getPokétraceCard(matchedCard.id)
  } catch (err) {
    if (err instanceof PoketraceApiError) {
      if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
      return NextResponse.json({ error: poketraceApiMessage(err.status) }, { status: 503 })
    }
    fullCard = null
  }

  // If direct ID lookup failed (e.g. Poketrace returned a short market-prefixed ID
  // like "eu_469909" that its own /cards/{id} endpoint doesn't accept), try two
  // progressively broader recovery strategies:
  //
  //   A. Exact: set_slug + card number (most precise — only runs when both are present)
  //   B. Name search with correct market/game (broader, for URL-restored cards without set_slug)
  //
  // Both strategies use inferredGame so JP cards are always searched on the EU market.
  if (!fullCard && urlSetSlug && cardNumber) {
    try {
      const found = await findBySetAndNumber(cardName, [urlSetSlug], cardNumber, [], inferredGame)
      if (found) {
        fullCard = await getPokétraceCard(found.id)
        if (fullCard) matchReason = `set_slug_fallback:${urlSetSlug}+${cardNumber}`
      }
    } catch { /* best-effort fallback */ }
  }

  // Strategy B: name search with correct market (handles old URLs without set_slug/number)
  if (!fullCard && cardName && inferredGame !== 'pokemon') {
    try {
      const matchResult = await findBestMatch(cardName, setName, cardNumber || null, undefined, urlSetSlug || undefined, inferredGame)

      if (matchResult) {
        fullCard = await getPokétraceCard(matchResult.card.id)
        if (fullCard) matchReason = `name_search_fallback:${inferredGame}:${matchResult.debug.matchReason}`
      }
    } catch { /* best-effort fallback */ }
  }

  if (!fullCard) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({
      error: 'Failed to fetch card pricing',
      ...(isDev && { debug: { matchedCard: matchedCard.id, matchReason } }),
    }, { status: 502 })
  }

  const tier = gradeToTier(grade)
  let result = getTierPrice(fullCard, tier)

  if (!result) {
    if (cached) return NextResponse.json({ source: 'stale_cache', data: cached })
    return NextResponse.json({
      error: `No price data for ${grade}`,
      ...(isDev && {
        debug: {
          matchedCard: fullCard.name,
          matchedSet: fullCard.set.name,
          matchReason,
          tier,
          availableTiers: [
            ...Object.keys(fullCard.prices.ebay ?? {}),
            ...Object.keys(fullCard.prices.tcgplayer ?? {}),
          ],
        }
      }),
    }, { status: 404 })
  }

  const { tierPrice: rawTierPrice, resolvedTier } = result

  // ── 3a. Outlier correction ────────────────────────────────────────────────
  //
  // A single anomalous eBay sale (e.g. a "Mystery Grab" listing scraped as a
  // real sale) can massively distort the current price, moving averages, and
  // the price history chart. We strip outliers from all three:
  //
  //   1. Current avg: if < 3 sales and avg deviates > 75% from avg30d/avg7d,
  //      replace with the longer-period average.
  //   2. Price history: remove any monthly point that is outside
  //      [median/3 … median*3] — a 9× band that catches only extreme outliers.
  //   3. priceChangePct: computed from the cleaned avg vs cleaned history.

  /**
   * Detect an outlier sale and mathematically remove it from the average.
   *
   * Formula: cleanAvg = (avg * saleCount - outlierPrice) / (saleCount - 1)
   *
   * The outlier price is estimated as avg1d (most recent day's average) when
   * available, otherwise back-calculated from total vs the reference period.
   * Falls back to the reference average when saleCount === 1.
   *
   * Genuine hype / demand spikes are preserved via two guards:
   *
   *   Guard A — avg7d confirmation: if avg7d has also risen significantly vs
   *   avg30d (≥ 1.5×), the price shift has been sustained across multiple days
   *   of sales, not just one anomalous transaction. Trust it.
   *
   *   Guard B — sale count: if ≥ 5 sales are all pulling the average this far
   *   from the baseline, multiple independent buyers paid the price. Trust it.
   */
  function correctOutlierPrice(tp: typeof rawTierPrice): typeof rawTierPrice {
    const { avg, avg1d, avg7d, avg30d, saleCount } = tp
    if (!saleCount || saleCount < 1) return tp

    const reference = avg30d ?? avg7d
    if (!reference || reference <= 0) return tp

    // No outlier if price is within a 4× band of the longer-period average
    const ratio = avg / reference
    if (ratio >= 0.25 && ratio <= 4) return tp

    // ── Genuine-move guards ──────────────────────────────────────────────────
    // Guard A: avg7d has also risen relative to avg30d — the elevated price is
    // not just a single-day anomaly, it reflects several days of real sales.
    // Threshold: avg7d ≥ 1.5× avg30d means the 7-day window independently
    // confirms the shift, making a bad-listing explanation much less likely.
    if (avg30d && avg7d && avg7d >= avg30d * 1.5) return tp

    // Guard B: enough distinct sales to be statistically credible at the new
    // price level. A single mystery-grab listing can't survive 5+ transactions.
    if (saleCount >= 5) return tp
    // ────────────────────────────────────────────────────────────────────────

    // Only one sale — it IS the outlier, use reference as best estimate
    if (saleCount === 1) return cleanFields({ ...tp, avg: reference }, reference)

    // Multiple sales (2–4): estimate the outlier and remove it
    const total = avg * saleCount
    const outlierPrice = (avg1d != null && avg1d > 0)
      ? avg1d                                       // most recent day avg
      : total - reference * (saleCount - 1)         // back-calculated

    const cleanCount = saleCount - 1
    const cleanAvg   = (total - outlierPrice) / cleanCount

    // Sanity check — clean avg must be reasonable
    if (cleanAvg > 0 && cleanAvg >= reference * 0.25 && cleanAvg <= reference * 4) {
      return cleanFields({ ...tp, avg: cleanAvg, saleCount: cleanCount }, cleanAvg)
    }

    return cleanFields({ ...tp, avg: reference }, reference)
  }

  /**
   * After correcting avg, also fix low/high/avg1d/avg7d if they still
   * reflect the outlier sale (i.e. they are < 25% of the corrected price).
   */
  function cleanFields(tp: typeof rawTierPrice, correctedAvg: number): typeof rawTierPrice {
    const result = { ...tp }
    if (result.low  != null && result.low  < correctedAvg * 0.25) result.low  = correctedAvg
    if (result.high != null && result.high < correctedAvg * 0.25) result.high = correctedAvg
    if (result.avg1d != null && result.avg1d < correctedAvg * 0.25) result.avg1d = correctedAvg
    if (result.avg7d != null && result.avg7d < correctedAvg * 0.25) result.avg7d = correctedAvg
    return result
  }

  /**
   * Remove history points that are wildly outside the dataset AND isolated
   * (i.e. not confirmed by neighbouring months).
   *
   * Two-stage filter:
   *
   *   Stage 1 — median band: a point must be outside median/3 … median*3 to
   *   even be considered for removal. Points within that 9× band are always kept.
   *
   *   Stage 2 — neighbour confirmation: if a point is outside the band but its
   *   adjacent month(s) are also elevated (within 3× of the point itself), the
   *   move is sustained — a genuine step-change, not a stray data point. Keep it.
   *   Only remove the point if it is isolated (both neighbours are "normal"
   *   relative to the median).
   *
   * The most recent point is never removed — it may be a new price level that
   * hasn't yet had time to accumulate neighbouring months.
   */
  function removeHistoryOutliers(pts: PriceHistoryPoint[]): PriceHistoryPoint[] {
    if (pts.length < 3) return pts
    const sorted = [...pts].map(p => p.avg).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    if (median <= 0) return pts

    return pts.filter((p, i) => {
      // Always keep the most recent point — may be a genuine new price level
      if (i === pts.length - 1) return true

      // Stage 1: within the 9× median band → always keep
      if (p.avg >= median / 3 && p.avg <= median * 3) return true

      // Stage 2: outside the band — check neighbours before removing.
      // If at least one adjacent month is also elevated (within 3× of this
      // point), treat it as a sustained shift and preserve it.
      const prev = i > 0             ? pts[i - 1].avg : null
      const next = i < pts.length - 1 ? pts[i + 1].avg : null

      const prevConfirms = prev != null && prev > 0 && p.avg / prev >= 0.33 && p.avg / prev <= 3
      const nextConfirms = next != null && next > 0 && p.avg / next >= 0.33 && p.avg / next <= 3

      if (prevConfirms || nextConfirms) return true

      // Isolated spike with no neighbour confirmation — remove
      return false
    })
  }

  // ── 3b. Data quality gate: eBay sale count → warning + optional TCGPlayer fallback ──
  //
  //  saleCount >= 10  → normal, no warning
  //  saleCount 5–9    → 'limited_sales'  (soft warning, keep eBay)
  //  saleCount < 5:
  //    avg > $5 000   → 'rare_asset'          (keep eBay, no TCGPlayer fallback)
  //    avg $1k–$5k    → 'high_value_limited'  (keep eBay, soft confidence)
  //    avg < $1 000   → 'low_volume_tcg_fallback' or 'low_volume_no_fallback'

  const ebayTierData   = fullCard.prices.ebay?.[resolvedTier]
  const ebaySaleCount  = ebayTierData?.saleCount ?? rawTierPrice.saleCount ?? 0
  const ebayAvgUSD     = ebayTierData?.avg ?? rawTierPrice.avg

  // CardMarket AGGREGATED = Japanese card priced via EU market (no eBay/TCGPlayer data)
  const isCardMarket = resolvedTier === 'AGGREGATED'

  let tierPrice  = rawTierPrice
  let dataSource = isCardMarket ? 'cardmarket' : ebayTierData ? 'ebay' : 'tcgplayer'
  let dataWarning: string | null = null

  if (ebayTierData) {
    if (ebaySaleCount >= 30) {
      // Normal confidence — no warning
    } else if (ebaySaleCount >= 10) {
      dataWarning = 'limited_sales'
    } else {
      // < 5 eBay sales — branch on price
      if (ebayAvgUSD > 5000) {
        dataWarning = 'rare_asset'
        // Keep eBay data — rare cards should not fall back to TCGPlayer
      } else if (ebayAvgUSD >= 1000) {
        dataWarning = 'high_value_limited'
        // Keep eBay data — indicative only
      } else {
        // Low-value + low-volume → prefer TCGPlayer if available
        const tcgFallback = fullCard.prices.tcgplayer?.[resolvedTier]
        if (tcgFallback && tcgFallback.avg > 0) {
          tierPrice  = tcgFallback
          dataSource = 'tcgplayer'
          dataWarning = 'low_volume_tcg_fallback'
        } else {
          dataWarning = 'low_volume_no_fallback'
        }
      }
    }
  }

  // Apply outlier correction to the resolved price
  tierPrice = correctOutlierPrice(tierPrice)

  // ── 3c. Hybrid price: prefer avg1d for high-volume actively traded cards ──
  //
  // For cards with 50+ sales in 30 days, the 1-day average is a better
  // reflection of the current market than the 30-day average, which gets
  // dragged down by older (potentially stale) sales. We switch to avg1d when:
  //
  //   1. saleCount >= 50  — enough volume that a single day has multiple sales
  //   2. avg1d exists and is > 0
  //   3. avg1d differs from the 30d avg by more than 10% (meaningful divergence)
  //
  // The 30d avg is kept as avg30d for score/trend/change% calculations.
  // We do NOT apply outlier correction again — avg1d has already passed
  // correctOutlierPrice which guards against single-sale anomalies.

  const HIGH_VOLUME_THRESHOLD = 50
  const DIVERGENCE_THRESHOLD  = 0.10  // 10%

  if (
    tierPrice.saleCount != null &&
    tierPrice.saleCount >= HIGH_VOLUME_THRESHOLD &&
    tierPrice.avg1d != null &&
    tierPrice.avg1d > 0
  ) {
    const divergence = Math.abs(tierPrice.avg1d - tierPrice.avg) / tierPrice.avg
    if (divergence > DIVERGENCE_THRESHOLD) {
      tierPrice = { ...tierPrice, avg: tierPrice.avg1d }
    }
  }

  // ── 4. Fetch price history ────────────────────────────────────────────────
  const rawHistory = await getPriceHistory(matchedCard.id, resolvedTier, '1y')

  // Remove outlier points from history so chart, score, and trend are clean
  const history = removeHistoryOutliers(rawHistory)

  // ── 5. Compute score ──────────────────────────────────────────────────────
  const scoreBreakdown = computeScore(tierPrice, history)

  // ── 6. Build price change % ───────────────────────────────────────────────
  // Use cleaned history — outlier months no longer skew the trend %
  // Store null (not 0) when there is genuinely no 30d reference to compare against.
  // The market index median will then exclude these cards from its change calculation,
  // producing "—" instead of a misleading "+0.00%".
  let priceChangePct: number | null = null
  if (tierPrice.avg30d && tierPrice.avg30d > 0) {
    priceChangePct = ((tierPrice.avg - tierPrice.avg30d) / tierPrice.avg30d) * 100
  } else if (history.length >= 2) {
    const oldest = history[0].avg
    const newest = history[history.length - 1].avg
    priceChangePct = oldest > 0 ? ((newest - oldest) / oldest) * 100 : null
  }

  // ── 7. Format history for sparkline / chart ──────────────────────────────
  // Group by calendar month so the index chart can aggregate across cards.
  // Format: "Apr 2025" — includes year for correct multi-year sorting.
  // Duplicate months are de-duplicated by keeping the last (most recent) price.
  const monthMap = new Map<string, { price: number; volume: number }>()
  for (const h of history) {
    const d = new Date(h.date)
    const key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    monthMap.set(key, { price: h.avg, volume: h.saleCount ?? 0 })
  }
  const priceHistory = Array.from(monthMap.entries()).map(([month, v]) => ({
    month,
    price: v.price,
    volume: v.volume,
  }))

  // ── 8. Build all-tier price ladder ────────────────────────────────────────
  // eBay is always primary. TCGPlayer only fills in tiers eBay doesn't have.
  const allTierPrices: Record<string, { avg: number; source: string; saleCount?: number }> = {}

  for (const [t, tp] of Object.entries(fullCard.prices.ebay ?? {})) {
    allTierPrices[t] = { avg: tp.avg, source: 'eBay', saleCount: tp.saleCount }
  }
  for (const [t, tp] of Object.entries(fullCard.prices.tcgplayer ?? {})) {
    if (!allTierPrices[t]) {
      allTierPrices[t] = { avg: tp.avg, source: 'TCGPlayer', saleCount: tp.saleCount }
    }
  }
  if (fullCard.prices.cardmarket?.AGGREGATED) {
    allTierPrices['AGGREGATED'] = {
      avg: fullCard.prices.cardmarket.AGGREGATED.avg,
      source: 'CardMarket',
      saleCount: fullCard.prices.cardmarket.AGGREGATED.saleCount,
    }
  }

  // ── 9. Build + upsert cache record ───────────────────────────────────────
  const record = {
    cache_key:           cacheKey,
    card_id:             id,
    card_name:           cardName,
    set_name:            setName || fullCard.set.name,
    grade,
    image_url:           ptcgInfo.imageUrl ?? fullCard.image,
    price:               tierPrice.avg,
    price_change_pct:    priceChangePct != null ? Math.round(priceChangePct * 10) / 10 : null,
    price_range_low:     tierPrice.low  ?? tierPrice.avg,
    price_range_high:    tierPrice.high ?? tierPrice.avg,
    price_history:       priceHistory,
    ebay_listings:       [],
    score:               scoreBreakdown.total,
    score_breakdown:     scoreBreakdown,
    sales_count_30d:     tierPrice.saleCount ?? 0,
    last_fetched:        new Date().toISOString(),
    poketrace_id:        fullCard.id,
    match_reason:        matchReason,
    currency:            fullCard.currency,
    market:              fullCard.market,
    resolved_tier:       resolvedTier,
    avg1d:               tierPrice.avg1d  ?? null,
    avg7d:               tierPrice.avg7d  ?? null,
    avg30d:              tierPrice.avg30d ?? null,
    trend:               tierPrice.trend  ?? null,
    confidence:          tierPrice.confidence ?? (
      dataWarning === null             ? 'high'   :
      dataWarning === 'limited_sales'  ? 'medium' :
      dataWarning === 'rare_asset'     ? 'medium' :
      dataWarning === 'high_value_limited' ? 'medium' :
      'low'
    ),
    all_tier_prices:     allTierPrices,
    total_sale_count:    fullCard.totalSaleCount ?? null,
    last_updated_pt:     fullCard.lastUpdated ?? null,
    data_warning:        dataWarning,
    data_source:         dataSource,
    ebay_sale_count:     ebaySaleCount,    // original eBay count, even when fallen back to TCGPlayer
    ebay_avg_usd:        ebayAvgUSD,       // original eBay avg, even when fallen back
  }

  const [{ error: upsertErr }] = await Promise.all([
    supabase.from('search_cache').upsert(record),
    supabase.from('search_log').insert({ card_id: id, card_name: cardName, grade, user_id: searchUserId, ...(isRefresh ? { source: 'refresh' } : {}) }),
  ])

  if (upsertErr) {
    // Surface cache write failures — most common cause is a missing column in search_cache.
    // Run the migration at /api/admin/market/migrate-cache to fix this.
    console.error('[card] search_cache upsert failed:', upsertErr.message, '— card:', cardName, id)
    return NextResponse.json({
      source: 'live',
      data: record,
      warning: `Cache write failed: ${upsertErr.message}`,
    })
  }

  // ── 10. Store ALL tiers (when requested by admin refresh) ─────────────────
  // For each eBay tier returned by Poketrace (other than the one already stored),
  // upsert a lightweight cache row with price + avg7d/avg30d data.
  // No separate history API call is made — price_history is left empty for secondary tiers.
  if (allTiers && fullCard.prices.ebay) {
    const secondaryRows = []
    const now = new Date().toISOString()
    for (const [tier, tp] of Object.entries(fullCard.prices.ebay)) {
      if (tier === resolvedTier) continue   // primary tier already stored above
      if (!tp.avg || tp.avg <= 0) continue  // skip tiers with no price data
      const displayGrade = tierToGrade(tier)
      const tierCacheKey = `${id}:${displayGrade}`
      const tierPriceChangePct = tp.avg30d && tp.avg30d > 0
        ? Math.round(((tp.avg - tp.avg30d) / tp.avg30d) * 1000) / 100
        : null
      secondaryRows.push({
        cache_key:        tierCacheKey,
        card_id:          id,
        card_name:        cardName,
        set_name:         setName || fullCard.set.name,
        grade:            displayGrade,
        image_url:        ptcgInfo.imageUrl ?? fullCard.image,
        price:            tp.avg,
        price_change_pct: tierPriceChangePct,
        price_range_low:  tp.low  ?? tp.avg,
        price_range_high: tp.high ?? tp.avg,
        price_history:    [],
        ebay_listings:    [],
        score:            null,
        score_breakdown:  null,
        sales_count_30d:  tp.saleCount ?? 0,
        last_fetched:     now,
        poketrace_id:     fullCard.id,
        match_reason:     matchReason,
        currency:         fullCard.currency,
        market:           fullCard.market,
        resolved_tier:    tier,
        avg1d:            tp.avg1d  ?? null,
        avg7d:            tp.avg7d  ?? null,
        avg30d:           tp.avg30d ?? null,
        trend:            tp.trend  ?? null,
        confidence:       tp.confidence ?? null,
        all_tier_prices:  allTierPrices,
        total_sale_count: fullCard.totalSaleCount ?? null,
        last_updated_pt:  fullCard.lastUpdated ?? null,
        data_warning:     null,
        data_source:      'ebay',
        ebay_sale_count:  tp.saleCount ?? 0,
        ebay_avg_usd:     tp.avg,
      })
    }
    if (secondaryRows.length > 0) {
      const { error: tierErr } = await supabase.from('search_cache').upsert(secondaryRows)
      if (tierErr) console.error('[card] secondary tier upsert failed:', tierErr.message, '— card:', cardName)
    }
  }

  return NextResponse.json({ source: 'live', data: record }, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
  })
}
