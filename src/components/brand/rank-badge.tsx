'use client'

import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useBrandMotion } from '@/lib/hooks/useBrandMotion.hook'

export type GhostRank = 'wisp' | 'shade' | 'haunt' | 'specter' | 'phantom'

type RankBadgeProps = {
  rank: GhostRank
  previousRank?: GhostRank
  motion?: 'ambient' | 'enter' | 'promote' | 'none'
  className?: string
}

const PALETTE: Record<GhostRank, [string, string]> = {
  wisp: ['#C7FF5E', '#62F7E6'],
  shade: ['#A98BFF', '#62F7E6'],
  haunt: ['#FF668F', '#A98BFF'],
  specter: ['#62F7E6', '#A98BFF'],
  phantom: ['#F5F7FF', '#A98BFF']
}

export function RankBadge({ rank, previousRank, motion = 'none', className }: RankBadgeProps) {
  const id = useId()
  const preferences = useBrandMotion()
  const [skippedRank, setSkippedRank] = useState<GhostRank | null>(null)
  const promoting = motion === 'promote' && skippedRank !== rank

  const gradient = (value: GhostRank) => (
    <defs>
      <linearGradient id={`${id}-${value}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={PALETTE[value][0]} />
        <stop offset="1" stopColor={PALETTE[value][1]} />
      </linearGradient>
      <radialGradient id={`${id}-${value}-core`}>
        <stop offset="0" stopColor={PALETTE[value][0]} stopOpacity=".85" />
        <stop offset="1" stopColor={PALETTE[value][0]} stopOpacity="0" />
      </radialGradient>
    </defs>
  )

  const paths: Record<GhostRank, ReactNode> = {
    wisp: (
      <>
        {gradient('wisp')}
        <path
          pathLength="1"
          data-part="geometry"
          d="M32 6C39 17 49 23 49 36a17 17 0 0 1-34 0C15 23 25 17 32 6Z"
          fill="#0B0F1A"
          stroke={`url(#${id}-wisp)`}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle data-part="ring" cx="32" cy="35" r="9" fill={`url(#${id}-wisp-core)`} />
        <circle data-part="center" cx="32" cy="35" r="3.5" fill={PALETTE.wisp[0]} />
        <path d="M32 44c4 0 6-2.5 6-5" stroke={PALETTE.wisp[1]} strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
      </>
    ),
    shade: (
      <>
        {gradient('shade')}
        <path
          pathLength="1"
          data-part="geometry"
          d="M32 6 47 18v18l-5 22-10-8-10 8-5-22V18L32 6Z"
          fill="#0B0F1A"
          stroke={`url(#${id}-shade)`}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path data-part="ring" d="M24 30c0-5 3.5-8 8-8s8 3 8 8v3H24v-3Z" fill="#F5F7FF" opacity=".14" />
        <circle data-part="center" cx="27" cy="32" r="2.4" fill={PALETTE.shade[1]} />
        <circle cx="37" cy="32" r="2.4" fill={PALETTE.shade[1]} />
        <path d="M27 40h10" stroke={PALETTE.shade[0]} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    haunt: (
      <>
        {gradient('haunt')}
        <path
          pathLength="1"
          data-part="geometry"
          d="M32 7a25 25 0 1 1-17.7 42.7M32 7a25 25 0 0 0-17.7 7.3"
          fill="none"
          stroke={`url(#${id}-haunt)`}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle data-part="ring" cx="32" cy="32" r="16" fill="#0B0F1A" stroke={PALETTE.haunt[1]} strokeWidth="1.5" opacity=".9" />
        <path d="M24 29h5M35 29h5" stroke="#F5F7FF" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M27 39c3 2.5 7 2.5 10 0" stroke={PALETTE.haunt[0]} strokeWidth="2.2" strokeLinecap="round" />
      </>
    ),
    specter: (
      <>
        {gradient('specter')}
        <path
          pathLength="1"
          data-part="geometry"
          d="M32 5 57 32 32 59 7 32 32 5Z"
          fill="#0B0F1A"
          stroke={`url(#${id}-specter)`}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle data-part="ring" cx="32" cy="32" r="12" fill="none" stroke="#F5F7FF" strokeWidth="1.4" opacity=".4" />
        <ellipse cx="32" cy="32" rx="10" ry="6" fill={`url(#${id}-specter-core)`} />
        <circle data-part="center" cx="32" cy="32" r="3.4" fill={PALETTE.specter[0]} />
        <path d="M8 32h-3M59 32h-3M32 5V2M32 62v-3" stroke={PALETTE.specter[1]} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    phantom: (
      <>
        {gradient('phantom')}
        <path
          pathLength="1"
          data-part="geometry"
          d="M9 45V21l12 8L32 11l11 18 12-8v24l-11 7-12-6-12 6-11-7Z"
          fill="#0B0F1A"
          stroke={`url(#${id}-phantom)`}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle data-part="ring" cx="32" cy="31" r="9" fill="none" stroke="#F5F7FF" strokeWidth="1.6" />
        <circle data-part="center" cx="32" cy="31" r="4" fill={PALETTE.phantom[1]} />
        <path d="M27 43h10" stroke={PALETTE.phantom[0]} strokeWidth="1.8" strokeLinecap="round" opacity=".8" />
        <path d="M14 18 9 12M50 18l5-6" stroke={PALETTE.phantom[1]} strokeWidth="2" strokeLinecap="round" opacity=".7" />
      </>
    )
  }

  const badge = (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={`${rank} rank`}
      data-vector="rank"
      data-rank={rank}
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
        <g data-part="burst" aria-hidden="true" fill={PALETTE[rank][0]}>
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
