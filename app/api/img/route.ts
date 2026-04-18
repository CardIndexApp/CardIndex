import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_HOST = 'images.pokemontcg.io'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') ?? ''

  try {
    const { hostname } = new URL(url)
    if (hostname !== ALLOWED_HOST) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    const upstream = await fetch(url, {
      next: { revalidate: 86400 }, // cache for 24h at the edge
    })

    if (!upstream.ok) {
      return new NextResponse('Not found', { status: 404 })
    }

    const body = await upstream.arrayBuffer()

    return new NextResponse(body, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'image/png',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    })
  } catch {
    return new NextResponse('Error', { status: 500 })
  }
}
