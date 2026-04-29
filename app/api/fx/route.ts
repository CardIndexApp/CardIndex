/**
 * GET /api/fx
 *
 * Returns USD-based exchange rates, proxied server-side so the CSP
 * connect-src doesn't need to allow external domains.
 * Uses Next.js `revalidate: 3600` — rates are re-fetched at most once per hour.
 */

import { NextResponse } from 'next/server'

const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79,
  AUD: 1.54, CAD: 1.37, JPY: 149.5, NZD: 1.64, SGD: 1.34,
}

export async function GET() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const json = await res.json()
    if (json.result !== 'success' || !json.rates) throw new Error('bad response')
    return NextResponse.json({ rates: json.rates as Record<string, number> }, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    })
  } catch {
    return NextResponse.json({ rates: FALLBACK_RATES }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
    })
  }
}
