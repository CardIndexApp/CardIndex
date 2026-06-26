import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Bundle the Apple root certs into the App Store notifications function so
  // readFileSync works in production (Vercel only ships traced files).
  outputFileTracingIncludes: {
    '/api/apple/notifications': ['./lib/apple-certs/**'],
  },
  images: {
    // Allow next/image to optimise images served through our /api/img proxy.
    // Omitting `search` skips the query-string check (allows any ?url=... param).
    // search: '**' was incorrect — Next.js 16 does exact string comparison, not glob.
    localPatterns: [
      { pathname: '/api/img' },
      { pathname: '/screenshots/**' },
    ],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pokemontcg.io' },
      { protocol: 'https', hostname: 'images.scrydex.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    // Keep optimised images in Next.js cache for 30 days
    minimumCacheTTL: 2592000,
    // Only generate sizes we actually use — reduces build time & cache bloat
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [48, 64, 96, 128, 192, 256],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://images.pokemontcg.io https://www.googletagmanager.com",
              "font-src 'self'",
              "connect-src 'self' https://api.pokemontcg.io https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
