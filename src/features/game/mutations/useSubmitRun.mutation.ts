import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { GameInputEvent } from '@/games/core/game-module'
import { QUERY_KEYS } from '@/features/game/queries/keys'
import { track } from '@/lib/analytics/track'

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
  return data as {
    run: Record<string, unknown> & { validatedScore: number; valid: boolean }
    outcome: string | null
    progression: { xpAwarded: number; unlocked: string[]; isPersonalBest: boolean } | null
  }
}

export function useSubmitRun() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: submitRun,
    onSuccess: (data) => {
      void client.invalidateQueries({ queryKey: [QUERY_KEYS.RUNS] })
      const personalBest = data.progression?.isPersonalBest ?? false
      track('score_submitted', { valid: data.run.valid, personalBest })
      if (data.run.valid) track('ranked_run_finished', { personalBest })
      if (personalBest) track('personal_best', {})
    },
    retry: 0
  })
}
