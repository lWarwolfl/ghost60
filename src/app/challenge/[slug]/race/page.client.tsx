'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useCreateSession } from '@/features/game/mutations/useCreateSession.mutation'
import { useGameStore } from '@/features/game/store/game-store'
import { audio } from '@/lib/game/audio'
import { getErrorMessage } from '@/lib/utils'

export function RaceClient({
  challengeId,
  slug,
  handle,
  targetScore
}: {
  challengeId: string
  slug: string
  handle: string
  targetScore: number
}) {
  const router = useRouter()
  const create = useCreateSession()
  const setSnapshot = useGameStore((s) => s.setSnapshot)
  const [failed, setFailed] = useState<string | null>(null)

  const race = async () => {
    setFailed(null)
    audio.unlock()
    try {
      const snapshot = await create.mutateAsync({ mode: 'challenge', challengeId })
      setSnapshot({
        ...snapshot,
        challenge: { id: challengeId, slug, handle, targetScore }
      })
      router.push('/play/run')
    } catch (e) {
      setFailed(getErrorMessage(e))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {failed && (
        <p role="alert" className="rounded-card border border-rival-coral/40 bg-ink-900 px-4 py-3 text-sm text-rival-coral">
          {failed === 'already-attempted'
            ? 'You already raced this ghost. Send a revenge challenge from your result instead.'
            : failed}
        </p>
      )}
      <button
        type="button"
        onClick={() => void race()}
        disabled={create.isPending}
        className="flex min-h-12 items-center justify-center rounded-control bg-spectral-cyan px-5 font-display text-sm font-800 tracking-[0.14em] text-ink-950 disabled:opacity-50"
      >
        {create.isPending ? 'OPENING…' : 'START RACE'}
      </button>
    </div>
  )
}
