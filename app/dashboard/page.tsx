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
  id: string; card_id: string; card_name: string; set_name: string; grade: string
  price?: number | null; avg7d?: number | null
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

// ── Chart helpers ──────────────────────────────────────────────────────────────

function parseMonthKey(m: string): number { return new Date(m).getTime() }

function buildPortfolioHistory(
  positions: ChartPosition[],
  windowDays: number,
): { label: string; value: number }[] {
  const posWithHistory = positions.filter(p => p.price_history?.length)

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

    // Watchlist with prices + avg7d for rising/falling
    const wlList = (wlRows ?? []) as WatchlistItem[]
    if (wlList.length > 0) {
      const { data: priceRows } = await supabase.from('search_cache').select('cache_key, price, avg7d').in('cache_key', wlList.map(w => `${w.card_id}:${w.grade}`))
      const pm = new Map((priceRows ?? []).map(r => [r.cache_key, r]))
      setWatchlistItems(wlList.map(w => {
        const cached = pm.get(`${w.card_id}:${w.grade}`)
        return { ...w, price: cached?.price ?? null, avg7d: cached?.avg7d ?? null }
      }))
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

    fetch('/api/market')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || d.empty) return
        setMarketSnap({
          topRising: (d.topRising ?? []).slice(0, 5),
          topFalling: (d.topFalling ?? []).slice(0, 5),
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
  const lineColor = chartUp ? '#3ddc84' : '#ff5c5c'

  // 7D / 30D portfolio change from avg data
  const change7d = chartPositions.length > 0 ? chartPositions.reduce((s, p) => {
    const old = p.avg7d ?? p.price
    return s + (p.price - old) * p.quantity
  }, 0) : null
  const change30d = chartPositions.length > 0 ? chartPositions.reduce((s, p) => {
    const old = p.avg30d ?? p.avg7d ?? p.price
    return s + (p.price - old) * p.quantity
  }, 0) : null

  // Win rate
  const totalTrades = (portfolioStats?.winTrades ?? 0) + (portfolioStats?.loseTrades ?? 0)
  const winRate = totalTrades > 0 ? ((portfolioStats!.winTrades / totalTrades) * 100) : null

  // Watchlist movers
  const wlRising = watchlistItems.filter(w => w.price != null && w.avg7d != null && w.price > w.avg7d).length
  const wlFalling = watchlistItems.filter(w => w.price != null && w.avg7d != null && w.price < w.avg7d).length

  const best = marketSnap?.topRising[0] ?? null
  const worst = marketSnap?.topFalling[0] ?? null

  const CardRow = ({ card, idx, last }: { card: MarketCard; idx: number; last: boolean }) => {
    const params = new URLSearchParams({ name: card.card_name, grade: card.grade })
    return (
      <Link href={`/card/${card.card_id}?${params}`} className="list-row" style={{ borderBottom: last ? 'none' : undefined }}>
        <div className="thumb" style={{ background: card.image_url ? 'var(--panel-2)' : GRADIENTS[idx % GRADIENTS.length] }}>
          {card.image_url && <img src={tcgImg(card.image_url)} alt={card.card_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div className="row-info">
          <div className="row-name">{card.card_name}</div>
          <div className="row-sub">{card.grade}</div>
        </div>
        <div className="row-price">
          <div className="amt">{card.price != null ? fmtCurrency(card.price) : '—'}</div>
          {card.change != null && (
            <div className={`chg ${card.change >= 0 ? 'up' : 'down'}`}>
              {card.change >= 0 ? '▲' : '▼'} {Math.abs(card.change).toFixed(1)}%
            </div>
          )}
        </div>
      </Link>
    )
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 88, paddingBottom: 60, minHeight: '100vh' }}>

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

          {/* ── Topbar: value + portfolio link ── */}
          <div className="topbar">
            <div className="value-block">
              <div className="value-label">Total Portfolio Value</div>
              <div className="value-amount font-num">
                {pfValue != null && pfValue > 0 ? fmtCurrency(pfValue) : '—'}
              </div>
              {pfPnL != null && pfPct != null && (
                <div className={`value-change font-num ${pfPnL >= 0 ? 'up' : 'down'}`}>
                  {pfPnL >= 0 ? '▲' : '▼'} {fmtCurrency(Math.abs(pfPnL))} ({pfPnL >= 0 ? '+' : ''}{pfPct.toFixed(1)}%)
                </div>
              )}
            </div>
            <Link href="/portfolio" className="bell" title="View Portfolio">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M8 1v1M8 14v1M3 8H1M15 8h-1M4.5 4.5 3.4 3.4M12.6 12.6l-1.1-1.1M4.5 11.5l-1.1 1.1M12.6 3.4l-1.1 1.1" />
                <circle cx="8" cy="8" r="3" />
              </svg>
            </Link>
          </div>

          {/* ── Period tabs ── */}
          <div className="timeframes">
            {PERIOD_TABS.map(p => (
              <button key={p} onClick={() => setActivePeriod(p)} className={`tf${activePeriod === p ? ' active' : ''}`}>
                {p}
              </button>
            ))}
          </div>

          {/* ── Chart card ── */}
          <div className="chart-card">
            {chartData.length >= 2 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
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
                      strokeWidth={2.5}
                      fill="url(#chartFill)"
                      dot={false}
                      activeDot={{ r: 4, fill: lineColor, stroke: 'var(--bg)', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="chart-dates">
                  <span>{chartData[0]?.label}</span>
                  <span>Today</span>
                </div>
              </>
            ) : (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Not enough data for this period</div>
              </div>
            )}
          </div>

          {/* ── Cards grid ── */}
          <div className="dash-grid">

            {/* Portfolio Health */}
            {portfolioStats && portfolioStats.posCount > 0 && (
              <div className="card health-card">
                <div className="card-header">
                  <div className="card-title">Portfolio Health</div>
                  <div className="health-positions">{portfolioStats.posCount} position{portfolioStats.posCount !== 1 ? 's' : ''}</div>
                </div>

                <div className="health-counts">
                  {[
                    { label: 'CARDS', value: portfolioStats.posCount, gold: false },
                    { label: 'SOLD', value: portfolioStats.soldCount, gold: false },
                    { label: 'GRADED', value: portfolioStats.gradedCount, gold: true },
                  ].map((s, i) => (
                    <div key={i} className="hc">
                      <div className={`num${s.gold ? ' gold' : ''}`}>{s.value}</div>
                      <div className="lbl">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="health-grid">
                  {pfPnL != null && (
                    <div className="health-tile pnl">
                      <div>
                        <div className="t-lbl">Total P&L</div>
                        <div className="t-val font-num" style={{ color: pfPnL >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {pfPnL >= 0 ? '+' : ''}{fmtCurrency(Math.abs(pfPnL))}
                        </div>
                      </div>
                      {pfPct != null && (
                        <div style={{ textAlign: 'right' }}>
                          <div className="t-lbl">Return</div>
                          <div className="t-val font-num" style={{ color: pfPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {pfPct >= 0 ? '+' : ''}{pfPct.toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {winRate != null && (
                    <div className="health-tile">
                      <div className="t-lbl">Win Rate</div>
                      <div className="t-val font-num" style={{ color: winRate >= 50 ? 'var(--green)' : 'var(--red)' }}>{winRate.toFixed(0)}%</div>
                      <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{portfolioStats.winTrades}W · {portfolioStats.loseTrades}L</div>
                      <div className="winrate-bar">
                        <div className="w" style={{ width: `${winRate}%` }} />
                        <div className="l" style={{ width: `${100 - winRate}%` }} />
                      </div>
                    </div>
                  )}

                  {change7d != null && (
                    <div className="health-tile chg-strip">
                      <div className="t-lbl">7D Change</div>
                      <div className="t-val font-num" style={{ color: change7d >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {change7d >= 0 ? '+' : ''}{fmtCurrency(Math.abs(change7d))}
                      </div>
                    </div>
                  )}

                  {change30d != null && (
                    <div className="health-tile chg-strip">
                      <div className="t-lbl">30D Change</div>
                      <div className="t-val font-num" style={{ color: change30d >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {change30d >= 0 ? '+' : ''}{fmtCurrency(Math.abs(change30d))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Best / Worst subsection */}
                {(best || worst) && (
                  <div className="health-bw">
                    <div className="health-bw-title">Best / Worst</div>
                    <div className="bw-grid">
                      {best && (
                        <Link href={`/card/${best.card_id}?${new URLSearchParams({ name: best.card_name, grade: best.grade })}`} className="bw-row" style={{ textDecoration: 'none' }}>
                          <div className="bw-bar best" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="bw-label">BEST</div>
                            <div className="bw-name">{best.card_name}</div>
                          </div>
                          <div className="bw-pct" style={{ color: 'var(--green)' }}>▲ {best.change != null ? `${Math.abs(best.change).toFixed(1)}%` : '—'}</div>
                        </Link>
                      )}
                      {worst && (
                        <Link href={`/card/${worst.card_id}?${new URLSearchParams({ name: worst.card_name, grade: worst.grade })}`} className="bw-row" style={{ textDecoration: 'none' }}>
                          <div className="bw-bar worst" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="bw-label">WORST</div>
                            <div className="bw-name">{worst.card_name}</div>
                          </div>
                          <div className="bw-pct" style={{ color: 'var(--red)' }}>▼ {worst.change != null ? `${Math.abs(worst.change).toFixed(1)}%` : '—'}</div>
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                <Link href="/portfolio" className="view-portfolio-btn">View Portfolio →</Link>
              </div>
            )}

            {/* Top Performers */}
            {marketSnap && (marketSnap.topRising.length > 0 || marketSnap.topFalling.length > 0) && (
              <div className="card performers-card">
                <div className="card-header">
                  <div className="card-title">Top Performers</div>
                  <Link href="/market" className="link">See all →</Link>
                </div>
                <div className="perf-cols">
                  {marketSnap.topRising.length > 0 && (
                    <div>
                      <div className="perf-col-title gain"><span className="sq gain" />GAINERS</div>
                      <div className="card-list">
                        {marketSnap.topRising.map((card, i) => (
                          <CardRow key={card.card_id + 'g' + i} card={card} idx={i} last={i === marketSnap.topRising.length - 1} />
                        ))}
                      </div>
                    </div>
                  )}
                  {marketSnap.topFalling.length > 0 && (
                    <div>
                      <div className="perf-col-title loss"><span className="sq loss" />LOSERS</div>
                      <div className="card-list">
                        {marketSnap.topFalling.map((card, i) => (
                          <CardRow key={card.card_id + 'l' + i} card={card} idx={i + 10} last={i === marketSnap.topFalling.length - 1} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Watchlist Snapshot */}
            {watchlistItems.length > 0 && (
              <div className="card watchlist-card">
                <div className="card-header">
                  <div className="card-title">Watchlist Snapshot</div>
                  <Link href="/watchlist" className="link">View watchlist →</Link>
                </div>
                <div className="watchlist-body">
                  {(wlRising > 0 || wlFalling > 0) && (
                    <div className="watchlist-movers">
                      <div className="movers-stat-v">
                        <div className="dot-circle up">↑</div>
                        <div className="movers-num up">{wlRising}</div>
                        <div className="movers-sub">RISING</div>
                      </div>
                      <div className="movers-stat-v">
                        <div className="dot-circle down">↓</div>
                        <div className="movers-num down">{wlFalling}</div>
                        <div className="movers-sub">FALLING</div>
                      </div>
                    </div>
                  )}
                  <div className="card-list watchlist-list">
                    {watchlistItems.map((item, i) => {
                      const params = new URLSearchParams({ name: item.card_name, grade: item.grade })
                      const isUp = item.price != null && item.avg7d != null && item.price > item.avg7d
                      const isDown = item.price != null && item.avg7d != null && item.price < item.avg7d
                      return (
                        <Link key={item.id} href={`/card/${item.card_id}?${params}`} className="list-row" style={{ borderBottom: i < watchlistItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div className="thumb" style={{ background: GRADIENTS[i % GRADIENTS.length] }} />
                          <div className="row-info">
                            <div className="row-name">{item.card_name}</div>
                            <div className="row-sub">{item.set_name} · <span style={{ color: 'var(--gold-dim)' }}>{item.grade}</span></div>
                          </div>
                          <div className="row-price">
                            {item.price != null && <div className="amt font-num">{fmtCurrency(item.price)}</div>}
                            {(isUp || isDown) && (
                              <div className={`chg ${isUp ? 'up' : 'down'}`}>{isUp ? '▲' : '▼'}</div>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Recently Viewed */}
            {recentlyViewed.length > 0 && (
              <div className="card recent-card">
                <div className="card-header">
                  <div className="card-title">Recently Viewed</div>
                  <button onClick={clearRecentlyViewed} className="link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
                </div>
                <div className="recent-grid">
                  {recentlyViewed.slice(0, 6).map((item, i) => {
                    const params = new URLSearchParams({ grade: item.grade, name: item.card_name })
                    if (item.set_name) params.set('set', item.set_name)
                    return (
                      <Link key={`${item.card_id}-${i}`} href={`/card/${item.card_id}?${params}`} className="recent-item">
                        <div className="recent-thumb" style={{ background: item.image_url ? 'var(--panel-2)' : 'linear-gradient(135deg,#2a2a30,#1a1a1e)' }}>
                          {item.image_url && <img src={tcgImg(item.image_url)} alt={item.card_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                        <div className="recent-name">{item.card_name}</div>
                        <div className="recent-sub">{item.grade}</div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

          </div>{/* end dash-grid */}
        </div>{/* end dash-wrap */}
      </main>

      <style>{`
        @keyframes ptr-spin { to { transform: rotate(360deg); } }

        .dash-wrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px 40px 60px;
        }

        /* Topbar */
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        .value-label {
          font-size: 12px;
          letter-spacing: 1.5px;
          color: var(--ink3);
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .value-amount {
          font-size: 48px;
          font-weight: 800;
          letter-spacing: -2px;
          color: var(--ink);
          line-height: 1;
          margin-bottom: 8px;
        }
        .value-change { font-size: 16px; font-weight: 600; }
        .value-change.up { color: var(--green); }
        .value-change.down { color: var(--red); }
        .bell {
          width: 38px; height: 38px;
          border-radius: 10px;
          background: var(--surface);
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--ink3);
          flex-shrink: 0;
          margin-top: 4px;
          text-decoration: none;
          transition: border-color 0.15s;
        }
        .bell:hover { border-color: var(--gold); color: var(--gold); }

        /* Period tabs */
        .timeframes { display: flex; gap: 8px; margin: 0 0 16px; }
        .tf {
          padding: 7px 16px;
          border-radius: 20px;
          font-size: 13px; font-weight: 600;
          color: var(--ink3);
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }
        .tf.active {
          color: var(--gold);
          border-color: var(--gold);
          background: rgba(244,197,66,0.08);
        }
        .tf:hover:not(.active) { background: var(--surface); }

        /* Chart card */
        .chart-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 20px 24px 14px;
          margin-bottom: 28px;
        }
        .chart-dates {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--ink3);
          margin-top: 8px;
        }

        /* Grid — single column */
        .dash-grid { display: flex; flex-direction: column; gap: 20px; }

        /* Base card */
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 20px 22px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .card-title {
          font-size: 12px;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--ink3);
          font-weight: 700;
        }
        .link { font-size: 13px; color: var(--gold); font-weight: 600; text-decoration: none; cursor: pointer; }
        .link:hover { opacity: 0.8; }

        /* List rows */
        .card-list { display: flex; flex-direction: column; }
        .list-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 0;
          border-top: 1px solid var(--border);
          text-decoration: none;
        }
        .list-row:first-child { border-top: none; padding-top: 4px; }
        .thumb {
          width: 38px; height: 52px;
          border-radius: 5px;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid var(--border);
          overflow: hidden;
        }
        .row-info { flex: 1; min-width: 0; }
        .row-name { font-size: 13.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .row-sub { font-size: 11.5px; color: var(--ink3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
        .row-price { text-align: right; flex-shrink: 0; }
        .row-price .amt { font-size: 14px; font-weight: 700; color: var(--ink); }
        .chg { font-size: 11.5px; font-weight: 600; margin-top: 2px; }
        .chg.up { color: var(--green); }
        .chg.down { color: var(--red); }

        /* Portfolio Health */
        .health-card {}
        .health-positions {
          font-size: 11.5px; font-weight: 600;
          color: var(--ink3);
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 5px 12px;
        }
        .health-counts {
          display: flex;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          margin-bottom: 16px;
          overflow: hidden;
        }
        .hc { text-align: center; flex: 1; padding: 14px 8px; border-right: 1px solid var(--border); }
        .hc:last-child { border-right: none; }
        .hc .num { font-size: 24px; font-weight: 800; color: var(--ink); }
        .hc .num.gold { color: var(--gold); }
        .hc .lbl { font-size: 10.5px; color: var(--ink3); letter-spacing: .8px; margin-top: 3px; text-transform: uppercase; }

        .health-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 0; }
        .health-tile {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 13px 16px;
        }
        .health-tile.pnl {
          grid-column: span 2;
          background: rgba(61,220,132,0.06);
          border-color: rgba(61,220,132,0.2);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .health-tile.chg-strip {
          grid-column: span 3;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 11px 16px;
        }
        .health-tile .t-lbl { font-size: 10.5px; color: var(--ink3); letter-spacing: .8px; text-transform: uppercase; margin-bottom: 6px; }
        .health-tile.chg-strip .t-lbl { margin-bottom: 0; }
        .health-tile .t-val { font-size: 20px; font-weight: 800; }
        .winrate-bar { width: 100%; height: 5px; border-radius: 3px; background: var(--border); margin-top: 8px; overflow: hidden; display: flex; }
        .winrate-bar .w { background: var(--green); height: 100%; }
        .winrate-bar .l { background: var(--red); height: 100%; }

        /* Best/Worst */
        .health-bw { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); }
        .health-bw-title { font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink3); font-weight: 700; margin-bottom: 10px; }
        .bw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .bw-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          text-decoration: none;
          transition: border-color 0.15s;
        }
        .bw-row:hover { border-color: var(--gold); }
        .bw-bar { width: 3px; height: 34px; border-radius: 2px; flex-shrink: 0; }
        .bw-bar.best { background: var(--green); }
        .bw-bar.worst { background: var(--red); }
        .bw-label { font-size: 10.5px; letter-spacing: 1px; color: var(--ink3); font-weight: 700; }
        .bw-name { font-size: 13px; font-weight: 600; color: var(--ink); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bw-pct { margin-left: auto; font-size: 15px; font-weight: 700; flex-shrink: 0; }

        .view-portfolio-btn {
          display: block;
          text-align: center;
          margin-top: 16px;
          padding: 10px;
          border-radius: 10px;
          background: var(--gold);
          color: #08080f;
          font-weight: 700;
          font-size: 13px;
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .view-portfolio-btn:hover { opacity: 0.88; }

        /* Top Performers */
        .performers-card {}
        .perf-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
        .perf-cols > div { padding-right: 18px; }
        .perf-cols > div + div { padding-left: 18px; padding-right: 0; border-left: 1px solid var(--border); }
        .perf-col-title { font-size: 11px; letter-spacing: 1px; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
        .perf-col-title.gain { color: var(--green); }
        .perf-col-title.loss { color: var(--red); }
        .sq { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .sq.gain { background: var(--green); }
        .sq.loss { background: var(--red); }
        .performers-card .thumb { width: 32px; height: 44px; }

        /* Watchlist */
        .watchlist-card {}
        .watchlist-body { display: flex; gap: 20px; }
        .watchlist-movers {
          flex: 0 0 88px;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border);
          padding-right: 20px;
        }
        .watchlist-list { flex: 1; min-width: 0; }
        .movers-stat-v {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 14px 0;
        }
        .movers-stat-v + .movers-stat-v { border-top: 1px solid var(--border); }
        .dot-circle {
          width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
        }
        .dot-circle.up { background: rgba(61,220,132,0.12); color: var(--green); }
        .dot-circle.down { background: rgba(255,92,92,0.12); color: var(--red); }
        .movers-num { font-size: 26px; font-weight: 800; }
        .movers-num.up { color: var(--green); }
        .movers-num.down { color: var(--red); }
        .movers-sub { font-size: 10px; letter-spacing: 1px; color: var(--ink3); font-weight: 700; }
        .gold-dim { color: var(--gold-dim, #c9a53a); }

        /* Recently Viewed */
        .recent-card {}
        .recent-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 16px;
        }
        .recent-item { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; text-decoration: none; }
        .recent-thumb {
          width: 100%;
          aspect-ratio: 5/7;
          border-radius: 10px;
          border: 1px solid var(--border);
          overflow: hidden;
        }
        .recent-name { font-size: 13px; font-weight: 600; color: var(--ink); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
        .recent-sub { font-size: 11px; color: var(--ink3); }

        @media (max-width: 860px) {
          .dash-wrap { padding: 20px 20px 48px; }
          .value-amount { font-size: 36px; }
          .health-grid { grid-template-columns: repeat(2, 1fr); }
          .health-tile.pnl { grid-column: span 2; }
          .health-tile.chg-strip { grid-column: span 1; }
          .bw-grid { grid-template-columns: 1fr; }
          .perf-cols { grid-template-columns: 1fr; gap: 20px; }
          .perf-cols > div + div { padding-left: 0; border-left: none; border-top: 1px solid var(--border); padding-top: 16px; }
        }
        @media (max-width: 600px) {
          .dash-wrap { padding: 16px 16px 48px; }
          .value-amount { font-size: 30px; letter-spacing: -1px; }
          .timeframes { gap: 4px; }
          .tf { padding: 6px 10px; font-size: 12px; }
          .health-grid { grid-template-columns: 1fr 1fr; }
          .watchlist-movers { flex: 0 0 72px; }
          .recent-grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
        }
      `}</style>
    </>
  )
}
