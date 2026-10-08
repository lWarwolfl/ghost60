import { describe, expect, it } from 'vitest'
import { createRng } from '@/games/core/rng'
import { angleDistDeg, orbitBand, orbitEngine, type TOrbitConfig } from '@/games/orbit/engine'
import {
  angleFromPoint,
  assignTaps,
  markerAngleAt,
  visibleRivalNotches
} from '@/games/orbit/table'

const config: TOrbitConfig = orbitEngine.validateConfig({
  targets: [
    { angleDeg: 90, perfectTolDeg: 5, goodTolDeg: 15, edgeTolDeg: 30, openMs: 1000, closeMs: 3000 },
    { angleDeg: 90, perfectTolDeg: 5, goodTolDeg: 15, edgeTolDeg: 30, openMs: 4000, closeMs: 6000 },
    { angleDeg: 90, perfectTolDeg: 5, goodTolDeg: 15, edgeTolDeg: 30, openMs: 7000, closeMs: 9000 }
  ]
})

describe('orbit scorer fixtures', () => {
  it('misses between windows without invalidating', () => {
    const r = orbitEngine.scoreRun({
      seed: 's',
      config,
      events: [{ t: 3500, type: 'tap', value: 90 }],
      visibilityInterruptions: 0
    })
    expect(r).toMatchObject({ score: 0, valid: true, metrics: { hits: 0 } })
  })
  it('floors repeated premature taps at zero', () => {
    const r = orbitEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 100, type: 'tap', value: 90 },
        { t: 200, type: 'tap', value: 90 },
        { t: 300, type: 'tap', value: 90 }
      ],
      visibilityInterruptions: 0
    })
    expect(r).toMatchObject({ score: 0, valid: true, metrics: { premature: 3 } })
  })
  it('rejects malformed streams cleanly', () => {
    const nonMonotonic = orbitEngine.scoreRun({
      seed: 's',
      config,
      events: [
        { t: 2000, type: 'tap', value: 90 },
        { t: 1000, type: 'tap', value: 90 }
      ],
      visibilityInterruptions: 0
    })
    expect(nonMonotonic.valid).toBe(false)
    const wrongType = orbitEngine.scoreRun({
      seed: 's',
      config,
      events: [{ t: 2000, type: 'choice', value: 0 }],
      visibilityInterruptions: 0
    })
    expect(wrongType.valid).toBe(false)
    const nonInteger = orbitEngine.scoreRun({
      seed: 's',
      config,
      events: [{ t: 2000, type: 'tap', value: 90.5 }],
      visibilityInterruptions: 0
    })
    expect(nonInteger.valid).toBe(false)
    const tooMany = orbitEngine.scoreRun({
      seed: 's',
      config,
      events: Array.from({ length: 10 }, (_, i) => ({ t: 1000 + i, type: 'tap' as const, value: 90 })),
      visibilityInterruptions: 0
    })
    expect(tooMany.valid).toBe(false)
  })
  it('interpolates bands exactly', () => {
    expect(orbitBand(0, config.targets[0])).toBe(1000)
    expect(orbitBand(5, config.targets[0])).toBe(1000)
    expect(orbitBand(10, config.targets[0])).toBe(825)
    expect(orbitBand(15, config.targets[0])).toBe(650)
    expect(orbitBand(25, config.targets[0])).toBe(450)
    expect(orbitBand(30, config.targets[0])).toBe(350)
    expect(orbitBand(31, config.targets[0])).toBe(0)
  })
  it('wraps angle distance across 0/360', () => {
    expect(angleDistDeg(359, 1)).toBe(2)
    expect(angleDistDeg(0, 180)).toBe(180)
  })
})

describe('orbit sanitized ghost', () => {
  it('leaks no angles or tap values', () => {
    const g = orbitEngine.sanitizeGhost({
      seed: 's',
      config,
      events: [{ t: 2000, type: 'tap', value: 90 }],
      score: 1000
    })
    expect(JSON.stringify(g)).not.toContain('angleDeg')
    expect(JSON.stringify(g)).not.toContain('"value"')
    expect(g.timeline).toHaveLength(3)
    expect(g.score).toBe(1000)
  })
})

describe('orbit simulation', () => {
  const simConfig = orbitEngine.validateConfig({
    targets: [0, 1, 2, 3, 4].map((i) => ({
      angleDeg: (i * 72) % 360,
      perfectTolDeg: 5,
      goodTolDeg: 15,
      edgeTolDeg: 30,
      openMs: 3000 + i * 7000,
      closeMs: 8000 + i * 7000
    }))
  })
  function mean(skill: number) {
    let total = 0
    for (let s = 0; s < 12; s += 1) {
      const events = orbitEngine.simulate!({ seed: 's', config: simConfig, skill, rng: createRng(`orb-${s}`) })
      total += orbitEngine.scoreRun({ seed: 's', config: simConfig, events, visibilityInterruptions: 0 }).score
    }
    return total / 12
  }
  it('is deterministic for the same rng seed', () => {
    const a = orbitEngine.simulate!({ seed: 's', config: simConfig, skill: 0.6, rng: createRng('det') })
    const b = orbitEngine.simulate!({ seed: 's', config: simConfig, skill: 0.6, rng: createRng('det') })
    expect(a).toEqual(b)
    expect(a).toHaveLength(5)
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

describe('orbit table helpers', () => {
  it('rotates the marker a full turn per period', () => {
    expect(markerAngleAt(0)).toBe(0)
    expect(markerAngleAt(1000)).toBe(90)
    expect(markerAngleAt(4000)).toBe(0)
    expect(markerAngleAt(500)).toBe(45)
  })
  it('converts tap points to compass degrees', () => {
    expect(angleFromPoint(1, 0, 0, 0)).toBe(0)
    expect(angleFromPoint(0, 1, 0, 0)).toBe(90)
    expect(angleFromPoint(-1, 0, 0, 0)).toBe(180)
  })
  it('assigns taps exactly like the scorer (tie to first, premature consumes)', () => {
    const taps = [
      { t: 3500, type: 'tap' as const, value: 90 },
      { t: 100, type: 'tap' as const, value: 90 }
    ]
    expect(assignTaps(config.targets, taps)).toEqual([0, 1, -1])
  })
  it('gates rival notches behind local taps', () => {
    const rival = [
      { targetIndex: 0, angleDeg: 95 },
      { targetIndex: 1, angleDeg: 80 }
    ]
    expect(visibleRivalNotches(config.targets, [], rival)).toEqual([])
    const taps = [{ t: 2000, type: 'tap' as const, value: 90 }]
    expect(visibleRivalNotches(config.targets, taps, rival)).toEqual([{ targetIndex: 0, angleDeg: 95 }])
  })
})
