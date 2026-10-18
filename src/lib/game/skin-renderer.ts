import type { TSkin } from '@/lib/game/skins'

export type TSkinPoint = { x: number; y: number; t: number }
export type TSkinTrailOptions = {
  points: readonly TSkinPoint[]
  skin: TSkin
  elapsedMs: number
  width: number
  height: number
  reduced: boolean
  rival?: boolean
  delayMs?: number
  maxTimeMs?: number
}

function bound(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
}

export function getSkinTrailBounds(skin: TSkin, reduced: boolean, rival = false) {
  const lifetime = bound(skin.trail.lifetimeMs, 180, skin.avatar.effect === 'long-exposure' ? 650 : 700, 380)
  return {
    widthScale: bound(skin.trail.widthScale, 0.85, 1.15, 1),
    opacity: bound(skin.trail.opacity, 0.22, rival ? 0.3 : 0.48, 0.3),
    lifetimeMs: reduced ? lifetime / 2 : lifetime,
    particles: reduced ? 0 : Math.floor(bound(skin.trail.particleRate, 0, skin.avatar.effect === 'mint' ? 12 : 20, 0))
  }
}

export function visibleSkinPoints(
  points: readonly TSkinPoint[], elapsedMs: number, lifetimeMs: number,
  rival = false, delayMs = 0, maxTimeMs = elapsedMs
): TSkinPoint[] {
  const end = Math.min(elapsedMs - Math.max(rival ? 500 : 0, delayMs), maxTimeMs)
  if (!Number.isFinite(end) || end < 0) return []
  const visible: TSkinPoint[] = []
  for (let i = points.length - 1; i >= 0 && visible.length < 96; i -= 1) {
    const p = points[i]
    if (!Number.isFinite(p.t) || p.t > end || p.t < end - lifetimeMs || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    visible.push({ x: bound(p.x, 0, 1, 0), y: bound(p.y, 0, 1, 0), t: p.t })
  }
  return visible.reverse()
}

export function drawSkinTrail(ctx: CanvasRenderingContext2D, options: TSkinTrailOptions) {
  const { skin, elapsedMs, width, height, reduced, rival = false, delayMs = 0, maxTimeMs = elapsedMs } = options
  const bounds = getSkinTrailBounds(skin, reduced, rival)
  const points = visibleSkinPoints(options.points, elapsedMs, bounds.lifetimeMs, rival, delayMs, maxTimeMs)
  if (points.length < 2 || width <= 0 || height <= 0) return
  const effect = skin.avatar.effect
  const end = Math.min(elapsedMs - Math.max(rival ? 500 : 0, delayMs), maxTimeMs)
  const color = rival ? '#A98BFF' : skin.trail.primary
  const secondary = rival ? '#D9C8FF' : skin.trail.secondary
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, width, height)
  ctx.clip()
  ctx.globalCompositeOperation = skin.trail.blend === 'lighter' ? 'lighter' : 'source-over'
  ctx.lineWidth = 2 * bounds.widthScale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const gradient = ctx.createLinearGradient(0, height, width, 0)
  gradient.addColorStop(0, color)
  gradient.addColorStop(1, secondary)
  ctx.strokeStyle = effect === 'mono' ? color : gradient
  const dash = rival ? [4, 5] : (skin.trail.dash ?? []).slice(0, 4).map((n) => bound(n, 1, 16, 4))
  ctx.setLineDash(dash)
  const stroke = (offset: number, strokeColor?: string) => {
    if (strokeColor) ctx.strokeStyle = strokeColor
    for (let i = 1; i < points.length; i += 1) {
      const p = points[i]
      const prev = points[i - 1]
      ctx.globalAlpha = bounds.opacity * Math.max(0, 1 - (end - p.t) / bounds.lifetimeMs)
      const wave = effect === 'heatwave' && !reduced ? Math.sin(p.t / 80) * 1.5 : 0
      const cut = effect === 'static' && !reduced && (Math.floor(p.t / 125) + i) % 5 === 0 ? 1.5 : 0
      ctx.beginPath()
      ctx.moveTo(prev.x * width + offset + cut, prev.y * height + wave)
      ctx.lineTo(p.x * width + offset + cut, p.y * height + wave)
      ctx.stroke()
    }
  }
  if (effect === 'chromatic') {
    const offset = width < 400 ? 1 : 2
    stroke(-offset, rival ? '#A98BFF' : '#62F7E6')
    stroke(offset, rival ? '#D9C8FF' : '#FF66DB')
    stroke(0, rival ? '#D9C8FF' : '#F5F7FF')
  } else {
    stroke(0)
    if (effect === 'clean' || effect === 'long-exposure') {
      ctx.lineWidth = bounds.widthScale
      stroke(-1, secondary)
      stroke(1, color)
    }
  }
  ctx.setLineDash([])
  if (effect === 'scanline') {
    ctx.save()
    ctx.beginPath()
    for (const p of points) ctx.rect(p.x * width - 2, p.y * height - 2, 4, 4)
    ctx.clip()
    ctx.globalAlpha = bounds.opacity * 0.6
    ctx.fillStyle = secondary
    const shift = reduced ? 0 : (elapsedMs * 0.024) % 6
    for (let y = shift; y < height; y += 6) ctx.fillRect(0, y, width, 1)
    ctx.restore()
  }
  const particleCount = effect === 'mono' || effect === 'clean' || effect === 'scanline' ? 0 : bounds.particles
  for (let i = 0; i < particleCount; i += 1) {
    const p = points[Math.floor(i * (points.length - 1) / Math.max(1, particleCount - 1))]
    const age = (end - p.t) / bounds.lifetimeMs
    const drift = Math.sin(i * 2.4 + elapsedMs / 230) * 3
    ctx.globalAlpha = bounds.opacity * (1 - age) * 0.7
    ctx.fillStyle = secondary
    ctx.fillRect(p.x * width + drift, p.y * height + Math.cos(i * 3.1) * 3, effect === 'mint' ? 2 : 1, effect === 'mint' ? 2 : 1)
  }
  ctx.restore()
}

export function skinPreviewHistory(elapsedMs: number): TSkinPoint[] {
  const end = ((elapsedMs % 2500) + 2500) % 2500
  const points: TSkinPoint[] = []
  for (let t = Math.max(0, end - 700); t <= end; t += 10) {
    const angle = t / 2500 * Math.PI * 2
    points.push({ x: 0.5 + Math.sin(angle) * 0.34, y: 0.5 + Math.sin(angle * 2) * 0.22, t })
  }
  return points
}

export function drawSkinAvatar(ctx: CanvasRenderingContext2D, options: {
  skin: TSkin; x: number; y: number; size: number; elapsedMs: number; reduced: boolean
}) {
  const { skin, x, y, size, elapsedMs, reduced } = options
  const effect = skin.avatar.effect
  ctx.save()
  ctx.translate(x, y)
  const gradient = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2)
  gradient.addColorStop(0, skin.avatar.gradient[0])
  gradient.addColorStop(1, skin.avatar.gradient[1])
  const body = () => {
    ctx.beginPath()
    ctx.moveTo(-size * 0.4, size * 0.4)
    ctx.lineTo(-size * 0.4, 0)
    ctx.bezierCurveTo(-size * 0.4, -size * 0.65, size * 0.4, -size * 0.65, size * 0.4, 0)
    ctx.lineTo(size * 0.4, size * 0.4)
    ctx.lineTo(size * 0.15, size * 0.27)
    ctx.lineTo(0, size * 0.4)
    ctx.lineTo(-size * 0.15, size * 0.27)
    ctx.closePath()
  }
  if (effect === 'chromatic' || effect === 'long-exposure') {
    ctx.globalAlpha = 0.25
    ctx.translate(-2, 0)
    body()
    ctx.fillStyle = skin.avatar.gradient[1]
    ctx.fill()
    ctx.translate(4, 0)
    body()
    ctx.fillStyle = skin.avatar.gradient[0]
    ctx.fill()
    ctx.translate(-2, 0)
  }
  ctx.globalAlpha = 1
  body()
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.strokeStyle = skin.avatar.rim
  ctx.lineWidth = effect === 'ultraviolet' ? 2 : 1
  ctx.stroke()
  ctx.save()
  ctx.clip()
  if (effect === 'scanline' || effect === 'static' || effect === 'mint' || effect === 'heatwave') {
    ctx.fillStyle = skin.avatar.gradient[1]
    ctx.globalAlpha = 0.45
    const shift = reduced ? 0 : (elapsedMs * (effect === 'scanline' ? 0.024 : 0.008)) % 6
    for (let row = -size / 2 + shift; row < size / 2; row += 6) {
      if (effect === 'mint') ctx.fillRect(-size / 3, row, 2, 2)
      else ctx.fillRect(-size / 2, row, size, 1)
    }
  }
  ctx.restore()
  ctx.fillStyle = '#0B1020'
  ctx.fillRect(-size * 0.2, -size * 0.08, size * 0.1, size * 0.13)
  ctx.fillRect(size * 0.1, -size * 0.08, size * 0.1, size * 0.13)
  ctx.restore()
}
