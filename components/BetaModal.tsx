'use client'
// BetaModal now delegates to AuthModal — kept for backward compatibility
import AuthModal from './AuthModal'

export default function BetaModal({ onClose }: { onClose: () => void }) {
  return <AuthModal onClose={onClose} defaultTab="signup" />
}
