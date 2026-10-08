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
  showSchedule
} from '@/games/recall/table'
import { audio } from '@/lib/game/audio'

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
  const statusRef = useRef<HTMLSpanElement>(null)
  const verdictRef = useRef<{ cell: number; ok: boolean; at: number } | null>(null)
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
    const ro = new ResizeObserver(() => {
      dims = fitCanvas(canvas)
    })
    ro.observe(canvas)
    let raf = 0
    const draw = () => {
      const elapsed = session.getElapsed()
      const taps = session.eventsRef.current.filter((e) => e.type === 'choice') as TChoice[]
      const resolved = resolveSequences(config, taps)
      const { w, h } = dims
      ctx2d.clearRect(0, 0, w, h)
      const layout = recallLayout(w, h, grid)
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
              fill = 'rgba(199,255,94,0.85)'
              stroke = '#c7ff5e'
            }
          }
        }
        const v = verdictRef.current
        if (v && v.cell === i && elapsed - v.at < (session.reduced ? 60 : 350)) {
          fill = v.ok ? 'rgba(98,247,230,0.5)' : 'rgba(255,102,143,0.55)'
          stroke = v.ok ? '#62f7e6' : '#ff668f'
        }
        ctx2d.beginPath()
        if (typeof ctx2d.roundRect === 'function') ctx2d.roundRect(c.x, c.y, c.size, c.size, c.size * 0.18)
        else ctx2d.rect(c.x, c.y, c.size, c.size)
        ctx2d.fillStyle = fill
        ctx2d.fill()
        ctx2d.lineWidth = Math.max(2, layout.size * 0.03)
        ctx2d.strokeStyle = stroke
        ctx2d.stroke()
        if (i === focus) {
          ctx2d.lineWidth = Math.max(2, layout.size * 0.045)
          ctx2d.strokeStyle = '#62f7e6'
          ctx2d.beginPath()
          if (typeof ctx2d.roundRect === 'function') ctx2d.roundRect(c.x - 4, c.y - 4, c.size + 8, c.size + 8, c.size * 0.22)
          else ctx2d.rect(c.x - 4, c.y - 4, c.size + 8, c.size + 8)
          ctx2d.stroke()
        }
      }

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
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [config, durationMs, grid, schedule, session, focus])

  const choose = (cell: number) => {
    if (session.phase !== 'running') return
    if (cell < 0 || cell >= grid * grid) return
    const taps = session.eventsRef.current.filter((e) => e.type === 'choice') as TChoice[]
    const resolved = resolveSequences(config, taps)
    if (!resolved.some((r) => r.status === 'open')) return
    audio.unlock()
    const at = session.getElapsed()
    session.logEvent({ type: 'choice', value: cell })
    const next = session.eventsRef.current.filter((e) => e.type === 'choice') as TChoice[]
    const after = resolveSequences(config, next)
    const res = recallEngine.scoreRun({ seed: game.seed, config, events: session.eventsRef.current, visibilityInterruptions: 0 })
    setScore(res.score)
    const killed = after.some((r) => r.status === 'failed') && !resolved.some((r) => r.status === 'failed')
    verdictRef.current = { cell, ok: !killed, at }
    if (killed) audio.miss()
    else audio.correct()
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
      <div className="flex items-center justify-between px-1 py-2 text-sm">
        <span ref={timeRef} className="tnum text-ghost-muted">
          {(durationMs / 1000).toFixed(1)}s
        </span>
        <span ref={statusRef} className="rounded-control bg-surface-700 px-3 py-1 font-display text-xs font-800 tracking-[0.14em] text-spectral-cyan">
          SEQ 1
        </span>
        <span className="tnum flex items-center gap-2 font-600" aria-live="off">
          {rivalScore !== null && <span className="text-xs font-600 text-spectral-violet">RIVAL {rivalScore}</span>}
          {score}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Recall grid. Watch the flashing cells, then repeat the sequence. Arrows move, Enter selects, digits work too."
        className="min-h-75 w-full flex-1 touch-none rounded-card border border-white/10 bg-ink-900"
        onPointerDown={(e) => {
          const canvas = canvasRef.current
          if (!canvas) return
          const rect = canvas.getBoundingClientRect()
          const layout = recallLayout(rect.width, rect.height, grid)
          const cell = cellAt(layout, e.clientX - rect.left, e.clientY - rect.top)
          if (cell !== -1) {
            setFocus(cell)
            choose(cell)
          }
        }}
      />
      <p className="py-2 text-center text-xs text-ghost-muted">Watch, then repeat · arrows + Enter work too</p>
    </div>
  )
}
