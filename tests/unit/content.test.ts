import { describe, expect, it } from 'vitest'
import { buildDayConfig } from '@/games/content/builder'
import { loadCatalog, loadSchedule, validateScheduleRules, type TScheduleDay } from '@/games/content/schedule'
import { simulateDay } from '@/games/content/simulate'

const schedule = loadSchedule()
const catalog = loadCatalog()

describe('launch schedule rules', () => {
  it('holds 30 sequential days with known engines', () => {
    expect(schedule.days).toHaveLength(30)
    expect(schedule.days.map((d) => d.day)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
    const known = new Set(catalog.games.map((g) => g.id))
    for (const d of schedule.days) expect(known.has(d.engine)).toBe(true)
  })
  it('never repeats an engine on consecutive days', () => {
    expect(validateScheduleRules(schedule, catalog)).toEqual([])
    const broken = { ...schedule, days: [schedule.days[0], schedule.days[0]] as TScheduleDay[] }
    expect(validateScheduleRules(broken, catalog).join(' ')).toContain('consecutive')
  })
  it('uses catalog modifiers and sane difficulty', () => {
    for (const d of schedule.days) {
      const game = catalog.games.find((g) => g.id === d.engine)!
      expect(game.modifiers).toContain(d.modifier)
      expect(d.difficulty).toBeGreaterThanOrEqual(1)
      expect(d.difficulty).toBeLessThanOrEqual(5)
    }
  })
})

describe('day config builder', () => {
  it('builds deterministic configs for every day', () => {
    for (const day of schedule.days) {
      const a = buildDayConfig(day)
      const b = buildDayConfig(day)
      expect(a).toEqual(b)
      expect(a.seed).toBe(day.seedKey)
      expect(a.engine).toBe(day.engine)
    }
  })
  it('derives distinct seeds per day', () => {
    const seeds = new Set(schedule.days.map((d) => buildDayConfig(d).seed))
    expect(seeds.size).toBe(30)
  })
})

describe('day simulations', () => {
  it('produces valid streams on every day', () => {
    for (const day of schedule.days) {
      const built = buildDayConfig(day)
      const report = simulateDay(day, built.config, [0.25, 0.55, 0.9], 6)
      expect(report.invalidRuns).toBe(0)
      expect(report.highMean).toBeGreaterThan(0)
      expect(report.flags).toEqual(expect.arrayContaining([]))
    }
  }, 60000)
  it('is deterministic for the same day', () => {
    const day = schedule.days[0]
    const built = buildDayConfig(day)
    expect(simulateDay(day, built.config, [0.5], 4)).toEqual(simulateDay(day, built.config, [0.5], 4))
  })
})
