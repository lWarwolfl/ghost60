import { eq } from 'drizzle-orm'
import schedule from '../../../content/launch-30-days.json'
import { db } from '@/drizzle'
import { DailyGame, GameDefinition, type TDailyGame } from '@/drizzle/schema'
import { buildDayConfig } from '@/games/content/builder'
import type { GameId } from '@/games/core/game-module'
import { getGame } from '@/games/registry'

export function utcDayString(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function publishedGame(game: TDailyGame | undefined): TDailyGame | null {
  return game && ['live', 'scheduled'].includes(game.status) && game.publishAt <= new Date() ? game : null
}

export async function getTodayDailyGame(): Promise<TDailyGame | null> {
  const today = utcDayString()
  const rows = await db.select().from(DailyGame).where(eq(DailyGame.gameDate, today))
  if (rows.length > 0) return publishedGame(rows[0])
  const dayIndex = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86400000)
  const day = schedule.days[((dayIndex % schedule.days.length) + schedule.days.length) % schedule.days.length]
  const built = buildDayConfig(day)
  const mod = getGame(day.engine as GameId)
  await db.insert(GameDefinition).values({
    id: day.engine,
    engineVersion: mod.engineVersion,
    name: day.engine.toUpperCase(),
    skillCategory: day.engine,
    durationMs: mod.durationMs(built.config),
    configSchemaVersion: 1,
    active: true
  }).onConflictDoNothing({ target: [GameDefinition.id, GameDefinition.engineVersion] })
  const inserted = await db.insert(DailyGame).values({
    gameDate: today,
    gameId: day.engine,
    engineVersion: mod.engineVersion,
    seed: built.seed,
    config: built.config as Record<string, unknown>,
    title: day.title,
    instruction: day.instruction,
    shareSubtitle: day.shareSubtitle,
    difficulty: day.difficulty,
    status: 'live',
    publishAt: new Date(`${today}T00:00:00Z`)
  }).onConflictDoNothing({ target: DailyGame.gameDate }).returning()
  if (inserted.length > 0) return inserted[0]
  const existing = await db.select().from(DailyGame).where(eq(DailyGame.gameDate, today))
  return publishedGame(existing[0])
}