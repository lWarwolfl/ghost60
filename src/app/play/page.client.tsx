'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { GameIcon } from '@/components/brand/game-icon'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { useCreateSession } from '@/features/game/mutations/useCreateSession.mutation'
import { useTodayGame } from '@/features/game/queries/useTodayGame.query'
import { useGameStore } from '@/features/game/store/game-store'
import { audio } from '@/lib/game/audio'
import { getErrorMessage } from '@/lib/utils'

export function PreflightClient() {
  const router = useRouter()
  const { data: today, isLoading, isError } = useTodayGame()
  const create = useCreateSession()
  const setSnapshot = useGameStore((s) => s.setSnapshot)
  const [failed, setFailed] = useState<string | null>(null)

  const play = async () => {
    setFailed(null)
    audio.unlock()
    try {
      const snapshot = await create.mutateAsync({ mode: 'ranked' })
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
            No game is live right now. Come back after the UTC reset.
          </div>
        )}
        {today && (
          <>
            <p className="text-[11px] uppercase tracking-[0.18em] text-spectral-cyan">
              Preflight · {today.gameId} · {Math.round(today.durationMs / 1000)}s
            </p>
            <h1 className="font-display text-3xl font-800">{today.title}</h1>
            <div className="rounded-card border border-white/10 bg-surface-800 p-5">
              <GameIcon game={today.gameId} className="size-12" />
              <p className="mt-3 text-sm leading-6 text-ghost-muted">{today.instruction}</p>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-ghost-muted">
                <li>One ranked attempt. Consumed on first input or 3s after start.</li>
                <li>Closing or reloading after consumption still spends the attempt.</li>
                <li>Score is decided by server replay, not your screen.</li>
                <li>Sound off by default. Reduced-motion respected. 44px targets.</li>
              </ul>
            </div>
            {(failed ?? create.error) && (
              <p role="alert" className="rounded-card border border-rival-coral/40 bg-ink-900 px-4 py-3 text-sm text-rival-coral">
                {failed ?? (create.error instanceof Error ? create.error.message : 'session-failed')}
              </p>
            )}
            <button
              type="button"
              onClick={() => void play()}
              disabled={create.isPending}
              className="flex min-h-12 items-center justify-center rounded-control bg-spectral-cyan px-5 font-display text-sm font-800 tracking-[0.14em] text-ink-950 disabled:opacity-50"
            >
              {create.isPending ? 'OPENING…' : 'START RANKED RUN'}
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
