'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'
import type { GameInputEvent, NormalizedPoint } from '@/games/core/game-module'
import { traceEngine, type TTraceConfig } from '@/games/trace/engine'
import {
  TRACE_MOVE_MIN_UNITS,
  passedGates,
  toFixedPoint,
  toScreen,
  traceView,
  type TRivalPoint,
} from '@/games/trace/table'
import { drawGhostGlyph } from '@/lib/game/ghost-renderer'
import { drawSkinAvatar, drawSkinTrail } from '@/lib/game/skin-renderer'
import { ActionFeedback, useActionFeedback } from '@/components/game/action-feedback'
import { elapsedGhost, ghostEventsAt } from '@/lib/game/ghost-playback'
import { audio } from '@/lib/game/audio'
import { gameplayLoop, isGameInputTarget, traceFeedback } from '@/lib/game/gameplay-motion'

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
// Stable identity so the canvas effect does not restart when no rival exists.
const NO_RIVAL_PATH: TRivalPoint[] = []

export function TraceRunner({
  game,
  session,
  onReady,
  rivalPath = NO_RIVAL_PATH,
  rivalScore = null,
}: {
  game: TPublicGame
  session: TRunSession
  onReady?: () => void
  rivalPath?: TRivalPoint[]
  rivalScore?: number | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const actionFeedback = useActionFeedback()
  const timeRef = useRef<HTMLSpanElement>(null)
  const avatarRef = useRef<HTMLCanvasElement>(null)
  const gatesRef = useRef<HTMLSpanElement>(null)
  const precisionRef = useRef<HTMLMeterElement>(null)
  const feedbackRef = useRef({
    count: -1,
    data: traceFeedback({ gates: [], corridorHalf: 1, completionBonus: 0 }, []),
  })
  const drawingRef = useRef(false)
  const finishRequested = useRef(false)
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (finishTimer.current) clearTimeout(finishTimer.current)
    },
    []
  )
  const feedbackScoreRef = useRef(0)
  const lastPointsAt = useRef(-Infinity)
  const lastRef = useRef<NormalizedPoint | null>(null)
  const passedAtDown = useRef(0)
  const cursorRef = useRef<NormalizedPoint>({ x: 5000, y: 5000 })
  const keyboardRef = useRef(false)
  const [score, setScore] = useState(0)
  const config = useMemo(
    () => traceEngine.validateConfig(game.config) as TTraceConfig,
    [game.config]
  )
  const durationMs = game.durationMs
  const gates = config.gates

  useEffect(() => {
    onReady?.()
  }, [onReady])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    fitCanvas(canvas)
    const ro = new ResizeObserver(() => fitCanvas(canvas))
    ro.observe(canvas)
    let rivalCache = {
      w: 0,
      h: 0,
      points: [] as Array<{ x: number; y: number; t: number; start?: boolean }>,
    }
    const draw = () => {
      const elapsed = session.getElapsed()
      const avatar = avatarRef.current?.getContext('2d')
      if (avatar) {
        avatar.clearRect(0, 0, 32, 32)
        drawSkinAvatar(avatar, {
          skin: session.skin,
          x: 16,
          y: 16,
          size: 25,
          elapsedMs: elapsed,
          reduced: session.reduced,
        })
      }
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

      if (feedbackRef.current.count !== session.eventsRef.current.length)
        feedbackRef.current = {
          count: session.eventsRef.current.length,
          data: traceFeedback(config, session.eventsRef.current),
        }
      const feedback = feedbackRef.current.data
      const passed = feedback.passed
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
        const age = elapsed - feedback.gateTimes[i]
        if (i < passed && age >= 0 && age < 220) {
          ctx2d.beginPath()
          ctx2d.arc(
            s.x,
            s.y,
            g.r * view.scale * (session.reduced ? 1 : 1 - age / 440),
            0,
            Math.PI * 2
          )
          ctx2d.stroke()
        }
      })

      if (rivalCache.w !== w || rivalCache.h !== h)
        rivalCache = {
          w,
          h,
          points: [
            ...rivalPath,
            ...((session.ghost?.replay ?? session.ghost?.timeline)?.flatMap((point) =>
              'p' in point && point.p
                ? [
                    {
                      t: point.t,
                      p: point.p,
                      start: 'type' in point && point.type === 'pointer_down',
                    },
                  ]
                : []
            ) ?? []),
          ].map((point) => {
            const s = toScreen(point.p, view)
            return {
              x: s.x / w,
              y: s.y / h,
              t: point.t,
              start: 'start' in point && Boolean(point.start),
            }
          }),
        }
      const ghostSamples = ghostEventsAt(session.ghost, elapsed)
      const ghostPoint = ghostSamples.at(-1)
      const ghostHistory = elapsedGhost(session.ghost, elapsed)
      if (session.ghost) {
        session.ghostActionRef.current = gates.length
          ? `GHOST ${Math.round((ghostHistory.at(-1)?.progress ?? 0) * 100)}%`
          : null
        drawSkinTrail(ctx2d, {
          points: rivalCache.points,
          skin: session.skin,
          elapsedMs: elapsed,
          width: w,
          height: h,
          reduced: session.reduced,
          rival: true,
          rivalDelayMs: session.ghost.replay ? 0 : 500,
        })
        const point = ghostPoint && 'p' in ghostPoint ? ghostPoint.p : ghostHistory.at(-1)?.p
        if (point) {
          const at = toScreen(point, view)
          drawGhostGlyph(ctx2d, at.x, at.y, lw * 3.5)
        }
      }
      const samples = feedback.samples
      for (let i = Math.max(1, samples.length - 96); i < samples.length; i += 1) {
        const p = samples[i]
        if (p.down || elapsed - p.t > (session.reduced ? 25 : 50)) continue
        const a = toScreen(samples[i - 1], view)
        const s = toScreen(p, view)
        ctx2d.strokeStyle =
          p.band === 'outside' ? '#ff668f' : p.band === 'near' ? '#ffc46b' : '#62f7e6'
        ctx2d.lineWidth = lw * 1.4
        ctx2d.beginPath()
        ctx2d.moveTo(a.x, a.y)
        ctx2d.lineTo(s.x, s.y)
        ctx2d.stroke()
      }
      const latest = samples.at(-1)
      if (latest && drawingRef.current) {
        const s = toScreen(latest, view)
        ctx2d.fillStyle = '#f5f7ff'
        ctx2d.strokeStyle =
          latest.band === 'outside' ? '#ff668f' : latest.band === 'near' ? '#ffc46b' : '#62f7e6'
        ctx2d.lineWidth = lw
        ctx2d.beginPath()
        ctx2d.arc(s.x, s.y, lw * 2, 0, Math.PI * 2)
        ctx2d.fill()
        ctx2d.stroke()
      }
      if (precisionRef.current) precisionRef.current.value = feedback.precision

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
      return elapsed < durationMs
    }
    const stop = gameplayLoop(draw)
    return () => {
      stop()
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- countdown ticks must not re-init the canvas
  }, [config, durationMs, gates, rivalPath, session.skin, session.reduced])

  const toBoard = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const dx = ((clientX - rect.left) * canvas.width) / rect.width
    const dy = ((clientY - rect.top) * canvas.height) / rect.height
    return toFixedPoint(dx, dy, canvas.width, canvas.height)
  }

  const scoreNow = () => {
    const res = traceEngine.scoreRun({
      seed: game.seed,
      config,
      events: session.eventsRef.current,
      visibilityInterruptions: 0,
    })
    setScore(res.score)
    session.reportScore(res.score)
    const previousGates = feedbackRef.current.data.passed
    feedbackRef.current = {
      count: session.eventsRef.current.length,
      data: traceFeedback(config, session.eventsRef.current),
    }
    const last = session.eventsRef.current.at(-1)
    if (
      last &&
      'p' in last &&
      last.p &&
      (feedbackRef.current.data.passed > previousGates ||
        last.type === 'pointer_up' ||
        last.t - lastPointsAt.current > 800)
    ) {
      const canvas = canvasRef.current
      if (canvas) {
        const point = toScreen(last.p, traceView(canvas.width, canvas.height))
        actionFeedback.show({
          x: point.x / canvas.width,
          y: point.y / canvas.height,
          delta: res.score - feedbackScoreRef.current,
        })
      }
      feedbackScoreRef.current = res.score
      lastPointsAt.current = last.t
    }
    return res.score
  }

  const down = (p: NormalizedPoint) => {
    if (session.phase !== 'running' || drawingRef.current || finishRequested.current) return
    audio.unlock()
    if (session.logEvent({ type: 'pointer_down', p }) < 0) return
    drawingRef.current = true
    lastRef.current = p
    passedAtDown.current = passedGates(gates, samplesOf(session.eventsRef.current).slice(0, -1))
    scoreNow()
  }

  const move = (p: NormalizedPoint) => {
    if (session.phase !== 'running' || !drawingRef.current || !lastRef.current) return
    const dx = p.x - lastRef.current.x
    const dy = p.y - lastRef.current.y
    if (Math.hypot(dx, dy) < TRACE_MOVE_MIN_UNITS) return
    if (session.logEvent({ type: 'pointer_move', p }) < 0) return
    const before = feedbackRef.current.data.passed
    scoreNow()
    if (feedbackRef.current.data.passed > before) audio.correct()
    lastRef.current = p
  }

  const up = (p: NormalizedPoint) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastRef.current = null
    if (session.phase !== 'running') return
    session.logEvent({ type: 'pointer_up', p })
    scoreNow()
    const passed = passedGates(gates, samplesOf(session.eventsRef.current))
    if (passed >= gates.length && !finishRequested.current) {
      finishRequested.current = true
      finishTimer.current = setTimeout(() => session.finish(), 1600)
      return
    }
    if (passed > passedAtDown.current) audio.correct()
    else audio.miss()
  }

  const moveCursor = (dx: number, dy: number) => {
    keyboardRef.current = true
    cursorRef.current = {
      x: Math.min(10000, Math.max(0, cursorRef.current.x + dx)),
      y: Math.min(10000, Math.max(0, cursorRef.current.y + dy)),
    }
    if (drawingRef.current) move({ ...cursorRef.current })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isGameInputTarget(e.target)) return
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
      <div className="game-hud">
        <canvas
          ref={avatarRef}
          width={32}
          height={32}
          className="size-8 shrink-0"
          aria-hidden="true"
        />
        <span ref={timeRef} className="game-timer">
          {(durationMs / 1000).toFixed(1)}s
        </span>
        <span ref={gatesRef} className="game-chip flex-1">
          Gates 0/{gates.length}
        </span>
        <span className="game-score flex items-center gap-2" aria-live="off">
          {rivalScore !== null && (
            <span className="font-600 text-spectral-violet text-xs">R {rivalScore}</span>
          )}
          {score}
        </span>
      </div>
      <div className="game-subhud">
        <label className="text-ghost-muted flex flex-1 items-center gap-2 text-[10px] tracking-[0.16em] uppercase">
          Precision
          <meter
            ref={precisionRef}
            min={0}
            max={1200}
            low={400}
            high={900}
            optimum={1200}
            defaultValue={0}
            className="min-w-0 flex-1"
          />
        </label>
      </div>
      <div className="relative flex min-h-75 flex-1 flex-col">
        <canvas
          ref={canvasRef}
          role="application"
          tabIndex={0}
          aria-label="Trace corridor. Drag through the gates in order. Arrows move the cursor, Space starts, Enter lifts."
          style={{
            opacity: session.phase === 'finishing' ? 0.6 : 1,
            transition: 'opacity 120ms linear',
          }}
          className="game-arena min-h-75 w-full flex-1 touch-none"
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
        <ActionFeedback entries={actionFeedback.entries} reduced={session.reduced} />
      </div>
      <p className="game-hint">Drag through every gate in order · keyboard works too</p>
    </div>
  )
}
