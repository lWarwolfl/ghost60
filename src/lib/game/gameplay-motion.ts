import type { GameInputEvent, NormalizedPoint } from '@/games/core/game-module'
import type { TRecallConfig } from '@/games/recall/engine'
import { resolveSequences } from '@/games/recall/table'
import type { TTraceConfig } from '@/games/trace/engine'

export const ACTION_FEEDBACK_MS = 1600

// Keep game shortcuts from swallowing keyboard navigation, especially the Quit link.
export function isGameInputTarget(target: EventTarget | null) {
  return !(
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    target.closest('a, input, select, textarea, [contenteditable="true"]')
  )
}

export function runClock(now: number, start: number, duration: number) {
  const elapsed = now - start
  return {
    elapsed: Math.min(duration, Math.max(0, elapsed)),
    running: elapsed >= 0 && elapsed < duration,
    consume: elapsed >= 3000,
    finished: elapsed >= duration,
  }
}

export function consumptionRequest(token: string, request: typeof fetch = fetch) {
  let consumed = false
  let pending: Promise<boolean> | null = null
  return () => {
    if (consumed) return Promise.resolve(true)
    if (pending) return pending
    pending = request('/api/game/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      keepalive: true,
    })
      .then(async (response) => {
        consumed = response.ok && (await response.json()).consumed === true
        return consumed
      })
      .catch(() => false)
      .finally(() => {
        pending = null
      })
    return pending
  }
}

export function inputTime(now: number, start: number, duration: number, running: boolean) {
  const elapsed = now - start
  return running && elapsed >= 0 && elapsed < duration ? Math.round(elapsed) : -1
}

export function countdownState(elapsed: number) {
  return {
    count: Math.max(0, 3 - Math.floor(elapsed / 1000)),
    visible: elapsed < 3000 ? elapsed % 1000 < 700 : elapsed < 3250,
  }
}

export function feedbackState(age: number, duration: number, reduced: boolean) {
  const visible = age >= 0 && age < duration
  const p = Math.min(1, Math.max(0, age / duration))
  return {
    visible,
    opacity: reduced ? 1 : 1 - p * p,
    rise: reduced ? 0 : p * 10,
    sparks: visible && !reduced ? 8 : 0,
  }
}

export function signedPoints(delta: number) {
  return delta > 0 ? `+${delta}` : String(delta)
}

export function ghostDeltaAt(
  timeline: ReadonlyArray<{ t: number; score?: number; delta?: number }>,
  elapsed: number
) {
  let previous = 0
  let recent: { delta: number; at: number } | null = null
  for (const sample of timeline) {
    if (!Number.isFinite(sample.t) || sample.t > elapsed) break
    const score = Math.max(0, Math.round(sample.score ?? previous))
    const delta = sample.delta ?? score - previous
    if (delta !== 0) recent = { delta, at: sample.t }
    previous = score
  }
  return recent
}

export function committedGhost<T extends { t: number }>(
  timeline: readonly T[],
  commitments: readonly (number | null)[],
  elapsed: number
) {
  return timeline.filter(
    (point, i) =>
      Number.isFinite(point.t) &&
      point.t >= 0 &&
      point.t <= elapsed &&
      commitments[i] !== null &&
      commitments[i] !== undefined &&
      commitments[i]! <= elapsed
  )
}

export function ghostAt<T extends { t: number; progress?: number; score?: number }>(
  timeline: readonly T[],
  elapsed: number,
  fallbackScore = 0
) {
  let point: T | null = null
  for (const sample of timeline) {
    if (!Number.isFinite(sample.t) || sample.t > elapsed) break
    point = sample
  }
  const progress = Math.min(1, Math.max(0, point?.progress ?? 0))
  return { progress, score: Math.max(0, Math.round(point?.score ?? progress * fallbackScore)) }
}

export function pulseAssignments(
  pulses: readonly { targetMs: number }[],
  taps: readonly { t: number }[]
) {
  const used = new Set<number>()
  return pulses.map((pulse) => {
    let best = -1
    let distance = Infinity
    for (let i = 0; i < taps.length; i += 1) {
      const dt = Math.abs(taps[i].t - pulse.targetMs)
      if (!used.has(i) && dt < distance) {
        best = i
        distance = dt
      }
    }
    if (best !== -1) used.add(best)
    return best
  })
}

export function recallFeedback(
  config: TRecallConfig,
  choices: Extract<GameInputEvent, { type: 'choice' }>[]
) {
  const resolved = resolveSequences(config, choices)
  let cursor = 0
  for (let i = 0; i < resolved.length; i += 1) {
    const round = resolved[i]
    cursor += round.used
    if (cursor === choices.length && round.used > 0) {
      const last = choices[cursor - 1]
      return {
        status: round.status,
        cell: last.value,
        at: last.t,
        sequence: i,
        cells: choices.slice(cursor - round.used, cursor).map((c) => c.value),
      }
    }
  }
  return null
}

function deviation(p: NormalizedPoint, gates: TTraceConfig['gates']) {
  let best = Infinity
  for (let i = 1; i < gates.length; i += 1) {
    const a = gates[i - 1]
    const b = gates[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = dx * dx + dy * dy
    const t = length ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy))
  }
  return best
}

export function traceFeedback(config: TTraceConfig, events: readonly GameInputEvent[]) {
  const gateTimes: number[] = []
  let total = 0
  const samples: Array<
    NormalizedPoint & { t: number; band: 'inside' | 'near' | 'outside'; down: boolean }
  > = []
  for (const e of events) {
    if (!('p' in e) || !e.p) continue
    const distance = deviation(e.p, config.gates)
    total += distance
    const gate = config.gates[gateTimes.length]
    if (gate && Math.hypot(e.p.x - gate.x, e.p.y - gate.y) <= gate.r) gateTimes.push(e.t)
    samples.push({
      ...e.p,
      t: e.t,
      band:
        distance > config.corridorHalf
          ? 'outside'
          : distance >= config.corridorHalf * 0.75
            ? 'near'
            : 'inside',
      down: e.type === 'pointer_down',
    })
  }
  const precision = samples.length
    ? Math.round(1200 * Math.max(0, 1 - total / samples.length / config.corridorHalf))
    : 0
  return { passed: gateTimes.length, gateTimes, precision, samples }
}

export function gameplayLoop(draw: () => boolean) {
  let raf = 0
  let stopped = false
  const frame = () => {
    if (stopped || document.hidden) return
    if (draw()) raf = requestAnimationFrame(frame)
    else stopped = true
  }
  const visibility = () => {
    cancelAnimationFrame(raf)
    if (!document.hidden && !stopped) raf = requestAnimationFrame(frame)
  }
  if (!document.hidden) raf = requestAnimationFrame(frame)
  document.addEventListener('visibilitychange', visibility)
  return () => {
    stopped = true
    cancelAnimationFrame(raf)
    document.removeEventListener('visibilitychange', visibility)
  }
}

export function drawFeedback(
  ctx: CanvasRenderingContext2D,
  options: {
    x: number
    y: number
    radius: number
    age: number
    duration: number
    reduced: boolean
    kind: 'perfect' | 'good' | 'miss'
    label: string
  }
) {
  const { x, y, radius, age, duration, reduced, kind, label } = options
  const state = feedbackState(age, duration, reduced)
  if (!state.visible) return
  ctx.save()
  ctx.globalAlpha = state.opacity
  ctx.strokeStyle = ctx.fillStyle =
    kind === 'perfect' ? '#c7ff5e' : kind === 'good' ? '#62f7e6' : '#ff668f'
  ctx.lineWidth = Math.max(2, radius * 0.03)
  ctx.beginPath()
  if (kind === 'miss') {
    ctx.moveTo(x - radius * 0.15, y - radius * 0.15)
    ctx.lineTo(x + radius * 0.15, y + radius * 0.15)
    ctx.moveTo(x + radius * 0.15, y - radius * 0.15)
    ctx.lineTo(x - radius * 0.15, y + radius * 0.15)
  } else {
    ctx.moveTo(x - radius * 0.15, y)
    ctx.lineTo(x - radius * 0.02, y + radius * 0.12)
    ctx.lineTo(x + radius * 0.2, y - radius * 0.14)
  }
  ctx.stroke()
  if (kind === 'perfect') {
    for (let i = 0; i < state.sparks; i += 1) {
      const a = (i * Math.PI) / 4
      const r = radius * (0.7 + (age / duration) * 0.5)
      ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, 2, 2)
    }
  }
  ctx.font = '700 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, x, y + radius * 0.6 - state.rise)
  ctx.restore()
}
