import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/drizzle'
import { PlayerProfile } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { getPlan } from '@/lib/game/entitlement'
import { RATE_LIMITS, checkRateLimit, rateLimitedResponse } from '@/lib/game/rate-limit'
import { canEquip, getSkin, resolveSkin } from '@/lib/game/skins'

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
  if (!(await checkRateLimit('profile', user.id, RATE_LIMITS.profileWrite))) {
    return rateLimitedResponse()
  }
  const skin = getSkin(parsed.data.skinId)
  if (!skin) return NextResponse.json({ error: 'unknown-skin' }, { status: 404 })
  const plan = await getPlan(user.id)
  if (!canEquip(plan, skin.id)) {
    return NextResponse.json({ error: 'ghost-plus-locked', locked: true }, { status: 403 })
  }
  const field = parsed.data.slot === 'ghost' ? 'activeGhostSkin' : 'activeCardSkin'
  await db.insert(PlayerProfile).values({ userId: user.id, [field]: skin.id })
    .onConflictDoUpdate({ target: PlayerProfile.userId, set: { [field]: skin.id } })
  const rows = await db.select().from(PlayerProfile).where(eq(PlayerProfile.userId, user.id))
  return NextResponse.json({
    profile: { activeGhostSkin: resolveSkin(rows[0]?.activeGhostSkin, plan).id, activeCardSkin: resolveSkin(rows[0]?.activeCardSkin, plan).id }
  })
}
