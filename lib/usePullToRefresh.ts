import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 72   // px pulled before triggering refresh
const MAX_PULL  = 100  // px max visual pull distance

export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pullY, setPullY] = useState(0)       // 0–MAX_PULL visual distance
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const pulling = useRef(false)

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      // Only activate when page is scrolled to the very top
      if (window.scrollY !== 0) return
      startY.current = e.touches[0].clientY
      pulling.current = false
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null || refreshing) return
      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0) { startY.current = null; return }

      // Only activate if we're still at the top
      if (window.scrollY !== 0) { startY.current = null; return }

      pulling.current = true
      // Ease the pull with square-root resistance
      const eased = Math.min(Math.sqrt(delta) * 6, MAX_PULL)
      setPullY(eased)
      // Prevent native scroll while pulling
      if (delta > 4) e.preventDefault()
    }

    async function onTouchEnd() {
      if (!pulling.current) return
      const current = pullY

      if (current >= THRESHOLD) {
        setRefreshing(true)
        setPullY(THRESHOLD * 0.6) // hold spinner in view
        try {
          await onRefresh()
        } finally {
          setRefreshing(false)
        }
      }

      setPullY(0)
      startY.current = null
      pulling.current = false
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove',  onTouchMove,  { passive: false })
    document.addEventListener('touchend',   onTouchEnd,   { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove',  onTouchMove)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  }, [onRefresh, refreshing, pullY])

  return { pullY, refreshing }
}
