import { sql } from 'drizzle-orm'
import { db } from '@/drizzle'
import { RateLimit } from '@/drizzle/schema'

export type TRateLimitRule = { limit: number; windowMs: number }

export const RATE_LIMITS = {
  sessionCreate: { limit: 20, windowMs: 60_000 },
  submit: { limit: 30, windowMs: 60_000 },
  challengeCreate: { limit: 10, windowMs: 3_600_000 },
  profileWrite: { limit: 10, windowMs: 3_600_000 },
  report: { limit: 10, windowMs: 3_600_000 },
  block: { limit: 20, windowMs: 3_600_000 },
  accountDelete: { limit: 3, windowMs: 86_400_000 }
} satisfies Record<string, TRateLimitRule>

export async function checkRateLimit(scope: string, id: string, rule: TRateLimitRule): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / rule.windowMs) * rule.windowMs)
  const key = `${scope}:${id}`
  try {
    const updated = await db
      .insert(RateLimit)
      .values({ key, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [RateLimit.key, RateLimit.windowStart],
        set: { count: sql`${RateLimit.count} + 1` }
      })
      .returning({ count: RateLimit.count })
    const count = updated[0]?.count ?? rule.limit + 1
    return count <= rule.limit
  } catch {
    return true
  }
}

export function rateLimitedResponse() {
  return Response.json({ error: 'rate-limited' }, { status: 429 })
}
