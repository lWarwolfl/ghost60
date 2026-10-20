'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SkinPreview } from '@/components/game/skin-preview'
import { SkinCardFrame } from '@/components/game/skin-card-frame'
import { resolveSkin } from '@/lib/game/skins'
import { GhostAvatar } from '@/components/brand/ghost-avatar'
import { RankBadge, type GhostRank } from '@/components/brand/rank-badge'
import { AchievementCard } from '@/components/profile/achievement-card'
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
  const [pending, setPending] = useState<{ slot: 'ghost' | 'card'; skinId: string } | null>(null)
  if (isLoading) return <p className="text-ghost-muted text-sm">Loading profile…</p>
  if (isError || !data) return <p className="text-ghost-muted text-sm">Your profile took a moment. Refresh to try again.</p>
  const days = dayStrings(7)
  const played = new Set(
    data.recentRuns.filter((r) => r.valid && r.mode === 'ranked').map((r) => r.gameDate)
  )
  const pct = Math.min(100, Math.round((data.level.intoLevel / data.level.need) * 100))
  const equippedInSlot = (value: 'ghost' | 'card') =>
    pending?.slot === value ? pending.skinId : data.cosmetics.equipped[value]
  const ghostSkin = equippedInSlot('ghost')
  const equippedGradient =
    data.cosmetics.catalog.find((s) => s.id === ghostSkin)?.gradient ??
    (['#62F7E6', '#A98BFF'] as [string, string])
  const cardSkin = resolveSkin(equippedInSlot('card'), data.plan)
  const chooseSkin = async (skinId: string) => {
    setCosError(null)
    setPending({ slot, skinId })
    try {
      await equip.mutateAsync({ slot, skinId })
    } catch (e) {
      setPending(null)
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
            skin={ghostSkin ?? undefined}
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
            const active = equippedInSlot(slot) === s.id
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
          Rank ladder
        </p>
        <p className="text-ghost-muted mt-2 text-xs leading-5">
          Five signal forms. Wisp is where every ghost starts; Phantom is the top of the ladder.
        </p>
        <ul className="mt-3 grid grid-cols-5 gap-1">
          {(['wisp', 'shade', 'haunt', 'specter', 'phantom'] as GhostRank[]).map((rank, index) => (
            <li key={rank} className="flex min-w-0 flex-col items-center gap-1">
              <RankBadge rank={rank} motion="none" className="size-11" />
              <span className="text-[9px] uppercase tracking-[0.12em]">{rank}</span>
              <span className="text-ghost-muted text-[8px]">T{index + 1}</span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Achievements"
        className="rounded-card bg-ink-900 border border-white/10 p-5"
      >
        <p className="text-ghost-muted text-[11px] tracking-[0.18em] uppercase">
          Achievements · {data.achievements.filter((a) => a.unlocked).length} / {data.achievements.length}
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {data.achievements.map((a) => (
            <AchievementCard
              key={a.achievementId}
              title={a.detail?.title ?? a.achievementId}
              description={a.detail?.description ?? ''}
              icon={a.detail?.icon ?? 'trophy'}
              unlocked={a.unlocked}
              progress={a.progress}
              target={a.target}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}
