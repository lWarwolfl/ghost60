import { eq } from 'drizzle-orm'
import { db } from '@/drizzle'
import { DailyGame, GameDefinition, type TDailyGame } from '@/drizzle/schema'
import { ENGINE_IDS, getGame } from '@/games/registry'

export function utcDayString(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function devConfigFor(gameId: string, baseMs: number) {
  switch (gameId) {
    case 'pulse':
      return {
        pulses: [5000, 12000, 20000, 28000, 36000].map((targetMs) => ({ targetMs, toleranceMs: 250 }))
      }
    case 'snap':
      return {
        rounds: [0, 1, 2, 3, 4, 5].map((i) => ({
          correct: i % 4,
          options: 4,
          presentedMs: baseMs + i * 5000,
          windowMs: 2500
        }))
      }
    case 'orbit':
      return {
        targets: [0, 1, 2, 3, 4].map((i) => ({
          angleDeg: (i * 72) % 360,
          perfectTolDeg: 5,
          goodTolDeg: 15,
          edgeTolDeg: 30,
          openMs: baseMs + i * 7000,
          closeMs: baseMs + i * 7000 + 5000
        }))
      }
    case 'recall':
      return {
        grid: 3,
        sequences: [
          { cells: [0, 1, 2], parMs: 6000 },
          { cells: [4, 5], parMs: 5000 },
          { cells: [6, 7, 8], parMs: 6000 }
        ]
      }
    case 'shift':
      return {
        cards: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
          correct: (i % 2) as 0 | 1,
          presentedMs: baseMs + i * 4000,
          windowMs: 2500
        }))
      }
    default:
      return {
        gates: [
          { x: 1000, y: 5000, r: 600 },
          { x: 5000, y: 5000, r: 600 },
          { x: 9000, y: 5000, r: 600 }
        ],
        corridorHalf: 900,
        completionBonus: 500
      }
  }
}

async function ensureDevDailyGame(gameDate: string): Promise<TDailyGame> {
  for (const id of ENGINE_IDS) {
    const mod = getGame(id)
    const existing = await db.select().from(GameDefinition).where(eq(GameDefinition.id, id))
    if (existing.length === 0) {
      await db.insert(GameDefinition).values({
        id,
        engineVersion: mod.engineVersion,
        name: id.toUpperCase(),
        skillCategory: id,
        durationMs: mod.durationMs(undefined as never),
        configSchemaVersion: 1,
        active: true
      })
    }
  }
  const dayIndex = Math.floor(new Date(`${gameDate}T00:00:00Z`).getTime() / 86400000)
  const gameId = ENGINE_IDS[((dayIndex % ENGINE_IDS.length) + ENGINE_IDS.length) % ENGINE_IDS.length]
  const mod = getGame(gameId)
  const config = devConfigFor(gameId, 3000)
  const validated = mod.validateConfig(config)
  try {
    const inserted = await db
      .insert(DailyGame)
      .values({
        gameDate,
        gameId,
        engineVersion: mod.engineVersion,
        seed: `dev-${gameDate}`,
        config: validated as Record<string, unknown>,
        title: `DEV ${gameId.toUpperCase()}`,
        instruction: 'Development placeholder game. Content import ships in Phase 9.',
        shareSubtitle: 'dev run',
        difficulty: 3,
        status: 'live',
        publishAt: new Date()
      })
      .returning()
    return inserted[0]
  } catch {
    const rows = await db.select().from(DailyGame).where(eq(DailyGame.gameDate, gameDate))
    if (rows.length === 0) throw new Error('dev-daily-game-race')
    return rows[0]
  }
}

export async function getTodayDailyGame(): Promise<TDailyGame | null> {
  const today = utcDayString()
  const rows = await db.select().from(DailyGame).where(eq(DailyGame.gameDate, today))
  if (rows.length > 0) return rows[0]
  if (process.env.NODE_ENV === 'production') return null
  return ensureDevDailyGame(today)
}
