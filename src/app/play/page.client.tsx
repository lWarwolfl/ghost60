'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { GameIcon } from '@/components/brand/game-icon'
import { TrackView } from '@/components/analytics/track-view'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useCreateSession } from '@/features/game/mutations/useCreateSession.mutation'
import { useTodayGame } from '@/features/game/queries/useTodayGame.query'
import { useCharges } from '@/features/game/queries/useCharges.query'
import { useGameStore } from '@/features/game/store/game-store'
import { track } from '@/lib/analytics/track'
import { audio } from '@/lib/game/audio'
import { getErrorMessage } from '@/lib/utils'
import { authClient } from '@/lib/auth/client'

export function PreflightClient() {
  const router = useRouter()
  const { data: today, isLoading, isError, error, refetch } = useTodayGame()
  const charges = useCharges()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const create = useCreateSession()
  const setSnapshot = useGameStore((s) => s.setSnapshot)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    router.prefetch('/play/run')
  }, [router])

  const canPlay = Boolean(session?.user && charges.data && !charges.isError && !isError && !create.isPending)
  const hasCharge = charges.data?.remaining === null || (charges.data?.remaining ?? 0) > 0

  const play = async (mode: 'ranked' | 'practice') => {
    setFailed(null)
    audio.unlock()
    track('play_cta_clicked', { game: today?.gameId ?? 'unknown' })
    try {
      const snapshot = await create.mutateAsync({ mode })
      setSnapshot(snapshot)
      router.push('/play/run')
    } catch (e) {
      setFailed(getErrorMessage(e))
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
        {isLoading && <p className="text-sm text-ghost-muted">Loading today&apos;s game…</p>}
        {isError && (
          <div className="rounded-card border border-rival-coral/40 bg-ink-900 p-5 text-sm">
            <p role="alert">{error.message}</p>
            <button type="button" onClick={() => void refetch()} className="min-h-11 underline">Retry today’s game</button>
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
                <li>Free players get five combined ranked and practice charges per UTC day. A charge is reserved when you open a run.</li>
                <li>One ranked attempt. Consumed on first input or 3s after start.</li>
                <li>Closing or reloading after consumption still spends the attempt.</li>
                <li>Score is decided by server replay, not your screen.</li>
                <li>Practice is unranked. Ghost+ has unlimited practice. Challenge races are free.</li>
                <li>Sound off by default. Reduced-motion respected. 44px targets.</li>
              </ul>
            </div>
            <div className="rounded-card border border-white/10 bg-surface-800 p-4 text-sm" aria-live="polite">
              {charges.data && !charges.isError ? (
                <>
                  <p>{charges.data.remaining === null ? 'Unlimited practice' : `${charges.data.remaining} of ${charges.data.limit} daily charges remaining`}</p>
                  <p className="mt-1 text-ghost-muted">{charges.data.rankedAvailable ? 'One ranked attempt available.' : 'Ranked attempt spent. Keep playing in practice.'}</p>
                  <p className="mt-1 text-ghost-muted">Charges reset at 00:00 UTC.</p>
                </>
              ) : charges.isError ? (
                <>
                  <p role="alert">{charges.error.message}</p>
                  <button type="button" onClick={() => void charges.refetch()} className="min-h-11 underline">Retry daily charges</button>
                </>
              ) : <p>{sessionPending || session?.user ? 'Loading daily charges…' : 'Connecting your player session…'}</p>}
            </div>
            {(failed ?? create.error) && (
              <p role="alert" className="rounded-card border border-rival-coral/40 bg-ink-900 px-4 py-3 text-sm text-rival-coral">
                {failed ?? (create.error instanceof Error ? create.error.message : 'session-failed')}
              </p>
            )}
            <button
              type="button"
              onClick={() => void play('ranked')}
              disabled={!canPlay || !hasCharge || !charges.data?.rankedAvailable}
              className="flex min-h-12 items-center justify-center rounded-control bg-spectral-cyan px-5 font-display text-sm font-800 tracking-[0.14em] text-ink-950 disabled:opacity-50"
            >
              {create.isPending ? 'OPENING…' : 'START RANKED RUN'}
            </button>
            <button
              type="button"
              onClick={() => void play('practice')}
              disabled={!canPlay || !hasCharge}
              className="flex min-h-12 items-center justify-center rounded-control border border-spectral-violet/50 px-5 font-display text-sm font-800 tracking-[0.14em] text-spectral-violet disabled:opacity-50"
            >
              {create.isPending ? 'OPENING…' : 'START PRACTICE RUN'}
            </button>
            {charges.data?.remaining === 0 && <Link href="/ghost-plus" className="min-h-11 text-sm text-spectral-violet underline">Get unlimited practice with Ghost+</Link>}
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
