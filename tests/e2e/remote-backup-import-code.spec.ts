import { test, expect, devices, type Page, type Browser } from '@playwright/test'
import { resolve } from 'node:path'
import { startBackupWebDav } from './helpers/backup-webdav'

const title = 'Import code cross-device backup'
const content = 'This favorite and its image must survive cloud restore.'
test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 })

async function field(page: Page, testId: string) {
  return page.getByTestId(testId).locator('input, textarea').first()
}

async function openDataManager(page: Page) {
  if (await page.getByTestId('compact-global-menu').isVisible()) {
    await page.getByTestId('compact-global-menu').click()
    await page.getByTestId('compact-menu-data').click()
    await page.getByTestId('data-manager-task-remote').click()
  } else {
    await page.getByRole('button', { name: /数据管理|Data Manager/, exact: false }).first().click()
  }
  await expect(page.getByTestId('remote-import-code-input')).toBeVisible()
}

async function expectRestored(page: Page) {
  await expect(page.getByTestId('remote-import-code-input')).toBeHidden({ timeout: 30_000 })
  await expect.poll(async () => page.evaluate(() =>
    localStorage.getItem('prompt-optimizer:remote-backup-settings'))).toContain('test-secret')
  // The app's existing restore handler reloads to apply all imported settings.
  await page.waitForTimeout(1800)
  await page.goto(new URL('/#/favorites', page.url()).href)
  await expect(page.getByTestId('favorite-workspace-list-item').filter({ hasText: title })).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('favorite-workspace-list-item').filter({ hasText: title }).click()
  await expect(page.getByTestId('favorite-detail-panel')).toContainText(content)
  const image = page.getByTestId('favorite-detail-panel').locator('img').first()
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
}

test('browser code and phone QR link restore a cloud backup including its images', async ({ browser, baseURL, playwright }, testInfo) => {
  test.setTimeout(180_000)
  const webdav = await startBackupWebDav()
  const sourceContext = await browser.newContext({ baseURL })
  const contexts = [sourceContext]
  const connection = { kind: 'webdav', endpoint: webdav.endpoint, username: 'backup-user', password: 'test-secret', directory: 'backups' }
  let peerBrowser: Browser | undefined
  try {
    const source = await sourceContext.newPage()
    await source.addInitScript(connection => localStorage.setItem('prompt-optimizer:remote-backup-settings', JSON.stringify({ provider: connection })), connection)
    await source.goto('/#/favorites')
    await source.getByTestId('favorites-manager-add').click()
    await (await field(source, 'favorite-editor-title')).fill(title)
    await (await field(source, 'favorite-editor-content')).fill(content)
    await source.locator('[data-testid="favorite-editor-image-upload-empty"] input[type="file"]').setInputFiles(
      resolve('tests/e2e/fixtures/images/text2image-output.png'),
    )
    await expect(source.getByTestId('favorite-editor-remove-image')).toBeVisible()
    await source.getByTestId('favorite-editor-save').click()
    await expect(source.getByTestId('favorite-detail-panel')).toContainText(title)
    await source.goto('/#/basic/system')
    await openDataManager(source)
    await source.getByTestId('remote-backup-create').click()
    await expect.poll(() => [...webdav.files.keys()].filter(key => key.endsWith('/manifest.json')).length, { timeout: 30_000 }).toBe(1)
    await expect(source.getByTestId('remote-import-code-export')).toBeEnabled()
    await source.getByTestId('remote-import-code-export').click()
    const code = await source.getByTestId('remote-import-code-output').locator('textarea').inputValue()
    expect(code).toMatch(/^POBACKUP:/)
    await expect(source.getByTestId('remote-import-code-qr').locator('svg')).toBeVisible()
    await source.getByTestId('remote-import-code-qr').screenshot({ path: testInfo.outputPath('import-qr.png') })
    // Construct the same link from the displayed code so the fresh phone context
    // exercises startup routing and the real QR landing flow.
    const link = `${baseURL}/#/basic/system?backupImport=${encodeURIComponent(code)}`
    const manifestPath = [...webdav.files.keys()].find(key => key.endsWith('/manifest.json'))!
    const manifest = JSON.parse(webdav.files.get(manifestPath)!.toString())
    expect(manifest.assets.length).toBeGreaterThan(0)
    const readBoundary = webdav.requests.length

    if (testInfo.project.name === 'chrome' || testInfo.project.name === 'edge') {
      peerBrowser = await playwright.chromium.launch({
        channel: testInfo.project.name === 'chrome' ? 'msedge' : 'chrome', headless: true,
      })
    }
    const targetContext = await (peerBrowser || browser).newContext({ baseURL })
    contexts.push(targetContext)
    const target = await targetContext.newPage()
    await target.goto('/#/basic/system')
    await openDataManager(target)
    await target.getByTestId('remote-import-code-input').locator('textarea').fill(code)
    await target.getByTestId('remote-import-code-submit').click()
    await expectRestored(target)

    const phoneContext = await browser.newContext({ ...devices['Pixel 7'], baseURL, viewport: { width: 393, height: 851 } })
    contexts.push(phoneContext)
    const phone = await phoneContext.newPage()
    await phone.goto(link)
    await expect(phone.getByTestId('remote-import-code-input')).toBeVisible({ timeout: 30_000 })
    await expect(phone).not.toHaveURL(/backupImport/)
    await expect(phone.getByTestId('remote-import-code-input').locator('textarea')).toHaveValue(code)
    expect(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await phone.screenshot({ path: testInfo.outputPath('phone-import.png') })
    await phone.getByTestId('remote-import-code-submit').click()
    await expectRestored(phone)

    // Initial connection probes may write their test file, but imports must not
    // upload a new business snapshot or replace cloud data.
    expect(webdav.requests.slice(readBoundary).filter(request => request.method === 'PUT' && request.path.endsWith('/manifest.json'))).toHaveLength(0)
  } finally {
    for (const context of contexts) await context.close()
    await peerBrowser?.close()
    await webdav.close()
  }
})
