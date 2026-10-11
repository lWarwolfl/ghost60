import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue
      walk(full, out)
    } else if (/\.(ts|tsx|mjs|js|json)$/.test(e.name) && !full.endsWith('media.test.ts')) {
      out.push(full)
    }
  }
  return out
}

describe('media posture (no user uploads launched)', () => {
  it('keeps the ImageKit private key server-side only', () => {
    const offenders = walk(path.join(ROOT, 'src')).filter((f) =>
      fs.readFileSync(f, 'utf8').includes('IMAGEKIT_PRIVATE_KEY')
    )
    expect(offenders).toEqual([])
    const all = walk(ROOT).filter((f) => fs.readFileSync(f, 'utf8').includes('NEXT_PUBLIC_IMAGEKIT_PRIVATE'))
    expect(all).toEqual([])
  })
  it('imports no ImageKit SDK in app code', () => {
    const offenders = walk(path.join(ROOT, 'src')).filter((f) =>
      fs.readFileSync(f, 'utf8').includes('@imagekit')
    )
    expect(offenders).toEqual([])
  })
  it('exposes no upload-auth route while uploads are unlaunched', () => {
    expect(fs.existsSync(path.join(ROOT, 'src', 'app', 'api', 'media'))).toBe(false)
  })
  it('limits the campaign uploader to a fixed PNG allowlist', () => {
    const script = fs.readFileSync(path.join(ROOT, 'scripts', 'upload-campaign-assets.mjs'), 'utf8')
    expect(script).not.toMatch(/\.svg/i)
    expect(script).not.toContain('event_stream')
    const listed = [...script.matchAll(/'([\w-]+\.png)'/g)].map((m) => m[1])
    expect(listed.length).toBeGreaterThan(0)
    expect(listed.every((n) => n.endsWith('.png'))).toBe(true)
  })
})
