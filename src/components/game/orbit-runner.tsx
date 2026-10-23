'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'
import type { GameInputEvent } from '@/games/core/game-module'
import { angleDistDeg, orbitBand, orbitEngine, type TOrbitConfig } from '@/games/orbit/engine'
import {
  ORBIT_ARC_LEAD_MS,
  ORBIT_MARKER_PERIOD_MS,
  ORBIT_VERDICT_MS,
  assignTaps,
  markerAngleAt,
  toIntAngle,
  visibleRivalNotches,
  type TRivalNotch,
} from '@/games/orbit/table'
import { drawSkinAvatar } from '@/lib/game/skin-renderer'
import { ActionFeedback, useActionFeedback } from '@/components/game/action-feedback'
import { elapsedGhost, ghostEventsAt } from '@/lib/game/ghost-playback'
import { audio } from '@/lib/game/audio'
import { gameplayLoop, isGameInputTarget, signedPoints } from '@/lib/game/gameplay-motion'
import { drawGhostGlyph } from '@/lib/game/ghost-renderer'

function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
  return { w: canvas.width, h: canvas.height }
}

const RAD = Math.PI / 180
// Stable identity so the canvas effect does not restart when no rival exists.
const NO_NOTCHES: TRivalNotch[] = []

type TVerdict = { band: number; at: number; angle: number; premature: boolean; missed: boolean }

export function OrbitRunner({
  game,
  session,
  onReady,
  rivalNotches = NO_NOTCHES,
  rivalScore = null,
}: {
  game: TPublicGame
  session: TRunSession
  onReady?: () => void
  rivalNotches?: TRivalNotch[]
  rivalScore?: number | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const actionFeedback = useActionFeedback()
  const timeRef = useRef<HTMLSpanElement>(null)
  const avatarRef = useRef<HTMLCanvasElement>(null)
  const verdictCache = useRef<{ count: number; verdicts: TVerdict[] }>({ count: -1, verdicts: [] })
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(0)
  const config = useMemo(
    () => orbitEngine.validateConfig(game.config) as TOrbitConfig,
    [game.config]
  )
  const targets = config.targets
  const markerPeriod = config.markerPeriodMs ?? ORBIT_MARKER_PERIOD_MS
  const markerRamp = config.markerRamp ?? 0
  const durationMs = game.durationMs

  useEffect(() => {
    onReady?.()
  }, [onReady])

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
      const taps = session.eventsRef.current
      const { w, h } = dims
      ctx2d.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const r = Math.min(w, h) * 0.32
      const lw = Math.max(2, w * 0.008)

      ctx2d.strokeStyle = 'rgba(245,247,255,0.12)'
      ctx2d.lineWidth = lw
      ctx2d.beginPath()
      ctx2d.arc(cx, cy, r, 0, Math.PI * 2)
      ctx2d.stroke()

      if (verdictCache.current.count !== taps.length) {
        const assigned = assignTaps(targets, taps)
        verdictCache.current = {
          count: taps.length,
          verdicts: assigned.map((tapIndex, i) => {
            if (tapIndex === -1)
              return { band: 0, at: -1, angle: 0, premature: false, missed: false }
            const tap = taps[tapIndex] as Extract<GameInputEvent, { type: 'tap' }>
            const target = targets[i]
            if (tap.t < target.openMs)
              return {
                band: 0,
                at: tap.t,
                angle: tap.value ?? target.angleDeg,
                premature: true,
                missed: false,
              }
            if (tap.t > target.closeMs)
              return {
                band: 0,
                at: tap.t,
                angle: tap.value ?? target.angleDeg,
                premature: false,
                missed: true,
              }
            const angle = tap.value === undefined ? target.angleDeg : tap.value
            return {
              band: orbitBand(angleDistDeg(angle, target.angleDeg), target),
              at: tap.t,
              angle: tap.value ?? target.angleDeg,
              premature: false,
              missed: false,
            }
          }),
        }
      }
      const verdicts = verdictCache.current.verdicts

      for (let i = 0; i < targets.length; i += 1) {
        const target = targets[i]
        if (
          elapsed < target.openMs - ORBIT_ARC_LEAD_MS ||
          elapsed > target.closeMs + ORBIT_VERDICT_MS
        )
          continue
        const live = elapsed >= target.openMs && elapsed <= target.closeMs
        const base = target.angleDeg * RAD
        ctx2d.lineCap = 'round'
        ctx2d.strokeStyle = live ? 'rgba(98,247,230,0.28)' : 'rgba(169,139,255,0.30)'
        ctx2d.lineWidth = lw * 2.4
        ctx2d.beginPath()
        ctx2d.arc(cx, cy, r, base - target.edgeTolDeg * RAD, base + target.edgeTolDeg * RAD)
        ctx2d.stroke()
        ctx2d.strokeStyle = live ? '#62f7e6' : '#a98bff'
        ctx2d.lineWidth = lw * 1.6
        ctx2d.beginPath()
        ctx2d.arc(cx, cy, r, base - target.goodTolDeg * RAD, base + target.goodTolDeg * RAD)
        ctx2d.stroke()
        ctx2d.strokeStyle = '#c7ff5e'
        ctx2d.lineWidth = lw * 2.2
        ctx2d.beginPath()
        ctx2d.arc(cx, cy, r, base - target.perfectTolDeg * RAD, base + target.perfectTolDeg * RAD)
        ctx2d.stroke()
      }

      const history = elapsedGhost(session.ghost, elapsed)
      if (session.ghost) {
        const action = ghostEventsAt(session.ghost, elapsed).at(-1)
        const last = history.at(-1)
        session.ghostActionRef.current = `TARGET ${history.length}/${session.ghost.replay?.length ?? targets.length} · ${signedPoints(last?.delta ?? 0)}`
        const ghostAngle =
          action?.type === 'tap' && action.value !== undefined && elapsed - action.t < 900
            ? action.value
            : markerAngleAt(elapsed, markerPeriod, markerRamp, durationMs)
        const ga = ghostAngle * RAD
        drawGhostGlyph(
          ctx2d,
          cx + (r + lw * 4) * Math.cos(ga),
          cy + (r + lw * 4) * Math.sin(ga),
          lw * 2.8
        )
      }
      const seen = visibleRivalNotches(targets, taps, rivalNotches)
      ctx2d.fillStyle = 'rgba(169,139,255,0.45)'
      for (const n of seen) {
        const a = n.angleDeg * RAD
        ctx2d.beginPath()
        ctx2d.arc(
          cx + (r + lw * 3) * Math.cos(a),
          cy + (r + lw * 3) * Math.sin(a),
          lw * 1.1,
          0,
          Math.PI * 2
        )
        ctx2d.fill()
      }

      const marker = markerAngleAt(elapsed, markerPeriod, markerRamp, durationMs) * RAD
      ctx2d.fillStyle = '#f5f7ff'
      ctx2d.beginPath()
      ctx2d.arc(cx + r * Math.cos(marker), cy + r * Math.sin(marker), lw * 1.8, 0, Math.PI * 2)
      ctx2d.fill()

      for (let i = 0; i < verdicts.length; i += 1) {
        const v = verdicts[i]
        const age = elapsed - v.at
        if (v.at < 0 || age < 0 || age >= 260) continue
        const kind =
          v.premature || v.missed || !v.band ? 'miss' : v.band >= 1000 ? 'perfect' : 'good'
        if (age < 150) {
          ctx2d.strokeStyle =
            kind === 'perfect' ? '#c7ff5e' : kind === 'good' ? '#62f7e6' : '#ff668f'
          ctx2d.lineWidth = lw * 2
          const a = v.angle * RAD
          ctx2d.beginPath()
          ctx2d.moveTo(cx + (r - lw * 2) * Math.cos(a), cy + (r - lw * 2) * Math.sin(a))
          ctx2d.lineTo(cx + (r + lw * 2) * Math.cos(a), cy + (r + lw * 2) * Math.sin(a))
          ctx2d.stroke()
          const target = targets[i]
          ctx2d.beginPath()
          ctx2d.arc(
            cx,
            cy,
            r,
            (target.angleDeg - target.edgeTolDeg) * RAD,
            (target.angleDeg + target.edgeTolDeg) * RAD
          )
          ctx2d.stroke()
        }
      }

      if (timeRef.current) {
        const left = Math.max(0, durationMs - elapsed)
        timeRef.current.textContent = `${(left / 1000).toFixed(1)}s`
      }
      return elapsed < durationMs
    }
    const stop = gameplayLoop(draw)
    return () => {
      stop()
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- countdown ticks must not re-init the canvas
  }, [durationMs, targets, markerPeriod, markerRamp, rivalNotches, session.skin, session.reduced])

  const tap = (clientX?: number, clientY?: number) => {
    if (session.phase !== 'running') return
    audio.unlock()
    const canvas = canvasRef.current
    const elapsed = session.getElapsed()
    const value = toIntAngle(markerAngleAt(elapsed, markerPeriod, markerRamp, durationMs))
    let p: { x: number; y: number } | undefined
    if (canvas && clientX !== undefined && clientY !== undefined) {
      const rect = canvas.getBoundingClientRect()
      p = {
        x: Math.min(10000, Math.max(0, Math.round(((clientX - rect.left) / rect.width) * 10000))),
        y: Math.min(10000, Math.max(0, Math.round(((clientY - rect.top) / rect.height) * 10000))),
      }
    }
    if (session.logEvent(p ? { type: 'tap', p, value } : { type: 'tap', value }) < 0) return
    const events = session.eventsRef.current
    const res = orbitEngine.scoreRun({
      seed: game.seed,
      config,
      events,
      visibilityInterruptions: 0,
    })
    const radius = canvas ? Math.min(canvas.width, canvas.height) * 0.32 : 0
    actionFeedback.show({
      x: canvas ? 0.5 + (radius * Math.cos(value * RAD)) / canvas.width : 0.5,
      y: canvas ? 0.5 + (radius * Math.sin(value * RAD)) / canvas.height : 0.5,
      delta: res.score - session.scoreRef.current,
    })
    setScore(res.score)
    session.reportScore(res.score)
    setDone(res.metrics.hits as number)
    const last = events[events.length - 1] as Extract<GameInputEvent, { type: 'tap' }>
    const assigned = assignTaps(targets, events)
    const targetIndex = assigned.findIndex((tapIndex) => tapIndex === events.length - 1)
    if (targetIndex === -1 || last.t < targets[0].openMs) {
      audio.miss()
      return
    }
    const target = targets[targetIndex]
    if (last.t < target.openMs || last.t > target.closeMs) {
      audio.miss()
      return
    }
    const angle = last.value === undefined ? target.angleDeg : last.value
    const band = orbitBand(angleDistDeg(angle, target.angleDeg), target)
    if (band >= 1000) audio.perfect()
    else if (band > 0) audio.correct()
    else audio.miss()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isGameInputTarget(e.target)) return
      if (!e.repeat && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault()
        tap()
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
        <span className="game-chip flex-1">
          Target {Math.min(targets.length, done + 1)}/{targets.length}
        </span>
        <span className="game-score" aria-live="off">
          {score}
        </span>
      </div>
      <div className="game-subhud">
        <span className="text-spectral-violet text-[10px] tracking-[0.16em] uppercase">
          {rivalScore !== null ? `Rival ${rivalScore}` : 'Violet = not live · wait for cyan'}
        </span>
        <span className="text-ghost-muted text-[10px] tracking-[0.16em] uppercase">
          Tap when the dot meets cyan
        </span>
      </div>
      <div className="relative flex min-h-75 flex-1 flex-col">
        <canvas
          ref={canvasRef}
          role="application"
          tabIndex={0}
          aria-label="Orbit field. Tap anywhere when the moving dot enters a cyan arc. Violet arcs are not live. Space works too. Early taps cost points."
          style={{
            opacity: session.phase === 'finishing' ? 0.6 : 1,
            transition: 'opacity 120ms linear',
          }}
          className="game-arena min-h-75 w-full flex-1 touch-none"
          onPointerDown={(e) => tap(e.clientX, e.clientY)}
        />
        <ActionFeedback entries={actionFeedback.entries} reduced={session.reduced} />
      </div>
      <p className="game-hint">Tap when the dot meets cyan · Space works too</p>
    </div>
  )
}
