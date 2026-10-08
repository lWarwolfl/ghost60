import { describe, expect, it } from 'vitest'
import { createRng } from '@/games/core/rng'
import { shiftEngine, type TShiftConfig } from '@/games/shift/engine'
import { arrowFor, currentShiftCard, shiftRuleFor } from '@/games/shift/table'

const config: TShiftConfig = shiftEngine.validateConfig({
  cards: [0, 1, 0, 1, 0, 1].map((correct, i) => ({
    correct: correct as 0 | 1,
    presentedMs: 1000 + i * 2000,
    windowMs: 2000
  }))
})

describe('shift scorer fixtures', () => {
  it('scores positional matches with reaction bonus', () => {
    const r = shiftEngine.scoreRun({
      seed: 's',
      config,
      events: config.cards.map((c, i) => ({ t: c.presentedMs + 100, type: 'choice' as const, value: (i % 2) as 0 | 1 })),
      visibilityInterruptions: 0
    })
    expect(r).toMatchObject({ valid: true, metrics: { correct: 6 } })
    expect(r.score).toBe(6 * 785 + 50)
  })
  it('caps the streak bonus at 500', () => {
    const big = shiftEngine.validateConfig({
      cards: Array.from({ length: 30 }, (_, i) => ({
        correct: (i % 2) as 0 | 1,
        presentedMs: 100 + i * 1000,
        windowMs: 1000
      }))
    })
    const r = shiftEngine.scoreRun({
      seed: 's',
      config: big,
      events: big.cards.map((c) => ({ t: c.presentedMs + 50, type: 'choice' as const, value: c.correct })),
      visibilityInterruptions: 0
    })
    expect(r.metrics).toMatchObject({ correct: 30, streakBonus: 500 })
  })
  it('skips missing cards without penalty but resets streak', () => {
    const r = shiftEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 1100, type: 'choice', value: 0 },
        { t: 3100, type: 'choice', value: 1 }
      ],
      visibilityInterruptions: 0
    })
    expect(r).toMatchObject({ valid: true, metrics: { correct: 2 } })
    expect(r.score).toBe(2 * 785)
  })
  it('ignores up to 4 extra choices and penalizes wrong ones', () => {
    const r = shiftEngine.scoreRun({
      seed: 's',
      config,
      events: [
        ...config.cards.map((c, i) => ({ t: c.presentedMs + 100, type: 'choice' as const, value: (i % 2) as 0 | 1 })),
        { t: 30000, type: 'choice' as const, value: 0 },
        { t: 31000, type: 'choice' as const, value: 1 }
      ],
      visibilityInterruptions: 0
    })
    expect(r).toMatchObject({ valid: true, metrics: { correct: 6 } })
    const wrong = shiftEngine.scoreRun({
      seed: 's',
      config,
      events: [{ t: 1100, type: 'choice', value: 1 }],
      visibilityInterruptions: 0
    })
    expect(wrong).toMatchObject({ score: 0, valid: true, metrics: { correct: 0 } })
  })
  it('rejects malformed streams cleanly', () => {
    const tooMany = shiftEngine.scoreRun({
      seed: 's',
      config,
      events: Array.from({ length: 11 }, (_, i) => ({ t: 1100 + i, type: 'choice' as const, value: 0 })),
      visibilityInterruptions: 0
    })
    expect(tooMany.valid).toBe(false)
    const nonMonotonic = shiftEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 3100, type: 'choice', value: 1 },
        { t: 1100, type: 'choice', value: 0 }
      ],
      visibilityInterruptions: 0
    })
    expect(nonMonotonic.valid).toBe(false)
    const wrongType = shiftEngine.scoreRun({
      seed: 's',
      config,
      events: [{ t: 1100, type: 'tap' }],
      visibilityInterruptions: 0
    })
    expect(wrongType.valid).toBe(false)
  })
})

describe('shift sanitized ghost', () => {
  it('exposes per-card progress but no correct answers', () => {
    const g = shiftEngine.sanitizeGhost({
      seed: 's',
      config,
      events: [{ t: 1100, type: 'choice', value: 0 }],
      score: 785
    })
    const raw = JSON.stringify(g)
    expect(raw).not.toContain('"correct"')
    expect(raw).not.toContain('"value"')
    expect(g.timeline).toHaveLength(6)
    expect(g.score).toBe(785)
  })
})

describe('shift simulation', () => {
  const simConfig = shiftEngine.validateConfig({
    cards: Array.from({ length: 8 }, (_, i) => ({
      correct: (i % 2) as 0 | 1,
      presentedMs: 1000 + i * 4000,
      windowMs: 2500
    }))
  })
  function mean(skill: number) {
    let total = 0
    for (let s = 0; s < 12; s += 1) {
      const events = shiftEngine.simulate!({ seed: 's', config: simConfig, skill, rng: createRng(`sh-${s}`) })
      const r = shiftEngine.scoreRun({ seed: 's', config: simConfig, events, visibilityInterruptions: 0 })
      expect(r.valid).toBe(true)
      total += r.score
    }
    return total / 12
  }
  it('is deterministic for the same rng seed', () => {
    const a = shiftEngine.simulate!({ seed: 's', config: simConfig, skill: 0.6, rng: createRng('det') })
    const b = shiftEngine.simulate!({ seed: 's', config: simConfig, skill: 0.6, rng: createRng('det') })
    expect(a).toEqual(b)
    expect(a).toHaveLength(8)
  })
  it('orders low < medium < high skill means', () => {
    const low = mean(0.2)
    const med = mean(0.5)
    const high = mean(0.9)
    expect(low).toBeLessThan(high)
    expect(med).toBeGreaterThanOrEqual(low)
    expect(med).toBeLessThanOrEqual(high)
  })
})

describe('shift table helpers', () => {
  it('reverses every 5th card', () => {
    expect(shiftRuleFor(0)).toBe('normal')
    expect(shiftRuleFor(3)).toBe('normal')
    expect(shiftRuleFor(4)).toBe('reversed')
    expect(shiftRuleFor(9)).toBe('reversed')
    expect(shiftRuleFor(10)).toBe('normal')
  })
  it('derives arrows that resolve to correct under the shown rule', () => {
    expect(arrowFor(0, 0)).toBe(0)
    expect(arrowFor(1, 0)).toBe(1)
    expect(arrowFor(0, 4)).toBe(1)
    expect(arrowFor(1, 4)).toBe(0)
  })
  it('points at the next unanswered card', () => {
    expect(currentShiftCard(6, 0)).toBe(0)
    expect(currentShiftCard(6, 5)).toBe(5)
    expect(currentShiftCard(6, 6)).toBe(-1)
    expect(currentShiftCard(6, 9)).toBe(-1)
  })
})
