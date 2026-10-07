'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSubmitRun } from '@/features/game/mutations/useSubmitRun.mutation'
import type { TPublicGame } from '@/features/game/store/game-store'
import { audio } from '@/lib/game/audio'
import { clearPending, loadPending, savePending } from '@/lib/game/pending-store'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion.hook'
import type { GameInputEvent } from '@/games/core/game-module'

export type TRunPhase = 'countdown' | 'running' | 'finishing' | 'submitting' | 'pending' | 'result' | 'error'

export type TRunResult = {
  score: number
  valid: boolean
  runId: string
  outcome: string | null
  isPersonalBest: boolean
  xpAwarded: number
}

type TLogInput = Omit<Extract<GameInputEvent, { type: 'tap' }>, 't'> | Omit<Extract<GameInputEvent, { type: 'choice' }>, 't'> | Omit<Extract<GameInputEvent, { type: 'pointer_down' | 'pointer_move' | 'pointer_up' }>, 't'>

const COUNT_MS = 700
const GO_MS = 250

async function consume(token: string) {
  try {
    await fetch('/api/game/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
  } catch {
    return
  }
}

export function useRunSession(game: TPublicGame, token: string) {
  const [phase, setPhase] = useState<TRunPhase>('countdown')
  const [count, setCount] = useState(3)
  const [result, setResult] = useState<TRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eventsRef = useRef<GameInputEvent[]>([])
  const visRef = useRef(0)
  const runStartRef = useRef(0)
  const consumedRef = useRef(false)
  const submit = useSubmitRun()
  const submitRef = useRef(submit.mutateAsync)
  useEffect(() => {
    submitRef.current = submit.mutateAsync
  })
  const reduced = useReducedMotion()

  const getElapsed = useCallback(() => {
    if (!runStartRef.current) return 0
    return Math.max(0, performance.now() - runStartRef.current)
  }, [])

  const doSubmit = useCallback(
    async (events: GameInputEvent[], visibilityInterruptions: number) => {
      setPhase('submitting')
      try {
        const data = await submitRef.current({ token, events, visibilityInterruptions })
        await clearPending(token).catch(() => undefined)
        setResult({
          score: data.run.validatedScore,
          valid: data.run.valid,
          runId: String(data.run.id),
          outcome: data.outcome,
          isPersonalBest: data.progression?.isPersonalBest ?? false,
          xpAwarded: data.progression?.xpAwarded ?? 0
        })
        setPhase('result')
        if (data.run.valid && data.run.validatedScore > 0) audio.win()
      } catch (e) {
        if (e instanceof TypeError) {
          await savePending({ token, gameId: game.gameId, events, visibilityInterruptions, savedAt: Date.now() }).catch(() => undefined)
          setPhase('pending')
        } else {
          setError(e instanceof Error ? e.message : 'submit-failed')
          setPhase('error')
        }
      }
    },
    [game.gameId, token]
  )

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const steps: Array<[number, () => void]> = [
      [COUNT_MS, () => { setCount(2); audio.tick() }],
      [COUNT_MS * 2, () => { setCount(1); audio.tick() }],
      [COUNT_MS * 3, () => { setCount(0); audio.go() }],
      [
        COUNT_MS * 3 + GO_MS,
        () => {
          runStartRef.current = performance.now()
          setPhase('running')
        }
      ]
    ]
    audio.tick()
    for (const [at, fn] of steps) timers.push(setTimeout(fn, at))
    const fin = setTimeout(() => {
      setPhase('finishing')
      audio.finish()
      void doSubmit(eventsRef.current, visRef.current)
    }, COUNT_MS * 3 + GO_MS + game.durationMs)
    timers.push(fin)
    const onVis = () => {
      if (document.visibilityState === 'hidden') visRef.current += 1
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      for (const t of timers) clearTimeout(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [doSubmit, game.durationMs])

  useEffect(() => {
    const onOnline = () => {
      void (async () => {
        const pending = await loadPending(token).catch(() => undefined)
        if (pending) void doSubmit(pending.events, pending.visibilityInterruptions)
      })()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [doSubmit, token])

  const logEvent = useCallback(
    (input: TLogInput) => {
      if (!runStartRef.current) return -1
      const t = Math.max(0, Math.round(performance.now() - runStartRef.current))
      eventsRef.current.push({ ...input, t } as GameInputEvent)
      if (!consumedRef.current) {
        consumedRef.current = true
        void consume(token)
      }
      return t
    },
    [token]
  )

  const retryPending = useCallback(async () => {
    const pending = await loadPending(token).catch(() => undefined)
    if (!pending) {
      setError('nothing-pending')
      setPhase('error')
      return
    }
    await doSubmit(pending.events, pending.visibilityInterruptions)
  }, [doSubmit, token])

  return { phase, count, result, error, eventsRef, logEvent, getElapsed, retryPending, reduced }
}

export type TRunSession = ReturnType<typeof useRunSession>
