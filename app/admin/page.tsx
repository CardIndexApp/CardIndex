'use client'
import { useState, useEffect, useCallback, useRef, TouchEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { tcgImg } from '@/lib/img'
import ShareTopSearchedModal, { type TopSearchedCard } from '@/components/ShareTopSearchedModal'
import ShareEndCardModal from '@/components/ShareEndCardModal'
import ShareBrandModal from '@/components/ShareBrandModal'
import ShareStatModal, { type StatCardConfig } from '@/components/ShareStatModal'
import { useCurrency, CURRENCIES } from '@/lib/currency'

type Tier = 'free' | 'pro'

interface UserRow {
  id: string
  email: string
  username: string | null
  tier: Tier
  subscription_status: string | null
  stripe_customer_id: string | null
  created_at: string
  last_sign_in_at: string | null
  last_active_at: string | null
  trial_ends_at: string | null
  is_admin: boolean
  search_count: number
}

/** Whole days remaining in a trial, or null if none/expired. */
function trialDaysLeft(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return null
  return Math.ceil(ms / 86400000)
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60)        return 'Just now'
  if (secs < 3600)      return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400)     return `${Math.floor(secs / 3600)}h ago`
  if (secs < 86400 * 7) return `${Math.floor(secs / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface UpgradeRequest {
  id: string
  user_id: string
  requested_tier: string
  requested_at: string
  actioned_at: string | null
  action: string | null
  user_email?: string
}

interface PortfolioStats {
  totalCostBasis: number
  totalMarketValue: number
  totalPositions: number
  pricedPositions: number
  usersWithPortfolio: number
  avgCardsPerPortfolio: number
  avgPortfolioValue: number
}

interface GrowthStats {
  newThisWeek: number
  newThisMonth: number
  recentlyActive7d: number
  recentlyActive30d: number
  conversionRate: number
}

interface UsageStats {
  totalSearches: number
  cachedCards: number
  staleCacheCount: number
  openReports: number
  topTrackedCards: { card_id: string; card_name: string; count: number }[]
  apiCalls?: { total: number; yesterday: number }
  userSearches?: { total: number; yesterday: number }
}

interface Constituent {
  id: string
  card_id: string
  grade: string
  card_name: string
  set_name: string | null
  image_url: string | null
  added_at: string
  price: number | null
  price_change_pct: number | null
  last_fetched: string | null
}

interface TcgCard {
  id: string
  name: string
  set: { name: string; id: string }
  number: string
  images: { small: string; large: string }
  rarity?: string
}

type AdminTab = 'users' | 'market' | 'content' | 'banners'

interface TopSearchedResponse {
  cards:   TopSearchedCard[]
  weekNum: number
  year:    number
  dateStr: string
}

const TIER_COLORS: Record<string, string> = {
  free: 'var(--ink3)',
  standard: 'var(--gold)',
  pro: 'var(--gold)',
}

const S = {
  card: { borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border2)', marginBottom: 16, overflow: 'hidden' } as React.CSSProperties,
  head: { padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  body: { padding: 22 } as React.CSSProperties,
  pill: (tier: string) => ({
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
    padding: '2px 9px',
    borderRadius: 99,
    color: (tier === 'pro' || tier === 'standard') ? 'var(--gold)' : 'var(--ink3)',
    background: (tier === 'pro' || tier === 'standard') ? 'rgba(232,197,71,0.1)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${(tier === 'pro' || tier === 'standard') ? 'rgba(232,197,71,0.3)' : 'rgba(255,255,255,0.12)'}`,
  } as React.CSSProperties),
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const { fmtCurrency, rates, currency } = useCurrency()

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null)
  const [growthStats, setGrowthStats] = useState<GrowthStats | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // ── Market Index tab ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const [constituents, setConstituents] = useState<Constituent[]>([])
  const [constitLoading, setConstitLoading] = useState(false)
  const [cardSearch, setCardSearch] = useState('')
  const [cardResults, setCardResults] = useState<TcgCard[]>([])
  const [cardSearching, setCardSearching] = useState(false)
  const [addingGrade, setAddingGrade] = useState<Record<string, string>>({})
  const [addingId, setAddingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState<{ done: number; total: number } | null>(null)
  const [refreshDelay, setRefreshDelay] = useState(500) // ms between card fetches
  const [seeding, setSeeding] = useState(false)
  const [migrationSql, setMigrationSql] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Content tab ───────────────────────────────────────────────────────────
  function verdictStyle(verdict: string) {
    const v = verdict.toLowerCase()
    const color  = v === 'buy' ? '#3de88a' : v === 'accumulate' ? '#3de88a' : v === 'hold' ? '#e8c547' : '#e8524a'
    const bg     = v === 'buy' ? 'rgba(61,232,138,0.15)' : v === 'accumulate' ? 'rgba(61,232,138,0.08)' : v === 'hold' ? 'rgba(232,197,71,0.15)' : 'rgba(232,82,74,0.15)'
    const border = v === 'buy' ? 'rgba(61,232,138,0.45)' : v === 'accumulate' ? 'rgba(61,232,138,0.25)' : v === 'hold' ? 'rgba(232,197,71,0.45)' : 'rgba(232,82,74,0.45)'
    return { color, bg, border }
  }

  function downloadVerdictPill(verdict: string) {
    const { color, bg, border } = verdictStyle(verdict)

    const SCALE = 4          // 4× for a crisp high-res export
    const FONT  = 36         // logical px
    const PX    = 64         // horizontal padding
    const PY    = 32         // vertical padding
    const R     = 999        // fully-pill radius

    // Measure text at logical size then scale canvas
    const tmp = document.createElement('canvas')
    const tmpCtx = tmp.getContext('2d')!
    tmpCtx.font = `800 ${FONT}px "Helvetica Neue", Helvetica, Arial, sans-serif`
    const textW = tmpCtx.measureText(verdict.toUpperCase()).width

    const W = Math.ceil(textW + PX * 2)
    const H = FONT + PY * 2

    const canvas = document.createElement('canvas')
    canvas.width  = W * SCALE
    canvas.height = H * SCALE
    const ctx = canvas.getContext('2d')!
    ctx.scale(SCALE, SCALE)

    // Semi-transparent fill
    ctx.beginPath()
    ctx.roundRect(0, 0, W, H, R)
    ctx.fillStyle = bg
    ctx.fill()

    // Border
    ctx.beginPath()
    ctx.roundRect(1.5, 1.5, W - 3, H - 3, R)
    ctx.strokeStyle = border
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Text
    ctx.font = `800 ${FONT}px "Helvetica Neue", Helvetica, Arial, sans-serif`
    ctx.fillStyle = color
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(verdict.toUpperCase(), W / 2, H / 2)

    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png', 1.0)
    a.download = `verdict-${verdict.toLowerCase()}.png`
    a.click()
  }

  const [scoreCircleVal, setScoreCircleVal] = useState(80)
  const [radarVals, setRadarVals] = useState({ trend: 80, liquidity: 100, consistency: 92, value: 60 })

  function barColor(v: number) { return v >= 70 ? '#3de88a' : v >= 50 ? '#e8c547' : '#e8524a' }

  function downloadRadarGraph() {
    const { trend, liquidity, consistency, value } = radarVals
    const SCALE = 4
    const W = 400, H = 380
    const cx = 200, cy = 185, r = 120

    const canvas = document.createElement('canvas')
    canvas.width = W * SCALE; canvas.height = H * SCALE
    const ctx = canvas.getContext('2d')!
    ctx.scale(SCALE, SCALE)

    function diamond(pct: number): [number, number][] {
      const gr = r * pct
      return [[cx, cy - gr], [cx + gr, cy], [cx, cy + gr], [cx - gr, cy]]
    }
    function drawPoly(pts: [number, number][], fill: string, stroke: string, lw: number) {
      ctx.beginPath(); pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)); ctx.closePath()
      ctx.fillStyle = fill; ctx.fill()
      ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke()
    }

    // Grid rings
    for (const pct of [0.25, 0.5, 0.75, 1]) {
      drawPoly(diamond(pct), 'transparent', pct === 1 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.07)', 1)
    }
    // Axis lines
    const axisStroke = 'rgba(255,255,255,0.10)'
    ctx.strokeStyle = axisStroke; ctx.lineWidth = 1
    ;[[cx, cy, cx, cy - r], [cx, cy, cx + r, cy], [cx, cy, cx, cy + r], [cx, cy, cx - r, cy]].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    })

    // Data polygon
    const tY = cy - r * trend / 100, lX = cx + r * liquidity / 100
    const csY = cy + r * consistency / 100, vX = cx - r * value / 100
    drawPoly([[cx, tY], [lX, cy], [cx, csY], [vX, cy]], 'rgba(215,170,60,0.15)', '#d7aa3c', 2)

    // Dots
    for (const [x, y] of [[cx, tY], [lX, cy], [cx, csY], [vX, cy]] as [number, number][]) {
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#d7aa3c'; ctx.fill()
    }

    // Labels
    ctx.font = '600 16px "Helvetica Neue", Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.50)'
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'center';  ctx.fillText('Trend',       cx,       cy - r - 16)
    ctx.textAlign = 'start';   ctx.fillText('Liquidity',   cx + r + 12, cy + 6)
    ctx.textAlign = 'center';  ctx.fillText('Consistency', cx,       cy + r + 22)
    ctx.textAlign = 'end';     ctx.fillText('Value',       cx - r - 12, cy + 6)

    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png', 1.0); a.download = 'radar-graph.png'; a.click()
  }

  function downloadScoreBars() {
    const entries = [
      { label: 'TREND',       val: radarVals.trend },
      { label: 'LIQUIDITY',   val: radarVals.liquidity },
      { label: 'CONSISTENCY', val: radarVals.consistency },
      { label: 'VALUE',       val: radarVals.value },
    ]
    const SCALE = 4
    const W = 900, ROW_H = 44, GAP = 12, PAD_Y = 10
    const H = PAD_Y * 2 + entries.length * ROW_H + (entries.length - 1) * GAP
    const LABEL_W = 180, VAL_W = 50, BAR_X = LABEL_W + 20, BAR_W = W - LABEL_W - VAL_W - 40

    const canvas = document.createElement('canvas')
    canvas.width = W * SCALE; canvas.height = H * SCALE
    const ctx = canvas.getContext('2d')!
    ctx.scale(SCALE, SCALE)

    entries.forEach(({ label, val }, i) => {
      const y = PAD_Y + i * (ROW_H + GAP)
      const midY = y + ROW_H / 2
      const col = barColor(val)

      // Label
      ctx.font = '700 14px "Helvetica Neue", Helvetica, Arial, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(label, 0, midY)

      // Track
      ctx.beginPath(); ctx.roundRect(BAR_X, midY - 4, BAR_W, 8, 4)
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill()

      // Fill
      if (val > 0) {
        ctx.beginPath(); ctx.roundRect(BAR_X, midY - 4, BAR_W * val / 100, 8, 4)
        ctx.fillStyle = col; ctx.fill()
      }

      // Value
      ctx.font = '700 18px "Helvetica Neue", Helvetica, Arial, sans-serif'
      ctx.fillStyle = col; ctx.textAlign = 'right'
      ctx.fillText(String(val), W, midY)
    })

    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png', 1.0); a.download = 'score-bars.png'; a.click()
  }

  function downloadScoreCircle(score: number) {
    const color = score >= 80 ? '#3de88a' : score >= 60 ? '#e8c547' : '#e8524a'
    const label = score >= 80 ? 'STRONG'  : score >= 60 ? 'MODERATE' : 'WEAK'

    const SCALE = 4
    const SIZE  = 200   // logical diameter
    const CX    = SIZE / 2
    const CY    = SIZE / 2
    const R     = SIZE / 2 - 6  // radius with border inset

    const canvas = document.createElement('canvas')
    canvas.width  = SIZE * SCALE
    canvas.height = SIZE * SCALE
    const ctx = canvas.getContext('2d')!
    ctx.scale(SCALE, SCALE)

    // Circle border
    ctx.beginPath()
    ctx.arc(CX, CY, R, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 5
    ctx.stroke()

    // Score number
    ctx.font = `700 72px "Helvetica Neue", Helvetica, Arial, sans-serif`
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(String(Math.round(score)), CX, CY + 12)

    // Label
    ctx.font = `600 18px "Helvetica Neue", Helvetica, Arial, sans-serif`
    ctx.fillStyle = color
    ctx.globalAlpha = 0.6
    ctx.fillText(label, CX, CY + 36)
    ctx.globalAlpha = 1

    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png', 1.0)
    a.download = `score-${Math.round(score)}.png`
    a.click()
  }

  const [topSearched, setTopSearched] = useState<TopSearchedResponse | null>(null)
  const [topSearchedLoading, setTopSearchedLoading] = useState(false)
  const [showTopSearchedModal, setShowTopSearchedModal] = useState(false)
  const [showEndCardModal, setShowEndCardModal] = useState(false)
  const [showBrandModal, setShowBrandModal] = useState(false)
  const [activeStatModal, setActiveStatModal] = useState<StatCardConfig | null>(null)

  // ── Banners tab ───────────────────────────────────────────────────────────
  interface AppBanner { id: string; title: string; body: string; cta_label: string | null; cta_url: string | null; active: boolean; created_at: string }
  const [banners, setBanners]               = useState<AppBanner[]>([])
  const [bannersLoading, setBannersLoading] = useState(false)
  const [bannerForm, setBannerForm]         = useState({ title: '', body: '', cta_label: '', cta_url: '' })
  const [bannerSaving, setBannerSaving]     = useState(false)

  async function loadBanners() {
    setBannersLoading(true)
    try {
      const r = await fetch('/api/admin/banners')
      if (r.ok) setBanners((await r.json()).banners ?? [])
    } finally { setBannersLoading(false) }
  }

  async function publishBanner() {
    if (!bannerForm.title.trim() || !bannerForm.body.trim()) return
    setBannerSaving(true)
    try {
      const r = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bannerForm),
      })
      if (!r.ok) { flash('err', (await r.json()).error ?? 'Failed'); return }
      flash('ok', 'Banner published')
      setBannerForm({ title: '', body: '', cta_label: '', cta_url: '' })
      loadBanners()
    } finally { setBannerSaving(false) }
  }

  async function toggleBanner(id: string, active: boolean) {
    const r = await fetch('/api/admin/banners', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active }),
    })
    if (r.ok) { loadBanners(); flash('ok', active ? 'Banner activated' : 'Banner deactivated') }
    else flash('err', 'Failed to update banner')
  }

  async function deleteBanner(id: string) {
    if (!confirm('Delete this banner?')) return
    const r = await fetch('/api/admin/banners', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (r.ok) { loadBanners(); flash('ok', 'Banner deleted') }
    else flash('err', 'Failed to delete banner')
  }

  // ── Pull-to-refresh ───────────────────────────────────────────────────────
  const PTR_THRESHOLD = 80 // px of pull needed to trigger
  const touchStartY   = useRef(0)
  const [pullY, setPullY]           = useState(0)   // current drag distance (capped)
  const [ptrState, setPtrState]     = useState<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle')

  function onTouchStart(e: TouchEvent<HTMLElement>) {
    if (window.scrollY === 0) touchStartY.current = e.touches[0].clientY
    else touchStartY.current = 0
  }

  function onTouchMove(e: TouchEvent<HTMLElement>) {
    if (!touchStartY.current) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta <= 0) { setPullY(0); setPtrState('idle'); return }
    // Cap visual travel at 120px
    const capped = Math.min(delta * 0.5, 120)
    setPullY(capped)
    setPtrState(capped >= PTR_THRESHOLD * 0.5 ? 'ready' : 'pulling')
  }

  async function onTouchEnd() {
    if (pullY >= PTR_THRESHOLD * 0.5) {
      setPtrState('refreshing')
      setPullY(0)
      touchStartY.current = 0
      await load()
      setPtrState('idle')
    } else {
      setPullY(0)
      setPtrState('idle')
      touchStartY.current = 0
    }
  }

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    // Verify admin via profile — fetch via API to use service role
    const res = await fetch('/api/admin/users')
    if (!res.ok) { router.replace('/dashboard'); return }
    const json = await res.json()
    setUsers(json.users ?? [])
    setRequests(json.requests ?? [])
    if (json.portfolioStats) setPortfolioStats(json.portfolioStats)
    if (json.growthStats)    setGrowthStats(json.growthStats)
    if (json.usageStats)     setUsageStats(json.usageStats)
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  async function setTier(userId: string, tier: Tier) {
    setSavingId(userId)
    try {
      const res = await fetch('/api/admin/set-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier } : u))
      flash('ok', 'Tier updated.')
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Error')
    } finally {
      setSavingId(null)
    }
  }

  async function actionRequest(requestId: string, action: 'approve' | 'deny') {
    setActingId(requestId)
    try {
      const res = await fetch('/api/admin/action-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, actioned_at: new Date().toISOString(), action } : r))
      flash('ok', `Request ${action}d.`)
      // Reload to reflect tier change
      load()
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Error')
    } finally {
      setActingId(null)
    }
  }

  // ── Market index helpers ──────────────────────────────────────────────────
  const constitLoadingRef = useRef(false)
  const loadConstituents = useCallback(async () => {
    if (constitLoadingRef.current) return
    constitLoadingRef.current = true
    setConstitLoading(true)
    try {
      const r = await fetch('/api/admin/market/constituents')
      if (r.ok) {
        const json = await r.json()
        setConstituents(json.constituents ?? [])
      }
    } finally {
      constitLoadingRef.current = false
      setConstitLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'market') loadConstituents()
  }, [activeTab, loadConstituents])

  useEffect(() => {
    if (activeTab !== 'content' || topSearched) return
    setTopSearchedLoading(true)
    fetch('/api/admin/content/top-searched')
      .then(r => r.json())
      .then(json => setTopSearched(json))
      .catch(() => {})
      .finally(() => setTopSearchedLoading(false))
  }, [activeTab, topSearched])

  useEffect(() => {
    if (activeTab === 'banners') loadBanners()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCardSearchInput(val: string) {
    setCardSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!val.trim()) { setCardResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setCardSearching(true)
      try {
        const r = await fetch(
          `https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(val.trim() + '*')}&pageSize=20&orderBy=-set.releaseDate`
        )
        const json = await r.json()
        setCardResults(json.data ?? [])
      } finally {
        setCardSearching(false)
      }
    }, 400)
  }

  async function addConstituent(card: TcgCard) {
    const grade = addingGrade[card.id] || 'PSA 10'
    setAddingId(card.id)
    try {
      const r = await fetch('/api/admin/market/constituents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: card.id,
          grade,
          card_name: card.name,
          set_name: card.set.name,
          image_url: card.images.small,
        }),
      })
      const json = await r.json()
      if (!r.ok) { flash('err', json.error ?? 'Error adding card'); return }
      flash('ok', `${card.name} (${grade}) added to index`)
      setCardResults([])
      setCardSearch('')
      loadConstituents()
    } finally {
      setAddingId(null)
    }
  }

  async function removeConstituent(id: string) {
    setRemovingId(id)
    try {
      const r = await fetch(`/api/admin/market/constituents?id=${id}`, { method: 'DELETE' })
      if (!r.ok) { flash('err', 'Failed to remove'); return }
      setConstituents(prev => prev.filter(c => c.id !== id))
    } finally {
      setRemovingId(null)
    }
  }

  async function seedIndex() {
    if (!confirm('This will upsert the CI-100 default card list into the database. Continue?')) return
    setSeeding(true)
    try {
      const r = await fetch('/api/admin/market/seed', { method: 'POST' })
      const json = await r.json()
      if (!r.ok) { flash('err', json.error ?? 'Seed failed'); return }
      flash('ok', `Seed complete — ${json.inserted} inserted, ${json.failed} failed${json.errors?.length ? ` (${json.errors[0]})` : ''}`)
      loadConstituents()
    } finally {
      setSeeding(false)
    }
  }

  async function runMigration() {
    if (!confirm('This will add any missing columns to the search_cache table. Safe to re-run. Continue?')) return
    try {
      const r = await fetch('/api/admin/market/migrate-cache', { method: 'POST' })
      const json = await r.json()
      if (json.sql) {
        // exec_sql not available — show the SQL in a visible panel so user can copy it
        setMigrationSql(json.sql)
        return
      }
      if (!r.ok) { flash('err', json.error ?? 'Migration failed'); return }
      flash('ok', 'Migration applied — DB columns are up to date')
    } catch {
      flash('err', 'Migration request failed')
    }
  }

  async function runRefresh(cards: Constituent[], label: string, delayMs = refreshDelay) {
    if (cards.length === 0) { flash('ok', `No cards to refresh`); return }
    setRefreshing(true)
    setRefreshProgress({ done: 0, total: cards.length })
    let ok = 0, failed = 0, cacheWarnings = 0
    let firstErrMsg = ''
    for (const c of cards) {
      try {
        const params = new URLSearchParams({ grade: c.grade, name: c.card_name, bust_cache: '1', all_tiers: '1' })
        if (c.set_name) params.set('set', c.set_name)
        const r = await fetch(`/api/card/${c.card_id}?${params.toString()}`)
        if (r.ok) {
          const body = await r.json().catch(() => ({}))
          if (body?.warning) {
            cacheWarnings++
            console.warn('[refresh] cache write warning:', c.card_name, body.warning)
          }
          ok++
        } else {
          failed++
          if (!firstErrMsg) {
            const body = await r.json().catch(() => ({}))
            firstErrMsg = `${c.card_name} (${c.card_id}) → ${r.status}: ${body?.error ?? 'unknown'}`
            console.error('[refresh] first failure:', firstErrMsg, body)
          }
        }
      } catch (e) {
        failed++
        if (!firstErrMsg) firstErrMsg = `${c.card_name}: network error`
        console.error(`[refresh] ${c.card_name} network error`, e)
      }
      setRefreshProgress({ done: ok + failed, total: cards.length })
      await new Promise(r => setTimeout(r, delayMs))
    }
    setRefreshing(false)
    setRefreshProgress(null)
    if (failed === 0 && cacheWarnings === 0) {
      flash('ok', `${label}: refreshed ${ok} cards`)
    } else if (failed === 0 && cacheWarnings > 0) {
      flash('err', `${ok} fetched, ${cacheWarnings} cache writes failed — click DB Migration to get the SQL to run in Supabase`)
    } else if (ok === 0) {
      flash('err', `All ${failed} failed. First: ${firstErrMsg}`)
    } else {
      flash('ok', `${ok} refreshed, ${failed} failed. First: ${firstErrMsg}`)
    }
    loadConstituents()
    // Bust the market API cache so the updated index is visible immediately
    fetch('/api/market?bust=1').catch(() => {})
  }

  async function refreshAllPrices() {
    const stale = constituents.filter(c => {
      if (!c.last_fetched) return true
      return Date.now() - new Date(c.last_fetched).getTime() > 6 * 60 * 60 * 1000
    })
    if (stale.length === 0) { flash('ok', 'All prices are fresh (< 6h old)'); return }
    await runRefresh(stale, 'Stale refresh')
  }

  async function forceRefreshAll() {
    if (!confirm(`Force re-fetch all ${constituents.length} cards from Poketrace? This will take ~${Math.ceil(constituents.length * 0.2 / 60)} min.`)) return
    await runRefresh(constituents, 'Force refresh')
  }

  const filteredUsers = users.filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.username ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const pendingRequests = requests.filter(r => !r.actioned_at)

  // ── Stat number formatter ─────────────────────────────────────────────────
  function fmtStat(n: number): string {
    if (n >= 1_000_000) {
      const v = n / 1_000_000
      return v < 10 ? `${parseFloat(v.toFixed(1))}M` : `${Math.round(v)}M`
    }
    if (n >= 1000) {
      const v = n / 1000
      return v < 10 ? `${parseFloat(v.toFixed(1))}K` : `${Math.round(v)}K`
    }
    return `${Math.round(n)}`
  }

  // Convert a price to the user's preferred currency.
  // nativeCurrency: the currency the price is stored in (e.g. 'AUD'). Assumed USD if null/undefined.
  function fmtPrice(amount: number, nativeCurrency?: string | null): string {
    if (nativeCurrency && nativeCurrency !== 'USD') {
      const usdEquiv = amount / (rates[nativeCurrency] ?? 1)
      return fmtCurrency(usdEquiv)
    }
    return fmtCurrency(amount)
  }

  const currencySymbol = CURRENCIES[currency]?.symbol ?? '$'

  const statCards: Array<{ title: string; desc: string; config: StatCardConfig }> = usageStats && portfolioStats ? [
    {
      title: 'Total Searches',
      desc: 'All-time card lookups across the platform',
      config: {
        statDisplay:  `${fmtStat(usageStats.totalSearches)}+`,
        label:        'Total Searches',
        sublabel:     `Pokémon TCG collectors and investors have run over ${fmtStat(usageStats.totalSearches)} card lookups on CardIndex.`,
        descriptor:   'Live data · Updated daily',
        accentColor:  '#d7aa3c',
        glowRgba:     'rgba(215,170,60,0.22)',
        filename:     'cardindex-stat-searches',
      },
    },
    {
      title: 'Market Value Tracked',
      desc: 'Total value across all user portfolios',
      config: {
        statDisplay:  `${currencySymbol}${fmtStat(portfolioStats.totalMarketValue * (rates[currency] ?? 1))}`,
        label:        'Market Value\nTracked',
        sublabel:     `CardIndex monitors over ${currencySymbol}${fmtStat(portfolioStats.totalMarketValue * (rates[currency] ?? 1))} in Pokémon TCG card value across active user portfolios.`,
        descriptor:   'Across all tracked portfolios',
        accentColor:  '#3cb87a',
        glowRgba:     'rgba(60,184,122,0.20)',
        filename:     'cardindex-stat-market-value',
        currency,
      },
    },
    {
      title: 'Cards Actively Tracked',
      desc: 'Unique card/grade combos in the price cache',
      config: {
        statDisplay:  fmtStat(usageStats.cachedCards),
        label:        'Cards Actively\nTracked',
        sublabel:     `Over ${fmtStat(usageStats.cachedCards)} individual Pokémon cards are being actively monitored for price movements right now.`,
        descriptor:   'Across Raw, PSA, CGC & BGS grades',
        accentColor:  '#6b8cff',
        glowRgba:     'rgba(107,140,255,0.20)',
        filename:     'cardindex-stat-cards-tracked',
      },
    },
  ] : []

  if (loading) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 88, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--ink3)' }}>Loading admin…</span>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main
        style={{ paddingTop: 88, paddingBottom: 88, minHeight: '100vh' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Pull-to-refresh indicator — starts hidden above viewport, slides in below navbar */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 49,
          display: 'flex', justifyContent: 'center',
          transform: `translateY(${ptrState === 'refreshing' ? 72 : pullY > 0 ? 56 + pullY - 8 : -50}px)`,
          transition: pullY === 0 ? 'transform 0.3s ease' : 'none',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--surface)', border: '1px solid var(--border2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            {ptrState === 'refreshing' ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" style={{ animation: 'ptr-spin 0.7s linear infinite' }}>
                <path d="M8 1a7 7 0 1 0 7 7"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={ptrState === 'ready' ? 'var(--gold)' : 'var(--ink3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: ptrState === 'ready' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s, stroke 0.2s' }}>
                <path d="M8 3v10M3 11l5 5 5-5"/>
              </svg>
            )}
          </div>
        </div>
        <style>{`
          @keyframes ptr-spin { to { transform: rotate(360deg); } }

          /* ── Type scale ── */
          .adm-outer .font-num { font-weight: 900 !important; }
          .adm-sl { font-size: 9px !important; font-weight: 600 !important; letter-spacing: 0.22em !important; color: var(--ink3); text-transform: uppercase; }

          /* ── Responsive stat grids ── */
          .adm-grid { display: grid; }
          .adm-grid-4 { grid-template-columns: repeat(4, 1fr); }
          .adm-grid-5 { grid-template-columns: repeat(5, 1fr); }
          .adm-grid-3 { grid-template-columns: repeat(3, 1fr); }

          /* ── Tab bar ── */
          .adm-tab-active { background: var(--surface2) !important; color: var(--ink) !important; border: 1px solid var(--border2) !important; }
          .adm-tab { color: var(--ink3) !important; background: transparent !important; border: 1px solid transparent !important; }

          @media (max-width: 640px) {
            /* Page padding */
            .adm-outer { padding: 0 12px !important; }

            /* Tabs: full width */
            .adm-tabs { width: 100% !important; }
            .adm-tabs button { flex: 1; padding: 8px 12px !important; }

            /* Stat grids: 2-col on mobile */
            .adm-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
            .adm-grid-5 { grid-template-columns: repeat(2, 1fr) !important; }
            .adm-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }

            /* Hide non-essential table columns */
            .adm-hide-mob { display: none !important; }

            /* Tier buttons: wrap tightly */
            .adm-tier-btns { flex-wrap: wrap; gap: 4px !important; }
            .adm-tier-btns button { padding: 4px 7px !important; font-size: 10px !important; min-height: 28px !important; }

            /* Market: refresh buttons stack below heading */
            .adm-market-head { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
            .adm-refresh-btns { width: 100%; overflow-x: auto; padding-bottom: 2px; }

            /* Market add-card result rows: tighten up */
            .adm-card-row { gap: 8px !important; padding: 8px 10px !important; }
            .adm-card-row select { max-width: 90px; font-size: 11px !important; }
          }
        `}</style>

        <div className="adm-outer" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>

          {/* Header */}
          <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.5px', margin: 0 }}>Admin</h1>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', padding: '4px 10px', borderRadius: 6, background: 'rgba(232,82,74,0.08)', color: 'var(--red)', border: '1px solid rgba(232,82,74,0.2)', textTransform: 'uppercase' }}>
                Admin Access
              </span>
            </div>
            <Link href="/dashboard" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface)' }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5"/></svg>
              Dashboard
            </Link>
          </div>

          {/* Tab switcher */}
          <div className="adm-tabs" style={{ display: 'flex', gap: 4, marginBottom: 28, borderRadius: 10, padding: 4, background: 'var(--surface)', border: '1px solid var(--border2)', width: 'fit-content' }}>
            {([['users', 'Users'], ['market', 'Market Index'], ['content', 'Content'], ['banners', 'Banners']] as [AdminTab, string][]).map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={activeTab === tab ? 'adm-tab-active' : 'adm-tab'} style={{
                padding: '7px 20px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>

          {/* Flash message */}
          {msg && (
            <div style={{ marginBottom: 16, borderRadius: 10, padding: '12px 16px', background: msg.type === 'ok' ? 'rgba(61,232,138,0.08)' : 'rgba(232,82,74,0.08)', border: `1px solid ${msg.type === 'ok' ? 'rgba(61,232,138,0.2)' : 'rgba(232,82,74,0.25)'}`, fontSize: 13, color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)' }}>
              {msg.text}
            </div>
          )}

          {activeTab === 'users' && <>

          {/* ── USERS ──────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className="adm-sl" style={{}}>Users</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div className="adm-grid adm-grid-4" style={{ gap: 10, marginBottom: 24 }}>
            {(['free', 'pro'] as const).map(t => (
              <div key={t} style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', marginBottom: 8, textTransform: 'capitalize' }}>{t}</div>
                <div className="font-num" style={{ fontSize: 30, fontWeight: 900, color: TIER_COLORS[t], lineHeight: 1 }}>
                  {t === 'pro'
                    ? users.filter(u => u.tier === 'pro' || u.tier === 'standard').length
                    : users.filter(u => u.tier === t).length}
                </div>
              </div>
            ))}
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>Converted</div>
              <div className="font-num" style={{ fontSize: 30, fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>
                {users.length > 0
                  ? `${((users.filter(u => u.tier === 'pro' || u.tier === 'standard').length / users.length) * 100).toFixed(1)}%`
                  : '0%'}
              </div>
            </div>
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>Total</div>
              <div className="font-num" style={{ fontSize: 30, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>{users.length}</div>
            </div>
          </div>

          {/* ── PORTFOLIO ──────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className="adm-sl" style={{}}>Portfolio</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div className="adm-grid adm-grid-3" style={{ gap: 10, marginBottom: 24 }}>
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid rgba(232,197,71,0.3)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>Market Value</div>
              <div className="font-num" style={{ fontSize: 26, fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>
                {portfolioStats ? fmtCurrency(portfolioStats.totalMarketValue) : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 5 }}>
                {portfolioStats ? `${portfolioStats.pricedPositions}/${portfolioStats.totalPositions} priced` : '—'}
              </div>
            </div>
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>Cost Basis</div>
              <div className="font-num" style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>
                {portfolioStats ? fmtCurrency(portfolioStats.totalCostBasis) : '—'}
              </div>
              {portfolioStats && portfolioStats.totalCostBasis > 0 && (
                <div style={{ fontSize: 11, marginTop: 5, color: portfolioStats.totalMarketValue >= portfolioStats.totalCostBasis ? 'var(--green)' : 'var(--red)' }}>
                  {portfolioStats.totalMarketValue >= portfolioStats.totalCostBasis ? '+' : ''}
                  {(((portfolioStats.totalMarketValue - portfolioStats.totalCostBasis) / portfolioStats.totalCostBasis) * 100).toFixed(1)}% unrealised
                </div>
              )}
            </div>
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>Cards Tracked</div>
              <div className="font-num" style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>
                {portfolioStats ? portfolioStats.totalPositions.toLocaleString() : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 5 }}>Across all portfolios</div>
            </div>
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>Active Portfolios</div>
              <div className="font-num" style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>
                {portfolioStats ? portfolioStats.usersWithPortfolio : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 5 }}>Users with ≥1 position</div>
            </div>
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>Avg Cards</div>
              <div className="font-num" style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>
                {portfolioStats ? portfolioStats.avgCardsPerPortfolio.toFixed(1) : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 5 }}>Per active user</div>
            </div>
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>Avg Value</div>
              <div className="font-num" style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>
                {portfolioStats ? fmtCurrency(portfolioStats.avgPortfolioValue) : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 5 }}>Per active user</div>
            </div>
          </div>

          {/* ── GROWTH ─────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className="adm-sl" style={{}}>Growth</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div className="adm-grid adm-grid-5" style={{ gap: 10, marginBottom: 24 }}>
            {[
              { label: 'New this week',  value: growthStats?.newThisWeek,       sub: 'Signups · 7 days'   },
              { label: 'New this month', value: growthStats?.newThisMonth,      sub: 'Signups · 30 days'  },
              { label: 'Active (7d)',    value: growthStats?.recentlyActive7d,  sub: 'Signed in · 7 days' },
              { label: 'Active (30d)',   value: growthStats?.recentlyActive30d, sub: 'Signed in · 30 days'},
            ].map(({ label, value, sub }) => (
              <div key={label} style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>{label}</div>
                <div className="font-num" style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>{value ?? '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 5 }}>{sub}</div>
              </div>
            ))}
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid rgba(61,232,138,0.2)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>Conversion</div>
              <div className="font-num" style={{ fontSize: 26, fontWeight: 900, color: 'var(--green)', lineHeight: 1 }}>
                {growthStats ? `${growthStats.conversionRate.toFixed(1)}%` : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 5 }}>Free → paid</div>
            </div>
          </div>

          {/* ── HEALTH & USAGE ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className="adm-sl" style={{}}>Health &amp; Usage</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div className="adm-grid adm-grid-4" style={{ gap: 10, marginBottom: 24 }}>
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>Total Searches</div>
              <div className="font-num" style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>
                {usageStats ? usageStats.totalSearches.toLocaleString() : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 5 }}>All-time log entries</div>
            </div>
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>Cached Cards</div>
              <div className="font-num" style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>
                {usageStats ? usageStats.cachedCards.toLocaleString() : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 5 }}>Unique card/grade combos</div>
            </div>
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: `1px solid ${usageStats && usageStats.staleCacheCount > 0 ? 'rgba(232,197,71,0.35)' : 'var(--border2)'}` }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>Stale Cache</div>
              <div className="font-num" style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: usageStats && usageStats.staleCacheCount > 0 ? 'var(--gold)' : 'var(--ink)' }}>
                {usageStats ? usageStats.staleCacheCount.toLocaleString() : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 5 }}>Not refreshed in &gt;24h</div>
            </div>
            <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: `1px solid ${usageStats && usageStats.openReports > 0 ? 'rgba(232,82,74,0.3)' : 'var(--border2)'}` }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', color: 'var(--ink3)', marginBottom: 8, textTransform: 'uppercase' }}>Issue Reports</div>
              <div className="font-num" style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: usageStats && usageStats.openReports > 0 ? 'var(--red)' : 'var(--ink)' }}>
                {usageStats ? usageStats.openReports.toLocaleString() : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 5 }}>Total reports submitted</div>
            </div>
          </div>

          {/* ── TOP TRACKED CARDS ──────────────────────────────────────────── */}
          {usageStats && usageStats.topTrackedCards.length > 0 && (
            <div style={S.card}>
              <div style={S.head}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Most Tracked Cards</span>
                <span style={{ fontSize: 11, color: 'var(--ink3)' }}>By portfolio positions</span>
              </div>
              <div style={S.body}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {usageStats.topTrackedCards.map((card, i) => (
                    <div key={card.card_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="font-num" style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink3)', minWidth: 24 }}>#{i + 1}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{card.card_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{card.card_id}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.25)', padding: '3px 10px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                        {card.count} {card.count === 1 ? 'position' : 'positions'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Pending upgrade requests */}
          {pendingRequests.length > 0 && (
            <div style={S.card}>
              <div style={S.head}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                  Upgrade Requests
                  <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(232,197,71,0.12)', color: 'var(--gold)', border: '1px solid rgba(232,197,71,0.3)' }}>
                    {pendingRequests.length} pending
                  </span>
                </span>
              </div>
              <div style={S.body}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pendingRequests.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{r.user_email ?? r.user_id}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
                          Requesting <strong style={{ color: 'var(--gold)' }}>{r.requested_tier}</strong> · {new Date(r.requested_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          disabled={actingId === r.id}
                          onClick={() => actionRequest(r.id, 'approve')}
                          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'rgba(61,232,138,0.15)', color: 'var(--green)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Approve
                        </button>
                        <button
                          disabled={actingId === r.id}
                          onClick={() => actionRequest(r.id, 'deny')}
                          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'rgba(232,82,74,0.1)', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* User table */}
          <div style={S.card} id="users-table">
            <div style={S.head}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Users ({filteredUsers.length})</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search email or username…"
                style={{ padding: '7px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 12, outline: 'none', width: 220 }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {[
                      { label: 'Email',       cls: '' },
                      { label: 'Username',    cls: 'adm-hide-mob' },
                      { label: 'Tier',        cls: '' },
                      { label: 'Status',      cls: 'adm-hide-mob' },
                      { label: 'Last seen',   cls: '' },
                      { label: 'Joined',      cls: 'adm-hide-mob' },
                      { label: 'Searches',    cls: 'adm-hide-mob' },
                      { label: 'Change Tier', cls: '' },
                    ].map(({ label, cls }) => (
                      <th key={label} className={cls} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, letterSpacing: 1, color: 'var(--ink3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--border)' : 'none', background: 'transparent' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--ink)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                        {u.is_admin && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: 'var(--red)', letterSpacing: 0.5 }}>ADMIN</span>}
                      </td>
                      <td className="adm-hide-mob" style={{ padding: '12px 16px', color: 'var(--ink2)' }}>{u.username ?? '—'}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={S.pill(u.tier)}>{u.tier.toUpperCase()}</span>
                        {(() => {
                          const d = trialDaysLeft(u.trial_ends_at)
                          if (d === null) {
                            return u.trial_ends_at
                              ? <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--ink3)' }}>trial ended</span>
                              : null
                          }
                          return (
                            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--gold)', background: 'rgba(232,197,71,0.12)', border: '1px solid rgba(232,197,71,0.35)', borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                              {d}d trial
                            </span>
                          )
                        })()}
                      </td>
                      <td className="adm-hide-mob" style={{ padding: '12px 16px', color: u.subscription_status === 'active' ? 'var(--green)' : 'var(--ink3)', fontSize: 12 }}>
                        {u.subscription_status ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, whiteSpace: 'nowrap', color: !u.last_active_at ? 'var(--ink3)' : Date.now() - new Date(u.last_active_at).getTime() < 86400000 ? 'var(--green)' : 'var(--ink2)' }}>
                        {timeAgo(u.last_active_at)}
                      </td>
                      <td className="adm-hide-mob" style={{ padding: '12px 16px', color: 'var(--ink3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="adm-hide-mob" style={{ padding: '12px 16px', color: 'var(--ink)', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {(u.search_count ?? 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div className="adm-tier-btns" style={{ display: 'flex', gap: 6 }}>
                          {(['free', 'pro'] as const).map(t => (
                            <button
                              key={t}
                              disabled={(u.tier === t || (t === 'pro' && u.tier === 'standard')) || savingId === u.id}
                              onClick={() => setTier(u.id, t)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 6,
                                border: `1px solid ${(u.tier === t || (t === 'pro' && u.tier === 'standard')) ? TIER_COLORS[t] : 'var(--border2)'}`,
                                background: (u.tier === t || (t === 'pro' && u.tier === 'standard')) ? (t === 'pro' ? 'rgba(232,197,71,0.1)' : 'rgba(255,255,255,0.06)') : 'transparent',
                                color: (u.tier === t || (t === 'pro' && u.tier === 'standard')) ? TIER_COLORS[t] : 'var(--ink3)',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: (u.tier === t || (t === 'pro' && u.tier === 'standard')) ? 'default' : 'pointer',
                                opacity: savingId === u.id ? 0.5 : 1,
                                transition: 'all 0.15s',
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          </> /* end activeTab === 'users' */}

          {/* ── Market Index tab ───────────────────────────────────────────── */}
          {activeTab === 'market' && (() => {
            const priced = constituents.filter(c => c.price != null)
            const stale  = constituents.filter(c => !c.last_fetched || Date.now() - new Date(c.last_fetched).getTime() > 6 * 3600 * 1000)

            return (
              <>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Index cards',   value: constituents.length, sub: 'of 250 target', color: 'var(--ink)' },
                    { label: 'Priced',        value: priced.length, sub: 'with live price', color: 'var(--green)' },
                    { label: 'Stale / missing', value: stale.length, sub: '> 6h old or unpriced', color: stale.length > 0 ? 'var(--gold)' : 'var(--ink3)' },
                  ].map((s, i) => (
                    <div key={i} style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
                      <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>{s.label}</div>
                      <div className="font-num" style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>{s.sub}</div>
                    </div>
                  ))}
                  {/* Progress bar tile */}
                  <div style={{ borderRadius: 14, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border2)' }}>
                    <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 10 }}>Coverage</div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', width: `${(priced.length / Math.max(constituents.length, 1)) * 100}%`, background: 'var(--green)', borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>{priced.length}/{constituents.length} priced</div>
                  </div>
                </div>

                {/* Add cards panel */}
                <div style={{ ...S.card, marginBottom: 16 }}>
                  <div className="adm-market-head" style={S.head}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Add cards to index</span>
                    <div className="adm-refresh-btns" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={seedIndex}
                        disabled={seeding}
                        style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(232,197,71,0.3)', background: 'rgba(232,197,71,0.07)', color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: seeding ? 0.5 : 1 }}
                      >
                        {seeding ? 'Seeding…' : '⬇ Seed CI-100'}
                      </button>
                      <button
                        onClick={runMigration}
                        style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.07)', color: '#4a9eff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        title="Add any missing columns to search_cache table"
                      >
                        🔧 DB Migration
                      </button>
                      <button
                        onClick={() => setMigrationSql(
                          `-- Portfolio: add sold-position columns\nALTER TABLE portfolios ADD COLUMN IF NOT EXISTS sold boolean DEFAULT false;\nALTER TABLE portfolios ADD COLUMN IF NOT EXISTS sale_price numeric;\nALTER TABLE portfolios ADD COLUMN IF NOT EXISTS sold_at timestamptz;`
                        )}
                        style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.07)', color: '#4a9eff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        title="Add sold/sale_price/sold_at columns to portfolios table"
                      >
                        🔧 Portfolio Migration
                      </button>
                      {refreshProgress ? (
                        <span style={{ fontSize: 12, color: 'var(--ink3)', padding: '7px 0' }}>
                          Refreshing {refreshProgress.done}/{refreshProgress.total}…
                        </span>
                      ) : (
                        <>
                          {/* Delay selector */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface2)' }}>
                            <span style={{ fontSize: 10, color: 'var(--ink3)', whiteSpace: 'nowrap' }}>Delay</span>
                            <select
                              value={refreshDelay}
                              onChange={e => setRefreshDelay(Number(e.target.value))}
                              style={{ fontSize: 11, background: 'transparent', border: 'none', color: 'var(--ink2)', cursor: 'pointer', outline: 'none' }}
                            >
                              <option value={300}>300ms (~30s)</option>
                              <option value={500}>500ms (~50s) ✓</option>
                              <option value={750}>750ms (~1.3m)</option>
                              <option value={1000}>1000ms (~1.7m)</option>
                            </select>
                          </div>
                          <button
                            onClick={refreshAllPrices}
                            disabled={refreshing || constituents.length === 0}
                            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--ink2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: refreshing ? 0.5 : 1 }}
                          >
                            ↺ Refresh stale ({stale.length})
                          </button>
                          <button
                            onClick={forceRefreshAll}
                            disabled={refreshing || constituents.length === 0}
                            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(232,82,74,0.3)', background: 'rgba(232,82,74,0.07)', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: refreshing ? 0.5 : 1 }}
                            title="Re-fetch all cards regardless of freshness — use after DB migration"
                          >
                            ⟳ Force all ({constituents.length})
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={S.body}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <input
                        value={cardSearch}
                        onChange={e => handleCardSearchInput(e.target.value)}
                        placeholder="Search card name e.g. Charizard…"
                        style={{ flex: 1, padding: '9px 14px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                      />
                      {cardSearch && (
                        <button onClick={() => { setCardSearch(''); setCardResults([]) }}
                          style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--ink3)', fontSize: 13, cursor: 'pointer' }}>
                          ✕
                        </button>
                      )}
                    </div>

                    {cardSearching && (
                      <div style={{ fontSize: 12, color: 'var(--ink3)', padding: '8px 0' }}>Searching pokemontcg.io…</div>
                    )}

                    {cardResults.length > 0 && (
                      <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                        {cardResults.map((card, i) => {
                          const alreadyAdded = constituents.some(c => c.card_id === card.id && c.grade === (addingGrade[card.id] || 'PSA 10'))
                          return (
                            <div key={card.id} className="adm-card-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < cardResults.length - 1 ? '1px solid var(--border)' : 'none', background: alreadyAdded ? 'rgba(61,232,138,0.03)' : 'transparent' }}>
                              <div style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)' }}>
                                <img src={tcgImg(card.images.small)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{card.set.name} · #{card.number}{card.rarity ? ` · ${card.rarity}` : ''}</div>
                              </div>
                              <select
                                value={addingGrade[card.id] || 'PSA 10'}
                                onChange={e => setAddingGrade(prev => ({ ...prev, [card.id]: e.target.value }))}
                                style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, cursor: 'pointer' }}
                              >
                                {['PSA 10', 'PSA 9', 'PSA 8', 'BGS 9.5', 'BGS 9', 'CGC 10', 'Raw'].map(g => (
                                  <option key={g} value={g}>{g}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => addConstituent(card)}
                                disabled={!!addingId || alreadyAdded}
                                style={{
                                  padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: alreadyAdded ? 'default' : 'pointer',
                                  background: alreadyAdded ? 'rgba(61,232,138,0.1)' : 'var(--gold)',
                                  color: alreadyAdded ? 'var(--green)' : '#080810',
                                  opacity: addingId && addingId !== card.id ? 0.5 : 1,
                                  flexShrink: 0,
                                }}
                              >
                                {alreadyAdded ? '✓ Added' : addingId === card.id ? '…' : '+ Add'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Constituent list */}
                <div style={S.card}>
                  <div style={S.head}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                      Index constituents ({constituents.length})
                    </span>
                    <button onClick={loadConstituents} disabled={constitLoading}
                      style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--ink3)', fontSize: 11, cursor: 'pointer', opacity: constitLoading ? 0.5 : 1 }}>
                      {constitLoading ? 'Loading…' : '↺ Reload'}
                    </button>
                  </div>
                  {constitLoading ? (
                    <div style={{ padding: 22, fontSize: 12, color: 'var(--ink3)' }}>Loading…</div>
                  ) : constituents.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                      <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 12 }}>📈</div>
                      <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 6 }}>No cards in the index yet</div>
                      <div style={{ fontSize: 11, color: 'var(--ink3)', opacity: 0.7 }}>Search for cards above and add them to build your CI-100 index</div>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            {[
                              { label: 'Card',         cls: '' },
                              { label: 'Grade',        cls: 'adm-hide-mob' },
                              { label: 'Price',        cls: '' },
                              { label: '30d Chg',      cls: 'adm-hide-mob' },
                              { label: 'Last updated', cls: 'adm-hide-mob' },
                              { label: '',             cls: '' },
                            ].map(({ label, cls }) => (
                              <th key={label} className={cls} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 9, letterSpacing: 1, color: 'var(--ink3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label.toUpperCase()}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {constituents.map((c, i) => {
                            const isStale = !c.last_fetched || Date.now() - new Date(c.last_fetched).getTime() > 6 * 3600 * 1000
                            return (
                              <tr key={c.id} style={{ borderBottom: i < constituents.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {c.image_url && (
                                      <div style={{ width: 28, height: 28, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
                                        <img src={tcgImg(c.image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                      </div>
                                    )}
                                    <div>
                                      <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 12 }}>{c.card_name}</div>
                                      {c.set_name && <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{c.set_name}</div>}
                                    </div>
                                  </div>
                                </td>
                                <td className="adm-hide-mob" style={{ padding: '10px 14px', color: 'var(--ink2)', whiteSpace: 'nowrap' }}>{c.grade}</td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span className="font-num" style={{ fontWeight: 700, color: c.price != null ? 'var(--ink)' : 'var(--ink3)' }}>
                                    {c.price != null ? fmtPrice(c.price) : '—'}
                                  </span>
                                </td>
                                <td className="adm-hide-mob" style={{ padding: '10px 14px' }}>
                                  {c.price_change_pct != null ? (
                                    <span className="font-num" style={{ color: c.price_change_pct >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                                      {c.price_change_pct >= 0 ? '+' : ''}{c.price_change_pct.toFixed(1)}%
                                    </span>
                                  ) : <span style={{ color: 'var(--ink3)' }}>—</span>}
                                </td>
                                <td className="adm-hide-mob" style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  {c.last_fetched ? (
                                    <span style={{ fontSize: 11, color: isStale ? 'var(--gold)' : 'var(--ink3)' }}>
                                      {isStale ? '⚠ ' : ''}{new Date(c.last_fetched).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 11, color: 'var(--red)' }}>⚠ Not priced</span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => removeConstituent(c.id)}
                                    disabled={removingId === c.id}
                                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink3)', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink3)' }}
                                  >
                                    {removingId === c.id ? '…' : 'Remove'}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )
          })()}

          {/* ── Content tab ────────────────────────────────────────────────── */}
          {activeTab === 'content' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <span className="adm-sl" style={{}}>Share Images</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {/* Verdict Pills */}
              <div style={S.card}>
                <div style={S.head}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Verdict Pills</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>Download each verdict as a transparent high-res PNG overlay</div>
                  </div>
                </div>
                <div style={S.body}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {(['Buy', 'Accumulate', 'Hold', 'Reduce', 'Avoid']).map((verdict) => {
                      const { color, bg, border } = verdictStyle(verdict)
                      return (
                        <button
                          key={verdict}
                          onClick={() => downloadVerdictPill(verdict)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 18px', borderRadius: 99, border: `1px solid ${border}`,
                            background: bg, color, cursor: 'pointer',
                            fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
                          }}
                        >
                          {verdict}
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1"/><path d="M8 2v9M5 8l3 3 3-3"/>
                          </svg>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Score Circle */}
              {(() => {
                const score = Math.min(100, Math.max(0, scoreCircleVal || 0))
                const color = score >= 80 ? '#3de88a' : score >= 60 ? '#e8c547' : '#e8524a'
                const label = score >= 80 ? 'STRONG'  : score >= 60 ? 'MODERATE' : 'WEAK'
                const bg    = score >= 80 ? 'rgba(61,232,138,0.06)' : score >= 60 ? 'rgba(232,197,71,0.06)' : 'rgba(232,82,74,0.06)'
                return (
                  <div style={S.card}>
                    <div style={S.head}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Score Circle</div>
                        <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>Download a transparent high-res PNG of any score</div>
                      </div>
                    </div>
                    <div style={S.body}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        {/* Live preview */}
                        <div style={{
                          width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
                          border: `3px solid ${color}`, background: bg,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                        }}>
                          <span style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1, letterSpacing: '-1px' }}>{score}</span>
                          <span style={{ fontSize: 8, fontWeight: 600, color, opacity: 0.6, letterSpacing: 0.5 }}>{label}</span>
                        </div>
                        {/* Controls */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input
                              type="range" min={0} max={100}
                              value={scoreCircleVal}
                              onChange={e => setScoreCircleVal(Number(e.target.value))}
                              style={{ flex: 1, accentColor: color }}
                            />
                            <input
                              type="number" min={0} max={100}
                              value={scoreCircleVal}
                              onChange={e => setScoreCircleVal(Math.min(100, Math.max(0, Number(e.target.value))))}
                              style={{
                                width: 60, padding: '5px 8px', borderRadius: 7,
                                border: '1px solid var(--border2)', background: 'var(--bg)',
                                color: 'var(--ink)', fontSize: 13, fontWeight: 700, textAlign: 'center',
                              }}
                            />
                          </div>
                          <button
                            onClick={() => downloadScoreCircle(scoreCircleVal)}
                            style={{
                              alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7,
                              padding: '8px 18px', borderRadius: 9, border: 'none',
                              background: 'var(--gold)', color: '#08080f',
                              fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 12v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1"/><path d="M8 2v9M5 8l3 3 3-3"/>
                            </svg>
                            Download PNG
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Radar + Score Bars */}
              {(() => {
                const { trend, liquidity, consistency, value } = radarVals
                const entries = [
                  { key: 'trend'       as const, label: 'Trend' },
                  { key: 'liquidity'   as const, label: 'Liquidity' },
                  { key: 'consistency' as const, label: 'Consistency' },
                  { key: 'value'       as const, label: 'Value' },
                ]
                // radar geometry (matches download fn)
                const cx = 100, cy = 95, r = 72
                const tY = cy - r * trend / 100, lX = cx + r * liquidity / 100
                const csY = cy + r * consistency / 100, vX = cx - r * value / 100
                function gridPts(pct: number) {
                  const gr = r * pct
                  return `${cx},${cy - gr} ${cx + gr},${cy} ${cx},${cy + gr} ${cx - gr},${cy}`
                }
                return (
                  <div style={S.card}>
                    <div style={S.head}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Spider Graph &amp; Score Bars</div>
                        <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>Download transparent high-res PNGs of each asset</div>
                      </div>
                    </div>
                    <div style={S.body}>
                      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {/* Left: sliders */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 220 }}>
                          {entries.map(({ key, label }) => {
                            const val = radarVals[key]
                            const col = barColor(val)
                            return (
                              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', width: 90, flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
                                <input type="range" min={0} max={100} value={val}
                                  onChange={e => setRadarVals(v => ({ ...v, [key]: Number(e.target.value) }))}
                                  style={{ flex: 1, accentColor: col }} />
                                <input type="number" min={0} max={100} value={val}
                                  onChange={e => setRadarVals(v => ({ ...v, [key]: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                                  style={{ width: 50, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg)', color: col, fontSize: 12, fontWeight: 700, textAlign: 'center' }} />
                              </div>
                            )
                          })}
                          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <button onClick={downloadRadarGraph} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--gold)', color: '#08080f', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1"/><path d="M8 2v9M5 8l3 3 3-3"/></svg>
                              Spider Graph
                            </button>
                            <button onClick={downloadScoreBars} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--gold)', color: '#08080f', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1"/><path d="M8 2v9M5 8l3 3 3-3"/></svg>
                              Score Bars
                            </button>
                          </div>
                        </div>

                        {/* Right: live previews */}
                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          {/* Radar preview */}
                          <div style={{ width: 170, height: 170, flexShrink: 0 }}>
                            <svg viewBox="-44 -26 288 252" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                              {[0.25, 0.5, 0.75, 1].map(p => (
                                <polygon key={p} points={gridPts(p)} fill="none" stroke={p === 1 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.07)'} strokeWidth="1" />
                              ))}
                              {[[cx, cy, cx, cy - r], [cx, cy, cx + r, cy], [cx, cy, cx, cy + r], [cx, cy, cx - r, cy]].map(([x1, y1, x2, y2], i) => (
                                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
                              ))}
                              <polygon points={`${cx},${tY} ${lX},${cy} ${cx},${csY} ${vX},${cy}`} fill="rgba(215,170,60,0.15)" stroke="#d7aa3c" strokeWidth="1.5" />
                              {[[cx, tY], [lX, cy], [cx, csY], [vX, cy]].map(([x, y], i) => (
                                <circle key={i} cx={x} cy={y} r="4" fill="#d7aa3c" />
                              ))}
                              <text x={cx}       y={cy - r - 14} textAnchor="middle" fontSize="13" fontWeight="600" fill="rgba(255,255,255,0.45)" fontFamily="sans-serif">Trend</text>
                              <text x={cx + r + 12} y={cy + 5}  textAnchor="start"  fontSize="13" fontWeight="600" fill="rgba(255,255,255,0.45)" fontFamily="sans-serif">Liquidity</text>
                              <text x={cx}       y={cy + r + 20} textAnchor="middle" fontSize="13" fontWeight="600" fill="rgba(255,255,255,0.45)" fontFamily="sans-serif">Consistency</text>
                              <text x={cx - r - 12} y={cy + 5}  textAnchor="end"    fontSize="13" fontWeight="600" fill="rgba(255,255,255,0.45)" fontFamily="sans-serif">Value</text>
                            </svg>
                          </div>

                          {/* Bars preview */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', minWidth: 200 }}>
                            {entries.map(({ key, label }) => {
                              const val = radarVals[key]
                              const col = barColor(val)
                              return (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', width: 80, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</span>
                                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${val}%`, background: col, borderRadius: 3 }} />
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: col, width: 28, textAlign: 'right' }}>{val}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Most Searched card */}
              <div style={S.card}>
                <div style={S.head}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Most Searched Cards</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>Top 5 most-searched cards this week with CI score &amp; verdict</div>
                  </div>
                  <button
                    onClick={() => {
                      if (!topSearched) return
                      setShowTopSearchedModal(true)
                    }}
                    disabled={topSearchedLoading || !topSearched || (topSearched.cards?.length ?? 0) === 0}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 18px', borderRadius: 9, border: 'none',
                      background: topSearchedLoading || !topSearched || (topSearched.cards?.length ?? 0) === 0
                        ? 'rgba(232,197,71,0.2)' : 'var(--gold)',
                      color: topSearchedLoading || !topSearched || (topSearched.cards?.length ?? 0) === 0
                        ? 'rgba(232,197,71,0.5)' : '#08080f',
                      fontSize: 13, fontWeight: 700, cursor: topSearchedLoading || !topSearched || (topSearched.cards?.length ?? 0) === 0 ? 'default' : 'pointer',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1"/>
                      <path d="M8 2v9M5 8l3 3 3-3"/>
                    </svg>
                    {topSearchedLoading ? 'Loading…' : 'Generate Image'}
                  </button>
                </div>
                <div style={S.body}>
                  {topSearchedLoading ? (
                    <div style={{ fontSize: 12, color: 'var(--ink3)', padding: '8px 0' }}>Loading top searched cards…</div>
                  ) : !topSearched || topSearched.cards?.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--ink3)', padding: '8px 0' }}>No search data available for this week yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Week info */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: 'rgba(215,170,60,0.08)', border: '1px solid rgba(215,170,60,0.2)', color: 'var(--gold)' }}>
                          Week {topSearched.weekNum} · {topSearched.year}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--ink3)', padding: '3px 0' }}>{topSearched.dateStr}</span>
                      </div>
                      {/* Card list preview */}
                      {topSearched.cards.map((card) => (
                        <div key={`${card.card_name}-${card.grade}`} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px', borderRadius: 10,
                          background: 'var(--bg)', border: '1px solid var(--border)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{
                              fontSize: 12, fontWeight: 800,
                              color: card.rank === 1 ? 'var(--gold)' : card.rank === 2 ? '#9ca3af' : card.rank === 3 ? '#cd7f32' : 'var(--ink3)',
                              minWidth: 28,
                            }}>#{card.rank}</span>
                            {card.image_url && (
                              <div style={{ width: 28, height: 28, borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
                                <img src={tcgImg(card.image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{card.card_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
                                {card.set_name ? `${card.set_name} · ` : ''}{card.grade}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{card.search_count} {card.search_count === 1 ? 'search' : 'searches'}</span>
                            {card.score != null && (
                              <span style={{
                                fontSize: 12, fontWeight: 700,
                                color: card.score >= 70 ? 'var(--green)' : card.score >= 50 ? 'var(--gold)' : 'var(--red)',
                                background: card.score >= 70 ? 'rgba(61,232,138,0.08)' : card.score >= 50 ? 'rgba(215,170,60,0.08)' : 'rgba(232,82,74,0.08)',
                                border: `1px solid ${card.score >= 70 ? 'rgba(61,232,138,0.2)' : card.score >= 50 ? 'rgba(215,170,60,0.2)' : 'rgba(232,82,74,0.2)'}`,
                                padding: '2px 9px', borderRadius: 99,
                              }}>
                                {Math.round(card.score)}
                              </span>
                            )}
                            {card.verdict && (() => {
                              const { color, bg, border } = verdictStyle(card.verdict)
                              return (
                                <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${border}`, padding: '2px 9px', borderRadius: 99, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                                  {card.verdict}
                                </span>
                              )
                            })()}
                          </div>
                        </div>
                      ))}
                      {/* Reload */}
                      <button
                        onClick={() => { setTopSearched(null) }}
                        style={{ alignSelf: 'flex-start', marginTop: 4, fontSize: 11, fontWeight: 600, color: 'var(--ink3)', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}
                      >
                        ↺ Reload
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* ── Stat cards ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
                <span className="adm-sl" style={{}}>Stat Cards</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {statCards.map(({ title, desc, config }) => (
                <div key={title} style={S.card}>
                  <div style={S.head}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: config.accentColor, flexShrink: 0 }} />
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3, paddingLeft: 20 }}>{desc}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: config.accentColor, letterSpacing: '-0.5px' }}>
                        {config.statDisplay}
                      </span>
                      <button
                        onClick={() => setActiveStatModal(config)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '9px 18px', borderRadius: 9, border: 'none',
                          background: 'var(--gold)', color: '#08080f',
                          fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1"/>
                          <path d="M8 2v9M5 8l3 3 3-3"/>
                        </svg>
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!usageStats && (
                <div style={{ fontSize: 12, color: 'var(--ink3)', padding: '8px 0' }}>Stat data loading — switch to the Users tab first to load platform stats.</div>
              )}

              {/* End Card */}
              <div style={S.card}>
                <div style={S.head}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>End Card</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>Static brand end card — "Stop guessing. Start investing."</div>
                  </div>
                  <button
                    onClick={() => setShowEndCardModal(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 18px', borderRadius: 9, border: 'none',
                      background: 'var(--gold)', color: '#08080f',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1"/>
                      <path d="M8 2v9M5 8l3 3 3-3"/>
                    </svg>
                    Generate Image
                  </button>
                </div>
                <div style={S.body}>
                  <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
                    Renders the CardIndex brand end card at 2160×2700 (2× retina). Use as a final slide in video content or story posts.
                  </div>
                </div>
              </div>

              {/* Brand Lockup */}
              <div style={S.card}>
                <div style={S.head}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Brand Lockup</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>Wordmark centred on the CardIndex background</div>
                  </div>
                  <button
                    onClick={() => setShowBrandModal(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 18px', borderRadius: 9, border: 'none',
                      background: 'var(--gold)', color: '#08080f',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1"/>
                      <path d="M8 2v9M5 8l3 3 3-3"/>
                    </svg>
                    Generate Image
                  </button>
                </div>
                <div style={S.body}>
                  <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
                    Plain branded background at 2160×2700 (2× retina). Use as a title card, overlay base, or blank branded slide.
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Banners tab ──────────────────────────────────────────────── */}
          {activeTab === 'banners' && (
            <>
              {/* Create form */}
              <div style={S.card}>
                <div style={S.head}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>New banner</span>
                  <span style={{ fontSize: 11, color: 'var(--ink3)' }}>Publishes immediately — deactivates any existing active banner</span>
                </div>
                <div style={{ ...S.body, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', display: 'block', marginBottom: 6 }}>TITLE</label>
                    <input
                      value={bannerForm.title}
                      onChange={e => setBannerForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. 🎉 Giveaway — win a PSA 10 Charizard"
                      maxLength={80}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', display: 'block', marginBottom: 6 }}>BODY</label>
                    <textarea
                      value={bannerForm.body}
                      onChange={e => setBannerForm(f => ({ ...f, body: e.target.value }))}
                      placeholder="Short description shown to users on their dashboard"
                      maxLength={200}
                      rows={3}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', display: 'block', marginBottom: 6 }}>BUTTON LABEL (optional)</label>
                      <input
                        value={bannerForm.cta_label}
                        onChange={e => setBannerForm(f => ({ ...f, cta_label: e.target.value }))}
                        placeholder="e.g. Enter now"
                        maxLength={40}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', display: 'block', marginBottom: 6 }}>BUTTON URL (optional)</label>
                      <input
                        value={bannerForm.cta_url}
                        onChange={e => setBannerForm(f => ({ ...f, cta_url: e.target.value }))}
                        placeholder="https://…"
                        maxLength={300}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--ink)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={publishBanner}
                    disabled={bannerSaving || !bannerForm.title.trim() || !bannerForm.body.trim()}
                    style={{ alignSelf: 'flex-start', padding: '10px 22px', borderRadius: 8, border: 'none', background: 'var(--gold)', color: 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: bannerSaving || !bannerForm.title.trim() || !bannerForm.body.trim() ? 0.5 : 1 }}
                  >
                    {bannerSaving ? 'Publishing…' : 'Publish banner'}
                  </button>
                </div>
              </div>

              {/* Existing banners */}
              <div style={S.card}>
                <div style={S.head}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>All banners</span>
                  {bannersLoading && <span style={{ fontSize: 11, color: 'var(--ink3)' }}>Loading…</span>}
                </div>
                <div style={S.body}>
                  {banners.length === 0 && !bannersLoading && (
                    <div style={{ fontSize: 13, color: 'var(--ink3)', textAlign: 'center', padding: '24px 0' }}>No banners yet</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {banners.map(b => (
                      <div key={b.id} style={{ borderRadius: 12, padding: '14px 18px', background: 'var(--bg)', border: `1px solid ${b.active ? 'rgba(232,197,71,0.4)' : 'var(--border)'}`, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            {b.active && (
                              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, padding: '2px 8px', borderRadius: 99, background: 'rgba(232,197,71,0.12)', color: 'var(--gold)', border: '1px solid rgba(232,197,71,0.3)' }}>LIVE</span>
                            )}
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{b.title}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: b.cta_label ? 6 : 0 }}>{b.body}</div>
                          {b.cta_label && (
                            <div style={{ fontSize: 11, color: 'var(--ink3)' }}>Button: <strong style={{ color: 'var(--ink2)' }}>{b.cta_label}</strong>{b.cta_url ? ` → ${b.cta_url}` : ''}</div>
                          )}
                          <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 6 }}>{new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button
                            onClick={() => toggleBanner(b.id, !b.active)}
                            style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${b.active ? 'rgba(232,82,74,0.3)' : 'rgba(61,232,138,0.3)'}`, background: b.active ? 'rgba(232,82,74,0.08)' : 'rgba(61,232,138,0.08)', color: b.active ? 'var(--red)' : 'var(--green)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {b.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deleteBanner(b.id)}
                            style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink3)', fontSize: 12, cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </main>

      {/* ── Top Searched share modal ── */}
      {showTopSearchedModal && topSearched && topSearched.cards.length > 0 && (
        <ShareTopSearchedModal
          cards={topSearched.cards}
          weekNum={topSearched.weekNum}
          year={topSearched.year}
          dateStr={topSearched.dateStr}
          fmtFn={fmtPrice}
          currency={currency}
          onClose={() => setShowTopSearchedModal(false)}
        />
      )}

      {/* ── Stat card modal ── */}
      {activeStatModal && (
        <ShareStatModal config={activeStatModal} onClose={() => setActiveStatModal(null)} />
      )}

      {/* ── End Card modal ── */}
      {showEndCardModal && (
        <ShareEndCardModal onClose={() => setShowEndCardModal(false)} />
      )}

      {/* ── Brand Lockup modal ── */}
      {showBrandModal && (
        <ShareBrandModal onClose={() => setShowBrandModal(false)} />
      )}

      {migrationSql && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setMigrationSql(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 16, padding: 28, maxWidth: 700, width: '100%', maxHeight: '80vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Run this SQL in Supabase</div>
                <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
                  Go to <strong>Supabase Dashboard → SQL Editor → New query</strong>, paste and run:
                </div>
              </div>
              <button onClick={() => setMigrationSql(null)}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink3)', cursor: 'pointer', fontSize: 13 }}>
                ✕
              </button>
            </div>
            <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, fontSize: 11, color: 'var(--ink2)', overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 16 }}>
              {migrationSql}
            </pre>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { navigator.clipboard.writeText(migrationSql); flash('ok', 'SQL copied to clipboard') }}
                style={{ flex: 1, padding: '9px 16px', borderRadius: 8, border: '1px solid rgba(74,158,255,0.4)', background: 'rgba(74,158,255,0.1)', color: '#4a9eff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                📋 Copy SQL
              </button>
              <button onClick={() => setMigrationSql(null)}
                style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--ink3)', fontSize: 12, cursor: 'pointer' }}>
                Close
              </button>
            </div>
            {migrationSql && !migrationSql.includes('portfolios') && (
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(232,197,71,0.07)', border: '1px solid rgba(232,197,71,0.2)', fontSize: 11, color: 'var(--gold)', lineHeight: 1.6 }}>
                After running the SQL, click <strong>Force All</strong> to repopulate price data into the new columns.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
