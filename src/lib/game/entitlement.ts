import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { Entitlement } from '@/drizzle/schema'

export type TPlan = 'free' | 'ghost_plus'

export async function getPlan(
  userId: string,
  reader: Pick<typeof db, 'select'> = db
): Promise<TPlan> {
  const rows = await reader.select().from(Entitlement).where(eq(Entitlement.userId, userId))
  const entitlement = rows[0]
  return entitlement?.plan === 'ghost_plus' &&
    (entitlement.provider !== 'test' || process.env.NODE_ENV === 'development') &&
    (entitlement.status === 'active' || entitlement.status === 'trialing') &&
    entitlement.currentPeriodEnd &&
    entitlement.currentPeriodEnd.getTime() > Date.now()
    ? 'ghost_plus'
    : 'free'
}

export async function isGhostPlus(userId: string): Promise<boolean> {
  return (await getPlan(userId)) === 'ghost_plus'
}

export function lockedResponse() {
  return NextResponse.json({ error: 'ghost-plus-locked', locked: true }, { status: 403 })
}

export async function requireGhostPlus(userId: string) {
  return (await getPlan(userId)) === 'ghost_plus' ? null : lockedResponse()
}
