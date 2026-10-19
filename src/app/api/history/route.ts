import { and, desc, eq, gte, lt, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/drizzle'
import { DailyGame, Run } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { getPlan } from '@/lib/game/entitlement'

const CursorSchema = z.object({ createdAt: z.iso.datetime(), id: z.uuid() })

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const locked = (await getPlan(user.id)) !== 'ghost_plus'
  const before = new URL(req.url).searchParams.get('before')
  let cursor: z.infer<typeof CursorSchema> | undefined
  if (before) {
    try { cursor = CursorSchema.parse(JSON.parse(before)) }
    catch { return NextResponse.json({ error: 'bad-cursor' }, { status: 400 }) }
  }
  const start = new Date(Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10)
  const history = await db.select({ id: Run.id, gameDate: DailyGame.gameDate, gameId: DailyGame.gameId, title: DailyGame.title, mode: Run.mode, score: Run.validatedScore, valid: Run.valid, createdAt: Run.createdAt }).from(Run).innerJoin(DailyGame, eq(Run.dailyGameId, DailyGame.id)).where(and(eq(Run.userId, user.id), locked ? gte(DailyGame.gameDate, start) : undefined, cursor ? or(lt(Run.createdAt, new Date(cursor.createdAt)), and(eq(Run.createdAt, new Date(cursor.createdAt)), lt(Run.id, cursor.id))) : undefined)).orderBy(desc(Run.createdAt), desc(Run.id)).limit(51)
  const rows = history.slice(0, 50)
  const skills = locked ? [] : await db.select({ gameId: DailyGame.gameId, gameDate: DailyGame.gameDate, score: Run.validatedScore }).from(Run).innerJoin(DailyGame, eq(Run.dailyGameId, DailyGame.id)).where(and(eq(Run.userId, user.id), eq(Run.mode, 'ranked'), eq(Run.valid, true))).orderBy(desc(DailyGame.gameDate))
  return NextResponse.json({ locked, runs: rows, skills, nextCursor: history.length > 50 ? JSON.stringify({ createdAt: rows[rows.length - 1].createdAt.toISOString(), id: rows[rows.length - 1].id }) : null }, { headers: { 'Cache-Control': 'private, no-store' } })
}
