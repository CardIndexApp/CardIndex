'use client'

import { useState, useCallback, useEffect } from 'react'

export interface TopSearchedCard {
  rank:        number
  card_name:   string
  grade:       string
  set_name:    string | null
  image_url:   string | null
  price:       number | null
  price_change_pct: number | null
  score:       number | null
  verdict:     string | null
  currency:    string
  search_count: number
}

function fmtCardPrice(price: number | null, currency: string): string {
  if (price == null) return '—'
  const sym = currency === 'AUD' ? 'A$' : currency === 'EUR' ? '€' : '$'
  return `${sym}${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function scoreColor(s: number | null): string {
  if (s == null) return 'rgba(255,255,255,0.3)'
  return s >= 70 ? '#3cb87a' : s >= 50 ? '#d7aa3c' : '#e05252'
}

function verdictColor(verdict: string | null): string {
  if (!verdict) return 'rgba(255,255,255,0.3)'
  if (verdict === 'Exceptional' || verdict === 'Strong') return '#3cb87a'
  if (verdict === 'Moderate') return '#d7aa3c'
  return '#e05252'
}

function rankColor(rank: number): string {
  if (rank === 1) return '#d7aa3c'
  if (rank === 2) return '#9ca3af'
  if (rank === 3) return '#cd7f32'
  return 'rgba(255,255,255,0.22)'
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildTopSearchedHtml(
  cards: TopSearchedCard[],
  weekNum: number,
  year: number,
  dateStr: string,
): string {
  function cardRowHtml(card: TopSearchedCard): string {
    const col     = scoreColor(card.score)
    const vCol    = verdictColor(card.verdict)
    const rkCol   = rankColor(card.rank)
    const chgPos  = (card.price_change_pct ?? 0) >= 0
    const chgStr  = card.price_change_pct != null
      ? `${chgPos ? '+' : ''}${card.price_change_pct.toFixed(1)}%`
      : null
    const nameParts = card.card_name.split('&').map(p => p.trim())
    const nameHtml  = nameParts.length > 1
      ? nameParts.map((p, i) => `${esc(p)}${i < nameParts.length - 1 ? ' &amp;' : ''}`).join('<br>')
      : esc(card.card_name)
    const imgProxy = card.image_url ? `/api/img?url=${encodeURIComponent(card.image_url)}` : null

    return `
  <div class="card-row">
    <div class="rank-badge" style="color:${rkCol};border-color:${rkCol === 'rgba(255,255,255,0.22)' ? 'rgba(255,255,255,0.1)' : rkCol};background:${rkCol === '#d7aa3c' ? 'rgba(215,170,60,0.1)' : rkCol === '#9ca3af' ? 'rgba(156,163,175,0.08)' : rkCol === '#cd7f32' ? 'rgba(205,127,50,0.08)' : 'rgba(255,255,255,0.04)'}">
      #${card.rank}
    </div>
    <div class="card-thumb">
      ${imgProxy
        ? `<img src="${imgProxy}" crossorigin="anonymous" alt="${esc(card.card_name)}">`
        : '<div class="no-img">🃏</div>'}
    </div>
    <div class="card-info">
      <div class="card-name">${nameHtml}</div>
      <div class="card-meta">${card.set_name ? `${esc(card.set_name)} · ` : ''}${esc(card.grade)}</div>
      <div class="search-count"><span class="search-num">${card.search_count}</span>${card.search_count === 1 ? 'search' : 'searches'} this week</div>
    </div>
    <div class="card-price">
      <div class="price-val">${fmtCardPrice(card.price, card.currency)}</div>
      ${chgStr ? `<div class="price-chg" style="color:${chgPos ? '#3cb87a' : '#e05252'}">${chgStr} 30d</div>` : ''}
    </div>
    <div class="score-block">
      <div class="score-circle" style="border-color:${col}">
        <div class="score-num" style="color:${col}">${card.score != null ? Math.round(card.score) : '—'}</div>
      </div>
      ${card.verdict ? `<div class="verdict" style="color:${vCol}">${card.verdict}</div>` : ''}
    </div>
  </div>`
  }

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1080px; height:1350px; background:#0a0a0c; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; overflow:hidden; display:flex; flex-direction:column; position:relative; }
  .grid { position:absolute; inset:0; pointer-events:none; background-image:linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px); background-size:54px 54px; }
  .glow { position:absolute; left:50%; top:22%; transform:translate(-50%,-50%); width:1000px; height:500px; background:radial-gradient(ellipse,rgba(215,170,60,0.07) 0%,transparent 62%); pointer-events:none; }

  /* TOPBAR */
  .topbar { position:relative; z-index:10; height:80px; flex-shrink:0; display:flex; align-items:center; justify-content:center; padding:0 56px; border-bottom:1px solid rgba(255,255,255,0.07); }
  .logo-wordmark { display:flex; align-items:center; }
  .logo-wordmark span.card  { font-size:32px; font-weight:700; color:#ffffff; letter-spacing:-0.5px; }
  .logo-wordmark span.index { font-size:32px; font-weight:700; color:#d7aa3c; letter-spacing:-0.5px; }

  /* HERO */
  .hero { position:relative; z-index:2; padding:28px 56px 0; flex-shrink:0; }
  .eyebrow { font-size:12px; font-weight:600; color:#d7aa3c; letter-spacing:0.18em; text-transform:uppercase; margin-bottom:12px; display:flex; align-items:center; gap:12px; }
  .eyebrow::before { content:""; display:block; width:26px; height:2px; background:#d7aa3c; }
  .headline { font-size:104px; font-weight:700; line-height:0.88; letter-spacing:-5px; color:#fff; margin-bottom:16px; }
  .headline em { color:#d7aa3c; font-style:normal; }
  .subline { font-size:18px; font-weight:400; color:rgba(255,255,255,0.34); line-height:1.4; max-width:520px; margin-bottom:16px; }
  .week-row { display:flex; align-items:center; gap:16px; margin-bottom:18px; }
  .week-pill { background:rgba(215,170,60,0.08); border:1px solid rgba(215,170,60,0.22); border-radius:6px; padding:8px 18px; font-size:12px; font-weight:700; color:#d7aa3c; letter-spacing:0.12em; text-transform:uppercase; }
  .date-text { font-size:12px; font-weight:400; color:rgba(255,255,255,0.2); letter-spacing:0.06em; text-transform:uppercase; }

  /* CARDS LIST */
  .cards-section { position:relative; z-index:2; flex:1; display:flex; flex-direction:column; margin:0 48px; padding-bottom:22px; }
  .section-label { font-size:10px; font-weight:600; color:rgba(255,255,255,0.2); letter-spacing:0.14em; text-transform:uppercase; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.07); }
  .card-row { display:flex; align-items:center; gap:22px; padding:14px 0; border-bottom:1px solid rgba(255,255,255,0.05); flex:1; }
  .card-row:last-child { border-bottom:none; }

  /* Rank badge */
  .rank-badge { width:52px; height:52px; border-radius:50%; border:1.5px solid; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:800; flex-shrink:0; letter-spacing:-0.5px; }

  /* Thumbnail */
  .card-thumb { width:86px; height:120px; border-radius:8px; overflow:hidden; flex-shrink:0; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:center; }
  .card-thumb img { width:100%; height:100%; object-fit:cover; border-radius:inherit; display:block; }
  .no-img { font-size:28px; opacity:0.3; }

  /* Card info */
  .card-info { flex:1; min-width:0; }
  .card-name { font-size:30px; font-weight:700; color:#fff; letter-spacing:-0.7px; line-height:1.1; margin-bottom:6px; }
  .card-meta { font-size:14px; font-weight:500; color:rgba(255,255,255,0.32); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:5px; }
  .search-count { font-size:16px; font-weight:600; color:rgba(215,170,60,0.7); margin-top:2px; display:flex; align-items:baseline; gap:5px; }
  .search-num { font-size:26px; font-weight:800; color:#d7aa3c; letter-spacing:-0.5px; line-height:1; }

  /* Price */
  .card-price { text-align:right; flex-shrink:0; }
  .price-val { font-size:32px; font-weight:700; color:#fff; letter-spacing:-0.9px; line-height:1; }
  .price-chg { font-size:15px; font-weight:600; margin-top:6px; }

  /* Score */
  .score-block { display:flex; flex-direction:column; align-items:center; gap:7px; flex-shrink:0; }
  .score-circle { width:82px; height:82px; border-radius:50%; border:2.5px solid; display:flex; align-items:center; justify-content:center; }
  .score-num { font-size:34px; font-weight:700; letter-spacing:-1px; line-height:1; }
  .verdict { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; }

  /* BOTTOMBAR */
  .bottombar { position:relative; z-index:10; flex-shrink:0; }
  .bottombar-inner { height:72px; border-top:1px solid rgba(255,255,255,0.07); display:flex; align-items:center; justify-content:space-between; padding:0 56px; }
  .bot-left  { font-size:12px; font-weight:400; color:rgba(255,255,255,0.18); letter-spacing:0.08em; text-transform:uppercase; }
  .bot-right { font-size:12px; font-weight:500; color:rgba(255,255,255,0.18); display:flex; align-items:center; gap:8px; letter-spacing:0.06em; text-transform:uppercase; }
  .bot-right span { color:#d7aa3c; }
</style></head><body>
<div class="grid"></div>
<div class="glow"></div>

<div class="topbar">
  <div class="logo-wordmark"><span class="card">Card</span><span class="index">Index</span></div>
</div>

<div class="hero">
  <div class="eyebrow">Weekly Report</div>
  <div class="headline">Most<br><em>Searched</em></div>
  <div class="subline">The most-searched cards on CardIndex this week.</div>
  <div class="week-row">
    <div class="week-pill">Week ${weekNum} · ${year}</div>
    <div class="date-text">${dateStr}</div>
  </div>
</div>

<div class="cards-section">
  <div class="section-label">Top 5 · Week ${weekNum}</div>
  ${cards.map(c => cardRowHtml(c)).join('')}
</div>

<div class="bottombar">
  <div class="bottombar-inner">
    <div class="bot-left">Pokémon TCG · Weekly</div>
    <div class="bot-right">card-index.app</div>
  </div>
</div>
</body></html>`
}

export default function ShareTopSearchedModal({
  cards,
  weekNum,
  year,
  dateStr,
  onClose,
}: {
  cards:    TopSearchedCard[]
  weekNum:  number
  year:     number
  dateStr:  string
  onClose:  () => void
}) {
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setGenerating(true)
    setPreviewUrl(null)
    try {
      const html2canvas = (await import('html2canvas')).default
      const wrap = document.createElement('div')
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:1080px;height:1350px;overflow:hidden;pointer-events:none;z-index:-1;'
      wrap.innerHTML = buildTopSearchedHtml(cards, weekNum, year, dateStr)
      document.body.appendChild(wrap)

      const imgs = Array.from(wrap.querySelectorAll('img'))
      await Promise.allSettled(imgs.map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r })
      ))

      const canvas = await html2canvas(wrap, {
        width: 1080, height: 1350, scale: 2,
        useCORS: true, allowTaint: false,
        backgroundColor: '#0a0a0c', logging: false,
      })
      document.body.removeChild(wrap)
      setPreviewUrl(canvas.toDataURL('image/png', 1.0))
    } catch (e) {
      console.error('ShareTopSearched generation failed:', e)
    } finally {
      setGenerating(false)
    }
  }, [cards, weekNum, year, dateStr])

  useEffect(() => { generate() }, [generate])

  function download() {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href     = previewUrl
    a.download = `cardindex-top-searched-week-${weekNum}-${year}.png`
    a.click()
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
      />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, pointerEvents: 'none',
      }}>
        <div style={{
          pointerEvents: 'auto',
          background: '#0e0e1c', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 24, width: '100%', maxWidth: 520,
          maxHeight: '92vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f8' }}>Share · Most Searched</div>
              <div style={{ fontSize: 11, color: '#55556a', marginTop: 3 }}>
                Week {weekNum} · {year} · Top {cards.length} cards
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, color: '#9898b8', fontSize: 20, cursor: 'pointer',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >×</button>
          </div>

          {/* Preview */}
          <div style={{
            borderRadius: 12, overflow: 'hidden',
            background: '#060610', border: '1px solid rgba(255,255,255,0.06)',
            minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {generating && (
              <div style={{ color: '#55556a', fontSize: 13, padding: 24, textAlign: 'center' }}>
                <div style={{ marginBottom: 8 }}>Generating…</div>
                <div style={{ fontSize: 11, color: '#33334a' }}>Rendering weekly report</div>
              </div>
            )}
            {!generating && previewUrl && (
              <img
                src={previewUrl}
                alt="Top searched preview"
                style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 460, objectFit: 'contain' }}
              />
            )}
          </div>

          {/* Download */}
          <button
            onClick={download}
            disabled={generating || !previewUrl}
            style={{
              padding: '14px 0', borderRadius: 12,
              background: generating || !previewUrl ? 'rgba(232,197,71,0.25)' : '#e8c547',
              border: 'none', color: '#08080f', fontSize: 14, fontWeight: 800, letterSpacing: 0.5,
              cursor: generating || !previewUrl ? 'default' : 'pointer',
            }}
          >
            {generating ? 'Generating…' : 'Download PNG (2160×2700)'}
          </button>
        </div>
      </div>
    </>
  )
}
