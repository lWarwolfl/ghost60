import type { NormalizedPoint } from '@/games/core/game-module'
import type { TTraceConfig } from '@/games/trace/engine'

export const TRACE_RIVAL_DELAY_MS = 500
export const TRACE_MOVE_MIN_UNITS = 60

export type TTraceView = { scale: number; ox: number; oy: number; side: number }

export function traceView(cssW: number, cssH: number): TTraceView {
  const pad = 8
  const side = Math.max(1, Math.min(cssW, cssH) - pad * 2)
  return { scale: side / 10000, ox: (cssW - side) / 2, oy: (cssH - side) / 2, side }
}

export function toFixedPoint(px: number, py: number, cssW: number, cssH: number): NormalizedPoint {
  const view = traceView(cssW, cssH)
  return {
    x: Math.min(10000, Math.max(0, Math.round((px - view.ox) / view.scale))),
    y: Math.min(10000, Math.max(0, Math.round((py - view.oy) / view.scale)))
  }
}

export function toScreen(p: NormalizedPoint, view: TTraceView) {
  return { x: view.ox + p.x * view.scale, y: view.oy + p.y * view.scale }
}

function dist(a: NormalizedPoint, b: NormalizedPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function passedGates(gates: TTraceConfig['gates'], samples: NormalizedPoint[]) {
  let expected = 0
  for (const s of samples) {
    if (expected >= gates.length) break
    if (dist(s, gates[expected]) <= gates[expected].r) expected += 1
  }
  return expected
}

export type TRivalPoint = { t: number; p: NormalizedPoint }

export function delayedRivalPath(points: TRivalPoint[], elapsedMs: number, delayMs = TRACE_RIVAL_DELAY_MS) {
  const cutoff = elapsedMs - delayMs
  return points.filter((pt) => pt.t <= cutoff)
}
