// First-party product analytics contract (client-safe: no server imports).
// Source allowlist mirrors the pack funnel (agent-pack/docs/ANALYTICS_GROWTH.md).
// Billing events stay OUT until Stripe launches (paywall_viewed only — upsell is
// server-locked, so view counts are the only meaningful pre-launch signal).
// score_validated/score_rejected are server-known; they ship later as server-side
// emission, not client claims. Never attach emails, IPs, ghost streams, or
// free-form user text — props are flat scalars with length caps.

export const ANALYTICS_EVENTS = [
  'landing_viewed',
  'anonymous_session_created',
  'daily_game_viewed',
  'challenge_landing_viewed',
  'play_cta_clicked',
  'ranked_session_started',
  'ranked_run_consumed',
  'ranked_run_finished',
  'score_submitted',
  'result_viewed',
  'personal_best',
  'challenge_created',
  'challenge_shared',
  'challenge_opened',
  'challenge_started',
  'challenge_finished',
  'challenge_won',
  'revenge_shared',
  'account_link_prompt_viewed',
  'account_linked',
  'streak_extended',
  'grace_used',
  'league_created',
  'league_joined',
  'paywall_viewed',
  'archive_viewed',
  'practice_started',
  'past_self_started'
] as const

export type TAnalyticsEvent = (typeof ANALYTICS_EVENTS)[number]

const EVENT_SET: ReadonlySet<string> = new Set(ANALYTICS_EVENTS)

export const ANALYTICS_MAX_BATCH = 25
export const ANALYTICS_MAX_BODY_CHARS = 32_768
export const ANALYTICS_MAX_PROPS = 10
export const ANALYTICS_MAX_STR = 140
export const ANALYTICS_MAX_ID_STR = 64

export type TAnalyticsPropValue = string | number | boolean
export type TAnalyticsProps = Record<string, TAnalyticsPropValue>

export type TAnalyticsItem = {
  name: string
  properties?: Record<string, unknown>
  anonId?: string
  sessionKey?: string
}

export type TValidatedAnalyticsItem = {
  name: TAnalyticsEvent
  properties: TAnalyticsProps
  anonId?: string
  sessionKey?: string
}

function isValidPropValue(v: unknown): v is TAnalyticsPropValue {
  if (typeof v === 'string') return v.length <= ANALYTICS_MAX_STR
  if (typeof v === 'number') return Number.isFinite(v)
  return typeof v === 'boolean'
}

function isValidId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= ANALYTICS_MAX_ID_STR
}

export function validateAnalyticsBatch(body: unknown):
  | { ok: true; events: TValidatedAnalyticsItem[] }
  | { ok: false; error: string; status: number } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'bad-request', status: 400 }
  }
  let size = 0
  try {
    size = JSON.stringify(body).length
  } catch {
    return { ok: false, error: 'bad-request', status: 400 }
  }
  if (size > ANALYTICS_MAX_BODY_CHARS) {
    return { ok: false, error: 'payload-too-large', status: 413 }
  }
  const events = (body as { events?: unknown }).events
  if (!Array.isArray(events) || events.length === 0 || events.length > ANALYTICS_MAX_BATCH) {
    return { ok: false, error: 'bad-batch', status: 400 }
  }
  const out: TValidatedAnalyticsItem[] = []
  for (const raw of events) {
    if (typeof raw !== 'object' || raw === null) {
      return { ok: false, error: 'bad-event', status: 400 }
    }
    const item = raw as TAnalyticsItem
    if (!EVENT_SET.has(item.name)) {
      return { ok: false, error: 'unknown-event', status: 400 }
    }
    let properties: TAnalyticsProps = {}
    if (item.properties !== undefined) {
      if (typeof item.properties !== 'object' || item.properties === null || Array.isArray(item.properties)) {
        return { ok: false, error: 'bad-properties', status: 400 }
      }
      const entries = Object.entries(item.properties)
      if (entries.length > ANALYTICS_MAX_PROPS) {
        return { ok: false, error: 'too-many-properties', status: 400 }
      }
      for (const [k, v] of entries) {
        if (k.length === 0 || k.length > ANALYTICS_MAX_ID_STR || !isValidPropValue(v)) {
          return { ok: false, error: 'bad-properties', status: 400 }
        }
      }
      properties = item.properties as TAnalyticsProps
    }
    const clean: TValidatedAnalyticsItem = { name: item.name as TAnalyticsEvent, properties }
    if (item.anonId !== undefined) {
      if (!isValidId(item.anonId)) return { ok: false, error: 'bad-ids', status: 400 }
      clean.anonId = item.anonId
    }
    if (item.sessionKey !== undefined) {
      if (!isValidId(item.sessionKey)) return { ok: false, error: 'bad-ids', status: 400 }
      clean.sessionKey = item.sessionKey
    }
    out.push(clean)
  }
  return { ok: true, events: out }
}
