'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'
import { drawSkinAvatar } from '@/lib/game/skin-renderer'
import { audio } from '@/lib/game/audio'
import { gameplayLoop, drawFeedback, pulseAssignments, committedGhost } from '@/lib/game/gameplay-motion'
import { drawGhostGlyph } from '@/lib/game/ghost-renderer'
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

export function PulseRunner({ game, session, onReady }: { game: TPublicGame; session: TRunSession; onReady?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const avatarRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const impactRef = useRef<{ at: number; targetMs: number; accuracy: number; delta: number; approach: number } | null>(null)
  const scoreRef = useRef(0)
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
        drawSkinAvatar(avatar, { skin: session.skin, x: 16, y: 16, size: 25, elapsedMs: elapsed, reduced: session.reduced })
      }
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
      for (let i = 0; i < pulses.length; i += 1) {
        const pulse = pulses[i]
        const approach = approachFor(pulses, i)
        if (pulse.targetMs < elapsed - 500 || pulse.targetMs > elapsed + approach + 300) continue
        const p = Math.min(1, Math.max(0, (elapsed - (pulse.targetMs - approach)) / approach))
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
      const assignments = pulseAssignments(pulses, session.eventsRef.current)
      const seen = committedGhost(session.ghost?.timeline ?? [], assignments.map(i => i < 0 ? null : session.eventsRef.current[i].t), elapsed)
      if (session.ghost) {
        session.ghostActionRef.current =
          seen.length < pulses.length ? `PULSE ${seen.length + 1}/${pulses.length}` : 'FINISH'
      }
      const ghostPulse = pulses[seen.length]
      if (ghostPulse) {
        const approach = approachFor(pulses, seen.length)
        const rr = radiusAt(elapsed, ghostPulse.targetMs, r, approach)
        if (elapsed >= ghostPulse.targetMs - approach && elapsed <= ghostPulse.targetMs + 300) {
          ctx2d.save()
          ctx2d.strokeStyle = '#a98bff'
          ctx2d.globalAlpha = 0.55
          ctx2d.lineWidth = lw * 1.2
          ctx2d.beginPath()
          ctx2d.arc(cx, cy, rr, 0, Math.PI * 2)
          ctx2d.stroke()
          ctx2d.restore()
          drawGhostGlyph(ctx2d, cx + Math.min(rr, cx - lw * 4), cy, lw * 1.5, 0.8)
        }
      }
      const progress = seen.at(-1)?.progress
      if (progress !== undefined) {
        ctx2d.save()
        ctx2d.strokeStyle = '#a98bff'
        ctx2d.globalAlpha = 0.45
        ctx2d.lineWidth = lw
        ctx2d.beginPath()
        ctx2d.arc(cx, cy, r * 1.5, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2)
        ctx2d.stroke()
        ctx2d.restore()
      }
      const impact = impactRef.current
      if (impact) {
        const age = elapsed - impact.at
        const kind = impact.accuracy >= 0.999 ? 'perfect' : impact.accuracy > 0 ? 'good' : 'miss'
        if (age >= 0 && age < 90) {
          ctx2d.strokeStyle = kind === 'perfect' ? '#c7ff5e' : kind === 'good' ? '#62f7e6' : '#ff668f'
          ctx2d.lineWidth = lw * 2
          ctx2d.beginPath()
          ctx2d.arc(cx, cy, radiusAt(impact.at, impact.targetMs, r, impact.approach), 0, Math.PI * 2)
          ctx2d.stroke()
        }
        if (age >= 0 && age < (kind === 'miss' ? 80 : 120)) {
          ctx2d.save()
          ctx2d.globalAlpha = kind === 'miss' ? 0.45 : 1 - age / 120
          ctx2d.strokeStyle = kind === 'perfect' ? '#c7ff5e' : kind === 'good' ? '#62f7e6' : '#ff668f'
          ctx2d.beginPath()
          ctx2d.arc(cx, cy, r, kind === 'miss' ? -0.15 : 0, kind === 'miss' ? 0.15 : Math.PI * 2)
          ctx2d.stroke()
          ctx2d.restore()
        }
        drawFeedback(ctx2d, { x: cx, y: cy, radius: r * 0.6, age, duration: 260, reduced: session.reduced, kind, label: kind === 'miss' ? 'MISS' : `+${impact.delta}` })
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
        y: Math.min(10000, Math.max(0, Math.round(((clientY - rect.top) / rect.height) * 10000)))
      }
    }
    if (session.logEvent({ type: 'tap', p }) < 0) return
    const events = session.eventsRef.current
    const res = pulseEngine.scoreRun({ seed: game.seed, config, events, visibilityInterruptions: 0 })
    setScore(res.score)
    session.reportScore(res.score)
    const targetIndex = pulseAssignments(pulses, events).indexOf(events.length - 1)
    const last = events[events.length - 1]
    const pulse = pulses[targetIndex]
    const accuracy = pulse ? Math.max(0, 1 - Math.abs(last.t - pulse.targetMs) / pulse.toleranceMs) : 0
    impactRef.current = {
      at: last.t,
      targetMs: pulse?.targetMs ?? last.t,
      accuracy,
      delta: res.score - scoreRef.current,
      approach: targetIndex >= 0 ? approachFor(pulses, targetIndex) : APPROACH_MS
    }
    scoreRef.current = res.score
    if (accuracy >= 0.999) audio.perfect()
    else if (accuracy > 0) audio.correct()
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
      <div className="game-hud">
        <canvas ref={avatarRef} width={32} height={32} className="size-8 shrink-0" aria-hidden="true" />
        <span ref={timeRef} className="game-timer">
          {(game.durationMs / 1000).toFixed(1)}s
        </span>
        <span className="game-chip flex-1">Tap the band</span>
        <span className="game-score" aria-live="off">
          {score}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Pulse field. Tap when the violet ring meets the cyan band. Space works too."
        style={{ opacity: session.phase === 'finishing' ? 0.6 : 1, transition: 'opacity 120ms linear' }}
        className="game-arena min-h-75 w-full flex-1 touch-none"
        onPointerDown={(e) => tap(e.clientX, e.clientY)}
      />
      <p className="game-hint">Tap at alignment · Space works too</p>
    </div>
  )
}
