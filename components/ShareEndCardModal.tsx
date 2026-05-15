'use client'

import { useState, useCallback, useEffect } from 'react'

// NOTE: innerHTML strips <html>/<head>/<body> tags, so body-level flex centering is lost.
// Fix: wrap everything in an explicit 1080×1350 flex-center div instead of relying on <body>.
const LOGO_B64 = 'data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAC0ALQDASIAAhEBAxEB/8QAHQABAAEFAQEBAAAAAAAAAAAAAAgEBQYHCQMCAf/EAE4QAAAEAwEHDgsFBgcBAAAAAAABAgMEBQYRBwgSITF0shYYMzU2QVFWYXKBlLHSEyI3VXWSlaGz0dMUMlJxkSNCU2KCkxUXJlRjc8Gi/8QAGwEAAQUBAQAAAAAAAAAAAAAAAAMEBQYHAQL/xAA8EQACAQEDBA4LAAIDAAAAAAAAAQIDBAURBiExURUWMjM0UlNhcYGRscLREhMUNkFCgqHB4fAiNUNysv/aAAwDAQACEQMRAD8AhkPpttTisFBWmP1pBuLJCcpi5NNpaRgpL8z4R7hD0gPFqEQnGs8I/cPdKEJ+6lJdA+gDhRS0HAAu1M03PamjvsUhlUVMH/3iaRaSC4VKyJLlMyG0pTe4VxFMk5GxsngDMtjW8pay/PBSafeGdqvKyWR4Vqii9Xx7NIpToVKm5WJpcBvfWzVPxhk/qud0NbNU/GGT+q53Qz2w3byq+/kK+xV+KaIAb31s1T8YZP6rndDWzVPxhk/qud0G2G7eVX38g9ir8U0QA3vrZqn4wyf1XO6GtmqfjDJ/Vc7oNsN28qvv5B7FX4pogBvfWzVPxhk/qud0NbNU/GGT+q53QbYbt5VffyD2KvxTRADe+tmqfjDJ/Vc7oa2ap+MMn9Vzug2w3byq+/kHsVfimiAG9XL2aqiQZt1BJVK3iV4Ui/XBMYbV9xmv6aYXEvykphCoK1T0AvwxEXCabCWRcuDYFqN9WCtL0YVVj2d55lZa0Vi4mvDIjylaPNbDS8qCI+EsQ9AEm0mNygfhVI8ZHjJ95CmF4FHGsERG6gucX/oRnTwzo7iUYAAROlfAN4LeGeVXYKkfLacFtKeAh9B3FYLA4Bndxi51G3QajOGw1w8rhbFx0SRY0keRCd7CVYdnARGe9YeCCcdwimGqWuZyqF8GSYqLaKMi1WYzccIjsPmpwU/0iCyivSV32XGnu5Zlza31d47sVnVapn0IySm5FI6TkaJdKIRiAgWEmpVmK3FjUtR4zPhMzGE1FdyufSeJVDomERM3EHYr7CzhpI+RSjJJ9BmNU3zl0SMmM+fo2VxCmpbBKJMYaDs+0PZTSf8AKnJZ+Ij4CGjxAXTkqrVTVptsnjLPh8c/xb5x3aLw9XL0KS0ErtcbQ3m6oOrtfVDXG0N5uqDq7X1RFEBM7ULt1PtG2yVfmJXa42hvN1QdXa+qGuNobzdUHV2vqiKIA2oXbqfaGyVfmJXa42hvN1QdXa+qGuNobzdUHV2vqiKIA2oXbqfaGyVfmJXa42hvN1QdXa+qGuNobzdUHV2vqiKIA2oXbqfaGyVfmJYs3xVBuOElcJPWiP8AeXDN2F+jhmNhUdWVM1dDKep+bMRhoK1xrGl1vnIVYoi5bLBAwV8hm8ykU2h5rKYtyFjIdWE24g/cfCR5DI8Rhra8jLLOm/UScZc+ddYpTvOon/msUSbu9XHIKpIGIqGmoVENPWkm44y0mxMaRYzKzec4D38h7xlEtSVJUaVEaVEdhkZYyMT0uW1azWtFwU9bQlt5ZG3EtJyNupxKIuQ8RlyGQi9fP0w1Tt0x6KhGybhZs0UYkiLElwzMnC9YsL+oN8mLxrwrSu+06Y44Y82leR7t9CLiq0PiarAyIysPIYALuRRan0eDdUjgyAK2JZ8I4SuQA2dN45juJUAABycPptOG4lPCZEOjLaEttpbQkkpSREki3iIc6IfZ2+cXaOjIoOXH/B9XhJi6vn6vyc/qmfciakmcS6o1OOxjq1me+ZrMzFuFZO9uo7OHNIxRi/UlhBJaiHlpYAAHs4AAAAAAAAAAAAAAAAAAAASavOH3FU3P4Y1H4NuMbWkuA1IsPRIWm/VaR/pV4i8c/taTPhL9iZf+/qLjebbS1FnDOioUN+tsFKc6L7GRncc2VGbW/wDwTT4B/ayNoAA0EhgAAAAAAAD0h9nb5xdo6MjnND7O3zi7R0ZFBy400Pq8JMXV8/V+TnzO9uo7OHNIxRisne3UdnDmkYoxfqe4RDvSAAB7OAAAAAAAAAAAAABltIXN60quBOOkcjdfhLTST63ENIUZZcE1mWF0Wi+f5G3TPMDXXmO+GNS87HSk4TqxTXwcl5isaFWSxUX2GtgGUVjc/q+kWG4ifyV2Fh3FYKXkrQ43bwGpBmRHyHYMXDmjWp1o+nTkpLWnijxKMovCSwJK3m20tRZwzoqFDfrbBSnOi+xkV15ttLUWcM6KhQ362wUpzovsZFAXvR1+AmHwD+1kbQABoJDAAAAAAAAHpD7O3zi7R0ZHOaH2dvnF2joyKDlxpofV4SYur5+r8nPmd7dR2cOaRijFZO9uo7OHNIxRi/U9wiHekAAD2cAAAAAAAAAAAAJ90VCsQVHyaFhm0tstQLKUpIsniELuLdTG5qV5mzoELiMFrtupJvWy3Q3KMXutwrEXcvqZqIbS4hMriHSIyyKQ2a0n0KSR9AgqJ4XT/JpVHoeL+CsQPGh5EN+z1VzruIa9d3HoJK3m20tRZwzoqFDfrbBSnOi+xkV15ttLUWcM6KhQ362wUpzovsZDJe9HX4BV8A/tZG0AAaCQwAAAAAAAB6Q+zt84u0dGRzmh9nb5xdo6Mig5caaH1eEmLq+fq/Jz5ne3UdnDmkYoxWTvbqOzhzSMUYv1PcIh3pAAA9nAAAAAA92ISKfSamIZ51JYjNDZqL3D0/w2Y/7CK/sq+Q8ucVpZ3BlIA+lpUhRpWk0qI7DIysMh8j0cOgNMbmpXmbOgQuIt1MbmpXmbOgQuIwWtvkullujuUY7dP8mlUeh4v4KxA8Twun+TSqPQ8X8FYgeNDyI3ir0ruIa9d3HoJK3m20tRZwzoqFDfrbBSnOi+xkV15ttLUWcM6KhQ362wUpzovsZDJe9HX4BV8A/tZG0AAaCQwAAAAAAAB6Q+zt84u0dGRzmh9nb5xdo6Mig5caaH1eEmLq+fq/Jz5ne3UdnDmkYoxWTvbqOzhzSMUYv1PcIh3pAAA9nALrSEvZmtVSuWxFvgYmLbbcsOw8E1Fb7hahkNzbd/Is+a0iCNok40ZtaUn3HqCxkkSrg4aHg4VuFhGG2GGk4KG202JSXARD2ABkzbbxZYjUt8dJoFVPws8SyhEa3EpZU4krDWhSVHYfDYZFZ0jQ4kVfFbgG8+b0ViOo0HJycpWJYvQ2Q1tSVXMdAaY3NSvM2dAhcRbqY3NSvM2dAhcRkdbfJdLLHHcox26f5NKo9DxfwViB4nhdP8mlUeh4v4KxA8aHkRvFXpXcQ167uPQSVvNtpaizhnRUKG/W2ClOdF9jIrrzbaWos4Z0VChv1tgpTnRfYyGS96OvwCr4B/ayNoAA0EhgAAAAAAAD0h9nb5xdo6MjnND7O3zi7R0ZFBy400Pq8JMXV8/V+TnzO9uo7OHNIxRisne3UdnDmkY+pJLImbzFuBhSLDXjNSsiSLKZi+xko01J6MCHaxeCKEBsRFzdrBLDmyzVv2MFZ2j9Vc3ZsPBmzhHvWsF8wz2Us3G+zFfUVNRroZDc23fyLPmtIhb6hlETJJiqDicFR2YSFpyLSe+Lhc23fyLPmtIgvaJxnZ5yi8zT7jzBNTSesliAAMoLCa3vitwDefN6KxHUSKvitwDefN6KxHUaBk1wLrZDW7fToDTG5qV5mzoELiLdTG5qV5mzoELiMlrb5LpZYo7lGO3T/JpVHoeL+CsQPE8Lp/k0qj0PF/BWIHjQ8iN4q9K7iGvXdx6CSt5ttLUWcM6KhQ362wUpzovsZFdebbS1FnDOioUN+tsFKc6L7GQyXvR1+AVfAP7WRtAAGgkMAAAAAAAAekPs7fOLtHRkc5ofZ2+cXaOjIoOXGmh9XhJi6vn6vyc+Z3t1HZw5pGMluS7o4jNFaaBjU726js4c0jGS3Jd0cRmatNAudr4JLoIunviNogACpEia2uvbZQJ/8ACrtFnubbv5FnzWkQvF17bGB/6Vdos9zbd/Is+a0iFnof69/9X+RjLfutEsQABmZOmt74rcA3nzeisR1Eir4rcA3nzeisR1GgZNcC62Q1u306A0xualeZs6BC4i3UxualeZs6BC4jJa2+S6WWKO5Rjt0/yaVR6Hi/grEDxPC6f5NKo9DxfwViB40PIjeKvSu4hr13cegkrebbS1FnDOioUN+tsFKc6L7GRXXm20tRZwzoqFDfrbBSnOi+xkMl70dfgFXwD+1kbQABoJDAAAAAjtIjAecKvDYSe+RWGPQcTxWIAdDKYmbU6pyWzdlRKbjYVt8rP5kkdnvHPMSavTroDD0tOhZm+SIlg1OS5Sz2RBnapsuUjtMi4DP8IqWV9hnaLLGtBYuDePQ9PciSu2qoVHF/E03dbkD9N3RJzLXmzSg4lbzBmWJTSzNSDLhxHZ+ZGPC53M4aWVCTkWsm2nmjZNZ5EmZkZGfJis6RLO6/c1ll0CWIJxwoOawyTKFiyTbYX4FlvpP9SPGW+RxlqK5BdBksSppVPREc2R+K9A/tkrLhIi8YukiDi6r7stvsipVpqM8MHi8MedCdostSjU9KKxRsJDrS0kpDiFJPIZKIyMFONpIzU4giLKZmNS6gK54nVB7Od7oagK54nVB7Od7oU9gs/Lr7eZz10+Ie10yaQsxnTTcI4l1EO3gKWk7SNRnadh7+8LPSkxblNTS2ZupNTcLFNurIsppJRGdnLYLlqArnidUHs53uhqArnidUHs53uiWhUssKPqvWLDDDShu1UcvSwJQSybSyZwbcZAR0PEMOFalaFkf68B8hip8Mz/Fb9YhFbUBXPE6oPZzvdDUBXPE6oPZzvdFXdwWXHNaF9vMfq2VOJ/dhsy+IqOWPSaGkELEtREWcQTzpNqJRNJSlRWHZkMzPJyfkNHDJdQFc8Tqg9nO90NQFc8Tqg9nO90WK71ZbFRVKNRPnxQyrOpVn6TiS6uT1hJKloyWuwccwUSzDNtRMObhE40tKSI7Sy2WliPfIZf8AaGP4zfrEILagK54nVB7Od7oagK54nVB7Od7oqdfJWyVKkpQtKSb0Zn9/SRIwvCoopOH92Eqbu1YSWRXPZvBPxzC46YQbkJDwyVkbijcSaTVYWQiIzO08WKzKZCGIyhm53XjzhIRR89Iz/HAuJL9TIiG0LmFwCaRMczMK2JEHBoMlfYW3CU69yKUnElP5GZ72LKJew7H3DZpKVZSbz/DF8ySbG1b11smsI4GeXqcgflNztyZRTZoXNYk3myMrD8EkiSk+kyUf5GQ17fnTRp+pJDJ0KI1wkK6+si3vCqSREf8Aa94kXPprKKVpt+ZR7jcHLoFnIkiIiSRWJQkuE8RERcggpX1SxdXVdMKgjCwVxTtqG7bSbbLEhHQkiLlyiFyehUvG86l4SWCWPa8yXUh1bHGjQVFaSxAADQSGPlaySdhmAoY1wzfMkniIrACLq4PA7gfsC7gLwFH4qvcYrxZxWQsVYRIdP8lDlOeGZgysHpCvvwsS3EwzzjL7SyW242o0qQojtIyMshkPMjIytI7SALNYgSPuYXxTSIZqW10w6biSwSmUOi3CLhcQW/yptt4N8bnlN0Khpoyl2CqyTrI8eCuKS2vpSoyUX6CBICrW3JGx2ibnTbg3q0dg/pXjVgsHnOguqmmOMcn6638w1U0xxjk/XW/mOfQBhtJpcs+z9i2ykuKdBdVNMcY5P11v5hqppjjHJ+ut/Mc+gBtJpcs+z9hspLinQXVTTHGOT9db+YaqaY4xyfrrfzHPoAbSaXLPs/YbKS4p0F1U0xxjk/XW/mGqmmOMcn6638xz6AG0mlyz7P2GykuKdBdVNMcY5P11v5hqppjjHJ+ut/Mc+gBtJpcs+z9hspLinQNyrKVbQa3KmkqEllNUc0RF/wDQw6r7t9ASBhZMTQpxFEXisQH7QjPlc+4RdJnyGIWgFqORdmjLGpUclqzLzPEr0qNZlgZxdVumT+6BHpOOMoSXMqM4eBaUZoQf4lH+8qzfPoIrTGDgAttns9Kz01TpRwivgR85ym/Sk8WB5xDpNNmrf3iB55DReMePeIsotzzqnV4SuguAepzwzHk+TMzO08pgPwA2OgAAAH226439xRkXBvCth31ufeJPQABWm3icZUFkAADg4AAAAAAAAAAAAAAAAAAAAAAAAfLijSVpChdinTM0kZJLkIACVRtI6jwMzM7TO0x+AAbnQAAAD//Z'

const END_CARD_HTML = `
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  .ec-wrap {
    width:1080px; height:1350px;
    background:#0a0a0c;
    font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;
    overflow:hidden;
    display:flex; align-items:center; justify-content:center;
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
  }
  .logo-row { display:flex; align-items:center; gap:14px; margin-bottom:64px; }
  .logo-icon { width:52px; height:52px; flex-shrink:0; }
  .logo-icon img { width:100%; height:100%; object-fit:contain; }
  .logo-word { display:flex; align-items:center; }
  .logo-word span.card { font-size:38px; font-weight:700; color:#fff; letter-spacing:-1px; }
  .logo-word span.idx  { font-size:38px; font-weight:700; color:#d7aa3c; letter-spacing:-1px; }
  .headline {
    font-size:96px; font-weight:700;
    line-height:0.92; letter-spacing:-4px;
    color:#fff; margin-bottom:36px;
  }
  .headline em { color:#d7aa3c; font-style:normal; }
  .subline {
    font-size:22px; font-weight:400;
    color:rgba(255,255,255,0.42);
    line-height:1.55; max-width:580px;
    margin-bottom:64px; letter-spacing:-0.2px;
  }
  .url {
    display:inline-flex; align-items:center; gap:12px;
    background:rgba(215,170,60,0.08);
    border:1.5px solid rgba(215,170,60,0.3);
    border-radius:50px; padding:18px 36px; margin-top:8px;
  }
  .url-dot { width:9px; height:9px; border-radius:50%; background:#d7aa3c; flex-shrink:0; }
  .url-text { font-size:26px; font-weight:600; color:rgba(255,255,255,0.85); letter-spacing:-0.3px; }
  .url-text span { color:#fff; }
</style>
<div class="ec-wrap">
  <div class="grid"></div>
  <div class="glow"></div>
  <div class="content">
    <div class="logo-row">
      <div class="logo-icon"><img src="${LOGO_B64}" alt=""></div>
      <div class="logo-word"><span class="card">Card</span><span class="idx">Index</span></div>
    </div>
    <div class="headline">Stop guessing.<br>Start investing<br>in <em>trading<br>cards.</em></div>
    <div class="subline">Instantly see if a card is a good buy,<br>hold, or sell — powered by real market data.</div>
    <div class="url">
      <div class="url-dot"></div>
      <div class="url-text"><span>card-index</span>.app</div>
    </div>
  </div>
</div>`

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
