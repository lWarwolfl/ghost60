import { describe, expect, it } from 'vitest'
import {
  getLeagueLimits,
  percentilePoints,
  validateLeagueName,
  weekRangeUTC,
  weeklyScore
} from '@/lib/game/leagues'

describe('weekRangeUTC (Monday-Sunday UTC)', () => {
  it('maps Thursday to Mon-Sun', () => {
    expect(weekRangeUTC('2026-10-08')).toEqual({ start: '2026-10-05', end: '2026-10-11' })
  })
  it('keeps Sunday inside the same week', () => {
    expect(weekRangeUTC('2026-10-11')).toEqual({ start: '2026-10-05', end: '2026-10-11' })
  })
  it('keeps Monday as week start', () => {
    expect(weekRangeUTC('2026-10-05')).toEqual({ start: '2026-10-05', end: '2026-10-11' })
  })
})

describe('percentilePoints (single-day normalized, never cross-engine)', () => {
  it('returns 0 for missing run or empty population', () => {
    expect(percentilePoints([], 100)).toBe(0)
    expect(percentilePoints([10, 20], null)).toBe(0)
  })
  it('awards 100 to a sole participant', () => {
    expect(percentilePoints([420], 420)).toBe(100)
  })
  it('spreads winner/middle/loser across 0-100', () => {
    expect(percentilePoints([30, 50, 90], 90)).toBe(100)
    expect(percentilePoints([30, 50, 90], 50)).toBe(50)
    expect(percentilePoints([30, 50, 90], 30)).toBe(0)
  })
  it('splits ties without raw-score leakage', () => {
    expect(percentilePoints([50, 100, 100], 100)).toBe(75)
    expect(percentilePoints([50, 100, 100], 50)).toBe(0)
  })
})

describe('weeklyScore (best 5 of 7)', () => {
  it('sums top 5 daily points', () => {
    expect(weeklyScore([100, 90, 80, 70, 60, 50, 40])).toMatchObject({ total: 400, daysPlayed: 7 })
  })
  it('pads missing days with 0 without counting them played', () => {
    expect(weeklyScore([100, null, 80, null, null, null, null])).toMatchObject({
      total: 180,
      daysPlayed: 2
    })
  })
  it('handles fewer than 5 days', () => {
    expect(weeklyScore([100, 80])).toMatchObject({ total: 180, daysPlayed: 2 })
  })
})

describe('getLeagueLimits', () => {
  it('caps free and ghost_plus creation/membership/size', () => {
    expect(getLeagueLimits('free')).toMatchObject({ create: 1, join: 3, size: 12 })
    expect(getLeagueLimits('ghost_plus')).toMatchObject({ create: 5, join: 10, size: 12 })
    expect(getLeagueLimits('unknown-plan')).toMatchObject({ create: 1, join: 3, size: 12 })
  })
})

describe('validateLeagueName', () => {
  it('accepts normal names', () => {
    expect(validateLeagueName('Night Owls').ok).toBe(true)
  })
  it('rejects short, long, empty and control chars', () => {
    expect(validateLeagueName('ab').ok).toBe(false)
    expect(validateLeagueName('').ok).toBe(false)
    expect(validateLeagueName('x'.repeat(41)).ok).toBe(false)
    expect(validateLeagueName('Bad\nName').ok).toBe(false)
  })
})
