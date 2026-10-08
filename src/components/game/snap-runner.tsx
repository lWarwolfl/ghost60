'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'
import { audio } from '@/lib/game/audio'
import { createRng, hashSeed } from '@/games/core/rng'
import { snapEngine, type TSnapConfig } from '@/games/snap/engine'

const SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'hex'] as const
type TShape = (typeof SHAPES)[number]

type TOption = { cx: number; cy: number; r: number; shape: TShape }

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

export function SnapRunner({ game, session }: { game: TPublicGame; session: TRunSession }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const verdictRef = useRef<{ t: number; ok: boolean } | null>(null)
  const labelRef = useRef('')
  const [score, setScore] = useState(0)
  const [roundLabel, setRoundLabel] = useState('')
  const config = useMemo(() => snapEngine.validateConfig(game.config) as TSnapConfig, [game.config])
  const durationMs = game.durationMs
  const layoutCache = useRef(new Map<string, { target: TShape; cells: TOption[] }>())
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
    let raf = 0
    const draw = () => {
      const elapsed = session.getElapsed()
      const { cssW, cssH, dpr } = view
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx2d.clearRect(0, 0, cssW, cssH)
      const idx = session.eventsRef.current.length
      const round = config.rounds[idx]
      if (round && elapsed >= round.presentedMs) {
        const { target, cells } = getLayout(idx, round.options, round.correct, cssW, cssH)
        setLabel(`TAP THE ${target.toUpperCase()}`)
        const v = verdictRef.current
        for (let i = 0; i < cells.length; i += 1) {
          const c = cells[i]
          let fill = '#f5f7ff'
          let outline = 'rgba(245,247,255,0.25)'
          if (v && elapsed - v.t < (session.reduced ? 60 : 150)) {
            const chosen = session.eventsRef.current[session.eventsRef.current.length - 1]
            if (chosen && (chosen as { value?: number }).value === i) {
              fill = v.ok ? '#c7ff5e' : '#f5f7ff'
              outline = v.ok ? '#c7ff5e' : '#ff668f'
            }
          }
          drawShape(ctx2d, c.shape, c.cx, c.cy, c.r, fill, outline, 3)
        }
        const late = elapsed > round.presentedMs + round.windowMs
        if (late && timeRef.current) timeRef.current.textContent = 'too late'
      } else if (round) {
        setLabel('GET READY')
      } else {
        setLabel('DONE — WAITING FOR CLOCK')
      }
      if (timeRef.current) {
        const late = round !== undefined && elapsed > round.presentedMs + round.windowMs
        if (late) timeRef.current.textContent = 'too late'
        else {
          const left = Math.max(0, durationMs - elapsed)
          timeRef.current.textContent = `${(left / 1000).toFixed(1)}s`
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [config, durationMs, getLayout, session])

  const choose = (index: number) => {
    if (session.phase !== 'running') return
    const canvas = canvasRef.current
    if (!canvas) return
    const idx = session.eventsRef.current.length
    const round = config.rounds[idx]
    if (!round) return
    audio.unlock()
    session.logEvent({ type: 'choice', value: index })
    const inWindow =
      session.eventsRef.current[session.eventsRef.current.length - 1].t >= round.presentedMs &&
      session.eventsRef.current[session.eventsRef.current.length - 1].t <= round.presentedMs + round.windowMs
    const ok = inWindow && index === round.correct
    verdictRef.current = { t: session.eventsRef.current[session.eventsRef.current.length - 1].t, ok }
    const res = snapEngine.scoreRun({ seed: game.seed, config, events: session.eventsRef.current, visibilityInterruptions: 0 })
    setScore(res.score)
    if (ok) {
      const reaction = session.eventsRef.current[session.eventsRef.current.length - 1].t - round.presentedMs
      if (reaction < round.windowMs * 0.25) audio.perfect()
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
    const { cells } = layoutRound(game.seed, idx, round.options, round.correct, rect.width, rect.height)
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
      if (n >= 1 && n <= 7) choose(n - 1)
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
        <span className="rounded-control bg-surface-700 px-3 py-1 font-display text-xs font-800 tracking-[0.14em] text-spectral-cyan">
          {roundLabel}
        </span>
        <span className="tnum font-600" aria-live="off">
          {score}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Snap field. Tap the shape named in the rule. Keys 1 to 7 work too."
        className="min-h-75 w-full flex-1 touch-none rounded-card border border-white/10 bg-ink-900"
        onPointerDown={(e) => tapAt(e.clientX, e.clientY)}
      />
      <p className="py-2 text-center text-xs text-ghost-muted">Rule never uses color alone · keys 1–7 work too</p>
    </div>
  )
}
