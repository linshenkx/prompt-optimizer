import { test, expect, type Locator, type Page } from '@playwright/test'

test.use({ actionTimeout: 10000 })
test.describe.configure({ timeout: 60000 })

const workspaces = [
  ['basic-system', '/#/basic/system', 'basicSystemSession'],
  ['basic-user', '/#/basic/user', 'basicUserSession'],
  ['pro-multi', '/#/pro/multi', 'proMultiMessageSession'],
  ['pro-variable', '/#/pro/variable', 'proVariableSession'],
  ['image-text2image', '/#/image/text2image', 'imageText2ImageSession'],
  ['image-image2image', '/#/image/image2image', 'imageImage2ImageSession'],
  ['image-multiimage', '/#/image/multiimage', 'imageMultiImageSession'],
] as const

const originalPrompt = [
  'Original source opening line.',
  ...Array.from({ length: 24 }, (_, index) => `Original paragraph ${index + 1}: preserve this complete prompt when moving between testing and editing.`),
  'ORIGINAL FINAL LINE',
].join('\n\n')
const workspacePrompt = [
  'Workspace source opening line.',
  ...Array.from({ length: 24 }, (_, index) => `Workspace paragraph ${index + 1}: keep every instruction available for comparison and further editing.`),
  'WORKSPACE FINAL LINE',
].join('\n\n')

async function seedSources(page: Page, mode: string, storeId: string) {
  // Seed through the real session actions, then reload through normal hydration.
  // No model response or preview component is mocked.
  await page.evaluate(async ({ mode, storeId, originalPrompt, workspacePrompt }) => {
    const app = (document.querySelector('#app') as any)?.__vue_app__
    const store = app?.config?.globalProperties?.$pinia?._s?.get(storeId)
    if (!store) throw new Error(`Missing workspace session: ${storeId}`)
    if (mode === 'pro-multi') {
      store.updateConversationMessages([
        { id: 'source-preview-message', role: 'system', content: originalPrompt, timestamp: Date.now() },
        { id: 'source-preview-user', role: 'user', content: 'Keep this surrounding user message.', timestamp: Date.now() },
      ])
      store.selectMessage('source-preview-message')
    } else {
      store.updatePrompt(originalPrompt)
    }
    store.updateOptimizedResult({ optimizedPrompt: workspacePrompt, reasoning: '', chainId: '', versionId: '' })
    store.updateTestVariant('a', { version: 0 })
    store.updateTestVariant('b', { version: 'workspace' })
    await store.saveSession()
  }, { mode, storeId, originalPrompt, workspacePrompt })
  await page.reload()
  if (mode === 'pro-multi') {
    await expect(page.getByTestId('pro-multi-message-card-0')).toBeVisible()
    // Selecting a message without a saved history chain clears its old draft.
    // Supply the completed result after that selection, as optimization does.
    await page.evaluate(({ storeId, workspacePrompt }) => {
      const app = (document.querySelector('#app') as any).__vue_app__
      app.config.globalProperties.$pinia._s.get(storeId).updateOptimizedResult({
        optimizedPrompt: workspacePrompt, reasoning: '', chainId: '', versionId: '',
      })
    }, { storeId, workspacePrompt })
  }
}

async function openSource(page: Page, group: 'A' | 'B') {
  await page.getByTestId('workspace-region-test').click()
  const toggle = page.getByTestId('test-config-toggle')
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
  await page.locator('.test-config-group-label').filter({ hasText: new RegExp(`^${group}$`) }).click()
  const modal = page.getByTestId('test-source-preview')
  await expect(modal).toBeVisible()
  return modal
}

async function expectReadableThroughLastLine(modal: Locator, source: 'ORIGINAL' | 'WORKSPACE') {
  const tail = modal.getByText(`${source} FINAL LINE`, { exact: true })
  await expect(tail).toBeAttached()
  await tail.scrollIntoViewIfNeeded()
  await expect(tail).toBeInViewport()
  await expect(modal).toContainText(`${source === 'ORIGINAL' ? 'Original' : 'Workspace'} source opening line.`)
}

async function expectSectionAtTop(workspace: Locator, section: 'original' | 'workspace') {
  await expect.poll(async () => {
    const container = (await workspace.locator('.optimize-workspace-layout').boundingBox())!
    const target = (await workspace.locator(`.optimize-${section}-scroll`).boundingBox())!
    return Math.abs(target.y - container.y)
  }).toBeLessThan(32)
}

for (const [mode, route, storeId] of workspaces) {
  test(`${mode} source previews preserve full content, edit destinations and desktop activation`, async ({ context, page }) => {
    await context.addInitScript(name => {
      (window as Window & { __TEST_DB_NAME__?: string }).__TEST_DB_NAME__ = name
    }, `test-source-preview-${mode}-${Date.now()}`)
    await page.setViewportSize({ width: 360, height: 669 })
    await page.goto('/')
    await expect(page.getByTestId('workspace')).toBeVisible({ timeout: 20000 })
    await page.goto(route)
    const workspace = page.locator(`[data-testid="workspace"][data-mode="${mode}"]`)
    await expect(workspace).toBeVisible({ timeout: 20000 })
    await seedSources(page, mode, storeId)
    await expect(workspace).toBeVisible({ timeout: 20000 })

    // Image modes already fold the original when restoring an optimized result.
    // Fold the other modes so editing A must expand the original input.
    const originalSection = workspace.locator('.optimize-original-scroll')
    const collapse = originalSection.getByRole('button', { name: /^(Collapse|收起)$/i })
    if (await collapse.isVisible()) await collapse.click()
    const originalInput = mode === 'pro-multi'
      ? page.getByTestId('pro-multi-message-card-0')
      : page.getByTestId(`${mode}-input`)
    await expect(originalInput).toBeHidden()

    let modal = await openSource(page, 'A')
    await expectReadableThroughLastLine(modal, 'ORIGINAL')
    if (mode === 'pro-multi') await expect(modal).toContainText('Keep this surrounding user message.')
    await modal.getByRole('button', { name: /Go to edit|前往编辑/i }).click()
    await expect(modal).toBeHidden()
    await expect(originalInput).toBeVisible()
    await expectSectionAtTop(workspace, 'original')

    modal = await openSource(page, 'B')
    await expectReadableThroughLastLine(modal, 'WORKSPACE')
    if (mode === 'pro-multi') await expect(modal).toContainText('Keep this surrounding user message.')
    await modal.getByRole('button', { name: /Go to edit|前往编辑/i }).click()
    await expect(modal).toBeHidden()
    await expectSectionAtTop(workspace, 'workspace')

    // A previous-version selection is read-only even when it falls back to V0.
    await page.getByTestId('workspace-region-test').click()
    const toggle = page.getByTestId('test-config-toggle')
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
    await page.getByTestId(`${mode}-test-original-version-select`).click()
    await page.locator('.n-base-select-option:visible').filter({ hasText: /Previous|上一版/i }).click()
    modal = await openSource(page, 'A')
    await expectReadableThroughLastLine(modal, 'ORIGINAL')
    await expect(modal.getByRole('button', { name: /Go to edit|前往编辑/i })).toHaveCount(0)
    await modal.locator('.n-card__footer').getByRole('button', { name: /^(Close|关闭)$/i }).click()

    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(workspace.locator('.split-divider')).toBeVisible()
    const sourceTags = workspace.locator('.test-variant-source-tag')
    await sourceTags.nth(1).click()
    await expect(page.getByTestId('test-source-preview')).toBeHidden()
    await expect(workspace.locator('.test-source-linked-card[data-source-tone="workspace"]')).toHaveAttribute('data-feedback-tone', 'change')
    await sourceTags.first().click()
    await expect(page.getByTestId('test-source-preview')).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
