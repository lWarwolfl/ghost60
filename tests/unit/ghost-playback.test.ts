import { describe, expect, it } from 'vitest'
import {
  ownedReplayGhost,
  ghostEventsAt,
  elapsedGhost,
  snapshotGhost,
} from '@/lib/game/ghost-playback'
import { pulseRadiusScale, activePulseIndex } from '@/games/pulse/table'
import { orbitEngine } from '@/games/orbit/engine'
import { snapEngine } from '@/games/snap/engine'
import { traceEngine } from '@/games/trace/engine'
import type { TGameSnapshot } from '@/features/game/store/game-store'

describe('past run playback', () => {
  const config = {
    rounds: Array.from({ length: 4 }, (_, i) => ({
      correct: 0,
      options: 2,
      presentedMs: 1000 + i * 3000,
      windowMs: 2000,
    })),
  }
  const events = [
    { type: 'choice' as const, value: 0, t: 1100 },
    { type: 'choice' as const, value: 1, t: 4200 },
  ]
  it('replays actual actions and scores at recorded times, without waiting for current input', () => {
    const scored = snapEngine.scoreRun({ seed: 's', config, events, visibilityInterruptions: 0 })
    const ghost = ownedReplayGhost('snap', 's', config, events, scored.score)
    expect(ghostEventsAt(ghost, 1099)).toEqual([])
    expect(ghostEventsAt(ghost, 1150)).toEqual([events[0]])
    expect(elapsedGhost(ghost, 1150)).toEqual([{ t: 1100, progress: 0.5, score: 985, delta: 985 }])
    expect(elapsedGhost(ghost, 4300).at(-1)).toMatchObject({ score: scored.score, delta: -250 })
  })
  it('keeps the public rival timeline free of input answers', () => {
    const ghost = snapEngine.sanitizeGhost({ seed: 's', config, events, score: 735 })
    expect(ghost.replay).toBeUndefined()
    expect(JSON.stringify(ghost)).not.toContain('"value"')
    expect(ghostEventsAt(undefined, 5000)).toEqual([])
    expect(elapsedGhost(undefined, 5000)).toEqual([])
  })
  it('normalizes older stored past-self and challenge snapshots for the race UI', () => {
    const ghost = ownedReplayGhost('snap', 's', config, events, 735)
    const snapshot = { pastSelf: { runId: 'owned', ghost, targetScore: 735 } } as TGameSnapshot
    expect(snapshotGhost(snapshot)).toMatchObject({ handle: 'YOUR GHOST', ghost, targetScore: 735 })
    expect(snapshotGhost({} as TGameSnapshot)).toBeNull()
  })
  it('does not lose gates or the final point while reducing a Trace ghost', () => {
    const config = {
      gates: [
        { x: 1000, y: 1000, r: 200 },
        { x: 9000, y: 1000, r: 200 },
      ],
      corridorHalf: 500,
      completionBonus: 500,
    }
    const events = Array.from({ length: 130 }, (_, i) => ({
      t: i * 20,
      type:
        i === 0
          ? ('pointer_down' as const)
          : i === 129
            ? ('pointer_up' as const)
            : ('pointer_move' as const),
      p: { x: Math.round(1000 + (i / 129) * 8000), y: 1000 },
    }))
    const result = traceEngine.scoreRun({ seed: 's', config, events, visibilityInterruptions: 0 })
    const ghost = traceEngine.sanitizeGhost({ seed: 's', config, events, score: result.score })
    expect(ghost.timeline.length).toBeLessThanOrEqual(61)
    expect(ghost.timeline.at(-1)).toMatchObject({
      t: 2580,
      p: { x: 9000, y: 1000 },
      progress: 1,
      score: result.score,
    })
  })
})

describe('Pulse target sizes', () => {
  it('changes after every pulse with repeatable, bounded sizes for every seed', () => {
    for (const seed of ['a', 'b', 'daily-2026-10-24']) {
      const sizes = Array.from({ length: 30 }, (_, i) => pulseRadiusScale(seed, i))
      expect(sizes).toEqual(Array.from({ length: 30 }, (_, i) => pulseRadiusScale(seed, i)))
      for (let i = 1; i < sizes.length; i++) expect(sizes[i]).not.toBe(sizes[i - 1])
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(0.7)
      expect(Math.max(...sizes)).toBeLessThanOrEqual(1.08)
    }
  })
  it('holds the correct band throughout the late scoring window before moving to the next', () => {
    const pulses = [
      { targetMs: 1000, toleranceMs: 200 },
      { targetMs: 3000, toleranceMs: 200 },
    ]
    expect(activePulseIndex(pulses, 1200)).toBe(0)
    expect(activePulseIndex(pulses, 1201)).toBe(1)
    expect(activePulseIndex(pulses, 45000)).toBe(1)
  })
})

describe('rival Orbit score fidelity', () => {
  it('uses interpolated hit points in public ghosts just as in authoritative scoring', () => {
    const config = {
      targets: [0, 1, 2].map((i) => ({
        angleDeg: 90,
        perfectTolDeg: 5,
        goodTolDeg: 15,
        edgeTolDeg: 30,
        openMs: 1000 + i * 3000,
        closeMs: 3000 + i * 3000,
      })),
    }
    const events = [100, 115, 90].map((value, i) => ({
      type: 'tap' as const,
      t: 2000 + i * 3000,
      value,
    }))
    const result = orbitEngine.scoreRun({ seed: 's', config, events, visibilityInterruptions: 0 })
    const ghost = orbitEngine.sanitizeGhost({ seed: 's', config, events, score: result.score })
    expect(result.score).toBe(2275)
    expect(ghost.timeline.at(-1)?.score).toBe(result.score)
  })
})
