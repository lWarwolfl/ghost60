import { beforeEach, describe, expect, it, vi } from 'vitest'
const { getSession, anonymous } = vi.hoisted(() => ({ getSession: vi.fn(), anonymous: vi.fn() }))
vi.mock('@/lib/auth/client', () => ({ authClient: { getSession, signIn: { anonymous } } }))
import { ensureSession } from '@/lib/auth/ensure-session'

beforeEach(() => vi.resetAllMocks())

describe('guest sign-in recovery', () => {
  it('shares a single sign-in between bootstrap and Play', async () => {
    getSession.mockResolvedValue({ data: null })
    anonymous.mockResolvedValue({ data: { user: { id: 'guest' } } })
    await Promise.all([ensureSession(), ensureSession(), ensureSession()])
    expect(getSession).toHaveBeenCalledOnce()
    expect(anonymous).toHaveBeenCalledOnce()
  })

  it('preserves an existing signed-in identity', async () => {
    getSession.mockResolvedValue({ data: { user: { id: 'existing-user' } } })
    await ensureSession()
    expect(anonymous).not.toHaveBeenCalled()
  })

  it('does not create a guest when the session lookup fails', async () => {
    getSession.mockResolvedValue({ error: { status: 503 } })
    await expect(ensureSession()).rejects.toThrow('auth-unavailable')
    expect(anonymous).not.toHaveBeenCalled()
  })

  it('reports an origin failure and permits a later retry', async () => {
    getSession.mockResolvedValue({ data: null })
    anonymous
      .mockResolvedValueOnce({ error: { status: 403 } })
      .mockResolvedValueOnce({ data: { user: { id: 'guest' } } })
    await expect(ensureSession()).rejects.toThrow('auth-origin-rejected')
    await expect(ensureSession()).resolves.toBeUndefined()
    expect(anonymous).toHaveBeenCalledTimes(2)
  })
})
