import { afterEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  userId: 'one' as string | undefined,
  query: vi.fn(),
  invalidate: vi.fn(),
  mutation: vi.fn(),
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: state.query,
  useSuspenseQuery: state.query,
  useQueryClient: () => ({ invalidateQueries: state.invalidate }),
  useMutation: state.mutation,
}))
vi.mock('@/lib/auth/client', () => ({
  authClient: {
    useSession: () => ({ data: state.userId ? { user: { id: state.userId } } : null }),
  },
}))
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }))
import { useProfile } from '@/features/game/queries/useProfile.query'
import { useSubmitRun } from '@/features/game/mutations/useSubmitRun.mutation'
import { QUERY_KEYS } from '@/features/game/queries/keys'

afterEach(() => {
  vi.clearAllMocks()
  state.userId = 'one'
})

it('scopes cosmetics to the current account and refreshes expired entitlements', () => {
  useProfile()
  expect(state.query).toHaveBeenLastCalledWith(
    expect.objectContaining({
      queryKey: [QUERY_KEYS.PROFILE, 'one'],
      enabled: true,
      refetchOnWindowFocus: 'always',
      refetchInterval: 60000,
    })
  )
  state.userId = 'two'
  useProfile()
  expect(state.query).toHaveBeenLastCalledWith(
    expect.objectContaining({ queryKey: [QUERY_KEYS.PROFILE, 'two'] })
  )
  state.userId = undefined
  useProfile()
  expect(state.query).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }))
})

it('refreshes progression and cosmetics after submitting a run', () => {
  useSubmitRun()
  const options = state.mutation.mock.calls[0][0]
  options.onSuccess({ run: { valid: true, mode: 'ranked' }, progression: null })
  expect(state.invalidate).toHaveBeenCalledWith({ queryKey: [QUERY_KEYS.PROFILE] })
})
