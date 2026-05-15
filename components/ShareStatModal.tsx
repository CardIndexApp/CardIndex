'use client'

import { useState, useCallback, useEffect } from 'react'

export interface StatCardConfig {
  statDisplay:  string   // pre-formatted number e.g. "1.2M+", "$23K", "84K"
  label:        string   // "Total Searches"
  sublabel:     string   // full descriptive sentence
  descriptor:   string   // "Live data · Updated daily"
  accentColor:  string   // '#d7aa3c' | '#3cb87a' | '#6b8cff'
  glowRgba:     string   // e.g. 'rgba(215,170,60,0.08)'
  filename:     string   // download filename without extension
}

function buildStatHtml(cfg: StatCardConfig): string {
  const { statDisplay, label, sublabel, descriptor, accentColor, glowRgba } = cfg
  const labelHtml = label.replace('\n', '<br>')

  return `
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  .sw-wrap {
    width:1080px; height:1350px;
    background:#0a0a0c;
    font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;
    overflow:hidden;
    position:relative;
  }
  .grid {
    position:absolute; inset:0; pointer-events:none;
    background-image:
      linear-gradient(rgba(255,255,255,0.028) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,0.028) 1px,transparent 1px);
    background-size:80px 80px;
  }
  .glow {
    position:absolute; left:calc(50% - 500px); top:calc(50% - 500px);
    width:1000px; height:1000px;
    background:radial-gradient(ellipse,${glowRgba} 0%,transparent 55%);
    pointer-events:none;
  }
  .corner { position:absolute; width:48px; height:48px; }
  .corner.tl { top:44px; left:44px; border-top:1px solid rgba(255,255,255,0.08); border-left:1px solid rgba(255,255,255,0.08); }
  .corner.tr { top:44px; right:44px; border-top:1px solid rgba(255,255,255,0.08); border-right:1px solid rgba(255,255,255,0.08); }
  .corner.bl { bottom:44px; left:44px; border-bottom:1px solid rgba(255,255,255,0.08); border-left:1px solid rgba(255,255,255,0.08); }
  .corner.br { bottom:44px; right:44px; border-bottom:1px solid rgba(255,255,255,0.08); border-right:1px solid rgba(255,255,255,0.08); }
  .topbar {
    position:absolute; top:0; left:0; right:0; height:80px; z-index:10;
    display:flex; align-items:center; justify-content:center;
    border-bottom:1px solid rgba(255,255,255,0.07);
  }
  .logo-wordmark { display:flex; align-items:center; }
  .logo-wordmark span.card { font-size:28px; font-weight:700; color:#fff; letter-spacing:-0.5px; }
  .logo-wordmark span.idx  { font-size:28px; font-weight:700; color:#d7aa3c; letter-spacing:-0.5px; }
  .content {
    position:absolute; top:300px; left:0; right:0; z-index:2;
    display:flex; flex-direction:column;
    align-items:center; text-align:center;
    padding:0 80px;
  }
  .eyebrow {
    font-size:15px; font-weight:600;
    color:rgba(255,255,255,0.28);
    letter-spacing:0.18em; text-transform:uppercase;
    margin-bottom:48px;
    display:flex; align-items:center; gap:12px;
  }
  .eyebrow::before, .eyebrow::after {
    content:""; display:block; width:32px; height:1px;
    background:rgba(255,255,255,0.15);
  }
  .stat-number {
    font-size:185px; font-weight:700;
    color:${accentColor};
    letter-spacing:-8px; line-height:1;
    margin-bottom:24px;
  }
  .stat-label {
    font-size:45px; font-weight:700;
    color:#fff; letter-spacing:-0.8px;
    line-height:1.1; margin-bottom:20px;
  }
  .stat-sublabel {
    font-size:25px; font-weight:400;
    color:rgba(255,255,255,0.35);
    line-height:1.5; max-width:520px;
    margin-bottom:64px;
  }
  .descriptor {
    display:inline-flex; align-items:center; gap:10px;
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:50px; padding:14px 28px;
  }
  .desc-dot { width:7px; height:7px; border-radius:50%; background:${accentColor}; flex-shrink:0; }
  .desc-text { font-size:16px; font-weight:500; color:rgba(255,255,255,0.45); letter-spacing:0.02em; }
  .url-pill {
    display:inline-flex; align-items:center; gap:10px;
    background:rgba(215,170,60,0.08);
    border:1.5px solid rgba(215,170,60,0.3);
    border-radius:50px; padding:12px 28px;
    margin-top:40px;
  }
  .url-dot { width:7px; height:7px; border-radius:50%; background:#d7aa3c; flex-shrink:0; }
  .url-text { font-size:18px; font-weight:600; color:rgba(255,255,255,0.85); letter-spacing:-0.2px; }
</style>
<div class="sw-wrap">
  <div class="grid"></div>
  <div class="glow"></div>
  <div class="corner tl"></div><div class="corner tr"></div>
  <div class="corner bl"></div><div class="corner br"></div>
  <div class="topbar">
    <div class="logo-wordmark"><span class="card">Card</span><span class="idx">Index</span></div>
  </div>
  <div class="content">
    <div class="eyebrow">By the numbers</div>
    <div class="stat-number">${statDisplay}</div>
    <div class="stat-label">${labelHtml}</div>
    <div class="stat-sublabel">${sublabel}</div>
    <div class="descriptor">
      <div class="desc-dot"></div>
      <div class="desc-text">${descriptor}</div>
    </div>
    <div class="url-pill">
      <div class="url-dot"></div>
      <div class="url-text">card-index.app</div>
    </div>
  </div>
</div>`
}

export default function ShareStatModal({
  config,
  onClose,
}: {
  config:  StatCardConfig
  onClose: () => void
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
      wrap.innerHTML = buildStatHtml(config)
      document.body.appendChild(wrap)

      const canvas = await html2canvas(wrap, {
        width: 1080, height: 1350, scale: 2,
        useCORS: true, allowTaint: false,
        backgroundColor: '#0a0a0c', logging: false,
      })
      document.body.removeChild(wrap)
      setPreviewUrl(canvas.toDataURL('image/png', 1.0))
    } catch (e) {
      console.error('ShareStat generation failed:', e)
    } finally {
      setGenerating(false)
    }
  }, [config])

  useEffect(() => { generate() }, [generate])

  function download() {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href     = previewUrl
    a.download = `${config.filename}.png`
    a.click()
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}>
        <div style={{
          pointerEvents: 'auto',
          background: '#0e0e1c', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 24, width: '100%', maxWidth: 520,
          maxHeight: '92vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f8' }}>{config.label}</div>
              <div style={{ fontSize: 11, color: '#55556a', marginTop: 3 }}>{config.statDisplay} · Stat card · 1080×1350</div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#9898b8', fontSize: 20, cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
          </div>

          <div style={{ borderRadius: 12, overflow: 'hidden', background: '#060610', border: '1px solid rgba(255,255,255,0.06)', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {generating && (
              <div style={{ color: '#55556a', fontSize: 13, padding: 24, textAlign: 'center' }}>
                <div style={{ marginBottom: 8 }}>Generating…</div>
                <div style={{ fontSize: 11, color: '#33334a' }}>Rendering stat card</div>
              </div>
            )}
            {!generating && previewUrl && (
              <img src={previewUrl} alt="Stat card preview" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 460, objectFit: 'contain' }} />
            )}
          </div>

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
