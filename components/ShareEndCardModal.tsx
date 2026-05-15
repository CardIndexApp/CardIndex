'use client'

import { useState, useCallback, useEffect } from 'react'

const END_CARD_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:1080px; height:1350px;
    background:#0a0a0c;
    font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;
    overflow:hidden;
    display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    position:relative;
  }
  .grid {
    position:absolute; inset:0; pointer-events:none;
    background-image:
      linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px);
    background-size:80px 80px;
  }
  .glow {
    position:absolute; left:50%; top:52%;
    transform:translate(-50%,-50%);
    width:900px; height:700px;
    background:radial-gradient(ellipse,rgba(215,170,60,0.07) 0%,transparent 60%);
    pointer-events:none;
  }
  .content {
    position:relative; z-index:2;
    display:flex; flex-direction:column;
    align-items:center;
    text-align:center;
    padding:0 80px;
    gap:0;
  }
  .logo-row {
    display:flex; align-items:center; gap:14px;
    margin-bottom:64px;
  }
  .logo-word { display:flex; align-items:center; }
  .logo-word span.card { font-size:48px; font-weight:700; color:#fff; letter-spacing:-1px; }
  .logo-word span.idx  { font-size:48px; font-weight:700; color:#d7aa3c; letter-spacing:-1px; }
  .headline {
    font-size:96px; font-weight:700;
    line-height:0.92; letter-spacing:-4px;
    color:#fff;
    margin-bottom:36px;
  }
  .headline em { color:#d7aa3c; font-style:normal; }
  .subline {
    font-size:22px; font-weight:400;
    color:rgba(255,255,255,0.42);
    line-height:1.55;
    max-width:580px;
    margin-bottom:64px;
    letter-spacing:-0.2px;
  }
  .url {
    display:inline-flex; align-items:center; gap:12px;
    background:rgba(215,170,60,0.08);
    border:1.5px solid rgba(215,170,60,0.3);
    border-radius:50px;
    padding:18px 36px;
    margin-top:8px;
  }
  .url-dot { width:9px; height:9px; border-radius:50%; background:#d7aa3c; flex-shrink:0; }
  .url-text {
    font-size:26px; font-weight:600;
    color:rgba(255,255,255,0.85);
    letter-spacing:-0.3px;
  }
  .url-text span { color:#fff; }
</style></head><body>
<div class="grid"></div>
<div class="glow"></div>
<div class="content">
  <div class="logo-row">
    <div class="logo-word"><span class="card">Card</span><span class="idx">Index</span></div>
  </div>
  <div class="headline">
    Stop guessing.<br>Start investing<br>in <em>trading<br>cards.</em>
  </div>
  <div class="subline">
    Instantly see if a card is a good buy,<br>
    hold, or sell — powered by real market data.
  </div>
  <div class="url">
    <div class="url-dot"></div>
    <div class="url-text"><span>card-index</span>.app</div>
  </div>
</div>
</body></html>`

export default function ShareEndCardModal({ onClose }: { onClose: () => void }) {
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setGenerating(true)
    setPreviewUrl(null)
    try {
      const html2canvas = (await import('html2canvas')).default
      const wrap = document.createElement('div')
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:1080px;height:1350px;overflow:hidden;pointer-events:none;z-index:-1;'
      wrap.innerHTML = END_CARD_HTML
      document.body.appendChild(wrap)

      const canvas = await html2canvas(wrap, {
        width: 1080, height: 1350, scale: 2,
        useCORS: true, allowTaint: false,
        backgroundColor: '#0a0a0c', logging: false,
      })
      document.body.removeChild(wrap)
      setPreviewUrl(canvas.toDataURL('image/png', 1.0))
    } catch (e) {
      console.error('ShareEndCard generation failed:', e)
    } finally {
      setGenerating(false)
    }
  }, [])

  useEffect(() => { generate() }, [generate])

  function download() {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href     = previewUrl
    a.download = 'cardindex-end-card.png'
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
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f8' }}>End Card</div>
              <div style={{ fontSize: 11, color: '#55556a', marginTop: 3 }}>Static brand end card · 1080×1350</div>
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
                <div style={{ fontSize: 11, color: '#33334a' }}>Rendering end card</div>
              </div>
            )}
            {!generating && previewUrl && (
              <img
                src={previewUrl}
                alt="End card preview"
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
