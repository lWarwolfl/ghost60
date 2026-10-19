'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'
import type { GameInputEvent } from '@/games/core/game-module'
import { recallEngine, type TRecallConfig } from '@/games/recall/engine'
import {
  RECALL_CELL_ON_MS,
  RECALL_CELL_SLOT_MS,
  recallLayout,
  resolveSequences,
  showSchedule,
  type TSeqResolution
} from '@/games/recall/table'
import { drawSkinAvatar } from '@/lib/game/skin-renderer'
import { audio } from '@/lib/game/audio'
import { gameplayLoop, drawFeedback, recallFeedback, committedGhost } from '@/lib/game/gameplay-motion'

function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
  return { w: canvas.width, h: canvas.height }
}

type TChoice = Extract<GameInputEvent, { type: 'choice' }>

function cellAt(layout: { cells: Array<{ x: number; y: number; size: number }> }, x: number, y: number) {
  for (let i = 0; i < layout.cells.length; i += 1) {
    const c = layout.cells[i]
    if (x >= c.x && x <= c.x + c.size && y >= c.y && y <= c.y + c.size) return i
  }
  return -1
}

export function RecallRunner({
  game,
  session,
  rivalScore = null
}: {
  game: TPublicGame
  session: TRunSession
  rivalScore?: number | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const avatarRef = useRef<HTMLCanvasElement>(null)
  const statusRef = useRef<HTMLSpanElement>(null)
  const verdictRef = useRef<ReturnType<typeof recallFeedback>>(null)
  const resolutionRef = useRef({ count: -1, resolved: [] as TSeqResolution[] })
  const [score, setScore] = useState(0)
  const [focus, setFocus] = useState(0)
  const config = useMemo(() => recallEngine.validateConfig(game.config) as TRecallConfig, [game.config])
  const schedule = useMemo(() => showSchedule(config), [config])
  const durationMs = game.durationMs
  const grid = config.grid

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    let dims = fitCanvas(canvas)
    let layout = recallLayout(dims.w, dims.h, grid)
    const ro = new ResizeObserver(() => {
      dims = fitCanvas(canvas)
      layout = recallLayout(dims.w, dims.h, grid)
    })
    ro.observe(canvas)
    const draw = () => {
      const elapsed = session.getElapsed()
      const avatar = avatarRef.current?.getContext('2d')
      if (avatar) {
        avatar.clearRect(0, 0, 32, 32)
        drawSkinAvatar(avatar, { skin: session.skin, x: 16, y: 16, size: 25, elapsedMs: elapsed, reduced: session.reduced })
      }
      const taps = session.eventsRef.current as TChoice[]
      if (resolutionRef.current.count !== taps.length) resolutionRef.current = { count: taps.length, resolved: resolveSequences(config, taps) }
      const resolved = resolutionRef.current.resolved
      const { w, h } = dims
      ctx2d.clearRect(0, 0, w, h)
      const current = resolved.findIndex((r) => r.status === 'open')
      const finished = resolved.every((r) => r.status !== 'open')

      for (let i = 0; i < layout.cells.length; i += 1) {
        const c = layout.cells[i]
        let fill = 'rgba(245,247,255,0.07)'
        let stroke = 'rgba(245,247,255,0.22)'
        if (current !== -1) {
          const slot = schedule[current]
          const seq = config.sequences[current]
          if (elapsed >= slot.showStart && elapsed < slot.showEnd) {
            const k = Math.floor((elapsed - slot.showStart) / RECALL_CELL_SLOT_MS)
            const on = elapsed - slot.showStart - k * RECALL_CELL_SLOT_MS < RECALL_CELL_ON_MS
            if (on && k < seq.cells.length && seq.cells[k] === i) {
              fill = 'rgba(98,247,230,0.65)'
              stroke = '#62f7e6'
            }
          }
        }
        const v = verdictRef.current
        const age = v ? elapsed - v.at : -1
        if (v && v.cell === i && age >= 0 && age < 90) {
          fill = 'rgba(98,247,230,0.3)'
          stroke = '#62f7e6'
        }
        if (v?.status === 'complete' && age >= 0 && age < v.cells.length * 70 && v.cells[Math.floor(age / 70)] === i) {
          fill = 'rgba(98,247,230,0.5)'
          stroke = '#c7ff5e'
        }
        if (current !== -1 && elapsed >= schedule[current].showEnd && elapsed < schedule[current].showEnd + 120) stroke = '#62f7e6'
        if (v?.status === 'failed' && v.cell === i && age >= 0 && age < 180) stroke = '#ff668f'
        ctx2d.beginPath()
        if (typeof ctx2d.roundRect === 'function') ctx2d.roundRect(c.x, c.y, c.size, c.size, c.size * 0.18)
        else ctx2d.rect(c.x, c.y, c.size, c.size)
        ctx2d.fillStyle = fill
        ctx2d.fill()
        ctx2d.lineWidth = Math.max(2, layout.size * 0.03)
        ctx2d.strokeStyle = stroke
        ctx2d.stroke()
        if (v?.status === 'failed' && v.cell === i) {
          drawFeedback(ctx2d, { x: c.x + c.size / 2, y: c.y + c.size / 2, radius: c.size * 0.4, age, duration: 180, reduced: session.reduced, kind: 'miss', label: 'MISS' })
        }
        if (i === focus) {
          ctx2d.lineWidth = Math.max(2, layout.size * 0.045)
          ctx2d.strokeStyle = '#62f7e6'
          ctx2d.beginPath()
          if (typeof ctx2d.roundRect === 'function') ctx2d.roundRect(c.x - 4, c.y - 4, c.size + 8, c.size + 8, c.size * 0.22)
          else ctx2d.rect(c.x - 4, c.y - 4, c.size + 8, c.size + 8)
          ctx2d.stroke()
        }
      }

      let cursor = 0
      const commitments = resolved.map(round => { cursor += round.used; return round.status === 'open' ? null : (taps[cursor - 1]?.t ?? null) })
      const seen = committedGhost(session.ghost?.timeline ?? [], commitments, elapsed)
      ctx2d.save()
      ctx2d.fillStyle = '#a98bff'
      ctx2d.globalAlpha = 0.45
      seen.forEach((_, i) => ctx2d.fillRect(12 + i * 10, h - 12, 5, 5))
      ctx2d.restore()
      if (statusRef.current) {
        statusRef.current.textContent =
          current === -1
            ? finished
              ? 'DONE — WAITING FOR CLOCK'
              : ''
            : (() => {
                const slot = schedule[current]
                if (elapsed < slot.showStart) return `SEQ ${current + 1}/${config.sequences.length} · GET READY`
                if (elapsed < slot.showEnd) return `SEQ ${current + 1}/${config.sequences.length} · WATCH`
                return `SEQ ${current + 1}/${config.sequences.length} · YOUR TURN`
              })()
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
  }, [config, durationMs, grid, schedule, session, focus])

  const choose = (cell: number) => {
    if (session.phase !== 'running') return
    if (cell < 0 || cell >= grid * grid) return
    const taps = session.eventsRef.current.filter((e) => e.type === 'choice') as TChoice[]
    const resolved = resolveSequences(config, taps)
    const current = resolved.findIndex(r => r.status === 'open')
    if (current === -1 || session.getElapsed() < schedule[current].showEnd) return
    audio.unlock()
    if (session.logEvent({ type: 'choice', value: cell }) < 0) return
    const next = session.eventsRef.current.filter((e) => e.type === 'choice') as TChoice[]
    const res = recallEngine.scoreRun({ seed: game.seed, config, events: session.eventsRef.current, visibilityInterruptions: 0 })
    setScore(res.score)
    const feedback = recallFeedback(config, next)
    verdictRef.current = feedback
    if (feedback?.status === 'failed') audio.miss()
    else if (feedback?.status === 'complete') audio.correct()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number.parseInt(e.key, 10)
      if (n >= 1 && n <= 9 && n - 1 < grid * grid) {
        e.preventDefault()
        setFocus(n - 1)
        choose(n - 1)
        return
      }
      const row = Math.floor(focus / grid)
      const col = focus % grid
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocus(Math.max(0, (row - 1) * grid + col))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocus(Math.min(grid * grid - 1, (row + 1) * grid + col))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setFocus(row * grid + Math.max(0, col - 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setFocus(row * grid + Math.min(grid - 1, col + 1))
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        choose(focus)
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
        <span ref={statusRef} className="game-chip flex-1">
          Seq 1
        </span>
        <span className="game-score flex items-center gap-2" aria-live="off">
          {rivalScore !== null && <span className="text-xs font-600 text-spectral-violet">R {rivalScore}</span>}
          {score}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Recall grid. Watch the flashing cells, then repeat the sequence. Arrows move, Enter selects, digits work too."
        style={{ opacity: session.phase === 'finishing' ? 0.6 : 1, transition: 'opacity 120ms linear' }}
        className="game-arena min-h-75 w-full flex-1 touch-none"
        onPointerDown={(e) => {
          const canvas = canvasRef.current
          if (!canvas) return
          const rect = canvas.getBoundingClientRect()
          // Grid is drawn in bitmap pixels; map CSS pointer coords into the same space.
          const layout = recallLayout(canvas.width, canvas.height, grid)
          const cell = cellAt(layout, (e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height))
          if (cell !== -1) {
            setFocus(cell)
            choose(cell)
          }
        }}
      />
      <p className="game-hint">Watch, then repeat · arrows + Enter work too</p>
    </div>
  )
}
