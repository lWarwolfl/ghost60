import fs from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'

const file = path.join(process.cwd(), '.env')
if (fs.existsSync(file)) {
  const values = parseEnv(fs.readFileSync(file, 'utf8'))
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}
