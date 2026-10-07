import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { Challenge } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const updated = await db
    .update(Challenge)
    .set({ disabledAt: new Date() })
    .where(and(eq(Challenge.id, id), eq(Challenge.creatorUserId, user.id)))
    .returning()
  if (updated.length === 0) return NextResponse.json({ error: 'not-found' }, { status: 404 })
  return NextResponse.json({ disabled: true })
}
