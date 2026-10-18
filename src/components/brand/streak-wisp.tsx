'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'
import { useBrandMotion } from '@/lib/hooks/useBrandMotion.hook'

export function StreakWisp({
  motion = 'idle',
  className,
}: {
  motion?: 'idle' | 'increment' | 'none'
  className?: string
}) {
  const id = useId()
  const preferences = useBrandMotion()
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Streak"
      data-vector="streak"
      data-motion={motion}
      {...preferences}
      className={cn('brand-vector size-5', className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#62F7E6" />
          <stop offset="1" stopColor="#A98BFF" />
        </linearGradient>
      </defs>
      <path
        data-part="flame"
        d="M34 11c3 10-4 12-1 20 4-6 9-6 12-11 6 11 5 26-8 32-13 6-25-3-24-16 1-9 8-12 11-19 2 6 2 10 6 12-1-8 2-11 4-18Z"
        fill={`url(#${id})`}
      />
      <path
        data-part="core"
        d="M33 33c-5 5-6 13 0 16 7 3 11-5 7-11-1 4-4 5-7 2-2-2-1-5 0-7Z"
        fill="#F5F7FF"
      />
      {motion === 'increment' && (
        <g data-part="sparks" fill="#C7FF5E" aria-hidden="true">
          <circle cx="22" cy="18" r="1.5" />
          <circle cx="34" cy="12" r="1.5" />
          <circle cx="46" cy="18" r="1.5" />
        </g>
      )}
    </svg>
  )
}
