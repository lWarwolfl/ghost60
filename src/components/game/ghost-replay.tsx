'use client'

import { useEffect, useRef, useState } from 'react'
import type { SanitizedGhost } from '@/games/core/game-module'
import type { GameInputEvent } from '@/games/core/game-module'
import { ghostAt } from '@/lib/game/gameplay-motion'
import type { TPublicGame } from '@/features/game/store/game-store'

type TProps = {
  game: TPublicGame
  events: GameInputEvent[]
  ghost: SanitizedGhost
  score: number
}

function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
  return { w: canvas.width, h: canvas.height }
}

export function GhostReplay({ game, events, ghost, score }: TProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(2)
  const elapsedRef = useRef(0)
  useEffect(() => {
    elapsedRef.current = elapsed
  }, [elapsed])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const step = (now: number) => {
      const next = Math.min(game.durationMs, elapsedRef.current + (now - last) * speed)
      last = now
      elapsedRef.current = next
      setElapsed(next)
      if (next >= game.durationMs) {
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed, game.durationMs])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = fitCanvas(canvas)
    const dpr = w / Math.max(1, canvas.getBoundingClientRect().width)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const width = w / dpr
    const height = h / dpr
    ctx.clearRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(245,247,255,0.06)'
    ctx.lineWidth = 1
    for (let x = 0; x < width; x += 28) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y < height; y += 28) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    const visible = events.filter((event) => event.t <= elapsed)
    const points = visible.filter((event) => 'p' in event && event.p)
    if (points.length > 1) {
      ctx.strokeStyle = 'rgba(98,247,230,0.55)'
      ctx.lineWidth = 2
      ctx.beginPath()
      points.forEach((event, index) => {
        const p = (event as Extract<GameInputEvent, { p?: { x: number; y: number } }>).p!
        const x = (p.x / 10000) * width
        const y = (p.y / 10000) * height
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }

    for (const event of visible) {
      if (event.type === 'tap') {
        if (event.p) {
          const x = (event.p.x / 10000) * width
          const y = (event.p.y / 10000) * height
          ctx.fillStyle = '#c7ff5e'
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, Math.PI * 2)
          ctx.fill()
        } else if (typeof event.value === 'number') {
          const radius = Math.min(width, height) * 0.3
          const angle = (event.value * Math.PI) / 180
          ctx.strokeStyle = '#62f7e6'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(width / 2 + radius * Math.cos(angle), height / 2 + radius * Math.sin(angle))
          ctx.lineTo(width / 2 + (radius + 12) * Math.cos(angle), height / 2 + (radius + 12) * Math.sin(angle))
          ctx.stroke()
        }
      }
      if (event.type === 'choice' && typeof event.value === 'number') {
        const x = (event.t / game.durationMs) * width
        ctx.fillStyle = '#a98bff'
        ctx.fillRect(Math.max(0, x - 2), height - 18, 4, 12)
        ctx.fillStyle = 'rgba(169,139,255,0.65)'
        ctx.font = '10px ui-monospace, monospace'
        ctx.fillText(String(event.value), x + 4, height - 7)
      }
    }

    const ghostNow = ghostAt(ghost.timeline, elapsed, score)
    const railY = 12
    ctx.strokeStyle = 'rgba(245,247,255,0.12)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(8, railY)
    ctx.lineTo(width - 8, railY)
    ctx.stroke()
    const ghostX = 8 + (width - 16) * ghostNow.progress
    ctx.fillStyle = '#a98bff'
    ctx.beginPath()
    ctx.arc(ghostX, railY, 5, 0, Math.PI * 2)
    ctx.fill()
    const playerProgress = Math.min(1, elapsed / game.durationMs)
    ctx.fillStyle = '#62f7e6'
    ctx.beginPath()
    ctx.arc(8 + (width - 16) * playerProgress, railY, 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(245,247,255,0.7)'
    ctx.font = '11px ui-monospace, monospace'
    ctx.fillText(`ghost ${ghostNow.score}`, 8, height - 4)
  }, [elapsed, events, game.durationMs, ghost, score])

  const ghostNow = ghostAt(ghost.timeline, elapsed, score)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-spectral-violet text-[10px] tracking-[0.18em] uppercase">Your ghost</p>
        <p className="tnum text-sm">
          <span className="text-spectral-violet">{ghostNow.score}</span>
          <span className="text-ghost-muted"> / {score}</span>
        </p>
      </div>
      <canvas
        ref={canvasRef}
        aria-label={`Ghost replay of your ${game.gameId} run. Live ghost score ${ghostNow.score} of ${score}.`}
        className="game-arena h-64 w-full"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (elapsed >= game.durationMs) setElapsed(0)
            setPlaying((value) => !value)
          }}
          className="rounded-control border border-white/15 min-h-11 px-4 text-xs font-600"
        >
          {playing ? 'PAUSE' : elapsed >= game.durationMs ? 'REPLAY' : 'PLAY'}
        </button>
        <button
          type="button"
          onClick={() => {
            setElapsed(0)
            setPlaying(true)
          }}
          className="rounded-control border border-white/15 min-h-11 px-3 text-xs font-600"
        >
          RESTART
        </button>
        <div className="ml-auto flex gap-1" role="group" aria-label="Playback speed">
          {[1, 2, 4].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={speed === value}
              onClick={() => setSpeed(value)}
              className={`rounded-control min-h-11 px-3 text-xs ${speed === value ? 'text-spectral-cyan border border-spectral-cyan/50' : 'text-ghost-muted border border-white/10'}`}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={game.durationMs}
        value={Math.round(elapsed)}
        onChange={(event) => {
          setPlaying(false)
          setElapsed(Number(event.target.value))
        }}
        aria-label="Replay position"
        className="w-full accent-[#62f7e6]"
      />
      <p className="text-ghost-muted text-xs">
        Every tap, choice, and pointer move is replayed from the stored run — the same order it
        happened.
      </p>
    </div>
  )
}
