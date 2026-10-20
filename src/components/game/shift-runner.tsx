'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'
import type { GameInputEvent } from '@/games/core/game-module'
import { shiftEngine, type TShiftConfig } from '@/games/shift/engine'
import { arrowFor, currentShiftCard, shiftRuleFor } from '@/games/shift/table'
import { gameplayLoop, committedGhost, signedPoints } from '@/lib/game/gameplay-motion'
import { drawSkinAvatar } from '@/lib/game/skin-renderer'
import { audio } from '@/lib/game/audio'
import { PromptFlash } from '@/components/game/prompt-flash'

type TChoice = Extract<GameInputEvent, { type: 'choice' }>

export function ShiftRunner({
  game,
  session,
  onReady,
  rivalScore = null
}: {
  game: TPublicGame
  session: TRunSession
  onReady?: () => void
  rivalScore?: number | null
}) {
  const timeRef = useRef<HTMLSpanElement>(null)
  const statusRef = useRef<HTMLSpanElement>(null)
  const avatarRef = useRef<HTMLCanvasElement>(null)
  const cardRef = useRef<HTMLParagraphElement>(null)
  const ruleRef = useRef<HTMLDivElement>(null)
  const feedbackRef = useRef<HTMLSpanElement>(null)
  const departureRef = useRef<HTMLSpanElement>(null)
  const rivalRef = useRef<HTMLSpanElement>(null)
  const previousRuleRef = useRef<string | null>(null)
  const promptRef = useRef(-1)
  const [prompt, setPrompt] = useState<{ key: number; label: string; tone: 'violet' | 'cyan' } | null>(null)
  const verdictRef = useRef<{ ok: boolean; at: number; side: 0 | 1; arrow: 0 | 1 } | null>(null)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(0)
  const config = useMemo(() => shiftEngine.validateConfig(game.config) as TShiftConfig, [game.config])
  const durationMs = game.durationMs
  const cards = config.cards
  const current = currentShiftCard(cards.length, answered)

  useEffect(() => {
    onReady?.()
  }, [onReady])

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
    const loop = () => {
      const elapsed = session.getElapsed()
      const avatar = avatarRef.current?.getContext('2d')
      if (avatar) {
        avatar.clearRect(0, 0, 32, 32)
        drawSkinAvatar(avatar, { skin: session.skin, x: 16, y: 16, size: 25, elapsedMs: elapsed, reduced: session.reduced })
      }
      const card = current === -1 ? null : cards[current]
      const presented = card !== null && elapsed >= card.presentedMs
      if (cardRef.current) {
        if (presented && cardRef.current.style.visibility === 'hidden') cardRef.current.animate(session.reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(0.98)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 80 })
        cardRef.current.style.visibility = presented ? 'visible' : 'hidden'
      }
      const rule = current === -1 ? null : shiftRuleFor(current)
      if (presented && rule !== previousRuleRef.current) {
        if (previousRuleRef.current !== null) {
          audio.rule()
          ruleRef.current?.animate(session.reduced ? [{ opacity: 0.7 }, { opacity: 1 }] : [{ opacity: 0.7, transform: 'translateX(-2px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: session.reduced ? 120 : 140 })
        }
        previousRuleRef.current = rule
      }
      if (presented && current !== -1 && promptRef.current !== current) {
        promptRef.current = current
        setPrompt(
          rule === 'reversed'
            ? { key: current, label: 'TAP OPPOSITE', tone: 'violet' }
            : { key: current, label: 'TAP THE ARROW', tone: 'cyan' }
        )
      }
      const seen = committedGhost(session.ghost?.timeline ?? [], session.eventsRef.current.map(e => e.t), elapsed)
      if (session.ghost) {
        const done = seen.at(-1)
        const delta = done ? (done.delta ?? (done.score ?? 0) - (seen.at(-2)?.score ?? 0)) : 0
        session.ghostActionRef.current = done
          ? `CARD ${seen.length}/${cards.length} · ${signedPoints(delta)}`
          : `CARD 1/${cards.length}`
      }
      if (rivalRef.current) rivalRef.current.textContent = seen.length ? `GHOST ${seen.length}/${cards.length}` : ''
      const verdict = verdictRef.current
      if (departureRef.current && verdict) {
        const age = elapsed - verdict.at
        departureRef.current.textContent = age >= 0 && age < 100 ? (verdict.arrow === 0 ? '←' : '→') : ''
        departureRef.current.style.opacity = session.reduced ? '1' : String(Math.max(0, 1 - age / 100))
        departureRef.current.style.transform = session.reduced ? 'none' : `translateX(${(verdict.side === 0 ? -1 : 1) * Math.min(1, age / 100) * 18}px)`
      }
      if (feedbackRef.current) {
        const age = verdict ? elapsed - verdict.at : -1
        feedbackRef.current.textContent = verdict && age >= 0 && age < 140 ? `${verdict.side === 0 ? '←' : '→'} ${verdict.ok ? 'HIT' : 'MISS ×'}` : ''
        feedbackRef.current.style.color = verdict?.ok ? '#c7ff5e' : '#ff668f'
        feedbackRef.current.style.opacity = session.reduced ? '1' : String(Math.max(0, 1 - age / 140))
        feedbackRef.current.style.transform = session.reduced || !verdict ? 'none' : `translateX(${(verdict.side === 0 ? -1 : 1) * Math.min(1, age / 100) * 18}px)`
      }
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
      return elapsed < durationMs
    }
    return gameplayLoop(loop)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- countdown ticks must not re-init the canvas
  }, [cards, current, durationMs, session.skin, session.reduced])

  const choose = (side: 0 | 1) => {
    if (session.phase !== 'running') return
    const index = session.eventsRef.current.length
    const active = cards[index]
    if (!active || session.getElapsed() < active.presentedMs) return
    audio.unlock()
    if (session.logEvent({ type: 'choice', value: side }) < 0) return
    const res = shiftEngine.scoreRun({ seed: game.seed, config, events: session.eventsRef.current, visibilityInterruptions: 0 })
    setScore(res.score)
    session.reportScore(res.score)
    const card = active
    const taps = session.eventsRef.current.filter((e) => e.type === 'choice') as TChoice[]
    const last = taps[taps.length - 1]
    const ok =
      last.t >= card.presentedMs &&
      last.t <= card.presentedMs + card.windowMs &&
      last.value === card.correct
    verdictRef.current = { ok, at: last.t, side, arrow: arrowFor(active.correct, index) }
    if (ok) audio.correct()
    else audio.miss()
    setAnswered(taps.length)
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
      <div className="game-hud">
        <canvas ref={avatarRef} width={32} height={32} className="size-8 shrink-0" aria-hidden="true" />
        <span ref={timeRef} className="game-timer">
          {(durationMs / 1000).toFixed(1)}s
        </span>
        <span ref={statusRef} className="game-chip flex-1">
          Card 1
        </span>
        <span className="game-score flex items-center gap-2" aria-live="off">
          {rivalScore !== null && <span className="text-xs font-600 text-spectral-violet">R {rivalScore}</span>}
          {score}
        </span>
      </div>

      <div
        ref={ruleRef}
        aria-live="polite"
        className={`rounded-card border px-4 py-3 text-center font-display text-xs font-800 tracking-[0.18em] ${
          rule === 'reversed'
            ? 'border-spectral-violet/60 bg-spectral-violet/10 text-spectral-violet'
            : 'border-white/10 bg-surface-800 text-ghost-muted'
        }`}
      >
        {rule === 'reversed' ? '⇄ REVERSED — TAP THE OPPOSITE SIDE' : '⇉ RULE — TAP THE ARROW SIDE'}
      </div>

      <PromptFlash key={prompt?.key ?? 'none'} label={prompt?.label ?? ''} tone={prompt?.tone ?? 'cyan'} />

      <div className="game-arena relative mt-2 flex flex-1 flex-col items-center justify-center gap-2 py-4" aria-hidden={current === -1}>
        {current === -1 ? (
          <p className="text-sm text-ghost-muted">All cards answered.</p>
        ) : (
          <p ref={cardRef} key={current} style={{ visibility: 'hidden', opacity: session.phase === 'finishing' ? 0.6 : 1 }} className="font-display text-8xl font-800 text-ghost-text" aria-label={arrow === 0 ? 'Arrow points left' : 'Arrow points right'}>
            {arrow === 0 ? '←' : '→'}
          </p>
        )}
        <span ref={departureRef} className="pointer-events-none absolute top-1/3 font-display text-8xl font-800 text-ghost-text" aria-hidden="true" />
        <span ref={rivalRef} className="min-h-4 text-xs text-spectral-violet" />
        <span ref={feedbackRef} className="min-h-6 font-display text-sm font-800" aria-live="polite" />
        <div className="flex flex-wrap justify-center gap-1.5" aria-label="Card progress">
          {dots.map((d, i) => (
            <span
              key={i}
              aria-label={`Card ${i + 1}: ${d}`}
              className={`size-2 rounded-full ${d === 'hit' ? 'bg-signal-lime' : d === 'miss' ? 'bg-rival-coral' : 'bg-white/15'}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-3 pb-3">
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
      <p className="game-hint">Arrow keys work too · every 5th card reverses</p>
    </div>
  )
}
