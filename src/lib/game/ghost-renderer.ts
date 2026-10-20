export function drawGhostGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha = 0.9
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#a98bff'
  ctx.strokeStyle = '#e3d8ff'
  ctx.lineWidth = Math.max(1, radius * 0.18)
  ctx.beginPath()
  ctx.arc(x, y - radius * 0.12, radius, Math.PI, 0)
  ctx.lineTo(x + radius, y + radius * 0.62)
  ctx.lineTo(x + radius * 0.6, y + radius * 0.34)
  ctx.lineTo(x + radius * 0.2, y + radius * 0.62)
  ctx.lineTo(x - radius * 0.2, y + radius * 0.34)
  ctx.lineTo(x - radius * 0.6, y + radius * 0.62)
  ctx.lineTo(x - radius, y + radius * 0.34)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#0b0e18'
  ctx.beginPath()
  ctx.arc(x - radius * 0.34, y - radius * 0.08, radius * 0.17, 0, Math.PI * 2)
  ctx.arc(x + radius * 0.34, y - radius * 0.08, radius * 0.17, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
