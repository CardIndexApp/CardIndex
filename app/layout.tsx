import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import { CurrencyProvider } from '@/lib/currency'
import { ThemeProvider } from '@/lib/theme'
import InstallPrompt from '@/components/InstallPrompt'


export const viewport: Viewport = {
  themeColor: '#080810',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',  // fills iPhone notch / Dynamic Island
}

export const metadata: Metadata = {
  metadataBase: new URL('https://card-index.app'),
  title: {
    default: 'CardIndex — TCG Market Intelligence',
    template: 'CardIndex | %s',
  },
  description: 'Real-time price intelligence, CardIndex scores, and market analysis for trading card collectors and investors.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'CardIndex',
    statusBarStyle: 'black-translucent',
  },
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
    <html lang="en">
      <head>
        {/* Prevent flash of wrong theme: apply stored theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ci_theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark')}catch(e){}})()`,
          }}
        />
        {/* Google Analytics 4 — loaded via next/script for reliable firing */}
      </head>
      <body>
        <ThemeProvider>
          <CurrencyProvider>
            {children}
            <InstallPrompt />
          </CurrencyProvider>
        </ThemeProvider>
        {/* Google Analytics 4 */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-BRGK35HQFB" strategy="afterInteractive" />
        <Script id="ga4-init" strategy="afterInteractive">{`
          window.dataLayer=window.dataLayer||[];
          function gtag(){dataLayer.push(arguments)}
          gtag('js',new Date());
          gtag('config','G-BRGK35HQFB');
        `}</Script>
      </body>
    </html>
  )
}
