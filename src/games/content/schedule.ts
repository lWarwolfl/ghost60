import fs from 'node:fs'
import path from 'node:path'

export type TScheduleDay = {
  day: number
  engine: string
  modifier: string
  title: string
  instruction: string
  shareSubtitle: string
  seedKey: string
  difficulty: number
  config: Record<string, unknown>
}

export type TSchedule = { season: { slug: string; name: string; days: number }; days: TScheduleDay[] }
export type TCatalog = { version: number; games: Array<{ id: string; modifiers: string[] }> }

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', name), 'utf8')) as T
}

export function loadSchedule(): TSchedule {
  return readJson<TSchedule>('launch-30-days.json')
}

export function loadCatalog(): TCatalog {
  return readJson<TCatalog>('game-catalog.json')
}

export function validateScheduleRules(schedule: TSchedule, catalog: TCatalog): string[] {
  const errors: string[] = []
  if (schedule.days.length !== schedule.season.days) {
    errors.push(`day-count: expected ${schedule.season.days}, got ${schedule.days.length}`)
  }
  const known = new Map(catalog.games.map((g) => [g.id, g]))
  schedule.days.forEach((d, i) => {
    if (d.day !== i + 1) errors.push(`day-order: index ${i} has day ${d.day}`)
    const game = known.get(d.engine)
    if (!game) {
      errors.push(`unknown-engine: ${d.engine}`)
      return
    }
    if (!game.modifiers.includes(d.modifier)) errors.push(`unknown-modifier: ${d.engine}/${d.modifier}`)
    if (!Number.isInteger(d.difficulty) || d.difficulty < 1 || d.difficulty > 5) {
      errors.push(`difficulty-range: day ${d.day} has ${d.difficulty}`)
    }
    if (i > 0 && schedule.days[i - 1].engine === d.engine) {
      errors.push(`consecutive-engine: days ${d.day - 1} and ${d.day} both ${d.engine}`)
    }
  })
  const seeds = new Set(schedule.days.map((d) => d.seedKey))
  if (seeds.size !== schedule.days.length) errors.push('duplicate-seedKey')
  return errors
}
