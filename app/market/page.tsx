import MarketClient from '@/components/MarketClient'
import type { MarketResponse } from '@/app/api/market/route'

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL)          return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

async function getMarketData(): Promise<MarketResponse | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/market`, {
      next: { revalidate: 1800 }, // 30-minute ISR — matches API's Cache-Control
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function MarketPage() {
  const initialData = await getMarketData()
  return <MarketClient initialData={initialData} />
}
