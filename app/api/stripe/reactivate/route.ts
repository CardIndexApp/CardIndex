/**
 * POST /api/stripe/reactivate
 * Reactivates a subscription that is set to cancel at the end of the billing period.
 * Calls stripe.subscriptions.update with { cancel_at_period_end: false } and
 * updates the profile subscription_status back to 'active'.
 */
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' })
}

export async function POST() {
  const stripe = getStripe()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const customerId = profile?.stripe_customer_id
  if (!customerId) return NextResponse.json({ error: 'No billing account found' }, { status: 400 })

  // Find the active subscription that is set to cancel
  const existingSubs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 10,
  })

  const cancelingSub = existingSubs.data.find(s => s.cancel_at_period_end)
  if (!cancelingSub) {
    return NextResponse.json({ error: 'No canceling subscription found' }, { status: 404 })
  }

  // Remove the cancellation flag — keeps the same plan, same billing date
  await stripe.subscriptions.update(cancelingSub.id, { cancel_at_period_end: false })

  // Sync status back to our DB immediately (webhook will also fire shortly)
  await admin
    .from('profiles')
    .update({ subscription_status: 'active' })
    .eq('stripe_customer_id', customerId)

  return NextResponse.json({ success: true })
}
