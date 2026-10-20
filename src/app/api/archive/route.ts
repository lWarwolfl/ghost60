import { and, count, desc, eq, gte, inArray, lt, lte } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/drizzle'
import { DailyGame, Run } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { getPlan } from '@/lib/game/entitlement'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const today = new Date().toISOString().slice(0, 10)
  const start = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10)
  const before = new URL(req.url).searchParams.get('before')
  if (before && !z.iso.date().safeParse(before).success) return NextResponse.json({ error: 'bad-cursor' }, { status: 400 })
  const gameId = new URL(req.url).searchParams.get('game')
  if (gameId && !['pulse', 'snap', 'orbit', 'recall', 'shift', 'trace'].includes(gameId)) return NextResponse.json({ error: 'bad-game' }, { status: 400 })
  const plan = await getPlan(user.id)
  const locked = plan !== 'ghost_plus'
  const games = await db.select().from(DailyGame).where(and(
    lte(DailyGame.gameDate, today), lte(DailyGame.publishAt, new Date()),
    inArray(DailyGame.status, ['scheduled', 'live', 'completed']),
    eq(DailyGame.kind, 'daily'),
    locked ? gte(DailyGame.gameDate, start) : undefined,
    before ? lt(DailyGame.gameDate, before) : undefined,
    gameId ? eq(DailyGame.gameId, gameId) : undefined
  )).orderBy(desc(DailyGame.gameDate)).limit(31)
  const visible = games.slice(0, 30)
  const runs = visible.length ? await db.select({ id: Run.id, dailyGameId: Run.dailyGameId, mode: Run.mode, score: Run.validatedScore }).from(Run).where(and(eq(Run.userId, user.id), eq(Run.valid, true), inArray(Run.dailyGameId, visible.map((game) => game.id)))).orderBy(desc(Run.createdAt)) : []
  const older = locked ? await db.select({ total: count() }).from(DailyGame).where(and(lt(DailyGame.gameDate, start), eq(DailyGame.kind, 'daily'), lte(DailyGame.publishAt, new Date()), inArray(DailyGame.status, ['scheduled', 'live', 'completed']))) : []
  return NextResponse.json({
    locked,
    days: visible.map((game) => ({
      id: game.id, gameDate: game.gameDate, gameId: game.gameId, title: game.title,
      completed: runs.some((run) => run.dailyGameId === game.id && run.mode === 'ranked'),
      sourceRunId: runs.find((run) => run.dailyGameId === game.id)?.id ?? null,
      bestScore: runs.filter((run) => run.dailyGameId === game.id).reduce<number | null>((best, run) => best === null ? run.score : Math.max(best, run.score), null)
    })),
    lockedOlder: older[0]?.total ?? 0,
    nextCursor: games.length > 30 ? visible[visible.length - 1].gameDate : null
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
