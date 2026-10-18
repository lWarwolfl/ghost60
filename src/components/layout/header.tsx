import Link from 'next/link'
import { Ghost60Mark } from '@/components/brand/ghost60-mark'
import { Ghost60Wordmark } from '@/components/brand/ghost60-wordmark'

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4 sm:max-w-2xl">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Ghost60 home">
          <Ghost60Mark motion="none" className="size-8 min-[380px]:hidden" />
          <Ghost60Wordmark className="hidden h-7 w-24 min-[380px]:block" />
        </Link>
        <nav className="flex items-center gap-0.5 overflow-x-auto text-[13px] sm:gap-1 sm:text-sm" aria-label="Primary">
          <Link
            href="/profile"
            className="whitespace-nowrap rounded-control px-2 py-2 text-ghost-muted transition-colors hover:text-ghost-text sm:px-3"
          >
            Profile
          </Link>
          <Link
            href="/leagues"
            className="whitespace-nowrap rounded-control px-2 py-2 text-ghost-muted transition-colors hover:text-ghost-text sm:px-3"
          >
            Leagues
          </Link>
          <Link
            href="/archive"
            className="whitespace-nowrap rounded-control px-2 py-2 text-ghost-muted transition-colors hover:text-ghost-text sm:px-3"
          >
            Archive
          </Link>
          <Link
            href="/ghost-plus"
            className="whitespace-nowrap rounded-control border border-spectral-violet/40 px-2 py-2 text-spectral-violet transition-colors hover:bg-spectral-violet/10 sm:px-3"
          >
            Ghost+
          </Link>
        </nav>
      </div>
    </header>
  )
}
