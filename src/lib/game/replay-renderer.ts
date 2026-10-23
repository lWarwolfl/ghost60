import type { GameInputEvent } from '@/games/core/game-module'
import type { TPublicGame } from '@/features/game/store/game-store'
import type { TPulseConfig } from '@/games/pulse/engine'
import type { TSnapConfig } from '@/games/snap/engine'
import type { TOrbitConfig } from '@/games/orbit/engine'
import type { TRecallConfig } from '@/games/recall/engine'
import type { TShiftConfig } from '@/games/shift/engine'
import type { TTraceConfig } from '@/games/trace/engine'
import { activePulseIndex, pulseRadiusScale } from '@/games/pulse/table'
import { layoutRound, drawShape } from '@/games/snap/table'
import { markerAngleAt } from '@/games/orbit/table'
import {
  recallLayout,
  resolveSequences,
  showSchedule,
  RECALL_CELL_SLOT_MS,
  RECALL_CELL_ON_MS,
} from '@/games/recall/table'
import { arrowFor, shiftRuleFor } from '@/games/shift/table'
import { traceView, toScreen } from '@/games/trace/table'

/** Draw the real game board at the playback clock, returning the last action's position. */
export function drawReplayBoard(
  ctx: CanvasRenderingContext2D,
  game: TPublicGame,
  events: GameInputEvent[],
  elapsed: number,
  w: number,
  h: number
) {
  const visible = events.filter((event) => event.t <= elapsed)
  const last = visible.at(-1)
  let point = { x: w / 2, y: h / 2 }
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(245,247,255,0.22)'
  ctx.fillStyle = '#62f7e6'
  if (game.gameId === 'pulse') {
    const pulses = [...(game.config as TPulseConfig).pulses].sort((a, b) => a.targetMs - b.targetMs)
    const index = activePulseIndex(pulses, elapsed)
    const pulse = pulses[index]
    const r = Math.min(w, h) * 0.22 * pulseRadiusScale(game.seed, index)
    ctx.strokeStyle = '#62f7e6'
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
    ctx.stroke()
    const p = Math.min(1, Math.max(0, (pulse.targetMs - elapsed) / 1200))
    if (elapsed <= pulse.targetMs + 300) {
      ctx.strokeStyle = '#a98bff'
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, r * (1 + p * 0.9), 0, Math.PI * 2)
      ctx.stroke()
    }
    point = { x: w / 2, y: h / 2 - r }
  } else if (game.gameId === 'orbit') {
    const config = game.config as TOrbitConfig
    const r = Math.min(w, h) * 0.32
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
    ctx.stroke()
    for (const target of config.targets) {
      if (elapsed < target.openMs - 1200 || elapsed > target.closeMs + 300) continue
      ctx.strokeStyle = '#62f7e6'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.arc(
        w / 2,
        h / 2,
        r,
        ((target.angleDeg - target.goodTolDeg) * Math.PI) / 180,
        ((target.angleDeg + target.goodTolDeg) * Math.PI) / 180
      )
      ctx.stroke()
    }
    const angle =
      (markerAngleAt(elapsed, config.markerPeriodMs, config.markerRamp, game.durationMs) *
        Math.PI) /
      180
    ctx.fillStyle = '#f5f7ff'
    ctx.beginPath()
    ctx.arc(w / 2 + r * Math.cos(angle), h / 2 + r * Math.sin(angle), 4, 0, Math.PI * 2)
    ctx.fill()
    const action =
      last?.type === 'tap' && last.value !== undefined ? (last.value * Math.PI) / 180 : angle
    point = { x: w / 2 + r * Math.cos(action), y: h / 2 + r * Math.sin(action) }
  } else if (game.gameId === 'snap') {
    const config = game.config as TSnapConfig
    const index = Math.max(0, visible.length - (last && elapsed - last.t < 800 ? 1 : 0))
    const round = config.rounds[index]
    if (round) {
      const layout = layoutRound(game.seed, index, round.options, round.correct, w, h)
      for (const cell of layout.cells)
        drawShape(ctx, cell.shape, cell.cx, cell.cy, cell.r, '#f5f7ff', '#62f7e6', 2)
      if (last?.type === 'choice' && visible.length - 1 === index && layout.cells[last.value])
        point = { x: layout.cells[last.value].cx, y: layout.cells[last.value].cy }
    }
  } else if (game.gameId === 'recall') {
    const config = game.config as TRecallConfig
    const choices = visible.filter(
      (event): event is Extract<GameInputEvent, { type: 'choice' }> => event.type === 'choice'
    )
    const layout = recallLayout(w, h, config.grid)
    const current = resolveSequences(config, choices).findIndex((round) => round.status === 'open')
    const schedule = showSchedule(config, choices)
    const slot = schedule[current]
    const offset = slot ? elapsed - slot.showStart : -1
    const index = Math.floor(offset / RECALL_CELL_SLOT_MS)
    const lit =
      offset >= 0 &&
      slot &&
      elapsed < slot.showEnd &&
      offset % RECALL_CELL_SLOT_MS < RECALL_CELL_ON_MS
        ? config.sequences[current]?.cells[index]
        : -1
    layout.cells.forEach((cell, i) => {
      ctx.fillStyle = i === lit ? '#62f7e6' : 'rgba(245,247,255,0.07)'
      ctx.strokeStyle = 'rgba(245,247,255,0.22)'
      ctx.beginPath()
      ctx.roundRect(cell.x, cell.y, cell.size, cell.size, 10)
      ctx.fill()
      ctx.stroke()
    })
    const cell = last?.type === 'choice' ? layout.cells[last.value] : null
    if (cell) point = { x: cell.x + cell.size / 2, y: cell.y + cell.size / 2 }
  } else if (game.gameId === 'shift') {
    const cards = (game.config as TShiftConfig).cards
    const index = Math.min(
      cards.length - 1,
      Math.max(0, visible.length - (last && elapsed - last.t < 700 ? 1 : 0))
    )
    ctx.font = '800 72px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f5f7ff'
    ctx.fillText(arrowFor(cards[index].correct, index) === 0 ? '←' : '→', w / 2, h / 2)
    ctx.font = '700 12px sans-serif'
    ctx.fillStyle = '#62f7e6'
    ctx.fillText(shiftRuleFor(index) === 'reversed' ? 'TAP OPPOSITE' : 'TAP THE ARROW', w / 2, 28)
    point = { x: w * (last?.type === 'choice' && last.value === 1 ? 0.75 : 0.25), y: h * 0.55 }
  } else {
    const config = game.config as TTraceConfig
    const view = traceView(w, h)
    ctx.strokeStyle = 'rgba(169,139,255,0.25)'
    ctx.lineWidth = config.corridorHalf * 2 * view.scale
    ctx.beginPath()
    config.gates.forEach((gate, i) => {
      const p = toScreen(gate, view)
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#62f7e6'
    for (const gate of config.gates) {
      const p = toScreen(gate, view)
      ctx.beginPath()
      ctx.arc(p.x, p.y, gate.r * view.scale, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    for (const event of visible) {
      if (!('p' in event) || !event.p) continue
      const p = toScreen(event.p, view)
      if (event.type === 'pointer_down') ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
      point = p
    }
    ctx.stroke()
  }
  return { point, last }
}
