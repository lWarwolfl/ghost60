import { describe, expect, it } from 'vitest'
import { buildDayConfig } from '@/games/content/builder'
import { loadCatalog, loadSchedule, validateScheduleRules, type TScheduleDay } from '@/games/content/schedule'
import { simulateDay } from '@/games/content/simulate'
import { angleDistDeg } from '@/games/orbit/engine'
import { markerAngleAt } from '@/games/orbit/table'

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
  it('documents the orbit live/early-tap rule', () => {
    const orbit = catalog.games.find((game) => game.id === 'orbit')!
    expect(orbit.instruction.toLowerCase()).toContain('cyan')
    expect(orbit.instruction.toLowerCase()).toContain('early taps')
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
  it('aligns every orbit arc with the marker midpoint', () => {
    const orbitDays = schedule.days.filter((d) => d.engine === 'orbit')
    expect(orbitDays.length).toBeGreaterThan(0)
    for (const day of orbitDays) {
      const built = buildDayConfig(day)
      const config = built.config as {
        targets: Array<{ angleDeg: number; openMs: number; closeMs: number; perfectTolDeg: number }>
        markerPeriodMs?: number
        markerRamp?: number
      }
      for (const target of config.targets) {
        const marker = markerAngleAt(
          (target.openMs + target.closeMs) / 2,
          config.markerPeriodMs,
          config.markerRamp ?? 0
        )
        expect(angleDistDeg(marker, target.angleDeg)).toBeLessThanOrEqual(target.perfectTolDeg)
      }
    }
  })
  it('randomizes orbit angles and overlaps live windows', () => {
    const orbitDays = schedule.days.filter((d) => d.engine === 'orbit')
    for (const day of orbitDays) {
      const config = buildDayConfig(day).config as {
        targets: Array<{ angleDeg: number; openMs: number; closeMs: number }>
      }
      const targets = config.targets
      expect(targets.some((t, i) => i > 0 && t.openMs < targets[i - 1].closeMs)).toBe(true)
      const maxLive = Math.max(
        ...targets.flatMap((target) => [target.openMs, target.closeMs]).map(
          (ms) => targets.filter((target) => target.openMs <= ms && ms < target.closeMs).length
        )
      )
      expect(maxLive).toBeGreaterThanOrEqual(2)
      const turns = targets
        .slice(1)
        .map((target, i) => ((target.angleDeg - targets[i].angleDeg + 540) % 360) - 180)
      expect(new Set(turns.map((turn) => Math.round(turn))).size).toBeGreaterThan(3)
    }
  })
  it('builds longer trace paths', () => {
    const traceDays = schedule.days.filter((d) => d.engine === 'trace')
    expect(traceDays.length).toBeGreaterThan(0)
    for (const day of traceDays) {
      const config = buildDayConfig(day).config as { gates: unknown[] }
      expect(config.gates.length).toBeGreaterThanOrEqual(18)
    }
  })
  it('keeps pulse windows constant while the rhythm accelerates', () => {
    const pulseDays = schedule.days.filter((d) => d.engine === 'pulse')
    expect(pulseDays.length).toBeGreaterThan(0)
    for (const day of pulseDays) {
      const config = buildDayConfig(day).config as {
        pulses: Array<{ targetMs: number; toleranceMs: number }>
      }
      expect(new Set(config.pulses.map((p) => p.toleranceMs)).size).toBe(1)
      const gaps = config.pulses.slice(1).map((p, i) => p.targetMs - config.pulses[i].targetMs)
      expect(gaps[gaps.length - 1]).toBeLessThan(gaps[0])
    }
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
