import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'

export type TChallengeCreated = {
  id: string
  slug: string
  url: string
  expiresAt: string
}

async function createChallenge(runId: string): Promise<TChallengeCreated> {
  const res = await fetch('/api/challenges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'challenge-failed')
  return data
}

export function useCreateChallenge() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createChallenge,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [QUERY_KEYS.CHALLENGES] })
    },
    retry: 0
  })
}
