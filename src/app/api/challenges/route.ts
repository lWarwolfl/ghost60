import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/drizzle'
import { Challenge, Run } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { generateSlug } from '@/lib/game/slug'

const CreateSchema = z.object({ runId: z.string().uuid() })

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
  const runs = await db
    .select()
    .from(Run)
    .where(and(eq(Run.id, parsed.data.runId), eq(Run.userId, user.id)))
  const run = runs[0]
  if (!run || !run.valid) return NextResponse.json({ error: 'run-not-eligible' }, { status: 409 })
  const expiresAt = new Date(Date.now() + 14 * 86400000)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const inserted = await db
        .insert(Challenge)
        .values({
          publicSlug: generateSlug(),
          creatorUserId: user.id,
          sourceRunId: run.id,
          dailyGameId: run.dailyGameId,
          expiresAt
        })
        .returning()
      const challenge = inserted[0]
      return NextResponse.json({
        id: challenge.id,
        slug: challenge.publicSlug,
        url: `/challenge/${challenge.publicSlug}`,
        expiresAt: challenge.expiresAt.toISOString()
      })
    } catch {
      continue
    }
  }
  return NextResponse.json({ error: 'slug-collision' }, { status: 500 })
}
