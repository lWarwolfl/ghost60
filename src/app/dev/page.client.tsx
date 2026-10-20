'use client'

import { useRouter } from 'next/navigation'
import { GameIcon } from '@/components/brand/game-icon'
import { Footer } from '@/components/layout/footer'
import { useCreateSession } from '@/features/game/mutations/useCreateSession.mutation'
import { useGameStore } from '@/features/game/store/game-store'
import { audio } from '@/lib/game/audio'
import { ENGINES } from '@/features/game/schemas/session.schema'
import { useState } from 'react'

const COPY: Record<(typeof ENGINES)[number], string> = {
  pulse: 'Tap the ring at its peak.',
  snap: 'Pick the named shape before the window closes.',
  orbit: 'Meet the marker inside the arc.',
  recall: 'Watch the sequence, then repeat it.',
  shift: 'Follow the current rule, card by card.',
  trace: 'Drag through every gate without leaving the corridor.'
}

export function DevClient() {
  const router = useRouter()
  const create = useCreateSession()
  const setSnapshot = useGameStore((state) => state.setSnapshot)
  const [opening, setOpening] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const play = async (engine: (typeof ENGINES)[number]) => {
    setFailed(false)
    setOpening(engine)
    audio.unlock()
    try {
      const snapshot = await create.mutateAsync({ mode: 'dev', engine })
      setSnapshot(snapshot)
      router.push('/play/run')
    } catch {
      setFailed(true)
    } finally {
      setOpening(null)
    }
  }

  return (
    <div className="bg-ink-950 text-ghost-text flex min-h-dvh flex-col">
      
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8 sm:max-w-2xl">
        <p className="text-spectral-amber text-[10px] tracking-[0.18em] uppercase">Dev mode</p>
        <h1 className="font-display text-3xl font-800">PLAYTEST EVERY ENGINE</h1>
        <p className="text-ghost-muted text-sm leading-6">
          No daily limit, no charges, no streak changes. Each run still records and syncs so you
          can inspect the replay in the archive.
        </p>
        {failed && <p role="status" className="text-ghost-muted text-sm">Couldn’t open that engine. Try again.</p>}
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ENGINES.map((engine) => (
            <li key={engine}>
              <button
                type="button"
                disabled={Boolean(opening)}
                onClick={() => void play(engine)}
                className="rounded-card bg-surface-800 flex min-h-20 w-full items-center gap-3 border border-white/10 px-4 py-3 text-left disabled:opacity-60"
              >
                <GameIcon game={engine} motion="ambient" className="size-9 shrink-0" />
                <span className="min-w-0">
                  <span className="font-display block text-sm font-800 uppercase tracking-[0.12em]">
                    {engine}
                  </span>
                  <span className="text-ghost-muted mt-0.5 block text-xs leading-5">{COPY[engine]}</span>
                </span>
                <span className="text-spectral-cyan ml-auto shrink-0 text-[10px] tracking-[0.14em] uppercase">
                  {opening === engine ? '…' : 'Play'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </div>
  )
}
