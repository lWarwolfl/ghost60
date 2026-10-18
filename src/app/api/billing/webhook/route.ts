import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { Entitlement, User } from '@/drizzle/schema'
import { stripeRequest, verifyStripeSignature } from '@/lib/billing/stripe'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const price = process.env.STRIPE_GHOST_PLUS_PRICE_ID
  if (!secret || !price || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'billing-unavailable' }, { status: 503 })
  const raw = Buffer.from(await req.arrayBuffer())
  if (!verifyStripeSignature(raw, req.headers.get('stripe-signature'), secret)) return NextResponse.json({ error: 'bad-signature' }, { status: 400 })
  let event
  try { event = JSON.parse(raw.toString('utf8')) } catch { return NextResponse.json({ error: 'bad-event' }, { status: 400 }) }
  if (!event || typeof event.type !== 'string') return NextResponse.json({ error: 'bad-event' }, { status: 400 })
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) return NextResponse.json({ received: true })
  try {
    let subscriptionId: unknown = event.data?.object?.id
    let checkoutUser: string | undefined
    if (event.type.startsWith('checkout.')) {
      if (typeof subscriptionId !== 'string' || !/^cs_[a-zA-Z0-9_]+$/.test(subscriptionId)) return NextResponse.json({ error: 'bad-event' }, { status: 400 })
      const checkout = await stripeRequest(`checkout/sessions/${subscriptionId}`)
      if (checkout.mode !== 'subscription' || !checkout.client_reference_id || checkout.metadata?.userId !== checkout.client_reference_id) return NextResponse.json({ received: true })
      checkoutUser = checkout.client_reference_id
      subscriptionId = checkout.subscription
    }
    if (typeof subscriptionId !== 'string' || !/^sub_[a-zA-Z0-9]+$/.test(subscriptionId)) return NextResponse.json({ error: 'bad-event' }, { status: 400 })
    const initial = await stripeRequest(`subscriptions/${subscriptionId}`)
    const userId = initial.metadata?.userId
    if (typeof userId !== 'string' || !userId || (checkoutUser && checkoutUser !== userId)) return NextResponse.json({ received: true })
    await db.transaction(async (tx) => {
      const users = await tx.select().from(User).where(eq(User.id, userId)).for('update')
      if (!users[0] || users[0].isAnonymous) return
      const subscription = await stripeRequest(`subscriptions/${subscriptionId}`)
      if (subscription.id !== subscriptionId || subscription.metadata?.userId !== userId) throw new Error('subscription-binding-changed')
      const existing = (await tx.select().from(Entitlement).where(eq(Entitlement.userId, userId)))[0]
      if (existing?.providerSubscriptionId && existing.providerSubscriptionId !== subscriptionId) {
        if (!/^sub_[a-zA-Z0-9]+$/.test(existing.providerSubscriptionId)) return
        const prior = await stripeRequest(`subscriptions/${existing.providerSubscriptionId}`)
        if (!['canceled', 'incomplete_expired'].includes(prior.status)) return
      }
      const items = subscription.items?.data
      const item = Array.isArray(items) && items.length === 1 ? items[0] : null
      const matching = item?.price?.id === price && item.price.recurring?.interval === 'month'
      if (!matching && existing?.providerSubscriptionId !== subscriptionId) return
      const period = item?.current_period_end ?? subscription.current_period_end
      const currentPeriodEnd = typeof period === 'number' && Number.isFinite(period) && period > 0 && period < 8640000000000 ? new Date(period * 1000) : null
      const active = matching && ['active', 'trialing'].includes(subscription.status) && currentPeriodEnd && currentPeriodEnd.getTime() > Date.now()
      const customerId = subscription.customer
      if (typeof customerId !== 'string' || !/^cus_[a-zA-Z0-9]+$/.test(customerId)) throw new Error('bad-customer')
      const values = {
        userId, plan: active ? 'ghost_plus' : 'free', provider: 'stripe',
        providerCustomerId: customerId, providerSubscriptionId: subscriptionId as string,
        status: typeof subscription.status === 'string' ? subscription.status : 'inactive', currentPeriodEnd, updatedAt: new Date()
      }
      await tx.insert(Entitlement).values(values).onConflictDoUpdate({ target: Entitlement.userId, set: values })
    })
    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'billing-unavailable' }, { status: 503 })
  }
}
