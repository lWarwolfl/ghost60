'use client'

import { useEffect, useRef } from 'react'
import { GhostAvatar } from '@/components/brand/ghost-avatar'
import type { TRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TGameSnapshot } from '@/features/game/store/game-store'
import { ghostAt } from '@/lib/game/gameplay-motion'

export function GhostRace({ session, ghost }: { session: TRunSession; ghost: TGameSnapshot['ghost'] }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const youRef = useRef<HTMLSpanElement>(null)
  const wispRef = useRef<HTMLSpanElement>(null)
  const youScoreRef = useRef<HTMLSpanElement>(null)
  const ghostScoreRef = useRef<HTMLSpanElement>(null)
  const target = ghost?.targetScore ?? 0
  useEffect(() => {
    if (!ghost) return
    const span = Math.max(1, target * 1.15)
    let raf = 0
    const place = (node: HTMLSpanElement | null, score: number) => {
      if (node) node.style.left = `${8 + Math.min(1, score / span) * 84}%`
    }
    const tick = () => {
      const elapsed = session.getElapsed()
      const yours = session.scoreRef.current
      const theirs = ghostAt(ghost.ghost.timeline, elapsed, target)
      place(youRef.current, yours)
      place(wispRef.current, theirs.score)
      if (youScoreRef.current) youScoreRef.current.textContent = String(yours)
      if (ghostScoreRef.current) ghostScoreRef.current.textContent = String(theirs.score)
      if (rootRef.current) rootRef.current.dataset.lead = yours === theirs.score ? 'even' : yours > theirs.score ? 'you' : 'ghost'
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ghost, target, session])
  if (!ghost) return null
  return (
    <div
      ref={rootRef}
      className="game-race"
      data-lead="even"
      role="group"
      aria-label={`Racing ${ghost.handle}, whose score to beat is ${target}`}
    >
      <div className="game-race-head" aria-hidden="true">
        <span>
          You <b ref={youScoreRef} className="game-race-score">0</b>
        </span>
        <span className="game-race-ghost-name">
          {ghost.handle} <b ref={ghostScoreRef} className="game-race-score">0</b>
        </span>
      </div>
      <div className="game-race-track" aria-hidden="true">
        <span className="game-race-rail" />
        <span ref={wispRef} className="game-race-marker game-race-wisp">
          <GhostAvatar motion="race" gradient={['#c3aaff', '#7d5cff']} className="size-5" />
        </span>
        <span ref={youRef} className="game-race-marker game-race-you" />
      </div>
    </div>
  )
}
