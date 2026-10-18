'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'
import { useBrandMotion } from '@/lib/hooks/useBrandMotion.hook'
import { getSkin } from '@/lib/game/skins'

type GhostAvatarProps = {
  skin?: string
  motion?: 'idle' | 'race' | 'win' | 'loss' | 'none'
  className?: string
  gradient?: [string, string]
}

const BODY = 'M15 32C15 21 22.8 13 32 13s17 8 17 19v17l-5.5-4-5.7 4-5.8-4-5.8 4-5.7-4-5.5 4V32Z'

export function GhostAvatar({
  skin = 'clean-specter',
  motion = 'idle',
  className,
  gradient,
}: GhostAvatarProps) {
  const id = useId()
  const preferences = useBrandMotion()
  const recipe = getSkin(skin) ?? getSkin('clean-specter')!
  const colors = gradient ?? recipe.avatar.gradient
  const effect = recipe.avatar.effect
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={`${recipe.name} ghost avatar`}
      data-vector="avatar"
      data-motion={motion}
      data-effect={effect}
      {...preferences}
      className={cn('brand-vector size-10', className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[1]} />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={BODY} />
        </clipPath>
        <pattern id={`${id}-bands`} width="64" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 1H64" stroke="#F5F7FF" strokeWidth="1" opacity=".35" />
        </pattern>
      </defs>
      <g data-part="avatar">
        {(motion === 'race' || effect === 'long-exposure') && (
          <g data-part="trails" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <path
                key={i}
                d={BODY}
                fill={`url(#${id})`}
                opacity={0.18 - i * 0.04}
                transform={`translate(${-3 * (i + 1)} ${i + 1})`}
                data-trail={i}
              />
            ))}
          </g>
        )}
        {effect === 'chromatic' && (
          <g data-part="chromatic-echoes" aria-hidden="true">
            <path d={BODY} stroke="#62F7E6" strokeWidth="2" data-part="echo-cyan" />
            <path d={BODY} stroke="#FF66DB" strokeWidth="2" data-part="echo-magenta" />
          </g>
        )}
        <path
          d={BODY}
          fill={effect === 'chromatic' && !gradient ? '#F5F7FF' : `url(#${id})`}
          stroke={recipe.avatar.rim}
          strokeWidth=".8"
          opacity=".92"
          data-part="body"
        />
        <g clipPath={`url(#${id}-clip)`} aria-hidden="true">
          {effect === 'scanline' && (
            <rect
              data-part="scan-bands"
              x="12"
              y="-24"
              width="40"
              height="112"
              fill={`url(#${id}-bands)`}
            />
          )}
          {effect === 'static' && (
            <g data-part="static-cuts" stroke="#070912" strokeWidth="1.5">
              <path d="M16 24h18M28 35h20M15 43h12" />
            </g>
          )}
          {effect === 'heatwave' && (
            <path
              data-part="heat-ribbon"
              d="M21 50Q30 42 26 33T33 13"
              stroke="#FFF0B3"
              strokeWidth="2"
              opacity=".4"
            />
          )}
        </g>
        {(effect === 'mint' || effect === 'ultraviolet') && (
          <g
            data-part="skin-particles"
            fill={effect === 'mint' ? '#C7FF5E' : '#A98BFF'}
            aria-hidden="true"
          >
            {[0, 1, 2, 3].map((i) =>
              effect === 'mint' ? (
                <rect key={i} x={10 + i * 13} y={21 + (i % 2) * 22} width="2" height="2" />
              ) : (
                <circle key={i} cx={10 + i * 13} cy={21 + (i % 2) * 22} r="1" />
              )
            )}
          </g>
        )}
        <path
          d="M25 30c2-3 4-3 6 0M35 30c2-3 4-3 6 0"
          stroke="#070912"
          strokeWidth="2.5"
          strokeLinecap="round"
          data-part="eyes"
        />
      </g>
    </svg>
  )
}
