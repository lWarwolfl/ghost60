'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GameIcon } from '@/components/brand/game-icon'
import { useCreateSession } from '@/features/game/mutations/useCreateSession.mutation'
import { useGameStore } from '@/features/game/store/game-store'
import { audio } from '@/lib/game/audio'
import type { TPublicGame } from '@/features/game/store/game-store'

type TSpecial = TPublicGame & { startsAt: string; endsAt: string }

function remaining(endsAt: string, now: number) {
  const ms = Math.max(0, Date.parse(endsAt) - now)
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function SpecialGame() {
  const router = useRouter()
  const create = useCreateSession()
  const setSnapshot = useGameStore((state) => state.setSnapshot)
  const [now, setNow] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const query = useQuery<TSpecial>({
    queryKey: ['game-special'],
    queryFn: async () => {
      const res = await fetch('/api/game/special', { cache: 'no-store' })
      if (!res.ok) throw new Error('special-unavailable')
      return res.json()
    },
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000
  })
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const game = query.data
  if (!game) return null

  const play = async () => {
    setFailed(false)
    audio.unlock()
    try {
      const snapshot = await create.mutateAsync({ mode: 'special' })
      setSnapshot(snapshot)
      router.push('/play/run')
    } catch {
      setFailed(true)
    }
  }

  return (
    <section
      aria-labelledby="flash-title"
      className="special-card"
      data-ended={now !== null && Date.parse(game.endsAt) <= now ? 'true' : 'false'}
    >
      <div className="special-card-glow" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="special-card-kicker">
            Flash game · live for 2 hours
          </p>
          <h2 id="flash-title" className="font-display mt-1 text-xl font-800">
            {game.title}
          </h2>
        </div>
        <GameIcon game={game.gameId} motion="ambient" className="size-10 shrink-0" />
      </div>
      <p className="text-ghost-muted relative mt-2 text-sm leading-6">{game.instruction}</p>
      <div className="relative mt-3 flex items-center justify-between gap-3">
        <span className="tnum text-signal-amber text-xs tracking-[0.14em] uppercase">
          {now === null ? '--:--:--' : remaining(game.endsAt, now)} left
        </span>
        <button
          type="button"
          onClick={() => void play()}
          disabled={create.isPending || (now !== null && Date.parse(game.endsAt) <= now)}
          className="rounded-control bg-signal-amber font-display font-800 text-ink-950 min-h-11 px-5 text-xs tracking-[0.14em] disabled:opacity-50"
        >
          {create.isPending ? 'OPENING…' : 'PLAY FLASH'}
        </button>
      </div>
      {failed && <p className="text-ghost-muted relative mt-2 text-xs">Couldn’t open the flash game. Try again.</p>}
    </section>
  )
}
