import { createRng } from '@/games/core/rng'
import type { TScheduleDay } from '@/games/content/schedule'
import { orbitEngine, angleDistDeg, type TOrbitTarget } from '@/games/orbit/engine'
import { markerAngleAt, markerCrossingAt, ORBIT_DURATION_MS } from '@/games/orbit/table'
import { pulseEngine } from '@/games/pulse/engine'
import { recallEngine } from '@/games/recall/engine'
import { shiftEngine } from '@/games/shift/engine'
import { snapEngine } from '@/games/snap/engine'
import { traceEngine } from '@/games/trace/engine'

export type TBuiltDay = { engine: string; seed: string; config: unknown }

function num(v: unknown, fallback: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function buildPulse(day: TScheduleDay) {
  const count = Math.min(20, Math.max(3, Math.round(num(day.config['pulseCount'], 5))))
  const tolerance = Math.min(600, Math.max(60, Math.round(num(day.config['toleranceMs'], 180))))
  const start = 3000
  const end = 43500
  const avg = count > 1 ? (end - start) / (count - 1) : 0
  const pulses: Array<{ targetMs: number; toleranceMs: number }> = []
  let target = start
  for (let i = 0; i < count; i += 1) {
    pulses.push({ targetMs: Math.round(target), toleranceMs: tolerance })
    if (i < count - 1) {
      // Gaps shrink from 1.5x to 0.5x the average: same hit window, faster rhythm late.
      const ramp = count > 2 ? i / (count - 2) : 0
      target += avg * (1.5 - ramp)
    }
  }
  return pulseEngine.validateConfig({ pulses })
}

function buildSnap(day: TScheduleDay) {
  const count = Math.min(24, Math.max(4, Math.round(num(day.config['rounds'], 6))))
  const wStart = Math.round(num(day.config['windowMsStart'], 2500))
  const wEnd = Math.round(num(day.config['windowMsEnd'], 900))
  const maxWindow = Math.max(wStart, wEnd)
  const span = 39800 - Math.min(8000, Math.max(800, maxWindow)) - 3000
  const gap = span / Math.max(1, count - 1)
  const rounds = Array.from({ length: count }, (_, i) => {
    const ramp = count > 1 ? Math.pow(i / (count - 1), 1.25) : 0
    const options = Math.min(8, 4 + Math.round(ramp * 4))
    return {
      correct: i % options,
      options,
      presentedMs: Math.round(3000 + (span * i) / Math.max(1, count - 1)),
      windowMs: Math.min(8000, Math.max(800, Math.round(Math.min(gap * 0.95, wStart + (wEnd - wStart) * ramp))))
    }
  })
  return snapEngine.validateConfig({ rounds })
}

function buildOrbit(day: TScheduleDay) {
  const count = Math.min(20, Math.max(3, Math.round(num(day.config['targets'], 5))))
  const rpm = Math.min(60, Math.max(6, Math.round(num(day.config['rpm'], 15))))
  const periodMs = Math.round(60000 / rpm)
  const perfect = Math.min(12, Math.max(4, Math.round(num(day.config['perfectArc'], 0.18) * 44)))
  const markerRamp = Math.min(1.5, Math.max(0, num(day.config['speedRamp'], 1)))
  const rng = createRng(day.seedKey)
  const first = 2500
  const last = 42500
  const weights = Array.from({ length: Math.max(1, count - 1) }, (_, i) => {
    const progress = count > 2 ? i / (count - 2) : 0
    // Random gaps, but later gaps are shorter so the round still tightens up.
    return (0.55 + rng.nextFloat() * 0.45) * (1.15 - 0.3 * progress)
  })
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1
  let cursor = first
  const wanted = [first]
  for (const weight of weights) {
    cursor += ((last - first) * weight) / total
    wanted.push(cursor)
  }

  const picked: Array<{ midMs: number; angleDeg: number }> = []
  for (const desired of wanted) {
    let choice: { midMs: number; angleDeg: number } | null = null
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const angleDeg = Math.floor(rng.nextFloat() * 360)
      const midMs = markerCrossingAt(angleDeg, desired, periodMs, markerRamp, ORBIT_DURATION_MS)
      if (midMs < 2000 || midMs > 43000) continue
      if (picked.some((other) => Math.abs(other.midMs - midMs) < 900)) continue
      // Arcs that can be live together must stay far enough apart to read clearly.
      if (
        picked.some(
          (other) => Math.abs(other.midMs - midMs) < 2800 && angleDistDeg(other.angleDeg, angleDeg) < 80
        )
      )
        continue
      choice = { midMs, angleDeg }
      break
    }
    if (!choice) {
      const midMs = Math.min(43000, Math.max(2000, desired))
      const angleDeg = Math.round(markerAngleAt(midMs, periodMs, markerRamp, ORBIT_DURATION_MS)) % 360
      choice = { midMs, angleDeg }
    }
    picked.push(choice)
  }
  picked.sort((a, b) => a.midMs - b.midMs)

  const targets: TOrbitTarget[] = picked.map(({ midMs, angleDeg }) => {
    // Long windows overlap, so 2-3 arcs can be live at once.
    const width = 2200 + Math.round(rng.nextFloat() * 6) * 100
    const mid = Math.round(midMs)
    const openMs = mid - width / 2
    return {
      angleDeg,
      perfectTolDeg: perfect,
      goodTolDeg: perfect + 12,
      edgeTolDeg: perfect + 32,
      openMs,
      closeMs: openMs + width
    }
  })
  return orbitEngine.validateConfig({ targets, markerPeriodMs: periodMs, markerRamp })
}

function buildRecall(day: TScheduleDay) {
  const rng = createRng(day.seedKey)
  const grid = num(day.config['grid'], 3) === 4 ? 4 : 3
  const pattern = day.config['lengthPattern']
  const rawLengths: number[] = Array.isArray(pattern)
    ? (pattern as unknown[]).map((v) => Math.min(12, Math.max(1, Math.round(num(v, 3)))))
    : Array.from({ length: 6 }, (_, i) => {
        const start = Math.round(num(day.config['startLength'], 3))
        const max = Math.round(num(day.config['maxLength'], 7))
        return Math.min(12, Math.max(1, Math.round(start + ((max - start) * i) / 5)))
      })
  const lengths = rawLengths.slice(0, 12)
  while (lengths.length > 2 && lengths.reduce((s, l) => s + l * 1200 + 400, 0) > 44000) lengths.pop()
  const sequences = lengths.map((len, index) => {
    const pool = Array.from({ length: grid * grid }, (_, c) => c)
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.nextFloat() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const ramp = lengths.length > 1 ? Math.pow(index / (lengths.length - 1), 1.25) : 0
    return { cells: pool.slice(0, len), parMs: Math.round((len <= 2 ? 4000 : 6000) * (1 - 0.3 * ramp)) }
  })
  return recallEngine.validateConfig({ grid, sequences })
}

function buildShift(day: TScheduleDay) {
  const rng = createRng(day.seedKey)
  const count = Math.min(30, Math.max(6, Math.round(num(day.config['rounds'], 8))))
  const sprint = num(day.config['finalSpeedMultiplier'], 1)
  const spacing = (44800 - 2500 - 3000) / Math.max(1, count - 1)
  const cards = Array.from({ length: count }, (_, i) => {
    const ramp = count > 1 ? Math.pow(i / (count - 1), 1.25) : 0
    const lastQuarter = i >= Math.floor(count * 0.75) && sprint > 1
    const base = 2500 - 1000 * ramp
    return {
      correct: (rng.nextFloat() < 0.5 ? 0 : 1) as 0 | 1,
      presentedMs: Math.round(3000 + i * spacing),
      windowMs: Math.min(8000, Math.max(800, Math.round(Math.min(spacing * 0.95, lastQuarter ? base / sprint : base))))
    }
  })
  if (!cards.some((c) => c.correct === 0)) cards[Math.floor(count / 2)].correct = 0
  if (!cards.some((c) => c.correct === 1)) cards[Math.floor(count / 2)].correct = 1
  return shiftEngine.validateConfig({ cards })
}

function buildTrace(day: TScheduleDay) {
  const count = Math.min(28, Math.max(2, Math.round(num(day.config['gates'], 5))))
  const half = Math.min(2000, Math.max(100, Math.round(num(day.config['corridor'], 0.1) * 10000)))
  const path = String(day.config['path'] ?? 'wave')
  const amp = path === 'sine' ? 2400 : 2600
  const waves = path === 'knots' ? 3 : Math.max(1, Math.round(count / 9))
  const gates = Array.from({ length: count }, (_, i) => {
    const ramp = count > 1 ? Math.pow(i / (count - 1), 1.25) : 0
    const x = Math.round(800 + ((9200 - 800) * i) / Math.max(1, count - 1))
    const y = Math.round(
      5000 + amp * Math.sin((i * Math.PI * waves) / Math.max(1, count - 1)) * (path === 'knots' && i % 2 === 1 ? -0.6 : 1)
    )
    return {
      x: Math.min(10000, Math.max(0, x)),
      y: Math.min(10000, Math.max(0, y)),
      r: Math.max(200, Math.round(600 - 220 * ramp))
    }
  })
  return traceEngine.validateConfig({ gates, corridorHalf: half, completionBonus: 500 })
}

export function buildDayConfig(day: TScheduleDay): TBuiltDay {
  switch (day.engine) {
    case 'pulse':
      return { engine: day.engine, seed: day.seedKey, config: buildPulse(day) }
    case 'snap':
      return { engine: day.engine, seed: day.seedKey, config: buildSnap(day) }
    case 'orbit':
      return { engine: day.engine, seed: day.seedKey, config: buildOrbit(day) }
    case 'recall':
      return { engine: day.engine, seed: day.seedKey, config: buildRecall(day) }
    case 'shift':
      return { engine: day.engine, seed: day.seedKey, config: buildShift(day) }
    case 'trace':
      return { engine: day.engine, seed: day.seedKey, config: buildTrace(day) }
    default:
      throw new Error(`unknown-engine: ${day.engine}`)
  }
}
