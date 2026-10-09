import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'

async function equipCosmetics(args: { slot: 'ghost' | 'card'; skinId: string }) {
  const res = await fetch('/api/profile/cosmetics', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'cosmetics-failed')
  return data
}

export function useEquipCosmetics() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: equipCosmetics,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [QUERY_KEYS.PROFILE] })
    },
    retry: 0
  })
}
