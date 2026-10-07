import { z } from 'zod'
import { validateEvents } from '@/games/core/events'
import type {
  GameInputEvent,
  GameModule,
  SanitizedGhost,
  ScoreResult,
  SeededRng
} from '@/games/core/game-module'

const DURATION_MS = 50000

const RecallConfigSchema = z.object({
  grid: z.union([z.literal(3), z.literal(4)]),
  sequences: z
    .array(
      z.object({
        cells: z.array(z.number().int().min(0)).min(1).max(12),
        parMs: z.number().int().min(1000).max(30000)
      })
    )
    .min(2)
    .max(12)
}).refine((c) => c.sequences.every((s) => s.cells.every((cell) => cell < c.grid * c.grid)), {
  message: 'cell-out-of-grid'
})

export type TRecallConfig = z.output<typeof RecallConfigSchema>

export const recallEngine: GameModule<TRecallConfig> = {
  id: 'recall',
  engineVersion: 1,
  durationMs() {
    return DURATION_MS
  },
  validateConfig(config: unknown) {
    return RecallConfigSchema.parse(config)
  },
  createScenario(seed: string, config: TRecallConfig) {
    return { seed, grid: config.grid, sequences: config.sequences.map((s) => s.cells) }
  },
  scoreRun({ config, events }): ScoreResult {
    const check = validateEvents(events, {
      maxEvents: 128,
      durationMs: DURATION_MS,
      allowedTypes: ['choice']
    })
    if (!check.valid) return { score: 0, valid: false, invalidReason: check.invalidReason, metrics: {} }
    const choices = events.filter((e) => e.type === 'choice')
    let total = 0
    let completed = 0
    let cursor = 0
    for (const seq of config.sequences) {
      let pos = 0
      let firstT = -1
      let lastT = -1
      let alive = true
      while (pos < seq.cells.length && cursor < choices.length && alive) {
        const choice = choices[cursor]
        cursor += 1
        if (firstT === -1) firstT = choice.t
        lastT = choice.t
        if (choice.value === seq.cells[pos]) {
          pos += 1
        } else {
          alive = false
        }
      }
      if (alive && pos === seq.cells.length) {
        const elapsed = Math.max(1, lastT - firstT)
        total += 1000 + Math.round(500 * Math.max(0, 1 - elapsed / seq.parMs))
        completed += 1
      }
    }
    return {
      score: total,
      valid: true,
      metrics: { sequences: config.sequences.length, completed }
    } satisfies ScoreResult
  },
  sanitizeGhost({ config, events, score }) {
    const choices = events.filter((e) => e.type === 'choice')
    let cum = 0
    let cursor = 0
    const timeline = config.sequences.map((seq, i) => {
      let pos = 0
      let firstT = -1
      let lastT = seq.parMs
      let alive = true
      while (pos < seq.cells.length && cursor < choices.length && alive) {
        const choice = choices[cursor]
        cursor += 1
        if (firstT === -1) firstT = choice.t
        lastT = choice.t
        if (choice.value === seq.cells[pos]) pos += 1
        else alive = false
      }
      const done = alive && pos === seq.cells.length
      if (done) cum += 1000 + Math.round(500 * Math.max(0, 1 - Math.max(1, lastT - firstT) / seq.parMs))
      return { t: lastT, progress: (i + 1) / config.sequences.length, score: cum, marker: done ? 1 : 0 }
    })
    return { gameId: 'recall', engineVersion: 1, score, timeline } satisfies SanitizedGhost
  },
  simulate({ config, skill, rng }: { seed: string; config: TRecallConfig; skill: number; rng: SeededRng }) {
    const out: GameInputEvent[] = []
    let t = 500
    for (const seq of config.sequences) {
      for (const cell of seq.cells) {
        const correct = rng.nextFloat() < skill
        const value = correct ? cell : rng.nextInt(0, config.grid * config.grid)
        t += Math.round(300 + rng.nextFloat() * 900)
        out.push({ t, type: 'choice' as const, value })
        if (!correct) break
      }
      t += 400
    }
    return out
  }
}
