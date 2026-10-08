import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/drizzle'
import { League, LeagueMember } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { validateLeagueName } from '@/lib/game/leagues'
import { buildLeagueStandings } from '@/lib/game/league-detail'

async function findLeague(slug: string) {
  const rows = await db.select().from(League).where(eq(League.publicSlug, slug))
  const league = rows[0]
  if (!league || league.archivedAt) return null
  return league
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { slug } = await params
  const league = await findLeague(slug)
  if (!league) return NextResponse.json({ error: 'not-found' }, { status: 404 })
  const memberships = await db.select().from(LeagueMember).where(eq(LeagueMember.leagueId, league.id))
  const isMember = memberships.some((m) => m.userId === user.id)
  const { week, rows } = await buildLeagueStandings(league.id, league.ownerUserId, user.id)
  return NextResponse.json({
    slug: league.publicSlug,
    name: league.name,
    isOwner: league.ownerUserId === user.id,
    isMember,
    memberCount: memberships.length,
    week,
    standings: rows,
    url: `/leagues/${league.publicSlug}`
  })
}

const PatchSchema = z.object({ name: z.string() })

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { slug } = await params
  const league = await findLeague(slug)
  if (!league) return NextResponse.json({ error: 'not-found' }, { status: 404 })
  if (league.ownerUserId !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  const checked = validateLeagueName(parsed.data.name)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })
  const updated = await db
    .update(League)
    .set({ name: checked.name })
    .where(and(eq(League.id, league.id), isNull(League.archivedAt)))
    .returning()
  if (updated.length === 0) return NextResponse.json({ error: 'not-found' }, { status: 404 })
  return NextResponse.json({ slug: updated[0].publicSlug, name: updated[0].name })
}
