import { readFile } from 'node:fs/promises'
import path from 'node:path'
import ImageKit from '@imagekit/nodejs'
import { parseEnv } from 'node:util'

try {
  for (const [key, value] of Object.entries(parseEnv(await readFile('.env', 'utf8')))) {
    if (process.env[key] === undefined) process.env[key] = value
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const DOCS_DIR =
  process.env.GHOST60_PACK_DIR ??
  path.join(process.cwd(), '..', 'ai-generated-junk', 'ghost60', 'received-assets')

const FILES = [
  'hero-texture-desktop.png',
  'hero-texture-mobile.png',
  'share-fallback-square.png',
  'share-fallback-story.png',
  'email-header.png',
]

const assets = await Promise.all(
  FILES.map(async (name) => ({ name, data: await readFile(path.join(DOCS_DIR, name)) }))
)
if (!process.argv.includes('--check') && !process.env.IMAGEKIT_PRIVATE_KEY)
  throw new Error('IMAGEKIT_PRIVATE_KEY is required')
const imagekit = process.argv.includes('--check')
  ? null
  : new ImageKit({ privateKey: process.env.IMAGEKIT_PRIVATE_KEY })

for (const { name, data } of assets) {
  if (!imagekit) {
    console.log(`${name}: ${data.length} bytes, ready`)
    continue
  }
  const result = await imagekit.files.upload({
    file: data,
    fileName: name,
    folder: '/ghost60',
    useUniqueFileName: false,
  })
  console.log(`${name} -> ${result.url}`)
}
