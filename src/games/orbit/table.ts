import type { GameInputEvent } from '@/games/core/game-module'
import type { TOrbitTarget } from '@/games/orbit/engine'

export const ORBIT_MARKER_PERIOD_MS = 4000
export const ORBIT_ARC_LEAD_MS = 1200
export const ORBIT_VERDICT_MS = 300

export function markerAngleAt(elapsedMs: number, periodMs = ORBIT_MARKER_PERIOD_MS) {
  const a = ((elapsedMs / periodMs) * 360) % 360
  return a < 0 ? a + 360 : a
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
