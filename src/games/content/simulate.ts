import { createRng } from '@/games/core/rng'
import type { TScheduleDay } from '@/games/content/schedule'
import { getGame } from '@/games/registry'

export type TDaySimReport = {
  day: number
  engine: string
  means: number[]
  lowMean: number
  highMean: number
  invalidRuns: number
  totalRuns: number
  flags: string[]
}

export function simulateDay(day: TScheduleDay, config: unknown, skills: number[], seedsPerSkill: number): TDaySimReport {
  const mod = getGame(day.engine as 'pulse')
  const means: number[] = []
  let invalidRuns = 0
  let totalRuns = 0
  let maxSingle = 0
  for (const skill of skills) {
    let total = 0
    for (let s = 0; s < seedsPerSkill; s += 1) {
      const events = mod.simulate!({
        seed: `${day.seedKey}:${skill}:${s}`,
        config: config as never,
        skill,
        rng: createRng(`content-${day.seedKey}-${skill}-${s}`)
      })
      const r = mod.scoreRun({ seed: day.seedKey, config: config as never, events, visibilityInterruptions: 0 })
      totalRuns += 1
      if (!r.valid) {
        invalidRuns += 1
        continue
      }
      total += r.score
      maxSingle = Math.max(maxSingle, r.score)
    }
    means.push(total / seedsPerSkill)
  }
  const lowMean = means[0] ?? 0
  const highMean = means[means.length - 1] ?? 0
  const flags: string[] = []
  if (highMean <= 0) flags.push('impossible')
  if (highMean > 0 && (highMean - lowMean) / Math.max(1, highMean) < 0.25 && !flags.includes('compression')) {
    flags.push('compression')
  }
  if (invalidRuns > 0 && !flags.includes('outlier')) flags.push('outlier')
  if (highMean > 0 && maxSingle > 3 * highMean && !flags.includes('outlier')) flags.push('outlier')
  return { day: day.day, engine: day.engine, means, lowMean, highMean, invalidRuns, totalRuns, flags }
}
