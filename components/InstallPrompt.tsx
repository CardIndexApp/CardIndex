'use client'
import { useEffect, useState } from 'react'

// How many days before the prompt re-appears after being dismissed
const DISMISS_DAYS   = 14
const DISMISS_KEY    = 'ci_install_dismissed'
// Permanent flag written when the app is confirmed installed
const INSTALLED_KEY  = 'ci_installed'

type Platform = 'ios' | 'android' | null

function getPlatform(): Platform {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  const isIOS     = /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream
  const isAndroid = /Android/.test(ua)
  if (isIOS) return 'ios'
  if (isAndroid) return 'android'
  return null
}

/** True when the page is already running as an installed PWA (launched from home screen) */
function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  )
}

/** True when we previously recorded a successful install via the appinstalled event */
function wasInstalledBefore(): boolean {
  try { return localStorage.getItem(INSTALLED_KEY) === '1' } catch { return false }
}

function markInstalled() {
  try { localStorage.setItem(INSTALLED_KEY, '1') } catch {}
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const ts = parseInt(raw, 10)
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

function saveDismissed() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
}

/**
 * Uses the Chrome/Android getInstalledRelatedApps API to check whether this
 * PWA is already installed, even if the user is visiting in a browser tab.
 * Returns false on platforms that don't support the API.
 */
async function isAlreadyInstalled(): Promise<boolean> {
  try {
    if (!('getInstalledRelatedApps' in navigator)) return false
    const apps: any[] = await (navigator as any).getInstalledRelatedApps()
    return apps.length > 0
  } catch {
    return false
  }
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [platform, setPlatform] = useState<Platform>(null)
  // Android deferred install event
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const p = getPlatform()
    if (!p) return              // desktop — skip
    if (isStandalone()) return  // running as installed PWA right now
    if (wasInstalledBefore()) return  // installed in a previous session
    if (isDismissed()) return   // user dismissed recently

    setPlatform(p)

    // Android: intercept the browser's native install prompt
    const installHandler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', installHandler)

    // Record install and hide prompt when the browser confirms it
    const installedHandler = () => {
      markInstalled()
      setInstalled(true)
      setVisible(false)
    }
    window.addEventListener('appinstalled', installedHandler)

    // For Android, also ask the API — if already installed, bail out silently
    isAlreadyInstalled().then(already => {
      if (already) {
        markInstalled()
        return
      }
      // Show after a short delay so it doesn't pop up on first paint
      const timer = setTimeout(() => setVisible(true), 3500)
      return () => clearTimeout(timer)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', installHandler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  if (!visible || installed) return null

  const dismiss = () => {
    saveDismissed()
    setVisible(false)
  }

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        markInstalled()
        setInstalled(true)
      }
      setDeferredPrompt(null)
    }
    dismiss()
  }

  return (
    <>
      {/* Backdrop — tap anywhere to dismiss on iOS */}
      {platform === 'ios' && (
        <div
          onClick={dismiss}
          style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'transparent' }}
        />
      )}

      <div style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
        zIndex: 200,
        borderRadius: 20,
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        boxShadow: '0 8px 40px var(--shadow-lg)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        animation: 'installSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* App icon */}
          <div style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: '#141428', border: '1px solid rgba(232,197,71,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img src="/icon-192.png" alt="CardIndex" style={{ width: 44, height: 44, objectFit: 'contain' }} />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
              Add to Home Screen
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.4 }}>
              {platform === 'ios'
                ? 'Install CardIndex for the fastest experience'
                : 'Install CardIndex as an app on your device'}
            </div>
          </div>

          {/* Close */}
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 8,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--ink3)', fontSize: 16, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Instructions / action */}
        {platform === 'ios' ? (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 14px', borderRadius: 12,
            background: 'var(--surface2)', border: '1px solid var(--border)',
          }}>
            {/* iOS Share icon */}
            <svg width="18" height="20" viewBox="0 0 18 20" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M9 1v12M5 5l4-4 4 4" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 10v8a1 1 0 001 1h14a1 1 0 001-1v-8" stroke="var(--ink3)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.55 }}>
              Tap the <strong style={{ color: 'var(--ink)' }}>Share</strong> button in your browser, then select{' '}
              <strong style={{ color: 'var(--ink)' }}>&ldquo;Add to Home Screen&rdquo;</strong>
            </div>
          </div>
        ) : (
          /* Android: native install button */
          <button
            onClick={handleInstall}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 12,
              background: 'var(--gold)', color: '#080810',
              border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1v8M5 6l3 3 3-3"/><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2"/>
            </svg>
            Install app
          </button>
        )}
      </div>

      <style>{`
        @keyframes installSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
