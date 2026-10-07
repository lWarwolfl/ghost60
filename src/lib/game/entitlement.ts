import { eq } from 'drizzle-orm'
import { db } from '@/drizzle'
import { Entitlement } from '@/drizzle/schema'

export async function isGhostPlus(userId: string): Promise<boolean> {
  const rows = await db.select().from(Entitlement).where(eq(Entitlement.userId, userId))
  return rows[0]?.plan === 'ghost_plus'
}
