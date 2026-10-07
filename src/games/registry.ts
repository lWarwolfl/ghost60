import type { GameId, GameModule } from '@/games/core/game-module'
import { orbitEngine } from '@/games/orbit/engine'
import { pulseEngine } from '@/games/pulse/engine'
import { recallEngine } from '@/games/recall/engine'
import { shiftEngine } from '@/games/shift/engine'
import { snapEngine } from '@/games/snap/engine'
import { traceEngine } from '@/games/trace/engine'

const REGISTRY: Record<GameId, GameModule<unknown>> = {
  pulse: pulseEngine,
  snap: snapEngine,
  orbit: orbitEngine,
  recall: recallEngine,
  shift: shiftEngine,
  trace: traceEngine
}

export const ENGINE_IDS = Object.keys(REGISTRY) as GameId[]

export function getGame<TConfig = unknown>(id: GameId): GameModule<TConfig> {
  return REGISTRY[id] as unknown as GameModule<TConfig>
}
