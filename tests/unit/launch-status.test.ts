import { describe, expect, it } from 'vitest'
import { summarizeLaunchStatus } from '@/lib/game/launch-status'

describe('launch status', () => {
  it('summarizes authoritative grouped runs and sessions without trusting score analytics', () => {
    const result = summarizeLaunchStatus({
      now: new Date('2026-10-18T12:00:00Z'),
      scheduledDates: ['2026-10-18', '2026-10-20'],
      runs: [
        { valid: true, invalidReason: null, count: 6 },
        { valid: false, invalidReason: 'bad-duration', count: 1 },
        { valid: false, invalidReason: null, count: 1 },
      ],
      sessions: { total: 10, completed: 8 },
      events: [
        { eventName: 'challenge_opened', count: 4 },
        { eventName: 'score_submitted', count: 200 },
      ],
    })
    expect(result.runs).toEqual({
      total: 8,
      valid: 6,
      invalid: 2,
      invalidRate: 0.25,
      invalidReasons: { 'bad-duration': 1, unspecified: 1 },
    })
    expect(result.sessions.completionRatio).toBe(0.8)
    expect(result.analytics.challengeOpens).toBe(4)
    expect(result.analytics.errorEventsByName).toEqual({})
    expect(result.coverage.missingDates).toContain('2026-10-19')
    expect(result.coverage.missingDates).toHaveLength(28)
    expect(result.coverage.ready).toBe(false)
  })

  it('rolls the 30-day coverage window over at UTC midnight without failing zero samples', () => {
    const scheduledDates = Array.from({ length: 30 }, (_, index) =>
      new Date(Date.UTC(2026, 11, 31 + index)).toISOString().slice(0, 10)
    )
    const input = { scheduledDates, runs: [], sessions: { total: 0, completed: 0 }, events: [] }
    const before = summarizeLaunchStatus({ ...input, now: new Date('2026-12-31T23:59:59Z') })
    expect(before.coverage).toEqual({
      today: '2026-12-31',
      through: '2027-01-29',
      nextRolloverAt: '2027-01-01T00:00:00.000Z',
      missingDates: [],
      ready: true,
    })
    expect(before.runs).toEqual({
      total: 0,
      valid: 0,
      invalid: 0,
      invalidRate: null,
      invalidReasons: {},
    })
    expect(before.sessions).toEqual({ total: 0, completed: 0, completionRatio: null })
    expect(before.analytics.challengeOpens).toBe(0)
    expect(before.analytics.errorEventAllowlist).toEqual([])
    expect(before.analytics.errorEvents).toBeNull()
    const after = summarizeLaunchStatus({ ...input, now: new Date('2027-01-01T00:00:00Z') })
    expect(after.coverage.today).toBe('2027-01-01')
    expect(after.coverage.through).toBe('2027-01-30')
    expect(after.coverage.missingDates).toEqual(['2027-01-30'])
    expect(after.coverage.ready).toBe(false)
  })
})
