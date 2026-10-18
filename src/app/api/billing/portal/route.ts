import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { Entitlement } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { hostedUrl, stripeRequest, trustedOrigin } from '@/lib/billing/stripe'
import { RATE_LIMITS, checkRateLimit, rateLimitedResponse } from '@/lib/game/rate-limit'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.isAnonymous) return NextResponse.json({ error: 'sign-in-required' }, { status: 401 })
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'billing-unavailable' }, { status: 503 })
  const origin = trustedOrigin(req)
  if (!origin) return NextResponse.json({ error: 'untrusted-origin' }, { status: 403 })
  if (!(await checkRateLimit('billing-portal', user.id, RATE_LIMITS.profileWrite))) return rateLimitedResponse()
  const entitlement = (await db.select().from(Entitlement).where(eq(Entitlement.userId, user.id)))[0]
  if (entitlement?.provider !== 'stripe' || !entitlement.providerCustomerId) return NextResponse.json({ error: 'billing-customer-missing' }, { status: 409 })
  try {
    const session = await stripeRequest('billing_portal/sessions', 'POST', new URLSearchParams({
      customer: entitlement.providerCustomerId, return_url: `${origin}/ghost-plus`
    }))
    return NextResponse.json({ url: hostedUrl(session.url, 'billing.stripe.com') })
  } catch {
    return NextResponse.json({ error: 'billing-unavailable' }, { status: 503 })
  }
}
