'use client'

import {
  Brain,
  CalendarCheck,
  Fingerprint,
  Flame,
  Ghost,
  Layers,
  Radio,
  Send,
  Timer,
  Trophy,
  type LucideIcon
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  trace: Fingerprint,
  echo: Radio,
  haunter: Send,
  photo: Timer,
  sweep: Layers,
  seven: Flame,
  thirty: CalendarCheck,
  senses: Brain,
  personal: Ghost,
  league: Trophy
}

export function AchievementCard({
  title,
  description,
  icon,
  unlocked,
  progress,
  target
}: {
  title: string
  description: string
  icon: string
  unlocked: boolean
  progress: number
  target: number
}) {
  const Icon = ICONS[icon] ?? Trophy
  const pct = Math.min(100, Math.round((progress / Math.max(1, target)) * 100))
  return (
    <li
      className={`rounded-card flex items-start gap-3 border p-3 ${
        unlocked ? 'border-spectral-cyan/40 bg-surface-800' : 'border-white/10 bg-ink-900'
      }`}
      data-unlocked={unlocked ? 'true' : 'false'}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-control border ${
          unlocked
            ? 'border-spectral-cyan/40 bg-spectral-cyan/10 text-spectral-cyan'
            : 'border-white/10 bg-surface-700 text-ghost-muted'
        }`}
        aria-hidden="true"
      >
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display truncate text-sm font-800">{title}</p>
          <span className="tnum text-ghost-muted shrink-0 text-[10px]">
            {unlocked ? 'Done' : `${progress} / ${target}`}
          </span>
        </div>
        <p className="text-ghost-muted mt-0.5 text-xs leading-5">{description}</p>
        <div
          className="bg-surface-700 mt-2 h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-label={`${title} progress`}
        >
          <div
            className={`h-full rounded-full ${unlocked ? 'bg-spectral-cyan' : 'bg-spectral-violet/70'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </li>
  )
}
