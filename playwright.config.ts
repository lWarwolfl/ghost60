import { defineConfig } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  retries: 0,
  use: { baseURL: 'http://localhost:3104' }
})
