import { z } from 'zod'
import { validateEvents } from '@/games/core/events'
import type {
  GameInputEvent,
  GameModule,
  NormalizedPoint,
  SanitizedGhost,
  ScoreResult,
  SeededRng
} from '@/games/core/game-module'

const DURATION_MS = 40000
const GATE_POINTS = 800

const TraceConfigSchema = z.object({
  gates: z
    .array(
      z.object({
        x: z.number().int().min(0).max(10000),
        y: z.number().int().min(0).max(10000),
        r: z.number().int().min(200).max(2000)
      })
    )
    .min(2)
    .max(12),
  corridorHalf: z.number().int().min(100).max(2000),
  completionBonus: z.number().int().min(0).max(2000).default(500)
})

export type TTraceConfig = z.output<typeof TraceConfigSchema>

function dist(a: NormalizedPoint, b: NormalizedPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function hasPoint(e: GameInputEvent): e is GameInputEvent & { p: NormalizedPoint } {
  return 'p' in e && e.p !== undefined
}

function distToSegment(p: NormalizedPoint, a: NormalizedPoint, b: NormalizedPoint) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return dist(p, a)
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function pathDeviation(samples: NormalizedPoint[], gates: TTraceConfig['gates']) {
  if (samples.length === 0) return 1
  let sum = 0
  for (const s of samples) {
    let best = Number.POSITIVE_INFINITY
    for (let i = 0; i < gates.length - 1; i += 1) {
      best = Math.min(best, distToSegment(s, gates[i], gates[i + 1]))
    }
    sum += best
  }
  return sum / samples.length
}

export const traceEngine: GameModule<TTraceConfig> = {
  id: 'trace',
  engineVersion: 1,
  durationMs() {
    return DURATION_MS
  },
  validateConfig(config: unknown) {
    return TraceConfigSchema.parse(config)
  },
  createScenario(seed: string, config: TTraceConfig) {
    return { seed, gates: config.gates, corridorHalf: config.corridorHalf }
  },
  scoreRun({ config, events }): ScoreResult {
    const check = validateEvents(events, {
      maxEvents: 2048,
      durationMs: DURATION_MS,
      allowedTypes: ['pointer_down', 'pointer_move', 'pointer_up']
    })
    if (!check.valid) return { score: 0, valid: false, invalidReason: check.invalidReason, metrics: {} }
    const samples = events.filter(hasPoint)
    let expected = 0
    for (const e of samples) {
      if (expected >= config.gates.length) break
      const gate = config.gates[expected]
      if (dist(e.p, gate) <= gate.r) expected += 1
    }
    const points = samples.map((e) => e.p)
    const avg = pathDeviation(points, config.gates)
    const precision =
      samples.length === 0
        ? 0
        : Math.round(1200 * Math.min(1, Math.max(0, 1 - avg / config.corridorHalf)))
    const finished = expected === config.gates.length && events[events.length - 1]?.type === 'pointer_up'
    const total = expected * GATE_POINTS + precision + (finished ? config.completionBonus : 0)
    return {
      score: total,
      valid: true,
      metrics: { gates: config.gates.length, passed: expected, precision }
    } satisfies ScoreResult
  },
  sanitizeGhost({ events, score }) {
    const samples = events.filter(hasPoint)
    const step = Math.max(1, Math.floor(samples.length / 60))
    const timeline = samples
      .filter((_, i) => i % step === 0)
      .map((e, i, arr) => ({ t: e.t, progress: (i + 1) / arr.length, p: e.p }))
    return { gameId: 'trace', engineVersion: 1, score, timeline } satisfies SanitizedGhost
  },
  simulate({ config, skill, rng }: { seed: string; config: TTraceConfig; skill: number; rng: SeededRng }) {
    const err = (1 - skill) * config.corridorHalf * 1.5
    const jitter = () => Math.round((rng.nextFloat() * 2 - 1) * err)
    const clamp = (v: number) => Math.min(10000, Math.max(0, v))
    const first = config.gates[0]
    const out: GameInputEvent[] = [
      { t: 0, type: 'pointer_down', p: { x: clamp(first.x + jitter()), y: clamp(first.y + jitter()) } }
    ]
    let t = 0
    for (let g = 0; g < config.gates.length - 1; g += 1) {
      const a = config.gates[g]
      const b = config.gates[g + 1]
      for (let s = 1; s <= 8; s += 1) {
        t += 50
        const x = Math.round(a.x + ((b.x - a.x) * s) / 8)
        const y = Math.round(a.y + ((b.y - a.y) * s) / 8)
        out.push({ t, type: 'pointer_move', p: { x: clamp(x + jitter()), y: clamp(y + jitter()) } })
      }
    }
    t += 50
    const last = config.gates[config.gates.length - 1]
    out.push({ t, type: 'pointer_up', p: { x: clamp(last.x), y: clamp(last.y) } })
    return out
  }
}
