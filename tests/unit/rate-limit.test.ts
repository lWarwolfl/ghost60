import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '@/drizzle'
import { RateLimit } from '@/drizzle/schema'
import { checkRateLimit } from '@/lib/game/rate-limit'

describe('checkRateLimit (db-backed, no redis)', () => {
  it('allows up to the limit then denies inside the window', async () => {
    const scope = `test-${Date.now()}-a`
    const rule = { limit: 3, windowMs: 60_000 }
    expect(await checkRateLimit(scope, 'u1', rule)).toBe(true)
    expect(await checkRateLimit(scope, 'u1', rule)).toBe(true)
    expect(await checkRateLimit(scope, 'u1', rule)).toBe(true)
    expect(await checkRateLimit(scope, 'u1', rule)).toBe(false)
  }, 30_000)
  it('scopes counters per id', async () => {
    const scope = `test-${Date.now()}-b`
    const rule = { limit: 1, windowMs: 60_000 }
    expect(await checkRateLimit(scope, 'u1', rule)).toBe(true)
    expect(await checkRateLimit(scope, 'u1', rule)).toBe(false)
    expect(await checkRateLimit(scope, 'u2', rule)).toBe(true)
  }, 30_000)
  it('resets in a new window', async () => {
    const scope = `test-${Date.now()}-c`
    const key = `${scope}:u1`
    const rule = { limit: 100, windowMs: 1500 }
    expect(await checkRateLimit(scope, 'u1', rule)).toBe(true)
    const before = await db.select().from(RateLimit).where(eq(RateLimit.key, key))
    await new Promise((r) => setTimeout(r, 1700))
    expect(await checkRateLimit(scope, 'u1', rule)).toBe(true)
    const after = await db.select().from(RateLimit).where(eq(RateLimit.key, key))
    expect(after.length).toBe(before.length + 1)
  }, 30_000)
})
