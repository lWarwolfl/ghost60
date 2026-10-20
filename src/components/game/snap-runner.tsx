'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'
import { drawSkinAvatar } from '@/lib/game/skin-renderer'
import { drawGhostGlyph } from '@/lib/game/ghost-renderer'
import { audio } from '@/lib/game/audio'
import { gameplayLoop, drawFeedback, committedGhost, signedPoints } from '@/lib/game/gameplay-motion'
import { PromptFlash } from '@/components/game/prompt-flash'
import { createRng, hashSeed } from '@/games/core/rng'
import { snapEngine, type TSnapConfig } from '@/games/snap/engine'

const SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'hex'] as const
type TShape = (typeof SHAPES)[number]

type TOption = { cx: number; cy: number; r: number; shape: TShape }
type TVerdict = { t: number; ok: boolean; index: number; round: number }

function layoutRound(seed: string, roundIndex: number, options: number, correct: number, w: number, h: number): { target: TShape; cells: TOption[] } {
  const rng = createRng(`${seed}:${roundIndex}`)
  const target = SHAPES[(hashSeed(seed) + roundIndex) % SHAPES.length]
  const pool = SHAPES.filter((s) => s !== target)
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(0, i + 1)
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  const perRow = options <= 4 ? options : Math.ceil(options / 2)
  const rows = options <= 4 ? 1 : 2
  const cellR = Math.min(w / (perRow * 2.6), h / (rows * 2.8), 64)
  const cells: TOption[] = []
  for (let i = 0; i < options; i += 1) {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const inRow = row === rows - 1 && options % perRow !== 0 ? options % perRow : perRow
    const jx = (rng.nextFloat() * 2 - 1) * 8
    const jy = (rng.nextFloat() * 2 - 1) * 8
    cells.push({
      cx: ((col + 0.5 + (perRow - inRow) / 2) / perRow) * w + jx,
      cy: ((row + 0.5) / rows) * h + jy,
      r: cellR,
      shape: i === correct ? target : pool[i % pool.length]
    })
  }
  return { target, cells }
}

function drawShape(ctx: CanvasRenderingContext2D, shape: TShape, cx: number, cy: number, r: number, fill: string, outline: string, lw: number) {
  ctx.beginPath()
  if (shape === 'circle') ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2)
  else if (shape === 'square') ctx.rect(cx - r * 0.55, cy - r * 0.55, r * 1.1, r * 1.1)
  else if (shape === 'triangle') {
    ctx.moveTo(cx, cy - r * 0.68)
    ctx.lineTo(cx + r * 0.62, cy + r * 0.5)
    ctx.lineTo(cx - r * 0.62, cy + r * 0.5)
    ctx.closePath()
  } else if (shape === 'diamond') {
    ctx.moveTo(cx, cy - r * 0.68)
    ctx.lineTo(cx + r * 0.55, cy)
    ctx.lineTo(cx, cy + r * 0.68)
    ctx.lineTo(cx - r * 0.55, cy)
    ctx.closePath()
  } else if (shape === 'hex') {
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i - Math.PI / 6
      const x = cx + r * 0.64 * Math.cos(a)
      const y = cy + r * 0.64 * Math.sin(a)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  } else {
    for (let i = 0; i < 10; i += 1) {
      const rad = i % 2 === 0 ? r * 0.68 : r * 0.3
      const a = (Math.PI / 5) * i - Math.PI / 2
      const x = cx + rad * Math.cos(a)
      const y = cy + rad * Math.sin(a)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  }
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = outline
  ctx.lineWidth = lw
  ctx.stroke()
}

export function SnapRunner({ game, session, onReady }: { game: TPublicGame; session: TRunSession; onReady?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const avatarRef = useRef<HTMLCanvasElement>(null)
  const verdictRef = useRef<TVerdict | null>(null)
  const autoRef = useRef(-1)
  const labelRef = useRef('')
  const promptRef = useRef(-1)
  const [score, setScore] = useState(0)
  const [roundLabel, setRoundLabel] = useState('')
  const [roundsDone, setRoundsDone] = useState(0)
  const [prompt, setPrompt] = useState<{ key: number; label: string } | null>(null)
  const config = useMemo(() => snapEngine.validateConfig(game.config) as TSnapConfig, [game.config])
  const durationMs = game.durationMs
  const layoutCache = useRef(new Map<string, { target: TShape; cells: TOption[] }>())

  useEffect(() => {
    onReady?.()
  }, [onReady])
  const getLayout = useCallback(
    (roundIndex: number, options: number, correct: number, w: number, h: number) => {
      const key = `${roundIndex}:${Math.round(w)}x${Math.round(h)}`
      const hit = layoutCache.current.get(key)
      if (hit) return hit
      const fresh = layoutRound(game.seed, roundIndex, options, correct, w, h)
      if (layoutCache.current.size > 24) layoutCache.current.clear()
      layoutCache.current.set(key, fresh)
      return fresh
    },
    [game.seed]
  )

  const endFor = useCallback(
    (index: number) => {
      const round = config.rounds[index]
      const next = config.rounds[index + 1]?.presentedMs ?? durationMs
      return Math.min(round.presentedMs + round.windowMs, next, durationMs)
    },
    [config.rounds, durationMs]
  )

  const setLabel = (v: string) => {
    if (labelRef.current !== v) {
      labelRef.current = v
      setRoundLabel(v)
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      return { cssW: rect.width, cssH: rect.height, dpr }
    }
    let view = fit()
    const ro = new ResizeObserver(() => {
      view = fit()
    })
    ro.observe(canvas)
    const draw = () => {
      const elapsed = session.getElapsed()
      const avatar = avatarRef.current?.getContext('2d')
      if (avatar) {
        avatar.clearRect(0, 0, 32, 32)
        drawSkinAvatar(avatar, { skin: session.skin, x: 16, y: 16, size: 25, elapsedMs: elapsed, reduced: session.reduced })
      }
      const { cssW, cssH, dpr } = view
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx2d.clearRect(0, 0, cssW, cssH)

      let idx = session.eventsRef.current.length
      let missed = 0
      while (
        idx < config.rounds.length &&
        elapsed >= endFor(idx) &&
        autoRef.current < idx
      ) {
        autoRef.current = idx
        const t = session.logEvent({ type: 'choice', value: -1 })
        if (t < 0) break
        missed += 1
        verdictRef.current = { t, ok: false, index: -1, round: idx }
        idx += 1
      }
      if (missed > 0) {
        const res = snapEngine.scoreRun({ seed: game.seed, config, events: session.eventsRef.current, visibilityInterruptions: 0 })
        setScore(res.score)
        session.reportScore(res.score)
        setRoundsDone(session.eventsRef.current.length)
        audio.miss()
      }

      const round = config.rounds[idx]
      if (round && elapsed >= round.presentedMs && elapsed < endFor(idx)) {
        const { target, cells } = getLayout(idx, round.options, round.correct, cssW, cssH)
        setLabel(`TAP THE ${target.toUpperCase()}`)
        if (promptRef.current !== idx) {
          promptRef.current = idx
          setPrompt({ key: idx, label: `TAP THE ${target.toUpperCase()}` })
        }
        const spawn = Math.min(1, Math.max(0, (elapsed - round.presentedMs) / 70))
        for (const c of cells) {
          ctx2d.save()
          ctx2d.globalAlpha = spawn
          const scale = session.reduced ? 1 : 0.96 + 0.04 * spawn
          ctx2d.shadowColor = 'rgba(98,247,230,0.16)'
          ctx2d.shadowBlur = 18
          drawShape(ctx2d, c.shape, c.cx, c.cy, c.r * scale, '#f5f7ff', 'rgba(245,247,255,0.32)', 3)
          ctx2d.restore()
        }
        const end = endFor(idx)
        const remaining = Math.max(0, 1 - (elapsed - round.presentedMs) / Math.max(1, end - round.presentedMs))
        ctx2d.fillStyle = remaining < 0.3 ? '#ff668f' : 'rgba(98,247,230,0.7)'
        ctx2d.fillRect(0, cssH - 3, cssW * remaining, 3)
      } else if (round && elapsed < round.presentedMs) {
        setLabel(`ROUND ${idx + 1} · GET READY`)
      } else {
        setLabel(idx >= config.rounds.length ? 'DONE — WAITING FOR CLOCK' : 'GET READY')
      }

      const seen = committedGhost(session.ghost?.timeline ?? [], session.eventsRef.current.map(e => e.t), elapsed)
      if (session.ghost) {
        const done = seen.at(-1)
        const delta = done ? (done.delta ?? (done.score ?? 0) - (seen.at(-2)?.score ?? 0)) : 0
        session.ghostActionRef.current = done
          ? `ROUND ${seen.length}/${config.rounds.length} · ${signedPoints(delta)}`
          : `ROUND 1/${config.rounds.length}`
      }
      const progress = seen.at(-1)?.progress
      if (progress !== undefined) {
        ctx2d.save()
        ctx2d.fillStyle = '#a98bff'
        ctx2d.globalAlpha = 0.45
        ctx2d.fillRect(cssW - 6, cssH * (1 - progress), 3, cssH * progress)
        ctx2d.restore()
        drawGhostGlyph(ctx2d, cssW - 12, cssH * (1 - progress), 4, 0.8)
      }

      const verdict = verdictRef.current
      if (verdict) {
        const age = elapsed - verdict.t
        if (age >= 0 && age < 260) {
          const old = config.rounds[verdict.round]
          const layout = getLayout(verdict.round, old.options, old.correct, cssW, cssH)
          if (verdict.index === -1) {
            const correctCell = layout.cells[old.correct]
            if (correctCell) {
              ctx2d.save()
              ctx2d.globalAlpha = session.reduced ? 1 : 1 - age / 260
              ctx2d.strokeStyle = '#ff668f'
              ctx2d.lineWidth = 3
              ctx2d.beginPath()
              ctx2d.arc(correctCell.cx, correctCell.cy, correctCell.r * 0.86, 0, Math.PI * 2)
              ctx2d.stroke()
              ctx2d.restore()
              drawFeedback(ctx2d, { x: correctCell.cx, y: correctCell.cy, radius: correctCell.r, age, duration: 360, reduced: session.reduced, kind: 'miss', label: 'TOO LATE' })
            }
          } else {
            const selected = layout.cells[verdict.index]
            if (selected) {
              const scale = session.reduced || !verdict.ok ? 1 : age < 70 ? 1 - 0.08 * age / 70 : 0.92 + 0.12 * (age - 70) / 70
              ctx2d.save()
              ctx2d.globalAlpha = session.reduced ? 1 : 1 - age / 260
              drawShape(ctx2d, selected.shape, selected.cx, selected.cy, selected.r * scale, verdict.ok ? '#c7ff5e' : '#f5f7ff', verdict.ok ? '#c7ff5e' : '#ff668f', 3)
              ctx2d.restore()
              drawFeedback(ctx2d, { x: selected.cx, y: selected.cy, radius: selected.r, age, duration: 360, reduced: session.reduced, kind: verdict.ok ? 'good' : 'miss', label: verdict.ok ? 'HIT' : 'MISS' })
            }
          }
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
  }, [config, durationMs, endFor, getLayout, game.seed, session.skin, session.reduced])

  const choose = (index: number) => {
    if (session.phase !== 'running') return
    const canvas = canvasRef.current
    if (!canvas) return
    const idx = session.eventsRef.current.length
    const round = config.rounds[idx]
    const elapsed = session.getElapsed()
    if (!round || index < 0 || index >= round.options) return
    if (elapsed < round.presentedMs || elapsed > endFor(idx)) return
    audio.unlock()
    const t = session.logEvent({ type: 'choice', value: index })
    if (t < 0) return
    const ok = t >= round.presentedMs && t <= endFor(idx) && index === round.correct
    verdictRef.current = { t, ok, index, round: idx }
    const res = snapEngine.scoreRun({ seed: game.seed, config, events: session.eventsRef.current, visibilityInterruptions: 0 })
    setScore(res.score)
    session.reportScore(res.score)
    setRoundsDone(session.eventsRef.current.length)
    if (ok) {
      const reaction = t - round.presentedMs
      if (reaction < (endFor(idx) - round.presentedMs) * 0.25) audio.perfect()
      else audio.correct()
    } else audio.miss()
  }

  const tapAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const idx = session.eventsRef.current.length
    const round = config.rounds[idx]
    if (!round || session.getElapsed() < round.presentedMs) return
    const { cells } = getLayout(idx, round.options, round.correct, rect.width, rect.height)
    const x = clientX - rect.left
    const y = clientY - rect.top
    for (let i = 0; i < cells.length; i += 1) {
      if (Math.hypot(x - cells[i].cx, y - cells[i].cy) <= cells[i].r * 1.15) {
        choose(i)
        return
      }
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number.parseInt(e.key, 10)
      if (n >= 1 && n <= 8) choose(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const choices = session.eventsRef.current.filter((e) => e.type === 'choice')
  const pips = config.rounds.map((round, i) => {
    const choice = choices[i]
    if (!choice || choice.value === undefined) return 'open' as const
    const end = endFor(i)
    return choice.t >= round.presentedMs && choice.t <= end && choice.value === round.correct ? 'hit' as const : 'miss' as const
  })
  const roundNumber = Math.min(roundsDone + 1, config.rounds.length)

  return (
    <div className="flex flex-1 flex-col">
      <div className="game-hud">
        <canvas ref={avatarRef} width={32} height={32} className="size-8 shrink-0" aria-hidden="true" />
        <span ref={timeRef} className="game-timer" aria-hidden="true">
          {(game.durationMs / 1000).toFixed(1)}s
        </span>
        <span className="game-chip flex-1" aria-live="polite">
          {roundLabel || 'GET READY'}
        </span>
        <span className="game-score" aria-live="off">
          {score}
        </span>
      </div>
      <div className="game-subhud">
        <span className="text-[10px] tracking-[0.16em] text-ghost-muted uppercase">
          Round {roundNumber}/{config.rounds.length}
        </span>
        <div className="game-pips" aria-label="Round results">
          {pips.map((state, i) => (
            <span key={i} className="game-pip" data-state={state} aria-label={`Round ${i + 1}: ${state}`} />
          ))}
        </div>
      </div>
      <PromptFlash key={prompt?.key ?? 'none'} label={prompt?.label ?? ''} />
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Snap field. Tap the shape named in the rule. Keys 1 to 8 work too."
        style={{ opacity: session.phase === 'finishing' ? 0.6 : 1, transition: 'opacity 120ms linear' }}
        className="game-arena min-h-75 w-full flex-1 touch-none"
        onPointerDown={(e) => tapAt(e.clientX, e.clientY)}
      />
      <p className="game-hint">Rule never uses color alone · keys 1–8 work too</p>
    </div>
  )
}
