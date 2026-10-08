import { and, asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { League, LeagueMember } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { slug } = await params
  const rows = await db.select().from(League).where(eq(League.publicSlug, slug))
  const league = rows[0]
  if (!league || league.archivedAt) return NextResponse.json({ error: 'not-found' }, { status: 404 })

  const mine = await db
    .select()
    .from(LeagueMember)
    .where(and(eq(LeagueMember.leagueId, league.id), eq(LeagueMember.userId, user.id)))
  if (mine.length === 0) return NextResponse.json({ error: 'not-member' }, { status: 404 })

  const isOwner = league.ownerUserId === user.id
  if (!isOwner) {
    await db
      .delete(LeagueMember)
      .where(and(eq(LeagueMember.leagueId, league.id), eq(LeagueMember.userId, user.id)))
    return NextResponse.json({ left: true })
  }

  const others = await db
    .select()
    .from(LeagueMember)
    .where(eq(LeagueMember.leagueId, league.id))
    .orderBy(asc(LeagueMember.joinedAt))
  const next = others.find((m) => m.userId !== user.id)
  if (!next) {
    await db.delete(LeagueMember).where(eq(LeagueMember.leagueId, league.id))
    await db.update(League).set({ archivedAt: new Date() }).where(eq(League.id, league.id))
    return NextResponse.json({ left: true, archived: true })
  }
  await db.transaction(async (tx) => {
    await tx.update(League).set({ ownerUserId: next.userId }).where(eq(League.id, league.id))
    await tx
      .update(LeagueMember)
      .set({ role: 'owner' })
      .where(and(eq(LeagueMember.leagueId, league.id), eq(LeagueMember.userId, next.userId)))
    await tx
      .delete(LeagueMember)
      .where(and(eq(LeagueMember.leagueId, league.id), eq(LeagueMember.userId, user.id)))
  })
  return NextResponse.json({ left: true, transferredTo: true })
}
