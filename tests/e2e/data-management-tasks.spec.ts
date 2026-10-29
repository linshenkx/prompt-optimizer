import { test, expect, type Page } from '@playwright/test'
import { resolve } from 'node:path'
import { startBackupWebDav } from './helpers/backup-webdav'

test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 })

async function openData(page: Page) {
  await expect(
    page
      .getByTestId('compact-global-menu')
      .or(page.getByRole('button', { name: /数据管理|Data Manager/, exact: false }).first())
      .filter({ visible: true })
      .first(),
  ).toBeVisible()
  if (await page.getByTestId('compact-global-menu').isVisible()) {
    await page.getByTestId('compact-global-menu').click()
    await page.getByTestId('compact-menu-data').click()
  } else {
    await page
      .getByRole('button', { name: /数据管理|Data Manager/, exact: false })
      .first()
      .click()
  }
  await expect(page.getByTestId('device-storage-total')).toHaveAttribute(
    'aria-label',
    /已用约|About/,
  )
  await expect(page.getByTestId('device-storage-total')).toBeInViewport()
}

async function assertNoHorizontalOverflow(page: Page) {
  const sizes = await page.locator('.data-manager-scroll-shell').evaluate((element) => ({
    scroll: element.scrollWidth,
    width: element.clientWidth,
    outside: [...element.querySelectorAll('input, button, textarea')]
      .filter((item) => {
        const rect = item.getBoundingClientRect()
        return rect.width > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1)
      })
      .map((item) => item.getAttribute('data-testid') || item.tagName),
  }))
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1)
  expect(sizes.outside).toEqual([])
}

test('downloads a local backup and restores its favorite and image only after confirmation', async ({
  browser,
  page,
  baseURL,
}, testInfo) => {
  test.setTimeout(90_000)
  const title = 'Local round-trip favorite'
  await page.goto('/#/favorites')
  await page.getByTestId('favorites-manager-add').click()
  await page.getByTestId('favorite-editor-title').locator('input').fill(title)
  await page
    .getByTestId('favorite-editor-content')
    .locator('textarea')
    .fill('Local backup content survives.')
  await page
    .locator('[data-testid="favorite-editor-image-upload-empty"] input[type="file"]')
    .setInputFiles(resolve('tests/e2e/fixtures/images/text2image-output.png'))
  await expect(page.getByTestId('favorite-editor-remove-image')).toBeVisible()
  await page.getByTestId('favorite-editor-save').click()
  await expect(page.getByTestId('favorite-detail-panel')).toContainText(title)
  await page.goto('/#/basic/system')
  await openData(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('local-backup-create').click()
  const download = await downloadPromise
  const file = testInfo.outputPath('local.po-backup.zip')
  await download.saveAs(file)
  await expect(page.getByTestId('local-backup-result')).toContainText(/下载|download/)

  const targetContext = await browser.newContext({ baseURL })
  try {
    const target = await targetContext.newPage()
    await target.goto('/#/basic/system')
    await openData(target)
    const fileChooserPromise = target.waitForEvent('filechooser')
    await target.locator('.local-file-picker button').focus()
    await target.keyboard.press('Enter')
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    })
    await expect(target.getByTestId('local-files-panel').getByRole('alert')).toBeVisible()
    await expect(target.getByTestId('restore-confirmation')).toBeHidden()
    // Use Chromium's file drag path so Naive receives real FileSystemEntry objects.
    // Synthetic DataTransfer files have a null webkitGetAsEntry(), unlike an OS drop.
    const dropTarget = target.locator('.local-file-picker .n-upload-trigger')
    await dropTarget.scrollIntoViewIfNeeded()
    const bounds = (await dropTarget.boundingBox())!
    const dragSession = await target.context().newCDPSession(target)
    for (const type of ['dragEnter', 'dragOver', 'drop'] as const) {
      await dragSession.send('Input.dispatchDragEvent', {
        type,
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
        data: { items: [], files: [file], dragOperationsMask: 1 },
      })
    }
    await dragSession.detach()
    await expect(target.getByTestId('restore-confirmation')).toBeVisible()
    await target.getByTestId('cloud-provider-webdav').click()
    await expect(target.getByTestId('data-storage-panel')).toBeVisible()
    await target.getByTestId('manage-cloud-connection').click()
    await expect(target.getByTestId('restore-confirmation')).toContainText('local.po-backup.zip')
    await target.getByTestId('backup-restore-confirm').click()
    await expect(target.getByTestId('data-manager-overview')).toBeHidden({ timeout: 30_000 })
    await target.waitForTimeout(1800) // App intentionally reloads after applying restored settings.
    await target.goto('/#/favorites')
    await target.getByTestId('favorite-workspace-list-item').filter({ hasText: title }).click()
    await expect(target.getByTestId('favorite-detail-panel')).toContainText(
      'Local backup content survives.',
    )
    await expect
      .poll(() =>
        target
          .getByTestId('favorite-detail-panel')
          .locator('img')
          .first()
          .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true)
  } finally {
    await targetContext.close()
  }
})

test('shows device usage first and retains drafts on narrow screens and after resizing', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/#/basic/system')
  await openData(page)
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('mobile-overview.png') })
  const providers = page.getByTestId('cloud-provider-options')
  await expect(providers.getByRole('button')).toHaveCount(4)
  for (const provider of ['google-drive', 'cloudflare-r2', 's3-compatible', 'webdav']) {
    await page.getByTestId(`cloud-provider-${provider}`).click()
    await expect(page.getByTestId(`cloud-provider-${provider}`)).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByTestId('remote-backup-create')).toBeHidden()
    await expect(page.getByTestId('remote-backup-refresh')).toBeHidden()
    await expect(page.getByTestId('remote-list-status')).toBeHidden()
    if (provider !== 'google-drive') {
      await expect(page.getByTestId('data-storage-panel')).toBeVisible()
      await expect(page.getByTestId('manage-cloud-connection')).toHaveAttribute('aria-expanded', 'true')
      await expect(page.getByTestId('remote-maintenance')).toBeHidden()
      await page.getByTestId('manage-cloud-connection').click()
    }
    await assertNoHorizontalOverflow(page)
  }
  await expect(page.getByTestId('data-storage-panel')).toBeHidden()
  await page.getByTestId('open-import-code').click()
  await page.getByTestId('remote-import-code-input').locator('textarea').fill('draft-code')
  await page.getByTestId('manage-cloud-connection').click()
  await page
    .getByTestId('data-storage-panel')
    .locator('input')
    .first()
    .fill('https://draft.invalid/dav')
  await assertNoHorizontalOverflow(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByTestId('manage-cloud-connection').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('manage-cloud-connection')).toBeFocused()
  await page.getByTestId('cloud-provider-google-drive').click()
  await page.getByTestId('cloud-provider-webdav').click()
  await page.getByTestId('manage-cloud-connection').click()
  await expect(page.getByTestId('data-storage-panel').locator('input').first()).toHaveValue(
    'https://draft.invalid/dav',
  )
  await page.getByTestId('manage-cloud-connection').click()
  await expect(page.getByTestId('remote-import-code-input').locator('textarea')).toHaveValue(
    'draft-code',
  )
  await page.getByTestId('open-import-code').click()
  await page.getByTestId('device-storage-total').scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('desktop-overview.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await assertNoHorizontalOverflow(page)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('data-manager-overview')).toBeHidden()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.locator('.theme-toggle').click()
  await page
    .locator('.n-dropdown-option')
    .filter({ hasText: /^(Dark|夜间)$/ })
    .click()
  await openData(page)
  await page.screenshot({ path: testInfo.outputPath('desktop-dark.png') })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 640,
    height: 400,
    deviceScaleFactor: 2,
    mobile: false,
  })
  await assertNoHorizontalOverflow(page)
  await page.getByTestId('local-backup-create').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('local-backup-create')).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('dark-200-percent-equivalent.png') })
  await cdp.send('Emulation.clearDeviceMetricsOverride')
})

test('creates and browses a cloud backup in place, restoring only after the explicit action', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const dav = await startBackupWebDav()
  try {
    await page.addInitScript(() =>
      localStorage.setItem(
        'prompt-optimizer:remote-backup-settings',
        JSON.stringify({
          provider: {
            kind: 'webdav',
            endpoint: '',
            username: 'backup-user',
            password: 'test-secret',
            directory: 'backups',
          },
        }),
      ),
    )
    await page.goto('/#/basic/system')
    await openData(page)
    await expect(page.getByTestId('data-storage-panel')).toBeVisible()
    await page.getByTestId('data-storage-panel').locator('input').first().fill(dav.endpoint)
    await page.getByRole('button', { name: /保存并连接|Save and Connect/ }).click()
    await expect(page.getByTestId('remote-list-status')).toContainText(
      /暂无远程备份|No remote backups/,
    )
    expect(dav.requests.every((request) => request.method === 'PROPFIND')).toBe(true)
    await expect(page.getByTestId('data-storage-panel')).toBeHidden()
    await expect(page.getByTestId('cloud-backups-panel')).toBeVisible()
    await page.getByTestId('remote-backup-create').click()
    await page.getByTestId('backup-result-view').click()
    await expect(page.getByTestId('restore-confirmation')).toBeHidden()
    await expect(page.locator('.n-message')).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('cloud-records.png') })
    await page.getByTestId('record-restore').first().click()
    await expect(page.getByTestId('restore-confirmation')).toBeVisible()
    await expect(page.locator('[data-testid="record-restore"][aria-expanded="true"]')).toHaveCount(
      1,
    )
    await page.screenshot({ path: testInfo.outputPath('cloud-confirmation.png') })
    await page.setViewportSize({ width: 320, height: 740 })
    await assertNoHorizontalOverflow(page)
    await page.getByTestId('backup-restore-confirm').scrollIntoViewIfNeeded()
    await expect(page.getByTestId('backup-restore-confirm')).toBeInViewport()
    await page.screenshot({ path: testInfo.outputPath('cloud-confirmation-mobile.png') })
    const beforeRestore = dav.requests.length
    await page.getByTestId('backup-restore-confirm').click()
    await expect(page.getByTestId('data-manager-overview')).toBeHidden({ timeout: 30_000 })
    expect(
      dav.requests
        .slice(beforeRestore)
        .every((request) => ['GET', 'PROPFIND'].includes(request.method)),
    ).toBe(true)
  } finally {
    await dav.close()
  }
})
