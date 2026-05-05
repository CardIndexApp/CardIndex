import { NextRequest, NextResponse } from 'next/server'
import { notifyNewUser } from '@/lib/slack'

export async function POST(req: NextRequest) {
  try {
    const { email, provider } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email required' }, { status: 400 })
    }
    console.log('[signup-notify] new email signup:', email)
    await notifyNewUser({ email, provider: provider ?? 'email' })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[signup-notify] error:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
