import { and, eq, inArray, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/drizzle'
import { League, LeagueMember } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { isGhostPlus } from '@/lib/game/entitlement'
import { generateSlug } from '@/lib/game/slug'
import { getLeagueLimits, validateLeagueName } from '@/lib/game/leagues'

const CreateSchema = z.object({ name: z.string() })

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const memberships = await db.select().from(LeagueMember).where(eq(LeagueMember.userId, user.id))
  if (memberships.length === 0) return NextResponse.json({ leagues: [] })
  const leagueIds = memberships.map((m) => m.leagueId)
  const leagues = await db
    .select()
    .from(League)
    .where(and(inArray(League.id, leagueIds), isNull(League.archivedAt)))
  if (leagues.length === 0) return NextResponse.json({ leagues: [] })
  const activeIds = leagues.map((l) => l.id)
  const allMembers = await db
    .select({ leagueId: LeagueMember.leagueId })
    .from(LeagueMember)
    .where(inArray(LeagueMember.leagueId, activeIds))
  const countById = new Map<string, number>()
  for (const m of allMembers) countById.set(m.leagueId, (countById.get(m.leagueId) ?? 0) + 1)
  return NextResponse.json({
    leagues: leagues.map((l) => ({
      slug: l.publicSlug,
      name: l.name,
      isOwner: l.ownerUserId === user.id,
      memberCount: countById.get(l.id) ?? 0,
      url: `/leagues/${l.publicSlug}`
    }))
  })
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  const checked = validateLeagueName(parsed.data.name)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })

  const plus = await isGhostPlus(user.id)
  const limits = getLeagueLimits(plus ? 'ghost_plus' : 'free')

  const owned = await db
    .select({ id: League.id })
    .from(League)
    .where(and(eq(League.ownerUserId, user.id), isNull(League.archivedAt)))
  if (owned.length >= limits.create) {
    return NextResponse.json({ error: 'league-create-limit' }, { status: 403 })
  }

  const memberships = await db.select({ leagueId: LeagueMember.leagueId }).from(LeagueMember).where(eq(LeagueMember.userId, user.id))
  if (memberships.length > 0) {
    const leagues = await db
      .select({ id: League.id })
      .from(League)
      .where(and(inArray(League.id, memberships.map((m) => m.leagueId)), isNull(League.archivedAt)))
    if (leagues.length >= limits.join) {
      return NextResponse.json({ error: 'league-join-limit' }, { status: 403 })
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const inserted = await db
        .insert(League)
        .values({ publicSlug: generateSlug(), ownerUserId: user.id, name: checked.name })
        .returning()
      const league = inserted[0]
      await db.insert(LeagueMember).values({ leagueId: league.id, userId: user.id, role: 'owner' })
      return NextResponse.json({
        id: league.id,
        slug: league.publicSlug,
        name: league.name,
        url: `/leagues/${league.publicSlug}`
      })
    } catch {
      continue
    }
  }
  return NextResponse.json({ error: 'slug-collision' }, { status: 500 })
}
