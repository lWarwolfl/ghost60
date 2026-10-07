import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { GameInputEvent } from '@/games/core/game-module'
import { QUERY_KEYS } from '@/features/game/queries/keys'

export type TSubmitPayload = {
  token: string
  events: GameInputEvent[]
  visibilityInterruptions: number
}

async function submitRun(payload: TSubmitPayload) {
  const res = await fetch('/api/game/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'submit-failed')
  return data as { run: Record<string, unknown> & { validatedScore: number; valid: boolean }; outcome: string | null }
}

export function useSubmitRun() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: submitRun,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [QUERY_KEYS.RUNS] })
    },
    retry: 0
  })
}
