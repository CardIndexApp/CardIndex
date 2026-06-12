'use client'
import { ReactNode } from 'react'

interface GoldButtonProps {
  label: string
  onClick?: () => void
  loading?: boolean
  icon?: ReactNode
  disabled?: boolean
  className?: string
}

export default function GoldButton({ label, onClick, loading, icon, disabled, className = '' }: GoldButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`gold-btn ${loading ? 'gold-btn-loading' : ''} ${className}`}
    >
      {loading ? (
        <span className="gold-btn-spinner" />
      ) : (
        <>
          {icon && <span className="gold-btn-icon">{icon}</span>}
          <span>{label}</span>
        </>
      )}
    </button>
  )
}
