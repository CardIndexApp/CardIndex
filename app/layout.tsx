import type { Metadata } from 'next'
import './globals.css'
import { CurrencyProvider } from '@/lib/currency'

export const metadata: Metadata = {
  title: 'CardIndex — TCG Market Intelligence',
  description: 'Real-time price intelligence, CardIndex scores, and market analysis for trading card collectors and investors.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CurrencyProvider>
          {children}
        </CurrencyProvider>
      </body>
    </html>
  )
}
