import { desc, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import {
  Achievement,
  DailyGame,
  PlayerProfile,
  Run,
  Streak,
  UserAchievement,
  XpLedger
} from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { getPlan } from '@/lib/game/entitlement'
import { levelForXp } from '@/lib/game/progression'
import { loadSkinCatalog } from '@/lib/game/skins'

function shiftDay(dateStr: string, delta: number) {
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + delta * 86400000).toISOString().slice(0, 10)
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const plan = await getPlan(user.id)
  const profiles = await db.select().from(PlayerProfile).where(eq(PlayerProfile.userId, user.id))
  const streaks = await db.select().from(Streak).where(eq(Streak.userId, user.id))
  const ledger = await db.select({ amount: XpLedger.amount }).from(XpLedger).where(eq(XpLedger.userId, user.id))
  const xpTotal = ledger.reduce((s, r) => s + r.amount, 0)
  const owned = await db.select().from(UserAchievement).where(eq(UserAchievement.userId, user.id))
  const defs =
    owned.length > 0
      ? await db
          .select()
          .from(Achievement)
          .where(
            inArray(
              Achievement.id,
              owned.map((o) => o.achievementId)
            )
          )
      : []
  const runs = await db
    .select()
    .from(Run)
    .where(eq(Run.userId, user.id))
    .orderBy(desc(Run.createdAt))
    .limit(30)
  const games =
    runs.length > 0
      ? await db
          .select()
          .from(DailyGame)
          .where(
            inArray(
              DailyGame.id,
              runs.map((r) => r.dailyGameId)
            )
          )
      : []
  const gameById = new Map(games.map((g) => [g.id, g]))
  const today = new Date().toISOString().slice(0, 10)
  const weekStart = shiftDay(today, -6)
  const visibleRuns =
    plan === 'ghost_plus'
      ? runs
      : runs.filter((r) => {
          const date = gameById.get(r.dailyGameId)?.gameDate ?? null
          return date !== null && date >= weekStart
        })
  const catalog = loadSkinCatalog()
  return NextResponse.json({
    profile: profiles[0] ?? null,
    streak: streaks[0] ?? null,
    xpTotal,
    level: levelForXp(xpTotal),
    history: { locked: plan !== 'ghost_plus', days: 7 },
    cosmetics: {
      equipped: {
        ghost: profiles[0]?.activeGhostSkin ?? null,
        card: profiles[0]?.activeCardSkin ?? null
      },
      catalog: catalog.skins.map((s) => ({ id: s.id, name: s.name, entitlement: s.entitlement, gradient: s.avatar.gradient }))
    },
    achievements: owned.map((o) => ({
      ...o,
      detail: defs.find((d) => d.id === o.achievementId) ?? null
    })),
    recentRuns: visibleRuns.map((r) => ({
      id: r.id,
      mode: r.mode,
      validatedScore: r.validatedScore,
      valid: r.valid,
      gameDate: gameById.get(r.dailyGameId)?.gameDate ?? null,
      gameId: gameById.get(r.dailyGameId)?.gameId ?? null,
      title: gameById.get(r.dailyGameId)?.title ?? null
    }))
  })
}
