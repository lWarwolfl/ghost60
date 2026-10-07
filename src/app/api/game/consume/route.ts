import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { RunSession } from '@/drizzle/schema'
import { ConsumeRequestSchema } from '@/features/game/schemas/session.schema'
import { getCurrentUser } from '@/lib/auth/server'
import { verifySessionToken } from '@/lib/game/token'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const parsed = ConsumeRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  const payload = verifySessionToken(parsed.data.token)
  if (!payload || payload.userId !== user.id) {
    return NextResponse.json({ error: 'bad-token' }, { status: 401 })
  }
  const rows = await db.select().from(RunSession).where(eq(RunSession.id, payload.sessionId))
  const session = rows[0]
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: 'bad-session' }, { status: 404 })
  }
  if (session.state === 'submitted') return NextResponse.json({ error: 'already-submitted' }, { status: 409 })
  if (session.state === 'cancelled' || session.state === 'expired' || session.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'session-expired' }, { status: 410 })
  }
  if (session.consumedAt) return NextResponse.json({ consumed: true })
  await db
    .update(RunSession)
    .set({ consumedAt: new Date(), state: 'consumed' })
    .where(eq(RunSession.id, session.id))
  return NextResponse.json({ consumed: true })
}
