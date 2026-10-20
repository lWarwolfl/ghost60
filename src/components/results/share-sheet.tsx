'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Download, Image as ImageIcon, Share2, X } from 'lucide-react'
import { GhostAvatar } from '@/components/brand/ghost-avatar'
import { track } from '@/lib/analytics/track'
import { getSkin } from '@/lib/game/skins'
import { shareFileName, shareMessage } from '@/lib/game/share'
import { renderShareCard } from '@/lib/game/share-card'

export type TShareSheetData = {
  url: string
  score: number
  gameTitle: string
  gameId: string
  gameDate: string
  handle?: string | null
  ghostSkin?: string | null
  personalBest: boolean
  streak: number
  challengeHandle?: string | null
  challengeTarget?: number
}

function displayDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return date
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    })
    .toUpperCase()
}

function shortUrl(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function ShareSheet({
  open,
  onClose,
  data
}: {
  open: boolean
  onClose: () => void
  data: TShareSheetData
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [card, setCard] = useState<{ url: string; blob: Blob } | null>(null)
  const [cardError, setCardError] = useState(false)
  const cardUrl = useRef<string | null>(null)
  const absolute =
    typeof window === 'undefined' ? data.url : new URL(data.url, window.location.origin).toString()
  const handle = data.handle?.replace(/^@/, '') ?? 'anonymous'
  const text = shareMessage({
    score: data.score,
    gameTitle: data.gameTitle,
    challengeHandle: data.challengeHandle
  })

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, a[href], [tabindex]:not([tabindex="-1"])'
        )
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [open])

  useEffect(() => () => {
    if (cardUrl.current) URL.revokeObjectURL(cardUrl.current)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const skin = getSkin(data.ghostSkin ?? '')
    const gradient: [string, string] = skin?.avatar.gradient ?? ['#62F7E6', '#A98BFF']
    void renderShareCard({
      score: data.score,
      gameTitle: data.gameTitle,
      gameId: data.gameId,
      dateLabel: displayDate(data.gameDate),
      handle: data.handle,
      personalBest: data.personalBest,
      streak: data.streak,
      challengeHandle: data.challengeHandle,
      challengeTarget: data.challengeTarget,
      url: absolute,
      ghostGradient: gradient
    })
      .then((blob) => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        const previous = cardUrl.current
        cardUrl.current = url
        setCard({ url, blob })
        setCardError(false)
        if (previous) setTimeout(() => URL.revokeObjectURL(previous), 0)
      })
      .catch(() => {
        if (!cancelled) setCardError(true)
      })
    return () => {
      cancelled = true
    }
  }, [
    open,
    absolute,
    data.score,
    data.gameTitle,
    data.gameId,
    data.gameDate,
    data.handle,
    data.ghostSkin,
    data.personalBest,
    data.streak,
    data.challengeHandle,
    data.challengeTarget
  ])

  const copiedFor = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (copiedFor.current) clearTimeout(copiedFor.current)
    },
    []
  )

  const markCopied = () => {
    setCopied(true)
    setError(null)
    setNotice(null)
    if (copiedFor.current) clearTimeout(copiedFor.current)
    copiedFor.current = setTimeout(() => setCopied(false), 2500)
  }

  const copy = async (source: 'button' | 'fallback') => {
    try {
      await navigator.clipboard.writeText(absolute)
      markCopied()
      track('challenge_shared', { surface: 'result_sheet', action: `copy_${source}` })
    } catch {
      setError('Couldn’t copy the link. Select it below and copy manually.')
    }
  }

  const saveImage = () => {
    if (!card) return
    const link = document.createElement('a')
    link.href = card.url
    link.download = shareFileName(data.gameTitle, data.score)
    document.body.appendChild(link)
    link.click()
    link.remove()
    setError(null)
    setNotice('Image saved to your device.')
    track('challenge_shared', { surface: 'result_sheet', action: 'image_save' })
  }

  const shareImage = async () => {
    if (!card) return
    setError(null)
    setNotice(null)
    let file: File
    try {
      file = new File([card.blob], shareFileName(data.gameTitle, data.score), {
        type: 'image/png'
      })
    } catch {
      saveImage()
      return
    }
    const canShareImage =
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    if (canShareImage) {
      try {
        await navigator.share({ files: [file], title: `Ghost60 · ${data.gameTitle}`, text })
        track('challenge_shared', { surface: 'result_sheet', action: 'image_native' })
        onCloseRef.current()
        return
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
      }
    }
    saveImage()
  }

  const shareLink = async () => {
    setError(null)
    setNotice(null)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Ghost60 · ${data.gameTitle}`, text, url: absolute })
        track('challenge_shared', { surface: 'result_sheet', action: 'link_native' })
        onCloseRef.current()
        return
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
      }
    }
    await copy('button')
  }

  if (!open) return null

  return createPortal(
    <div
      className="bg-ink-950/82 fixed inset-0 z-50 flex items-end justify-center p-0 backdrop-blur-md motion-safe:animate-enter sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sheet-title"
        aria-describedby="share-sheet-copy"
        className="border-white/12 bg-ink-900 max-h-[94dvh] w-full overflow-y-auto rounded-t-[30px] border p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-24px_80px_-20px_rgba(0,0,0,0.9)] sm:max-w-md sm:rounded-[30px] sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-spectral-cyan text-[10px] tracking-[0.28em] uppercase">
              Signal captured
            </p>
            <h2
              id="share-sheet-title"
              className="font-display mt-1 text-2xl font-800 tracking-[-0.02em]"
            >
              Leave a trace.
            </h2>
            <p
              id="share-sheet-copy"
              className="text-ghost-muted mt-1 max-w-[30ch] text-xs leading-5"
            >
              Your ghost is attached. Send the card, or the link, to someone who thinks they can
              catch you.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close share sheet"
            className="border-white/12 text-ghost-muted hover:text-ghost-text flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {card ? (
          <Image
            src={card.url}
            alt={`Ghost60 share card: ${data.score} points in ${data.gameTitle}`}
            width={1080}
            height={1350}
            unoptimized
            className="border-white/12 h-auto w-full rounded-[22px] border"
          />
        ) : (
          <ShareCard
            data={data}
            handle={handle}
            absolute={absolute}
            date={displayDate(data.gameDate)}
          />
        )}
        {cardError ? (
          <p className="text-rival-coral mt-2 text-center text-[10px]">
            Couldn’t render the image. Link sharing still works.
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void shareImage()}
            disabled={!card}
            className="rounded-control bg-spectral-cyan font-display text-ink-950 flex min-h-12 items-center justify-center gap-2 px-4 text-xs font-800 tracking-[0.16em] disabled:opacity-40 sm:col-span-2"
          >
            <ImageIcon className="size-4" aria-hidden="true" />
            {card ? 'SHARE IMAGE' : cardError ? 'IMAGE UNAVAILABLE' : 'RENDERING IMAGE…'}
          </button>
          <button
            type="button"
            onClick={() => void shareLink()}
            className="rounded-control font-display flex min-h-11 items-center justify-center gap-2 border border-white/15 px-3 text-[10px] font-800 tracking-[0.14em]"
          >
            <Share2 className="size-4" aria-hidden="true" />
            SHARE LINK
          </button>
          <button
            type="button"
            onClick={saveImage}
            disabled={!card}
            className="rounded-control font-display flex min-h-11 items-center justify-center gap-2 border border-white/15 px-3 text-[10px] font-800 tracking-[0.14em] disabled:opacity-40"
          >
            <Download className="size-4" aria-hidden="true" />
            SAVE IMAGE
          </button>
          <button
            type="button"
            onClick={() => void copy('button')}
            className="rounded-control font-display flex min-h-10 items-center justify-center gap-2 px-3 text-[10px] font-800 tracking-[0.14em] text-ghost-muted sm:col-span-2"
          >
            {copied ? (
              <Check className="text-signal-lime size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied ? 'COPIED' : 'COPY LINK'}
          </button>
        </div>
        {error || notice || copied ? (
          <p
            role="status"
            className={`mt-3 text-center text-[10px] ${error ? 'text-rival-coral' : 'text-signal-lime'}`}
          >
            {error ?? notice ?? 'Link copied. It’s ready to paste.'}
          </p>
        ) : null}
        {error ? (
          <input
            readOnly
            value={absolute}
            aria-label="Ghost challenge link"
            onFocus={(event) => event.currentTarget.select()}
            className="border-white/10 bg-ink-950 rounded-control text-ghost-muted mt-2 w-full border px-3 py-2 text-[10px]"
          />
        ) : null}
      </section>
    </div>,
    document.body
  )
}

function ShareCard({
  data,
  handle,
  date,
  absolute
}: {
  data: TShareSheetData
  handle: string
  date: string
  absolute: string
}) {
  const rival = data.challengeHandle
    ? data.challengeHandle.startsWith('@')
      ? data.challengeHandle
      : `@${data.challengeHandle}`
    : null
  return (
    <article
      className="relative overflow-hidden rounded-[22px] border border-white/12 bg-ink-950 p-5 shadow-[0_24px_70px_-36px_rgba(0,0,0,1)]"
      style={{
        backgroundImage: [
          'radial-gradient(120% 90% at 88% 4%, rgba(98,247,230,0.18), transparent 48%)',
          'radial-gradient(90% 75% at 4% 100%, rgba(169,139,255,0.18), transparent 60%)',
          'linear-gradient(rgba(245,247,255,0.035) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(245,247,255,0.035) 1px, transparent 1px)'
        ].join(','),
        backgroundSize: 'auto, auto, 26px 26px, 26px 26px'
      }}
    >
      <div className="pointer-events-none absolute -top-16 -right-14 size-48 rounded-full border border-spectral-cyan/20" />
      <div className="pointer-events-none absolute -top-9 -right-7 size-36 rounded-full border border-spectral-violet/20" />
      <div className="bg-spectral-cyan pointer-events-none absolute top-[38%] right-8 size-1.5 rounded-full shadow-[0_0_18px_6px_rgba(98,247,230,0.35)]" />

      <div className="relative flex items-center justify-between gap-3">
        <p className="font-display text-[11px] font-800 tracking-[0.34em]">GHOST60</p>
        <p className="text-ghost-muted text-right text-[8px] tracking-[0.18em] uppercase">
          Daily signal · {date}
        </p>
      </div>

      <div className="relative mt-8 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-spectral-violet text-[9px] tracking-[0.24em] uppercase">
            {data.gameId} · run score
          </p>
          <p className="tnum font-display mt-1 text-[clamp(3rem,15vw,5rem)] leading-[0.82] font-800 tracking-[-0.04em]">
            {data.score}
          </p>
          <p className="font-display mt-3 max-w-[13ch] text-xl leading-[1.05] font-800">
            {data.gameTitle}
          </p>
        </div>
        <div className="relative flex size-20 shrink-0 items-center justify-center sm:size-28">
          <div className="border-spectral-cyan/25 absolute inset-0 rotate-[-18deg] rounded-full border" />
          <div className="border-spectral-violet/30 absolute inset-2 rotate-[24deg] rounded-full border" />
          <GhostAvatar
            skin={data.ghostSkin ?? undefined}
            motion={data.personalBest ? 'win' : 'idle'}
            className="relative size-16 sm:size-24"
          />
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-1.5">
        {data.personalBest ? (
          <span className="border-signal-lime/50 text-signal-lime rounded-full border px-2 py-1 text-[8px] font-600 tracking-[0.14em] uppercase">
            New personal best
          </span>
        ) : null}
        {data.streak > 0 ? (
          <span className="border-white/12 text-ghost-muted rounded-full border px-2 py-1 text-[8px] tracking-[0.14em] uppercase">
            {data.streak} day streak
          </span>
        ) : null}
        {rival ? (
          <span className="border-spectral-violet/40 text-spectral-violet rounded-full border px-2 py-1 text-[8px] tracking-[0.14em] uppercase">
            vs {rival}
            {data.challengeTarget ? ` · ${data.challengeTarget}` : ''}
          </span>
        ) : null}
      </div>

      <div className="relative mt-5 border-t border-dashed border-white/15 pt-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-ghost-muted text-[8px] tracking-[0.2em] uppercase">Ghost left by</p>
            <p className="font-display mt-1 text-sm font-600">@{handle}</p>
          </div>
          <p className="text-spectral-cyan text-right text-[8px] leading-4 tracking-[0.18em] uppercase">
            Catch it
            <br />
            if you can
          </p>
        </div>
        <p className="text-ghost-muted/70 mt-3 truncate text-[8px] tracking-[0.12em]">
          {shortUrl(absolute)}
        </p>
      </div>
    </article>
  )
}
