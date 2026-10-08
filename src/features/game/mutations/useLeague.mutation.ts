import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'

async function createLeague(name: string) {
  const res = await fetch('/api/leagues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'league-create-failed')
  return data as { slug: string; name: string; url: string }
}

export function useCreateLeague() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createLeague,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [QUERY_KEYS.LEAGUES] })
    },
    retry: 0
  })
}

async function joinLeague(slug: string) {
  const res = await fetch(`/api/leagues/${slug}/join`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'league-join-failed')
  return data
}

export function useJoinLeague(slug: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => joinLeague(slug),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [QUERY_KEYS.LEAGUES] })
      void client.invalidateQueries({ queryKey: [QUERY_KEYS.LEAGUES, slug] })
    },
    retry: 0
  })
}

async function leaveLeague(slug: string) {
  const res = await fetch(`/api/leagues/${slug}/leave`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'league-leave-failed')
  return data
}

export function useLeaveLeague(slug: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => leaveLeague(slug),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [QUERY_KEYS.LEAGUES] })
      void client.invalidateQueries({ queryKey: [QUERY_KEYS.LEAGUES, slug] })
    },
    retry: 0
  })
}

async function renameLeague(args: { slug: string; name: string }) {
  const res = await fetch(`/api/leagues/${args.slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: args.name })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'league-rename-failed')
  return data
}

export function useRenameLeague(slug: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => renameLeague({ slug, name }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [QUERY_KEYS.LEAGUES] })
      void client.invalidateQueries({ queryKey: [QUERY_KEYS.LEAGUES, slug] })
    },
    retry: 0
  })
}
