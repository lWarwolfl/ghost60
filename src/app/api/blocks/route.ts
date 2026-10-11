import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/drizzle'
import { Block, PlayerProfile } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { RATE_LIMITS, checkRateLimit, rateLimitedResponse } from '@/lib/game/rate-limit'

const BlockSchema = z.object({ handle: z.string().trim().min(1).max(24) })

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await checkRateLimit('block', user.id, RATE_LIMITS.block))) return rateLimitedResponse()
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const parsed = BlockSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  const profiles = await db.select().from(PlayerProfile).where(eq(PlayerProfile.handle, parsed.data.handle))
  const target = profiles[0]
  if (!target || target.userId === user.id) return NextResponse.json({ error: 'not-found' }, { status: 404 })
  await db
    .insert(Block)
    .values({ blockerUserId: user.id, blockedUserId: target.userId })
    .onConflictDoNothing()
  return NextResponse.json({ blocked: true })
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const parsed = BlockSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  const profiles = await db.select().from(PlayerProfile).where(eq(PlayerProfile.handle, parsed.data.handle))
  const target = profiles[0]
  if (!target) return NextResponse.json({ error: 'not-found' }, { status: 404 })
  await db
    .delete(Block)
    .where(and(eq(Block.blockerUserId, user.id), eq(Block.blockedUserId, target.userId)))
  return NextResponse.json({ unblocked: true })
}
