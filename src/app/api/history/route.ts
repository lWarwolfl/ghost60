import { and, desc, eq, gte, lt } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { DailyGame, Run } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { getPlan } from '@/lib/game/entitlement'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const locked = (await getPlan(user.id)) !== 'ghost_plus'
  const before = new URL(req.url).searchParams.get('before')
  if (before && !Number.isFinite(Date.parse(before))) return NextResponse.json({ error: 'bad-cursor' }, { status: 400 })
  const start = new Date(Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10)
  const history = await db.select({ id: Run.id, gameDate: DailyGame.gameDate, gameId: DailyGame.gameId, title: DailyGame.title, mode: Run.mode, score: Run.validatedScore, valid: Run.valid, createdAt: Run.createdAt }).from(Run).innerJoin(DailyGame, eq(Run.dailyGameId, DailyGame.id)).where(and(eq(Run.userId, user.id), locked ? gte(DailyGame.gameDate, start) : undefined, before ? lt(Run.createdAt, new Date(before)) : undefined)).orderBy(desc(Run.createdAt)).limit(51)
  const rows = history.slice(0, 50)
  const skills = locked ? [] : await db.select({ gameId: DailyGame.gameId, gameDate: DailyGame.gameDate, score: Run.validatedScore }).from(Run).innerJoin(DailyGame, eq(Run.dailyGameId, DailyGame.id)).where(and(eq(Run.userId, user.id), eq(Run.mode, 'ranked'), eq(Run.valid, true))).orderBy(desc(DailyGame.gameDate))
  return NextResponse.json({ locked, runs: rows, skills, nextCursor: history.length > 50 ? rows[rows.length - 1].createdAt.toISOString() : null }, { headers: { 'Cache-Control': 'private, no-store' } })
}
