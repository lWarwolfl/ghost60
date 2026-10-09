import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { DailyGame, Run } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { getPlan } from '@/lib/game/entitlement'

function shiftDay(dateStr: string, delta: number) {
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + delta * 86400000).toISOString().slice(0, 10)
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const today = new Date().toISOString().slice(0, 10)
  const start = shiftDay(today, -6)
  const games = await db
    .select()
    .from(DailyGame)
    .where(and(gte(DailyGame.gameDate, start), lte(DailyGame.gameDate, today)))
  const gameIds = games.map((g) => g.id)
  const runs =
    gameIds.length > 0
      ? await db
          .select({ dailyGameId: Run.dailyGameId })
          .from(Run)
          .where(
            and(
              eq(Run.userId, user.id),
              eq(Run.mode, 'ranked'),
              eq(Run.valid, true),
              inArray(Run.dailyGameId, gameIds)
            )
          )
      : []
  const completed = new Set(runs.map((r) => r.dailyGameId))
  const older = await db.select({ id: DailyGame.id }).from(DailyGame).where(lte(DailyGame.gameDate, shiftDay(today, -7)))
  const plan = await getPlan(user.id)
  return NextResponse.json({
    locked: plan !== 'ghost_plus',
    days: games
      .map((g) => ({
        gameDate: g.gameDate,
        gameId: g.gameId,
        title: g.title,
        completed: completed.has(g.id)
      }))
      .sort((a, b) => (a.gameDate < b.gameDate ? 1 : -1)),
    lockedOlder: older.length
  })
}
