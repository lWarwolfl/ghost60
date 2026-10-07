export type RuntimeState =
  | 'PRELOAD'
  | 'READY'
  | 'COUNTDOWN'
  | 'RUNNING'
  | 'FINISHING'
  | 'SUBMITTING'
  | 'RESULT'

export type RuntimeEvent =
  | 'LOADED'
  | 'START'
  | 'COUNTDOWN_DONE'
  | 'DURATION_END'
  | 'SUBMIT_BEGIN'
  | 'SUBMIT_OK'
  | 'SUBMIT_FAIL'

const TRANSITIONS: Record<RuntimeState, Partial<Record<RuntimeEvent, RuntimeState>>> = {
  PRELOAD: { LOADED: 'READY' },
  READY: { START: 'COUNTDOWN' },
  COUNTDOWN: { COUNTDOWN_DONE: 'RUNNING' },
  RUNNING: { DURATION_END: 'FINISHING' },
  FINISHING: { SUBMIT_BEGIN: 'SUBMITTING' },
  SUBMITTING: { SUBMIT_OK: 'RESULT', SUBMIT_FAIL: 'FINISHING' },
  RESULT: {}
}

export function transition(state: RuntimeState, event: RuntimeEvent): RuntimeState {
  const next = TRANSITIONS[state][event]
  if (!next) throw new Error(`illegal-transition:${state}:${event}`)
  return next
}

export function canTransition(state: RuntimeState, event: RuntimeEvent): boolean {
  return TRANSITIONS[state][event] !== undefined
}
