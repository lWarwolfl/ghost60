import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/drizzle'
import { Entitlement, User } from '@/drizzle/schema'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/server'
import { hostedUrl, stripeRequest, trustedOrigin } from '@/lib/billing/stripe'
import { RATE_LIMITS, checkRateLimit, rateLimitedResponse } from '@/lib/game/rate-limit'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.isAnonymous) return NextResponse.json({ error: 'sign-in-required' }, { status: 401 })
  const price = process.env.STRIPE_GHOST_PLUS_PRICE_ID
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET || !price) return NextResponse.json({ error: 'billing-unavailable' }, { status: 503 })
  const origin = trustedOrigin(req)
  if (!origin) return NextResponse.json({ error: 'untrusted-origin' }, { status: 403 })
  if (!(await checkRateLimit('checkout', user.id, RATE_LIMITS.profileWrite))) return rateLimitedResponse()
  try {
    return await db.transaction(async (tx) => {
    await tx.select({ id: User.id }).from(User).where(eq(User.id, user.id)).for('update')
    const entitlement = (await tx.select().from(Entitlement).where(eq(Entitlement.userId, user.id)))[0]
    if (entitlement?.providerSubscriptionId) {
      if (!/^sub_[a-zA-Z0-9]+$/.test(entitlement.providerSubscriptionId)) throw new Error('bad-subscription')
      const current = await stripeRequest(`subscriptions/${entitlement.providerSubscriptionId}`)
      if (!['canceled', 'incomplete_expired'].includes(current.status)) return NextResponse.json({ error: 'subscription-exists' }, { status: 409 })
    }
    const customer = entitlement?.providerCustomerId
    if (customer) {
      if (!/^cus_[a-zA-Z0-9]+$/.test(customer)) throw new Error('bad-customer')
      const existing = await stripeRequest(`subscriptions?customer=${encodeURIComponent(customer)}&status=all&limit=100`)
      if (existing.has_more || !Array.isArray(existing.data)) throw new Error('billing-unavailable')
      if (existing.data.some((subscription: { status: string }) => !['canceled', 'incomplete_expired'].includes(subscription.status))) return NextResponse.json({ error: 'subscription-exists' }, { status: 409 })
    }
    const key = createHash('sha256').update(`${user.id}:${price}:${origin}:${Math.floor(Date.now() / 86400000)}`).digest('hex')
    const session = await stripeRequest('checkout/sessions', 'POST', new URLSearchParams({
      ...(customer ? { customer } : {}),
      mode: 'subscription', 'line_items[0][price]': price, 'line_items[0][quantity]': '1',
      client_reference_id: user.id, 'metadata[userId]': user.id, 'subscription_data[metadata][userId]': user.id,
      success_url: `${origin}/ghost-plus?checkout=success`, cancel_url: `${origin}/ghost-plus?checkout=cancelled`
    }), key)
    return NextResponse.json({ url: hostedUrl(session.url, 'checkout.stripe.com') })
    })
  } catch {
    return NextResponse.json({ error: 'billing-unavailable' }, { status: 503 })
  }
}
