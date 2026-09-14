/**
 * POST /api/shops/waitlist
 * Adds a shop to the waitlist table. No auth required.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  let body: { email?: string; shop_name?: string; message?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const email = (body.email ?? '').trim().toLowerCase()
  const shop_name = (body.shop_name ?? '').trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin.from('shop_waitlist').upsert(
    { email, shop_name: shop_name || null, message: body.message?.trim() || null },
    { onConflict: 'email', ignoreDuplicates: false }
  )

  if (error) {
    console.error('[shop-waitlist]', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
