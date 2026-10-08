import { z } from 'zod'
import { validateEvents } from '@/games/core/events'
import type {
  GameInputEvent,
  GameModule,
  SanitizedGhost,
  ScoreResult,
  SeededRng
} from '@/games/core/game-module'

const DURATION_MS = 40000

const SnapConfigSchema = z
  .object({
    rounds: z
      .array(
        z.object({
          correct: z.number().int().min(0),
          options: z.number().int().min(2).max(8),
          presentedMs: z.number().int().min(0).max(DURATION_MS),
          windowMs: z.number().int().min(800).max(8000)
        })
      )
      .min(4)
      .max(24)
  })
  .refine((c) => c.rounds.every((r) => r.correct < r.options), { message: 'correct-out-of-range' })
  .refine((c) => c.rounds.every((r, i) => i === 0 || r.presentedMs > c.rounds[i - 1].presentedMs), {
    message: 'rounds-not-ordered'
  })

export type TSnapConfig = z.output<typeof SnapConfigSchema>

export const snapEngine: GameModule<TSnapConfig> = {
  id: 'snap',
  engineVersion: 1,
  durationMs() {
    return DURATION_MS
  },
  validateConfig(config: unknown) {
    return SnapConfigSchema.parse(config)
  },
  createScenario(seed: string, config: TSnapConfig) {
    return { seed, rounds: config.rounds }
  },
  scoreRun({ config, events }): ScoreResult {
    const check = validateEvents(events, {
      maxEvents: config.rounds.length + 4,
      durationMs: DURATION_MS,
      allowedTypes: ['choice']
    })
    if (!check.valid) return { score: 0, valid: false, invalidReason: check.invalidReason, metrics: {} }
    const choices = events.filter((e) => e.type === 'choice')
    let total = 0
    let correct = 0
    for (let i = 0; i < config.rounds.length; i += 1) {
      const round = config.rounds[i]
      const choice = choices[i]
      if (!choice || choice.value === undefined) continue
      const inWindow = choice.t >= round.presentedMs && choice.t <= round.presentedMs + round.windowMs
      if (inWindow && choice.value === round.correct) {
        const reaction = choice.t - round.presentedMs
        total += 700 + Math.round(300 * Math.max(0, 1 - reaction / round.windowMs))
        correct += 1
      } else {
        total -= 250
      }
    }
    return {
      score: Math.max(0, total),
      valid: true,
      metrics: { rounds: config.rounds.length, correct }
    } satisfies ScoreResult
  },
  sanitizeGhost({ config, events, score }) {
    const choices = events.filter((e) => e.type === 'choice')
    let cum = 0
    const timeline = config.rounds.map((round, i) => {
      const choice = choices[i]
      if (choice && choice.value !== undefined) {
        const inWindow = choice.t >= round.presentedMs && choice.t <= round.presentedMs + round.windowMs
        if (inWindow && choice.value === round.correct) {
          cum += 700 + Math.round(300 * Math.max(0, 1 - (choice.t - round.presentedMs) / round.windowMs))
        } else {
          cum -= 250
        }
      }
      return { t: round.presentedMs + round.windowMs, progress: (i + 1) / config.rounds.length, score: Math.max(0, cum) }
    })
    return { gameId: 'snap', engineVersion: 1, score, timeline } satisfies SanitizedGhost
  },
  simulate({ config, skill, rng }: { seed: string; config: TSnapConfig; skill: number; rng: SeededRng }) {
    let prevT = -1
    return config.rounds.map((round) => {
      const hit = rng.nextFloat() < skill
      let value = round.correct
      if (!hit) {
        value = rng.nextInt(0, round.options - 1)
        if (value >= round.correct) value += 1
      }
      const t = Math.max(
        round.presentedMs + Math.round(round.windowMs * (1 - skill) * rng.nextFloat()),
        prevT + 1
      )
      prevT = t
      return { t, type: 'choice', value } satisfies GameInputEvent
    })
  }
}
