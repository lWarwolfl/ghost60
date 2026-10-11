import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/drizzle'
import { Report } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { RATE_LIMITS, checkRateLimit, rateLimitedResponse } from '@/lib/game/rate-limit'

const ReportSchema = z.object({
  subjectType: z.enum(['handle', 'league', 'challenge']),
  subjectKey: z.string().trim().min(1).max(64),
  reason: z.enum(['spam', 'abuse', 'cheating', 'other'])
})

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await checkRateLimit('report', user.id, RATE_LIMITS.report))) return rateLimitedResponse()
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const parsed = ReportSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  await db.insert(Report).values({
    reporterUserId: user.id,
    subjectType: parsed.data.subjectType,
    subjectKey: parsed.data.subjectKey,
    reason: parsed.data.reason
  })
  return NextResponse.json({ reported: true })
}
