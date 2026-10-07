'use server'

import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/drizzle'
import { Entitlement, PlayerProfile, Streak } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'

function handleFor() {
  return `ghost-${randomUUID().slice(0, 8)}`
}

export async function ensureProfileAction() {
  const user = await getCurrentUser()
  if (!user) return null
  const existing = await db.select().from(PlayerProfile).where(eq(PlayerProfile.userId, user.id))
  if (existing.length === 0) {
    let handle = handleFor()
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await db.insert(PlayerProfile).values({ userId: user.id, handle }).returning()
        break
      } catch {
        handle = handleFor()
      }
    }
  }
  const streak = await db.select().from(Streak).where(eq(Streak.userId, user.id))
  if (streak.length === 0) {
    await db.insert(Streak).values({ userId: user.id }).returning()
  }
  const entitlement = await db.select().from(Entitlement).where(eq(Entitlement.userId, user.id))
  if (entitlement.length === 0) {
    await db.insert(Entitlement).values({ userId: user.id, plan: 'free', status: 'inactive' }).returning()
  }
  const rows = await db.select().from(PlayerProfile).where(eq(PlayerProfile.userId, user.id))
  return rows[0] ?? null
}

export type TEnsureProfileAction = Awaited<ReturnType<typeof ensureProfileAction>>
