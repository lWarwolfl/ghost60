import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('script env loading', () => {
  it('loads CRLF env files without replacing exported values', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost60-env-'))
    const script = path.resolve('scripts/env.ts')
    try {
      fs.writeFileSync(
        path.join(dir, '.env'),
        'DATABASE_URL="postgres://example.invalid/test"\r\nGHOST60_ENV_CHECK="loaded"\r\nGHOST60_ENV_EXISTING="file"\r\n'
      )
      const env: NodeJS.ProcessEnv = { ...process.env, GHOST60_ENV_EXISTING: 'exported' }
      delete env.DATABASE_URL
      const output = execFileSync(
        process.execPath,
        [
          '--import',
          import.meta.resolve('tsx'),
          '-e',
          `import(${JSON.stringify(pathToFileURL(script).href)}).then(() => console.log(JSON.stringify([process.env.DATABASE_URL, process.env.GHOST60_ENV_CHECK, process.env.GHOST60_ENV_EXISTING])))`,
        ],
        { cwd: dir, env, encoding: 'utf8' }
      )
      expect(JSON.parse(output.trim())).toEqual([
        'postgres://example.invalid/test',
        'loaded',
        'exported',
      ])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
