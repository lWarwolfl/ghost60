import { db } from '@/drizzle'
import { ProductEvent } from '@/drizzle/schema'

export const SERVER_ERROR_EVENTS = ['server_error', 'progression_failed'] as const

export async function recordServerEvent(name: typeof SERVER_ERROR_EVENTS[number], properties: Record<string, string>, userId?: string) {
  if (process.env.ERROR_TELEMETRY_ENABLED !== 'true') return
  try {
    await db.insert(ProductEvent).values({ eventName: name, userId: userId ?? null, properties })
  } catch {
    console.error('Ghost60 error telemetry unavailable', { eventName: name })
  }
}
