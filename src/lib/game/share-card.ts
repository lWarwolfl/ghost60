const WIDTH = 1080
const HEIGHT = 1350
const PAD = 84
const GHOST_BODY =
  'M15 32C15 21 22.8 13 32 13s17 8 17 19v17l-5.5-4-5.7 4-5.8-4-5.8 4-5.7-4-5.5 4V32Z'

export type TShareCardImage = {
  score: number
  gameTitle: string
  gameId: string
  dateLabel: string
  handle?: string | null
  personalBest: boolean
  streak: number
  challengeHandle?: string | null
  challengeTarget?: number
  url: string
  ghostGradient: [string, string]
}

function displayFont() {
  const probe = document.querySelector<HTMLElement>('.font-display')
  return probe
    ? getComputedStyle(probe).fontFamily
    : getComputedStyle(document.body).fontFamily || 'sans-serif'
}

function bodyFont() {
  return getComputedStyle(document.body).fontFamily || 'sans-serif'
}

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, tracking: number) {
  return [...text].reduce((sum, char) => sum + ctx.measureText(char).width, 0) + tracking * Math.max(0, text.length - 1)
}

function trackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number
) {
  let cursor = x
  for (const char of text) {
    ctx.fillText(char, cursor, y)
    cursor += ctx.measureText(char).width + tracking
  }
}

function trackedTextRight(
  ctx: CanvasRenderingContext2D,
  text: string,
  right: number,
  y: number,
  tracking: number
) {
  trackedText(ctx, text, right - trackedWidth(ctx, text, tracking), y, tracking)
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let value = text
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1)
  return `${value}…`
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function wrapTitle(ctx: CanvasRenderingContext2D, title: string, maxWidth: number) {
  const words = title.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 2)
}

function rivalLabel(handle?: string | null) {
  if (!handle) return null
  return handle.startsWith('@') ? handle : `@${handle}`
}

export async function renderShareCard(input: TShareCardImage): Promise<Blob> {
  if (typeof document === 'undefined') throw new Error('no-document')
  await Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, 1200))
  ])

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no-canvas')
  ctx.imageSmoothingQuality = 'high'
  const display = displayFont()
  const body = bodyFont()
  const rival = rivalLabel(input.challengeHandle)
  const handle = input.handle?.replace(/^@/, '') || 'anonymous ghost'

  ctx.fillStyle = '#070912'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const cyanGlow = ctx.createRadialGradient(WIDTH * 0.86, HEIGHT * 0.08, 0, WIDTH * 0.86, HEIGHT * 0.08, 720)
  cyanGlow.addColorStop(0, 'rgba(98,247,230,0.2)')
  cyanGlow.addColorStop(1, 'rgba(98,247,230,0)')
  ctx.fillStyle = cyanGlow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const violetGlow = ctx.createRadialGradient(WIDTH * 0.04, HEIGHT * 0.92, 0, WIDTH * 0.04, HEIGHT * 0.92, 700)
  violetGlow.addColorStop(0, 'rgba(169,139,255,0.2)')
  violetGlow.addColorStop(1, 'rgba(169,139,255,0)')
  ctx.fillStyle = violetGlow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.strokeStyle = 'rgba(245,247,255,0.045)'
  ctx.lineWidth = 1
  for (let x = 0; x <= WIDTH; x += 54) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, HEIGHT)
    ctx.stroke()
  }
  for (let y = 0; y <= HEIGHT; y += 54) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(WIDTH, y)
    ctx.stroke()
  }

  const ringX = 818
  const ringY = 636
  ctx.lineWidth = 2
  ctx.strokeStyle = `${input.ghostGradient[0]}38`
  ctx.beginPath()
  ctx.ellipse(ringX, ringY, 250, 250, -0.24, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = `${input.ghostGradient[1]}48`
  ctx.beginPath()
  ctx.ellipse(ringX, ringY, 198, 198, 0.3, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = input.ghostGradient[0]
  ctx.shadowColor = input.ghostGradient[0]
  ctx.shadowBlur = 24
  ctx.beginPath()
  ctx.arc(ringX + 214, ringY - 118, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.fillStyle = '#f5f7ff'
  ctx.font = `800 30px ${display}`
  trackedText(ctx, 'GHOST60', PAD, 112, 7)

  ctx.fillStyle = 'rgba(144,153,173,0.9)'
  ctx.font = `500 18px ${body}`
  trackedTextRight(ctx, `DAILY SIGNAL · ${input.dateLabel}`, WIDTH - PAD, 108, 2.2)

  ctx.fillStyle = '#a98bff'
  ctx.font = `700 21px ${body}`
  trackedText(ctx, `${input.gameId.toUpperCase()} · RUN SCORE`, PAD, 500, 3.4)

  let scoreSize = 300
  ctx.font = `800 ${scoreSize}px ${display}`
  while (ctx.measureText(String(input.score)).width > 480 && scoreSize > 120) {
    scoreSize -= 8
    ctx.font = `800 ${scoreSize}px ${display}`
  }
  ctx.fillStyle = '#f5f7ff'
  ctx.shadowColor = 'rgba(98,247,230,0.22)'
  ctx.shadowBlur = 34
  ctx.fillText(String(input.score), PAD, 792)
  ctx.shadowBlur = 0

  const titleSize = 64
  ctx.font = `800 ${titleSize}px ${display}`
  ctx.fillStyle = '#f5f7ff'
  const titleLines = wrapTitle(ctx, input.gameTitle, 560)
  titleLines.forEach((line, index) => {
    ctx.fillText(line, PAD, 884 + index * 70)
  })

  const chips: Array<{ text: string; color: string; border: string }> = []
  if (input.personalBest) {
    chips.push({ text: 'NEW PERSONAL BEST', color: '#c7ff5e', border: 'rgba(199,255,94,0.5)' })
  }
  if (input.streak > 0) {
    chips.push({ text: `${input.streak} DAY STREAK`, color: '#9099ad', border: 'rgba(245,247,255,0.16)' })
  }
  if (rival) {
    chips.push({
      text: `VS ${rival}${input.challengeTarget ? ` · ${input.challengeTarget}` : ''}`,
      color: '#a98bff',
      border: 'rgba(169,139,255,0.45)'
    })
  }
  let chipX = PAD
  const chipY = titleLines.length > 1 ? 1010 : 972
  for (const chip of chips) {
    ctx.font = `600 18px ${body}`
    const chipWidth = trackedWidth(ctx, chip.text, 2.2) + 36
    roundedRect(ctx, chipX, chipY, chipWidth, 42, 21)
    ctx.fillStyle = 'rgba(11,15,26,0.72)'
    ctx.fill()
    ctx.strokeStyle = chip.border
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = chip.color
    ctx.textBaseline = 'middle'
    trackedText(ctx, chip.text, chipX + 18, chipY + 21, 2.2)
    ctx.textBaseline = 'alphabetic'
    chipX += chipWidth + 12
  }

  ctx.strokeStyle = 'rgba(245,247,255,0.18)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([8, 8])
  ctx.beginPath()
  ctx.moveTo(PAD, 1122)
  ctx.lineTo(WIDTH - PAD, 1122)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = '#9099ad'
  ctx.font = `500 18px ${body}`
  trackedText(ctx, 'GHOST LEFT BY', PAD, 1188, 3.2)
  ctx.fillStyle = '#f5f7ff'
  ctx.font = `600 38px ${display}`
  ctx.fillText(`@${handle}`, PAD, 1242)

  ctx.fillStyle = '#62f7e6'
  ctx.font = `600 19px ${body}`
  trackedTextRight(ctx, 'CATCH IT', WIDTH - PAD, 1188, 3)
  trackedTextRight(ctx, 'IF YOU CAN', WIDTH - PAD, 1218, 3)

  ctx.fillStyle = 'rgba(144,153,173,0.65)'
  ctx.font = `400 18px ${body}`
  ctx.fillText(truncate(ctx, input.url.replace(/^https?:\/\//, ''), WIDTH - PAD * 2), PAD, 1302)

  ctx.save()
  ctx.translate(ringX - 256, 388)
  ctx.scale(8, 8)
  const ghost = new Path2D(GHOST_BODY)
  const gradient = ctx.createLinearGradient(0, 0, 64, 64)
  gradient.addColorStop(0, input.ghostGradient[0])
  gradient.addColorStop(1, input.ghostGradient[1])
  ctx.fillStyle = gradient
  ctx.strokeStyle = 'rgba(245,247,255,0.72)'
  ctx.lineWidth = 1.1
  ctx.fill(ghost)
  ctx.stroke(ghost)
  ctx.fillStyle = '#070912'
  ctx.beginPath()
  ctx.arc(26, 31, 2.4, 0, Math.PI * 2)
  ctx.arc(38, 31, 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('card-render-failed'))
    }, 'image/png')
  })
}
