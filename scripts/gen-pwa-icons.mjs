import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const packDir =
  process.env.GHOST60_PACK_DIR ??
  (existsSync(path.join(root, 'agent-pack'))
    ? path.join(root, 'agent-pack')
    : path.join(root, '..', '..', 'ai-generated-junk', 'ghost60', 'agent-pack'))
const markPath = path.join(packDir, 'assets', 'svg', 'brand', 'ghost60-mark.svg')
const outDir = path.join(root, 'public', 'icons')
const BG = '#0b0f1a'

function compose(inner, size, padFraction) {
  const side = Math.round(size * (1 - padFraction * 2))
  const xy = Math.round((size - side) / 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${BG}"/><svg x="${xy}" y="${xy}" width="${side}" height="${side}" viewBox="0 0 64 64">${inner}</svg></svg>`
}

const raw = await readFile(markPath, 'utf8')
const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
await mkdir(outDir, { recursive: true })

const jobs = [
  ['icon-192.png', 192, 0.19],
  ['icon-512.png', 512, 0.19],
  ['maskable-512.png', 512, 0.3],
  ['apple-touch-icon.png', 180, 0.12]
]

for (const [name, size, pad] of jobs) {
  await sharp(Buffer.from(compose(inner, size, pad))).png().toFile(path.join(outDir, name))
  console.log(`wrote public/icons/${name}`)
}
