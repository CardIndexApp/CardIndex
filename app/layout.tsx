import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { CurrencyProvider } from '@/lib/currency'
import { ThemeProvider } from '@/lib/theme'
import InstallPrompt from '@/components/InstallPrompt'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://card-index.app'),
  title: {
    default: 'CardIndex — TCG Market Intelligence',
    template: 'CardIndex | %s',
  },
  description: 'Real-time price intelligence, CardIndex scores, and market analysis for trading card collectors and investors.',
  openGraph: {
    siteName: 'CardIndex',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@cardindexapp',
  },
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
    <html lang="en" className={inter.variable}>
      <head>
        {/* Prevent flash of wrong theme: apply stored theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ci_theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <CurrencyProvider>
            {children}
            <InstallPrompt />
          </CurrencyProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
