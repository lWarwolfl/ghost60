import { buildDayConfig } from '@/games/content/builder'
import type { TScheduleDay } from '@/games/content/schedule'
import { recallEngine, type TRecallConfig } from '@/games/recall/engine'

const BREATHING_ROOM = 1.1

// Tune the generated board, not the client's clock: saved inputs, authoritative
// scores and ghosts all keep the same timebase. Existing persisted boards stay
// immutable, including Flash games that already have open sessions.
export function buildFlashConfig(day: TScheduleDay) {
  const built = buildDayConfig(day)
  const paced = { ...day, config: { ...day.config } }
  const fewer = (count: number, minimum: number) =>
    Math.max(minimum, Math.round(count / BREATHING_ROOM), Math.ceil(count * 0.85))
  switch (day.engine) {
    case 'pulse': {
      const config = built.config as { pulses: unknown[] }
      paced.config.pulseCount = fewer(config.pulses.length, 3)
      break
    }
    case 'snap': {
      const config = built.config as { rounds: unknown[] }
      paced.config.rounds = fewer(config.rounds.length, 4)
      paced.config.windowMsStart = Math.round(
        Number(day.config.windowMsStart ?? 2500) * BREATHING_ROOM
      )
      paced.config.windowMsEnd = Math.round(Number(day.config.windowMsEnd ?? 900) * BREATHING_ROOM)
      break
    }
    case 'shift': {
      const config = built.config as { cards: unknown[] }
      paced.config.rounds = fewer(config.cards.length, 6)
      break
    }
    case 'orbit': {
      const config = built.config as { targets: unknown[]; markerPeriodMs: number }
      paced.config.targets = fewer(config.targets.length, 3)
      paced.config.rpm = 60000 / config.markerPeriodMs / BREATHING_ROOM
      break
    }
    case 'recall': {
      const config = built.config as TRecallConfig
      return {
        ...built,
        config: recallEngine.validateConfig({
          ...config,
          cellSlotMs: 880,
          sequences: config.sequences.map((sequence) => ({
            ...sequence,
            parMs: Math.min(30000, Math.round(sequence.parMs * BREATHING_ROOM)),
          })),
        }),
      }
    }
    // Trace follows the player's hand, so it has no automatic cadence to slow.
    default:
      return built
  }
  return buildDayConfig(paced)
}
