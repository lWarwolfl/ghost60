import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { user, rows, upsert, lock } = vi.hoisted(() => ({
  user: vi.fn(), rows: vi.fn(), upsert: vi.fn(), lock: vi.fn().mockResolvedValue([{ id: 'user' }])
}))
vi.mock('@/lib/auth/server', () => ({ getCurrentUser: user }))
vi.mock('@/lib/game/rate-limit', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true), RATE_LIMITS: { profileWrite: {} }, rateLimitedResponse: () => Response.json({}, { status: 429 }) }))
vi.mock('@/drizzle', () => {
  const reader = {
    select: () => ({ from: () => ({ where: () => Object.assign(Promise.resolve(rows()), { for: lock }) }) }),
    insert: () => ({ values: (values: unknown) => ({ onConflictDoUpdate: () => upsert(values) }) })
  }
  return { db: { ...reader, transaction: (fn: (tx: typeof reader) => unknown) => fn(reader) } }
})
import { verifyStripeSignature, cancelSubscription } from '@/lib/billing/stripe'
import { POST as checkout } from '@/app/api/billing/checkout/route'
import { POST as portal } from '@/app/api/billing/portal/route'
import { POST as webhook } from '@/app/api/billing/webhook/route'

const fetcher = vi.fn()
const body = JSON.stringify({ id: 'evt_test', type: 'customer.subscription.updated', data: { object: { id: 'sub_test', metadata: { userId: 'attacker' }, status: 'active' } } })
const signed = (raw = body, seconds = Math.floor(Date.now() / 1000)) => `t=${seconds},v1=${createHmac('sha256', 'whsec_test').update(`${seconds}.`).update(Buffer.from(raw)).digest('hex')}`
const request = (raw = body, signature = signed(raw)) => new Request('https://ghost.test/api/billing/webhook', { method: 'POST', body: raw, headers: { 'stripe-signature': signature } })
const subscription = (extra = {}) => ({ id: 'sub_test', customer: 'cus_test', status: 'active', metadata: { userId: 'user' }, items: { data: [{ price: { id: 'price_test', recurring: { interval: 'month' } }, current_period_end: Math.floor(Date.now() / 1000) + 86400 }] }, ...extra })

beforeEach(() => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
  vi.stubEnv('STRIPE_GHOST_PLUS_PRICE_ID', 'price_test')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://ghost.test')
  vi.stubEnv('BETTER_AUTH_URL', '')
  vi.stubGlobal('fetch', fetcher)
  fetcher.mockReset()
  user.mockReset().mockResolvedValue({ id: 'user', isAnonymous: false })
  rows.mockReset().mockReturnValue([{ id: 'user', isAnonymous: false }])
  upsert.mockReset().mockResolvedValue(undefined)
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('webhook signature', () => {
  it('authenticates exact bytes and allows rotated v1 signatures', () => {
    expect(verifyStripeSignature(Buffer.from(body), `v1=${'0'.repeat(64)},${signed()}`, 'whsec_test')).toBe(true)
    expect(verifyStripeSignature(Buffer.from(`${body} `), signed(), 'whsec_test')).toBe(false)
  })
  it('rejects old, future, missing, malformed, wrong-secret signatures', () => {
    for (const signature of [null, '', 't=x,v1=xyz', signed(body, 0), signed(body, Math.floor(Date.now() / 1000) + 301)]) {
      expect(verifyStripeSignature(Buffer.from(body), signature, 'whsec_test')).toBe(false)
    }
    expect(verifyStripeSignature(Buffer.from(body), signed(), 'wrong')).toBe(false)
  })
})

describe('hosted billing routes', () => {
  const req = (origin = 'https://ghost.test') => new Request(`${origin}/api/billing/checkout`, { method: 'POST', headers: { origin } })
  it('requires a nonanonymous account', async () => {
    user.mockResolvedValue({ id: 'anon', isAnonymous: true })
    expect(await (await checkout(req())).json()).toEqual({ error: 'sign-in-required' })
    expect((await portal(req())).status).toBe(401)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('fails closed without secrets or trusted origins', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    expect((await checkout(req())).status).toBe(503)
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test')
    expect((await checkout(req('https://attacker.test'))).status).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('requires a configured webhook before accepting payments', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    expect((await checkout(req())).status).toBe(503)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('refuses checkout when the current stored subscription remains active', async () => {
    rows.mockReturnValue([{ id: 'user', providerCustomerId: 'cus_stored', providerSubscriptionId: 'sub_existing' }])
    fetcher.mockImplementation(() => Promise.resolve(Response.json(subscription())))
    expect((await checkout(req())).status).toBe(409)
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('checkout/sessions'))).toBe(false)
  })
  it('sets the configured subscription price and server-bound user metadata', async () => {
    fetcher.mockResolvedValue(Response.json({ url: 'https://checkout.stripe.com/c/pay/test' }))
    expect(await (await checkout(req())).json()).toEqual({ url: 'https://checkout.stripe.com/c/pay/test' })
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions')
    const params = new URLSearchParams(options.body)
    expect(params.get('mode')).toBe('subscription')
    expect(params.get('line_items[0][price]')).toBe('price_test')
    expect(params.get('client_reference_id')).toBe('user')
    expect(params.get('subscription_data[metadata][userId]')).toBe('user')
    expect(params.get('success_url')).toBe('https://ghost.test/ghost-plus?checkout=success')
    expect(options.headers['Idempotency-Key']).toMatch(/^[a-f0-9]{64}$/)
  })
  it('reuses a stored customer when creating a new subscription', async () => {
    rows.mockReturnValue([{ id: 'user', providerCustomerId: 'cus_stored' }])
    fetcher.mockImplementation((url) => Promise.resolve(Response.json(url.includes('subscriptions?') ? { data: [], has_more: false } : { url: 'https://checkout.stripe.com/c/pay/test' })))
    expect((await checkout(req())).status).toBe(200)
    const call = fetcher.mock.calls.find(([url]) => url.endsWith('checkout/sessions'))
    expect(new URLSearchParams(call?.[1].body).get('customer')).toBe('cus_stored')
  })
  it('opens portal only for the authenticated stored Stripe customer', async () => {
    rows.mockReturnValue([{ provider: 'stripe', providerCustomerId: 'cus_stored' }])
    fetcher.mockResolvedValue(Response.json({ url: 'https://billing.stripe.com/p/session/test' }))
    expect((await portal(req())).status).toBe(200)
    const params = new URLSearchParams(fetcher.mock.calls[0][1].body)
    expect(params.get('customer')).toBe('cus_stored')
    expect(params.get('return_url')).toBe('https://ghost.test/ghost-plus')
  })
})

describe('webhook reconciliation', () => {
  it('verifies before reading Stripe or writing any entitlement', async () => {
    expect((await webhook(request(body, 't=1,v1=bad'))).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })
  it('uses current Stripe state and metadata instead of granting stale event state', async () => {
    fetcher.mockImplementation(() => Promise.resolve(Response.json(subscription({ status: 'canceled' }))))
    expect((await webhook(request())).status).toBe(200)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user', plan: 'free', status: 'canceled' }))
  })
  it('grants the matching current paid period idempotently', async () => {
    fetcher.mockImplementation(() => Promise.resolve(Response.json(subscription())))
    expect((await webhook(request())).status).toBe(200)
    expect((await webhook(request())).status).toBe(200)
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'user', plan: 'ghost_plus', providerSubscriptionId: 'sub_test', currentPeriodEnd: expect.any(Date) }))
  })
  it('never grants for an unrelated price', async () => {
    fetcher.mockImplementation(() => Promise.resolve(Response.json(subscription({ items: { data: [{ price: { id: 'price_other' }, current_period_end: Math.floor(Date.now() / 1000) + 86400 }] } }))))
    expect((await webhook(request())).status).toBe(200)
    expect(upsert).not.toHaveBeenCalledWith(expect.objectContaining({ plan: 'ghost_plus' }))
  })
  it('never grants after the user was deleted', async () => {
    fetcher.mockImplementation(() => Promise.resolve(Response.json(subscription())))
    lock.mockResolvedValueOnce([])
    expect((await webhook(request())).status).toBe(200)
    expect(upsert).not.toHaveBeenCalled()
  })
  it('permits a new subscription after the previous one was canceled', async () => {
    rows.mockReturnValueOnce([{ id: 'user', isAnonymous: false }]).mockReturnValue([{ providerSubscriptionId: 'sub_old' }])
    fetcher.mockImplementation((url) => Promise.resolve(Response.json(url.endsWith('sub_old') ? subscription({ id: 'sub_old', status: 'canceled' }) : subscription())))
    expect((await webhook(request())).status).toBe(200)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ providerSubscriptionId: 'sub_test', plan: 'ghost_plus' }))
  })
  it('rejects unbound subscriptions and retries upstream failures', async () => {
    fetcher.mockResolvedValueOnce(Response.json(subscription({ metadata: {} })))
    expect((await webhook(request())).status).toBe(200)
    expect(upsert).not.toHaveBeenCalled()
    fetcher.mockResolvedValueOnce(Response.json({}, { status: 503 }))
    expect((await webhook(request())).status).toBe(503)
  })
})

describe('account cancellation', () => {
  it('validates the subscription id and deletes it through Stripe', async () => {
    await expect(cancelSubscription('../customers/cus_other')).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
    fetcher.mockResolvedValue(Response.json({ id: 'sub_test', status: 'canceled' }))
    await expect(cancelSubscription('sub_test')).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledWith('https://api.stripe.com/v1/subscriptions/sub_test', expect.objectContaining({ method: 'DELETE' }))
  })
  it('fails closed when Stripe cancellation fails', async () => {
    fetcher.mockResolvedValue(Response.json({}, { status: 503 }))
    await expect(cancelSubscription('sub_test')).rejects.toThrow()
  })
})
