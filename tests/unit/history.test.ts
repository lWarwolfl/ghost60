import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ paid: false, results: [] as unknown[][], conditions: vi.fn(), order: vi.fn() }))
vi.mock('@/lib/auth/server', () => ({ getCurrentUser: async () => ({ id: 'player' }) }))
vi.mock('@/lib/game/entitlement', () => ({ getPlan: async () => state.paid ? 'ghost_plus' : 'free' }))
vi.mock('@/drizzle', () => ({ db: { select: () => {
  const result = state.results.shift() ?? []
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: (condition: unknown) => { state.conditions(condition); return chain },
    orderBy: (...columns: unknown[]) => { state.order(...columns); return chain },
    limit: async () => result,
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve)
  }
  return chain
} } }))

import { GET } from '@/app/api/history/route'
import { GET as archive } from '@/app/api/archive/route'

beforeEach(() => {
  state.paid = false
  state.results = []
  state.conditions.mockClear()
  state.order.mockClear()
})

describe('performance history', () => {
  it('returns seven-day free history without premium skill data', async () => {
    state.results = [[{ id: 'run', createdAt: new Date(), gameDate: '2026-10-19', score: 100 }]]
    const response = await GET(new Request('https://ghost.test/api/history'))
    expect(await response.json()).toMatchObject({ locked: true, skills: [], runs: [{ id: 'run' }], nextCursor: null })
    expect(state.conditions).toHaveBeenCalledOnce()
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('paginates tied timestamps with a validated id tiebreaker and includes paid skill charts', async () => {
    state.paid = true
    const createdAt = new Date('2026-10-19T00:00:00Z')
    const id = '00000000-0000-4000-8000-000000000001'
    state.results = [Array.from({ length: 51 }, () => ({ id, createdAt })), [{ gameId: 'pulse', gameDate: '2026-10-19', score: 200 }]]
    const first = await (await GET(new Request('https://ghost.test/api/history'))).json()
    expect(first.runs).toHaveLength(50)
    expect(first.skills).toEqual([{ gameId: 'pulse', gameDate: '2026-10-19', score: 200 }])
    expect(JSON.parse(first.nextCursor)).toEqual({ createdAt: createdAt.toISOString(), id })
    expect(state.order.mock.calls[0]).toHaveLength(2)
    state.results = [[], []]
    expect((await GET(new Request(`https://ghost.test/api/history?before=${encodeURIComponent(first.nextCursor)}`))).status).toBe(200)
  })

  it.each(['garbage', '{"createdAt":"bad","id":"bad"}', '2026-10-19'])('rejects invalid history cursor %s', async (cursor) => {
    expect((await GET(new Request(`https://ghost.test/api/history?before=${encodeURIComponent(cursor)}`))).status).toBe(400)
    expect(state.conditions).not.toHaveBeenCalled()
  })

  it('paginates the full paid archive and exposes owned source runs for past-self controls', async () => {
    state.paid = true
    state.results = [Array.from({ length: 31 }, (_, index) => ({ id: `day-${index}`, gameDate: `2026-01-${String(31 - index).padStart(2, '0')}`, gameId: 'pulse', title: 'Archive' })), [{ id: 'source', dailyGameId: 'day-0', mode: 'ranked', score: 200 }]]
    const result = await (await archive(new Request('https://ghost.test/api/archive?game=pulse'))).json()
    expect(result).toMatchObject({ locked: false, nextCursor: '2026-01-02', days: expect.any(Array) })
    expect(result.days).toHaveLength(30)
    expect(result.days[0]).toMatchObject({ sourceRunId: 'source', completed: true, bestScore: 200 })
  })

  it('rejects impossible archive dates and unknown game filters', async () => {
    expect((await archive(new Request('https://ghost.test/api/archive?before=2026-02-31'))).status).toBe(400)
    expect((await archive(new Request('https://ghost.test/api/archive?game=unknown'))).status).toBe(400)
  })
})
