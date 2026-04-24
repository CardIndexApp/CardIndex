import type { Metadata } from 'next'
import './globals.css'
import { CurrencyProvider } from '@/lib/currency'

export const metadata: Metadata = {
  title: 'CardIndex — TCG Market Intelligence',
  description: 'Real-time price intelligence, CardIndex scores, and market analysis for trading card collectors and investors.',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
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
