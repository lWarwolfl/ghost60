import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'
import type { TGameSnapshot } from '@/features/game/store/game-store'

async function createSession(mode: string, challengeId?: string): Promise<TGameSnapshot> {
  const res = await fetch('/api/game/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(challengeId ? { mode, challengeId } : { mode })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'session-failed')
  return data
}

export function useCreateSession() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ mode, challengeId }: { mode: string; challengeId?: string }) =>
      createSession(mode, challengeId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [QUERY_KEYS.SESSION] })
    },
    retry: 0
  })
}
