import { describe, expect, it } from 'vitest'
import {
  ANALYTICS_EVENTS,
  validateAnalyticsBatch
} from '@/lib/game/analytics'

describe('validateAnalyticsBatch', () => {
  it('accepts a well-formed batch', () => {
    const res = validateAnalyticsBatch({
      events: [
        { name: 'ranked_session_started', properties: { challenge: false }, anonId: 'a1', sessionKey: 's1' },
        { name: 'score_submitted', properties: { valid: true, personalBest: false } }
      ]
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.events).toHaveLength(2)
  })

  it('rejects unknown event names', () => {
    const res = validateAnalyticsBatch({ events: [{ name: 'checkout_started' }] })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('unknown-event')
  })

  it('rejects billing-adjacent and server-side names even if funnel-shaped', () => {
    for (const name of ['subscription_started', 'score_validated', 'score_rejected', 'install_referrer']) {
      const res = validateAnalyticsBatch({ events: [{ name }] })
      expect(res.ok).toBe(false)
    }
  })

  it('rejects empty and oversized batches', () => {
    expect(validateAnalyticsBatch({ events: [] }).ok).toBe(false)
    const big = Array.from({ length: 26 }, () => ({ name: 'result_viewed' }))
    const res = validateAnalyticsBatch({ events: big })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('bad-batch')
  })

  it('rejects oversized bodies', () => {
    const res = validateAnalyticsBatch({
      events: [{ name: 'result_viewed', properties: { blob: 'x'.repeat(40_000) } }]
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(413)
  })

  it('rejects nested objects, nulls, long strings and too many props', () => {
    expect(
      validateAnalyticsBatch({ events: [{ name: 'result_viewed', properties: { nested: { a: 1 } } }] }).ok
    ).toBe(false)
    expect(
      validateAnalyticsBatch({ events: [{ name: 'result_viewed', properties: { v: null } }] }).ok
    ).toBe(false)
    expect(
      validateAnalyticsBatch({ events: [{ name: 'result_viewed', properties: { v: 'x'.repeat(141) } }] }).ok
    ).toBe(false)
    const many: Record<string, boolean> = {}
    for (let i = 0; i < 11; i++) many[`k${i}`] = true
    expect(
      validateAnalyticsBatch({ events: [{ name: 'result_viewed', properties: many }] }).ok
    ).toBe(false)
  })

  it('rejects bad ids and non-object shapes', () => {
    expect(validateAnalyticsBatch({ events: [{ name: 'result_viewed', anonId: '' }] }).ok).toBe(false)
    expect(validateAnalyticsBatch({ events: [{ name: 'result_viewed', sessionKey: 'x'.repeat(65) }] }).ok).toBe(false)
    expect(validateAnalyticsBatch(null).ok).toBe(false)
    expect(validateAnalyticsBatch({}).ok).toBe(false)
  })

  it('allowlist covers the launch funnel without billing', () => {
    for (const name of [
      'daily_game_viewed', 'play_cta_clicked', 'ranked_session_started',
      'ranked_run_finished', 'score_submitted', 'result_viewed',
      'challenge_created', 'challenge_landing_viewed', 'challenge_started',
      'challenge_finished', 'league_created', 'league_joined', 'paywall_viewed'
    ]) {
      expect(ANALYTICS_EVENTS).toContain(name)
    }
    expect(ANALYTICS_EVENTS).not.toContain('checkout_started')
    expect(ANALYTICS_EVENTS).not.toContain('subscription_started')
  })
})
