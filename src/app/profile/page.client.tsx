'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SkinPreview } from '@/components/game/skin-preview'
import { SkinCardFrame } from '@/components/game/skin-card-frame'
import { resolveSkin } from '@/lib/game/skins'
import { GhostAvatar } from '@/components/brand/ghost-avatar'
import { RankBadge, type GhostRank } from '@/components/brand/rank-badge'
import { StreakWisp } from '@/components/brand/streak-wisp'
import { useEquipCosmetics } from '@/features/game/mutations/useEquipCosmetics.mutation'
import { useProfile } from '@/features/game/queries/useProfile.query'

function dayStrings(count: number) {
  const out: string[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i -= 1) {
    out.push(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
        .toISOString()
        .slice(0, 10)
    )
  }
  return out
}

export function ProfileClient() {
  const { data, isLoading, isError } = useProfile()
  const equip = useEquipCosmetics()
  const [slot, setSlot] = useState<'ghost' | 'card'>('ghost')
  const [cosError, setCosError] = useState<string | null>(null)
  if (isLoading) return <p className="text-ghost-muted text-sm">Loading profile…</p>
  if (isError || !data) return <p className="text-rival-coral text-sm">Could not load profile.</p>
  const days = dayStrings(7)
  const played = new Set(
    data.recentRuns.filter((r) => r.valid && r.mode === 'ranked').map((r) => r.gameDate)
  )
  const pct = Math.min(100, Math.round((data.level.intoLevel / data.level.need) * 100))
  const equippedGradient =
    data.cosmetics.catalog.find((s) => s.id === data.cosmetics.equipped.ghost)?.gradient ??
    (['#62F7E6', '#A98BFF'] as [string, string])

  const cardSkin = resolveSkin(data.cosmetics.equipped.card, data.plan)
  const chooseSkin = async (skinId: string) => {
    setCosError(null)
    try {
      await equip.mutateAsync({ slot, skinId })
    } catch (e) {
      setCosError(
        e instanceof Error && e.message === 'ghost-plus-locked'
          ? 'That skin needs Ghost+.'
          : 'Could not equip skin.'
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Identity"
        className="rounded-card bg-surface-800 border border-white/10 p-5"
      >
        <div className="flex items-center gap-3">
          <GhostAvatar
            skin={data.cosmetics.equipped.ghost ?? undefined}
            motion="none"
            className="size-12"
            gradient={equippedGradient}
          />
          <div>
            <p className="font-display font-800 text-2xl">{data.profile?.handle ?? 'ghost'}</p>
            <p className="text-ghost-muted mt-1 text-sm">
              Level {data.level.level} · {data.xpTotal} XP
            </p>
          </div>
        </div>
        <div
          className="bg-surface-700 mt-3 h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Level progress"
        >
          <div className="bg-spectral-cyan h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <p className="tnum text-ghost-muted mt-1 text-xs">
          {data.level.intoLevel} / {data.level.need} XP to level {data.level.level + 1}
        </p>
        {data.history.locked && (
          <p className="text-ghost-muted mt-2 text-xs">
            History shows the last {data.history.days} days.{' '}
            <Link href="/ghost-plus" className="text-spectral-violet underline">
              Full history is Ghost+
            </Link>
          </p>
        )}
      </section>

      <section
        aria-label="Streak"
        className="rounded-card bg-surface-800 border border-white/10 p-5"
      >
        <p className="text-ghost-muted flex items-center gap-2 text-[11px] tracking-[0.18em] uppercase">
          <StreakWisp /> Streak
        </p>
        <p className="tnum font-display font-800 mt-1 text-4xl">{data.streak?.currentCount ?? 0}</p>
        <p className="text-ghost-muted mt-1 text-xs">
          Best {data.streak?.longestCount ?? 0} · grace saves {data.streak?.graceTokens ?? 0}
        </p>
        <div className="mt-3 flex gap-1.5" aria-label="Last 7 days">
          {days.map((d) => (
            <span
              key={d}
              title={d}
              className={`rounded-control h-8 flex-1 border ${played.has(d) ? 'border-signal-lime/60 bg-signal-lime/15' : 'bg-ink-900 border-white/10'}`}
            />
          ))}
        </div>
      </section>

      <section
        aria-label="Ghost skin"
        className="rounded-card bg-ink-900 border border-white/10 p-5"
      >
        <p className="text-ghost-muted text-[11px] tracking-[0.18em] uppercase">
          Cosmetics · visual only
        </p>
        <div className="mt-3 flex gap-2" role="group" aria-label="Cosmetic slot">
          {(['ghost', 'card'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={slot === value}
              onClick={() => setSlot(value)}
              className={`rounded-control min-h-11 flex-1 border px-3 text-sm ${slot === value ? 'border-spectral-cyan text-spectral-cyan' : 'text-ghost-muted border-white/15'}`}
            >
              {value === 'ghost' ? 'Ghost trail' : 'Result card'}
            </button>
          ))}
        </div>
        <SkinCardFrame skin={cardSkin} className="text-ghost-muted mt-3 p-3 text-center text-xs">
          Equipped result card · {cardSkin.name}
        </SkinCardFrame>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.cosmetics.catalog.map((s) => {
            const lockedSkin = !s.unlocked
            const active = data.cosmetics.equipped[slot] === s.id
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={equip.isPending || lockedSkin}
                  onClick={() => void chooseSkin(s.id)}
                  aria-pressed={active}
                  aria-label={`${s.name}${lockedSkin ? ' · locked, needs Ghost+' : active ? ' · equipped' : ' · equip'}`}
                  className={`rounded-control flex min-h-16 w-full min-w-0 flex-col items-center justify-center gap-1 border px-2 py-2 text-xs ${
                    active
                      ? 'border-spectral-cyan/60 bg-surface-800'
                      : 'bg-surface-800/50 border-white/10'
                  } disabled:opacity-60`}
                >
                  {slot === 'ghost' ? (
                    <SkinPreview skin={s} />
                  ) : (
                    <SkinCardFrame
                      skin={s}
                      className="font-display flex h-24 w-full items-center justify-center text-lg"
                    >
                      60
                    </SkinCardFrame>
                  )}
                  <span className="font-600">{s.name}</span>
                  <span className="text-spectral-violet text-[10px] tracking-wider uppercase">
                    {lockedSkin
                      ? 'Ghost+ · locked'
                      : active
                        ? 'Equipped'
                        : s.entitlement === 'ghost_plus'
                          ? 'Ghost+ · unlocked'
                          : 'Free'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {data.plan !== 'ghost_plus' && (
          <Link
            href="/ghost-plus"
            className="text-spectral-violet mt-3 inline-flex min-h-11 items-center text-xs underline"
          >
            Unlock six more styles with Ghost+
          </Link>
        )}
        {cosError && (
          <p role="alert" className="text-rival-coral mt-2 text-sm">
            {cosError}{' '}
            <Link href="/ghost-plus" className="underline">
              See Ghost+
            </Link>
          </p>
        )}
      </section>

      <section
        aria-label="Season rank designs"
        className="rounded-card bg-surface-800 border border-white/10 p-5"
      >
        <p className="text-ghost-muted text-[11px] tracking-[0.18em] uppercase">
          SIGNAL LOST · rank designs
        </p>
        <p className="text-ghost-muted mt-2 text-xs">
          Season ranks are not awarded yet. These are the five badge designs, not your earned
          status.
        </p>
        <ul className="mt-3 grid grid-cols-5 gap-1">
          {(['wisp', 'shade', 'haunt', 'specter', 'phantom'] as GhostRank[]).map((rank) => (
            <li key={rank} className="flex min-w-0 flex-col items-center gap-1">
              <RankBadge rank={rank} motion="none" className="size-10" />
              <span className="text-[9px] uppercase">{rank}</span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Achievements"
        className="rounded-card bg-ink-900 border border-white/10 p-5"
      >
        <p className="text-ghost-muted text-[11px] tracking-[0.18em] uppercase">
          Achievements · {data.achievements.length}
        </p>
        {data.achievements.length === 0 ? (
          <p className="text-ghost-muted mt-2 text-sm">Finish a valid run to earn your first.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.achievements.map((a) => (
              <li
                key={a.achievementId}
                className="rounded-control bg-surface-800 border border-white/10 px-3 py-2 text-sm"
              >
                <span className="font-600">{a.detail?.title ?? a.achievementId}</span>
                {a.detail && (
                  <span className="text-ghost-muted block text-xs">{a.detail.description}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
