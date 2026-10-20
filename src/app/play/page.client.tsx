'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { GameIcon } from '@/components/brand/game-icon'
import { TrackView } from '@/components/analytics/track-view'
import { Footer } from '@/components/layout/footer'
import { RunMeter } from '@/components/game/run-meter'
import { useCreateSession } from '@/features/game/mutations/useCreateSession.mutation'
import { useTodayGame } from '@/features/game/queries/useTodayGame.query'
import { useCharges } from '@/features/game/queries/useCharges.query'
import { useGameStore } from '@/features/game/store/game-store'
import { track } from '@/lib/analytics/track'
import { audio } from '@/lib/game/audio'

export function PreflightClient() {
  const router = useRouter()
  const { data: today, isLoading, isError, refetch } = useTodayGame()
  const charges = useCharges()
  const create = useCreateSession()
  const setSnapshot = useGameStore((s) => s.setSnapshot)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    router.prefetch('/play/run')
  }, [router])

  const resume = charges.data?.resumableModes.includes('ranked') ?? false
  const out = charges.data?.remaining === 0 && !resume
  const canPlay = !create.isPending && !out

  const play = async () => {
    setFailed(false)
    audio.unlock()
    track('play_cta_clicked', { game: today?.gameId ?? 'unknown' })
    try {
      const snapshot = await create.mutateAsync({ mode: 'ranked' })
      setSnapshot(snapshot)
      router.push('/play/run')
    } catch (error) {
      if (!(error instanceof Error && error.message === 'charges-empty')) setFailed(true)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
        {isLoading && <p className="text-sm text-ghost-muted">Loading today&apos;s game…</p>}
        {isError && (
          <div className="rounded-card border border-white/10 bg-ink-900 p-5 text-sm">
            <p className="text-ghost-muted">Today&apos;s game took a moment to load.</p>
            <button type="button" onClick={() => void refetch()} className="mt-2 min-h-11 underline">Try again</button>
          </div>
        )}
        {today && !isError && (
          <>
            <TrackView name="daily_game_viewed" props={{ game: today.gameId }} />
            <p className="text-[11px] uppercase tracking-[0.18em] text-spectral-cyan">
              Preflight · {today.gameId} · {Math.round(today.durationMs / 1000)}s
            </p>
            <h1 className="font-display text-3xl font-800">{today.title}</h1>
            <div className="rounded-card border border-white/10 bg-surface-800 p-5">
              <GameIcon game={today.gameId} className="size-12" />
              <p className="mt-3 text-sm leading-6 text-ghost-muted">{today.instruction}</p>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-ghost-muted">
                <li>Free players get five runs per UTC day. Ghost+ is unlimited.</li>
                <li>A run starts after the countdown and counts when you touch the field.</li>
                <li>Reloading or leaving after that point still uses the run.</li>
                <li>The server replays your exact inputs to decide the score.</li>
                <li>Every run races your best ghost on this game.</li>
                <li>Sound off by default. Reduced motion respected. 44px targets.</li>
              </ul>
            </div>
            <div className="rounded-card border border-white/10 bg-surface-800 p-4">
              <RunMeter remaining={charges.data?.remaining} limit={charges.data?.limit} />
              <p className="text-ghost-muted mt-2 text-xs">
                {charges.isError
                  ? 'Charges refresh automatically before your run.'
                  : charges.data?.limit === null
                    ? 'Ghost+ is unlimited. Play as long as you like.'
                    : resume
                      ? 'You have an open run waiting.'
                      : out
                        ? 'You are out of runs until the reset. Ghost+ is unlimited.'
                        : 'Charges reset at 00:00 UTC.'}
              </p>
            </div>
            {out && (
              <Link href="/ghost-plus" className="min-h-11 text-sm text-spectral-violet underline">
                Get unlimited runs with Ghost+
              </Link>
            )}
            {failed && (
              <p role="status" className="text-ghost-muted text-sm">
                Couldn&apos;t open the field. Try again.
              </p>
            )}
            <button
              type="button"
              onClick={() => void play()}
              disabled={!canPlay}
              className="flex min-h-12 items-center justify-center rounded-control bg-spectral-cyan px-5 font-display text-sm font-800 tracking-[0.14em] text-ink-950 disabled:opacity-50"
            >
              {create.isPending ? 'OPENING…' : resume ? 'RESUME RUN' : out ? 'NO RUNS LEFT' : 'START RUN'}
            </button>
          </>
        )}
        <Link
          href="/"
          className="flex min-h-12 items-center justify-center rounded-control bg-surface-700 px-5 text-sm font-600"
        >
          Back to today
        </Link>
      </main>
      <Footer />
    </div>
  )
}
