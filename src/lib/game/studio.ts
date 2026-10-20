import { eq } from 'drizzle-orm'
import { db } from '@/drizzle'
import { DailyGame, GameDefinition, type TDailyGame } from '@/drizzle/schema'
import { buildDayConfig } from '@/games/content/builder'
import { loadSchedule, type TScheduleDay } from '@/games/content/schedule'
import { getGame } from '@/games/registry'
import type { GameId } from '@/games/core/game-module'
import { ENGINES } from '@/features/game/schemas/session.schema'

export const SPECIAL_WINDOW_MS = 2 * 60 * 60 * 1000

function scheduleDay(engine: string, salt: number) {
  const days = loadSchedule().days.filter((day) => day.engine === engine)
  return days[Math.abs(salt) % Math.max(1, days.length)] ?? loadSchedule().days[0]
}

function syntheticDate(base: string, offset: number) {
  return new Date(Date.parse(`${base}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10)
}

async function ensureGame(input: {
  kind: 'dev' | 'special'
  day: TScheduleDay
  gameDate: string
  publishAt: Date
  endsAt: Date | null
  title: string
}): Promise<TDailyGame> {
  const built = buildDayConfig(input.day)
  const mod = getGame(input.day.engine as GameId)
  await db.insert(GameDefinition).values({
    id: input.day.engine,
    engineVersion: mod.engineVersion,
    name: input.day.engine.toUpperCase(),
    skillCategory: input.day.engine,
    durationMs: mod.durationMs(built.config),
    configSchemaVersion: 1,
    active: true
  }).onConflictDoNothing({ target: [GameDefinition.id, GameDefinition.engineVersion] })
  const inserted = await db.insert(DailyGame).values({
    gameDate: input.gameDate,
    gameId: input.day.engine,
    engineVersion: mod.engineVersion,
    seed: built.seed,
    config: built.config as Record<string, unknown>,
    title: input.title,
    instruction: input.day.instruction,
    shareSubtitle: input.day.shareSubtitle,
    difficulty: input.day.difficulty,
    status: 'live',
    kind: input.kind,
    endsAt: input.endsAt,
    publishAt: input.publishAt
  }).onConflictDoNothing({ target: DailyGame.gameDate }).returning()
  if (inserted.length > 0) return inserted[0]
  const rows = await db.select().from(DailyGame).where(eq(DailyGame.gameDate, input.gameDate))
  return rows[0]
}

export function specialBlock(now = new Date()) {
  const index = Math.floor(now.getTime() / SPECIAL_WINDOW_MS)
  const startsAt = new Date(index * SPECIAL_WINDOW_MS)
  const endsAt = new Date(startsAt.getTime() + SPECIAL_WINDOW_MS)
  return { index, startsAt, endsAt }
}

export async function currentSpecialGame(now = new Date()) {
  const { index, startsAt, endsAt } = specialBlock(now)
  const today = now.toISOString().slice(0, 10)
  const todayRows = await db.select().from(DailyGame).where(eq(DailyGame.gameDate, today))
  const dailyEngine = todayRows.find((row) => row.kind === 'daily')?.gameId
  const pool = ENGINES.filter((engine) => engine !== dailyEngine)
  const engine = pool[Math.abs(index) % pool.length]
  const day = scheduleDay(engine, index)
  const game = await ensureGame({
    kind: 'special',
    day,
    gameDate: syntheticDate('1600-01-01', Math.abs(index) % 100000),
    publishAt: startsAt,
    endsAt,
    title: `FLASH · ${day.title}`
  })
  return { game, startsAt, endsAt }
}

export async function devGame(engine: string) {
  const safeEngine = ENGINES.includes(engine as (typeof ENGINES)[number]) ? engine : 'pulse'
  const index = ENGINES.indexOf(safeEngine as (typeof ENGINES)[number])
  const day = scheduleDay(safeEngine, 0)
  return ensureGame({
    kind: 'dev',
    day,
    gameDate: syntheticDate('1800-01-01', Math.max(0, index)),
    publishAt: new Date(0),
    endsAt: null,
    title: `DEV · ${day.title}`
  })
}
