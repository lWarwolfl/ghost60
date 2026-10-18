'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'
import { useBrandMotion } from '@/lib/hooks/useBrandMotion.hook'

export function Ghost60Wordmark({
  motion = 'none',
  className,
}: {
  motion?: 'enter' | 'none'
  className?: string
}) {
  const id = useId()
  const preferences = useBrandMotion()
  return (
    <svg
      viewBox="0 0 560 120"
      fill="none"
      role="img"
      aria-label="Ghost60"
      data-vector="wordmark"
      data-motion={motion}
      {...preferences}
      className={cn('brand-vector h-10 w-auto', className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#62F7E6" />
          <stop offset="1" stopColor="#A98BFF" />
        </linearGradient>
      </defs>
      <g data-part="wordmark-mark">
        <path
          d="M24 62C24 39 40 24 60 24s36 15 36 38v30l-12-8-12 8-12-8-12 8-12-8-12 8V62Z"
          stroke={`url(#${id})`}
          strokeWidth="7"
        />
        <circle cx="49" cy="60" r="4" fill="#F5F7FF" />
        <circle cx="71" cy="60" r="4" fill="#F5F7FF" />
      </g>
      <text
        data-part="wordmark-ghost"
        x="120"
        y="82"
        fill="#F5F7FF"
        fontFamily="Arial,Helvetica,sans-serif"
        fontSize="62"
        fontWeight="800"
        letterSpacing="2"
      >
        GHOST
      </text>
      <text
        data-part="wordmark-60"
        x="370"
        y="82"
        fill={`url(#${id})`}
        fontFamily="Arial,Helvetica,sans-serif"
        fontSize="62"
        fontWeight="900"
      >
        60
      </text>
    </svg>
  )
}
