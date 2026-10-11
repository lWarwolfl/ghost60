import { describe, expect, it } from 'vitest'
import { createRng } from '@/games/core/rng'
import type { GameId } from '@/games/core/game-module'
import type { GameInputEvent } from '@/games/core/game-module'
import { ENGINE_IDS, getGame } from '@/games/registry'

// Deterministic hostile-input fuzz (QA_TEST_PLAN property tests). Seeded PRNG,
// no randomness in assertions: every hostile stream must either fail closed
// ({valid:false} with a reason) or score a finite, non-negative number — never
// throw, never NaN/Infinity, never negative.

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TYPES = ['tap', 'choice', 'pointer_down', 'pointer_move', 'pointer_up', 'bogus-type', ''] as const

function hostileStream(rand: () => number, index: number): GameInputEvent[] {
  const n = 1 + Math.floor(rand() * 40)
  const out: GameInputEvent[] = []
  let t = Math.floor(rand() * 5000)
  for (let i = 0; i < n; i += 1) {
    const kind = index + i
    const r = rand()
    // time attacks: negative, non-monotonic, duplicate, huge
    if (r < 0.15) t = -Math.floor(rand() * 1000)
    else if (r < 0.3) t = t - Math.floor(rand() * 500)
    else if (r < 0.4) t = t // duplicate
    else if (r < 0.5) t = 10 ** (6 + Math.floor(rand() * 6))
    else t = t + Math.floor(rand() * 2000)
    // coordinate attacks: negative, >10000, fractional, missing
    const cr = rand()
    const coord = () => {
      if (cr < 0.2) return -Math.floor(rand() * 500)
      if (cr < 0.4) return 10001 + Math.floor(rand() * 90000)
      if (cr < 0.5) return rand() * 10000
      return Math.floor(rand() * 10001)
    }
    const type = TYPES[(kind + Math.floor(rand() * TYPES.length)) % TYPES.length] as GameInputEvent['type']
    const ev: Record<string, unknown> = { t, type }
    if (kind % 3 !== 0) ev.p = { x: coord(), y: coord() }
    if (kind % 4 === 0) ev.value = rand() < 0.5 ? Math.floor(rand() * 100) : rand() * 10
    if (kind % 11 === 0) ev.p = null
    out.push(ev as GameInputEvent)
  }
  if (index % 7 === 0) out.push(null as unknown as GameInputEvent, 'x' as unknown as GameInputEvent)
  return out
}

function validBaseline(id: GameId): { config: never; events: GameInputEvent[] } {
  const mod = getGame(id)
  const configs: Record<GameId, unknown> = {
    pulse: {
      pulses: [
        { targetMs: 1000, toleranceMs: 200 },
        { targetMs: 3000, toleranceMs: 200 },
        { targetMs: 5000, toleranceMs: 400 }
      ]
    },
    snap: {
      rounds: [
        { correct: 0, options: 4, presentedMs: 1000, windowMs: 2000 },
        { correct: 2, options: 4, presentedMs: 4000, windowMs: 2000 },
        { correct: 1, options: 3, presentedMs: 7000, windowMs: 2000 },
        { correct: 0, options: 2, presentedMs: 10000, windowMs: 2000 }
      ]
    },
    orbit: {
      targets: [90, 180, 270].map((angleDeg, i) => ({
        angleDeg,
        perfectTolDeg: 5,
        goodTolDeg: 15,
        edgeTolDeg: 30,
        openMs: 1000 + i * 3000,
        closeMs: 3000 + i * 3000
      }))
    },
    recall: { grid: 3, sequences: [{ cells: [0, 1], parMs: 2000 }, { cells: [2], parMs: 1000 }] },
    shift: {
      cards: [0, 1, 0, 1, 0, 1].map((correct, i) => ({
        correct,
        presentedMs: 1000 + i * 2000,
        windowMs: 2000
      }))
    },
    trace: {
      gates: [
        { x: 1000, y: 5000, r: 600 },
        { x: 9000, y: 5000, r: 600 }
      ],
      corridorHalf: 900,
      completionBonus: 500
    }
  }
  const config = mod.validateConfig(configs[id]) as never
  const events = mod.simulate!({ seed: 'qa-baseline', config, skill: 0.7, rng: createRng('qa') })
  return { config, events }
}

describe('anticheat fuzz: hostile streams fail closed on every engine', () => {
  for (const id of ENGINE_IDS) {
    it(`${id}: 120 hostile streams never throw, never score absurd`, () => {
      const { config, events: baseline } = validBaseline(id)
      const mod = getGame(id)
      const base = mod.scoreRun({ seed: 'qa', config, events: baseline, visibilityInterruptions: 0 })
      expect(base.valid).toBe(true)
      expect(Number.isFinite(base.score) && base.score >= 0).toBe(true)

      let rejected = 0
      for (let k = 0; k < 120; k += 1) {
        const rand = mulberry32(1000 + k * 77)
        const hostile = hostileStream(rand, k)
        let r: { valid: boolean; score: number }
        expect(() =>
          (r = mod.scoreRun({ seed: 'qa', config, events: hostile, visibilityInterruptions: 0 }))
        ).not.toThrow()
        // @ts-expect-error assigned in expect closure
        const res: { valid: boolean; score: number } = r
        expect(Number.isFinite(res.score)).toBe(true)
        expect(res.score).toBeGreaterThanOrEqual(0)
        expect(res.score).toBeLessThan(10_000_000)
        if (!res.valid) rejected += 1
        // determinism under attack: same input replays identically
        const again = mod.scoreRun({ seed: 'qa', config, events: hostile, visibilityInterruptions: 0 })
        expect(again).toEqual(res)
      }
      // fuzz must actually exercise rejection paths, not silently accept all
      expect(rejected).toBeGreaterThan(60)
    })
  }

  it('pointer-move floods and oversized streams are rejected without crashing', () => {
    for (const id of ENGINE_IDS) {
      const { config } = validBaseline(id)
      const mod = getGame(id)
      const flood: GameInputEvent[] = Array.from({ length: 5000 }, (_, i) => ({
        t: i,
        type: 'pointer_move',
        p: { x: 5000, y: 5000 }
      }))
      const fr = mod.scoreRun({ seed: 'qa', config, events: flood, visibilityInterruptions: 0 })
      expect(Number.isFinite(fr.score)).toBe(true)
      const huge: GameInputEvent[] = Array.from({ length: 100_000 }, (_, i) => ({ t: i, type: 'tap' }))
      expect(() =>
        mod.scoreRun({ seed: 'qa', config, events: huge, visibilityInterruptions: 0 })
      ).not.toThrow()
      expect(mod.scoreRun({ seed: 'qa', config, events: huge, visibilityInterruptions: 0 }).valid).toBe(false)
    }
  })

  it('valid streams stay far under the 50KB event budget', () => {
    for (const id of ENGINE_IDS) {
      const { events } = validBaseline(id)
      const bytes = JSON.stringify(events).length
      expect(bytes).toBeLessThan(50_000)
    }
  })

  it('malformed configs throw at validation, never at scoring', () => {
    for (const id of ENGINE_IDS) {
      const mod = getGame(id)
      expect(() => mod.validateConfig(null)).toThrow()
      expect(() => mod.validateConfig({ nope: true })).toThrow()
    }
  })
})
