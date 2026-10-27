import { test as base, expect, chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Playwright's regular contexts force focus/visibility for automation. Connect
// to our own temporary browser's default context without those overrides when
// explicitly accepting native background behavior. Never attach a user profile.
export const test = base.extend({
  context: async ({ context }, use) => {
    if (process.env.OUTPUT_NATIVE_TAB_TEST !== '1') { await use(context); return }
    const server = await chromium.launchServer({ headless: false,
      args: ['--remote-debugging-port=0', '--js-flags=--max-old-space-size=128'],
    })
    try {
      const profile = server.process()?.spawnargs.find(value => value.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length)
      if (!profile) throw new Error('Native visibility test requires its temporary browser profile')
      const port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]!.trim()
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true })
      try { await use(browser.contexts()[0]!) } finally { await browser.close() }
    } finally { await server.close() }
  },
  page: async ({ page }, use) => {
    if (process.env.OUTPUT_NATIVE_TAB_TEST === '1') await page.setViewportSize({ width: 1440, height: 1000 })
    await use(page)
  },
})
export { expect }
