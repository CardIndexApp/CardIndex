import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CardIndex — The market index for trading cards',
  description: 'Real-time price intelligence, CardIndex scores, and market analysis for trading card collectors and investors.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(232,197,71,0.08)', borderBottom: '1px solid rgba(232,197,71,0.15)', backdropFilter: 'blur(8px)' }}>
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(232,197,71,0.7)', letterSpacing: 1, fontFamily: 'Helvetica, Arial, sans-serif' }}>
            DATA SHOWN IS FOR DISPLAY PURPOSES ONLY — CARDINDEX BETA
          </p>
        </div>
        {children}
      </body>
    </html>
  )
}
