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
const STREAK_STEP = 25
const STREAK_CAP = 500

const ShiftConfigSchema = z.object({
  cards: z
    .array(
      z.object({
        correct: z.union([z.literal(0), z.literal(1)]),
        presentedMs: z.number().int().min(0).max(DURATION_MS),
        windowMs: z.number().int().min(800).max(8000)
      })
    )
    .min(6)
    .max(30)
})

export type TShiftConfig = z.output<typeof ShiftConfigSchema>

export const shiftEngine: GameModule<TShiftConfig> = {
  id: 'shift',
  engineVersion: 1,
  durationMs() {
    return DURATION_MS
  },
  validateConfig(config: unknown) {
    return ShiftConfigSchema.parse(config)
  },
  createScenario(seed: string, config: TShiftConfig) {
    return { seed, cards: config.cards.length }
  },
  scoreRun({ config, events }): ScoreResult {
    const check = validateEvents(events, {
      maxEvents: config.cards.length + 4,
      durationMs: DURATION_MS,
      allowedTypes: ['choice']
    })
    if (!check.valid) return { score: 0, valid: false, invalidReason: check.invalidReason, metrics: {} }
    const choices = events.filter((e) => e.type === 'choice')
    let total = 0
    let correct = 0
    let streak = 0
    let streakBonus = 0
    for (let i = 0; i < config.cards.length; i += 1) {
      const card = config.cards[i]
      const choice = choices[i]
      if (!choice || choice.value === undefined) {
        streak = 0
        continue
      }
      const inWindow = choice.t >= card.presentedMs && choice.t <= card.presentedMs + card.windowMs
      if (inWindow && choice.value === card.correct) {
        const reaction = choice.t - card.presentedMs
        total += 500 + Math.round(300 * Math.max(0, 1 - reaction / card.windowMs))
        correct += 1
        streak += 1
        if (streak >= 5 && streakBonus < STREAK_CAP) {
          const add = Math.min(STREAK_STEP, STREAK_CAP - streakBonus)
          streakBonus += add
          total += add
        }
      } else {
        total -= 200
        streak = 0
      }
    }
    return {
      score: Math.max(0, total),
      valid: true,
      metrics: { cards: config.cards.length, correct, streakBonus }
    } satisfies ScoreResult
  },
  sanitizeGhost({ config, events, score }) {
    const choices = events.filter((e) => e.type === 'choice')
    let cum = 0
    const timeline = config.cards.map((card, i) => {
      const choice = choices[i]
      if (choice && choice.value !== undefined) {
        const inWindow = choice.t >= card.presentedMs && choice.t <= card.presentedMs + card.windowMs
        if (inWindow && choice.value === card.correct) {
          cum += 500 + Math.round(300 * Math.max(0, 1 - (choice.t - card.presentedMs) / card.windowMs))
        } else {
          cum -= 200
        }
      }
      return { t: card.presentedMs + card.windowMs, progress: (i + 1) / config.cards.length, score: Math.max(0, cum) }
    })
    return { gameId: 'shift', engineVersion: 1, score, timeline } satisfies SanitizedGhost
  },
  simulate({ config, skill, rng }: { seed: string; config: TShiftConfig; skill: number; rng: SeededRng }) {
    let prevT = -1
    return config.cards.map((card) => {
      const hit = rng.nextFloat() < skill
      const t = Math.max(
        card.presentedMs + Math.round(card.windowMs * (1 - skill) * rng.nextFloat()),
        prevT + 1
      )
      prevT = t
      return { t, type: 'choice', value: hit ? card.correct : 1 - card.correct } satisfies GameInputEvent
    })
  }
}
