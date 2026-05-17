'use client'

import { useState, useCallback, useEffect } from 'react'

const BRAND_HTML = `
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  .brand-wrap {
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
    background:radial-gradient(ellipse,rgba(215,170,60,0.07) 0%,transparent 55%);
    pointer-events:none;
  }
  .corner { position:absolute; width:48px; height:48px; }
  .corner.tl { top:44px; left:44px; border-top:1px solid rgba(255,255,255,0.08); border-left:1px solid rgba(255,255,255,0.08); }
  .corner.tr { top:44px; right:44px; border-top:1px solid rgba(255,255,255,0.08); border-right:1px solid rgba(255,255,255,0.08); }
  .corner.bl { bottom:44px; left:44px; border-bottom:1px solid rgba(255,255,255,0.08); border-left:1px solid rgba(255,255,255,0.08); }
  .corner.br { bottom:44px; right:44px; border-bottom:1px solid rgba(255,255,255,0.08); border-right:1px solid rgba(255,255,255,0.08); }
  .wordmark {
    position:absolute; top:0; left:0; right:0; bottom:0;
    display:flex; align-items:center; justify-content:center;
    z-index:2;
  }
  .wordmark-inner { display:flex; align-items:baseline; }
  .wordmark-inner span.card  { font-size:96px; font-weight:700; color:#ffffff; letter-spacing:-3px; }
  .wordmark-inner span.idx   { font-size:96px; font-weight:700; color:#d7aa3c; letter-spacing:-3px; }
</style>
<div class="brand-wrap">
  <div class="grid"></div>
  <div class="glow"></div>
  <div class="corner tl"></div><div class="corner tr"></div>
  <div class="corner bl"></div><div class="corner br"></div>
  <div class="wordmark">
    <div class="wordmark-inner">
      <span class="card">Card</span><span class="idx">Index</span>
    </div>
  </div>
</div>`

export default function ShareBrandModal({ onClose }: { onClose: () => void }) {
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setGenerating(true)
    setPreviewUrl(null)
    try {
      const html2canvas = (await import('html2canvas')).default
      const wrap = document.createElement('div')
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:1080px;height:1350px;overflow:hidden;pointer-events:none;z-index:-1;'
      wrap.innerHTML = BRAND_HTML
      document.body.appendChild(wrap)

      const canvas = await html2canvas(wrap, {
        width: 1080, height: 1350, scale: 2,
        useCORS: true, allowTaint: false,
        backgroundColor: '#0a0a0c', logging: false,
      })
      document.body.removeChild(wrap)
      setPreviewUrl(canvas.toDataURL('image/png', 1.0))
    } catch (e) {
      console.error('ShareBrand generation failed:', e)
    } finally {
      setGenerating(false)
    }
  }, [])

  useEffect(() => { generate() }, [generate])

  function download() {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href     = previewUrl
    a.download = 'cardindex-brand.png'
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f8' }}>Brand Lockup</div>
              <div style={{ fontSize: 11, color: '#55556a', marginTop: 3 }}>Wordmark on background · 1080×1350</div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#9898b8', fontSize: 20, cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >×</button>
          </div>

          <div style={{ borderRadius: 12, overflow: 'hidden', background: '#060610', border: '1px solid rgba(255,255,255,0.06)', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {generating && (
              <div style={{ color: '#55556a', fontSize: 13, padding: 24, textAlign: 'center' }}>
                <div style={{ marginBottom: 8 }}>Generating…</div>
                <div style={{ fontSize: 11, color: '#33334a' }}>Rendering brand lockup</div>
              </div>
            )}
            {!generating && previewUrl && (
              <img src={previewUrl} alt="Brand lockup preview" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 460, objectFit: 'contain' }} />
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
