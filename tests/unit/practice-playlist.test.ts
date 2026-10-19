import { beforeEach, expect, it, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import type { TGameSnapshot } from '@/features/game/store/game-store'

const state = vi.hoisted(() => ({
  create: vi.fn(),
  setSnapshot: vi.fn(),
  push: vi.fn(),
  unlock: vi.fn(),
  locked: false,
  snapshot: null as TGameSnapshot | null,
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (value: unknown) => [value, vi.fn()],
  useEffect: vi.fn(),
  useRef: () => ({ current: null }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/features/game/queries/useArchive.query', () => ({
  useArchivePages: () => ({
    data: {
      pages: [
        {
          locked: state.locked,
          days: [
            { id: 'first', gameDate: '2026-10-18' },
            { id: 'second', gameDate: '2026-10-17' },
          ],
        },
      ],
    },
  }),
}))
vi.mock('@/features/game/mutations/useCreateSession.mutation', () => ({
  useCreateSession: () => ({ mutateAsync: state.create, isPending: false }),
}))
vi.mock('@/features/game/mutations/useCreateChallenge.mutation', () => ({
  useCreateChallenge: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/features/game/queries/useProfile.query', () => ({ useProfile: () => ({}) }))
vi.mock('@/lib/game/audio', () => ({ audio: { unlock: state.unlock } }))
vi.mock('@/lib/hooks/useReducedMotion.hook', () => ({ useReducedMotion: () => true }))
vi.mock('@/features/game/hooks/useRunSession.hook', () => ({
  useRunSession: () => ({
    phase: 'result',
    result: { score: 20, valid: true, xpAwarded: 0 },
    eventsRef: { current: [] },
  }),
}))
vi.mock('@/features/game/store/game-store', () => ({
  useGameStore: (selector?: (value: unknown) => unknown) => {
    const value = { snapshot: state.snapshot, setSnapshot: state.setSnapshot, clear: vi.fn() }
    return selector ? selector(value) : value
  },
  loadSnapshotFromStorage: vi.fn(),
}))
import { ArchiveClient } from '@/app/archive/page.client'
import { RunClient } from '@/app/play/run/page.client'

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as ReactElement<Record<string, unknown>>
  return [element, ...elements(element.props.children as ReactNode)]
}
function button(tree: ReactNode, label: string) {
  return (
    elements(tree).find(
      (element) =>
        element.type === 'button' &&
        elements(element.props.children as ReactNode).length === 0 &&
        String(element.props.children).includes(label)
    ) ??
    elements(tree).find(
      (element) =>
        element.type === 'button' && JSON.stringify(element.props.children).includes(label)
    )
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  state.locked = false
  state.snapshot = {
    token: 'one',
    game: { gameId: 'pulse', config: {} },
    playlist: ['second', 'third'],
    challenge: null,
  } as TGameSnapshot
  state.create.mockResolvedValue({ token: 'next', game: { id: 'second' } })
})
it('starts a loaded archive playlist through ordinary server-authorized practice', async () => {
  const start = button(ArchiveClient(), 'START PRACTICE PLAYLIST')!
  await (start.props.onClick as () => Promise<void>)()
  expect(state.create).toHaveBeenCalledWith({ mode: 'practice', dailyGameId: 'first' })
  expect(state.setSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({ token: 'next', playlist: ['second'] })
  )
  expect(state.push).toHaveBeenCalledWith('/play/run')
})
it('does not offer archive playlists to a locked account', () => {
  state.locked = true
  expect(button(ArchiveClient(), 'START PRACTICE PLAYLIST')).toBeUndefined()
})
it('remounts each run and advances the queue only after a successful session', async () => {
  const active = elements(RunClient()).find(
    (element) => typeof element.type === 'function' && element.type.name === 'RunActive'
  )!
  expect(active.key).toBe('one')
  const panel = (active.type as (props: unknown) => ReactElement)(active.props)
  const tree = (panel.type as (props: unknown) => ReactElement)(panel.props)
  const next = button(tree, 'NEXT PLAYLIST GAME')!
  await (next.props.onClick as () => Promise<void>)()
  expect(state.create).toHaveBeenCalledWith({ mode: 'practice', dailyGameId: 'second' })
  expect(state.setSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({ token: 'next', playlist: ['third'] })
  )
  state.setSnapshot.mockClear()
  state.create.mockRejectedValue(new Error('ghost-plus-locked'))
  await (next.props.onClick as () => Promise<void>)()
  expect(state.setSnapshot).not.toHaveBeenCalled()
})
