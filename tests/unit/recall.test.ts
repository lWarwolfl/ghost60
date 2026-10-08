import { describe, expect, it } from 'vitest'
import { createRng } from '@/games/core/rng'
import { recallEngine, type TRecallConfig } from '@/games/recall/engine'
import { recallLayout, resolveSequences, showSchedule } from '@/games/recall/table'

const config: TRecallConfig = recallEngine.validateConfig({
  grid: 3,
  sequences: [
    { cells: [0, 1], parMs: 2000 },
    { cells: [2], parMs: 1000 }
  ]
})

describe('recall scorer fixtures', () => {
  it('applies exact speed bonuses at 2950', () => {
    const r = recallEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 100, type: 'choice', value: 0 },
        { t: 300, type: 'choice', value: 1 },
        { t: 500, type: 'choice', value: 2 }
      ],
      visibilityInterruptions: 0
    })
    expect(r).toMatchObject({ score: 2950, valid: true, metrics: { completed: 2 } })
  })
  it('kills only the current sequence and continues the cursor', () => {
    const r = recallEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 100, type: 'choice', value: 0 },
        { t: 200, type: 'choice', value: 9 },
        { t: 300, type: 'choice', value: 2 }
      ],
      visibilityInterruptions: 0
    })
    expect(r).toMatchObject({ score: 1500, valid: true, metrics: { completed: 1 } })
  })
  it('scores an empty run at zero without invalidating', () => {
    const r = recallEngine.scoreRun({ seed: 's', config, events: [], visibilityInterruptions: 0 })
    expect(r).toMatchObject({ score: 0, valid: true, metrics: { completed: 0 } })
  })
  it('rejects malformed streams cleanly', () => {
    const nonMonotonic = recallEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 300, type: 'choice', value: 0 },
        { t: 100, type: 'choice', value: 1 }
      ],
      visibilityInterruptions: 0
    })
    expect(nonMonotonic.valid).toBe(false)
    const wrongType = recallEngine.scoreRun({
      seed: 's',
      config,
      events: [{ t: 100, type: 'tap' }],
      visibilityInterruptions: 0
    })
    expect(wrongType.valid).toBe(false)
    const nonInteger = recallEngine.scoreRun({
      seed: 's',
      config,
      events: [{ t: 100, type: 'choice', value: 1.5 }],
      visibilityInterruptions: 0
    })
    expect(nonInteger.valid).toBe(false)
    const tooMany = recallEngine.scoreRun({
      seed: 's',
      config,
      events: Array.from({ length: 129 }, (_, i) => ({ t: 100 + i, type: 'choice' as const, value: 0 })),
      visibilityInterruptions: 0
    })
    expect(tooMany.valid).toBe(false)
  })
})

describe('recall sanitized ghost', () => {
  it('exposes progress markers but no cells or values', () => {
    const g = recallEngine.sanitizeGhost({
      seed: 's',
      config,
      events: [
        { t: 100, type: 'choice', value: 0 },
        { t: 300, type: 'choice', value: 1 }
      ],
      score: 1450
    })
    const raw = JSON.stringify(g)
    expect(raw).not.toContain('"cells"')
    expect(raw).not.toContain('"value"')
    expect(g.timeline).toHaveLength(2)
    expect(g.timeline[0]).toMatchObject({ marker: 1 })
    expect(g.timeline[1]).toMatchObject({ marker: 0 })
  })
})

describe('recall simulation', () => {
  const simConfig = recallEngine.validateConfig({
    grid: 3,
    sequences: [
      { cells: [0, 1, 2], parMs: 6000 },
      { cells: [3, 4, 5, 6], parMs: 6000 },
      { cells: [7, 8], parMs: 3000 }
    ]
  })
  function mean(skill: number) {
    let total = 0
    for (let s = 0; s < 12; s += 1) {
      const events = recallEngine.simulate!({ seed: 's', config: simConfig, skill, rng: createRng(`rec-${s}`) })
      const r = recallEngine.scoreRun({ seed: 's', config: simConfig, events, visibilityInterruptions: 0 })
      expect(r.valid).toBe(true)
      total += r.score
    }
    return total / 12
  }
  it('is deterministic for the same rng seed', () => {
    const a = recallEngine.simulate!({ seed: 's', config: simConfig, skill: 0.6, rng: createRng('det') })
    const b = recallEngine.simulate!({ seed: 's', config: simConfig, skill: 0.6, rng: createRng('det') })
    expect(a).toEqual(b)
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

describe('recall table helpers', () => {
  it('schedules shows monotonically inside the run', () => {
    const sched = showSchedule(config)
    expect(sched).toHaveLength(2)
    expect(sched[0].showStart).toBeLessThan(sched[0].showEnd)
    expect(sched[0].showEnd).toBeLessThanOrEqual(sched[1].showStart)
    expect(sched[1].showEnd).toBeLessThan(50000)
  })
  it('resolves sequences exactly like the scorer', () => {
    const resolved = resolveSequences(config, [
      { t: 100, type: 'choice', value: 0 },
      { t: 200, type: 'choice', value: 9 },
      { t: 300, type: 'choice', value: 2 }
    ])
    expect(resolved).toEqual([
      { status: 'failed', used: 2 },
      { status: 'complete', used: 1 }
    ])
    expect(resolveSequences(config, [])).toEqual([
      { status: 'open', used: 0 },
      { status: 'open', used: 0 }
    ])
  })
  it('lays cells out inside the canvas without overlap', () => {
    const layout = recallLayout(300, 400, 3)
    expect(layout.cells).toHaveLength(9)
    for (const c of layout.cells) {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.y).toBeGreaterThanOrEqual(0)
      expect(c.x + c.size).toBeLessThanOrEqual(300)
      expect(c.y + c.size).toBeLessThanOrEqual(400)
    }
    expect(layout.pitch).toBeGreaterThan(layout.size)
    expect(recallLayout(300, 400, 3)).toEqual(layout)
  })
})
