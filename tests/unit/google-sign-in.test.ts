import { beforeEach, expect, it, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'

const state = vi.hoisted(() => ({
  session: { data: { user: { isAnonymous: true, email: 'player@example.com' } }, isPending: false },
  social: vi.fn(),
  setters: [] as ReturnType<typeof vi.fn>[],
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (value: unknown) => {
    const setter = vi.fn()
    state.setters.push(setter)
    return [value, setter]
  },
}))
vi.mock('@/lib/auth/client', () => ({
  authClient: { useSession: () => state.session, signIn: { social: state.social } },
}))
import { GoogleSignIn } from '@/components/auth/google-sign-in'

function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as ReactElement<Record<string, unknown>>
  return [element, ...nodes(element.props.children as ReactNode)]
}
beforeEach(() => {
  vi.clearAllMocks()
  state.setters = []
  state.session.data.user.isAnonymous = true
  state.session.isPending = false
  state.social.mockResolvedValue({ error: null })
})
it('offers guest Google sign-in without billing and returns to profile', async () => {
  const button = nodes(GoogleSignIn()).find((node) => node.type === 'button')!
  expect(button.props.children).toBe('Sign in with Google')
  await (button.props.onClick as () => Promise<void>)()
  expect(state.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/profile' })
})
it('shows the linked account instead of another sign-in button', () => {
  state.session.data.user.isAnonymous = false
  const tree = GoogleSignIn()
  expect(nodes(tree).some((node) => node.type === 'button')).toBe(false)
  expect(JSON.stringify(tree)).toContain('player@example.com')
})
it('disables sign-in while the session is loading', () => {
  state.session.isPending = true
  expect(nodes(GoogleSignIn()).find((node) => node.type === 'button')!.props.disabled).toBe(true)
})
it('reports provider errors and permits retry', async () => {
  vi.useFakeTimers()
  state.social.mockResolvedValue({ error: { message: 'OAuth unavailable' } })
  const button = nodes(GoogleSignIn()).find((node) => node.type === 'button')!
  await (button.props.onClick as () => Promise<void>)()
  expect(state.setters[0]).toHaveBeenLastCalledWith(false)
  vi.advanceTimersByTime(2500)
  expect(state.setters[1]).toHaveBeenCalledWith('Google sign-in did not open. Please try again.')
  vi.useRealTimers()
})
