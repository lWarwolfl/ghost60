'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSubmitRun } from '@/features/game/mutations/useSubmitRun.mutation'
import type { TPublicGame } from '@/features/game/store/game-store'
import { audio } from '@/lib/game/audio'
import { countdownState, inputTime } from '@/lib/game/gameplay-motion'
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

const COUNT_MS = 1000
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
  const [countVisible, setCountVisible] = useState(true)
  const acceptingRef = useRef(false)
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
    return Math.min(game.durationMs, Math.max(0, performance.now() - runStartRef.current))
  }, [game.durationMs])

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
        if (data.run.valid && (data.outcome === 'win' || data.progression?.isPersonalBest)) audio.win()
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
    const countdownStart = performance.now()
    runStartRef.current = countdownStart + COUNT_MS * 3
    const updateCount = () => {
      const state = countdownState(performance.now() - countdownStart)
      setCount(state.count)
      setCountVisible(state.visible)
    }
    for (const at of [700, 1000, 1700, 2000, 2700, 3000, 3000 + GO_MS]) {
      timers.push(setTimeout(() => {
        updateCount()
        if (at === 1000 || at === 2000) audio.tick()
        if (at === 3000) {
          acceptingRef.current = true
          setPhase('running')
          audio.go()
        }
      }, at))
    }
    timers.push(setTimeout(() => {
      if (!consumedRef.current) {
        consumedRef.current = true
        void consume(token)
      }
    }, COUNT_MS * 3 + 3000))
    audio.tick()
    timers.push(setTimeout(() => {
      acceptingRef.current = false
      setPhase('finishing')
      audio.finish()
      timers.push(setTimeout(() => void doSubmit([...eventsRef.current], visRef.current), 120))
    }, COUNT_MS * 3 + game.durationMs))
    const onVis = () => {
      if (document.visibilityState === 'hidden' && acceptingRef.current) visRef.current += 1
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      acceptingRef.current = false
      for (const t of timers) clearTimeout(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [doSubmit, game.durationMs, token])

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
      const t = inputTime(performance.now(), runStartRef.current, game.durationMs, acceptingRef.current)
      if (t < 0) return -1
      eventsRef.current.push({ ...input, t } as GameInputEvent)
      if (!consumedRef.current) {
        consumedRef.current = true
        void consume(token)
      }
      return t
    },
    [token, game.durationMs]
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

  return useMemo(
    () => ({ phase, count, countVisible, result, error, eventsRef, logEvent, getElapsed, retryPending, reduced }),
    [phase, count, countVisible, result, error, logEvent, getElapsed, retryPending, reduced]
  )
}

export type TRunSession = ReturnType<typeof useRunSession>
