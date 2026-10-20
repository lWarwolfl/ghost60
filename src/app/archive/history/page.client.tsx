'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useHistory } from '@/features/game/queries/useHistory.query'

export function HistoryClient() {
  const history = useHistory()
  const [gameFilter, setGameFilter] = useState('all')
  const data = history.data?.pages[0]
  if (history.isLoading) return <p role="status">Loading history…</p>
  if (history.isError || !data) return <p role="alert">Could not load history.</p>
  const skills = new Map<string, typeof data.skills>()
  for (const point of data.skills) {
    const points = skills.get(point.gameId) ?? []
    points.push(point)
    skills.set(point.gameId, points)
  }
  return <>
    <Link href="/archive" className="min-h-11 underline">Daily archive</Link>
    {data.locked ? <p>Free history covers seven days. <Link href="/ghost-plus" className="underline">Ghost+ unlocks full history and skill charts.</Link></p> : <section aria-label="Per-game skill charts" className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-800">Ranked skill history</h2>
      <p className="text-sm text-ghost-muted">Scores are shown separately per game; different days can have different difficulty.</p>
      <label>Game <select value={gameFilter} onChange={(event) => setGameFilter(event.target.value)} className="min-h-11 bg-ink-900"><option value="all">All games</option>{[...skills.keys()].map((game) => <option key={game} value={game}>{game}</option>)}</select></label>
      {[...skills].filter(([game]) => gameFilter === 'all' || gameFilter === game).map(([game, points]) => {
        const chronological = [...points].reverse()
        const max = Math.max(1, ...points.map((point) => point.score))
        return <details key={game} className="rounded-card border border-white/15 p-4"><summary className="min-h-11 cursor-pointer uppercase">{game} · {points.length} days · best {max === 1 && points.every((point) => point.score === 0) ? 0 : max}</summary>
          <svg viewBox="0 0 300 100" role="img" aria-label={`${game} score trend`} className="h-28 w-full">{chronological.length === 1 && <circle cx="150" cy={95 - chronological[0].score / max * 90} r="3" fill="currentColor" />}<polyline fill="none" stroke="currentColor" strokeWidth="2" points={chronological.map((point, index) => `${chronological.length > 1 ? index * 300 / (chronological.length - 1) : 150},${95 - point.score / max * 90}`).join(' ')} /></svg>
          <ul className="tnum text-sm">{chronological.map((point) => <li key={point.gameDate}>{point.gameDate}: {point.score}</li>)}</ul>
        </details>
      })}
      {!skills.size && <p>No valid runs yet.</p>}
    </section>}
    <section aria-label="Run history">{!history.data?.pages.some((page) => page.runs.length > 0) && <p>No runs yet.</p>}<h2 className="font-display text-xl font-800">Runs</h2><ul className="mt-3 flex flex-col gap-2">{history.data?.pages.flatMap((page) => page.runs).map((run) => <li key={run.id} className="tnum rounded-control border border-white/15 p-3"><p>{run.title} · {run.score}{!run.valid ? ' · invalid' : ''}</p><p className="text-xs text-ghost-muted">{run.gameDate} · {run.gameId} · {run.mode}</p>{run.valid && <Link href={`/archive/replay/${run.id}`} className="text-spectral-cyan mt-1 inline-flex min-h-11 items-center text-xs underline">Watch ghost</Link>}</li>)}</ul></section>
    {history.hasNextPage && <button disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()} className="min-h-11 underline">Load older runs</button>}
  </>
}
