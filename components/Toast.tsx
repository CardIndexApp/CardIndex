'use client'
import { useEffect } from 'react'

interface ToastProps {
  message: string
  icon?: string
  visible: boolean
  onHide: () => void
}

export default function Toast({ message, icon = '✓', visible, onHide }: ToastProps) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onHide, 2500)
      return () => clearTimeout(t)
    }
  }, [visible, onHide])

  return (
    <div className={`toast-overlay ${visible ? 'toast-visible' : 'toast-hidden'}`}>
      <div className="toast-pill">
        <span className="toast-icon">{icon}</span>
        <span className="toast-msg">{message}</span>
      </div>
    </div>
  )
}
