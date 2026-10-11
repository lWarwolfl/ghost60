import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { ProductEvent } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { validateAnalyticsBatch } from '@/lib/game/analytics'
import { RATE_LIMITS, checkRateLimit, rateLimitedResponse } from '@/lib/game/rate-limit'

function hashAnonId(anonId: string): string {
  return createHash('sha256').update(anonId).digest('hex')
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await checkRateLimit('events', user.id, RATE_LIMITS.events))) {
    return rateLimitedResponse()
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const parsed = validateAnalyticsBatch(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  await db.insert(ProductEvent).values(
    parsed.events.map((e) => ({
      eventName: e.name,
      userId: user.id,
      anonIdHash: e.anonId ? hashAnonId(e.anonId) : null,
      sessionKey: e.sessionKey ?? null,
      properties: e.properties
    }))
  )
  return NextResponse.json({ accepted: parsed.events.length })
}
