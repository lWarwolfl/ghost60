import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { ensureSession } = vi.hoisted(() => ({ ensureSession: vi.fn() }))
vi.mock('@/lib/auth/ensure-session', () => ({ ensureSession }))
import { createSession, sessionStartMessage } from '@/features/game/api/create-session'

const snapshot = { token: 'test-token', game: { gameId: 'pulse' } }
const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllGlobals())

describe('game start', () => {
  it.each(['ranked', 'special'] as const)(
    'recovers a missing guest session for %s',
    async (mode) => {
      fetchMock
        .mockResolvedValueOnce(Response.json({ error: 'unauthorized' }, { status: 401 }))
        .mockResolvedValueOnce(Response.json(snapshot))
      expect(await createSession({ mode })).toEqual(snapshot)
      expect(ensureSession).toHaveBeenCalledOnce()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    }
  )

  it('does not blindly retry charge or server failures', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'charges-empty' }, { status: 403 }))
    await expect(createSession({ mode: 'special' })).rejects.toThrow('charges-empty')
    expect(ensureSession).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('handles an HTML server error without exposing a JSON parse error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Server error</html>', { status: 500 }))
    await expect(createSession({ mode: 'special' })).rejects.toThrow('session-unavailable')
  })

  it('does not loop when authentication stays unavailable', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'unauthorized' }, { status: 401 }))
    await expect(createSession({ mode: 'ranked' })).rejects.toThrow('unauthorized')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows a specific actionable explanation', () => {
    expect(sessionStartMessage(new Error('charges-empty'))).toContain('00:00 UTC')
    expect(sessionStartMessage(new Error('auth-origin-rejected'))).toContain('authentication URL')
    expect(sessionStartMessage(new Error('special-ended'))).toContain('next one')
  })
})
