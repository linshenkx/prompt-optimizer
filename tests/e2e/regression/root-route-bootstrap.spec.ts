import { test, expect } from '../fixtures'

async function waitForWorkspace(page: any, mode: string) {
  const workspace = page
    .locator(`[data-testid="workspace"][data-mode="${mode}"]`)
    .first()
  await expect(workspace).toBeVisible({ timeout: 20000 })
}

test.describe('Root route bootstrap', () => {
  test('navigating to / redirects to default workspace', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // In a clean test DB, global-settings defaults to basic/system.
    await waitForWorkspace(page, 'basic-system')
  })

  test('explicit navigation is not overridden by bootstrap redirect', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Immediately navigate to a non-root route; bootstrap logic must not replace it back.
    await page.goto('/#/image/text2image')
    await page.waitForLoadState('networkidle')
    await waitForWorkspace(page, 'image-text2image')
  })
})

