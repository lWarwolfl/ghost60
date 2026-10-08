import { and, eq, inArray, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { Block, League, LeagueMember } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { isGhostPlus } from '@/lib/game/entitlement'
import { getLeagueLimits } from '@/lib/game/leagues'

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { slug } = await params
  const rows = await db.select().from(League).where(eq(League.publicSlug, slug))
  const league = rows[0]
  if (!league || league.archivedAt) return NextResponse.json({ error: 'not-found' }, { status: 404 })

  const existing = await db
    .select()
    .from(LeagueMember)
    .where(and(eq(LeagueMember.leagueId, league.id), eq(LeagueMember.userId, user.id)))
  if (existing.length > 0) return NextResponse.json({ joined: true, already: true })

  const blocks = await db
    .select({ id: Block.blockerUserId })
    .from(Block)
    .where(and(eq(Block.blockerUserId, league.ownerUserId), eq(Block.blockedUserId, user.id)))
  if (blocks.length > 0) return NextResponse.json({ error: 'league-blocked' }, { status: 403 })

  const members = await db.select().from(LeagueMember).where(eq(LeagueMember.leagueId, league.id))
  const plus = await isGhostPlus(user.id)
  const limits = getLeagueLimits(plus ? 'ghost_plus' : 'free')
  if (members.length >= limits.size) {
    return NextResponse.json({ error: 'league-full' }, { status: 409 })
  }

  const mine = await db.select({ leagueId: LeagueMember.leagueId }).from(LeagueMember).where(eq(LeagueMember.userId, user.id))
  if (mine.length > 0) {
    const active = await db
      .select({ id: League.id })
      .from(League)
      .where(and(inArray(League.id, mine.map((m) => m.leagueId)), isNull(League.archivedAt)))
    if (active.length >= limits.join) {
      return NextResponse.json({ error: 'league-join-limit' }, { status: 403 })
    }
  }

  try {
    await db.insert(LeagueMember).values({ leagueId: league.id, userId: user.id, role: 'member' })
  } catch {
    return NextResponse.json({ joined: true, already: true })
  }
  return NextResponse.json({ joined: true })
}
