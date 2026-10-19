'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSubmitRun } from '@/features/game/mutations/useSubmitRun.mutation'
import { useGameStore, type TPublicGame } from '@/features/game/store/game-store'
import { audio } from '@/lib/game/audio'
import { countdownState, inputTime, runClock, consumptionRequest } from '@/lib/game/gameplay-motion'
import { clearPending, loadPending, savePending } from '@/lib/game/pending-store'
import { useEquippedSkin } from '@/lib/hooks/useEquippedSkin.hook'
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
  const consumeRef = useRef<(() => Promise<boolean>) | null>(null)
  const submittingRef = useRef(false)
  const submit = useSubmitRun()
  const submitRef = useRef(submit.mutateAsync)
  useEffect(() => {
    submitRef.current = submit.mutateAsync
  })
  const reduced = useReducedMotion()
  const skin = useEquippedSkin()
  const ghost = useGameStore(state => state.snapshot?.token === token ? state.snapshot.pastSelf?.ghost ?? state.snapshot.challenge?.ghost : undefined)

  const getElapsed = useCallback(() => {
    if (!runStartRef.current) return 0
    return Math.min(game.durationMs, Math.max(0, performance.now() - runStartRef.current))
  }, [game.durationMs])

  const doSubmit = useCallback(
    async (events: GameInputEvent[], visibilityInterruptions: number) => {
      if (submittingRef.current) return
      submittingRef.current = true
      acceptingRef.current = false
      setPhase('submitting')
      await savePending({ token, gameId: game.gameId, events, visibilityInterruptions, savedAt: Date.now() }).catch(() => undefined)
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
          setPhase('pending')
        } else {
          setError(e instanceof Error ? e.message : 'submit-failed')
          setPhase('error')
        }
      } finally {
        submittingRef.current = false
      }
    },
    [game.gameId, token]
  )

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let finished = false
    let lastCount = 3
    const key = `ghost60:consumed:${token}`
    const request = consumptionRequest(token)
    let lastRequest = -Infinity
    consumeRef.current = () => {
      if (performance.now() - lastRequest < 1000) return Promise.resolve(false)
      lastRequest = performance.now()
      try { window.sessionStorage.setItem(key, '1') } catch {}
      return request()
    }
    const begin = async () => {
      const pending = await loadPending(token).catch(() => undefined)
      if (cancelled) return
      if (pending) {
        eventsRef.current = pending.events
        void doSubmit(pending.events, pending.visibilityInterruptions)
        return
      }
      let spent = false
      try { spent = window.sessionStorage.getItem(key) === '1' } catch {}
      if (spent) {
        setError('attempt-already-started')
        setPhase('error')
        void request()
        return
      }
      const countdownStart = performance.now()
      runStartRef.current = countdownStart + 3000
      eventsRef.current = []
      visRef.current = 0
      setPhase('countdown')
      audio.tick()
      const update = () => {
        if (cancelled || finished) return
        const now = performance.now()
        const countdown = countdownState(now - countdownStart)
        setCount(countdown.count)
        setCountVisible(countdown.visible)
        const clock = runClock(now, runStartRef.current, game.durationMs)
        if (countdown.count !== lastCount) {
          lastCount = countdown.count
          if (clock.running) audio.go()
          else if (countdown.count > 0) audio.tick()
        }
        acceptingRef.current = clock.running
        if (clock.consume) void consumeRef.current?.()
        if (clock.finished) {
          finished = true
          setPhase('finishing')
          audio.finish()
          timer = setTimeout(() => void doSubmit([...eventsRef.current], visRef.current), 120)
          return
        }
        if (clock.running) setPhase('running')
        timer = setTimeout(update, 50)
      }
      update()
    }
    void begin()
    const onVis = () => {
      if (document.visibilityState === 'hidden' && acceptingRef.current) visRef.current += 1
      if (runStartRef.current && (eventsRef.current.length || performance.now() - runStartRef.current >= 3000)) void consumeRef.current?.()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onVis)
    return () => {
      if (runStartRef.current && (eventsRef.current.length || performance.now() - runStartRef.current >= 3000)) void consumeRef.current?.()
      cancelled = true
      acceptingRef.current = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onVis)
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
      void consumeRef.current?.()
      return t
    },
    [game.durationMs]
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
    () => ({ phase, count, countVisible, result, error, eventsRef, logEvent, getElapsed, retryPending, reduced, skin, ghost }),
    [phase, count, countVisible, result, error, logEvent, getElapsed, retryPending, reduced, skin, ghost]
  )
}

export type TRunSession = ReturnType<typeof useRunSession>
