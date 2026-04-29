import type { Metadata } from 'next'
import './globals.css'
import { CurrencyProvider } from '@/lib/currency'
import { ThemeProvider } from '@/lib/theme'
import InstallPrompt from '@/components/InstallPrompt'

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
