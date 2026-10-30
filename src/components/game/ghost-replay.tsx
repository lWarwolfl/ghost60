'use client'

import { useEffect, useRef, useState } from 'react'
import { drawGhostGlyph } from '@/lib/game/ghost-renderer'
import { drawReplayBoard } from '@/lib/game/replay-renderer'
import type { SanitizedGhost } from '@/games/core/game-module'
import type { GameInputEvent } from '@/games/core/game-module'
import { ghostAt, ghostDeltaAt, signedPoints } from '@/lib/game/gameplay-motion'
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

    const { point, last } = drawReplayBoard(ctx, game, events, elapsed, width, height)
    if (last) drawGhostGlyph(ctx, point.x, point.y, 13)
    const recent = ghostDeltaAt(ghost.timeline, elapsed)
    if (recent && elapsed - recent.at < 1600 && last) {
      ctx.font = '800 28px sans-serif'
      ctx.textAlign = 'center'
      ctx.lineWidth = 7
      ctx.strokeStyle = '#070912'
      ctx.fillStyle = recent.delta < 0 ? '#ff668f' : '#c7ff5e'
      const x = Math.min(width - 55, Math.max(55, point.x))
      const y = Math.max(32, point.y - 24)
      ctx.strokeText(signedPoints(recent.delta), x, y)
      ctx.fillText(signedPoints(recent.delta), x, y)
    }
  }, [elapsed, events, game, ghost, score])

  const ghostNow = ghostAt(ghost.timeline, elapsed, score)
  const recent = ghostDeltaAt(ghost.timeline, elapsed)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-spectral-violet text-[10px] tracking-[0.18em] uppercase">Your ghost</p>
        <p className="tnum flex items-baseline gap-2 text-sm">
          {recent && elapsed - recent.at < 1600 ? (
            <span className={recent.delta < 0 ? 'text-rival-coral' : 'text-signal-lime'}>
              {signedPoints(recent.delta)}
            </span>
          ) : null}
          <span className="text-spectral-violet">{ghostNow.score}</span>
          <span className="text-ghost-muted"> / {score}</span>
        </p>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-label={`Ghost replay of your ${game.gameId} run. Live ghost score ${ghostNow.score} of ${score}.`}
          className="game-arena h-64 w-full"
        />
        <span className="text-spectral-violet border-spectral-violet/40 bg-ink-950/70 pointer-events-none absolute top-3 right-3 rounded-full border px-2 py-0.5 text-[9px] tracking-[0.18em] uppercase">
          Ghost
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (elapsed >= game.durationMs) setElapsed(0)
            setPlaying((value) => !value)
          }}
          className="rounded-control font-600 min-h-11 border border-white/15 px-4 text-xs"
        >
          {playing ? 'PAUSE' : elapsed >= game.durationMs ? 'REPLAY' : 'PLAY'}
        </button>
        <button
          type="button"
          onClick={() => {
            setElapsed(0)
            setPlaying(true)
          }}
          className="rounded-control font-600 min-h-11 border border-white/15 px-3 text-xs"
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
              className={`rounded-control min-h-11 px-3 text-xs ${speed === value ? 'text-spectral-cyan border-spectral-cyan/50 border' : 'text-ghost-muted border border-white/10'}`}
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
        Every tap, choice, and pointer move plays on the original game board at its recorded time.
        Green = points taken · Coral = points lost.
      </p>
    </div>
  )
}
