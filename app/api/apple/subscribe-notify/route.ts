import { NextRequest, NextResponse } from 'next/server'
import { notifyNewPurchase } from '@/lib/slack'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { userId, productId, billingInterval } = await req.json()
    if (!userId || !productId) {
      return NextResponse.json({ error: 'userId and productId required' }, { status: 400 })
    }

    const tier = productId.includes('.pro.') ? 'pro' : productId.includes('.standard.') ? 'standard' : 'pro'

    // Look up email from Supabase so the Slack message is identifiable
    let email: string | null = null
    try {
      const admin = createAdminClient()
      const { data } = await admin.from('profiles').select('email').eq('id', userId).single()
      email = data?.email ?? null
    } catch { /* non-fatal */ }

    await notifyNewPurchase({
      platform: 'ios',
      tier,
      email,
      userId,
      billingInterval: billingInterval ?? null,
      productId,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[subscribe-notify] error:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
