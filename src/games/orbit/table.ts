import type { GameInputEvent } from '@/games/core/game-module'
import type { TOrbitTarget } from '@/games/orbit/engine'

export const ORBIT_MARKER_PERIOD_MS = 4000
export const ORBIT_ARC_LEAD_MS = 1200
export const ORBIT_VERDICT_MS = 300
export const ORBIT_DURATION_MS = 45000

export function markerAngleAt(
  elapsedMs: number,
  periodMs = ORBIT_MARKER_PERIOD_MS,
  ramp = 0,
  durationMs = ORBIT_DURATION_MS
) {
  const t = Math.max(0, elapsedMs)
  // Linear speed ramp: the angular position is the integral of 1 + ramp * t / duration.
  const turns = (t + (ramp * t * t) / (2 * Math.max(1, durationMs))) / Math.max(1, periodMs)
  const a = (turns * 360) % 360
  return a < 0 ? a + 360 : a
}

// Time the marker reaches angleDeg nearest to nearMs. Lets targets use random angles
// while still lining their midpoint up with the moving marker.
export function markerCrossingAt(
  angleDeg: number,
  nearMs: number,
  periodMs = ORBIT_MARKER_PERIOD_MS,
  ramp = 0,
  durationMs = ORBIT_DURATION_MS
) {
  const period = Math.max(1, periodMs)
  const duration = Math.max(1, durationMs)
  const near = Math.max(0, nearMs)
  const turn = Math.round(
    (near + (ramp * near * near) / (2 * duration)) / period - (((angleDeg % 360) + 360) % 360) / 360
  )
  const unwrappedMs = (Math.max(0, turn) + (((angleDeg % 360) + 360) % 360) / 360) * period
  if (ramp <= 0) return Math.min(duration, Math.max(0, unwrappedMs))
  const a = ramp / (2 * duration)
  const t = (-1 + Math.sqrt(1 + 4 * a * unwrappedMs)) / (2 * a)
  return Math.min(duration, Math.max(0, t))
}

export function angleFromPoint(px: number, py: number, cx: number, cy: number) {
  const a = (Math.atan2(py - cy, px - cx) * 180) / Math.PI
  return a < 0 ? a + 360 : a
}

export function toIntAngle(deg: number) {
  return ((Math.round(deg) % 360) + 360) % 360
}

type TTap = { t: number }

export function assignTaps(targets: TOrbitTarget[], taps: TTap[]) {
  const used = new Array(taps.length).fill(false)
  return targets.map((target) => {
    const mid = (target.openMs + target.closeMs) / 2
    let best = -1
    let bestDt = Number.POSITIVE_INFINITY
    for (let i = 0; i < taps.length; i += 1) {
      if (used[i]) continue
      const dt = Math.abs(taps[i].t - mid)
      if (dt < bestDt) {
        bestDt = dt
        best = i
      }
    }
    if (best !== -1) used[best] = true
    return best
  })
}

export type TRivalNotch = { targetIndex: number; angleDeg: number }

export function visibleRivalNotches(
  targets: TOrbitTarget[],
  taps: Array<GameInputEvent & { t: number }>,
  rival: TRivalNotch[]
) {
  const assigned = assignTaps(targets, taps)
  const tapped = new Set<number>()
  assigned.forEach((tapIndex, targetIndex) => {
    if (tapIndex !== -1) tapped.add(targetIndex)
  })
  return rival.filter((n) => tapped.has(n.targetIndex))
}
