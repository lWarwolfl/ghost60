'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useCreateLeague } from '@/features/game/mutations/useLeague.mutation'
import { useMyLeagues } from '@/features/game/queries/useMyLeagues.query'

const ERROR_COPY: Record<string, string> = {
  'league-create-limit': 'Free plan: you can create 1 league. Ghost+ raises it to 5.',
  'league-join-limit': 'Free plan: you can join up to 3 leagues. Ghost+ raises it to 10.',
  'invalid-name': 'League name needs 3–40 characters, no control characters.',
  'reserved-name': 'That name is reserved. Pick another.',
  'league-full': 'That league is full (12 members).',
  'not-found': 'No league with that invite code.',
  'league-blocked': 'You cannot join that league.'
}

export function LeaguesClient() {
  const { data, isLoading, isError } = useMyLeagues()
  const create = useCreateLeague()
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    try {
      const out = await create.mutateAsync(name.trim())
      setName('')
      router.push(out.url)
    } catch (err) {
      setCreateError(ERROR_COPY[(err as Error).message] ?? 'Could not create league.')
    }
  }

  const submitJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoinError(null)
    const code = slug.trim().split('/').pop() ?? ''
    if (!code) {
      setJoinError('Paste an invite code or link.')
      return
    }
    try {
      const res = await fetch(`/api/leagues/${code}/join`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'join-failed')
      router.push(`/leagues/${code}`)
    } catch (err) {
      setJoinError(ERROR_COPY[(err as Error).message] ?? 'Could not join league.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Your leagues"
        className="rounded-card border border-white/10 bg-surface-800 p-5"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-800">Your leagues</h2>
          <p className="tnum text-xs text-ghost-muted">{data?.leagues.length ?? 0} joined</p>
        </div>
        {isLoading ? (
          <p className="mt-2 text-sm text-ghost-muted">Loading leagues…</p>
        ) : isError ? (
          <p className="mt-2 text-sm text-rival-coral">Could not load leagues.</p>
        ) : data && data.leagues.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {data.leagues.map((l) => (
              <li key={l.slug}>
                <Link
                  href={l.url}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-control border border-white/10 bg-ink-900 px-4 py-2.5 transition-colors hover:border-spectral-cyan/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-600">{l.name}</span>
                    <span className="tnum block text-xs text-ghost-muted">
                      {l.memberCount}/12 members{l.isOwner ? ' · owner' : ''}
                    </span>
                  </span>
                  <span aria-hidden className="shrink-0 text-spectral-cyan">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 rounded-control border border-dashed border-white/20 bg-ink-900 p-4 text-center">
            <p className="font-600">No league yet</p>
            <p className="mt-1 text-sm leading-6 text-ghost-muted">
              Create one league free, join up to 3, max 12 members. Weekly score is best 5 of 7
              normalized days — never raw cross-engine scores.
            </p>
          </div>
        )}
      </section>

      <section
        aria-label="Create a league"
        className="rounded-card border border-white/10 bg-surface-800 p-5"
      >
        <h2 className="font-display text-lg font-800">Create a league</h2>
        <p className="mt-1 text-sm text-ghost-muted">Free: create 1 · Ghost+: create up to 5.</p>
        <form onSubmit={(e) => void submitCreate(e)} className="mt-3 flex flex-col gap-2">
          <label htmlFor="league-name" className="sr-only">
            League name
          </label>
          <input
            id="league-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Night Owls"
            maxLength={40}
            autoComplete="off"
            className="min-h-11 rounded-control border border-white/15 bg-ink-900 px-4 text-sm text-ghost-text placeholder:text-ghost-muted/60 focus:border-spectral-cyan/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={create.isPending || name.trim().length < 3}
            className="flex min-h-11 items-center justify-center rounded-control bg-spectral-cyan px-4 text-sm font-600 text-ink-950 disabled:opacity-40"
          >
            {create.isPending ? 'Creating…' : 'Create league'}
          </button>
          {createError && (
            <p role="alert" className="text-sm text-rival-coral">
              {createError}
            </p>
          )}
        </form>
      </section>

      <section
        aria-label="Join with invite"
        className="rounded-card border border-white/10 bg-ink-900 p-5"
      >
        <h2 className="font-display text-lg font-800">Join with invite</h2>
        <p className="mt-1 text-sm text-ghost-muted">
          Paste an invite code or full link. Invites never expose emails or user IDs.
        </p>
        <form onSubmit={(e) => void submitJoin(e)} className="mt-3 flex flex-col gap-2">
          <label htmlFor="league-slug" className="sr-only">
            Invite code
          </label>
          <input
            id="league-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Invite code or link"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="tnum min-h-11 rounded-control border border-white/15 bg-surface-800 px-4 text-sm text-ghost-text placeholder:text-ghost-muted/60 focus:border-spectral-cyan/60 focus:outline-none"
          />
          <button
            type="submit"
            className="flex min-h-11 items-center justify-center rounded-control border border-spectral-cyan/50 px-4 text-sm font-600 text-spectral-cyan"
          >
            Join league
          </button>
          {joinError && (
            <p role="alert" className="text-sm text-rival-coral">
              {joinError}
            </p>
          )}
        </form>
      </section>

      <details className="rounded-card border border-white/10 bg-surface-800 px-5 py-4">
        <summary className="cursor-pointer text-sm font-600 text-spectral-cyan">
          How does best-5-of-7 work?
        </summary>
        <p className="mt-2 text-sm leading-6 text-ghost-muted">
          Each day your ranked score is converted to 0–100 percentile points against everyone who
          played that day — never raw points across different games. Your weekly total is the sum of
          your best 5 days (max 500). Ties break on days played, then handle.
        </p>
      </details>
    </div>
  )
}
