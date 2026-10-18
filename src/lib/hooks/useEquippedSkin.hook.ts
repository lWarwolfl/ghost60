'use client'

import { useProfile } from '@/features/game/queries/useProfile.query'
import { resolveSkin } from '@/lib/game/skins'

export function useEquippedSkin(slot: 'ghost' | 'card' = 'ghost') {
  const { data } = useProfile()
  return resolveSkin(data?.cosmetics.equipped[slot], data?.plan)
}
