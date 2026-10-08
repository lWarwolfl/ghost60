'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ShareButtons } from '@/components/results/share-buttons'
import { useCreateChallenge } from '@/features/game/mutations/useCreateChallenge.mutation'
import { useRunSession, type TRunResult } from '@/features/game/hooks/useRunSession.hook'
import { useGameStore, loadSnapshotFromStorage, type TGameSnapshot } from '@/features/game/store/game-store'
import type { GameInputEvent } from '@/games/core/game-module'
import { getGame } from '@/games/registry'

const PulseRunner = dynamic(() => import('@/components/game/pulse-runner').then((m) => m.PulseRunner), {
  ssr: false,
  loading: () => <p className="py-8 text-center text-sm text-ghost-muted">Warming up the field…</p>
})
const SnapRunner = dynamic(() => import('@/components/game/snap-runner').then((m) => m.SnapRunner), {
  ssr: false,
  loading: () => <p className="py-8 text-center text-sm text-ghost-muted">Shuffling shapes…</p>
})
const OrbitRunner = dynamic(() => import('@/components/game/orbit-runner').then((m) => m.OrbitRunner), {
  ssr: false,
  loading: () => <p className="py-8 text-center text-sm text-ghost-muted">Spinning up the ring…</p>
})
const RecallRunner = dynamic(() => import('@/components/game/recall-runner').then((m) => m.RecallRunner), {
  ssr: false,
  loading: () => <p className="py-8 text-center text-sm text-ghost-muted">Dealing the grid…</p>
})
const ShiftRunner = dynamic(() => import('@/components/game/shift-runner').then((m) => m.ShiftRunner))

function CountOverlay({ count, reduced }: { count: number; reduced: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-live="polite">
      <span
        className={`font-display text-7xl font-800 text-ghost-text ${reduced ? '' : 'animate-reveal'}`}
        key={count}
      >
        {count === 0 ? 'GO' : count}
      </span>
    </div>
  )
}

function BusyOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-950/80" role="status">
      <span className="size-10 animate-spin rounded-full border-2 border-white/15 border-t-spectral-cyan" />
      <p className="text-sm text-ghost-muted">{label}</p>
    </div>
  )
}

function ResultPanel({ snapshot, events, result }: { snapshot: TGameSnapshot; events: GameInputEvent[]; result: TRunResult }) {
  const router = useRouter()
  const { clear } = useGameStore()
  const createChallenge = useCreateChallenge()
  const [sharedUrl, setSharedUrl] = useState<string | null>(null)
  const [challengeError, setChallengeError] = useState<string | null>(null)
  const [display, setDisplay] = useState<number | null>(null)
  const { game, challenge } = snapshot
  const score = result.score
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let metricsLine = ''
  try {
    const mod = getGame(game.gameId)
    const local = mod.scoreRun({ seed: game.seed, config: mod.validateConfig(game.config) as never, events, visibilityInterruptions: 0 })
    metricsLine = Object.entries(local.metrics)
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ')
  } catch {
    metricsLine = ''
  }
  useEffect(() => {
    if (reduced) return
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 420)
      setDisplay(Math.round(score * (0.7 + 0.3 * p)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [reduced, score])
  const leave = (href: string) => {
    clear()
    router.push(href)
  }
  const makeChallenge = async () => {
    setChallengeError(null)
    try {
      const created = await createChallenge.mutateAsync(result.runId)
      setSharedUrl(created.url)
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : 'challenge-failed')
    }
  }
  const delta = challenge ? score - challenge.targetScore : 0
  const outcomeTitle = !challenge
    ? null
    : result.outcome === 'win'
      ? 'YOU CAUGHT IT.'
      : result.outcome === 'loss'
        ? 'IT GOT AWAY.'
        : result.outcome === 'tie'
          ? 'DEAD HEAT.'
          : 'RUN REJECTED'
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center animate-reveal">
      {challenge ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.18em] text-spectral-violet">
            vs {challenge.handle} · {challenge.targetScore}
          </p>
          <p className={`font-display text-4xl font-800 ${result.outcome === 'win' ? 'text-signal-lime' : result.outcome === 'loss' ? 'text-spectral-violet' : ''}`}>
            {outcomeTitle}
          </p>
        </>
      ) : (
        <p className="text-[11px] uppercase tracking-[0.18em] text-spectral-cyan">Server validated</p>
      )}
      <p className="tnum font-display text-6xl font-800">{display ?? score}</p>
      {result.isPersonalBest && (
        <p className="rounded-control border border-signal-lime/60 px-3 py-1 font-display text-xs font-800 tracking-[0.18em] text-signal-lime">
          NEW PERSONAL BEST
        </p>
      )}
      {result.xpAwarded > 0 && (
        <p className="tnum text-xs text-ghost-muted">+{result.xpAwarded} XP</p>
      )}
      {challenge && (
        <p className="tnum text-sm text-ghost-muted">
          {delta > 0 ? `+${delta}` : `${delta}`} against {challenge.targetScore}
        </p>
      )}
      {metricsLine && <p className="text-xs text-ghost-muted">{metricsLine}</p>}
      {sharedUrl ? (
        <div className="w-full">
          <ShareButtons
            url={sharedUrl}
            title="Ghost60 challenge"
            text={challenge ? `I just raced ${challenge.handle}'s ghost. Revenge?` : 'Race my ghost.'}
          />
        </div>
      ) : (
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => void makeChallenge()}
            disabled={createChallenge.isPending}
            className="flex min-h-12 items-center justify-center rounded-control bg-spectral-cyan px-5 font-display text-sm font-800 tracking-[0.14em] text-ink-950 disabled:opacity-50"
          >
            {createChallenge.isPending ? 'WORKING…' : challenge ? 'SEND REVENGE' : 'RACE MY GHOST'}
          </button>
          {challengeError && (
            <p role="alert" className="text-xs text-rival-coral">{challengeError}</p>
          )}
          <button
            type="button"
            onClick={() => leave('/')}
            className="flex min-h-12 items-center justify-center rounded-control border border-white/15 px-5 text-sm font-600"
          >
            BACK TO TODAY
          </button>
        </div>
      )}
    </div>
  )
}

function RunActive({ snapshot }: { snapshot: TGameSnapshot }) {
  const router = useRouter()
  const { clear } = useGameStore()
  const session = useRunSession(snapshot.game, snapshot.token)

  if (session.phase === 'result' && session.result) {
    return (
      <ResultPanel snapshot={snapshot} events={session.eventsRef.current} result={session.result} />
    )
  }
  if (session.phase === 'pending') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="font-display text-xl font-800">Saved offline</p>
        <p className="max-w-xs text-sm leading-6 text-ghost-muted">
          Connection dropped after your attempt was spent. The run is stored on this device and
          will count once it reaches the server — no new ranked run until then.
        </p>
        <button
          type="button"
          onClick={() => void session.retryPending()}
          className="flex min-h-12 w-full items-center justify-center rounded-control bg-spectral-cyan px-5 font-display text-sm font-800 tracking-[0.14em] text-ink-950"
        >
          RETRY SUBMIT
        </button>
      </div>
    )
  }
  if (session.phase === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="font-display text-xl font-800">Could not submit</p>
        <p className="text-sm text-rival-coral">{session.error ?? 'submit-failed'}</p>
        <button
          type="button"
          onClick={() => {
            clear()
            router.push('/play')
          }}
          className="flex min-h-12 w-full items-center justify-center rounded-control border border-white/15 px-5 text-sm font-600"
        >
          BACK TO PREFLIGHT
        </button>
      </div>
    )
  }
  if (!['pulse', 'snap', 'orbit', 'recall', 'shift'].includes(snapshot.game.gameId)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="font-display text-xl font-800">Engine UI lands in Phase 8</p>
        <p className="max-w-xs text-sm leading-6 text-ghost-muted">
          {snapshot.game.gameId.toUpperCase()} scoring already works on the server — the playable
          renderer ships with the remaining engines.
        </p>
        <button
          type="button"
          onClick={() => {
            clear()
            router.push('/')
          }}
          className="flex min-h-12 w-full items-center justify-center rounded-control border border-white/15 px-5 text-sm font-600"
        >
          BACK TO TODAY
        </button>
      </div>
    )
  }
  return (
    <div className="relative flex flex-1 flex-col">
      {snapshot.game.gameId === 'pulse' ? (
        <PulseRunner game={snapshot.game} session={session} />
      ) : snapshot.game.gameId === 'snap' ? (
        <SnapRunner game={snapshot.game} session={session} />
      ) : snapshot.game.gameId === 'orbit' ? (
        <OrbitRunner
          game={snapshot.game}
          session={session}
          rivalScore={snapshot.challenge ? snapshot.challenge.targetScore : null}
        />
      ) : snapshot.game.gameId === 'recall' ? (
        <RecallRunner
          game={snapshot.game}
          session={session}
          rivalScore={snapshot.challenge ? snapshot.challenge.targetScore : null}
        />
      ) : (
        <ShiftRunner
          game={snapshot.game}
          session={session}
          rivalScore={snapshot.challenge ? snapshot.challenge.targetScore : null}
        />
      )}
      {(session.phase === 'countdown' || session.phase === 'finishing') && (
        <CountOverlay count={session.phase === 'finishing' ? 0 : session.count} reduced={session.reduced} />
      )}
      {session.phase === 'submitting' && <BusyOverlay label="Validating on server…" />}
    </div>
  )
}

export function RunClient() {
  const router = useRouter()
  const snapshot = useGameStore((s) => s.snapshot)
  const setSnapshot = useGameStore((s) => s.setSnapshot)
  useEffect(() => {
    const hydrate = () => {
      const stored = loadSnapshotFromStorage()
      if (stored) setSnapshot(stored)
      else router.replace('/play')
    }
    hydrate()
  }, [router, setSnapshot])
  if (!snapshot) return null
  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-4 sm:max-w-2xl">
        <div className="flex items-center justify-between py-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-spectral-cyan">
            {snapshot.game.gameId} · ranked
          </p>
          <Link href="/" className="text-xs text-ghost-muted">
            Quit
          </Link>
        </div>
        <RunActive snapshot={snapshot} />
      </div>
    </div>
  )
}
