import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { Entitlement } from '@/drizzle/schema'

export type TPlan = 'free' | 'ghost_plus'

export async function getPlan(userId: string): Promise<TPlan> {
  const rows = await db.select().from(Entitlement).where(eq(Entitlement.userId, userId))
  return rows[0]?.plan === 'ghost_plus' ? 'ghost_plus' : 'free'
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
