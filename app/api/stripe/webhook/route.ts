/**
 * POST /api/stripe/webhook
 * Receives and verifies Stripe webhook events, then updates the Supabase
 * profiles table with the correct tier and subscription status.
 *
 * Events handled:
 *   checkout.session.completed         — new subscription started
 *   customer.subscription.updated      — plan change / renewal
 *   customer.subscription.deleted      — cancellation
 */
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Tier } from '@/lib/tier'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' })
}

// Map Stripe Price IDs → internal tier names
const PRICE_TO_TIER: Record<string, Tier> = {
  [process.env.STRIPE_PRICE_STANDARD_MONTHLY ?? '']: 'standard',
  [process.env.STRIPE_PRICE_STANDARD_ANNUAL  ?? '']: 'standard',
  [process.env.STRIPE_PRICE_PRO_MONTHLY      ?? '']: 'pro',
  [process.env.STRIPE_PRICE_PRO_ANNUAL       ?? '']: 'pro',
}

async function updateProfile(customerId: string, tier: Tier, status: string) {
  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({ tier, subscription_status: status })
    .eq('stripe_customer_id', customerId)
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription' || !session.subscription) break
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = sub.items.data[0]?.price.id ?? ''
        const tier = PRICE_TO_TIER[priceId] ?? 'free'
        const customerId = session.customer as string
        await updateProfile(customerId, tier, sub.status)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const priceId = sub.items.data[0]?.price.id ?? ''
        const tier = PRICE_TO_TIER[priceId] ?? 'free'
        const customerId = sub.customer as string
        await updateProfile(customerId, tier, sub.status)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        await updateProfile(customerId, 'free', 'canceled')
        break
      }

      default:
        // Ignore unhandled events
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// Note: Next.js App Router passes the raw request body natively — no bodyParser config needed.
