'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'
import type { GameInputEvent } from '@/games/core/game-module'
import { shiftEngine, type TShiftConfig } from '@/games/shift/engine'
import { arrowFor, currentShiftCard, shiftRuleFor } from '@/games/shift/table'
import { audio } from '@/lib/game/audio'

type TChoice = Extract<GameInputEvent, { type: 'choice' }>

export function ShiftRunner({
  game,
  session,
  rivalScore = null
}: {
  game: TPublicGame
  session: TRunSession
  rivalScore?: number | null
}) {
  const timeRef = useRef<HTMLSpanElement>(null)
  const statusRef = useRef<HTMLSpanElement>(null)
  const verdictRef = useRef<{ ok: boolean; at: number } | null>(null)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(0)
  const config = useMemo(() => shiftEngine.validateConfig(game.config) as TShiftConfig, [game.config])
  const durationMs = game.durationMs
  const cards = config.cards
  const current = currentShiftCard(cards.length, answered)

  const dots = (() => {
    const taps = session.eventsRef.current.filter((e) => e.type === 'choice') as TChoice[]
    return cards.map((card, i) => {
      const choice = taps[i]
      if (!choice || choice.value === undefined) return 'open' as const
      const inWindow =
        choice.t >= card.presentedMs && choice.t <= card.presentedMs + card.windowMs
      return inWindow && choice.value === card.correct ? 'hit' as const : 'miss' as const
    })
  })()

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const elapsed = session.getElapsed()
      if (timeRef.current) {
        const left = Math.max(0, durationMs - elapsed)
        timeRef.current.textContent = `${(left / 1000).toFixed(1)}s`
      }
      if (statusRef.current) {
        if (current === -1) {
          statusRef.current.textContent = 'DONE — WAITING FOR CLOCK'
        } else {
          const card = cards[current]
          if (elapsed < card.presentedMs) statusRef.current.textContent = `CARD ${current + 1}/${cards.length} · GET READY`
          else if (elapsed <= card.presentedMs + card.windowMs)
            statusRef.current.textContent = `CARD ${current + 1}/${cards.length} · GO`
          else statusRef.current.textContent = `CARD ${current + 1}/${cards.length} · LATE`
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [cards, current, durationMs, session])

  const choose = (side: 0 | 1) => {
    if (session.phase !== 'running') return
    if (current === -1) return
    audio.unlock()
    session.logEvent({ type: 'choice', value: side })
    const res = shiftEngine.scoreRun({ seed: game.seed, config, events: session.eventsRef.current, visibilityInterruptions: 0 })
    setScore(res.score)
    const card = cards[current]
    const taps = session.eventsRef.current.filter((e) => e.type === 'choice') as TChoice[]
    const last = taps[taps.length - 1]
    const ok =
      last.t >= card.presentedMs &&
      last.t <= card.presentedMs + card.windowMs &&
      last.value === card.correct
    verdictRef.current = { ok, at: session.getElapsed() }
    if (ok) audio.correct()
    else audio.miss()
    setAnswered((n) => n + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        choose(0)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        choose(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const rule = current === -1 ? null : shiftRuleFor(current)
  const arrow = current === -1 ? null : arrowFor(cards[current].correct, current)

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-1 py-2 text-sm">
        <span ref={timeRef} className="tnum text-ghost-muted">
          {(durationMs / 1000).toFixed(1)}s
        </span>
        <span
          ref={statusRef}
          className="rounded-control bg-surface-700 px-3 py-1 font-display text-xs font-800 tracking-[0.14em] text-spectral-cyan"
        >
          CARD 1
        </span>
        <span className="tnum flex items-center gap-2 font-600" aria-live="off">
          {rivalScore !== null && <span className="text-xs font-600 text-spectral-violet">RIVAL {rivalScore}</span>}
          {score}
        </span>
      </div>

      <div
        aria-live="polite"
        className={`rounded-card border px-4 py-3 text-center font-display text-xs font-800 tracking-[0.18em] ${
          rule === 'reversed'
            ? 'border-spectral-violet/60 bg-spectral-violet/10 text-spectral-violet'
            : 'border-white/10 bg-surface-800 text-ghost-muted'
        }`}
      >
        {rule === 'reversed' ? 'REVERSED — TAP THE OPPOSITE SIDE' : 'RULE — TAP THE ARROW SIDE'}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4" aria-hidden={current === -1}>
        {current === -1 ? (
          <p className="text-sm text-ghost-muted">All cards answered.</p>
        ) : (
          <p className="font-display text-8xl font-800 text-ghost-text" aria-label={arrow === 0 ? 'Arrow points left' : 'Arrow points right'}>
            {arrow === 0 ? '←' : '→'}
          </p>
        )}
        <div className="flex gap-1.5" aria-label="Card progress">
          {dots.map((d, i) => (
            <span
              key={i}
              className={`size-2 rounded-full ${d === 'hit' ? 'bg-signal-lime' : d === 'miss' ? 'bg-rival-coral' : 'bg-white/15'}`}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3 pb-1">
        <button
          type="button"
          aria-label="Tap left"
          disabled={session.phase !== 'running' || current === -1}
          onClick={() => choose(0)}
          className="flex min-h-16 flex-1 items-center justify-center rounded-control border border-white/15 bg-surface-800 font-display text-3xl font-800 text-ghost-text transition-colors active:bg-surface-700 disabled:opacity-40"
        >
          ←
        </button>
        <button
          type="button"
          aria-label="Tap right"
          disabled={session.phase !== 'running' || current === -1}
          onClick={() => choose(1)}
          className="flex min-h-16 flex-1 items-center justify-center rounded-control border border-white/15 bg-surface-800 font-display text-3xl font-800 text-ghost-text transition-colors active:bg-surface-700 disabled:opacity-40"
        >
          →
        </button>
      </div>
      <p className="py-2 text-center text-xs text-ghost-muted">Arrow keys work too · every 5th card reverses</p>
    </div>
  )
}
