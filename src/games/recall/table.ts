import type { GameInputEvent } from '@/games/core/game-module'
import type { TRecallConfig } from '@/games/recall/engine'

export const RECALL_SHOW_SETTLE_MS = 800
export const RECALL_CELL_SLOT_MS = 800
export const RECALL_CELL_ON_MS = 550
export const RECALL_SEQ_GAP_MS = 700

export type TShowSlot = { showStart: number; showEnd: number }

export function showSchedule(config: TRecallConfig): TShowSlot[] {
  let cursor = RECALL_SHOW_SETTLE_MS
  return config.sequences.map((seq) => {
    const showStart = cursor
    const showEnd = showStart + seq.cells.length * RECALL_CELL_SLOT_MS
    cursor = showEnd + RECALL_SEQ_GAP_MS
    return { showStart, showEnd }
  })
}

export type TSeqResolution = { status: 'complete' | 'failed' | 'open'; used: number }

export function resolveSequences(
  config: TRecallConfig,
  choices: Array<Extract<GameInputEvent, { type: 'choice' }>>
): TSeqResolution[] {
  let cursor = 0
  return config.sequences.map((seq) => {
    let pos = 0
    let used = 0
    let alive = true
    while (pos < seq.cells.length && cursor < choices.length && alive) {
      const choice = choices[cursor]
      cursor += 1
      used += 1
      if (choice.value === seq.cells[pos]) pos += 1
      else alive = false
    }
    if (alive && pos === seq.cells.length) return { status: 'complete', used }
    if (!alive) return { status: 'failed', used }
    return { status: 'open', used }
  })
}

export type TCellRect = { x: number; y: number; size: number }

export function recallLayout(cssW: number, cssH: number, grid: number) {
  const pad = 16
  const board = Math.max(1, Math.min(cssW - pad * 2, cssH - pad * 2))
  const pitch = board / grid
  const size = pitch * 0.82
  const originX = (cssW - board) / 2
  const originY = (cssH - board) / 2
  const cells: TCellRect[] = []
  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      cells.push({
        x: originX + col * pitch + (pitch - size) / 2,
        y: originY + row * pitch + (pitch - size) / 2,
        size
      })
    }
  }
  return { originX, originY, pitch, size, cells }
}
