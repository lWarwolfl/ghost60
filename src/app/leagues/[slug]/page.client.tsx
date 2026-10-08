'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ShareButtons } from '@/components/results/share-buttons'
import {
  useJoinLeague,
  useLeaveLeague,
  useRenameLeague
} from '@/features/game/mutations/useLeague.mutation'
import { useLeague } from '@/features/game/queries/useLeague.query'

function rivalryLabel(outcome: string) {
  if (outcome === 'win') return 'W'
  if (outcome === 'loss') return 'L'
  if (outcome === 'tie') return 'T'
  return '•'
}

export function LeagueDetailClient({ slug }: { slug: string }) {
  const { data, isLoading, isError } = useLeague(slug)
  const join = useJoinLeague(slug)
  const leave = useLeaveLeague(slug)
  const rename = useRenameLeague(slug)
  const router = useRouter()
  const [name, setName] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isLoading) return <p className="text-sm text-ghost-muted">Loading standings…</p>
  if (isError || !data) return <p className="text-sm text-rival-coral">League not found.</p>

  const onJoin = async () => {
    setError(null)
    try {
      await join.mutateAsync()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onLeave = async () => {
    if (!confirmLeave) {
      setConfirmLeave(true)
      return
    }
    setError(null)
    try {
      await leave.mutateAsync()
      router.push('/leagues')
    } catch (err) {
      setError((err as Error).message)
      setConfirmLeave(false)
    }
  }

  const onRename = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await rename.mutateAsync(name.trim())
      setName('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="League header"
        className="rounded-card border border-white/10 bg-surface-800 p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-2xl font-800">{data.name}</h2>
            <p className="tnum mt-1 text-xs text-ghost-muted">
              Week {data.week.start} → {data.week.end} · {data.memberCount}/12 members
            </p>
          </div>
          {data.isOwner && (
            <span className="shrink-0 rounded-control bg-spectral-violet/15 px-2.5 py-1 text-xs font-600 text-spectral-violet">
              owner
            </span>
          )}
        </div>
        {!data.isMember && (
          <button
            type="button"
            onClick={() => void onJoin()}
            disabled={join.isPending}
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-control bg-spectral-cyan px-4 text-sm font-600 text-ink-950 disabled:opacity-40"
          >
            {join.isPending ? 'Joining…' : 'Join this league'}
          </button>
        )}
      </section>

      <section aria-label="Standings" className="rounded-card border border-white/10 bg-surface-800 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg font-800">Standings</h3>
          <p className="text-xs text-ghost-muted">Best 5 of 7 · max 500 pts</p>
        </div>
        {data.standings.length === 0 ? (
          <p className="mt-2 text-sm text-ghost-muted">No members yet.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {data.standings.map((row, i) => (
              <li
                key={row.handle}
                className="flex items-center gap-3 rounded-control border border-white/10 bg-ink-900 px-3 py-2.5"
              >
                <span
                  className={`tnum w-6 shrink-0 text-center font-display text-sm font-800 ${i === 0 ? 'text-spectral-cyan' : 'text-ghost-muted'}`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-600">
                    {row.handle}
                    {row.isOwner && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-spectral-violet">owner</span>}
                  </span>
                  <span className="tnum flex items-center gap-2 text-xs text-ghost-muted">
                    <span title="Days played this week">
                      {row.daysPlayed}/7d
                    </span>
                    <span title={row.todayCompleted ? 'Completed today' : 'Not completed today'}>
                      {row.todayCompleted ? '● today' : '○ today'}
                    </span>
                    <span title="Current streak">🔥{row.streak}</span>
                    {row.latestRivalry && (
                      <span
                        title={`Latest rivalry: ${row.latestRivalry.outcome}`}
                        className="rounded-control border border-white/10 px-1.5"
                      >
                        {rivalryLabel(row.latestRivalry.outcome)}
                      </span>
                    )}
                  </span>
                </span>
                <span className="tnum shrink-0 text-right">
                  <span className="block font-display text-lg font-800">{Math.round(row.total)}</span>
                  <span className="block text-[10px] uppercase tracking-wider text-ghost-muted">pts</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-xs leading-5 text-ghost-muted">
          Daily points are 0–100 percentiles vs everyone who played that day. Raw scores never
          compare across different games.
        </p>
      </section>

      {data.isMember && (
        <section aria-label="Invite" className="rounded-card border border-white/10 bg-ink-900 p-5">
          <h3 className="font-display text-lg font-800">Invite friends</h3>
          <p className="mt-1 text-sm text-ghost-muted">
            Share this league link. It carries no emails or user IDs — just the invite.
          </p>
          <div className="mt-3">
            <ShareButtons url={data.url} title={`${data.name} on Ghost60`} text={`Join my Ghost60 league: ${data.name}`} />
          </div>
        </section>
      )}

      {data.isOwner && (
        <section aria-label="Rename" className="rounded-card border border-white/10 bg-surface-800 p-5">
          <h3 className="font-display text-lg font-800">Rename league</h3>
          <form onSubmit={(e) => void onRename(e)} className="mt-3 flex flex-col gap-2">
            <label htmlFor="rename" className="sr-only">
              New league name
            </label>
            <input
              id="rename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={data.name}
              maxLength={40}
              autoComplete="off"
              className="min-h-11 rounded-control border border-white/15 bg-ink-900 px-4 text-sm text-ghost-text placeholder:text-ghost-muted/60 focus:border-spectral-cyan/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={rename.isPending || name.trim().length < 3}
              className="flex min-h-11 items-center justify-center rounded-control border border-white/15 px-4 text-sm font-600 disabled:opacity-40"
            >
              {rename.isPending ? 'Saving…' : 'Save name'}
            </button>
          </form>
        </section>
      )}

      {data.isMember && (
        <section aria-label="Leave" className="rounded-card border border-white/10 bg-surface-800 p-5">
          <button
            type="button"
            onClick={() => void onLeave()}
            disabled={leave.isPending}
            className="flex min-h-11 w-full items-center justify-center rounded-control border border-rival-coral/50 px-4 text-sm font-600 text-rival-coral disabled:opacity-40"
          >
            {leave.isPending ? 'Leaving…' : confirmLeave ? 'Tap again to confirm leaving' : data.isOwner ? 'Leave + transfer ownership' : 'Leave league'}
          </button>
          <Link href="/leagues" className="mt-2 block text-center text-xs text-ghost-muted">
            ← All leagues
          </Link>
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-rival-coral">
          {error}
        </p>
      )}
    </div>
  )
}
