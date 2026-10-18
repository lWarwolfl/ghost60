'use client'

import { useEffect, useRef } from 'react'
import { drawSkinAvatar, drawSkinTrail, skinPreviewHistory } from '@/lib/game/skin-renderer'
import type { TSkin } from '@/lib/game/skins'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion.hook'

type TPreview = { canvas: HTMLCanvasElement; skin: TSkin; reduced: boolean; visible: boolean; phase: number }
const previews = new Set<TPreview>()
let frame = 0
let previousTime: number | null = null
let elapsed = 1250

function draw(preview: TPreview, time: number) {
  const ctx = preview.canvas.getContext('2d')
  if (!ctx) return
  const width = 200
  const height = 96
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (preview.canvas.width !== width * dpr || preview.canvas.height !== height * dpr) {
    preview.canvas.width = width * dpr
    preview.canvas.height = height * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  const points = skinPreviewHistory(time)
  drawSkinTrail(ctx, { points, skin: preview.skin, elapsedMs: time, width, height, reduced: preview.reduced })
  const head = points.at(-1)
  if (head) drawSkinAvatar(ctx, { skin: preview.skin, x: head.x * width, y: head.y * height, size: 25, elapsedMs: time, reduced: preview.reduced })
}

function animate(now: number) {
  frame = 0
  if (document.hidden) {
    previousTime = null
    return
  }
  const limited = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches ||
    navigator.hardwareConcurrency <= 4 ||
    Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
  const active = [...previews].filter((p) => p.visible && !p.reduced).slice(0, limited ? 2 : previews.size)
  if (active.length === 0) {
    previousTime = null
    return
  }
  elapsed = (elapsed + (previousTime === null ? 0 : Math.min(50, now - previousTime))) % 2500
  previousTime = now
  for (const preview of active) {
    preview.phase = elapsed
    draw(preview, elapsed)
  }
  frame = requestAnimationFrame(animate)
}

function schedule() {
  if (!frame && !document.hidden) frame = requestAnimationFrame(animate)
}

function visibilityChange() {
  if (document.hidden) {
    cancelAnimationFrame(frame)
    frame = 0
    previousTime = null
  } else schedule()
}

export function SkinPreview({ skin, className = '' }: { skin: TSkin; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!canvas.current) return
    const preview = { canvas: canvas.current, skin, reduced, visible: false, phase: 1250 }
    if (previews.size === 0) {
      document.addEventListener('visibilitychange', visibilityChange)
      window.addEventListener('resize', schedule)
    }
    previews.add(preview)
    draw(preview, 1250)
    const observer = new IntersectionObserver(([entry]) => {
      preview.visible = entry.isIntersecting
      schedule()
    }, { threshold: 0.1 })
    observer.observe(preview.canvas)
    return () => {
      observer.disconnect()
      previews.delete(preview)
      if (previews.size === 0) {
        cancelAnimationFrame(frame)
        frame = 0
        previousTime = null
        document.removeEventListener('visibilitychange', visibilityChange)
        window.removeEventListener('resize', schedule)
      }
    }
  }, [skin, reduced])
  return <canvas ref={canvas} width={200} height={96} aria-hidden="true" className={`pointer-events-none aspect-[25/12] h-auto min-w-0 w-full ${className}`} />
}
