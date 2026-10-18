import Link from 'next/link'
import { Ghost60Wordmark } from '@/components/brand/ghost60-wordmark'

export function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-1 px-4 py-6 text-xs text-ghost-muted sm:max-w-2xl">
        <Ghost60Wordmark className="h-8 w-36" />
        <p className="font-display tracking-[0.18em]">SIGNAL LOST</p>
        <p>One shared game per day. One ranked run. Leave a ghost.</p>
        <p className="flex gap-4">
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
          <Link href="/terms" className="underline">
            Terms
          </Link>
        </p>
      </div>
    </footer>
  )
}
