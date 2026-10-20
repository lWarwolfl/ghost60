import { SettingsClient } from '@/app/settings/page.client'
import { DangerZoneClient } from '@/app/settings/danger.client'
import { PrefsClient } from '@/app/settings/prefs.client'

export default function SettingsPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-spectral-cyan">Settings</p>
          <h1 className="font-display text-3xl font-800">App & updates</h1>
        </div>
        <SettingsClient />
        <PrefsClient />
        <DangerZoneClient />
        <p className="flex gap-4 text-xs">
          <a href="/privacy" className="text-ghost-muted underline">
            Privacy
          </a>
          <a href="/terms" className="text-ghost-muted underline">
            Terms
          </a>
        </p>
      </main>
    </div>
  )
}
