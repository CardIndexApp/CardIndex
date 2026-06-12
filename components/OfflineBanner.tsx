'use client'
import { useEffect, useState } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const onOffline = () => setOffline(true)
    const onOnline  = () => setOffline(false)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online',  onOnline)
    setOffline(!navigator.onLine)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online',  onOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="offline-banner">
      <span className="offline-dot" />
      <span>No internet connection</span>
    </div>
  )
}
