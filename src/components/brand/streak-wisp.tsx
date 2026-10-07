import { cn } from '@/lib/utils'

export function StreakWisp({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Streak"
      className={cn('size-5', className)}
    >
      <defs>
        <linearGradient id="streak-wisp-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#62F7E6" />
          <stop offset="1" stopColor="#A98BFF" />
        </linearGradient>
      </defs>
      <path
        d="M34 11c3 10-4 12-1 20 4-6 9-6 12-11 6 11 5 26-8 32-13 6-25-3-24-16 1-9 8-12 11-19 2 6 2 10 6 12-1-8 2-11 4-18Z"
        fill="url(#streak-wisp-g)"
        data-part="flame"
      />
      <path
        d="M33 33c-5 5-6 13 0 16 7 3 11-5 7-11-1 4-4 5-7 2-2-2-1-5 0-7Z"
        fill="#F5F7FF"
        data-part="core"
      />
    </svg>
  )
}
