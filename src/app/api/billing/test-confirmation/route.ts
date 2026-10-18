import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { Entitlement, User } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'

async function confirm(req: Request, reset: boolean) {
  if (process.env.NODE_ENV !== 'development')
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  const url = new URL(req.url)
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    req.headers.get('origin') !== url.origin
  ) {
    return NextResponse.json({ error: 'untrusted-origin' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return db.transaction(async (tx) => {
    const owners = await tx
      .select({ id: User.id })
      .from(User)
      .where(eq(User.id, user.id))
      .for('update')
    if (!owners[0]) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (reset) {
      await tx
        .delete(Entitlement)
        .where(and(eq(Entitlement.userId, user.id), eq(Entitlement.provider, 'test')))
      return NextResponse.json({ test: true, reset: true })
    }
    const [existing] = await tx.select().from(Entitlement).where(eq(Entitlement.userId, user.id))
    if (existing && existing.provider !== 'test')
      return NextResponse.json({ error: 'existing-subscription' }, { status: 409 })
    const values = {
      userId: user.id,
      plan: 'ghost_plus',
      provider: 'test',
      status: 'active',
      providerCustomerId: null,
      providerSubscriptionId: null,
      currentPeriodEnd: new Date(Date.now() + 86400000),
      updatedAt: new Date(),
    }
    await tx
      .insert(Entitlement)
      .values(values)
      .onConflictDoUpdate({ target: Entitlement.userId, set: values })
    return NextResponse.json({
      test: true,
      confirmed: true,
      expiresAt: values.currentPeriodEnd.toISOString(),
    })
  })
}

export async function POST(req: Request) {
  return confirm(req, false)
}
export async function DELETE(req: Request) {
  return confirm(req, true)
}
