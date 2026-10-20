'use client'

import { ResetCountdown } from '@/components/game/reset-countdown'

export function RunMeter({
  remaining,
  limit,
  compact = false
}: {
  remaining: number | null | undefined
  limit: number | null | undefined
  compact?: boolean
}) {
  const unlimited = limit === null
  const total = limit ?? 5
  const left = remaining ?? total
  return (
    <div className={`run-meter ${compact ? 'run-meter-compact' : ''}`} aria-label={unlimited ? 'Unlimited runs' : `${left} of ${total} runs left today`}>
      <div className="run-meter-head">
        <span>{unlimited ? 'Ghost+ unlimited' : 'Runs today'}</span>
        <span className="tnum run-meter-count">{unlimited ? '∞' : `${left} / ${total}`}</span>
      </div>
      <div className="run-meter-track" aria-hidden="true">
        {unlimited ? (
          <span className="run-meter-infinity">∞</span>
        ) : (
          Array.from({ length: total }, (_, index) => (
            <span key={index} data-state={index < left ? 'ready' : 'spent'} className="run-meter-pip" />
          ))
        )}
      </div>
      {!compact && <ResetCountdown />}
    </div>
  )
}
