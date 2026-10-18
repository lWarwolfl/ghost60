import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import schedule from '../../content/launch-30-days.json'
import { db } from '@/drizzle'
import { DailyGame, GameDefinition } from '@/drizzle/schema'
import { buildDayConfig } from '@/games/content/builder'
import { getGame } from '@/games/registry'
import type { GameId } from '@/games/core/game-module'
import { getTodayDailyGame, utcDayString } from '@/lib/game/daily'

const mockedDb = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn() }))
vi.mock('@/drizzle', () => ({ db: mockedDb, dbClient: { end: vi.fn() } }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-18T11:00:00Z'))
  vi.stubEnv('NODE_ENV', 'production')
  vi.mocked(db.select).mockReturnValue({ from: () => ({ where: async () => [] }) } as never)
  vi.mocked(db.insert).mockImplementation(() => ({
    values: (values: object) => ({
      onConflictDoNothing: () => ({ returning: async () => [{ id: 'generated', ...values }] })
    })
  }) as never)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('daily availability', () => {
  it('rolls over by UTC rather than the local offset', async () => {
    vi.setSystemTime(new Date('2026-10-19T00:30:00+03:30'))
    expect(utcDayString()).toBe('2026-10-18')
    expect((await getTodayDailyGame())!.gameDate).toBe('2026-10-18')
    vi.setSystemTime(new Date('2026-10-19T00:00:00Z'))
    expect((await getTodayDailyGame())!.gameDate).toBe('2026-10-19')
  })

  it.each(['live', 'scheduled'])('preserves an existing published %s config exactly', async (status) => {
    const existing = { id: 'published', status, publishAt: new Date('2026-10-18T00:00:00Z'), config: { authored: 'untouched' } }
    vi.mocked(db.select).mockReturnValue({ from: () => ({ where: async () => [existing] }) } as never)
    expect(await getTodayDailyGame()).toBe(existing)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('builds valid deterministic content throughout and beyond a full rotation', async () => {
    const games = []
    for (let i = 0; i <= 30; i += 1) {
      vi.setSystemTime(new Date(Date.UTC(2026, 11, 9 + i)))
      const first = await getTodayDailyGame()
      expect(first).not.toBeNull()
      expect(await getTodayDailyGame()).toEqual(first)
      expect(getGame(first!.gameId as GameId).validateConfig(first!.config)).toEqual(first!.config)
      games.push(first)
    }
    expect(new Set(games.slice(0, 30).map((game) => game!.seed)).size).toBe(30)
    expect(games[30]!.config).toEqual(games[0]!.config)
    expect(games[30]!.seed).toBe(games[0]!.seed)
  })

  it('uses authored content in development too', async () => {
    const production = await getTodayDailyGame()
    vi.stubEnv('NODE_ENV', 'development')
    expect(await getTodayDailyGame()).toEqual(production)
  })

  it.each(['live', 'disabled', 'retired'])('reads the winning %s row after an insert conflict', async (status) => {
    const winner = { id: 'winner', status, publishAt: new Date('2026-10-18T00:00:00Z'), config: { preserved: true } }
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: () => ({ where: async () => [] }) } as never)
      .mockReturnValueOnce({ from: () => ({ where: async () => [winner] }) } as never)
    const conflict = vi.fn(() => ({ returning: async () => [] }))
    vi.mocked(db.insert).mockReturnValue({ values: () => ({ onConflictDoNothing: conflict }) } as never)
    expect(await getTodayDailyGame()).toBe(status === 'live' ? winner : null)
    expect(conflict).toHaveBeenCalledWith({ target: [GameDefinition.id, GameDefinition.engineVersion] })
    expect(conflict).toHaveBeenCalledWith({ target: DailyGame.gameDate })
  })

  it('propagates insert failures without disguising them as conflicts', async () => {
    const error = new Error('database unavailable')
    vi.mocked(db.insert).mockImplementation(() => { throw error })
    await expect(getTodayDailyGame()).rejects.toBe(error)
  })

  it('returns null if the conflicting day disappears before the read', async () => {
    vi.mocked(db.insert).mockReturnValue({ values: () => ({
      onConflictDoNothing: () => ({ returning: async () => [] })
    }) } as never)
    expect(await getTodayDailyGame()).toBeNull()
  })

  it('keeps a future publication unavailable without replacing it', async () => {
    const existing = { status: 'scheduled', publishAt: new Date('2026-10-18T12:00:00Z') }
    vi.mocked(db.select).mockReturnValue({ from: () => ({ where: async () => [existing] }) } as never)
    expect(await getTodayDailyGame()).toBeNull()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it.each(['disabled', 'retired'])('does not serve or regenerate an existing %s day', async (status) => {
    const existing = { id: 'published', status, config: { preserved: true } }
    vi.mocked(db.select).mockReturnValue({ from: () => ({ where: async () => [existing] }) } as never)
    expect(await getTodayDailyGame()).toBeNull()
    expect(db.insert).not.toHaveBeenCalled()
    expect(existing.config).toEqual({ preserved: true })
  })

  it('creates missing production content from the authored rotation before the imported window', async () => {
    const game = await getTodayDailyGame()
    expect(game).not.toBeNull()
    const dayIndex = Math.floor(Date.parse('2026-10-18T00:00:00Z') / 86400000)
    const day = schedule.days[dayIndex % schedule.days.length]
    const built = buildDayConfig(day)
    expect(game).toMatchObject({
      gameDate: '2026-10-18',
      gameId: day.engine,
      seed: built.seed,
      config: built.config,
      title: day.title,
      instruction: day.instruction,
      shareSubtitle: day.shareSubtitle,
      difficulty: day.difficulty,
      status: 'live',
      publishAt: new Date('2026-10-18T00:00:00Z')
    })
    expect(getGame(game!.gameId as GameId).validateConfig(game!.config)).toEqual(built.config)
    expect(db.insert).toHaveBeenCalledWith(GameDefinition)
    expect(db.insert).toHaveBeenCalledWith(DailyGame)
  })
})

describe('schedule importer', () => {
  it.each(['error', 'existing', 'inserted'])('reports %s inserts without hiding database failures', async (outcome) => {
    vi.resetModules()
    const error = new Error('database unavailable')
    mockedDb.select.mockReturnValue({ from: () => ({ where: async () => [{ id: 'existing-season' }] }) })
    mockedDb.insert.mockReturnValue({ values: () => ({
      then: (_resolve: unknown, reject: (error: Error) => unknown) => Promise.reject(error).catch(reject),
      onConflictDoNothing: () => ({ returning: async () => {
        if (outcome === 'error') throw error
        return outcome === 'existing' ? [] : [{ id: 'created' }]
      } })
    }) })
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'import-schedule', '--start=2026-11-09'])
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => {})
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})
    let finish!: (code: number | undefined) => void
    const finished = new Promise<number | undefined>((resolve) => { finish = resolve })
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { finish(code) }) as never)
    await import('../../scripts/import-schedule')
    expect(await finished).toBe(outcome === 'error' ? 1 : 0)
    if (outcome === 'error') expect(stderr).toHaveBeenCalledWith('database unavailable')
    else expect(stdout).toHaveBeenCalledWith(expect.stringContaining(
      outcome === 'existing' ? 'inserted=0 skipped-existing=30' : 'inserted=30 skipped-existing=0'
    ))
  })
})
