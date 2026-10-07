import { NextResponse } from 'next/server'
import { getTodayDailyGame } from '@/lib/game/daily'
import { getGame } from '@/games/registry'

export async function GET() {
  const game = await getTodayDailyGame()
  if (!game) return NextResponse.json({ error: 'no-game-today' }, { status: 409 })
  try {
    const mod = getGame(game.gameId as 'pulse')
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
      durationMs: mod.durationMs(config as never)
    })
  } catch {
    return NextResponse.json({ error: 'bad-game-config' }, { status: 500 })
  }
}
