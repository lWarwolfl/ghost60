import { z } from 'zod'
import { validateEvents } from '@/games/core/events'
import type {
  GameInputEvent,
  GameModule,
  SanitizedGhost,
  ScoreResult,
  SeededRng
} from '@/games/core/game-module'

const DURATION_MS = 45000

const PulseConfigSchema = z.object({
  pulses: z
    .array(
      z.object({
        targetMs: z.number().int().min(0).max(DURATION_MS),
        toleranceMs: z.number().int().min(60).max(600)
      })
    )
    .min(3)
    .max(20)
})

export type TPulseConfig = z.output<typeof PulseConfigSchema>

function sortedPulses(config: TPulseConfig) {
  return [...config.pulses].sort((a, b) => a.targetMs - b.targetMs)
}

export const pulseEngine: GameModule<TPulseConfig> = {
  id: 'pulse',
  engineVersion: 1,
  durationMs() {
    return DURATION_MS
  },
  validateConfig(config: unknown) {
    return PulseConfigSchema.parse(config)
  },
  createScenario(seed: string, config: TPulseConfig) {
    return { seed, pulses: sortedPulses(config) }
  },
  scoreRun({ config, events }): ScoreResult {
    const pulses = sortedPulses(config)
    const check = validateEvents(events, {
      maxEvents: pulses.length * 3,
      durationMs: DURATION_MS,
      allowedTypes: ['tap']
    })
    if (!check.valid) return { score: 0, valid: false, invalidReason: check.invalidReason, metrics: {} }
    const taps = events.filter((e) => e.type === 'tap')
    const used = new Array(taps.length).fill(false)
    let total = 0
    let hits = 0
    let perfects = 0
    for (const pulse of pulses) {
      let best = -1
      let bestDt = Number.POSITIVE_INFINITY
      for (let i = 0; i < taps.length; i += 1) {
        if (used[i]) continue
        const dt = Math.abs(taps[i].t - pulse.targetMs)
        if (dt < bestDt) {
          bestDt = dt
          best = i
        }
      }
      if (best === -1) continue
      used[best] = true
      const accuracy = Math.max(0, 1 - bestDt / pulse.toleranceMs)
      total += Math.round(1000 * accuracy * accuracy)
      if (accuracy > 0) hits += 1
      if (accuracy >= 0.999) perfects += 1
    }
    return {
      score: total,
      valid: true,
      metrics: { pulses: pulses.length, hits, perfects }
    } satisfies ScoreResult
  },
  sanitizeGhost({ config, events, score }) {
    const pulses = sortedPulses(config)
    const taps = events.filter((e) => e.type === 'tap')
    const used = new Array(taps.length).fill(false)
    let cum = 0
    const timeline = pulses.map((pulse, i) => {
      let best = -1
      let bestDt = Number.POSITIVE_INFINITY
      for (let j = 0; j < taps.length; j += 1) {
        if (used[j]) continue
        const dt = Math.abs(taps[j].t - pulse.targetMs)
        if (dt < bestDt) {
          bestDt = dt
          best = j
        }
      }
      if (best !== -1) {
        used[best] = true
        cum += Math.round(1000 * Math.max(0, 1 - bestDt / pulse.toleranceMs) ** 2)
      }
      return { t: pulse.targetMs, progress: (i + 1) / pulses.length, score: cum }
    })
    return { gameId: 'pulse', engineVersion: 1, score, timeline } satisfies SanitizedGhost
  },
  simulate({ config, skill, rng }: { seed: string; config: TPulseConfig; skill: number; rng: SeededRng }) {
    const pulses = sortedPulses(config)
    return pulses.map((pulse) => {
      const err = Math.round((rng.nextFloat() * 2 - 1) * (1 - skill) * pulse.toleranceMs * 1.2)
      return { t: Math.max(0, pulse.targetMs + err), type: 'tap' } satisfies GameInputEvent
    })
  }
}
