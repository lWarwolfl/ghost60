'use client'

import Link from 'next/link'
import { GameIcon } from '@/components/brand/game-icon'
import { Ghost60Mark } from '@/components/brand/ghost60-mark'
import { ResetCountdown } from '@/components/game/reset-countdown'
import { useCharges } from '@/features/game/queries/useCharges.query'
import { useTodayGame } from '@/features/game/queries/useTodayGame.query'
import { useLocalProgress } from '@/lib/hooks/useLocalProgress.hook'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'

const STEPS = [
  {
    n: '01',
    title: 'See today’s game',
    body: 'Same seed, same config, same duration for everyone. No retries on ranked.'
  },
  {
    n: '02',
    title: 'Spend your one run',
    body: 'Server replays your input stream and decides the score. Client numbers are just a preview.'
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
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 sm:max-w-2xl">
        <section aria-labelledby="hero" className="flex flex-col gap-5 animate-enter">
          <Ghost60Mark motion="ambient" className="size-14" />
          <div className="flex flex-col gap-3">
            <h1
              id="hero"
              className="font-display text-5xl font-800 leading-[0.95] tracking-tight"
            >
              ONE MINUTE.
              <br />
              ONE RUN.
            </h1>
            <p className="max-w-md text-base leading-7 text-ghost-muted">
              Everyone gets the same game. You get one ranked attempt. Leave a ghost. Send it to
              a friend.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href="/play"
              className="flex min-h-12 items-center justify-center rounded-control bg-spectral-cyan px-5 font-display text-sm font-800 tracking-[0.14em] text-ink-950 transition-transform active:scale-[0.99]"
            >
              PLAY TODAY’S GHOST
            </Link>
            <ResetCountdown />
          </div>
        </section>

        <section
          aria-labelledby="today"
          className="rounded-card border border-white/10 bg-surface-800 p-5"
        >
          {isPending && <p role="status" className="text-sm text-ghost-muted">Loading today’s game…</p>}
          {isError && (
            <div role="alert" className="text-sm text-rival-coral">
              <p>{error.message}</p>
              <button type="button" onClick={() => void refetch()} className="min-h-11 underline">Retry today’s game</button>
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
              {charges.data && !charges.isError ? charges.data.rankedAvailable ? '1 ranked available' : 'Ranked spent' : '1 ranked daily'}
            </span>
          </div>
        </section>

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
            <span
              className={`rounded-control px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase ${
                local.pending
                  ? 'text-signal-amber bg-signal-amber/10'
                  : 'text-signal-lime bg-signal-lime/10'
              }`}
            >
              {local.pending ? `${local.pending} syncing` : 'synced'}
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
            Ghost+ unlocks unlimited practice. Everyone still gets exactly one ranked attempt
            per UTC day — ranked fairness never changes.
          </p>
          <Link
            href="/ghost-plus"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-control border border-spectral-violet/50 px-4 text-sm font-600 text-spectral-violet"
          >
            Explore Ghost+
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  )
}
