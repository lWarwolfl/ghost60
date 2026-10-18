import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'
import { track } from '@/lib/analytics/track'
import type { TGameSnapshot } from '@/features/game/store/game-store'
import type { TSessionRequest } from '@/features/game/schemas/session.schema'

async function createSession(request: TSessionRequest): Promise<TGameSnapshot> {
  const res = await fetch('/api/game/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'session-failed')
  return data
}

export function useCreateSession() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (request: TSessionRequest) => createSession(request),
    onSuccess: (data, vars) => {
      void client.invalidateQueries({ queryKey: [QUERY_KEYS.SESSION] })
      const mode = data.mode
      if (vars.challengeId) track('challenge_started', { mode })
      if (mode === 'ranked') track('ranked_session_started', { challenge: Boolean(vars.challengeId) })
      else if (mode === 'practice') track('practice_started', {})
      else if (mode === 'past_self') track('past_self_started', {})
    },
    onSettled: () => client.invalidateQueries({ queryKey: [QUERY_KEYS.CHARGES] }),
    retry: 0
  })
}
