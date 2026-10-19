'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'
import type { GameInputEvent } from '@/games/core/game-module'
import { angleDistDeg, orbitBand, orbitEngine, type TOrbitConfig } from '@/games/orbit/engine'
import {
  ORBIT_ARC_LEAD_MS,
  ORBIT_VERDICT_MS,
  angleFromPoint,
  assignTaps,
  markerAngleAt,
  toIntAngle,
  visibleRivalNotches,
  type TRivalNotch
} from '@/games/orbit/table'
import { drawSkinAvatar } from '@/lib/game/skin-renderer'
import { audio } from '@/lib/game/audio'
import { gameplayLoop, drawFeedback, committedGhost } from '@/lib/game/gameplay-motion'

function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
  return { w: canvas.width, h: canvas.height }
}

const RAD = Math.PI / 180

type TVerdict = { band: number; at: number; angle: number; premature: boolean; missed: boolean }

export function OrbitRunner({
  game,
  session,
  rivalNotches = [],
  rivalScore = null
}: {
  game: TPublicGame
  session: TRunSession
  rivalNotches?: TRivalNotch[]
  rivalScore?: number | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const avatarRef = useRef<HTMLCanvasElement>(null)
  const verdictCache = useRef<{ count: number; verdicts: TVerdict[] }>({ count: -1, verdicts: [] })
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(0)
  const config = useMemo(() => orbitEngine.validateConfig(game.config) as TOrbitConfig, [game.config])
  const targets = config.targets
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
    const draw = () => {
      const elapsed = session.getElapsed()
      const avatar = avatarRef.current?.getContext('2d')
      if (avatar) {
        avatar.clearRect(0, 0, 32, 32)
        drawSkinAvatar(avatar, { skin: session.skin, x: 16, y: 16, size: 25, elapsedMs: elapsed, reduced: session.reduced })
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
            if (tapIndex === -1) return { band: 0, at: -1, angle: 0, premature: false, missed: false }
            const tap = taps[tapIndex] as Extract<GameInputEvent, { type: 'tap' }>
            const target = targets[i]
            if (tap.t < target.openMs) return { band: 0, at: tap.t, angle: tap.value ?? target.angleDeg, premature: true, missed: false }
            if (tap.t > target.closeMs) return { band: 0, at: tap.t, angle: tap.value ?? target.angleDeg, premature: false, missed: true }
            const angle = tap.value === undefined ? target.angleDeg : tap.value
            return { band: orbitBand(angleDistDeg(angle, target.angleDeg), target), at: tap.t, angle: tap.value ?? target.angleDeg, premature: false, missed: false }
          })
        }
      }
      const verdicts = verdictCache.current.verdicts

      for (let i = 0; i < targets.length; i += 1) {
        const target = targets[i]
        if (elapsed < target.openMs - ORBIT_ARC_LEAD_MS || elapsed > target.closeMs + ORBIT_VERDICT_MS) continue
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

      const assigned = assignTaps(targets, taps)
      const history = committedGhost(session.ghost?.timeline ?? [], assigned.map(i => i < 0 ? null : taps[i].t), elapsed)
      ctx2d.save()
      ctx2d.globalAlpha = 0.45
      ctx2d.fillStyle = '#a98bff'
      history.forEach((_, i) => ctx2d.fillRect(12 + i * 8, h - 12, 4, 4))
      ctx2d.restore()
      const seen = visibleRivalNotches(targets, taps, rivalNotches)
      ctx2d.fillStyle = 'rgba(169,139,255,0.45)'
      for (const n of seen) {
        const a = n.angleDeg * RAD
        ctx2d.beginPath()
        ctx2d.arc(cx + (r + lw * 3) * Math.cos(a), cy + (r + lw * 3) * Math.sin(a), lw * 1.1, 0, Math.PI * 2)
        ctx2d.fill()
      }

      const marker = markerAngleAt(elapsed) * RAD
      ctx2d.fillStyle = '#f5f7ff'
      ctx2d.beginPath()
      ctx2d.arc(cx + r * Math.cos(marker), cy + r * Math.sin(marker), lw * 1.8, 0, Math.PI * 2)
      ctx2d.fill()

      for (let i = 0; i < verdicts.length; i += 1) {
        const v = verdicts[i]
        const age = elapsed - v.at
        if (v.at < 0 || age < 0 || age >= 260) continue
        const kind = v.premature || v.missed || !v.band ? 'miss' : v.band >= 1000 ? 'perfect' : 'good'
        if (age < 150) {
          ctx2d.strokeStyle = kind === 'perfect' ? '#c7ff5e' : kind === 'good' ? '#62f7e6' : '#ff668f'
          ctx2d.lineWidth = lw * 2
          const a = v.angle * RAD
          ctx2d.beginPath()
          ctx2d.moveTo(cx + (r - lw * 2) * Math.cos(a), cy + (r - lw * 2) * Math.sin(a))
          ctx2d.lineTo(cx + (r + lw * 2) * Math.cos(a), cy + (r + lw * 2) * Math.sin(a))
          ctx2d.stroke()
          const target = targets[i]
          ctx2d.beginPath()
          ctx2d.arc(cx, cy, r, (target.angleDeg - target.edgeTolDeg) * RAD, (target.angleDeg + target.edgeTolDeg) * RAD)
          ctx2d.stroke()
        }
        drawFeedback(ctx2d, { x: cx, y: cy + r * 1.25, radius: lw * 4, age, duration: 260, reduced: session.reduced, kind, label: v.premature ? 'EARLY' : v.missed ? 'LATE' : kind === 'miss' ? 'MISS' : `+${v.band}` })
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
  }, [durationMs, targets, session, rivalNotches])

  const tap = (clientX?: number, clientY?: number) => {
    if (session.phase !== 'running') return
    audio.unlock()
    const canvas = canvasRef.current
    const elapsed = session.getElapsed()
    let value: number
    let p: { x: number; y: number } | undefined
    if (canvas && clientX !== undefined && clientY !== undefined) {
      const rect = canvas.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      value = toIntAngle(angleFromPoint(clientX, clientY, cx, cy))
      p = {
        x: Math.min(10000, Math.max(0, Math.round(((clientX - rect.left) / rect.width) * 10000))),
        y: Math.min(10000, Math.max(0, Math.round(((clientY - rect.top) / rect.height) * 10000)))
      }
    } else {
      value = toIntAngle(markerAngleAt(elapsed))
    }
    if (session.logEvent(p ? { type: 'tap', p, value } : { type: 'tap', value }) < 0) return
    const events = session.eventsRef.current
    const res = orbitEngine.scoreRun({ seed: game.seed, config, events, visibilityInterruptions: 0 })
    setScore(res.score)
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
        <span className="text-[10px] tracking-[0.16em] text-spectral-violet uppercase">
          {rivalScore !== null ? `Rival ${rivalScore}` : 'Tap inside the bright arc'}
        </span>
        <span className="text-[10px] tracking-[0.16em] text-ghost-muted uppercase">Space taps at marker</span>
      </div>
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Orbit field. Tap when the marker enters the bright arc. Space taps at the marker."
        style={{ opacity: session.phase === 'finishing' ? 0.6 : 1, transition: 'opacity 120ms linear' }}
        className="game-arena min-h-75 w-full flex-1 touch-none"
        onPointerDown={(e) => tap(e.clientX, e.clientY)}
      />
      <p className="game-hint">Tap inside the arc · Space taps at the marker</p>
    </div>
  )
}
