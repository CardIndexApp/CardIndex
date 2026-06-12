import { ReactNode } from 'react'

interface SurfaceCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export default function SurfaceCard({ children, className = '', onClick }: SurfaceCardProps) {
  return (
    <div
      onClick={onClick}
      className={`surface-card ${onClick ? 'surface-card-clickable' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
