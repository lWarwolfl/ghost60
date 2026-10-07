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
  token: string
  sessionId: string
  expiresAt: string
  game: TPublicGame
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
    } catch {
      return
    }
    set({ snapshot })
  },
  clear: () => {
    try {
      window.sessionStorage.removeItem(KEY)
    } catch {
      return
    }
    set({ snapshot: null })
  }
}))
