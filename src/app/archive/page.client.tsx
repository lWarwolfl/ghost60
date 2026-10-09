'use client'

import Link from 'next/link'
import { useArchive } from '@/features/game/queries/useArchive.query'

export function ArchiveClient() {
  const { data, isLoading, isError } = useArchive()
  if (isLoading) return <p className="text-sm text-ghost-muted">Loading archive…</p>
  if (isError || !data) return <p className="text-sm text-rival-coral">Could not load archive.</p>
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Recent days" className="rounded-card border border-white/10 bg-surface-800 p-5">
        <h2 className="font-display text-lg font-800">Last 7 days</h2>
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
                <span title={d.completed ? 'Ranked run completed' : 'No ranked run'} aria-label={d.completed ? 'Completed' : 'Not completed'}>
                  {d.completed ? '●' : '○'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.lockedOlder > 0 && (
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
