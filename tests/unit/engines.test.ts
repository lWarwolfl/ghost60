import { describe, expect, it } from 'vitest'
import { createRng } from '@/games/core/rng'
import { orbitEngine } from '@/games/orbit/engine'
import { pulseEngine } from '@/games/pulse/engine'
import { recallEngine } from '@/games/recall/engine'
import { ENGINE_IDS, getGame } from '@/games/registry'
import { shiftEngine } from '@/games/shift/engine'
import { snapEngine } from '@/games/snap/engine'
import { traceEngine } from '@/games/trace/engine'

describe('registry', () => {
  it('exposes six versioned engines', () => {
    expect(ENGINE_IDS.sort()).toEqual(['orbit', 'pulse', 'recall', 'shift', 'snap', 'trace'])
    expect(getGame('pulse').engineVersion).toBe(1)
  })
})

describe('pulse', () => {
  const config = pulseEngine.validateConfig({
    pulses: [
      { targetMs: 1000, toleranceMs: 200 },
      { targetMs: 2000, toleranceMs: 200 },
      { targetMs: 3000, toleranceMs: 400 }
    ]
  })
  it('scores a known fixture at 1500', () => {
    const r = pulseEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 1000, type: 'tap' },
        { t: 2100, type: 'tap' },
        { t: 3200, type: 'tap' }
      ],
      visibilityInterruptions: 0
    })
    expect(r).toMatchObject({ score: 1500, valid: true, metrics: { pulses: 3, hits: 3, perfects: 1 } })
  })
  it('fails malformed streams cleanly and simulates deterministically', () => {
    const bad = pulseEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 2000, type: 'tap' },
        { t: 1000, type: 'tap' }
      ],
      visibilityInterruptions: 0
    })
    expect(bad.valid).toBe(false)
    const a = pulseEngine.simulate!({ seed: 's', config, skill: 0.7, rng: createRng('sim') })
    const b = pulseEngine.simulate!({ seed: 's', config, skill: 0.7, rng: createRng('sim') })
    expect(a).toEqual(b)
    expect(a).toHaveLength(3)
  })
})

describe('snap', () => {
  const config = snapEngine.validateConfig({
    rounds: [
      { correct: 0, options: 4, presentedMs: 1000, windowMs: 2000 },
      { correct: 2, options: 4, presentedMs: 4000, windowMs: 2000 },
      { correct: 1, options: 3, presentedMs: 7000, windowMs: 2000 },
      { correct: 0, options: 2, presentedMs: 10000, windowMs: 2000 }
    ]
  })
  it('scores correct plus wrong at 1455 with floor', () => {
    const r = snapEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 1200, type: 'choice', value: 0 },
        { t: 4500, type: 'choice', value: 1 },
        { t: 7100, type: 'choice', value: 1 },
        { t: 10500, type: 'choice', value: 1 }
      ],
      visibilityInterruptions: 0
    })
    expect(r.score).toBe(1455)
    expect(r.metrics).toMatchObject({ rounds: 4, correct: 2 })
  })
  it('sanitized ghost leaks no choice values', () => {
    const g = snapEngine.sanitizeGhost({
      seed: 's',
      config,
      events: [{ t: 1200, type: 'choice', value: 0 }],
      score: 970
    })
    expect(JSON.stringify(g)).not.toContain('"value"')
    expect(g.timeline).toHaveLength(4)
  })
})

describe('orbit', () => {
  const config = orbitEngine.validateConfig({
    targets: [
      { angleDeg: 90, perfectTolDeg: 5, goodTolDeg: 15, edgeTolDeg: 30, openMs: 1000, closeMs: 3000 },
      { angleDeg: 90, perfectTolDeg: 5, goodTolDeg: 15, edgeTolDeg: 30, openMs: 4000, closeMs: 6000 },
      { angleDeg: 90, perfectTolDeg: 5, goodTolDeg: 15, edgeTolDeg: 30, openMs: 7000, closeMs: 9000 }
    ]
  })
  it('scores perfect/good/edge bands at 1000/825/450', () => {
    const r = orbitEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 2000, type: 'tap', value: 90 },
        { t: 5000, type: 'tap', value: 100 },
        { t: 8000, type: 'tap', value: 115 }
      ],
      visibilityInterruptions: 0
    })
    expect(r.score).toBe(2275)
    expect(r.metrics).toMatchObject({ targets: 3, hits: 3, perfects: 1 })
  })
  it('penalizes premature taps', () => {
    const r = orbitEngine.scoreRun({
      seed: 's',
      config,
      events: [{ t: 500, type: 'tap', value: 90 }],
      visibilityInterruptions: 0
    })
    expect(r.metrics).toMatchObject({ premature: 1 })
    expect(r.score).toBe(0)
  })
})

describe('recall', () => {
  const config = recallEngine.validateConfig({
    grid: 3,
    sequences: [
      { cells: [0, 1, 2], parMs: 3000 },
      { cells: [3, 4], parMs: 3000 }
    ]
  })
  it('scores completed sequences at 2950', () => {
    const r = recallEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 100, type: 'choice', value: 0 },
        { t: 200, type: 'choice', value: 1 },
        { t: 300, type: 'choice', value: 2 },
        { t: 800, type: 'choice', value: 3 },
        { t: 900, type: 'choice', value: 4 }
      ],
      visibilityInterruptions: 0
    })
    expect(r).toMatchObject({ score: 2950, valid: true, metrics: { completed: 2 } })
  })
  it('ends the sequence on a wrong cell and leaks no cells', () => {
    const r = recallEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 100, type: 'choice', value: 0 },
        { t: 200, type: 'choice', value: 5 }
      ],
      visibilityInterruptions: 0
    })
    expect(r).toMatchObject({ score: 0, metrics: { completed: 0 } })
    const g = recallEngine.sanitizeGhost({
      seed: 's',
      config,
      events: [{ t: 100, type: 'choice', value: 0 }],
      score: 0
    })
    expect(JSON.stringify(g)).not.toContain('"cells"')
    expect(JSON.stringify(g)).not.toContain('"value"')
  })
})

describe('shift', () => {
  const config = shiftEngine.validateConfig({
    cards: Array.from({ length: 6 }, (_, i) => ({ correct: (i % 2) as 0 | 1, presentedMs: 1000 + i * 2000, windowMs: 2000 }))
  })
  it('scores six fast correct with capped streak bonus at 4760', () => {
    const r = shiftEngine.scoreRun({
      seed: 's',
      config,
      events: config.cards.map((c, i) => ({ t: c.presentedMs + 100, type: 'choice' as const, value: (i % 2) as 0 | 1 })),
      visibilityInterruptions: 0
    })
    expect(r.score).toBe(4760)
    expect(r.metrics).toMatchObject({ correct: 6, streakBonus: 50 })
  })
})

describe('trace', () => {
  const config = traceEngine.validateConfig({
    gates: [
      { x: 0, y: 5000, r: 500 },
      { x: 10000, y: 5000, r: 500 }
    ],
    corridorHalf: 1000,
    completionBonus: 500
  })
  it('scores a clean line at 3300', () => {
    const moves = Array.from({ length: 9 }, (_, i) => ({
      t: 100 + i * 50,
      type: 'pointer_move' as const,
      p: { x: 1000 * (i + 1), y: 5000 }
    }))
    const r = traceEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 0, type: 'pointer_down', p: { x: 0, y: 5000 } },
        ...moves,
        { t: 600, type: 'pointer_up', p: { x: 10000, y: 5000 } }
      ],
      visibilityInterruptions: 0
    })
    expect(r).toMatchObject({ score: 3300, valid: true, metrics: { gates: 2, passed: 2 } })
  })
})
