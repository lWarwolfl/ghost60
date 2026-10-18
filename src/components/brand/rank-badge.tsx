'use client'

import { useId, useState } from 'react'
import { cn } from '@/lib/utils'
import { useBrandMotion } from '@/lib/hooks/useBrandMotion.hook'

export type GhostRank = 'wisp' | 'shade' | 'haunt' | 'specter' | 'phantom'

type RankBadgeProps = {
  rank: GhostRank
  previousRank?: GhostRank
  motion?: 'ambient' | 'enter' | 'promote' | 'none'
  className?: string
}

export function RankBadge({ rank, previousRank, motion = 'none', className }: RankBadgeProps) {
  const id = useId()
  const preferences = useBrandMotion()
  const [skippedRank, setSkippedRank] = useState<GhostRank | null>(null)
  const promoting = motion === 'promote' && skippedRank !== rank
  const paths = {
    haunt: (
      <>
        {' '}
        <defs>
          <linearGradient id={`${id}-haunt`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#62F7E6" />
            <stop offset="1" stopColor="#A98BFF" />
          </linearGradient>
        </defs>
        <polygon
          pathLength="1"
          data-part="geometry"
          points="32.0,8.0 39.6,21.5 54.8,24.6 44.4,36.0 46.1,51.4 32.0,45.0 17.9,51.4 19.6,36.0 9.2,24.6 24.4,21.5"
          stroke={`url(#${id}-haunt)`}
          strokeWidth="3"
          fill="#0B0F1A"
        />
        <circle
          data-part="ring"
          cx="32"
          cy="32"
          r="8"
          fill="none"
          stroke="#F5F7FF"
          strokeWidth="2"
        />
        <circle data-part="center" cx="32" cy="32" r="3.0" fill="#C7FF5E" />{' '}
      </>
    ),
    phantom: (
      <>
        {' '}
        <defs>
          <linearGradient id={`${id}-phantom`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#62F7E6" />
            <stop offset="1" stopColor="#A98BFF" />
          </linearGradient>
        </defs>
        <polygon
          pathLength="1"
          data-part="geometry"
          points="32.0,8.0 40.8,19.9 54.8,24.6 46.3,36.6 46.1,51.4 32.0,47.0 17.9,51.4 17.7,36.6 9.2,24.6 23.2,19.9"
          stroke={`url(#${id}-phantom)`}
          strokeWidth="3"
          fill="#0B0F1A"
        />
        <circle
          data-part="ring"
          cx="32"
          cy="32"
          r="10"
          fill="none"
          stroke="#F5F7FF"
          strokeWidth="2"
        />
        <circle data-part="center" cx="32" cy="32" r="4.0" fill="#C7FF5E" />{' '}
      </>
    ),
    shade: (
      <>
        {' '}
        <defs>
          <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#62F7E6" />
            <stop offset="1" stopColor="#A98BFF" />
          </linearGradient>
        </defs>
        <polygon
          pathLength="1"
          data-part="geometry"
          points="32.0,8.0 39.1,22.3 54.8,24.6 43.4,35.7 46.1,51.4 32.0,44.0 17.9,51.4 20.6,35.7 9.2,24.6 24.9,22.3"
          stroke={`url(#${id}-shade)`}
          strokeWidth="3"
          fill="#0B0F1A"
        />
        <circle
          data-part="ring"
          cx="32"
          cy="32"
          r="7"
          fill="none"
          stroke="#F5F7FF"
          strokeWidth="2"
        />
        <circle data-part="center" cx="32" cy="32" r="2.5" fill="#C7FF5E" />{' '}
      </>
    ),
    specter: (
      <>
        {' '}
        <defs>
          <linearGradient id={`${id}-specter`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#62F7E6" />
            <stop offset="1" stopColor="#A98BFF" />
          </linearGradient>
        </defs>
        <polygon
          pathLength="1"
          data-part="geometry"
          points="32.0,8.0 40.2,20.7 54.8,24.6 45.3,36.3 46.1,51.4 32.0,46.0 17.9,51.4 18.7,36.3 9.2,24.6 23.8,20.7"
          stroke={`url(#${id}-specter)`}
          strokeWidth="3"
          fill="#0B0F1A"
        />
        <circle
          data-part="ring"
          cx="32"
          cy="32"
          r="9"
          fill="none"
          stroke="#F5F7FF"
          strokeWidth="2"
        />
        <circle data-part="center" cx="32" cy="32" r="3.5" fill="#C7FF5E" />{' '}
      </>
    ),
    wisp: (
      <>
        {' '}
        <defs>
          <linearGradient id={`${id}-wisp`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#62F7E6" />
            <stop offset="1" stopColor="#A98BFF" />
          </linearGradient>
        </defs>
        <polygon
          pathLength="1"
          data-part="geometry"
          points="32.0,8.0 38.5,23.1 54.8,24.6 42.5,35.4 46.1,51.4 32.0,43.0 17.9,51.4 21.5,35.4 9.2,24.6 25.5,23.1"
          stroke={`url(#${id}-wisp)`}
          strokeWidth="3"
          fill="#0B0F1A"
        />
        <circle
          data-part="ring"
          cx="32"
          cy="32"
          r="6"
          fill="none"
          stroke="#F5F7FF"
          strokeWidth="2"
        />
        <circle data-part="center" cx="32" cy="32" r="2.0" fill="#C7FF5E" />{' '}
      </>
    ),
  }
  const badge = (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={`${rank} rank`}
      data-vector="rank"
      data-motion={promoting ? 'promote' : motion === 'promote' ? 'none' : motion}
      {...preferences}
      className={cn('brand-vector size-12', className)}
    >
      {promoting && previousRank && previousRank !== rank && (
        <g data-part="old-badge" aria-hidden="true">
          {paths[previousRank]}
        </g>
      )}
      <g data-part="new-badge">{paths[rank]}</g>
      {promoting && (
        <g data-part="burst" aria-hidden="true" fill="#62F7E6">
          {Array.from({ length: 8 }, (_, i) => (
            <g key={i} transform={`rotate(${i * 45} 32 32)`}>
              <circle cx="32" cy="12" r="1" />
            </g>
          ))}
        </g>
      )}
      {promoting && (
        <text data-part="rank-title" x="32" y="61" textAnchor="middle" fill="#F5F7FF" fontSize="6">
          {rank.toUpperCase()}
        </text>
      )}
    </svg>
  )
  return promoting ? (
    <button
      type="button"
      aria-label={`Skip ${rank} promotion animation`}
      onClick={() => setSkippedRank(rank)}
      className="rounded-control inline-flex"
    >
      {badge}
    </button>
  ) : (
    badge
  )
}
