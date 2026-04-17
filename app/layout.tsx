import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CardIndex — The market index for trading cards',
  description: 'Real-time price intelligence, CardIndex scores, and market analysis for trading card collectors and investors.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
