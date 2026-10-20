'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSubmitRun } from '@/features/game/mutations/useSubmitRun.mutation'
import { useGameStore, type TPublicGame } from '@/features/game/store/game-store'
import { audio } from '@/lib/game/audio'
import { countdownState, inputTime, runClock, consumptionRequest } from '@/lib/game/gameplay-motion'
import { clearPending, loadPending, savePending } from '@/lib/game/pending-store'
import { markLocalRunSynced, recordLocalRun } from '@/lib/game/local-progress'
import { useEquippedSkin } from '@/lib/hooks/useEquippedSkin.hook'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion.hook'
import type { GameInputEvent } from '@/games/core/game-module'
import { getGame } from '@/games/registry'

export type TRunPhase = 'loading' | 'countdown' | 'running' | 'finishing' | 'result' | 'error'

export type TRunResult = {
  score: number
  valid: boolean
  runId: string
  outcome: string | null
  isPersonalBest: boolean
  xpAwarded: number
  provisional?: boolean
  isLocalBest?: boolean
  syncError?: string | null
}

type TLogInput = Omit<Extract<GameInputEvent, { type: 'tap' }>, 't'> | Omit<Extract<GameInputEvent, { type: 'choice' }>, 't'> | Omit<Extract<GameInputEvent, { type: 'pointer_down' | 'pointer_move' | 'pointer_up' }>, 't'>


export function useRunSession(game: TPublicGame, token: string, ready = true) {
  const [phase, setPhase] = useState<TRunPhase>('loading')
  const [count, setCount] = useState(3)
  const [countVisible, setCountVisible] = useState(false)
  const acceptingRef = useRef(false)
  const [result, setResult] = useState<TRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eventsRef = useRef<GameInputEvent[]>([])
  const scoreRef = useRef(0)
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
  const snapshot = useGameStore(state => (state.snapshot?.token === token ? state.snapshot : null))
  const ghostMeta = snapshot?.ghost ?? null
  const ghost = ghostMeta?.ghost ?? snapshot?.pastSelf?.ghost ?? snapshot?.challenge?.ghost
  const reportScore = useCallback((value: number) => {
    scoreRef.current = value
  }, [])

  const getElapsed = useCallback(() => {
    if (!runStartRef.current) return 0
    return Math.min(game.durationMs, Math.max(0, performance.now() - runStartRef.current))
  }, [game.durationMs])

  const doSubmit = useCallback(
    async (events: GameInputEvent[], visibilityInterruptions: number) => {
      if (submittingRef.current) return
      submittingRef.current = true
      acceptingRef.current = false
      let replay = { score: 0, valid: false }
      try {
        const mod = getGame(game.gameId)
        const config = mod.validateConfig(game.config)
        replay = mod.scoreRun({ seed: game.seed, config, events, visibilityInterruptions })
      } catch {}
      const local = recordLocalRun({
        id: token,
        gameId: game.gameId,
        gameDate: game.gameDate,
        mode: 'run',
        score: replay.score,
        valid: replay.valid
      })
      await savePending({ token, gameId: game.gameId, events, visibilityInterruptions, savedAt: Date.now() }).catch(() => undefined)
      const localResult: TRunResult = {
        score: replay.score,
        valid: replay.valid,
        runId: `local:${token}`,
        outcome: null,
        isPersonalBest: false,
        xpAwarded: 0,
        provisional: true,
        isLocalBest: local.personalBest,
        syncError: null
      }
      let finalResult = localResult
      try {
        // Confirm the run before showing the result so profile/streak reads never race the save.
        const data = await Promise.race([
          submitRef.current({ token, events, visibilityInterruptions }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
        ])
        if (!data) throw new Error('timeout')
        await clearPending(token).catch(() => undefined)
        const patch = {
          score: data.run.validatedScore,
          xp: data.progression?.xpAwarded ?? 0,
          valid: data.run.valid,
          personalBest: data.progression?.isPersonalBest ?? false
        }
        markLocalRunSynced(token, patch)
        finalResult = {
          score: data.run.validatedScore,
          valid: data.run.valid,
          runId: String(data.run.id),
          outcome: data.outcome,
          isPersonalBest: patch.personalBest,
          xpAwarded: patch.xp,
          provisional: false,
          isLocalBest: false,
          syncError: null
        }
        if (data.run.valid && (data.outcome === 'win' || patch.personalBest)) audio.win()
      } catch (e) {
        finalResult = {
          ...localResult,
          syncError: e instanceof TypeError ? 'offline' : e instanceof Error ? e.message : 'submit-failed'
        }
      } finally {
        submittingRef.current = false
      }
      setResult(finalResult)
      setPhase('result')
    },
    [game, token]
  )

  useEffect(() => {
    if (!ready) return
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
      if (document.visibilityState === 'hidden' && eventsRef.current.length) {
        void savePending({
          token,
          gameId: game.gameId,
          events: [...eventsRef.current],
          visibilityInterruptions: visRef.current,
          savedAt: Date.now()
        }).catch(() => undefined)
      }
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
  }, [doSubmit, game.durationMs, game.gameId, ready, token])

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
    () => ({ phase, count, countVisible, result, error, eventsRef, scoreRef, reportScore, logEvent, getElapsed, retryPending, reduced, skin, ghost, ghostMeta }),
    [phase, count, countVisible, result, error, logEvent, getElapsed, retryPending, reduced, skin, ghost, ghostMeta, reportScore]
  )
}

export type TRunSession = ReturnType<typeof useRunSession>
