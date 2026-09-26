/**
 * POST /api/apple/notifications
 *
 * App Store Server Notifications V2 webhook. Apple calls this on subscription
 * lifecycle events (renew, expire, refund, revoke, plan change). We verify the
 * signed payload, read the appAccountToken (= the Supabase user id, set on
 * purchase), and sync profiles.tier so cancellations/refunds/expirations
 * downgrade users even when the app is closed.
 *
 * SETUP (one-time):
 *  1. npm install @apple/app-store-server-library
 *  2. Download Apple root certs (DER/.cer) from
 *     https://www.apple.com/certificateauthority/ into lib/apple-certs/:
 *       - AppleRootCA-G3.cer
 *       - AppleRootCA-G2.cer
 *       - AppleComputerRootCertificate.cer
 *       - AppleIncRootCertificate.cer
 *  3. Set env vars:
 *       APPLE_BUNDLE_ID       = com.your.bundleid
 *       APPLE_APP_APPLE_ID    = <numeric App Store app id>   (Production only)
 *  4. In App Store Connect → App Information → App Store Server Notifications,
 *     set the Production (and Sandbox) URL to:
 *       https://www.card-index.app/api/apple/notifications
 */
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import path from 'path'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyNewPurchase, notifySubscriptionLifecycle } from '@/lib/slack'
import {
  SignedDataVerifier,
  Environment,
  type JWSTransactionDecodedPayload,
} from '@apple/app-store-server-library'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Map a product id to our tier. */
function tierForProduct(productId: string): 'pro' | 'standard' | null {
  if (productId.includes('.pro.')) return 'pro'
  if (productId.includes('.standard.')) return 'standard'
  return null
}

/** Apple root certificates (downloaded into lib/apple-certs/). */
function appleRootCerts(): Buffer[] {
  const dir = path.join(process.cwd(), 'lib', 'apple-certs')
  const files = [
    'AppleRootCA-G3.cer',
    'AppleRootCA-G2.cer',
    'AppleComputerRootCertificate.cer',
    'AppleIncRootCertificate.cer',
  ]
  const certs: Buffer[] = []
  for (const f of files) {
    try { certs.push(readFileSync(path.join(dir, f))) } catch { /* optional */ }
  }
  return certs
}

function makeVerifier(env: Environment): SignedDataVerifier {
  const bundleId = process.env.APPLE_BUNDLE_ID ?? ''
  const appAppleId = process.env.APPLE_APP_APPLE_ID
    ? Number(process.env.APPLE_APP_APPLE_ID)
    : undefined
  return new SignedDataVerifier(appleRootCerts(), true, env, bundleId, appAppleId)
}

/** Verify + decode the notification, trying Production then Sandbox. */
async function verifyNotification(signedPayload: string) {
  for (const env of [Environment.PRODUCTION, Environment.SANDBOX]) {
    try {
      const verifier = makeVerifier(env)
      const payload = await verifier.verifyAndDecodeNotification(signedPayload)
      const txnJWS = payload.data?.signedTransactionInfo
      const txn = txnJWS ? await verifier.verifyAndDecodeTransaction(txnJWS) : undefined
      return { payload, txn }
    } catch { /* try next environment */ }
  }
  return null
}

/** Authoritative tier from the transaction's own dates + product. */
function tierFromTransaction(txn: JWSTransactionDecodedPayload): string {
  const now = Date.now()
  if (txn.revocationDate) return 'free'                       // refunded / revoked
  if (txn.expiresDate && txn.expiresDate < now) return 'free' // lapsed
  return tierForProduct(txn.productId ?? '') ?? 'free'
}

export async function POST(req: NextRequest) {
  let signedPayload: string | undefined
  try {
    const body = await req.json()
    signedPayload = body?.signedPayload
  } catch { /* fallthrough */ }

  if (!signedPayload) {
    return NextResponse.json({ error: 'Missing signedPayload' }, { status: 400 })
  }

  const result = await verifyNotification(signedPayload)
  if (!result) {
    // Signature failed in both environments — reject so Apple retries.
    return NextResponse.json({ error: 'Verification failed' }, { status: 401 })
  }

  const { payload, txn } = result
  if (!txn) {
    // Notifications without a transaction (e.g. some test types) — acknowledge.
    return NextResponse.json({ ok: true, note: 'no transaction' })
  }

  const userId = txn.appAccountToken
  if (!userId) {
    // No appAccountToken (purchase made before we started tagging) — can't map.
    console.warn('[apple] notification with no appAccountToken', payload.notificationType)
    return NextResponse.json({ ok: true, note: 'no appAccountToken' })
  }

  const newTier = tierFromTransaction(txn)
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ tier: newTier })
    .eq('id', userId)

  if (error) {
    console.error('[apple] tier update failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch email once for all Slack calls
  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()
  const email = profile?.email ?? null
  const billingInterval = txn.productId?.includes('.annual') ? 'year' : 'month'
  const slackBase = { email, userId, productId: txn.productId ?? null, billingInterval }

  const type = payload.notificationType
  const sub  = payload.subtype ?? ''

  if (type === 'SUBSCRIBED' && sub === 'INITIAL_BUY' && newTier !== 'free') {
    await notifyNewPurchase({ platform: 'ios', tier: newTier, ...slackBase })
  } else if (type === 'DID_RENEW') {
    await notifySubscriptionLifecycle({ type: 'renewal', ...slackBase })
  } else if (type === 'DID_CHANGE_RENEWAL_STATUS' && sub === 'AUTO_RENEW_DISABLED') {
    await notifySubscriptionLifecycle({ type: 'cancelled', ...slackBase })
  } else if (type === 'EXPIRED') {
    await notifySubscriptionLifecycle({ type: 'expired', ...slackBase })
  } else if (type === 'REFUND') {
    await notifySubscriptionLifecycle({ type: 'refund', ...slackBase })
  } else if (type === 'DID_FAIL_TO_RENEW') {
    await notifySubscriptionLifecycle({ type: 'billing_failed', ...slackBase })
  }

  console.log(`[apple] ${payload.notificationType}/${payload.subtype ?? ''} → user ${userId} tier=${newTier}`)
  return NextResponse.json({ ok: true })
}
