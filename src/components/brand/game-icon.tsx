import { cn } from '@/lib/utils'

type GameIconProps = {
  game: 'pulse' | 'snap' | 'orbit' | 'recall' | 'shift' | 'trace'
  className?: string
}

const PATHS: Record<GameIconProps['game'], React.ReactNode> = {
  pulse: (
    <>
      <circle cx="32" cy="32" r="20" stroke="#62F7E6" strokeWidth="3" opacity=".35" data-part="outer-ring" />
      <circle cx="32" cy="32" r="13" stroke="url(#game-icon-g)" strokeWidth="4" data-part="inner-ring" />
      <circle cx="32" cy="32" r="4" fill="#F5F7FF" data-part="dot" />
    </>
  ),
  snap: (
    <>
      <path
        d="M12 22v-8h8M44 14h8v8M52 42v8h-8M20 50h-8v-8"
        stroke="url(#game-icon-g)"
        strokeWidth="4"
        strokeLinecap="round"
        data-part="brackets"
      />
      <path
        d="M32 21l3.2 6.8L42 31l-6.8 3.2L32 41l-3.2-6.8L22 31l6.8-3.2L32 21Z"
        fill="#F5F7FF"
        data-part="star"
      />
    </>
  ),
  orbit: (
    <>
      <circle cx="32" cy="32" r="20" stroke="url(#game-icon-g)" strokeWidth="4" data-part="ring" />
      <path d="M32 12a20 20 0 0 1 17.3 10" stroke="#C7FF5E" strokeWidth="4" strokeLinecap="round" data-part="target-arc" />
      <circle cx="49" cy="32" r="4" fill="#F5F7FF" data-part="marker" />
    </>
  ),
  recall: (
    <g data-part="cells" fill="#F5F7FF">
      <rect x="14" y="14" width="10" height="10" rx="2" opacity=".9" />
      <rect x="27" y="14" width="10" height="10" rx="2" opacity=".35" />
      <rect x="40" y="14" width="10" height="10" rx="2" opacity=".35" />
      <rect x="14" y="27" width="10" height="10" rx="2" opacity=".35" />
      <rect x="27" y="27" width="10" height="10" rx="2" opacity=".9" />
      <rect x="40" y="27" width="10" height="10" rx="2" opacity=".35" />
      <rect x="14" y="40" width="10" height="10" rx="2" opacity=".35" />
      <rect x="27" y="40" width="10" height="10" rx="2" opacity=".35" />
      <rect x="40" y="40" width="10" height="10" rx="2" opacity=".9" />
    </g>
  ),
  shift: (
    <>
      <path d="M14 26h24l-6-6M50 38H26l6 6" stroke="#62F7E6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" data-part="forward" />
      <path d="M14 38h12M50 26H38" stroke="#A98BFF" strokeWidth="4" strokeLinecap="round" data-part="backward" />
    </>
  ),
  trace: (
    <>
      <path d="M12 48C22 40 26 30 32 28s14-2 20-12" stroke="url(#game-icon-g)" strokeWidth="4" strokeLinecap="round" data-part="curve" />
      <circle cx="12" cy="48" r="4" fill="#62F7E6" data-part="start" />
      <circle cx="32" cy="28" r="4" fill="none" stroke="#C7FF5E" strokeWidth="3" data-part="gate" />
      <circle cx="52" cy="16" r="4" fill="#F5F7FF" data-part="end" />
    </>
  )
}

export function GameIcon({ game, className }: GameIconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" role="img" aria-label={`${game} icon`} className={cn('size-8', className)}>
      <defs>
        <linearGradient id="game-icon-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#62F7E6" />
          <stop offset="1" stopColor="#A98BFF" />
        </linearGradient>
      </defs>
      {PATHS[game]}
    </svg>
  )
}
