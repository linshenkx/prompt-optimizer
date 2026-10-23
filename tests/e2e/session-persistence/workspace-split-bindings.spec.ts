import { test, expect, type Page } from '@playwright/test'

test.use({ actionTimeout: 10000 })

const routes = [
  ['basic-system', '/#/basic/system'], ['basic-user', '/#/basic/user'],
  ['pro-multi', '/#/pro/multi'], ['pro-variable', '/#/pro/variable'],
  ['image-text2image', '/#/image/text2image'], ['image-image2image', '/#/image/image2image'],
  ['image-multiimage', '/#/image/multiimage'],
] as const

interface SavedWorkspace {
  layout: { mainSplitLeftPct: number; testColumnCount: number }
  testVariants: { id: string; version: string | number }[]
}

async function openTestRegion(page: Page) {
  await page.getByTestId('workspace-region-test').click()
  const toggle = page.getByTestId('test-config-toggle')
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
}

async function readSaved(page: Page, dbName: string, mode: string) {
  return page.evaluate(({ dbName, mode }) => new Promise<SavedWorkspace | null>((resolve, reject) => {
    const request = indexedDB.open(dbName)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('storage', 'readonly')
      const get = tx.objectStore('storage').get(`pref:session/v1/${mode}`)
      get.onsuccess = () => resolve(get.result ? JSON.parse(get.result.value) : null)
      get.onerror = () => reject(get.error)
      tx.oncomplete = () => db.close()
    }
  }), { dbName, mode })
}

for (const [mode, route] of routes) {
  test(`${mode} retains split and group choices across desktop, mobile and reload`, async ({ context, page }) => {
    const dbName = `test-split-bindings-${mode}-${Date.now()}`
    await context.addInitScript(name => {
      (window as Window & { __TEST_DB_NAME__?: string }).__TEST_DB_NAME__ = name
    }, dbName)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.getByTestId('workspace')).toBeVisible({ timeout: 20000 })
    await page.goto(route)
    const workspace = page.locator(`[data-testid="workspace"][data-mode="${mode}"]`)
    await expect(workspace).toBeVisible({ timeout: 20000 })
    const divider = workspace.locator('.split-divider')
    await divider.focus()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')
    await expect(divider).toHaveAttribute('aria-valuenow', '26')
    const handle = (await divider.boundingBox())!
    const splitRoot = (await divider.locator('..').boundingBox())!
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 20)
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2 + splitRoot.width * 0.1, handle.y + 20)
    await page.mouse.up()
    await expect(divider).toHaveAttribute('aria-valuenow', '36')

    const groups = workspace.locator('.test-group-count')
    await expect(groups.getByRole('radio', { name: '4', exact: true })).toBeDisabled()
    await groups.getByRole('radio', { name: '3', exact: true }).locator('..').click()
    await expect(workspace.locator('.variant-results > *')).toHaveCount(3)
    await page.setViewportSize({ width: 2560, height: 1000 })
    await expect(groups.getByRole('radio', { name: '4', exact: true })).toBeEnabled()
    await groups.getByRole('radio', { name: '4', exact: true }).locator('..').click()
    const cVersion = page.getByTestId(`${mode}-test-variant-c-version-select`)
    await cVersion.click()
    await page.locator('.n-base-select-option:visible').filter({ hasText: /^\s*(Original|原始)/i }).click()
    await expect(cVersion).toContainText(/Original|原始/i)

    await page.setViewportSize({ width: 360, height: 725 })
    await openTestRegion(page)
    await expect(divider).toHaveCount(0)
    await expect(workspace.locator('.variant-results > *')).toHaveCount(4)
    expect(await workspace.locator('.variant-results').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2)
    const options = workspace.locator('.test-plan-options')
    await options.locator('summary').click()
    await groups.getByRole('radio', { name: '2', exact: true }).locator('..').click()
    await expect(workspace.locator('.variant-results > *')).toHaveCount(2)
    await groups.getByRole('radio', { name: '4', exact: true }).locator('..').click()
    await options.locator('summary').click()
    const toggle = page.getByTestId('test-config-toggle')
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
    await expect(cVersion).toContainText(/Original|原始/i)
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
    await expect.poll(async () => (await readSaved(page, dbName, mode))?.testVariants.find(item => item.id === 'c')?.version).toBe(0)
    await page.reload()
    await expect(workspace).toBeVisible({ timeout: 20000 })
    await openTestRegion(page)
    await expect(cVersion).toContainText(/Original|原始/i)
    await expect(workspace.locator('.variant-results > *')).toHaveCount(4)
    expect((await readSaved(page, dbName, mode))?.layout.mainSplitLeftPct).toBe(36)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
