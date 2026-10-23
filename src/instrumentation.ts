import type { Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = async (_error, _request, context) => {
  // Keep the Node-only database import inside a positive runtime branch so Edge bundling
  // can eliminate it before resolving postgres' net/tls dependencies.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.ERROR_TELEMETRY_ENABLED !== 'true') return
    const { recordServerEvent } = await import('@/lib/analytics/server')
    await recordServerEvent('server_error', { route: context.routePath, type: context.routeType })
  }
}
