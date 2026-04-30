import { NextRequest, NextResponse } from 'next/server'

// Allowlist of image CDN hostnames we proxy.
// cdn.poketrace.com images require the X-API-Key header — added server-side below.
const ALLOWED_HOSTS: Record<string, boolean> = {
  'images.pokemontcg.io': true,
  'cdn.poketrace.com':    true,
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') ?? ''

  try {
    const { hostname } = new URL(url)
    if (!ALLOWED_HOSTS[hostname]) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    // Poketrace CDN requires the API key; pokemontcg.io does not
    const fetchHeaders: Record<string, string> = {}
    if (hostname === 'cdn.poketrace.com' && process.env.POKETRACE_API_KEY) {
      fetchHeaders['X-API-Key'] = process.env.POKETRACE_API_KEY
    }

    const upstream = await fetch(url, {
      headers: fetchHeaders,
      next: { revalidate: 86400 }, // cache for 24h at the edge
    })

    if (!upstream.ok) {
      return new NextResponse('Not found', { status: 404 })
    }

    const body = await upstream.arrayBuffer()

    return new NextResponse(body, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'image/png',
        // Card images are immutable for a given URL — cache for 1 year
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Error', { status: 500 })
  }
}
