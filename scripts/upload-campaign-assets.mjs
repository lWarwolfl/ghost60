import { readFile } from 'node:fs/promises'
import path from 'node:path'
import ImageKit from '@imagekit/nodejs'

const DOCS_DIR =
  process.env.GHOST60_PACK_DIR ??
  path.join(process.cwd(), '..', '..', 'ai-generated-junk', 'ghost60', 'received-assets')

const FILES = [
  'hero-texture-desktop.png',
  'hero-texture-mobile.png',
  'share-fallback-square.png',
  'share-fallback-story.png',
  'email-header.png'
]

const imagekit = new ImageKit({ privateKey: process.env.IMAGEKIT_PRIVATE_KEY })

for (const name of FILES) {
  const data = await readFile(path.join(DOCS_DIR, name))
  const result = await imagekit.files.upload({
    file: data,
    fileName: name,
    folder: '/ghost60',
    useUniqueFileName: false
  })
  console.log(`${name} -> ${result.url}`)
}
