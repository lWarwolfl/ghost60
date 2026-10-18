import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  transaction: vi.fn(),
  entitlement: { provider: 'stripe', providerSubscriptionId: 'sub_test' },
}))

vi.mock('@/lib/auth/server', () => ({ getCurrentUser: async () => ({ id: 'user-test' }) }))
vi.mock('@/lib/game/rate-limit', () => ({
  RATE_LIMITS: { accountDelete: {} },
  checkRateLimit: async () => true,
}))
vi.mock('@/lib/billing/stripe', () => ({ cancelSubscription: mocks.cancel }))
vi.mock('@/drizzle', () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => [mocks.entitlement] }) }),
    transaction: mocks.transaction,
  },
}))

import { DELETE } from '@/app/api/account/route'

describe('paid account deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockResolvedValue(undefined)
    mocks.cancel.mockResolvedValue(undefined)
  })

  it('cancels the subscription before erasing billing records', async () => {
    const response = await DELETE()
    expect(response.status).toBe(200)
    expect(mocks.cancel).toHaveBeenCalledWith('sub_test')
    expect(mocks.cancel.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.transaction.mock.invocationCallOrder[0]
    )
  })

  it('keeps account records when provider cancellation fails', async () => {
    mocks.cancel.mockRejectedValueOnce(new Error('provider-offline'))
    const response = await DELETE()
    expect(response.status).toBe(503)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({ error: 'subscription-cancel-failed' })
  })
})
