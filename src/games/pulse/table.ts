import { hashSeed } from '@/games/core/rng'

// A seeded sequence of distinct target sizes. Visual only: timing and scoring stay identical.
export function pulseRadiusScale(seed: string, index: number) {
  const sizes = [0.7, 0.95, 0.78, 1.08, 0.85, 1.02]
  return sizes[(hashSeed(seed) + Math.max(0, index)) % sizes.length]
}

export function activePulseIndex(
  pulses: readonly { targetMs: number; toleranceMs: number }[],
  elapsed: number
) {
  const index = pulses.findIndex((pulse) => elapsed <= pulse.targetMs + pulse.toleranceMs)
  return index === -1 ? pulses.length - 1 : index
}
