import Link from 'next/link'
import { Ghost60Mark } from '@/components/brand/ghost60-mark'

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4 sm:max-w-2xl">
        <Link href="/" className="flex items-center gap-2" aria-label="Ghost60 home">
          <Ghost60Mark motion="none" className="size-8" />
          <span className="font-display text-sm font-800 tracking-[0.18em] text-ghost-text">
            GHOST<span className="text-spectral-cyan">60</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm" aria-label="Primary">
          <Link
            href="/profile"
            className="rounded-control px-3 py-2 text-ghost-muted transition-colors hover:text-ghost-text"
          >
            Profile
          </Link>
          <Link
            href="/leagues"
            className="rounded-control px-3 py-2 text-ghost-muted transition-colors hover:text-ghost-text"
          >
            Leagues
          </Link>
          <Link
            href="/ghost-plus"
            className="rounded-control border border-spectral-violet/40 px-3 py-2 text-spectral-violet transition-colors hover:bg-spectral-violet/10"
          >
            Ghost+
          </Link>
        </nav>
      </div>
    </header>
  )
}
