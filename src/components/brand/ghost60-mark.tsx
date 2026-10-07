import { cn } from '@/lib/utils'

type Ghost60MarkProps = {
  motion?: 'ambient' | 'enter' | 'none'
  className?: string
}

export function Ghost60Mark({ motion = 'ambient', className }: Ghost60MarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Ghost60 mark"
      className={cn('size-10', className)}
    >
      <defs>
        <linearGradient id="ghost60-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#62F7E6" />
          <stop offset="1" stopColor="#A98BFF" />
        </linearGradient>
      </defs>
      <g className={motion === 'ambient' ? 'mark-ambient-body' : undefined} data-part="body">
        <path
          d="M14 31C14 20.5 22.1 12 32 12s18 8.5 18 19v17l-5.8-4.2-6.1 4.2-6.1-4.2-6.1 4.2-6-4.2L14 48V31Z"
          stroke="url(#ghost60-mark-g)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <circle cx="26.5" cy="30" r="2.3" fill="#F5F7FF" data-part="eye-left" />
        <circle cx="37.5" cy="30" r="2.3" fill="#F5F7FF" data-part="eye-right" />
      </g>
      <path
        d="M11.5 17A25 25 0 0 1 54 20"
        stroke="#F5F7FF"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".72"
        data-part="timer-arc"
        className={motion === 'ambient' ? 'mark-ambient-arc' : undefined}
      />
      <path
        d="M53.5 20l-2.5-7"
        stroke="#C7FF5E"
        strokeWidth="3"
        strokeLinecap="round"
        data-part="timer-tick"
      />
    </svg>
  )
}
