'use client'

import { StreakWisp } from '@/components/brand/streak-wisp'
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
  if (isLoading) return <p className="text-sm text-ghost-muted">Loading profile…</p>
  if (isError || !data) return <p className="text-sm text-rival-coral">Could not load profile.</p>
  const days = dayStrings(7)
  const played = new Set(data.recentRuns.filter((r) => r.valid && r.mode === 'ranked').map((r) => r.gameDate))
  const pct = Math.min(100, Math.round((data.level.intoLevel / data.level.need) * 100))

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Identity" className="rounded-card border border-white/10 bg-surface-800 p-5">
        <p className="font-display text-2xl font-800">{data.profile?.handle ?? 'ghost'}</p>
        <p className="mt-1 text-sm text-ghost-muted">
          Level {data.level.level} · {data.xpTotal} XP
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Level progress">
          <div className="h-full rounded-full bg-spectral-cyan" style={{ width: `${pct}%` }} />
        </div>
        <p className="tnum mt-1 text-xs text-ghost-muted">
          {data.level.intoLevel} / {data.level.need} XP to level {data.level.level + 1}
        </p>
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
