'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Archive, FlaskConical, House, MoreHorizontal, Play, Settings, Shield, Sparkles, Trophy, User } from 'lucide-react'

const TABS = [
  { href: '/', label: 'Today', icon: House },
  { href: '/archive', label: 'Archive', icon: Archive },
  { href: '/play', label: 'Play', icon: Play, primary: true },
  { href: '/leagues', label: 'Leagues', icon: Trophy },
  { href: '/profile', label: 'Profile', icon: User }
]

export function BottomNav() {
  const pathname = usePathname()
  const [more, setMore] = useState(false)
  if (
    pathname === '/play/run' ||
    (pathname.startsWith('/challenge/') && pathname.endsWith('/race')) ||
    pathname.includes('/replay/')
  )
    return null
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`))
  const dev = process.env.NODE_ENV !== 'production'
  return (
    <>
      <div className="h-20" aria-hidden="true" />
      {more && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMore(false)}
          className="fixed inset-0 z-30 cursor-default"
        />
      )}
      <nav className="bottom-nav" aria-label="App" onKeyDown={(e) => e.key === 'Escape' && setMore(false)}>
        <div className="bottom-nav-inner">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                aria-current={active(tab.href) ? 'page' : undefined}
                data-active={active(tab.href) ? 'true' : 'false'}
                data-primary={tab.primary ? 'true' : 'false'}
                onClick={() => setMore(false)}
                className="bottom-nav-tab"
              >
                <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                <span>{tab.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMore((value) => !value)}
            aria-label="More"
            aria-expanded={more}
            data-active={more ? 'true' : 'false'}
            className="bottom-nav-tab"
          >
            <MoreHorizontal className="size-5" strokeWidth={1.8} aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
        {more && (
          <div className="bottom-nav-sheet" role="menu" aria-label="More sections">
            <Link href="/ghost-plus" role="menuitem" onClick={() => setMore(false)}>
              <Sparkles className="size-4" aria-hidden="true" /> Ghost+
            </Link>
            <Link href="/settings" role="menuitem" onClick={() => setMore(false)}>
              <Settings className="size-4" aria-hidden="true" /> Settings
            </Link>
            {dev && (
              <Link href="/dev" role="menuitem" onClick={() => setMore(false)}>
                <FlaskConical className="size-4" aria-hidden="true" /> Dev playtest
              </Link>
            )}
            <Link href="/privacy" role="menuitem" onClick={() => setMore(false)}>
              <Shield className="size-4" aria-hidden="true" /> Privacy
            </Link>
            <Link href="/terms" role="menuitem" onClick={() => setMore(false)}>
              <Shield className="size-4" aria-hidden="true" /> Terms
            </Link>
          </div>
        )}
      </nav>
    </>
  )
}
