import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/drizzle'
import { PlayerProfile } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { getPlan } from '@/lib/game/entitlement'
import { canEquip, getSkin } from '@/lib/game/skins'

const CosmeticsSchema = z.object({
  slot: z.enum(['ghost', 'card']),
  skinId: z.string().min(1).max(64)
})

export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const parsed = CosmeticsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  const skin = getSkin(parsed.data.skinId)
  if (!skin) return NextResponse.json({ error: 'unknown-skin' }, { status: 404 })
  const plan = await getPlan(user.id)
  if (!canEquip(plan, skin.id)) {
    return NextResponse.json({ error: 'ghost-plus-locked', locked: true }, { status: 403 })
  }
  const field = parsed.data.slot === 'ghost' ? 'activeGhostSkin' : 'activeCardSkin'
  const existing = await db.select().from(PlayerProfile).where(eq(PlayerProfile.userId, user.id))
  if (existing.length === 0) {
    await db.insert(PlayerProfile).values({ userId: user.id, [field]: skin.id })
  } else {
    await db.update(PlayerProfile).set({ [field]: skin.id }).where(eq(PlayerProfile.userId, user.id))
  }
  const rows = await db.select().from(PlayerProfile).where(eq(PlayerProfile.userId, user.id))
  return NextResponse.json({
    profile: { activeGhostSkin: rows[0]?.activeGhostSkin ?? null, activeCardSkin: rows[0]?.activeCardSkin ?? null }
  })
}
