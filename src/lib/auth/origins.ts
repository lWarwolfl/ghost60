type AuthEnvironment = Record<string, string | undefined>

export function authOrigins(env: AuthEnvironment = process.env) {
  const configured = env.BETTER_AUTH_URL
  const previews =
    env.VERCEL_ENV === 'preview'
      ? [env.VERCEL_URL, env.VERCEL_BRANCH_URL]
          .filter((host): host is string => Boolean(host))
          .map((host) => `https://${host}`)
      : []
  const trustedOrigins = [
    ...new Set([configured, ...previews].filter((origin): origin is string => Boolean(origin))),
  ]
  return {
    // Resolve callbacks and secure cookies against this deployment, rather than
    // sending preview authentication to the production app's configured URL.
    baseURL: previews.length
      ? {
          allowedHosts: trustedOrigins.map((origin) => new URL(origin).host),
          fallback: previews[0],
          protocol: 'https' as const,
        }
      : configured,
    trustedOrigins,
  }
}
