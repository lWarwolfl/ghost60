import { describe, expect, it } from 'vitest'
import { feedbackState, committedGhost, pulseAssignments, recallFeedback, traceFeedback, inputTime, countdownState } from '@/lib/game/gameplay-motion'

describe('gameplay motion', () => {
  it('keeps input on the monotonic runtime boundary, independent of decoration', () => {
    expect(inputTime(2999, 3000, 45000, true)).toBe(-1)
    expect(inputTime(3000, 3000, 45000, true)).toBe(0)
    expect(inputTime(47999.8, 3000, 45000, true)).toBe(45000)
    expect(inputTime(48000, 3000, 45000, true)).toBe(-1)
    expect(inputTime(3100, 3000, 45000, false)).toBe(-1)
  })

  it('uses a fixed three second countdown with 700ms numerals and a 250ms GO', () => {
    expect(countdownState(699)).toEqual({ count: 3, visible: true })
    expect(countdownState(700)).toEqual({ count: 3, visible: false })
    expect(countdownState(1000)).toEqual({ count: 2, visible: true })
    expect(countdownState(2700)).toEqual({ count: 1, visible: false })
    expect(countdownState(3000)).toEqual({ count: 0, visible: true })
    expect(countdownState(3250)).toEqual({ count: 0, visible: false })
  })

  it('retains static feedback without decorative displacement in reduced motion', () => {
    expect(feedbackState(60, 120, true)).toEqual({ visible: true, opacity: 1, rise: 0, sparks: 0 })
    expect(feedbackState(-1, 120, false).visible).toBe(false)
    expect(feedbackState(120, 120, false).visible).toBe(false)
    expect(feedbackState(60, 120, false).sparks).toBeLessThanOrEqual(8)
  })

  it('reveals only committed corresponding ghost history and never future samples', () => {
    const timeline = [{ t: 100, score: 1 }, { t: 200, score: 2 }, { t: 300, score: 3 }]
    expect(committedGhost(timeline, [], 1000)).toEqual([])
    expect(committedGhost(timeline, [150], 1000)).toEqual([timeline[0]])
    expect(committedGhost(timeline, [150, null, 250], 250)).toEqual([timeline[0]])
    expect(committedGhost(timeline, [150, 260, 310], 250)).toEqual([timeline[0]])
    expect(committedGhost(timeline, [150, 260, 310], 320)).toEqual(timeline)
  })

  it('matches pulse scorer assignment rather than attributing every tap to the nearest target', () => {
    expect(pulseAssignments([{ targetMs: 1000 }, { targetMs: 2000 }], [{ t: 1900 }, { t: 2000 }])).toEqual([0, 1])
  })

  it('does not reveal Recall correctness until resolution and detects every failed round', () => {
    const config = { grid: 3 as const, sequences: [{ cells: [0, 1], parMs: 1000 }, { cells: [2, 3], parMs: 1000 }] }
    expect(recallFeedback(config, [{ t: 100, type: 'choice', value: 0 }])).toMatchObject({ status: 'open', cell: 0 })
    expect(recallFeedback(config, [{ t: 100, type: 'choice', value: 8 }, { t: 200, type: 'choice', value: 7 }])).toMatchObject({ status: 'failed', cell: 7, sequence: 1 })
    expect(recallFeedback(config, [{ t: 100, type: 'choice', value: 0 }, { t: 200, type: 'choice', value: 1 }])).toMatchObject({ status: 'complete', cells: [0, 1] })
  })

  it('derives trace precision, ordered gate times and bounded recent samples without mutating raw inputs', () => {
    const config = { gates: [{ x: 1000, y: 1000, r: 200 }, { x: 9000, y: 1000, r: 200 }], corridorHalf: 500, completionBonus: 500 }
    const events = [{ t: 0, type: 'pointer_down' as const, p: { x: 1000, y: 1000 } }, { t: 50, type: 'pointer_move' as const, p: { x: 5000, y: 1400 } }, { t: 100, type: 'pointer_up' as const, p: { x: 9000, y: 1000 } }]
    const copy = structuredClone(events)
    expect(traceFeedback(config, events)).toMatchObject({ passed: 2, gateTimes: [0, 100], precision: 880 })
    expect(traceFeedback(config, events).samples.map(p => p.band)).toEqual(['inside', 'near', 'inside'])
    expect(events).toEqual(copy)
  })
})
