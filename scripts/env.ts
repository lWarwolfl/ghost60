import fs from 'node:fs'
import path from 'node:path'

try {
  if (!process.env['DATABASE_URL']) {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  }
} catch {
  // leave env untouched when .env is absent (CI provides real env)
}
