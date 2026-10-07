import { describe, expect, it } from 'vitest'
import { levelForXp, remainingWinXp, streakTransition, xpForLevel } from '@/lib/game/progression'

describe('level curve', () => {
  it('matches round(120 * level^1.35) thresholds', () => {
    expect(xpForLevel(1)).toBe(120)
    expect(levelForXp(0)).toMatchObject({ level: 1 })
    expect(levelForXp(119)).toMatchObject({ level: 1 })
    expect(levelForXp(120)).toMatchObject({ level: 2, intoLevel: 0 })
    expect(levelForXp(120 + xpForLevel(2) - 1).level).toBe(2)
    expect(levelForXp(120 + xpForLevel(2)).level).toBe(3)
  })
})

describe('streakTransition', () => {
  const base = { currentCount: 3, longestCount: 5, lastCompletedDate: '2026-10-06', graceTokens: 0, graceUsedTotal: 0 }
  it('extends consecutive days and is idempotent same-day', () => {
    expect(streakTransition(base, '2026-10-07', 1)).toMatchObject({ currentCount: 4, longestCount: 5, changed: true })
    expect(streakTransition({ ...base, lastCompletedDate: '2026-10-07' }, '2026-10-07', 1).changed).toBe(false)
  })
  it('repairs one missed day with grace and resets otherwise', () => {
    const repaired = streakTransition({ ...base, graceTokens: 1 }, '2026-10-08', 1)
    expect(repaired).toMatchObject({ currentCount: 4, graceTokens: 0, graceUsedTotal: 1, changed: true })
    const reset = streakTransition(base, '2026-10-09', 1)
    expect(reset).toMatchObject({ currentCount: 1, longestCount: 5, changed: true })
  })
  it('earns grace on 7-day multiples within cap', () => {
    const seventh = streakTransition({ ...base, currentCount: 6, lastCompletedDate: '2026-10-06' }, '2026-10-07', 1)
    expect(seventh).toMatchObject({ currentCount: 7, graceTokens: 1 })
    const capped = streakTransition({ ...base, currentCount: 13, graceTokens: 1, lastCompletedDate: '2026-10-06' }, '2026-10-07', 1)
    expect(capped).toMatchObject({ currentCount: 14, graceTokens: 1 })
  })
})

describe('remainingWinXp', () => {
  it('caps daily challenge-win xp at 100', () => {
    expect(remainingWinXp(0)).toBe(100)
    expect(remainingWinXp(90)).toBe(10)
    expect(remainingWinXp(100)).toBe(0)
    expect(remainingWinXp(140)).toBe(0)
  })
})
