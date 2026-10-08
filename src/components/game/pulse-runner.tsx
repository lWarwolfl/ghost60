'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'
import { audio } from '@/lib/game/audio'
import { pulseEngine, type TPulseConfig } from '@/games/pulse/engine'

const APPROACH_MS = 1200

function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
  return { w: canvas.width, h: canvas.height }
}

function radiusAt(tapT: number, targetMs: number, r: number) {
  if (tapT <= targetMs) {
    const p = Math.min(1, Math.max(0, (tapT - (targetMs - APPROACH_MS)) / APPROACH_MS))
    return r * (1 + 0.9 * (1 - p))
  }
  return r * (1 + 0.15 * Math.min(1, (tapT - targetMs) / 300))
}

export function PulseRunner({ game, session }: { game: TPublicGame; session: TRunSession }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const [score, setScore] = useState(0)
  const config = useMemo(
    () => pulseEngine.validateConfig(game.config) as TPulseConfig,
    [game.config]
  )
  const pulses = useMemo(
    () => [...config.pulses].sort((a, b) => a.targetMs - b.targetMs),
    [config]
  )
  const durationMs = game.durationMs

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    let dims = fitCanvas(canvas)
    const ro = new ResizeObserver(() => {
      dims = fitCanvas(canvas)
    })
    ro.observe(canvas)
    let raf = 0
    const draw = () => {
      const elapsed = session.getElapsed()
      const { w, h } = dims
      ctx2d.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const r = Math.min(w, h) * 0.3
      const lw = Math.max(2, w * 0.008)
      ctx2d.strokeStyle = 'rgba(245,247,255,0.12)'
      ctx2d.lineWidth = lw
      for (const k of [0.55, 1.45]) {
        ctx2d.beginPath()
        ctx2d.arc(cx, cy, r * k, 0, Math.PI * 2)
        ctx2d.stroke()
      }
      ctx2d.strokeStyle = '#62f7e6'
      ctx2d.lineWidth = lw * 1.8
      ctx2d.beginPath()
      ctx2d.arc(cx, cy, r, 0, Math.PI * 2)
      ctx2d.stroke()
      for (const pulse of pulses) {
        if (pulse.targetMs < elapsed - 500 || pulse.targetMs > elapsed + APPROACH_MS + 300) continue
        const p = Math.min(1, Math.max(0, (elapsed - (pulse.targetMs - APPROACH_MS)) / APPROACH_MS))
        const done = elapsed > pulse.targetMs
        const alpha = done ? Math.max(0, 1 - (elapsed - pulse.targetMs) / 300) : 0.9
        const rr = done
          ? r * (1 + 0.15 * Math.min(1, (elapsed - pulse.targetMs) / 300))
          : r * (1 + 0.9 * (1 - p))
        ctx2d.strokeStyle = '#a98bff'
        ctx2d.globalAlpha = alpha
        ctx2d.lineWidth = lw * 1.4
        ctx2d.beginPath()
        ctx2d.arc(cx, cy, rr, 0, Math.PI * 2)
        ctx2d.stroke()
        ctx2d.globalAlpha = 1
      }
      const taps = session.eventsRef.current
      const used = new Array(taps.length).fill(false)
      for (const pulse of pulses) {
        let best = -1
        let bestDt = Number.POSITIVE_INFINITY
        for (let i = 0; i < taps.length; i += 1) {
          if (used[i]) continue
          const dt = Math.abs(taps[i].t - pulse.targetMs)
          if (dt < bestDt) {
            bestDt = dt
            best = i
          }
        }
        if (best === -1) continue
        used[best] = true
        const age = elapsed - taps[best].t
        if (age < 0 || age > 150) continue
        const acc = Math.max(0, 1 - bestDt / pulse.toleranceMs)
        const color = acc >= 0.999 ? '#c7ff5e' : acc > 0 ? '#62f7e6' : '#ff668f'
        ctx2d.strokeStyle = color
        ctx2d.lineWidth = lw * 2
        ctx2d.globalAlpha = session.reduced ? 1 : Math.max(0, 1 - age / 150)
        ctx2d.beginPath()
        ctx2d.arc(cx, cy, radiusAt(taps[best].t, pulse.targetMs, r), 0, Math.PI * 2)
        ctx2d.stroke()
        ctx2d.globalAlpha = 1
      }
      if (timeRef.current) {
        const left = Math.max(0, durationMs - elapsed)
        timeRef.current.textContent = `${(left / 1000).toFixed(1)}s`
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [durationMs, pulses, session])

  const tap = (clientX?: number, clientY?: number) => {
    if (session.phase !== 'running') return
    audio.unlock()
    const canvas = canvasRef.current
    let p = { x: 5000, y: 5000 }
    if (canvas && clientX !== undefined && clientY !== undefined) {
      const rect = canvas.getBoundingClientRect()
      p = {
        x: Math.min(10000, Math.max(0, Math.round(((clientX - rect.left) / rect.width) * 10000))),
        y: Math.min(10000, Math.max(0, Math.round(((clientY - rect.top) / rect.height) * 10000)))
      }
    }
    session.logEvent({ type: 'tap', p })
    const events = session.eventsRef.current
    const res = pulseEngine.scoreRun({ seed: game.seed, config, events, visibilityInterruptions: 0 })
    setScore(res.score)
    const last = events[events.length - 1]
    let best = 0
    for (const pulse of pulses) best = Math.max(best, Math.max(0, 1 - Math.abs(last.t - pulse.targetMs) / pulse.toleranceMs))
    if (best >= 0.999) audio.perfect()
    else if (best > 0) audio.correct()
    else audio.miss()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        tap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-1 py-2 text-sm">
        <span ref={timeRef} className="tnum text-ghost-muted">
          {(game.durationMs / 1000).toFixed(1)}s
        </span>
        <span className="tnum font-600" aria-live="off">
          {score}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Pulse field. Tap when the violet ring meets the cyan band. Space works too."
        className="min-h-75 w-full flex-1 touch-none rounded-card border border-white/10 bg-ink-900"
        onPointerDown={(e) => tap(e.clientX, e.clientY)}
      />
      <p className="py-2 text-center text-xs text-ghost-muted">Tap at alignment · Space works too</p>
    </div>
  )
}
