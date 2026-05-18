/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session and returns { url }.
 *
 * Body: { priceId: string, mode?: 'subscription' }
 */
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' })
}

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { priceId } = await req.json()
  if (!priceId) return NextResponse.json({ error: 'priceId required' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://card-index.app'

  // Fetch profile to get (or create) Stripe customer ID
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single()

  let customerId: string | undefined = profile?.stripe_customer_id ?? undefined

  // Create a Stripe customer if one doesn't exist yet
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await admin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  // Check for existing active subscriptions before creating a new one.
  // This prevents duplicate subscriptions when a user has a cancel_at_period_end sub.
  const existingSubs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 10,
  })

  for (const sub of existingSubs.data) {
    if (sub.cancel_at_period_end) {
      const existingPriceId = sub.items.data[0]?.price.id
      if (existingPriceId === priceId) {
        // Same plan — reactivate by removing the cancellation flag
        await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false })
        await admin
          .from('profiles')
          .update({ subscription_status: 'active' })
          .eq('stripe_customer_id', customerId)
        return NextResponse.json({ url: `${appUrl}/account?reactivated=1` })
      }
      // Different plan (upgrade/downgrade while canceling) — fall through to new checkout
    } else {
      // Fully active subscription with no cancellation scheduled — don't create a duplicate.
      // Redirect to account to manage their existing subscription.
      return NextResponse.json({ url: `${appUrl}/account` })
    }
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { supabase_user_id: user.id } },
    success_url: `${appUrl}/account?upgraded=1`,
    cancel_url: `${appUrl}/pricing`,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
