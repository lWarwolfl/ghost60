'use client'

import Link from 'next/link'
import { useState, useSyncExternalStore } from 'react'
import { GameIcon } from '@/components/brand/game-icon'
import { Ghost60Mark } from '@/components/brand/ghost60-mark'
import { RunMeter } from '@/components/game/run-meter'
import { SpecialGame } from '@/components/game/special-game'
import { useCharges } from '@/features/game/queries/useCharges.query'
import { useTodayGame } from '@/features/game/queries/useTodayGame.query'
import { useLocalProgress } from '@/lib/hooks/useLocalProgress.hook'

const UPDATE = {
  id: '2026-10-20-tuning',
  items: [
    'CLEAN ORBIT accelerates: the dot speeds up and more targets arrive late in the round.',
    'FIRST SIGNAL keeps a fair hit window and speeds up the ring instead.',
    'Footer removed, and archive challenges no longer need Ghost+.'
  ]
}

const UPDATE_SEEN_KEY = 'ghost60:update-seen'

function subscribeUpdate(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

function updateSeen() {
  try {
    return window.localStorage.getItem(UPDATE_SEEN_KEY) === UPDATE.id
  } catch {
    return true
  }
}

function UpdateNotice() {
  const seen = useSyncExternalStore(subscribeUpdate, updateSeen, () => true)
  const [dismissed, setDismissed] = useState(false)
  if (seen || dismissed) return null
  const dismiss = () => {
    try {
      window.localStorage.setItem(UPDATE_SEEN_KEY, UPDATE.id)
    } catch {}
    setDismissed(true)
  }
  return (
    <section
      aria-labelledby="update-title"
      className="rounded-card border-signal-amber/30 bg-signal-amber/10 animate-enter border p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-signal-amber text-[10px] tracking-[0.18em] uppercase">Update</p>
          <h2 id="update-title" className="font-display text-lg font-800">
            WHAT CHANGED
          </h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss update"
          className="text-ghost-muted -m-2 flex size-11 items-center justify-center text-2xl leading-none"
        >
          ×
        </button>
      </div>
      <ul className="text-ghost-muted mt-2 space-y-1 text-xs leading-5">
        {UPDATE.items.map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
    </section>
  )
}

const STEPS = [
  {
    n: '01',
    title: 'See today’s game',
    body: 'Same seed, same config, same duration for everyone. Five runs a day on free.'
  },
  {
    n: '02',
    title: 'Race your ghost',
    body: 'Every run races your best trace from this game. The server replays your input to decide the score.'
  },
  {
    n: '03',
    title: 'Leave a ghost, send it',
    body: 'Your trace becomes a raceable challenge link. Friends play free, no signup wall, revenge included.'
  }
]

export function HomeClient() {
  const { data: today, error, isPending, isError, refetch } = useTodayGame()
  const charges = useCharges()
  const local = useLocalProgress()
  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 sm:max-w-2xl">
        <UpdateNotice />
        <section aria-labelledby="hero" className="flex flex-col gap-5 animate-enter">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <Ghost60Mark motion="ambient" className="size-14 shrink-0" />
              <h1
                id="hero"
                className="font-display text-3xl font-800 leading-[0.95] tracking-tight min-[360px]:text-4xl sm:text-[2.5rem]"
              >
                ONE GAME. FIVE SHOTS.
              </h1>
            </div>
            <p className="max-w-md text-base leading-7 text-ghost-muted">
              Everyone gets the same game. Five runs a day on free, unlimited on Ghost+. Every
              run races your best ghost.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href="/play"
              className="flex min-h-12 items-center justify-center rounded-control bg-spectral-cyan px-5 font-display text-sm font-800 tracking-[0.14em] text-ink-950 transition-transform active:scale-[0.99]"
            >
              PLAY TODAY’S GHOST
            </Link>
            <RunMeter remaining={charges.data?.remaining} limit={charges.data?.limit} />
          </div>
        </section>

        <section
          aria-labelledby="today"
          className="rounded-card border border-white/10 bg-surface-800 p-5"
        >
          {isPending && <p role="status" className="text-sm text-ghost-muted">Loading today’s game…</p>}
          {isError && (
            <div role="status" className="text-sm text-ghost-muted">
              <p>{error.message === 'no-game-today' ? 'Today’s game is warming up.' : 'Today’s game took a moment to load.'}</p>
              <button type="button" onClick={() => void refetch()} className="mt-2 min-h-11 underline">Try again</button>
            </div>
          )}
          {today && !isError && <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p id="today" className="text-[11px] uppercase tracking-[0.18em] text-spectral-cyan">
                Today · {today.gameId} · {Math.round(today.durationMs / 1000)}s
              </p>
              <h2 className="font-display text-2xl font-800">{today.title}</h2>
              <p className="text-sm leading-6 text-ghost-muted">
                {today.instruction}
              </p>
            </div>
            <GameIcon game={today.gameId} className="size-12 shrink-0" />
          </div>}
          <div className="mt-4 flex items-center gap-3">
            <Link
              href="/play"
              className="flex min-h-11 flex-1 items-center justify-center rounded-control border border-spectral-cyan/50 px-4 text-sm font-600 text-spectral-cyan"
            >
              Preflight instructions
            </Link>
            <span className="tnum rounded-control bg-surface-700 px-3 py-2 text-xs text-ghost-muted">
              {charges.data ? (charges.data.limit === null ? 'Unlimited' : `${charges.data.remaining} runs left`) : '5 runs daily'}
            </span>
          </div>
        </section>

        <SpecialGame />

        {local.runs.length > 0 && (
          <section
            aria-label="Local progress"
            className="rounded-card bg-ink-900 flex items-center justify-between gap-4 border border-white/10 px-5 py-4"
          >
            <div>
              <p className="text-spectral-cyan text-[10px] tracking-[0.18em] uppercase">
                On this device
              </p>
              <p className="tnum mt-1 text-sm">
                {local.runs.length} saved {local.runs.length === 1 ? 'run' : 'runs'}
                {local.xpTotal > 0 ? ` · ${local.xpTotal} XP` : ''}
              </p>
            </div>
            <span className="rounded-control bg-signal-lime/10 text-signal-lime px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase">
              Saved
            </span>
          </section>
        )}

        <section aria-labelledby="ritual" className="flex flex-col gap-3">
          <h2 id="ritual" className="font-display text-lg font-800 tracking-wide">
            The daily ritual
          </h2>
          <ol className="flex flex-col gap-3">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="rounded-card border border-white/10 bg-ink-900 p-4"
              >
                <p className="tnum text-xs text-spectral-violet">{s.n}</p>
                <p className="mt-1 font-600">{s.title}</p>
                <p className="mt-1 text-sm leading-6 text-ghost-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="ghost-plus"
          className="rounded-card border border-spectral-violet/30 bg-ink-900 p-5"
        >
          <h2 id="ghost-plus" className="font-display text-lg font-800">
            TRAIN AGAINST YOUR PAST.
          </h2>
          <p className="mt-1 text-sm leading-6 text-ghost-muted">
            Ghost+ makes every run unlimited and opens the full archive, deeper history, and all
            cosmetics. Challenge races stay free.
          </p>
          <Link
            href="/ghost-plus"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-control border border-spectral-violet/50 px-4 text-sm font-600 text-spectral-violet"
          >
            Explore Ghost+
          </Link>
        </section>
      </main>
    </div>
  )
}
