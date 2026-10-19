'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'
import { useBrandMotion } from '@/lib/hooks/useBrandMotion.hook'

type GameIconProps = {
  game: 'pulse' | 'snap' | 'orbit' | 'recall' | 'shift' | 'trace'
  motion?: 'ambient' | 'active' | 'complete' | 'none'
  orbitAngle?: number
  direction?: 'forward' | 'backward'
  outcome?: 'success' | 'error'
  className?: string
}

export function GameIcon({
  game,
  motion = 'ambient',
  orbitAngle,
  direction = 'forward',
  outcome = 'success',
  className,
}: GameIconProps) {
  const id = useId()
  const preferences = useBrandMotion()
  const paths = {
    pulse: (
      <>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#62F7E6" />
            <stop offset="1" stopColor="#A98BFF" />
          </linearGradient>
        </defs>
        <circle
          data-part="outer-ring"
          cx="32"
          cy="32"
          r="20"
          stroke="#62F7E6"
          strokeWidth="3"
          opacity=".35"
        />
        <circle
          data-part="inner-ring"
          cx="32"
          cy="32"
          r="13"
          stroke={`url(#${id})`}
          strokeWidth="4"
        />
        <circle data-part="dot" cx="32" cy="32" r="4" fill="#F5F7FF" />
      </>
    ),
    snap: (
      <>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#62F7E6" />
            <stop offset="1" stopColor="#A98BFF" />
          </linearGradient>
        </defs>
        <path
          data-part="brackets"
          d="M12 22v-8h8M52 42v8h-8"
          stroke={`url(#${id})`}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          data-part="brackets-opposite"
          d="M44 14h8v8M20 50h-8v-8"
          stroke={`url(#${id})`}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          data-part="star"
          d="M32 21l3.2 6.8L42 31l-6.8 3.2L32 41l-3.2-6.8L22 31l6.8-3.2L32 21Z"
          fill="#F5F7FF"
        />
      </>
    ),
    orbit: (
      <>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#62F7E6" />
            <stop offset="1" stopColor="#A98BFF" />
          </linearGradient>
        </defs>
        <circle data-part="ring" cx="32" cy="32" r="18" stroke="#9099AD" strokeWidth="3" />
        <path
          data-part="target-arc"
          d="M46 20a18 18 0 0 1 3.7 11"
          stroke={`url(#${id})`}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle
          style={
            (motion === 'active' || motion === 'complete') && Number.isFinite(orbitAngle)
              ? { transform: `rotate(${(orbitAngle ?? 180) - 180}deg)` }
              : undefined
          }
          data-part="marker"
          cx="14"
          cy="32"
          r="4"
          fill="#C7FF5E"
        />
      </>
    ),
    recall: (
      <>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#62F7E6" />
            <stop offset="1" stopColor="#A98BFF" />
          </linearGradient>
        </defs>
        <g data-part="cells" stroke="#9099AD" strokeWidth="2">
          <rect x="14" y="14" width="11" height="11" rx="2" />
          <rect x="27" y="14" width="11" height="11" rx="2" />
          <rect x="40" y="14" width="11" height="11" rx="2" />
          <rect x="14" y="27" width="11" height="11" rx="2" />
          <rect x="27" y="27" width="11" height="11" rx="2" />
          <rect x="40" y="27" width="11" height="11" rx="2" />
          <rect x="14" y="40" width="11" height="11" rx="2" />
          <rect x="27" y="40" width="11" height="11" rx="2" />
          <rect x="40" y="40" width="11" height="11" rx="2" />
        </g>
        <rect data-part="sample-0" x="27" y="14" width="11" height="11" rx="2" fill="#62F7E6" />
        <rect data-part="sample-1" x="40" y="27" width="11" height="11" rx="2" fill="#A98BFF" />
        <rect data-part="sample-2" x="14" y="40" width="11" height="11" rx="2" fill="#F5F7FF" />
      </>
    ),
    shift: (
      <>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#62F7E6" />
            <stop offset="1" stopColor="#A98BFF" />
          </linearGradient>
        </defs>
        <g data-part="forward">
          <path d="M14 22h24" stroke="#62F7E6" strokeWidth="5" strokeLinecap="round" />
          <path
            d="M32 15l8 7-8 7"
            stroke="#62F7E6"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <g data-part="backward">
          <path d="M50 42H26" stroke="#A98BFF" strokeWidth="5" strokeLinecap="round" />
          <path
            d="M32 35l-8 7 8 7"
            stroke="#A98BFF"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </>
    ),
    trace: (
      <>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#62F7E6" />
            <stop offset="1" stopColor="#A98BFF" />
          </linearGradient>
        </defs>
        <path
          pathLength="1"
          data-part="curve"
          d="M12 44C20 17 30 51 38 24c4-13 9-10 14-4"
          stroke={`url(#${id})`}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle data-part="start" cx="13" cy="44" r="4" fill="#F5F7FF" />
        <circle data-part="gate" cx="38" cy="24" r="4" fill="#C7FF5E" />
        <circle data-part="end" cx="52" cy="20" r="4" fill="#F5F7FF" />
        <circle data-part="traveler" r="2.5" fill="#62F7E6" />
      </>
    ),
  }
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={`${game} icon`}
      data-vector="game"
      data-game={game}
      data-motion={motion}
      data-direction={direction}
      data-outcome={outcome}
      {...preferences}
      className={cn('brand-vector size-8', className)}
    >
      {paths[game]}
    </svg>
  )
}
