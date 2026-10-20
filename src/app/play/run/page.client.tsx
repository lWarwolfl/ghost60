'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { GhostAvatar } from '@/components/brand/ghost-avatar'
import { GhostRace } from '@/components/game/ghost-race'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion.hook'
import { ShareButtons } from '@/components/results/share-buttons'
import { SkinCardFrame } from '@/components/game/skin-card-frame'
import { useProfile } from '@/features/game/queries/useProfile.query'
import { resolveSkin } from '@/lib/game/skins'
import { TrackView } from '@/components/analytics/track-view'
import { useCreateSession } from '@/features/game/mutations/useCreateSession.mutation'
import { audio } from '@/lib/game/audio'
import { useCreateChallenge } from '@/features/game/mutations/useCreateChallenge.mutation'
import { useRunSession, type TRunResult } from '@/features/game/hooks/useRunSession.hook'
import {
  useGameStore,
  loadSnapshotFromStorage,
  type TGameSnapshot,
} from '@/features/game/store/game-store'
import type { GameInputEvent } from '@/games/core/game-module'
import { getGame } from '@/games/registry'

const PulseRunner = dynamic(
  () => import('@/components/game/pulse-runner').then((m) => m.PulseRunner),
  {
    ssr: false,
    loading: () => (
      <p className="text-ghost-muted py-8 text-center text-sm">Warming up the field…</p>
    ),
  }
)
const SnapRunner = dynamic(
  () => import('@/components/game/snap-runner').then((m) => m.SnapRunner),
  {
    ssr: false,
    loading: () => <p className="text-ghost-muted py-8 text-center text-sm">Shuffling shapes…</p>,
  }
)
const OrbitRunner = dynamic(
  () => import('@/components/game/orbit-runner').then((m) => m.OrbitRunner),
  {
    ssr: false,
    loading: () => (
      <p className="text-ghost-muted py-8 text-center text-sm">Spinning up the ring…</p>
    ),
  }
)
const RecallRunner = dynamic(
  () => import('@/components/game/recall-runner').then((m) => m.RecallRunner),
  {
    ssr: false,
    loading: () => <p className="text-ghost-muted py-8 text-center text-sm">Dealing the grid…</p>,
  }
)
const ShiftRunner = dynamic(() =>
  import('@/components/game/shift-runner').then((m) => m.ShiftRunner)
)
const TraceRunner = dynamic(
  () => import('@/components/game/trace-runner').then((m) => m.TraceRunner),
  {
    ssr: false,
    loading: () => (
      <p className="text-ghost-muted py-8 text-center text-sm">Laying the corridor…</p>
    ),
  }
)

function CountOverlay({ count, reduced }: { count: number; reduced: boolean }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-live="polite"
    >
      <span
        className={`font-display font-800 text-ghost-text text-7xl ${reduced ? '' : 'animate-reveal'}`}
        key={count}
      >
        {count === 0 ? 'GO' : count}
      </span>
    </div>
  )
}

function ResultPanel({
  snapshot,
  events,
  result,
}: {
  snapshot: TGameSnapshot
  events: GameInputEvent[]
  result: TRunResult
}) {
  const router = useRouter()
  const { clear } = useGameStore()
  const createChallenge = useCreateChallenge()
  const createSession = useCreateSession()
  const setSnapshot = useGameStore((state) => state.setSnapshot)
  const nextPractice = async () => {
    const [dailyGameId, ...playlist] = snapshot.playlist ?? []
    if (!dailyGameId) return
    setChallengeError(null)
    audio.unlock()
    try {
      const next = await createSession.mutateAsync({ mode: 'practice', dailyGameId })
      setSnapshot({ ...next, playlist })
    } catch {
      setChallengeError('Couldn’t open the next game. Try again.')
    }
  }
  const { data: profile } = useProfile()
  const cardSkin = resolveSkin(profile?.cosmetics.equipped.card, profile?.plan)
  const [sharedUrl, setSharedUrl] = useState<string | null>(null)
  const [challengeError, setChallengeError] = useState<string | null>(null)
  const scoreDisplay = useRef<HTMLParagraphElement>(null)
  const { game, challenge } = snapshot
  const score = result.score
  const viewProps = {
    game: game.gameId,
    outcome: result.outcome ?? 'none',
    personalBest: result.isPersonalBest,
    challenge: Boolean(challenge),
  }
  const reduced = useReducedMotion()
  let metricsLine = ''
  try {
    const mod = getGame(game.gameId)
    const local = mod.scoreRun({
      seed: game.seed,
      config: mod.validateConfig(game.config) as never,
      events,
      visibilityInterruptions: 0,
    })
    metricsLine = Object.entries(local.metrics)
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ')
  } catch {
    metricsLine = ''
  }
  useEffect(() => {
    const node = scoreDisplay.current
    if (!node) return
    node.textContent = String(score)
    if (reduced || document.hidden) return
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0 - 100) / 420))
      node.textContent = String(Math.round(score * (0.7 + 0.3 * p)))
      if (p < 1 && !document.hidden) raf = requestAnimationFrame(step)
      else node.textContent = String(score)
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
    } catch {
      setChallengeError('Couldn’t create the challenge. Try again.')
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
    <SkinCardFrame
      skin={cardSkin}
      className="animate-reveal flex flex-1 flex-col items-center justify-center gap-4 p-5 text-center"
    >
      <TrackView name="result_viewed" props={viewProps} />
      {challenge ? (
        <>
          <p className="text-spectral-violet text-[11px] tracking-[0.18em] uppercase">
            vs {challenge.handle} · {challenge.targetScore}
          </p>
          <p
            className={`font-display font-800 text-4xl ${result.outcome === 'win' ? 'text-signal-lime' : result.outcome === 'loss' ? 'text-spectral-violet' : ''}`}
          >
            {outcomeTitle}
          </p>
        </>
      ) : (
        <p className="text-spectral-cyan text-[11px] tracking-[0.18em] uppercase" role="status">
          Run complete
        </p>
      )}
      <GhostAvatar
        skin={profile?.cosmetics.equipped.ghost ?? undefined}
        motion={
          result.outcome === 'win' || result.isPersonalBest || result.isLocalBest
            ? 'win'
            : result.outcome === 'loss'
              ? 'loss'
              : 'idle'
        }
        className="size-16"
      />
      <p
        ref={scoreDisplay}
        aria-label={`Score ${score}`}
        className="tnum font-display font-800 text-6xl"
      >
        {score}
      </p>
      {result.isPersonalBest ? (
        <p className="rounded-control border-signal-lime/60 font-display font-800 text-signal-lime border px-3 py-1 text-xs tracking-[0.18em]">
          NEW PERSONAL BEST
        </p>
      ) : null}
      {!result.valid && <p className="text-ghost-muted text-xs">This run didn’t count.</p>}
      {result.xpAwarded > 0 && (
        <p className="tnum text-ghost-muted text-xs">+{result.xpAwarded} XP</p>
      )}
      {challenge && (
        <p className="tnum text-ghost-muted text-sm">
          {delta > 0 ? `+${delta}` : `${delta}`} against {challenge.targetScore}
        </p>
      )}
      {Boolean(snapshot.playlist?.length) && (
        <button
          type="button"
          disabled={createSession.isPending}
          onClick={() => void nextPractice()}
          className="rounded-control bg-spectral-violet font-600 text-ink-950 min-h-12 w-full px-4"
        >
          NEXT PLAYLIST GAME · {snapshot.playlist!.length} LEFT
        </button>
      )}
      {metricsLine && <p className="text-ghost-muted text-xs">{metricsLine}</p>}
      <button
        type="button"
        onClick={() => leave('/play')}
        className="rounded-control font-600 flex min-h-12 w-full items-center justify-center border border-white/15 px-5 text-sm"
      >
        PLAY AGAIN
      </button>
      {challengeError && (
        <p role="alert" className="text-rival-coral text-xs">
          {challengeError}
        </p>
      )}
      {sharedUrl ? (
        <div className="w-full">
          <ShareButtons
            url={sharedUrl}
            title="Ghost60 challenge"
            text={
              challenge ? `I just raced ${challenge.handle}'s ghost. Revenge?` : 'Race my ghost.'
            }
          />
        </div>
      ) : (
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => void makeChallenge()}
            disabled={createChallenge.isPending || result.provisional}
            className="rounded-control bg-spectral-cyan font-display font-800 text-ink-950 flex min-h-12 items-center justify-center px-5 text-sm tracking-[0.14em] disabled:opacity-50"
          >
            {createChallenge.isPending
              ? 'WORKING…'
              : challenge
                ? 'SEND REVENGE'
                : 'RACE MY GHOST'}
          </button>
          <button
            type="button"
            onClick={() => leave('/')}
            className="rounded-control font-600 flex min-h-12 items-center justify-center border border-white/15 px-5 text-sm"
          >
            BACK TO TODAY
          </button>
        </div>
      )}
    </SkinCardFrame>
  )
}

function RunActive({ snapshot }: { snapshot: TGameSnapshot }) {
  const router = useRouter()
  const { clear } = useGameStore()
  const [runnerReady, setRunnerReady] = useState(false)
  const session = useRunSession(snapshot.game, snapshot.token, runnerReady)

  useEffect(() => {
    const fallback = setTimeout(() => setRunnerReady(true), 6000)
    return () => clearTimeout(fallback)
  }, [])

  if (session.phase === 'result' && session.result) {
    return (
      <ResultPanel
        snapshot={snapshot}
        events={session.eventsRef.current}
        result={session.result}
      />
    )
  }
  if (session.phase === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="font-display font-800 text-xl">This run is closed</p>
        <p className="text-ghost-muted max-w-xs text-sm">
          It was already started on this device. Start a fresh run from the field.
        </p>
        <button
          type="button"
          onClick={() => {
            clear()
            router.push('/play')
          }}
          className="rounded-control font-600 flex min-h-12 w-full items-center justify-center border border-white/15 px-5 text-sm"
        >
          BACK TO PREFLIGHT
        </button>
      </div>
    )
  }
  if (!['pulse', 'snap', 'orbit', 'recall', 'shift', 'trace'].includes(snapshot.game.gameId)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="font-display font-800 text-xl">Engine UI lands in Phase 8</p>
        <p className="text-ghost-muted max-w-xs text-sm leading-6">
          {snapshot.game.gameId.toUpperCase()} scoring already works on the server — the playable
          renderer ships with the remaining engines.
        </p>
        <button
          type="button"
          onClick={() => {
            clear()
            router.push('/')
          }}
          className="rounded-control font-600 flex min-h-12 w-full items-center justify-center border border-white/15 px-5 text-sm"
        >
          BACK TO TODAY
        </button>
      </div>
    )
  }
  return (
    <div className="relative flex flex-1 flex-col">
      <GhostRace session={session} ghost={snapshot.ghost} />
      {snapshot.game.gameId === 'pulse' ? (
        <PulseRunner game={snapshot.game} session={session} onReady={() => setRunnerReady(true)} />
      ) : snapshot.game.gameId === 'snap' ? (
        <SnapRunner game={snapshot.game} session={session} onReady={() => setRunnerReady(true)} />
      ) : snapshot.game.gameId === 'orbit' ? (
        <OrbitRunner
          game={snapshot.game}
          session={session}
          onReady={() => setRunnerReady(true)}
          rivalScore={snapshot.challenge ? snapshot.challenge.targetScore : null}
        />
      ) : snapshot.game.gameId === 'recall' ? (
        <RecallRunner
          game={snapshot.game}
          session={session}
          onReady={() => setRunnerReady(true)}
          rivalScore={snapshot.challenge ? snapshot.challenge.targetScore : null}
        />
      ) : snapshot.game.gameId === 'shift' ? (
        <ShiftRunner
          game={snapshot.game}
          session={session}
          onReady={() => setRunnerReady(true)}
          rivalScore={snapshot.challenge ? snapshot.challenge.targetScore : null}
        />
      ) : (
        <TraceRunner
          game={snapshot.game}
          session={session}
          onReady={() => setRunnerReady(true)}
          rivalScore={snapshot.challenge ? snapshot.challenge.targetScore : null}
        />
      )}
      {session.countVisible && (session.phase === 'countdown' || session.phase === 'running') && (
        <CountOverlay count={session.count} reduced={session.reduced} />
      )}
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
    <div className="bg-ink-950 text-ghost-text flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-4 sm:max-w-2xl">
        <div className="flex items-center justify-between py-2">
          <p className="text-spectral-cyan text-[11px] tracking-[0.18em] uppercase">
            {snapshot.game.gameId} · {snapshot.mode ?? (snapshot.challenge ? 'challenge' : 'run')}
          </p>
          <Link href="/" className="text-ghost-muted text-xs">
            Quit
          </Link>
        </div>
        <RunActive key={snapshot.token} snapshot={snapshot} />
      </div>
    </div>
  )
}
