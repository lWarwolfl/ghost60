'use client'

import Link from 'next/link'
import { useArchivePages } from '@/features/game/queries/useArchive.query'
import { useCreateSession } from '@/features/game/mutations/useCreateSession.mutation'
import { useCreateChallenge } from '@/features/game/mutations/useCreateChallenge.mutation'
import { useGameStore } from '@/features/game/store/game-store'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ShareButtons } from '@/components/results/share-buttons'
import { audio } from '@/lib/game/audio'

export function ArchiveClient() {
  const archive = useArchivePages()
  const { isLoading, isError } = archive
  const data = archive.data ? { ...archive.data.pages[0], days: archive.data.pages.flatMap((page) => page.days) } : undefined
  const create = useCreateSession()
  const challenge = useCreateChallenge()
  const router = useRouter()
  const setSnapshot = useGameStore((state) => state.setSnapshot)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const start = async (dailyGameId: string, sourceRunId?: string) => {
    setError(null)
    audio.unlock()
    try {
      setSnapshot(await create.mutateAsync(sourceRunId ? { mode: 'past_self', sourceRunId } : { mode: 'practice', dailyGameId }))
      router.push('/play/run')
    } catch (error) { setError(error instanceof Error ? error.message : 'session-failed') }
  }
  const share = async (runId: string) => {
    setError(null)
    try { setUrl((await challenge.mutateAsync(runId)).url) }
    catch (error) { setError(error instanceof Error ? error.message : 'challenge-failed') }
  }
  if (isLoading) return <p className="text-sm text-ghost-muted">Loading archive…</p>
  if (isError || !data) return <p className="text-sm text-rival-coral">Could not load archive.</p>
  return (
    <div className="flex flex-col gap-4">
      <Link href="/archive/history" className="min-h-11 underline">Performance history and skill charts</Link>
      {error && <p role="alert">{error}</p>}
      {url && <ShareButtons url={url} title="Ghost60 archive challenge" text="Race my ghost." />}
      <section aria-label="Recent days" className="rounded-card border border-white/10 bg-surface-800 p-5">
        <h2 className="font-display text-lg font-800">{data.locked ? 'Last 7 days' : 'Daily archive'}</h2>
        {data.days.length === 0 ? (
          <p className="mt-2 text-sm text-ghost-muted">No games yet — check back after reset.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {data.days.map((d) => (
              <li
                key={d.gameDate}
                className="tnum flex items-center justify-between gap-3 rounded-control border border-white/10 bg-ink-900 px-4 py-2.5 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-600">{d.title}</span>
                  <span className="block text-xs text-ghost-muted">
                    {d.gameDate} · {d.gameId}
                  </span>
                </span>
                {!data.locked && <div className="flex flex-wrap gap-2">
                  <button disabled={create.isPending} onClick={() => void start(d.id)} className="min-h-11 underline">Practice</button>
                  {d.sourceRunId && <>
                    <button disabled={create.isPending} onClick={() => void start(d.id, d.sourceRunId!)} className="min-h-11 underline">Race past self</button>
                    <button disabled={challenge.isPending} onClick={() => void share(d.sourceRunId!)} className="min-h-11 underline">Challenge a friend</button>
                  </>}
                </div>}
                <span title={d.completed ? 'Ranked run completed' : 'No ranked run'} aria-label={d.completed ? 'Completed' : 'Not completed'}>
                  {d.completed ? '●' : '○'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {archive.hasNextPage && <button disabled={archive.isFetchingNextPage} onClick={() => void archive.fetchNextPage()} className="min-h-11 underline">Load older days</button>}
      {data.locked && data.lockedOlder > 0 && (
        <section aria-label="Locked history" className="rounded-card border border-dashed border-white/20 bg-ink-900 p-5 text-center">
          <p className="font-600">{data.lockedOlder} older days</p>
          <p className="mt-1 text-sm text-ghost-muted">
            Past ghosts, full history and archive races unlock with Ghost+.
          </p>
          <Link
            href="/ghost-plus"
            className="mt-3 flex min-h-11 items-center justify-center rounded-control border border-spectral-violet/50 px-4 text-sm font-600 text-spectral-violet"
          >
            See Ghost+
          </Link>
        </section>
      )}
    </div>
  )
}
