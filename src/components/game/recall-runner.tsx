'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'
import type { GameInputEvent } from '@/games/core/game-module'
import { recallEngine, type TRecallConfig } from '@/games/recall/engine'
import {
  recallCellTiming,
  recallLayout,
  resolveSequences,
  showSchedule,
  type TSeqResolution,
} from '@/games/recall/table'
import { drawSkinAvatar } from '@/lib/game/skin-renderer'
import { drawGhostGlyph } from '@/lib/game/ghost-renderer'
import { ActionFeedback, useActionFeedback } from '@/components/game/action-feedback'
import { elapsedGhost, ghostEventsAt } from '@/lib/game/ghost-playback'
import { audio } from '@/lib/game/audio'
import {
  gameplayLoop,
  isGameInputTarget,
  recallFeedback,
  signedPoints,
} from '@/lib/game/gameplay-motion'
import { PromptFlash } from '@/components/game/prompt-flash'

function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
  return { w: canvas.width, h: canvas.height }
}

type TChoice = Extract<GameInputEvent, { type: 'choice' }>

function cellAt(
  layout: { cells: Array<{ x: number; y: number; size: number }> },
  x: number,
  y: number
) {
  for (let i = 0; i < layout.cells.length; i += 1) {
    const c = layout.cells[i]
    if (x >= c.x && x <= c.x + c.size && y >= c.y && y <= c.y + c.size) return i
  }
  return -1
}

export function RecallRunner({
  game,
  session,
  onReady,
  rivalScore = null,
}: {
  game: TPublicGame
  session: TRunSession
  onReady?: () => void
  rivalScore?: number | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const actionFeedback = useActionFeedback()
  const timeRef = useRef<HTMLSpanElement>(null)
  const avatarRef = useRef<HTMLCanvasElement>(null)
  const statusRef = useRef<HTMLSpanElement>(null)
  const promptRef = useRef('')
  const [prompt, setPrompt] = useState<{
    key: string
    label: string
    tone: 'violet' | 'lime'
  } | null>(null)
  const verdictRef = useRef<ReturnType<typeof recallFeedback>>(null)
  const resolutionRef = useRef({ count: -1, resolved: [] as TSeqResolution[] })
  const focusRef = useRef(0)
  const keyboardRef = useRef(false)
  const finishRequested = useRef(false)
  const [score, setScore] = useState(0)
  const config = useMemo(
    () => recallEngine.validateConfig(game.config) as TRecallConfig,
    [game.config]
  )
  const durationMs = game.durationMs
  const grid = config.grid
  const { slotMs, onMs } = recallCellTiming(config)

  useEffect(() => {
    onReady?.()
  }, [onReady])

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
      draw() // Resizing clears the bitmap; repaint even between animation frames.
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
      const taps = session.eventsRef.current.filter((e) => e.type === 'choice') as TChoice[]
      if (resolutionRef.current.count !== taps.length)
        resolutionRef.current = { count: taps.length, resolved: resolveSequences(config, taps) }
      const resolved = resolutionRef.current.resolved
      const schedule = showSchedule(config, taps)
      const { w, h } = dims
      ctx2d.clearRect(0, 0, w, h)
      const current = resolved.findIndex((r) => r.status === 'open')
      const finished = resolved.every((r) => r.status !== 'open')
      const answering = current !== -1 && elapsed >= schedule[current].showEnd

      if (finished && !finishRequested.current && elapsed - (taps.at(-1)?.t ?? 0) >= 1600) {
        finishRequested.current = true
        session.finish()
        return false
      }

      for (let i = 0; i < layout.cells.length; i += 1) {
        const c = layout.cells[i]
        let fill = 'rgba(245,247,255,0.07)'
        let stroke = 'rgba(245,247,255,0.22)'
        if (current !== -1) {
          const slot = schedule[current]
          const seq = config.sequences[current]
          if (elapsed >= slot.showStart && elapsed < slot.showEnd) {
            const k = Math.floor((elapsed - slot.showStart) / slotMs)
            const on = elapsed - slot.showStart - k * slotMs < onMs
            if (on && k < seq.cells.length && seq.cells[k] === i) {
              fill = 'rgba(98,247,230,0.65)'
              stroke = '#62f7e6'
            }
          }
        }
        const v = verdictRef.current
        const age = v ? elapsed - v.at : -1
        // Never replay a completed pattern as a celebration: those flashes look
        // like instructions and can run into the following WATCH phase.
        if (v && v.cell === i && age >= 0 && age < (v.status === 'open' ? 160 : 300)) {
          fill = v.status === 'failed' ? 'rgba(255,102,143,0.3)' : 'rgba(98,247,230,0.3)'
          stroke =
            v.status === 'failed' ? '#ff668f' : v.status === 'complete' ? '#c7ff5e' : '#62f7e6'
        }
        if (
          current !== -1 &&
          elapsed >= schedule[current].showEnd &&
          elapsed < schedule[current].showEnd + 120
        )
          stroke = '#62f7e6'
        if (v?.status === 'failed' && v.cell === i && age >= 0 && age < 180) stroke = '#ff668f'
        ctx2d.beginPath()
        if (typeof ctx2d.roundRect === 'function')
          ctx2d.roundRect(c.x, c.y, c.size, c.size, c.size * 0.18)
        else ctx2d.rect(c.x, c.y, c.size, c.size)
        ctx2d.fillStyle = fill
        ctx2d.fill()
        ctx2d.lineWidth = Math.max(2, layout.size * 0.03)
        ctx2d.strokeStyle = stroke
        ctx2d.stroke()
        if (
          answering &&
          keyboardRef.current &&
          document.activeElement === canvas &&
          i === focusRef.current
        ) {
          ctx2d.lineWidth = Math.max(2, layout.size * 0.045)
          ctx2d.strokeStyle = '#62f7e6'
          ctx2d.beginPath()
          if (typeof ctx2d.roundRect === 'function')
            ctx2d.roundRect(c.x - 4, c.y - 4, c.size + 8, c.size + 8, c.size * 0.22)
          else ctx2d.rect(c.x - 4, c.y - 4, c.size + 8, c.size + 8)
          ctx2d.stroke()
        }
      }

      const seen = elapsedGhost(session.ghost, elapsed)
      if (session.ghost) {
        const last = ghostEventsAt(session.ghost, elapsed).at(-1)
        session.ghostActionRef.current = `GHOST · ${signedPoints(seen.at(-1)?.delta ?? 0)}`
        // The rival's independent inputs must not look like extra WATCH tiles.
        if (answering && last?.type === 'choice' && elapsed - last.t < 1200) {
          const cell = layout.cells[last.value]
          if (cell)
            drawGhostGlyph(ctx2d, cell.x + cell.size / 2, cell.y + cell.size / 2, cell.size * 0.17)
        } else if (seen.length) drawGhostGlyph(ctx2d, w - 24, h - 24, 12)
      }
      if (statusRef.current) {
        statusRef.current.textContent =
          current === -1
            ? finished
              ? 'DONE — WAITING FOR CLOCK'
              : ''
            : (() => {
                const slot = schedule[current]
                if (elapsed < slot.showStart)
                  return `SEQ ${current + 1}/${config.sequences.length} · GET READY`
                if (elapsed < slot.showEnd)
                  return `SEQ ${current + 1}/${config.sequences.length} · WATCH`
                return `SEQ ${current + 1}/${config.sequences.length} · YOUR TURN · ${resolved[current].used}/${config.sequences[current].cells.length}`
              })()
      }
      if (current !== -1) {
        const slot = schedule[current]
        const stage = elapsed < slot.showStart ? 'ready' : elapsed < slot.showEnd ? 'watch' : 'turn'
        const key = `${current}:${stage}`
        if (stage !== 'ready' && promptRef.current !== key) {
          promptRef.current = key
          setPrompt({
            key,
            label: stage === 'watch' ? 'WATCH' : 'YOUR TURN',
            tone: stage === 'watch' ? 'violet' : 'lime',
          })
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
  }, [config, durationMs, grid, onMs, slotMs, session.skin, session.reduced])

  const choose = (cell: number) => {
    if (session.phase !== 'running') return
    if (cell < 0 || cell >= grid * grid) return
    const taps = session.eventsRef.current.filter((e) => e.type === 'choice') as TChoice[]
    const resolved = resolveSequences(config, taps)
    const current = resolved.findIndex((r) => r.status === 'open')
    const schedule = showSchedule(config, taps)
    if (current === -1 || session.getElapsed() < schedule[current].showEnd) return
    audio.unlock()
    if (session.logEvent({ type: 'choice', value: cell }) < 0) return
    const next = session.eventsRef.current.filter((e) => e.type === 'choice') as TChoice[]
    const res = recallEngine.scoreRun({
      seed: game.seed,
      config,
      events: session.eventsRef.current,
      visibilityInterruptions: 0,
    })
    setScore(res.score)
    const feedback = recallFeedback(config, next)
    const canvas = canvasRef.current
    if (canvas && feedback && feedback.status !== 'open') {
      const layout = recallLayout(canvas.width, canvas.height, grid)
      const selected = layout.cells[cell]
      actionFeedback.show({
        x: (selected.x + selected.size / 2) / canvas.width,
        y: (selected.y + selected.size / 2) / canvas.height,
        delta: res.score - session.scoreRef.current,
        label: feedback.status === 'complete' ? 'SEQUENCE COMPLETE' : 'MISS',
        showPoints: feedback.status === 'complete',
      })
    }
    session.reportScore(res.score)
    verdictRef.current = feedback
    if (feedback?.status === 'failed') audio.miss()
    else if (feedback?.status === 'complete') audio.correct()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isGameInputTarget(e.target)) return
      if (e.repeat) return
      const n = Number.parseInt(e.key, 10)
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key) ||
        (n >= 1 && n <= 9)
      ) {
        keyboardRef.current = true
        canvasRef.current?.focus({ preventScroll: true })
      }
      if (n >= 1 && n <= 9 && n - 1 < grid * grid) {
        e.preventDefault()
        focusRef.current = n - 1
        choose(n - 1)
        return
      }
      const row = Math.floor(focusRef.current / grid)
      const col = focusRef.current % grid
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        focusRef.current = Math.max(0, (row - 1) * grid + col)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        focusRef.current = Math.min(grid * grid - 1, (row + 1) * grid + col)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        focusRef.current = row * grid + Math.max(0, col - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        focusRef.current = row * grid + Math.min(grid - 1, col + 1)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        choose(focusRef.current)
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
        <span ref={statusRef} className="game-chip flex-1">
          Seq 1
        </span>
        <span className="game-score flex items-center gap-2" aria-live="off">
          {rivalScore !== null && (
            <span className="font-600 text-spectral-violet text-xs">R {rivalScore}</span>
          )}
          {score}
        </span>
      </div>
      <PromptFlash
        key={prompt?.key ?? 'none'}
        label={prompt?.label ?? ''}
        tone={prompt?.tone ?? 'lime'}
      />
      <div className="relative flex min-h-75 flex-1 flex-col">
        <canvas
          ref={canvasRef}
          role="application"
          tabIndex={0}
          aria-label="Recall grid. Watch the flashing cells, then repeat the sequence. Arrows move, Enter selects, digits work too."
          style={{
            opacity: session.phase === 'finishing' ? 0.6 : 1,
            transition: 'opacity 120ms linear',
          }}
          className="game-arena min-h-75 w-full flex-1 touch-none"
          onPointerDown={(e) => {
            keyboardRef.current = false
            const canvas = canvasRef.current
            if (!canvas) return
            const rect = canvas.getBoundingClientRect()
            // Grid is drawn in bitmap pixels; map CSS pointer coords into the same space.
            const layout = recallLayout(canvas.width, canvas.height, grid)
            const cell = cellAt(
              layout,
              (e.clientX - rect.left) * (canvas.width / rect.width),
              (e.clientY - rect.top) * (canvas.height / rect.height)
            )
            if (cell !== -1) {
              focusRef.current = cell
              choose(cell)
            }
          }}
        />
        <ActionFeedback entries={actionFeedback.entries} reduced={session.reduced} />
      </div>
      <p className="game-hint">Watch, then repeat · One wrong tile ends the pattern</p>
    </div>
  )
}
