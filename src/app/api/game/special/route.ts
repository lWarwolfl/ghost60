import { NextResponse } from 'next/server'
import { getGame } from '@/games/registry'
import { currentSpecialGame } from '@/lib/game/studio'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { game, startsAt, endsAt } = await currentSpecialGame()
  if (!game) return NextResponse.json({ error: 'special-unavailable' }, { status: 404 })
  const mod = getGame(game.gameId as 'pulse')
  try {
    const config = mod.validateConfig(game.config)
    return NextResponse.json({
      id: game.id,
      gameDate: game.gameDate,
      gameId: game.gameId,
      engineVersion: game.engineVersion,
      seed: game.seed,
      config,
      title: game.title,
      instruction: game.instruction,
      durationMs: mod.durationMs(config as never),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString()
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'bad-game-config' }, { status: 500 })
  }
}
