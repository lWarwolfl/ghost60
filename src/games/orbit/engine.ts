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
const PREMATURE_PENALTY = 100

const OrbitTargetSchema = z
  .object({
    angleDeg: z.number().min(0).max(360),
    perfectTolDeg: z.number().min(2).max(20),
    goodTolDeg: z.number().min(3).max(40),
    edgeTolDeg: z.number().min(4).max(70),
    openMs: z.number().int().min(0).max(DURATION_MS),
    closeMs: z.number().int().min(0).max(DURATION_MS)
  })
  .refine((t) => t.goodTolDeg > t.perfectTolDeg && t.edgeTolDeg > t.goodTolDeg, {
    message: 'tolerance-order'
  })
  .refine((t) => t.closeMs > t.openMs, { message: 'window-order' })

const OrbitConfigSchema = z.object({ targets: z.array(OrbitTargetSchema).min(3).max(20) })

export type TOrbitConfig = z.output<typeof OrbitConfigSchema>

function angDist(a: number, b: number) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

export function angleDistDeg(a: number, b: number) {
  return angDist(a, b)
}

export type TOrbitTarget = z.output<typeof OrbitTargetSchema>

export function orbitBand(d: number, target: TOrbitTarget) {
  if (d <= target.perfectTolDeg) return 1000
  if (d <= target.goodTolDeg) {
    return 650 + Math.round(349 * (1 - (d - target.perfectTolDeg) / (target.goodTolDeg - target.perfectTolDeg)))
  }
  if (d <= target.edgeTolDeg) {
    return 350 + Math.round(299 * (1 - (d - target.goodTolDeg) / (target.edgeTolDeg - target.goodTolDeg)))
  }
  return 0
}

export const orbitEngine: GameModule<TOrbitConfig> = {
  id: 'orbit',
  engineVersion: 1,
  durationMs() {
    return DURATION_MS
  },
  validateConfig(config: unknown) {
    return OrbitConfigSchema.parse(config)
  },
  createScenario(seed: string, config: TOrbitConfig) {
    return { seed, targets: config.targets }
  },
  scoreRun({ config, events }): ScoreResult {
    const check = validateEvents(events, {
      maxEvents: config.targets.length * 3,
      durationMs: DURATION_MS,
      allowedTypes: ['tap']
    })
    if (!check.valid) return { score: 0, valid: false, invalidReason: check.invalidReason, metrics: {} }
    const taps = events.filter((e) => e.type === 'tap')
    const used = new Array(taps.length).fill(false)
    let total = 0
    let hits = 0
    let perfects = 0
    let premature = 0
    for (const target of config.targets) {
      let best = -1
      let bestDt = Number.POSITIVE_INFINITY
      for (let i = 0; i < taps.length; i += 1) {
        if (used[i]) continue
        const dt = Math.abs(taps[i].t - (target.openMs + target.closeMs) / 2)
        if (dt < bestDt) {
          bestDt = dt
          best = i
        }
      }
      if (best === -1) continue
      used[best] = true
      const tap = taps[best]
      if (tap.t < target.openMs) {
        premature += 1
        total -= PREMATURE_PENALTY
        continue
      }
      if (tap.t > target.closeMs) continue
      const angle = tap.value === undefined ? target.angleDeg : tap.value
      const d = angDist(angle, target.angleDeg)
      if (d <= target.perfectTolDeg) {
        total += 1000
        hits += 1
        perfects += 1
      } else if (d <= target.goodTolDeg) {
        total += 650 + Math.round((349 * (1 - (d - target.perfectTolDeg) / (target.goodTolDeg - target.perfectTolDeg))))
        hits += 1
      } else if (d <= target.edgeTolDeg) {
        total += 350 + Math.round(299 * (1 - (d - target.goodTolDeg) / (target.edgeTolDeg - target.goodTolDeg)))
        hits += 1
      }
    }
    return {
      score: Math.max(0, total),
      valid: true,
      metrics: { targets: config.targets.length, hits, perfects, premature }
    } satisfies ScoreResult
  },
  sanitizeGhost({ config, events, score }) {
    const taps = events.filter((e) => e.type === 'tap')
    const used = new Array(taps.length).fill(false)
    let cum = 0
    const timeline = config.targets.map((target, i) => {
      let best = -1
      let bestDt = Number.POSITIVE_INFINITY
      for (let j = 0; j < taps.length; j += 1) {
        if (used[j]) continue
        const dt = Math.abs(taps[j].t - (target.openMs + target.closeMs) / 2)
        if (dt < bestDt) {
          bestDt = dt
          best = j
        }
      }
      if (best !== -1) {
        used[best] = true
        const tap = taps[best]
        if (tap.t >= target.openMs && tap.t <= target.closeMs) {
          const angle = tap.value === undefined ? target.angleDeg : tap.value
          const d = angDist(angle, target.angleDeg)
          if (d <= target.perfectTolDeg) cum += 1000
          else if (d <= target.goodTolDeg) cum += 650
          else if (d <= target.edgeTolDeg) cum += 350
        }
      }
      return { t: target.closeMs, progress: (i + 1) / config.targets.length, score: Math.max(0, cum) }
    })
    return { gameId: 'orbit', engineVersion: 1, score, timeline } satisfies SanitizedGhost
  },
  simulate({ config, skill, rng }: { seed: string; config: TOrbitConfig; skill: number; rng: SeededRng }) {
    return config.targets.map((target) => {
      const t = target.openMs + Math.round(rng.nextFloat() * (target.closeMs - target.openMs))
      const err = (rng.nextFloat() * 2 - 1) * (1 - skill) * target.edgeTolDeg * 1.5
      const value = ((Math.round(target.angleDeg + err) % 360) + 360) % 360
      return { t, type: 'tap', value } satisfies GameInputEvent
    })
  }
}
