const SERVER_ERROR_EVENTS = ['server_error', 'progression_failed'] as const

type TLaunchMetrics = {
  now: Date
  scheduledDates: string[]
  runs: { valid: boolean; invalidReason: string | null; count: number }[]
  sessions: { total: number; completed: number }
  events: { eventName: string; count: number }[]
  errorTelemetryEnabled?: boolean
}

export function summarizeLaunchStatus(input: TLaunchMetrics) {
  const today = input.now.toISOString().slice(0, 10)
  const midnight = Date.parse(`${today}T00:00:00Z`)
  const dates = Array.from({ length: 30 }, (_, index) =>
    new Date(midnight + index * 86_400_000).toISOString().slice(0, 10)
  )
  const scheduled = new Set(input.scheduledDates)
  const missingDates = dates.filter((date) => !scheduled.has(date))
  const valid = input.runs.filter((run) => run.valid).reduce((sum, run) => sum + run.count, 0)
  const invalid = input.runs.filter((run) => !run.valid).reduce((sum, run) => sum + run.count, 0)
  const invalidReasons: Record<string, number> = {}
  for (const run of input.runs.filter((run) => !run.valid)) {
    const reason = run.invalidReason ?? 'unspecified'
    invalidReasons[reason] = (invalidReasons[reason] ?? 0) + run.count
  }
  const errorEventAllowlist = input.errorTelemetryEnabled ? [...SERVER_ERROR_EVENTS] : []
  return {
    coverage: {
      today,
      through: dates[29],
      nextRolloverAt: new Date(midnight + 86_400_000).toISOString(),
      missingDates,
      ready: missingDates.length === 0,
    },
    runs: {
      total: valid + invalid,
      valid,
      invalid,
      invalidRate: valid + invalid ? invalid / (valid + invalid) : null,
      invalidReasons,
    },
    sessions: {
      ...input.sessions,
      completionRatio: input.sessions.total
        ? input.sessions.completed / input.sessions.total
        : null,
    },
    analytics: {
      challengeOpens:
        input.events.find((event) => event.eventName === 'challenge_opened')?.count ?? 0,
      errorEventAllowlist,
      errorEventsByName: Object.fromEntries(
        errorEventAllowlist.map((name) => [
          name,
          input.events.find((event) => event.eventName === name)?.count ?? 0,
        ])
      ),
      errorEvents: errorEventAllowlist.length
        ? input.events
            .filter((event) => errorEventAllowlist.some((name) => name === event.eventName))
            .reduce((sum, event) => sum + event.count, 0)
        : null,
    },
  }
}
