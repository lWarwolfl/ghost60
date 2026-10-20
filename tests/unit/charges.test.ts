import { beforeEach, describe, expect, it, vi } from 'vitest'

const { query, insert, update, lock, currentUser, daily, database } = vi.hoisted(() => {
  const query = vi.fn()
  const insert = vi.fn()
  const update = vi.fn()
  const lock = vi.fn().mockResolvedValue([{ id: 'user' }])
  const currentUser = vi.fn().mockResolvedValue({ id: 'user' })
  const daily = vi.fn().mockResolvedValue({ id: 'daily', gameId: 'pulse', engineVersion: 1, gameDate: new Date().toISOString().slice(0, 10), publishAt: new Date(0), status: 'live' })
  const reader = { select: () => ({ from: (table: unknown) => ({ where: (...args: unknown[]) => Object.assign(Promise.resolve(query(table, ...args)), { for: lock }) }) }),
    insert: () => ({ values: insert }), update: () => ({ set: (values: unknown) => ({ where: () => update(values) }) }) }
  let pending = Promise.resolve()
  const database = { ...reader, transaction: vi.fn((fn: (tx: typeof reader) => Promise<unknown>) => {
    const next = pending.then(() => fn(reader))
    pending = next.then(() => undefined, () => undefined)
    return next
  }) }
  return { query, insert, update, lock, currentUser, daily, database }
})
vi.mock('@/drizzle', () => ({ db: database }))
vi.mock('@/lib/auth/server', () => ({ getCurrentUser: currentUser }))
vi.mock('@/lib/game/daily', () => ({ getTodayDailyGame: daily }))
vi.mock('@/lib/game/rate-limit', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true), RATE_LIMITS: {} }))
vi.mock('@/games/registry', () => ({ getGame: () => ({ validateConfig: () => ({}), durationMs: () => 60000 }) }))
import { getPlan } from '@/lib/game/entitlement'
import { chargeSnapshot } from '@/lib/game/charges'
import type { TRunSession } from '@/drizzle/schema'

const now = new Date('2026-10-18T23:59:59.999Z')
const session = (overrides: Partial<TRunSession> = {}): TRunSession => ({
  id: 's', userId: 'user', dailyGameId: 'daily', mode: 'practice', state: 'created',
  startedAt: now, consumedAt: null, expiresAt: new Date(now.getTime() + 1000),
  technicalRetryOf: null, metadata: {}, challengeId: null, tokenHash: '', ...overrides
})

describe('daily charges', () => {
  it('reserves five daily starts and excludes challenges', () => {
    const sessions = ['ranked', 'ranked', 'special', 'ranked', 'ranked', 'challenge'].map((mode) => session({ mode }))
    expect(chargeSnapshot(sessions, 'free', now)).toEqual({
      limit: 5, used: 5, remaining: 0, resetAt: '2026-10-19T00:00:00.000Z', rankedAvailable: false, resumableModes: ['ranked', 'special', 'challenge'], plan: 'free'
    })
  })
  it('counts abandoned consumed runs even when expired or cancelled', () => {
    const sessions = ['cancelled', 'expired', 'consumed'].map((state) => session({ mode: 'ranked', state, consumedAt: now, expiresAt: new Date(0) }))
    expect(chargeSnapshot(sessions, 'free', now).used).toBe(3)
  })
  it('releases expired and cancelled unconsumed reservations without charging retries twice', () => {
    const sessions = [session({ mode: 'ranked', state: 'cancelled' }), session({ mode: 'ranked', expiresAt: now }), session({ mode: 'ranked', state: 'expired' }), session({ mode: 'ranked', technicalRetryOf: 'cancelled' })]
    expect(chargeSnapshot(sessions, 'free', now).used).toBe(1)
  })
  it('rolls over at UTC midnight using startedAt rather than consumedAt', () => {
    const sessions = [session({ consumedAt: new Date('2026-10-19T00:00:00Z') })]
    expect(chargeSnapshot(sessions, 'free', new Date('2026-10-19T00:00:00Z'))).toMatchObject({ used: 0, remaining: 5, resetAt: '2026-10-20T00:00:00.000Z' })
  })
  it('counts a consumed run after its expiry and leaves the other four', () => {
    expect(chargeSnapshot([session({ mode: 'ranked', consumedAt: now, state: 'expired', expiresAt: new Date(0) })], 'free', now)).toMatchObject({ used: 1, remaining: 4, rankedAvailable: true })
  })
  it('advertises reservation resume at zero without exposing a consumed restart', () => {
    const sessions = [session({ mode: 'ranked' }), ...Array.from({ length: 4 }, () => session({ mode: 'ranked', consumedAt: now }))]
    expect(chargeSnapshot(sessions, 'free', now)).toMatchObject({ remaining: 0, resumableModes: ['ranked'] })
  })
  it('keeps challenge-backed ranked reservations free', () => {
    expect(chargeSnapshot([session({ mode: 'ranked', challengeId: 'challenge' })], 'free', now)).toMatchObject({ used: 0, remaining: 5 })
  })
  it('exposes paid unlimited without increasing ranked attempts', () => {
    expect(chargeSnapshot([session({ mode: 'ranked', consumedAt: now })], 'ghost_plus', now)).toMatchObject({ limit: null, remaining: null, used: 1, rankedAvailable: true, plan: 'ghost_plus' })
  })
})

import { Entitlement, Run, RunSession, User } from '@/drizzle/schema'
import { POST } from '@/app/api/game/session/route'
import { POST as submitSession } from '@/app/api/game/submit/route'
import { POST as consumeSession } from '@/app/api/game/consume/route'
import { signSessionToken } from '@/lib/game/token'
import { GET as getChargeStatus } from '@/app/api/game/charges/route'

beforeEach(() => {
  query.mockReset()
  insert.mockReset()
  update.mockReset()
  lock.mockClear()
  process.env.GAME_SESSION_SECRET = 'test-secret'
})

describe('session charge enforcement', () => {
  function setup(sessions: TRunSession[], paid = false) {
    query.mockImplementation((table) => {
      if (table === User) return [{ id: 'user' }]
      if (table === Entitlement) return paid ? [{ plan: 'ghost_plus', status: 'active', currentPeriodEnd: new Date(Date.now() + 86400000) }] : []
      if (table === Run) return []
      if (table === RunSession) return sessions
      return []
    })
    insert.mockImplementation((values) => { sessions.push(values); return Promise.resolve() })
  }
  const request = (mode = 'ranked') => new Request('https://ghost.test/api/game/session', { method: 'POST', body: JSON.stringify({ mode }) })
  const spent = (mode = 'ranked') => session({ startedAt: new Date(), consumedAt: new Date(), mode })

  it('serializes submit against reservation replacement', async () => {
    setup([session({ state: 'submitted', startedAt: new Date() })])
    const token = signSessionToken({ sessionId: 's', userId: 'user', dailyGameId: 'daily', mode: 'practice', challengeId: null, engineVersion: 1, issuedAt: Date.now(), expiresAt: Date.now() + 10000 })
    expect((await submitSession(new Request('https://ghost.test/api/game/submit', { method: 'POST', body: JSON.stringify({ token, events: [] }) }))).status).toBe(200)
    expect(lock).toHaveBeenCalledWith('update')
  })
  it('serializes consumption against reservation replacement', async () => {
    setup([session({ startedAt: new Date(), expiresAt: new Date(Date.now() + 10000) })])
    const token = signSessionToken({ sessionId: 's', userId: 'user', dailyGameId: 'daily', mode: 'practice', challengeId: null, engineVersion: 1, issuedAt: Date.now(), expiresAt: Date.now() + 10000 })
    expect((await consumeSession(new Request('https://ghost.test/api/game/consume', { method: 'POST', body: JSON.stringify({ token }) }))).status).toBe(200)
    expect(lock).toHaveBeenCalledWith('update')
  })
  it('returns authenticated charge status without caching', async () => {
    setup([spent()])
    const response = await getChargeStatus()
    expect(await response.json()).toMatchObject({ limit: 5, used: 1, remaining: 4, plan: 'free' })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
  it('never recreates an active unconsumed session on request retry', async () => {
    const startedAt = new Date()
    setup([session({ id: 'existing', mode: 'ranked', startedAt, expiresAt: new Date(Date.now() + 10000) })])
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ sessionId: 'existing', resumed: true })
    expect(insert).not.toHaveBeenCalled()
  })
  it('rejects a sixth free start and provides reset information', async () => {
    setup(Array.from({ length: 5 }, () => spent()))
    const response = await POST(request())
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: 'charges-empty', remaining: 0, limit: 5, resetAt: expect.any(String) })
    expect(insert).not.toHaveBeenCalled()
    expect(lock).toHaveBeenCalledWith('update')
  })
  it('allows another practice after a consumed run', async () => {
    setup([spent()])
    expect((await POST(request())).status).toBe(200)
    expect(insert).toHaveBeenCalledOnce()
  })
  it('opens a fresh ranked run after a consumed attempt expires', async () => {
    setup([session({ startedAt: new Date(), mode: 'ranked', consumedAt: new Date(), state: 'expired', expiresAt: new Date(0) })])
    const response = await POST(request('ranked'))
    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledOnce()
  })
  it('allows unlimited paid practice', async () => {
    setup(Array.from({ length: 8 }, () => spent()), true)
    expect((await POST(request())).status).toBe(200)
  })
  it('reserves the fifth charge before a concurrent sixth start', async () => {
    setup(Array.from({ length: 4 }, () => spent()))
    const responses = await Promise.all([POST(request()), POST(request())])
    expect(responses.filter((r) => r.status === 200)).toHaveLength(2)
    const snapshots = await Promise.all(responses.map((response) => response.json()))
    expect(snapshots[0].sessionId).toBe(snapshots[1].sessionId)
    expect(insert).toHaveBeenCalledOnce()
    expect(database.transaction).toHaveBeenCalled()
  })
})

describe('paid entitlement', () => {
  it.each(['inactive', 'canceled', 'past_due', 'unpaid'])('denies %s even with a future period', async (status) => {
    query.mockResolvedValue([{ plan: 'ghost_plus', status, currentPeriodEnd: new Date(Date.now() + 86400000) }])
    expect(await getPlan('user')).toBe('free')
  })
  it.each([null, new Date(0), new Date('invalid')])('denies missing or expired periods: %s', async (currentPeriodEnd) => {
    query.mockResolvedValue([{ plan: 'ghost_plus', status: 'active', currentPeriodEnd }])
    expect(await getPlan('user')).toBe('free')
  })
  it.each(['active', 'trialing'])('accepts an unexpired %s subscription', async (status) => {
    query.mockResolvedValue([{ plan: 'ghost_plus', status, currentPeriodEnd: new Date(Date.now() + 86400000) }])
    expect(await getPlan('user')).toBe('ghost_plus')
  })
})
