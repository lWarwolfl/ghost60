import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyStripeSignature(raw: Buffer, header: string | null, secret: string, now = Date.now()) {
  if (!header || !secret) return false
  const parts = header.split(',').map((part) => part.trim().split('='))
  const timestamps = parts.filter(([key]) => key === 't')
  const timestamp = timestamps[0]?.[1]
  if (timestamps.length !== 1 || !timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest()
  return parts.some(([key, value]) => key === 'v1' && /^[a-f0-9]{64}$/i.test(value ?? '') && timingSafeEqual(Buffer.from(value, 'hex'), expected))
}

export function trustedOrigin(req: Request) {
  const origin = new URL(req.url).origin
  const trusted = [process.env.NEXT_PUBLIC_APP_URL, process.env.BETTER_AUTH_URL].some((value) => {
    if (!value) return false
    try {
      const url = new URL(value)
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.origin === origin
    } catch { return false }
  })
  if (!trusted || (req.headers.get('origin') && req.headers.get('origin') !== origin)) return null
  return origin
}

export async function stripeRequest(path: string, method = 'GET', body?: URLSearchParams, idempotencyKey?: string) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error('billing-unavailable')
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret}`, 'Stripe-Version': '2025-06-30.basil', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}), ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    ...(body ? { body: body.toString() } : {}),
    cache: 'no-store', signal: AbortSignal.timeout(15000)
  })
  if (!response.ok) throw new Error('billing-unavailable')
  return response.json()
}

export async function cancelSubscription(subscriptionId: string) {
  if (!/^sub_[a-zA-Z0-9]+$/.test(subscriptionId)) throw new Error('invalid-subscription')
  const subscription = await stripeRequest(`subscriptions/${subscriptionId}`, 'DELETE')
  if (subscription.id !== subscriptionId || subscription.status !== 'canceled') throw new Error('billing-unavailable')
}

export function hostedUrl(value: unknown, host: string) {
  if (typeof value !== 'string') throw new Error('billing-unavailable')
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password || url.port) throw new Error('billing-unavailable')
  return url.toString()
}
