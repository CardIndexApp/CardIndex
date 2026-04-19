/**
 * eBay Finding API client
 * Uses findCompletedItems to get real sold listing data.
 * Only requires EBAY_APP_ID — no OAuth needed.
 *
 * Docs: https://developer.ebay.com/devzone/finding/CallRef/findCompletedItems.html
 */

const FINDING_URL = 'https://svcs.ebay.com/services/search/FindingService/v1'

export interface EbayListing {
  title: string
  price: number
  date: string
  url: string
  condition: string
}

export interface EbayPriceData {
  listings: EbayListing[]
  averagePrice: number
  medianPrice: number
  lowestPrice: number
  highestPrice: number
  salesCount: number
  /** Monthly price points for the last 6 months (oldest → newest) */
  priceHistory: { month: string; price: number }[]
}

function buildQuery(cardName: string, grade: string): string {
  // Build a precise eBay search query
  const gradeStr = grade === 'Raw' ? '' : `"${grade}"`
  return `${gradeStr} "${cardName}"`.trim()
}

export async function fetchEbayPriceData(
  cardName: string,
  grade: string
): Promise<EbayPriceData | null> {
  const appId = process.env.EBAY_APP_ID
  if (!appId) {
    console.warn('EBAY_APP_ID not set — returning null')
    return null
  }

  const keywords = buildQuery(cardName, grade)

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    keywords,
    'categoryId': '183050',               // Trading Card Singles
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'itemFilter(1).name': 'ListingType',
    'itemFilter(1).value': 'FixedPrice',
    'itemFilter(2).name': 'Currency',
    'itemFilter(2).value': 'USD',
    'sortOrder': 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '50',
    'outputSelector(0)': 'SellerInfo',
  })

  try {
    const res = await fetch(`${FINDING_URL}?${params.toString()}`, {
      next: { revalidate: 21600 }, // cache for 6 hours
    })
    if (!res.ok) return null

    const json = await res.json()
    const root = json?.findCompletedItemsResponse?.[0]
    if (root?.ack?.[0] !== 'Success') return null

    const items: any[] = root?.searchResult?.[0]?.item ?? []
    if (items.length === 0) return null

    const listings: EbayListing[] = items
      .map((item: any) => ({
        title: item.title?.[0] ?? '',
        price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] ?? '0'),
        date: item.listingInfo?.[0]?.endTime?.[0] ?? '',
        url: item.viewItemURL?.[0] ?? '',
        condition: item.condition?.[0]?.conditionDisplayName?.[0] ?? 'Used',
      }))
      .filter(l => l.price > 0)

    if (listings.length === 0) return null

    const prices = listings.map(l => l.price).sort((a, b) => a - b)
    const averagePrice = prices.reduce((s, p) => s + p, 0) / prices.length
    const medianPrice = prices[Math.floor(prices.length / 2)]
    const lowestPrice = prices[0]
    const highestPrice = prices[prices.length - 1]

    // Build 6-month price history by bucketing by month
    const byMonth: Record<string, number[]> = {}
    listings.forEach(l => {
      if (!l.date) return
      const d = new Date(l.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!byMonth[key]) byMonth[key] = []
      byMonth[key].push(l.price)
    })

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const priceHistory = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, ps]) => ({
        month: monthLabels[parseInt(key.split('-')[1]) - 1],
        price: Math.round(ps.reduce((s, p) => s + p, 0) / ps.length),
      }))

    return {
      listings: listings.slice(0, 10), // top 10 recent sales
      averagePrice: Math.round(averagePrice * 100) / 100,
      medianPrice: Math.round(medianPrice * 100) / 100,
      lowestPrice: Math.round(lowestPrice * 100) / 100,
      highestPrice: Math.round(highestPrice * 100) / 100,
      salesCount: listings.length,
      priceHistory,
    }
  } catch (err) {
    console.error('eBay API error:', err)
    return null
  }
}
