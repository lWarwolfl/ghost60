import { createAuthClient } from 'better-auth/react'
import { anonymousClient } from 'better-auth/client/plugins'

const baseURL =
  typeof window === 'undefined' ? process.env.NEXT_PUBLIC_APP_URL : window.location.origin

export const authClient = createAuthClient({
  ...(baseURL ? { baseURL } : {}),
  plugins: [anonymousClient()]
})
