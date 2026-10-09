import { cn } from '@/lib/utils'

type GhostAvatarProps = {
  motion?: 'idle' | 'none'
  className?: string
  gradient?: [string, string]
}

export function GhostAvatar({ motion = 'idle', className, gradient = ['#62F7E6', '#A98BFF'] }: GhostAvatarProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Ghost avatar"
      className={cn('size-10', motion === 'idle' && 'mark-ambient-body', className)}
    >
      <defs>
        <linearGradient id="ghost-avatar-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={gradient[0]} />
          <stop offset="1" stopColor={gradient[1]} />
        </linearGradient>
      </defs>
      <path
        d="M15 32C15 21 22.8 13 32 13s17 8 17 19v17l-5.5-4-5.7 4-5.8-4-5.8 4-5.7-4-5.5 4V32Z"
        fill="url(#ghost-avatar-g)"
        opacity=".92"
        data-part="body"
      />
      <path
        d="M25 30c2-3 4-3 6 0M35 30c2-3 4-3 6 0"
        stroke="#070912"
        strokeWidth="2.5"
        strokeLinecap="round"
        data-part="eyes"
      />
    </svg>
  )
}
