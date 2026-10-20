'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { GhostReplay } from '@/components/game/ghost-replay'
import { Footer } from '@/components/layout/footer'
import type { SanitizedGhost, GameInputEvent } from '@/games/core/game-module'
import type { TPublicGame } from '@/features/game/store/game-store'

type TReplay = {
  run: { id: string; score: number; mode: string; createdAt: string }
  game: TPublicGame
  events: GameInputEvent[]
  ghost: SanitizedGhost
}

export function ReplayClient({ runId }: { runId: string }) {
  const query = useQuery<TReplay>({
    queryKey: ['run-replay', runId],
    queryFn: async () => {
      const res = await fetch(`/api/archive/replay?runId=${encodeURIComponent(runId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('replay-unavailable')
      return res.json()
    },
    retry: 1
  })

  return (
    <div className="bg-ink-950 text-ghost-text flex min-h-dvh flex-col">
      
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8 sm:max-w-2xl">
        <Link href="/archive" className="text-ghost-muted min-h-11 text-sm underline">
          ← Back to archive
        </Link>
        {query.isLoading && <p className="text-ghost-muted text-sm">Loading your ghost…</p>}
        {query.isError && (
          <div className="rounded-card border border-white/10 bg-surface-800 p-5">
            <p className="font-display text-lg font-800">This ghost is resting</p>
            <p className="text-ghost-muted mt-1 text-sm">The replay could not be loaded. Try another run.</p>
          </div>
        )}
        {query.data && (
          <>
            <div>
              <p className="text-spectral-cyan text-[10px] tracking-[0.18em] uppercase">
                {query.data.game.gameId} · {query.data.run.mode}
              </p>
              <h1 className="font-display mt-1 text-2xl font-800">{query.data.game.title}</h1>
              <p className="text-ghost-muted mt-1 text-sm">
                {new Date(query.data.run.createdAt).toISOString().slice(0, 10)} · final {query.data.run.score}
              </p>
            </div>
            <GhostReplay
              game={query.data.game}
              events={query.data.events}
              ghost={query.data.ghost}
              score={query.data.run.score}
            />
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
