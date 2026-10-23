'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'
import { drawSkinAvatar } from '@/lib/game/skin-renderer'
import { ActionFeedback, useActionFeedback } from '@/components/game/action-feedback'
import { elapsedGhost, ghostEventsAt } from '@/lib/game/ghost-playback'
import { audio } from '@/lib/game/audio'
import {
  gameplayLoop,
  isGameInputTarget,
  pulseAssignments,
  signedPoints,
} from '@/lib/game/gameplay-motion'
import { drawGhostGlyph } from '@/lib/game/ghost-renderer'
import { activePulseIndex, pulseRadiusScale } from '@/games/pulse/table'
import { pulseEngine, type TPulseConfig } from '@/games/pulse/engine'

const APPROACH_MS = 1200

function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
  return { w: canvas.width, h: canvas.height }
}

function radiusAt(tapT: number, targetMs: number, r: number, approachMs = APPROACH_MS) {
  if (tapT <= targetMs) {
    const p = Math.min(1, Math.max(0, (tapT - (targetMs - approachMs)) / approachMs))
    return r * (1 + 0.9 * (1 - p))
  }
  return r * (1 + 0.15 * Math.min(1, (tapT - targetMs) / 300))
}

function approachFor(pulses: readonly { targetMs: number }[], index: number) {
  if (index <= 0) return APPROACH_MS
  const gap = pulses[index].targetMs - pulses[index - 1].targetMs
  return Math.max(650, Math.min(APPROACH_MS, gap * 0.5))
}

export function PulseRunner({
  game,
  session,
  onReady,
}: {
  game: TPublicGame
  session: TRunSession
  onReady?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const actionFeedback = useActionFeedback()
  const timeRef = useRef<HTMLSpanElement>(null)
  const avatarRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const impactRef = useRef<{
    at: number
    targetMs: number
    accuracy: number
    delta: number
    approach: number
  } | null>(null)
  const scoreRef = useRef(0)
  const config = useMemo(
    () => pulseEngine.validateConfig(game.config) as TPulseConfig,
    [game.config]
  )
  const pulses = useMemo(() => [...config.pulses].sort((a, b) => a.targetMs - b.targetMs), [config])
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
      const { w, h } = dims
      ctx2d.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const index = activePulseIndex(pulses, elapsed)
      const r = Math.min(w, h) * 0.22 * pulseRadiusScale(game.seed, index)
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
      for (let i = 0; i < pulses.length; i += 1) {
        const pulse = pulses[i]
        const approach = approachFor(pulses, i)
        if (pulse.targetMs < elapsed - 500 || pulse.targetMs > elapsed + approach + 300) continue
        const p = Math.min(1, Math.max(0, (elapsed - (pulse.targetMs - approach)) / approach))
        const done = elapsed > pulse.targetMs
        const alpha = done ? Math.max(0, 1 - (elapsed - pulse.targetMs) / 300) : 0.9
        const pulseR = Math.min(w, h) * 0.22 * pulseRadiusScale(game.seed, i)
        const rr = done
          ? pulseR * (1 + 0.15 * Math.min(1, (elapsed - pulse.targetMs) / 300))
          : pulseR * (1 + 0.9 * (1 - p))
        ctx2d.strokeStyle = '#a98bff'
        ctx2d.globalAlpha = alpha
        ctx2d.lineWidth = lw * 1.4
        ctx2d.beginPath()
        ctx2d.arc(cx, cy, rr, 0, Math.PI * 2)
        ctx2d.stroke()
        ctx2d.globalAlpha = 1
      }
      const seen = elapsedGhost(session.ghost, elapsed)
      const ghostTap = ghostEventsAt(session.ghost, elapsed).at(-1)
      if (session.ghost) {
        const done = seen.at(-1)
        session.ghostActionRef.current = `PULSE ${seen.length}/${session.ghost.replay?.length ?? pulses.length} · ${signedPoints(done?.delta ?? 0)}`
        if (ghostTap && elapsed - ghostTap.t < 1200) {
          const ghostIndex = activePulseIndex(pulses, ghostTap.t)
          const ghostR = Math.min(w, h) * 0.22 * pulseRadiusScale(game.seed, ghostIndex)
          drawGhostGlyph(ctx2d, cx, cy - ghostR, lw * 2.8)
        } else if (!session.ghost.replay && done && elapsed - done.t < 1200) {
          drawGhostGlyph(ctx2d, cx, cy - r, lw * 2.8)
        }
      }
      const impact = impactRef.current
      if (impact) {
        const age = elapsed - impact.at
        const kind = impact.accuracy >= 0.999 ? 'perfect' : impact.accuracy > 0 ? 'good' : 'miss'
        if (age >= 0 && age < 90) {
          ctx2d.strokeStyle =
            kind === 'perfect' ? '#c7ff5e' : kind === 'good' ? '#62f7e6' : '#ff668f'
          ctx2d.lineWidth = lw * 2
          ctx2d.beginPath()
          ctx2d.arc(
            cx,
            cy,
            radiusAt(impact.at, impact.targetMs, r, impact.approach),
            0,
            Math.PI * 2
          )
          ctx2d.stroke()
        }
        if (age >= 0 && age < (kind === 'miss' ? 80 : 120)) {
          ctx2d.save()
          ctx2d.globalAlpha = kind === 'miss' ? 0.45 : 1 - age / 120
          ctx2d.strokeStyle =
            kind === 'perfect' ? '#c7ff5e' : kind === 'good' ? '#62f7e6' : '#ff668f'
          ctx2d.beginPath()
          ctx2d.arc(cx, cy, r, kind === 'miss' ? -0.15 : 0, kind === 'miss' ? 0.15 : Math.PI * 2)
          ctx2d.stroke()
          ctx2d.restore()
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
  }, [durationMs, pulses, session.skin, session.reduced])

  const tap = (clientX?: number, clientY?: number) => {
    if (session.phase !== 'running') return
    audio.unlock()
    const canvas = canvasRef.current
    let p = { x: 5000, y: 5000 }
    if (canvas && clientX !== undefined && clientY !== undefined) {
      const rect = canvas.getBoundingClientRect()
      p = {
        x: Math.min(10000, Math.max(0, Math.round(((clientX - rect.left) / rect.width) * 10000))),
        y: Math.min(10000, Math.max(0, Math.round(((clientY - rect.top) / rect.height) * 10000))),
      }
    }
    if (session.logEvent({ type: 'tap', p }) < 0) return
    const events = session.eventsRef.current
    const res = pulseEngine.scoreRun({
      seed: game.seed,
      config,
      events,
      visibilityInterruptions: 0,
    })
    setScore(res.score)
    session.reportScore(res.score)
    const targetIndex = pulseAssignments(pulses, events).indexOf(events.length - 1)
    const last = events[events.length - 1]
    const pulse = pulses[targetIndex]
    const accuracy = pulse
      ? Math.max(0, 1 - Math.abs(last.t - pulse.targetMs) / pulse.toleranceMs)
      : 0
    impactRef.current = {
      at: last.t,
      targetMs: pulse?.targetMs ?? last.t,
      accuracy,
      delta: res.score - scoreRef.current,
      approach: targetIndex >= 0 ? approachFor(pulses, targetIndex) : APPROACH_MS,
    }
    const visualIndex = activePulseIndex(pulses, last.t)
    const r = canvas
      ? Math.min(canvas.width, canvas.height) * 0.22 * pulseRadiusScale(game.seed, visualIndex)
      : 0
    actionFeedback.show({
      x: 0.5,
      y: canvas ? 0.5 - r / canvas.height : 0.3,
      delta: res.score - scoreRef.current,
      label: accuracy > 0 ? undefined : 'MISS',
    })
    scoreRef.current = res.score
    if (accuracy >= 0.999) audio.perfect()
    else if (accuracy > 0) audio.correct()
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
          {(game.durationMs / 1000).toFixed(1)}s
        </span>
        <span className="game-chip flex-1">Tap the band</span>
        <span className="game-score" aria-live="off">
          {score}
        </span>
      </div>
      <div className="relative flex min-h-75 flex-1 flex-col">
        <canvas
          ref={canvasRef}
          role="application"
          tabIndex={0}
          aria-label="Pulse field. Tap when the violet ring meets the cyan band. Space works too."
          style={{
            opacity: session.phase === 'finishing' ? 0.6 : 1,
            transition: 'opacity 120ms linear',
          }}
          className="game-arena min-h-75 w-full flex-1 touch-none"
          onPointerDown={(e) => tap(e.clientX, e.clientY)}
        />
        <ActionFeedback entries={actionFeedback.entries} reduced={session.reduced} />
      </div>
      <p className="game-hint">Tap at alignment · Space works too</p>
    </div>
  )
}
