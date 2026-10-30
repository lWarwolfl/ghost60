import { describe, expect, it } from 'vitest'
import { betterAuth } from 'better-auth'
import { anonymous } from 'better-auth/plugins/anonymous'
import { authOrigins } from '@/lib/auth/origins'

const production = 'https://ghost60-topaz.vercel.app'
const previewHost = 'ghost60-review-example.vercel.app'
const branchHost = 'ghost60-git-fix-example.vercel.app'
const config = authOrigins({
  BETTER_AUTH_URL: production,
  VERCEL_ENV: 'preview',
  VERCEL_URL: previewHost,
  VERCEL_BRANCH_URL: branchHost,
})

function makeAuth(options = config) {
  return betterAuth({
    ...options,
    secret: 'isolated-preview-auth-regression-secret-12345',
    plugins: [anonymous()],
    advanced: { disableCSRFCheck: false, disableOriginCheck: false },
    rateLimit: { enabled: false },
    logger: { disabled: true },
  })
}

function signIn(host: string, origin = `https://${host}`) {
  return new Request(`https://${host}/api/auth/sign-in/anonymous`, {
    method: 'POST',
    // Vercel's protection cookie makes Better Auth validate the origin even
    // before the player's first anonymous session exists.
    headers: {
      origin,
      cookie: '_vercel_jwt=preview-protection',
      'content-type': 'application/json',
    },
    body: '{}',
  })
}

describe('preview guest authentication', () => {
  it('reproduces the old production-only origin rejection', async () => {
    const auth = makeAuth(authOrigins({ BETTER_AUTH_URL: production }))
    const response = await auth.handler(signIn(previewHost))
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'INVALID_ORIGIN' })
  })

  it.each([previewHost, branchHost])('signs in and reads the session on %s', async (host) => {
    const auth = makeAuth()
    const response = await auth.handler(signIn(host))
    expect(response.status).toBe(200)
    const user = await response.json()
    expect(user.user.isAnonymous).toBe(true)
    const cookies = response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0])
      .join('; ')
    expect(cookies).toContain('__Secure-better-auth.session_token=')
    const session = await auth.handler(
      new Request(`https://${host}/api/auth/get-session`, { headers: { cookie: cookies } })
    )
    expect((await session.json()).user.id).toBe(user.user.id)
  })

  it('rejects unrelated origins and keeps production configuration unchanged', async () => {
    const auth = makeAuth()
    expect(
      (await auth.handler(signIn(previewHost, 'https://other-project.vercel.app'))).status
    ).toBe(403)
    expect(
      authOrigins({
        BETTER_AUTH_URL: production,
        VERCEL_ENV: 'production',
        VERCEL_URL: previewHost,
      })
    ).toEqual({ baseURL: production, trustedOrigins: [production] })
  })
})
