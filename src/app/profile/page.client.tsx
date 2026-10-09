'use client'

import Link from 'next/link'
import { useState } from 'react'
import { GhostAvatar } from '@/components/brand/ghost-avatar'
import { StreakWisp } from '@/components/brand/streak-wisp'
import { useEquipCosmetics } from '@/features/game/mutations/useEquipCosmetics.mutation'
import { useProfile } from '@/features/game/queries/useProfile.query'

function dayStrings(count: number) {
  const out: string[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i -= 1) {
    out.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)).toISOString().slice(0, 10))
  }
  return out
}

export function ProfileClient() {
  const { data, isLoading, isError } = useProfile()
  const equip = useEquipCosmetics()
  const [cosError, setCosError] = useState<string | null>(null)
  if (isLoading) return <p className="text-sm text-ghost-muted">Loading profile…</p>
  if (isError || !data) return <p className="text-sm text-rival-coral">Could not load profile.</p>
  const days = dayStrings(7)
  const played = new Set(data.recentRuns.filter((r) => r.valid && r.mode === 'ranked').map((r) => r.gameDate))
  const pct = Math.min(100, Math.round((data.level.intoLevel / data.level.need) * 100))
  const equippedGradient =
    data.cosmetics.catalog.find((s) => s.id === data.cosmetics.equipped.ghost)?.gradient ??
    (['#62F7E6', '#A98BFF'] as [string, string])

  const chooseSkin = async (skinId: string) => {
    setCosError(null)
    try {
      await equip.mutateAsync({ slot: 'ghost', skinId })
    } catch (e) {
      setCosError(e instanceof Error && e.message === 'ghost-plus-locked' ? 'That skin needs Ghost+.' : 'Could not equip skin.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Identity" className="rounded-card border border-white/10 bg-surface-800 p-5">
        <div className="flex items-center gap-3">
          <GhostAvatar motion="none" className="size-12" gradient={equippedGradient} />
          <div>
            <p className="font-display text-2xl font-800">{data.profile?.handle ?? 'ghost'}</p>
            <p className="mt-1 text-sm text-ghost-muted">
              Level {data.level.level} · {data.xpTotal} XP
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Level progress">
          <div className="h-full rounded-full bg-spectral-cyan" style={{ width: `${pct}%` }} />
        </div>
        <p className="tnum mt-1 text-xs text-ghost-muted">
          {data.level.intoLevel} / {data.level.need} XP to level {data.level.level + 1}
        </p>
        {data.history.locked && (
          <p className="mt-2 text-xs text-ghost-muted">
            History shows the last {data.history.days} days.{' '}
            <Link href="/ghost-plus" className="text-spectral-violet underline">
              Full history is Ghost+
            </Link>
          </p>
        )}
      </section>

      <section aria-label="Streak" className="rounded-card border border-white/10 bg-surface-800 p-5">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-ghost-muted">
          <StreakWisp /> Streak
        </p>
        <p className="tnum mt-1 font-display text-4xl font-800">{data.streak?.currentCount ?? 0}</p>
        <p className="mt-1 text-xs text-ghost-muted">
          Best {data.streak?.longestCount ?? 0} · grace saves {data.streak?.graceTokens ?? 0}
        </p>
        <div className="mt-3 flex gap-1.5" aria-label="Last 7 days">
          {days.map((d) => (
            <span
              key={d}
              title={d}
              className={`h-8 flex-1 rounded-control border ${played.has(d) ? 'border-signal-lime/60 bg-signal-lime/15' : 'border-white/10 bg-ink-900'}`}
            />
          ))}
        </div>
      </section>

      <section aria-label="Ghost skin" className="rounded-card border border-white/10 bg-ink-900 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ghost-muted">Ghost skin</p>
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {data.cosmetics.catalog.map((s) => {
            const lockedSkin = s.entitlement !== 'free'
            const active = data.cosmetics.equipped.ghost === s.id
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={equip.isPending}
                  onClick={() => void chooseSkin(s.id)}
                  aria-pressed={active}
                  className={`flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-control border px-2 py-2 text-xs ${
                    active ? 'border-spectral-cyan/60 bg-surface-800' : 'border-white/10 bg-surface-800/50'
                  } disabled:opacity-60`}
                >
                  <GhostAvatar motion="none" className="size-8" gradient={s.gradient} />
                  <span className="font-600">{s.name}</span>
                  {lockedSkin && <span className="text-[10px] uppercase tracking-wider text-spectral-violet">Ghost+</span>}
                </button>
              </li>
            )
          })}
        </ul>
        {cosError && (
          <p role="alert" className="mt-2 text-sm text-rival-coral">
            {cosError}{' '}
            <Link href="/ghost-plus" className="underline">
              See Ghost+
            </Link>
          </p>
        )}
      </section>

      <section aria-label="Achievements" className="rounded-card border border-white/10 bg-ink-900 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ghost-muted">
          Achievements · {data.achievements.length}
        </p>
        {data.achievements.length === 0 ? (
          <p className="mt-2 text-sm text-ghost-muted">Finish a valid run to earn your first.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.achievements.map((a) => (
              <li key={a.achievementId} className="rounded-control border border-white/10 bg-surface-800 px-3 py-2 text-sm">
                <span className="font-600">{a.detail?.title ?? a.achievementId}</span>
                {a.detail && <span className="block text-xs text-ghost-muted">{a.detail.description}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
