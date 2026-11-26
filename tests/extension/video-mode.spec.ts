import { chromium, expect, test } from '@playwright/test'
import { resolve } from 'node:path'

test('offers video prompt editing in the extension without a paid submission action', async ({}, info) => {
  const extension = resolve('packages/extension/dist')
  const context = await chromium.launchPersistentContext(info.outputPath('profile'), {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  })
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
    const page = await context.newPage()
    await page.goto(`chrome-extension://${new URL(worker.url()).host}/index.html#/video/create`)
    await expect(page.getByTestId('video-workspace')).toBeVisible()
    await page.getByTestId('video-output').locator('textarea').fill('A slow pan along the water.')
    await expect(page.getByTestId('video-optimize-button')).toBeVisible()
    await expect(page.getByTestId('video-test')).toContainText(/web or desktop|网页或桌面版|網頁或桌面版/i)
    await expect(page.getByTestId('video-run-all')).toHaveCount(0)
    await expect(page.getByTestId('video-run-b')).toHaveCount(0)
  } finally { await context.close() }
})
