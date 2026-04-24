import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CardIndex — TCG Market Intelligence',
    short_name: 'CardIndex',
    description: 'Real-time price intelligence and market analysis for trading card collectors',
    start_url: '/',
    display: 'standalone',
    background_color: '#080810',
    theme_color: '#080810',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
