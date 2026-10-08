import { describe, expect, it } from 'vitest'
import { createRng } from '@/games/core/rng'
import type { GameInputEvent } from '@/games/core/game-module'
import { traceEngine, type TTraceConfig } from '@/games/trace/engine'
import { delayedRivalPath, passedGates, toFixedPoint, toScreen, traceView } from '@/games/trace/table'

const config: TTraceConfig = traceEngine.validateConfig({
  gates: [
    { x: 1000, y: 5000, r: 600 },
    { x: 5000, y: 5000, r: 600 },
    { x: 9000, y: 5000, r: 600 }
  ],
  corridorHalf: 900,
  completionBonus: 500
})

function lineEvents(t0 = 0, step = 50): GameInputEvent[] {
  const events: GameInputEvent[] = [{ t: t0, type: 'pointer_down' as const, p: { x: 1000, y: 5000 } }]
  for (let i = 1; i <= 16; i += 1) {
    events.push({ t: t0 + i * step, type: 'pointer_move' as const, p: { x: 1000 + i * 500, y: 5000 } })
  }
  events.push({ t: t0 + 17 * step, type: 'pointer_up' as const, p: { x: 9000, y: 5000 } })
  return events
}

describe('trace scorer fixtures', () => {
  it('scores a clean line with bonus', () => {
    const r = traceEngine.scoreRun({ seed: 's', config, events: lineEvents(), visibilityInterruptions: 0 })
    expect(r).toMatchObject({ valid: true, metrics: { gates: 3, passed: 3, precision: 1200 } })
    expect(r.score).toBe(3 * 800 + 1200 + 500)
  })
  it('withholds the bonus without a final pointer_up', () => {
    const events = lineEvents().slice(0, -1)
    const r = traceEngine.scoreRun({ seed: 's', config, events, visibilityInterruptions: 0 })
    expect(r).toMatchObject({ valid: true, metrics: { passed: 3 } })
    expect(r.score).toBe(3 * 800 + 1200)
  })
  it('scores an empty run at zero', () => {
    const r = traceEngine.scoreRun({ seed: 's', config, events: [], visibilityInterruptions: 0 })
    expect(r).toMatchObject({ score: 0, valid: true, metrics: { passed: 0, precision: 0 } })
  })
  it('passes gates strictly in order', () => {
    const r = traceEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 0, type: 'pointer_down', p: { x: 5000, y: 5000 } },
        { t: 50, type: 'pointer_move', p: { x: 1000, y: 5000 } },
        { t: 100, type: 'pointer_move', p: { x: 5000, y: 5000 } },
        { t: 150, type: 'pointer_up', p: { x: 5000, y: 5000 } }
      ],
      visibilityInterruptions: 0
    })
    expect(r.metrics).toMatchObject({ passed: 2 })
  })
  it('drains precision off-corridor instead of failing', () => {
    const r = traceEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 0, type: 'pointer_down', p: { x: 1000, y: 9000 } },
        { t: 50, type: 'pointer_move', p: { x: 9000, y: 9000 } },
        { t: 100, type: 'pointer_up', p: { x: 9000, y: 9000 } }
      ],
      visibilityInterruptions: 0
    })
    expect(r).toMatchObject({ valid: true, metrics: { passed: 0, precision: 0 } })
    expect(r.score).toBe(0)
  })
  it('rejects malformed streams cleanly', () => {
    const badType = traceEngine.scoreRun({
      seed: 's',
      config,
      events: [{ t: 100, type: 'tap' }],
      visibilityInterruptions: 0
    })
    expect(badType.valid).toBe(false)
    const badPoint = traceEngine.scoreRun({
      seed: 's',
      config,
      events: [{ t: 100, type: 'pointer_down', p: { x: 10001, y: 5000 } }],
      visibilityInterruptions: 0
    })
    expect(badPoint.valid).toBe(false)
    const nonMonotonic = traceEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 200, type: 'pointer_down', p: { x: 1000, y: 5000 } },
        { t: 100, type: 'pointer_up', p: { x: 1000, y: 5000 } }
      ],
      visibilityInterruptions: 0
    })
    expect(nonMonotonic.valid).toBe(false)
    const tooMany = traceEngine.scoreRun({
      seed: 's',
      config,
      events: Array.from({ length: 2049 }, (_, i) => ({ t: i, type: 'pointer_move' as const, p: { x: 5000, y: 5000 } })),
      visibilityInterruptions: 0
    })
    expect(tooMany.valid).toBe(false)
  })
})

describe('trace sanitized ghost', () => {
  it('downsamples the path and keeps the score', () => {
    const many = lineEvents(0, 10).flatMap((e) =>
      Array.from({ length: 10 }, (_, k) => ({ ...e, t: e.t * 10 + k }))
    )
    const g = traceEngine.sanitizeGhost({ seed: 's', config, events: many, score: 4100 })
    expect(g.timeline.length).toBeLessThanOrEqual(61)
    expect(g.timeline[0]).toHaveProperty('p')
    expect(g.timeline[0]).toHaveProperty('t')
    expect(g.score).toBe(4100)
  })
})

describe('trace simulation', () => {
  const simConfig = traceEngine.validateConfig({
    gates: [
      { x: 1000, y: 5000, r: 600 },
      { x: 5000, y: 5000, r: 600 },
      { x: 9000, y: 5000, r: 600 }
    ],
    corridorHalf: 900,
    completionBonus: 500
  })
  function mean(skill: number) {
    let total = 0
    for (let s = 0; s < 12; s += 1) {
      const events = traceEngine.simulate!({ seed: 's', config: simConfig, skill, rng: createRng(`tr-${s}`) })
      const r = traceEngine.scoreRun({ seed: 's', config: simConfig, events, visibilityInterruptions: 0 })
      expect(r.valid).toBe(true)
      total += r.score
    }
    return total / 12
  }
  it('is deterministic for the same rng seed', () => {
    const a = traceEngine.simulate!({ seed: 's', config: simConfig, skill: 0.6, rng: createRng('det') })
    const b = traceEngine.simulate!({ seed: 's', config: simConfig, skill: 0.6, rng: createRng('det') })
    expect(a).toEqual(b)
    expect(a[0].type).toBe('pointer_down')
    expect(a[a.length - 1].type).toBe('pointer_up')
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

describe('trace table helpers', () => {
  it('maps screen to fixed point and back', () => {
    const view = traceView(300, 500)
    const p = toFixedPoint(150, 250, 300, 500)
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.x).toBeLessThanOrEqual(10000)
    expect(p.y).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeLessThanOrEqual(10000)
    const back = toScreen(p, view)
    expect(Math.abs(back.x - 150)).toBeLessThan(40)
    expect(Math.abs(back.y - 250)).toBeLessThan(40)
  })
  it('clamps outside taps into range', () => {
    expect(toFixedPoint(-50, 99999, 300, 500)).toMatchObject({ x: 0, y: 10000 })
  })
  it('mirrors the scorer gate walk', () => {
    expect(passedGates(config.gates, [{ x: 5000, y: 5000 }, { x: 1000, y: 5000 }, { x: 5000, y: 5000 }])).toBe(2)
    expect(passedGates(config.gates, [])).toBe(0)
  })
  it('delays rival paths by at least 500ms', () => {
    const pts = [
      { t: 1000, p: { x: 1, y: 1 } },
      { t: 1400, p: { x: 2, y: 2 } },
      { t: 1600, p: { x: 3, y: 3 } }
    ]
    expect(delayedRivalPath(pts, 2000)).toHaveLength(2)
    expect(delayedRivalPath(pts, 1400)).toHaveLength(0)
    expect(delayedRivalPath(pts, 10000)).toHaveLength(3)
  })
})
