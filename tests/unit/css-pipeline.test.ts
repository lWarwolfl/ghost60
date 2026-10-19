import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'
import postcss from 'postcss'

it('compiles application utilities through the shared Next PostCSS pipeline', async () => {
  const config = await import(pathToFileURL(path.resolve('postcss.config.mjs')).href)
  const plugins = await Promise.all(
    Object.entries(config.default.plugins).map(async ([name, options]) => {
      const plugin = await import(name)
      return plugin.default(options)
    })
  )
  const result = await postcss(plugins).process(readFileSync('src/app/globals.css', 'utf8'), {
    from: path.resolve('src/app/globals.css'),
  })
  for (const selector of [
    '.flex',
    '.bg-ink-950',
    '.text-ghost-text',
    '.rounded-card',
    '.font-800',
  ]) {
    expect(result.css.includes(`${selector} {`), `Missing compiled utility: ${selector}`).toBe(true)
  }
  expect(result.css).not.toMatch(/@theme\s*\{/)
})
