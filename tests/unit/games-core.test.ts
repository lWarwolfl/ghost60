import { describe, expect, it } from 'vitest'
import { eventDigest, sha256Hex, stableStringify } from '@/games/core/digest'
import { validateEvents } from '@/games/core/events'
import { createRng, hashSeed } from '@/games/core/rng'
import { canTransition, transition } from '@/games/core/state'

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng('ghost60-day-1')
    const b = createRng('ghost60-day-1')
    expect([a.nextUint32(), a.nextUint32(), a.nextFloat()]).toEqual([
      b.nextUint32(),
      b.nextUint32(),
      b.nextFloat()
    ])
  })
  it('differs across seeds and respects int bounds', () => {
    expect(hashSeed('a')).not.toBe(hashSeed('b'))
    const rng = createRng('bounds')
    for (let i = 0; i < 200; i += 1) {
      const n = rng.nextInt(0, 5)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(5)
    }
  })
})

describe('validateEvents', () => {
  const opts = { maxEvents: 4, durationMs: 45000, allowedTypes: ['tap', 'choice'] as const }
  it('accepts a clean stream', () => {
    expect(
      validateEvents(
        [
          { t: 100, type: 'tap' },
          { t: 200, type: 'choice', value: 1 }
        ],
        opts
      ).valid
    ).toBe(true)
  })
  it('rejects non-monotonic, oversized, malformed and mistyped streams', () => {
    expect(validateEvents([{ t: 200, type: 'tap' }, { t: 100, type: 'tap' }], opts).invalidReason).toBe(
      'events-non-monotonic'
    )
    expect(
      validateEvents(
        [
          { t: 1, type: 'tap' },
          { t: 2, type: 'tap' },
          { t: 3, type: 'tap' },
          { t: 4, type: 'tap' },
          { t: 5, type: 'tap' }
        ],
        opts
      ).invalidReason
    ).toBe('too-many-events')
    expect(validateEvents([{ t: 1.5, type: 'tap' }], opts).valid).toBe(false)
    expect(validateEvents([{ t: 1, type: 'wiggle' }], opts).valid).toBe(false)
    expect(
      validateEvents([{ t: 1, type: 'tap', p: { x: 0, y: 99999 } }], { ...opts, allowedTypes: ['tap'] }).valid
    ).toBe(false)
  })
})

describe('state machine', () => {
  it('walks the happy path and rejects illegal jumps', () => {
    let s = transition('PRELOAD', 'LOADED')
    s = transition(s, 'START')
    s = transition(s, 'COUNTDOWN_DONE')
    s = transition(s, 'DURATION_END')
    s = transition(s, 'SUBMIT_BEGIN')
    expect(s).toBe('SUBMITTING')
    expect(() => transition('RUNNING', 'SUBMIT_OK')).toThrow()
    expect(canTransition('SUBMITTING', 'SUBMIT_FAIL')).toBe(true)
    expect(transition('SUBMITTING', 'SUBMIT_FAIL')).toBe('FINISHING')
  })
})

describe('digest', () => {
  it('matches the sha256 abc vector', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
  it('is key-order stable and deterministic', () => {
    expect(stableStringify({ b: 1, a: [3, 2] })).toBe(stableStringify({ a: [3, 2], b: 1 }))
    const d = { seed: 's', engineVersion: 1, config: { x: 1 }, events: [{ t: 1 }] }
    expect(eventDigest(d)).toBe(eventDigest(d))
  })
})
