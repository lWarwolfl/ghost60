import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: new Map<unknown, Record<string, unknown>[]>(),
  locks: vi.fn(),
  progression: vi.fn().mockResolvedValue({ xpAwarded: 120, unlocked: [], isPersonalBest: false }),
  paid: false,
}))
vi.mock('drizzle-orm', async (original) => ({
  ...(await original<typeof import('drizzle-orm')>()),
  eq: (column: unknown, value: unknown) => ({ column, value }),
  and: (...conditions: unknown[]) => conditions.filter(Boolean),
}))
vi.mock('@/drizzle', async () => {
  const { getTableColumns } = await import('drizzle-orm')
  const matches = (table: never, row: Record<string, unknown>, condition: unknown): boolean => {
    if (Array.isArray(condition)) return condition.every((item) => matches(table, row, item))
    const { column, value } = condition as { column: unknown; value: unknown }
    if (!column) return true
    const key = Object.entries(getTableColumns(table)).find(
      ([, candidate]) => candidate === column
    )?.[0]
    return !key || row[key] === value
  }
  const database = {
    select: () => ({
      from: (table: never) => {
        let conditions: unknown = []
        const chain = {
          where: (value: unknown) => {
            conditions = value
            return chain
          },
          orderBy: () => chain,
          for: (mode: string) => {
            state.locks(mode)
            return chain
          },
          then: (resolve: (rows: Record<string, unknown>[]) => unknown) =>
            Promise.resolve(
              (state.rows.get(table) ?? []).filter((row) => matches(table, row, conditions))
            ).then(resolve),
        }
        return chain
      },
    }),
    insert: (table: unknown) => ({
      values: (value: Record<string, unknown>) => {
        const row = { id: `insert-${state.rows.get(table)?.length ?? 0}`, ...value }
        state.rows.set(table, [...(state.rows.get(table) ?? []), row])
        const chain = {
          returning: async () => [row],
          onConflictDoNothing: () => chain,
          catch: () => Promise.resolve(),
          then: (resolve: () => unknown) => Promise.resolve().then(resolve),
        }
        return chain
      },
    }),
    update: (table: never) => ({
      set: (value: Record<string, unknown>) => ({
        where: async (condition: unknown) => {
          for (const row of state.rows.get(table) ?? [])
            if (matches(table, row, condition)) Object.assign(row, value)
        },
      }),
    }),
    transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(database),
  }
  return { db: database }
})
vi.mock('@/lib/auth/server', () => ({ getCurrentUser: async () => ({ id: 'recipient' }) }))
vi.mock('@/lib/game/rate-limit', () => ({ checkRateLimit: async () => true, RATE_LIMITS: {} }))
vi.mock('@/lib/game/entitlement', () => ({
  getPlan: async () => (state.paid ? 'ghost_plus' : 'free'),
  lockedResponse: () => Response.json({ error: 'ghost-plus-locked' }, { status: 403 }),
}))
vi.mock('@/lib/game/daily', () => ({
  getTodayDailyGame: async () => state.rows.get(DailyGame)?.[0],
  utcDayString: () => new Date().toISOString().slice(0, 10),
}))
vi.mock('@/lib/game/progression', () => ({
  applyProgression: state.progression,
  XP: { SHARE_FIRST_PER_DAY: 10 },
}))
vi.mock('@/lib/analytics/server', () => ({ recordServerEvent: vi.fn() }))
vi.mock('@/games/registry', () => ({
  getGame: () => ({
    validateConfig: () => ({}),
    durationMs: () => 60000,
    scoreRun: () => ({ valid: true, score: 200 }),
    sanitizeGhost: () => ({ timeline: [] }),
  }),
}))

import {
  Challenge,
  ChallengeAttempt,
  DailyGame,
  PlayerProfile,
  Run,
  RunSession,
  User,
} from '@/drizzle/schema'
import { POST as createSession } from '@/app/api/game/session/route'
import { POST as submit } from '@/app/api/game/submit/route'
import { POST as shareChallenge } from '@/app/api/challenges/route'

const challengeId = '00000000-0000-4000-8000-000000000001'
const dailyId = '00000000-0000-4000-8000-000000000002'
const sourceId = '00000000-0000-4000-8000-000000000003'
const request = (body: unknown) =>
  new Request('https://ghost.test/api/game/session', { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => {
  state.rows.clear()
  state.locks.mockClear()
  state.progression.mockClear()
  state.paid = false
  process.env.GAME_SESSION_SECRET = 'test-secret'
  state.rows.set(User, [{ id: 'recipient' }])
  state.rows.set(PlayerProfile, [{ userId: 'sender', handle: 'sender' }])
  state.rows.set(DailyGame, [
    {
      id: dailyId,
      gameDate: new Date().toISOString().slice(0, 10),
      gameId: 'pulse',
      seed: 'test',
      config: {},
      engineVersion: 1,
      publishAt: new Date(0),
      status: 'live',
    },
  ])
  state.rows.set(Challenge, [
    {
      id: challengeId,
      creatorUserId: 'sender',
      publicSlug: 'test',
      sourceRunId: sourceId,
      dailyGameId: dailyId,
      expiresAt: new Date(Date.now() + 86400000),
      disabledAt: null,
    },
  ])
  state.rows.set(Run, [
    { id: sourceId, userId: 'sender', dailyGameId: dailyId, validatedScore: 100, valid: true },
  ])
})

describe('challenge and ranked lifecycle', () => {
  it('satisfies both results for the first daily challenge, free even at zero charges', async () => {
    state.rows.set(
      RunSession,
      Array.from({ length: 5 }, (_, i) => ({
        id: `spent-${i}`,
        userId: 'recipient',
        dailyGameId: dailyId,
        mode: 'practice',
        consumedAt: new Date(),
        state: 'submitted',
        startedAt: new Date(),
        expiresAt: new Date(0),
        challengeId: null,
      }))
    )
    const created = await createSession(request({ mode: 'challenge', challengeId }))
    expect(created.status).toBe(200)
    const snapshot = await created.json()
    expect(snapshot).toMatchObject({
      mode: 'ranked',
      challenge: { id: challengeId, ghost: { timeline: [] } },
    })
    expect(snapshot.challenge).not.toHaveProperty('eventStream')
    const response = await submit(request({ token: snapshot.token, events: [] }))
    expect(await response.json()).toMatchObject({
      run: { mode: 'ranked' },
      outcome: 'win',
      progression: { xpAwarded: 120 },
    })
    expect(state.rows.get(ChallengeAttempt)).toHaveLength(1)
    expect(state.progression).toHaveBeenCalledWith(
      expect.objectContaining({ run: expect.objectContaining({ mode: 'ranked' }), outcome: 'win' }),
      expect.anything()
    )
    expect(state.locks).toHaveBeenCalledWith('update')
    const second = await createSession(request({ mode: 'ranked' }))
    expect(second.status).toBe(409)
    const duplicate = await submit(request({ token: snapshot.token, events: [] }))
    expect(await duplicate.json()).toMatchObject({ alreadySubmitted: true, outcome: 'win' })
    expect(state.progression).toHaveBeenCalledOnce()
  })

  it.each(['consumed', 'created'])(
    'does not grant another ranked attempt when a ranked session is %s',
    async (status) => {
      state.rows.set(RunSession, [
        {
          id: 'ranked',
          userId: 'recipient',
          dailyGameId: dailyId,
          mode: 'ranked',
          consumedAt: status === 'consumed' ? new Date() : null,
          state: status,
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 10000),
          challengeId: null,
        },
      ])
      const response = await createSession(request({ mode: 'challenge', challengeId }))
      expect(await response.json()).toMatchObject({ mode: 'challenge' })
    }
  )

  it('keeps historical challenges social and free', async () => {
    state.rows.get(DailyGame)![0].gameDate = '2026-01-01'
    expect(
      await (await createSession(request({ mode: 'challenge', challengeId }))).json()
    ).toMatchObject({ mode: 'challenge' })
  })

  it('resumes a dual-purpose ranked session with its challenge context from ordinary preflight', async () => {
    const first = await (await createSession(request({ mode: 'challenge', challengeId }))).json()
    const resumed = await (await createSession(request({ mode: 'ranked' }))).json()
    expect(resumed).toMatchObject({
      sessionId: first.sessionId,
      resumed: true,
      challenge: { id: challengeId },
    })
  })

  it('never reopens ranked after an exhausted technical retry', async () => {
    state.rows.set(RunSession, [
      {
        id: 'retry',
        userId: 'recipient',
        dailyGameId: dailyId,
        mode: 'ranked',
        consumedAt: null,
        state: 'expired',
        startedAt: new Date(),
        expiresAt: new Date(0),
        technicalRetryOf: 'original',
      },
    ])
    expect((await createSession(request({ mode: 'ranked' }))).status).toBe(409)
  })
})

describe('archive play', () => {
  it('requires premium to create archive challenges, not to receive them', async () => {
    state.rows.get(DailyGame)![0].gameDate = '2026-01-01'
    state.rows.get(Run)![0].userId = 'recipient'
    expect((await shareChallenge(request({ runId: sourceId }))).status).toBe(403)
    state.paid = true
    expect((await shareChallenge(request({ runId: sourceId }))).status).toBe(200)
  })

  it('gates historical practice and past self on the server', async () => {
    expect((await createSession(request({ mode: 'practice', dailyGameId: dailyId }))).status).toBe(
      403
    )
    state.rows.get(Run)![0].userId = 'recipient'
    expect(
      (await createSession(request({ mode: 'past_self', sourceRunId: sourceId }))).status
    ).toBe(403)
  })

  it('lets paid users race an owned historical ghost but never someone else’s', async () => {
    state.paid = true
    expect(
      (await createSession(request({ mode: 'past_self', sourceRunId: sourceId }))).status
    ).toBe(404)
    state.rows.get(Run)![0].userId = 'recipient'
    const response = await createSession(request({ mode: 'past_self', sourceRunId: sourceId }))
    expect(await response.json()).toMatchObject({
      mode: 'past_self',
      pastSelf: { runId: sourceId, targetScore: 100 },
    })
  })

  it('lets paid users practice archive days without granting ranked mode', async () => {
    state.paid = true
    state.rows.get(DailyGame)![0].gameDate = '2026-01-01'
    const response = await createSession(request({ mode: 'practice', dailyGameId: dailyId }))
    expect(await response.json()).toMatchObject({
      mode: 'practice',
      game: { id: dailyId, gameDate: '2026-01-01' },
    })
  })

  it('does not substitute today when an archive target is missing', async () => {
    state.paid = true
    expect(
      (await createSession(request({ mode: 'practice', dailyGameId: challengeId }))).status
    ).toBe(404)
  })
})
