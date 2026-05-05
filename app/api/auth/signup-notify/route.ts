import { NextRequest, NextResponse } from 'next/server'
import { notifyNewUser } from '@/lib/slack'

export async function POST(req: NextRequest) {
  try {
    const { email, provider } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email required' }, { status: 400 })
    }
    await notifyNewUser({ email, provider: provider ?? 'email' })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
