import { describe, expect, it } from 'vitest'
import { buildDayConfig } from '@/games/content/builder'
import { buildFlashConfig } from '@/games/content/flash'
import { loadSchedule } from '@/games/content/schedule'
import { getGame } from '@/games/registry'
import type { GameId } from '@/games/core/game-module'
import { recallCellTiming, showSchedule } from '@/games/recall/table'
import type { TRecallConfig } from '@/games/recall/engine'

const days = loadSchedule().days

describe('Flash pacing', () => {
  it.each(days)('$title remains deterministic and valid', (day) => {
    const before = JSON.stringify(day)
    const flash = buildFlashConfig(day)
    const mod = getGame(day.engine as GameId)
    expect(mod.validateConfig(flash.config)).toEqual(flash.config)
    expect(buildFlashConfig(day)).toEqual(flash)
    expect(JSON.stringify(day)).toBe(before)
  })

  it.each(['pulse', 'snap', 'shift'] as const)(
    '%s has fewer prompts across the same run',
    (engine) => {
      const key = { pulse: 'pulses', snap: 'rounds', shift: 'cards' }[engine]
      for (const day of days.filter((day) => day.engine === engine)) {
        const regular = buildDayConfig(day).config as Record<string, unknown[]>
        const flash = buildFlashConfig(day).config as Record<string, unknown[]>
        expect(flash[key].length).toBeLessThanOrEqual(regular[key].length)
        expect(flash[key].length / regular[key].length).toBeGreaterThanOrEqual(0.85)
        if (flash[key].length === regular[key].length && engine === 'snap') {
          const first = flash[key][0] as { windowMs: number }
          const before = regular[key][0] as { windowMs: number }
          expect(first.windowMs).toBeGreaterThan(before.windowMs)
        }
      }
    }
  )

  it('slows Orbit while retaining reachable targets', () => {
    for (const day of days.filter((day) => day.engine === 'orbit')) {
      const regular = buildDayConfig(day).config as { markerPeriodMs: number }
      const flash = buildFlashConfig(day).config as { markerPeriodMs: number }
      expect(flash.markerPeriodMs).toBeGreaterThan(regular.markerPeriodMs)
    }
  })

  it('gives Recall flashes and answers 10% more time with matching schedules', () => {
    const day = days.find((day) => day.title === 'MEMORY LEAK')!
    const regular = buildDayConfig(day).config as TRecallConfig
    const flash = buildFlashConfig(day).config as TRecallConfig
    expect(recallCellTiming(regular)).toEqual({ slotMs: 800, onMs: 550 })
    expect(recallCellTiming(flash)).toEqual({ slotMs: 880, onMs: 605 })
    expect(flash.sequences.map((sequence) => sequence.cells)).toEqual(
      regular.sequences.map((sequence) => sequence.cells)
    )
    expect(showSchedule(flash, [])[0].showEnd - 800).toBe(flash.sequences[0].cells.length * 880)
    expect(flash.sequences[0].parMs).toBe(Math.round(regular.sequences[0].parMs * 1.1))
  })
})
