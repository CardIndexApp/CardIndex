'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { usePullToRefresh } from '@/lib/usePullToRefresh'
import { useCurrency } from '@/lib/currency'
import { tcgImg } from '@/lib/img'
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WatchlistItem {
  id: string; card_id: string; card_name: string; set_name: string; grade: string; price?: number | null
}
interface RecentlyViewedItem {
  card_id: string; card_name: string; grade: string; set_name: string | null; viewed_at: string; image_url?: string | null
}
interface ChartPosition {
  card_id: string; grade: string; quantity: number; purchase_price: number
  price: number; avg7d: number | null; avg30d: number | null
  price_history: Array<{ month: string; price: number }> | null
}
interface PortfolioStats {
  posCount: number; soldCount: number; costBasis: number; currentValue: number
  cachedCount: number; realizedPL: number; winTrades: number; loseTrades: number; gradedCount: number
}
interface MarketCard {
  card_id: string; card_name: string; grade: string
  change: number | null; price: number | null; score: number | null; image_url: string | null
}

// ── Chart helpers (ported from portfolio page) ─────────────────────────────────

function parseMonthKey(m: string): number { return new Date(m).getTime() }

function buildPortfolioHistory(
  positions: ChartPosition[],
  windowDays: number,
): { label: string; value: number }[] {
  const posWithHistory = positions.filter(p => p.price_history?.length)
  const totalCost = positions.reduce((s, p) => s + p.purchase_price * p.quantity, 0)

  if (posWithHistory.length > 0) {
    const allMonthsSet = new Set<string>()
    for (const pos of posWithHistory) for (const h of pos.price_history!) allMonthsSet.add(h.month)
    const windowMonths = Math.max(1, Math.ceil(windowDays / 30))
    const sliced = Array.from(allMonthsSet).sort((a, b) => parseMonthKey(a) - parseMonthKey(b)).slice(-windowMonths)

    return sliced.map(month => {
      let value = 0
      for (const pos of posWithHistory) {
        const histMap = new Map(pos.price_history!.map(h => [h.month, h.price]))
        const ts = parseMonthKey(month)
        let price = histMap.get(month)
        if (price == null) {
          const cands = pos.price_history!.filter(h => parseMonthKey(h.month) <= ts).sort((a, b) => parseMonthKey(b.month) - parseMonthKey(a.month))
          price = cands[0]?.price ?? pos.price
        }
        value += price * pos.quantity
      }
      for (const pos of positions.filter(p => !p.price_history?.length)) value += pos.price * pos.quantity
      return { label: month, value }
    }).concat([{ label: 'Now', value: positions.reduce((s, p) => s + p.price * p.quantity, 0) }])
  }

  // Synthetic fallback from avg7d/avg30d
  const posWithData = positions.filter(p => p.price > 0)
  if (!posWithData.length) return []
  const hasAvg = posWithData.some(p => p.avg30d != null || p.avg7d != null)
  if (!hasAvg) return []

  const now = Date.now()
  const fmt = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  function valueAt(daysAgo: number): number {
    let v = 0
    for (const pos of posWithData) {
      const price = daysAgo === 0 ? pos.price : daysAgo <= 7 ? (pos.avg7d ?? pos.price) : (pos.avg30d ?? pos.avg7d ?? pos.price)
      v += price * pos.quantity
    }
    return v
  }

  const anchors = [{ daysAgo: 30 }, { daysAgo: 7 }, { daysAgo: 0 }].filter(a => a.daysAgo <= windowDays)
  if (anchors.length < 2) return []

  const points: { label: string; value: number }[] = []
  for (let i = 0; i < anchors.length - 1; i++) {
    const from = anchors[i]; const to = anchors[i + 1]
    const span = from.daysAgo - to.daysAgo
    const fromVal = valueAt(from.daysAgo); const toVal = valueAt(to.daysAgo)
    for (let d = 0; d < span; d++) {
      const t = d / span
      points.push({ label: fmt(now - (from.daysAgo - d) * 86_400_000), value: fromVal + (toVal - fromVal) * t })
    }
  }
  points.push({ label: 'Today', value: valueAt(0) })
  return points
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIOD_TABS = ['1D', '7D', '30D', '90D', '1Y', 'ALL'] as const
type Period = typeof PERIOD_TABS[number]
const PERIOD_DAYS: Record<Period, number> = { '1D': 1, '7D': 7, '30D': 30, '90D': 90, '1Y': 365, 'ALL': 999 }

const GRADIENTS = [
  'linear-gradient(135deg,#1a3a6e,#2d5aa0)',
  'linear-gradient(135deg,#6e1a6e,#a03da0)',
  'linear-gradient(135deg,#2a6e3a,#3d9a52)',
  'linear-gradient(135deg,#6e3a1a,#a05a2d)',
  'linear-gradient(135deg,#1a5a6e,#2d8ca0)',
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const { fmtCurrency } = useCurrency()

  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([])
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([])
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null)
  const [chartPositions, setChartPositions] = useState<ChartPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [activePeriod, setActivePeriod] = useState<Period>('30D')
  const [marketSnap, setMarketSnap] = useState<{
    topRising: MarketCard[]; topFalling: MarketCard[]; risingCount: number; fallingCount: number
  } | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/'); return }

    // Recently viewed from localStorage
    let rvItems: RecentlyViewedItem[] = []
    try {
      rvItems = (JSON.parse(localStorage.getItem(`ci_rv_${user.id}`) ?? '[]') as RecentlyViewedItem[]).slice(0, 6)
      setRecentlyViewed(rvItems)
    } catch { setRecentlyViewed([]) }

    const [{ data: wlRows }, { data: pf }] = await Promise.all([
      supabase.from('watchlists').select('id, card_id, card_name, set_name, grade').eq('user_id', user.id).limit(5),
      supabase.from('portfolios').select('id, card_id, grade, purchase_price, quantity, sold, sale_price').eq('user_id', user.id),
    ])

    // Backfill missing image_urls in recently viewed
    const rvMissing = rvItems.filter(r => !r.image_url)
    if (rvMissing.length > 0) {
      const { data: imgCache } = await supabase.from('search_cache').select('cache_key, image_url').in('cache_key', rvMissing.map(r => `${r.card_id}:${r.grade}`))
      if (imgCache?.length) {
        const imgMap = new Map(imgCache.filter(r => r.image_url).map(r => [r.cache_key, r.image_url as string]))
        setRecentlyViewed(prev => prev.map(r => r.image_url ? r : { ...r, image_url: imgMap.get(`${r.card_id}:${r.grade}`) ?? null }))
      }
    }

    // Watchlist with prices
    const wlList = (wlRows ?? []) as WatchlistItem[]
    if (wlList.length > 0) {
      const { data: priceRows } = await supabase.from('search_cache').select('cache_key, price').in('cache_key', wlList.map(w => `${w.card_id}:${w.grade}`))
      const pm = new Map((priceRows ?? []).filter(r => r.price != null).map(r => [r.cache_key, r.price as number]))
      setWatchlistItems(wlList.map(w => ({ ...w, price: pm.get(`${w.card_id}:${w.grade}`) ?? null })))
    } else {
      setWatchlistItems([])
    }

    // Portfolio stats + chart data
    const positions = pf ?? []
    const openPositions = positions.filter((p: { sold: boolean }) => !p.sold)
    const soldPositions = positions.filter((p: { sold: boolean }) => p.sold)
    let costBasis = 0, currentValue = 0, cachedCount = 0, realizedPL = 0, winTrades = 0, loseTrades = 0, gradedCount = 0

    for (const pos of openPositions) {
      costBasis += (pos.purchase_price as number) * (pos.quantity as number)
      if (/^(PSA|BGS|CGC|SGC)/i.test((pos.grade as string) ?? '')) gradedCount++
    }
    for (const pos of soldPositions.filter((p: { sale_price: number | null }) => p.sale_price != null)) {
      const gain = ((pos.sale_price as number) - (pos.purchase_price as number)) * (pos.quantity as number)
      realizedPL += gain
      if (gain >= 0) winTrades++; else loseTrades++
    }

    if (openPositions.length > 0) {
      const cacheKeys = openPositions.map((p: { card_id: string; grade: string }) => `${p.card_id}:${p.grade}`)
      const { data: priceRows } = await supabase
        .from('search_cache')
        .select('cache_key, price, avg7d, avg30d, price_history')
        .in('cache_key', cacheKeys)
      const cacheMap = new Map((priceRows ?? []).map(r => [r.cache_key as string, r]))
      const cps: ChartPosition[] = []
      for (const pos of openPositions) {
        const key = `${pos.card_id}:${pos.grade}`
        const cached = cacheMap.get(key)
        if (cached?.price != null && cached.price > 0) {
          currentValue += (cached.price as number) * (pos.quantity as number)
          cachedCount++
          cps.push({
            card_id: pos.card_id as string,
            grade: pos.grade as string,
            quantity: pos.quantity as number,
            purchase_price: pos.purchase_price as number,
            price: cached.price as number,
            avg7d: cached.avg7d as number | null,
            avg30d: cached.avg30d as number | null,
            price_history: (cached.price_history as Array<{ month: string; price: number }> | null) ?? null,
          })
        }
      }
      setChartPositions(cps)
    }

    setPortfolioStats({ posCount: openPositions.length, soldCount: soldPositions.length, costBasis, currentValue, cachedCount, realizedPL, winTrades, loseTrades, gradedCount })
    setLoading(false)

    // Market snapshot — non-blocking
    fetch('/api/market')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || d.empty) return
        setMarketSnap({
          topRising: (d.topRising ?? []).slice(0, 5),
          topFalling: (d.topFalling ?? []).slice(0, 3),
          risingCount: d.stats?.risingCount ?? 0,
          fallingCount: d.stats?.fallingCount ?? 0,
        })
      })
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])
  const { pullY, refreshing } = usePullToRefresh(load)

  const clearRecentlyViewed = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    localStorage.removeItem(`ci_rv_${user.id}`)
    setRecentlyViewed([])
  }, [])

  // Build chart data for the selected period
  const chartData = useMemo(() => {
    if (!chartPositions.length) return []
    return buildPortfolioHistory(chartPositions, PERIOD_DAYS[activePeriod])
  }, [chartPositions, activePeriod])

  if (loading) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 88, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Loading…</div>
        </main>
      </>
    )
  }

  const hasPrices = (portfolioStats?.cachedCount ?? 0) > 0
  const pfValue = hasPrices ? portfolioStats?.currentValue : portfolioStats?.costBasis
  const pfPnL = hasPrices && portfolioStats ? portfolioStats.currentValue - portfolioStats.costBasis : null
  const pfPct = pfPnL != null && (portfolioStats?.costBasis ?? 0) > 0 ? (pfPnL / portfolioStats!.costBasis) * 100 : null
  const chartUp = chartData.length >= 2 ? chartData[chartData.length - 1].value >= chartData[0].value : true
  const lineColor = chartUp ? '#3de88a' : '#e8524a'

  const best = marketSnap?.topRising[0] ?? null
  const worst = marketSnap?.topFalling[0] ?? null

  const CardRow = ({ card, idx, last }: { card: MarketCard; idx: number; last: boolean }) => {
    const params = new URLSearchParams({ name: card.card_name, grade: card.grade })
    return (
      <Link href={`/card/${card.card_id}?${params}`} style={{ display: 'flex', alignItems: 'center', padding: '11px 0', borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.06)', textDecoration: 'none', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: card.image_url ? 'var(--surface2)' : GRADIENTS[idx % GRADIENTS.length], border: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden' }}>
          {card.image_url && <img src={tcgImg(card.image_url)} alt={card.card_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.card_name}</div>
          <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{card.grade}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{card.price != null ? fmtCurrency(card.price) : '—'}</div>
          {card.change != null && (
            <div className="font-num" style={{ fontSize: 11, color: card.change >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
              {card.change >= 0 ? '▲' : '▼'}{fmtCurrency(Math.abs(card.change))} ({Math.abs(card.change).toFixed(1)}%)
            </div>
          )}
        </div>
      </Link>
    )
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 88, paddingBottom: 48, minHeight: '100vh' }}>

        {/* Pull-to-refresh */}
        {(pullY > 0 || refreshing) && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, display: 'flex', justifyContent: 'center', transform: `translateY(${refreshing ? 56 : pullY - 8}px)`, transition: refreshing ? 'transform 0.2s ease' : 'none', pointerEvents: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" style={{ animation: refreshing ? 'ptr-spin 0.7s linear infinite' : 'none', opacity: Math.min(pullY / 72, 1) }}>
                {refreshing ? <path d="M7 1a6 6 0 1 0 6 6" /> : <path d="M7 1v6M4 4l3 3 3-3" />}
              </svg>
            </div>
          </div>
        )}

        <div className="dash-wrap">

          {/* ── Chart + Portfolio Hero ── */}
          <div className="dash-hero-section">

            {/* Period tabs */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
              {PERIOD_TABS.map(p => (
                <button key={p} onClick={() => setActivePeriod(p)} style={{ padding: '6px 13px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: activePeriod === p ? 'var(--gold)' : 'transparent', color: activePeriod === p ? '#08080f' : 'var(--ink3)', transition: 'all 0.15s' }}>
                  {p}
                </button>
              ))}
            </div>

            {/* Chart */}
            {chartData.length >= 2 && (
              <div style={{ width: '100%', height: 140, marginBottom: 4 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis domain={['dataMin', 'dataMax']} hide />
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
                            <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                              {fmtCurrency(payload[0]?.value as number)}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{payload[0]?.payload?.label}</div>
                          </div>
                        ) : null
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={lineColor}
                      strokeWidth={2}
                      fill="url(#chartFill)"
                      dot={false}
                      activeDot={{ r: 4, fill: lineColor, stroke: 'var(--bg)', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {chartData.length >= 2 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{chartData[0]?.label}</span>
                <span style={{ fontSize: 10, color: 'var(--ink3)' }}>Today</span>
              </div>
            )}

            {/* Portfolio value */}
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 6 }}>Total Portfolio Value</div>
            <div className="font-num" style={{ fontSize: 44, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-2px', lineHeight: 1, marginBottom: 6 }}>
              {pfValue != null && pfValue > 0 ? fmtCurrency(pfValue) : '—'}
            </div>
            {pfPnL != null && pfPct != null && (
              <div className="font-num" style={{ fontSize: 17, fontWeight: 600, color: pfPnL >= 0 ? 'var(--green)' : 'var(--red)', marginBottom: 2 }}>
                {pfPnL >= 0 ? '+' : ''}{fmtCurrency(pfPnL)} ({pfPnL >= 0 ? '+' : ''}{pfPct.toFixed(1)}%)
              </div>
            )}
          </div>

          {/* ── Two-column grid ── */}
          <div className="dash-grid">

            {/* LEFT column */}
            <div className="dash-left">

              {/* Top Performers */}
              {marketSnap && (marketSnap.topRising.length > 0 || marketSnap.topFalling.length > 0) && (
                <div className="dash-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', textTransform: 'uppercase' }}>Top Performers</span>
                    <Link href="/market" style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>See all ›</Link>
                  </div>
                  {marketSnap.topRising.length > 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', letterSpacing: 1 }}>GAINERS</span>
                      </div>
                      {marketSnap.topRising.slice(0, 5).map((card, i) => (
                        <CardRow key={card.card_id + 'g' + i} card={card} idx={i} last={i === 4 && marketSnap.topFalling.length === 0} />
                      ))}
                    </>
                  )}
                  {marketSnap.topFalling.length > 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: marketSnap.topRising.length > 0 ? 14 : 0, marginBottom: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', letterSpacing: 1 }}>LOSERS</span>
                      </div>
                      {marketSnap.topFalling.map((card, i) => (
                        <CardRow key={card.card_id + 'l' + i} card={card} idx={i + 10} last={i === marketSnap.topFalling.length - 1} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT column */}
            <div className="dash-right">

              {/* Recently Viewed */}
              {recentlyViewed.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', textTransform: 'uppercase' }}>Recently Viewed</span>
                    <button onClick={clearRecentlyViewed} style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: 0.5, fontFamily: 'inherit' }}>CLEAR</button>
                  </div>
                  <div className="rv-grid">
                    {recentlyViewed.slice(0, 4).map((item, i) => {
                      const params = new URLSearchParams({ grade: item.grade, name: item.card_name })
                      if (item.set_name) params.set('set', item.set_name)
                      return (
                        <Link key={`${item.card_id}-${i}`} href={`/card/${item.card_id}?${params}`} style={{ textDecoration: 'none' }}>
                          <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: 8, background: item.image_url ? 'var(--surface2)' : 'linear-gradient(160deg,var(--surface2) 0%,rgba(100,100,180,0.12) 100%)', border: '1px solid var(--border2)', marginBottom: 6, overflow: 'hidden' }}>
                            {item.image_url && <img src={tcgImg(item.image_url)} alt={item.card_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.card_name}</div>
                          <div style={{ fontSize: 9, color: 'var(--ink3)', marginTop: 2 }}>{item.grade}</div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Watchlist Snapshot */}
              {watchlistItems.length > 0 && (
                <div className="dash-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', textTransform: 'uppercase' }}>Watchlist Snapshot</span>
                    <Link href="/watchlist" style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>View watchlist ›</Link>
                  </div>
                  {watchlistItems.map((item, i) => {
                    const params = new URLSearchParams({ name: item.card_name, grade: item.grade })
                    return (
                      <Link key={item.id} href={`/card/${item.card_id}?${params}`} style={{ display: 'flex', alignItems: 'center', padding: '11px 0', borderBottom: i < watchlistItems.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', textDecoration: 'none', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: GRADIENTS[i % GRADIENTS.length], border: '1px solid var(--border)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.card_name}</div>
                          <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{item.set_name} · {item.grade}</div>
                        </div>
                        {item.price != null && (
                          <div className="font-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>{fmtCurrency(item.price)}</div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}

              {/* Best / Worst */}
              {(best || worst) && (
                <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
                  {best && (
                    <Link href={`/card/${best.card_id}?${new URLSearchParams({ name: best.card_name, grade: best.grade })}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: worst ? '1px solid var(--border)' : 'none', textDecoration: 'none' }}>
                      <div>
                        <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--green)', fontWeight: 700, marginBottom: 3 }}>BEST</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{best.card_name}</div>
                      </div>
                      <div className="font-num" style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>
                        {best.change != null ? `+${best.change.toFixed(1)}%` : '—'}
                      </div>
                    </Link>
                  )}
                  {worst && (
                    <Link href={`/card/${worst.card_id}?${new URLSearchParams({ name: worst.card_name, grade: worst.grade })}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', textDecoration: 'none' }}>
                      <div>
                        <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--red)', fontWeight: 700, marginBottom: 3 }}>WORST</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{worst.card_name}</div>
                      </div>
                      <div className="font-num" style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>
                        {worst.change != null ? `${worst.change.toFixed(1)}%` : '—'}
                      </div>
                    </Link>
                  )}
                </div>
              )}

              {/* Portfolio Health */}
              {portfolioStats && portfolioStats.posCount > 0 && (() => {
                const plAmt = hasPrices ? pfPnL : (portfolioStats.realizedPL !== 0 ? portfolioStats.realizedPL : null)
                const plPct = hasPrices && pfPnL != null && portfolioStats.costBasis > 0 ? (pfPnL / portfolioStats.costBasis) * 100 : null
                const totalTrades = portfolioStats.winTrades + portfolioStats.loseTrades
                const winRate = totalTrades > 0 ? (portfolioStats.winTrades / totalTrades) * 100 : null
                return (
                  <div className="dash-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--ink3)', textTransform: 'uppercase' }}>Portfolio Health</span>
                      <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{portfolioStats.posCount} position{portfolioStats.posCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 10 }}>
                      {[{ label: 'CARDS', value: portfolioStats.posCount }, { label: 'SOLD', value: portfolioStats.soldCount }, { label: 'GRADED', value: portfolioStats.gradedCount }].map((s, i) => (
                        <div key={i} style={{ textAlign: 'center', padding: '13px 8px', background: 'var(--bg)', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
                          <div className="font-num" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {plAmt != null && (
                      <div style={{ display: 'grid', gridTemplateColumns: plPct != null ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 10 }}>
                        <div style={{ borderRadius: 10, padding: '11px 13px', background: plAmt >= 0 ? 'rgba(61,232,138,0.06)' : 'rgba(232,82,74,0.06)', border: `1px solid ${plAmt >= 0 ? 'rgba(61,232,138,0.2)' : 'rgba(232,82,74,0.2)'}` }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 5 }}>TOTAL P&L</div>
                          <div className="font-num" style={{ fontSize: 16, fontWeight: 800, color: plAmt >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {plAmt >= 0 ? '+' : ''}{fmtCurrency(Math.abs(plAmt))}
                          </div>
                        </div>
                        {plPct != null && (
                          <div style={{ borderRadius: 10, padding: '11px 13px', background: plPct >= 0 ? 'rgba(61,232,138,0.06)' : 'rgba(232,82,74,0.06)', border: `1px solid ${plPct >= 0 ? 'rgba(61,232,138,0.2)' : 'rgba(232,82,74,0.2)'}` }}>
                            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)', marginBottom: 5 }}>RETURN</div>
                            <div className="font-num" style={{ fontSize: 16, fontWeight: 800, color: plPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                              {plPct >= 0 ? '+' : ''}{plPct.toFixed(1)}%
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {winRate != null && (
                      <div style={{ borderRadius: 10, padding: '11px 13px', background: 'var(--bg)', border: '1px solid var(--border)', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--ink3)' }}>WIN RATE</span>
                          <span className="font-num" style={{ fontSize: 10, color: 'var(--ink3)' }}>{portfolioStats.winTrades}W · {portfolioStats.loseTrades}L</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="font-num" style={{ fontSize: 20, fontWeight: 800, color: winRate >= 50 ? 'var(--green)' : 'var(--red)', minWidth: 46 }}>{winRate.toFixed(0)}%</div>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${winRate}%`, background: winRate >= 50 ? 'var(--green)' : 'var(--red)', borderRadius: 2 }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <Link href="/portfolio" style={{ display: 'block', textAlign: 'center', padding: '10px', borderRadius: 10, background: 'var(--gold)', color: '#08080f', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                      View Portfolio
                    </Link>
                  </div>
                )
              })()}

            </div>{/* end right */}
          </div>{/* end dash-grid */}

        </div>
      </main>

      <style>{`
        @keyframes ptr-spin { to { transform: rotate(360deg); } }
        .dash-wrap { max-width: 1100px; margin: 0 auto; padding: 28px 28px 0; }
        .dash-hero-section { margin-bottom: 28px; }
        .dash-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; align-items: start; }
        .dash-left, .dash-right { display: flex; flex-direction: column; gap: 12px; }
        .dash-card { border-radius: 16px; background: var(--surface); border: 1px solid var(--border); padding: 16px 18px; }
        .rv-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        @media (max-width: 700px) {
          .dash-wrap { padding: 16px 16px 0; }
          .dash-hero-section { margin-bottom: 20px; }
          .dash-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  )
}
