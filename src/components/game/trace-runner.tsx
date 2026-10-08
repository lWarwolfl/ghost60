'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'
import type { GameInputEvent, NormalizedPoint } from '@/games/core/game-module'
import { traceEngine, type TTraceConfig } from '@/games/trace/engine'
import {
  TRACE_MOVE_MIN_UNITS,
  delayedRivalPath,
  passedGates,
  toFixedPoint,
  toScreen,
  traceView,
  type TRivalPoint
} from '@/games/trace/table'
import { audio } from '@/lib/game/audio'

function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
}

function samplesOf(events: GameInputEvent[]): NormalizedPoint[] {
  const out: NormalizedPoint[] = []
  for (const e of events) {
    if ('p' in e && e.p !== undefined) out.push(e.p as NormalizedPoint)
  }
  return out
}

const CURSOR_STEP = 250

export function TraceRunner({
  game,
  session,
  rivalPath = [],
  rivalScore = null
}: {
  game: TPublicGame
  session: TRunSession
  rivalPath?: TRivalPoint[]
  rivalScore?: number | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const gatesRef = useRef<HTMLSpanElement>(null)
  const drawingRef = useRef(false)
  const lastRef = useRef<NormalizedPoint | null>(null)
  const passedAtDown = useRef(0)
  const cursorRef = useRef<NormalizedPoint>({ x: 5000, y: 5000 })
  const keyboardRef = useRef(false)
  const [score, setScore] = useState(0)
  const config = useMemo(() => traceEngine.validateConfig(game.config) as TTraceConfig, [game.config])
  const durationMs = game.durationMs
  const gates = config.gates

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    fitCanvas(canvas)
    const ro = new ResizeObserver(() => fitCanvas(canvas))
    ro.observe(canvas)
    let raf = 0
    const draw = () => {
      const elapsed = session.getElapsed()
      const w = canvas.width
      const h = canvas.height
      const view = traceView(w, h)
      ctx2d.clearRect(0, 0, w, h)
      const lw = Math.max(2, view.side * 0.006)

      ctx2d.lineCap = 'round'
      ctx2d.lineJoin = 'round'
      ctx2d.strokeStyle = 'rgba(169,139,255,0.22)'
      ctx2d.lineWidth = config.corridorHalf * 2 * view.scale
      ctx2d.beginPath()
      gates.forEach((g, i) => {
        const s = toScreen(g, view)
        if (i === 0) ctx2d.moveTo(s.x, s.y)
        else ctx2d.lineTo(s.x, s.y)
      })
      ctx2d.stroke()

      const trail = samplesOf(session.eventsRef.current)
      const passed = passedGates(gates, trail)
      gates.forEach((g, i) => {
        const s = toScreen(g, view)
        ctx2d.beginPath()
        ctx2d.arc(s.x, s.y, g.r * view.scale, 0, Math.PI * 2)
        if (i < passed) {
          ctx2d.fillStyle = 'rgba(199,255,94,0.25)'
          ctx2d.fill()
          ctx2d.strokeStyle = '#c7ff5e'
        } else if (i === passed) {
          ctx2d.strokeStyle = '#62f7e6'
        } else {
          ctx2d.strokeStyle = 'rgba(245,247,255,0.25)'
        }
        ctx2d.lineWidth = lw
        ctx2d.stroke()
      })

      const seen = delayedRivalPath(rivalPath, elapsed)
      if (seen.length > 1) {
        ctx2d.globalAlpha = 0.45
        ctx2d.strokeStyle = '#f5f7ff'
        ctx2d.lineWidth = lw * 0.9
        ctx2d.beginPath()
        seen.forEach((pt, i) => {
          const s = toScreen(pt.p, view)
          if (i === 0) ctx2d.moveTo(s.x, s.y)
          else ctx2d.lineTo(s.x, s.y)
        })
        ctx2d.stroke()
        ctx2d.globalAlpha = 1
      }

      if (trail.length > 1) {
        ctx2d.strokeStyle = '#62f7e6'
        ctx2d.lineWidth = lw * 1.4
        ctx2d.beginPath()
        trail.forEach((p, i) => {
          const s = toScreen(p, view)
          if (i === 0) ctx2d.moveTo(s.x, s.y)
          else ctx2d.lineTo(s.x, s.y)
        })
        ctx2d.stroke()
      }

      if (keyboardRef.current) {
        const s = toScreen(cursorRef.current, view)
        ctx2d.strokeStyle = '#f5f7ff'
        ctx2d.lineWidth = lw
        const r = lw * 4
        ctx2d.beginPath()
        ctx2d.moveTo(s.x - r, s.y)
        ctx2d.lineTo(s.x + r, s.y)
        ctx2d.moveTo(s.x, s.y - r)
        ctx2d.lineTo(s.x, s.y + r)
        ctx2d.stroke()
      }

      if (timeRef.current) {
        const left = Math.max(0, durationMs - elapsed)
        timeRef.current.textContent = `${(left / 1000).toFixed(1)}s`
      }
      if (gatesRef.current) {
        gatesRef.current.textContent = `GATES ${passed}/${gates.length}`
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [config, durationMs, gates, session, rivalPath])

  const toBoard = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const dx = ((clientX - rect.left) * canvas.width) / rect.width
    const dy = ((clientY - rect.top) * canvas.height) / rect.height
    return toFixedPoint(dx, dy, canvas.width, canvas.height)
  }

  const scoreNow = () => {
    const res = traceEngine.scoreRun({ seed: game.seed, config, events: session.eventsRef.current, visibilityInterruptions: 0 })
    setScore(res.score)
    return res.score
  }

  const down = (p: NormalizedPoint) => {
    if (session.phase !== 'running' || drawingRef.current) return
    audio.unlock()
    drawingRef.current = true
    lastRef.current = p
    passedAtDown.current = passedGates(gates, samplesOf(session.eventsRef.current))
    session.logEvent({ type: 'pointer_down', p })
    scoreNow()
  }

  const move = (p: NormalizedPoint) => {
    if (session.phase !== 'running' || !drawingRef.current || !lastRef.current) return
    const dx = p.x - lastRef.current.x
    const dy = p.y - lastRef.current.y
    if (Math.hypot(dx, dy) < TRACE_MOVE_MIN_UNITS) return
    lastRef.current = p
    session.logEvent({ type: 'pointer_move', p })
  }

  const up = (p: NormalizedPoint) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastRef.current = null
    if (session.phase !== 'running') return
    session.logEvent({ type: 'pointer_up', p })
    scoreNow()
    const passed = passedGates(gates, samplesOf(session.eventsRef.current))
    if (passed > passedAtDown.current) audio.correct()
    else audio.miss()
  }

  const moveCursor = (dx: number, dy: number) => {
    keyboardRef.current = true
    cursorRef.current = {
      x: Math.min(10000, Math.max(0, cursorRef.current.x + dx)),
      y: Math.min(10000, Math.max(0, cursorRef.current.y + dy))
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        moveCursor(-CURSOR_STEP, 0)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        moveCursor(CURSOR_STEP, 0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveCursor(0, -CURSOR_STEP)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveCursor(0, CURSOR_STEP)
      } else if (e.key === ' ') {
        e.preventDefault()
        keyboardRef.current = true
        down({ ...cursorRef.current })
      } else if (e.key === 'Enter') {
        e.preventDefault()
        up({ ...cursorRef.current })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-1 py-2 text-sm">
        <span ref={timeRef} className="tnum text-ghost-muted">
          {(durationMs / 1000).toFixed(1)}s
        </span>
        <span ref={gatesRef} className="tnum rounded-control bg-surface-700 px-3 py-1 font-display text-xs font-800 tracking-[0.14em] text-spectral-cyan">
          GATES 0/{gates.length}
        </span>
        <span className="tnum flex items-center gap-2 font-600" aria-live="off">
          {rivalScore !== null && <span className="text-xs font-600 text-spectral-violet">RIVAL {rivalScore}</span>}
          {score}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Trace corridor. Drag through the gates in order. Arrows move the cursor, Space starts, Enter lifts."
        className="min-h-75 w-full flex-1 touch-none rounded-card border border-white/10 bg-ink-900"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          down(toBoard(e.clientX, e.clientY))
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0) move(toBoard(e.clientX, e.clientY))
        }}
        onPointerUp={(e) => up(toBoard(e.clientX, e.clientY))}
        onPointerCancel={(e) => up(toBoard(e.clientX, e.clientY))}
      />
      <p className="py-2 text-center text-xs text-ghost-muted">Drag through every gate in order · keyboard works too</p>
    </div>
  )
}
