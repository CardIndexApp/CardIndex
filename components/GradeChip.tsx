interface GradeChipProps {
  grade: string
  onClick?: () => void
  className?: string
}

export default function GradeChip({ grade, onClick, className = '' }: GradeChipProps) {
  return (
    <button
      onClick={onClick}
      className={`grade-chip ${onClick ? 'grade-chip-interactive' : ''} ${className}`}
    >
      {grade}
      {onClick && <span className="grade-chip-arrow">▾</span>}
    </button>
  )
}
