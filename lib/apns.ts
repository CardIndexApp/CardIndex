/**
 * APNs HTTP/2 push notification sender using JWT auth (p8 key).
 *
 * Required env vars:
 *   APNS_KEY_ID      — 10-char key ID from Apple Developer
 *   APNS_TEAM_ID     — 10-char team ID from Apple Developer
 *   APNS_PRIVATE_KEY — full contents of the .p8 file (newlines as \n)
 *   APNS_BUNDLE_ID   — com.yourcompany.CardIndexIOS
 *   APNS_PRODUCTION  — "true" for production, omit for sandbox
 */

import { createPrivateKey } from 'crypto'
import { SignJWT } from 'jose'

const APNS_HOST = process.env.APNS_PRODUCTION === 'true'
  ? 'https://api.push.apple.com'
  : 'https://api.sandbox.push.apple.com'

let cachedToken: { value: string; expiresAt: number } | null = null

async function getJWT(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value

  const keyId  = process.env.APNS_KEY_ID!
  const teamId = process.env.APNS_TEAM_ID!
  const rawKey = process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, '\n')

  const privateKey = createPrivateKey({ key: rawKey, format: 'pem' })

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .sign(privateKey)

  cachedToken = { value: token, expiresAt: now + 3600 }
  return token
}

export interface APNsPayload {
  title: string
  body:  string
  data?: Record<string, string>
  badge?: number
  sound?: string
}

export interface APNsSendResult {
  token:   string
  success: boolean
  error?:  string
}

export async function sendPush(
  deviceToken: string,
  payload: APNsPayload,
  collapseId?: string
): Promise<APNsSendResult> {
  const bundleId = process.env.APNS_BUNDLE_ID!
  const jwt      = await getJWT()

  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      badge: payload.badge ?? 1,
      sound: payload.sound ?? 'default',
    },
    ...payload.data,
  })

  const headers: Record<string, string> = {
    'authorization':  `bearer ${jwt}`,
    'apns-topic':     bundleId,
    'apns-push-type': 'alert',
    'apns-priority':  '10',
    'content-type':   'application/json',
  }
  if (collapseId) headers['apns-collapse-id'] = collapseId

  try {
    const res = await fetch(`${APNS_HOST}/3/device/${deviceToken}`, {
      method: 'POST',
      headers,
      body,
    })

    if (res.status === 200) return { token: deviceToken, success: true }

    const json = await res.json().catch(() => ({}))
    return { token: deviceToken, success: false, error: json.reason ?? `HTTP ${res.status}` }
  } catch (err) {
    return { token: deviceToken, success: false, error: String(err) }
  }
}

export async function sendPushToMany(
  deviceTokens: string[],
  payload: APNsPayload,
  collapseId?: string
): Promise<APNsSendResult[]> {
  return Promise.all(deviceTokens.map(t => sendPush(t, payload, collapseId)))
}
