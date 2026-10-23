import { createRng, hashSeed } from '@/games/core/rng'

const SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'hex'] as const
export type TShape = (typeof SHAPES)[number]

export type TOption = { cx: number; cy: number; r: number; shape: TShape }

export function layoutRound(
  seed: string,
  roundIndex: number,
  options: number,
  correct: number,
  w: number,
  h: number
): { target: TShape; cells: TOption[] } {
  const rng = createRng(`${seed}:${roundIndex}`)
  const target = SHAPES[(hashSeed(seed) + roundIndex) % SHAPES.length]
  const pool = SHAPES.filter((s) => s !== target)
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(0, i + 1)
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  const perRow = options <= 4 ? options : Math.ceil(options / 2)
  const rows = options <= 4 ? 1 : 2
  const cellR = Math.min(w / (perRow * 2.6), h / (rows * 2.8), 64)
  const cells: TOption[] = []
  for (let i = 0; i < options; i += 1) {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const inRow = row === rows - 1 && options % perRow !== 0 ? options % perRow : perRow
    const jx = (rng.nextFloat() * 2 - 1) * 8
    const jy = (rng.nextFloat() * 2 - 1) * 8
    cells.push({
      cx: ((col + 0.5 + (perRow - inRow) / 2) / perRow) * w + jx,
      cy: ((row + 0.5) / rows) * h + jy,
      r: cellR,
      shape: i === correct ? target : pool[i % pool.length],
    })
  }
  return { target, cells }
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: TShape,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  outline: string,
  lw: number
) {
  ctx.beginPath()
  if (shape === 'circle') ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2)
  else if (shape === 'square') ctx.rect(cx - r * 0.55, cy - r * 0.55, r * 1.1, r * 1.1)
  else if (shape === 'triangle') {
    ctx.moveTo(cx, cy - r * 0.68)
    ctx.lineTo(cx + r * 0.62, cy + r * 0.5)
    ctx.lineTo(cx - r * 0.62, cy + r * 0.5)
    ctx.closePath()
  } else if (shape === 'diamond') {
    ctx.moveTo(cx, cy - r * 0.68)
    ctx.lineTo(cx + r * 0.55, cy)
    ctx.lineTo(cx, cy + r * 0.68)
    ctx.lineTo(cx - r * 0.55, cy)
    ctx.closePath()
  } else if (shape === 'hex') {
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i - Math.PI / 6
      const x = cx + r * 0.64 * Math.cos(a)
      const y = cy + r * 0.64 * Math.sin(a)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  } else {
    for (let i = 0; i < 10; i += 1) {
      const rad = i % 2 === 0 ? r * 0.68 : r * 0.3
      const a = (Math.PI / 5) * i - Math.PI / 2
      const x = cx + rad * Math.cos(a)
      const y = cy + rad * Math.sin(a)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  }
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = outline
  ctx.lineWidth = lw
  ctx.stroke()
}
