'use client'

import { useState } from 'react'

export function ShareButtons({ url, title, text }: { url: string; title: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const absolute = typeof window === 'undefined' ? url : new URL(url, window.location.origin).toString()

  const share = async () => {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title, text, url: absolute })
        return
      } catch {
        return
      }
    }
    try {
      await navigator.clipboard.writeText(absolute)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      return
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void share()}
        className="flex min-h-12 items-center justify-center rounded-control bg-spectral-cyan px-5 font-display text-sm font-800 tracking-[0.14em] text-ink-950"
      >
        SHARE GHOST LINK
      </button>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard
            .writeText(absolute)
            .then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2500)
            })
            .catch(() => undefined)
        }}
        className="tnum truncate rounded-control border border-white/15 bg-ink-900 px-4 py-3 text-center text-xs text-ghost-muted"
        aria-live="polite"
      >
        {copied ? 'Link copied ✓' : absolute}
      </button>
    </div>
  )
}
