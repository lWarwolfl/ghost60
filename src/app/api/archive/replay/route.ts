import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { DailyGame, Run } from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { ownedReplayGhost } from '@/lib/game/ghost-playback'
import type { GameInputEvent } from '@/games/core/game-module'
import { getGame } from '@/games/registry'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const runId = new URL(req.url).searchParams.get('runId')
  if (!runId) return NextResponse.json({ error: 'run-required' }, { status: 400 })
  const rows = await db
    .select()
    .from(Run)
    .where(and(eq(Run.id, runId), eq(Run.userId, user.id)))
  const run = rows[0]
  if (!run || !run.valid) return NextResponse.json({ error: 'run-unavailable' }, { status: 404 })
  const games = await db.select().from(DailyGame).where(eq(DailyGame.id, run.dailyGameId))
  const game = games[0]
  if (!game) return NextResponse.json({ error: 'game-unavailable' }, { status: 404 })
  const mod = getGame(game.gameId as 'pulse')
  try {
    const config = mod.validateConfig(game.config)
    return NextResponse.json({
      run: { id: run.id, score: run.validatedScore, mode: run.mode, createdAt: run.createdAt.toISOString() },
      game: {
        id: game.id,
        gameDate: game.gameDate,
        gameId: game.gameId,
        engineVersion: game.engineVersion,
        seed: game.seed,
        config,
        title: game.title,
        instruction: game.instruction,
        durationMs: mod.durationMs(config as never)
      },
      events: run.eventStream,
      ghost: ownedReplayGhost(game.gameId as 'pulse', game.seed, config, run.eventStream as GameInputEvent[], run.validatedScore)
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'replay-unavailable' }, { status: 500 })
  }
}
