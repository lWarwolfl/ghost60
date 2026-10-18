import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  user: { id: 'tester' } as { id: string } | null,
  rows: [] as object[],
  write: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('@/lib/auth/server', () => ({ getCurrentUser: async () => state.user }))
vi.mock('@/drizzle', () => {
  const tx = {
    select: () => ({
      from: () => ({
        where: () =>
          Object.assign(Promise.resolve(state.rows), { for: async () => [{ id: 'tester' }] }),
      }),
    }),
    insert: () => ({
      values: (values: unknown) => ({ onConflictDoUpdate: async () => state.write(values) }),
    }),
    delete: () => ({ where: async () => state.remove() }),
  }
  return { db: { ...tx, transaction: async (fn: (value: typeof tx) => unknown) => fn(tx) } }
})
import { POST, DELETE } from '@/app/api/billing/test-confirmation/route'
import { getPlan } from '@/lib/game/entitlement'

const request = (origin = 'http://localhost:3104') =>
  new Request('http://localhost:3104/api/billing/test-confirmation', {
    method: 'POST',
    headers: { origin },
  })
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  state.user = { id: 'tester' }
  state.rows = []
})

describe('local test payment confirmation', () => {
  it('ignores stored test entitlements in production', async () => {
    state.rows = [
      {
        provider: 'test',
        plan: 'ghost_plus',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 86400000),
      },
    ]
    vi.stubEnv('NODE_ENV', 'development')
    expect(await getPlan('tester')).toBe('ghost_plus')
    vi.stubEnv('NODE_ENV', 'production')
    expect(await getPlan('tester')).toBe('free')
  })
  it('never grants access in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect((await POST(request())).status).toBe(404)
    expect(state.write).not.toHaveBeenCalled()
  })
  it('requires a session and a same-origin local request', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect((await POST(request('https://other.test'))).status).toBe(403)
    state.user = null
    expect((await POST(request())).status).toBe(401)
  })
  it('grants an expiring test entitlement and lets it be reset', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect((await POST(request())).status).toBe(200)
    expect(state.write).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'tester',
        provider: 'test',
        plan: 'ghost_plus',
        status: 'active',
        currentPeriodEnd: expect.any(Date),
      })
    )
    expect((await DELETE(request())).status).toBe(200)
    expect(state.remove).toHaveBeenCalledOnce()
  })
  it('does not overwrite a real subscription', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    state.rows = [{ provider: 'stripe', providerSubscriptionId: 'sub_real' }]
    expect((await POST(request())).status).toBe(409)
    expect(state.write).not.toHaveBeenCalled()
  })
})
