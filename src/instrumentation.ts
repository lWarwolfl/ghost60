import type { Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = async (_error, _request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.ERROR_TELEMETRY_ENABLED !== 'true') return
  const { recordServerEvent } = await import('@/lib/analytics/server')
  await recordServerEvent('server_error', { route: context.routePath, type: context.routeType })
}
