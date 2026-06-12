interface ChangeBadgeProps {
  pct: number | null | undefined
  className?: string
}

export default function ChangeBadge({ pct, className = '' }: ChangeBadgeProps) {
  if (pct == null) return <span className={`change-badge change-neutral ${className}`}>—</span>
  const up = pct >= 0
  return (
    <span className={`change-badge ${up ? 'change-up' : 'change-down'} ${className}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}
