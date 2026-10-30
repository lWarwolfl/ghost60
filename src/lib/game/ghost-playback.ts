import type { GameInputEvent, SanitizedGhost } from '@/games/core/game-module'
import type { TGameSnapshot } from '@/features/game/store/game-store'
import { getGame } from '@/games/registry'

/** Preserve the public, answer-free ghost contract; attach actual inputs only for owned runs. */
export function ownedReplayGhost(
  gameId: SanitizedGhost['gameId'],
  seed: string,
  config: unknown,
  events: GameInputEvent[],
  score: number
): SanitizedGhost {
  events = Array.isArray(events) ? events : []
  const mod = getGame(gameId)
  const validated = mod.validateConfig(config)
  const ghost = mod.sanitizeGhost({ seed, config: validated, events, score })
  if (gameId === 'trace') return { ...ghost, replay: events }
  let previous = 0
  const timeline = events.map((event, index) => {
    const result = mod.scoreRun({
      seed,
      config: validated,
      events: events.slice(0, index + 1),
      visibilityInterruptions: 0,
    })
    const delta = result.score - previous
    previous = result.score
    return { t: event.t, progress: (index + 1) / events.length, score: result.score, delta }
  })
  return { ...ghost, timeline, replay: events }
}

export function snapshotGhost(snapshot: TGameSnapshot): NonNullable<TGameSnapshot['ghost']> | null {
  if (snapshot.ghost) return snapshot.ghost
  if (snapshot.pastSelf) return { handle: 'YOUR GHOST', ...snapshot.pastSelf }
  if (snapshot.challenge?.ghost)
    return {
      handle: snapshot.challenge.handle,
      targetScore: snapshot.challenge.targetScore,
      ghost: snapshot.challenge.ghost,
    }
  return null
}

export function ghostEventsAt(ghost: SanitizedGhost | undefined, elapsed: number) {
  return ghost?.replay?.filter((event) => event.t <= elapsed) ?? []
}

export function elapsedGhost(ghost: SanitizedGhost | undefined, elapsed: number) {
  return ghost?.timeline.filter((sample) => sample.t <= elapsed) ?? []
}
