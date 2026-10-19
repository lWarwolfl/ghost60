import { create } from 'zustand'
import type { GameId } from '@/games/core/game-module'

export type TPublicGame = {
  id: string
  gameDate: string
  gameId: GameId
  engineVersion: number
  seed: string
  config: unknown
  title: string
  instruction: string
  durationMs: number
}

export type TGameSnapshot = {
  mode?: 'ranked' | 'practice' | 'challenge' | 'past_self'
  playlist?: string[]
  pastSelf?: {
    runId: string
    targetScore: number
    ghost: import('@/games/core/game-module').SanitizedGhost
  } | null
  token: string
  sessionId: string
  expiresAt: string
  game: TPublicGame
  challenge: {
    id: string
    slug: string
    handle: string
    targetScore: number
    ghost?: import('@/games/core/game-module').SanitizedGhost
  } | null
}

type TGameStore = {
  snapshot: TGameSnapshot | null
  setSnapshot: (s: TGameSnapshot) => void
  clear: () => void
}

const KEY = 'ghost60:session'

export function loadSnapshotFromStorage(): TGameSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TGameSnapshot) : null
  } catch {
    return null
  }
}

export const useGameStore = create<TGameStore>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(snapshot))
    } catch {}
    set({ snapshot })
  },
  clear: () => {
    try {
      window.sessionStorage.removeItem(KEY)
    } catch {}
    set({ snapshot: null })
  },
}))
