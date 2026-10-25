import { test, expect, type Page } from '@playwright/test'

test.use({ actionTimeout: 10000 })
test.describe.configure({ timeout: 90000 })

async function openDataManager(page: Page, compact: boolean, task: 'export' | 'import') {
  if (compact) {
    await page.getByTestId('compact-global-menu').click()
    await page.getByTestId('compact-menu-data').click()
    await page.getByTestId(`data-manager-task-${task}`).click()
  } else {
    await page.getByTestId('header-modal-actions').getByRole('button', { name: /Data Manager|数据管理/ }).click()
  }
  await expect(page.locator('.data-manager-modal')).toBeVisible()
}

for (const compact of [true, false]) {
  const layout = compact ? 'mobile' : 'desktop'
  test.describe(layout, () => {
    test.beforeEach(async ({ context, page }, testInfo) => {
      await context.addInitScript(name => {
        (window as any).__TEST_DB_NAME__ = name
      }, `settings-extraction-${testInfo.testId}-${Date.now()}`)
      await page.setViewportSize(compact ? { width: 360, height: 669 } : { width: 1366, height: 900 })
      await page.goto('/')
      await expect(page.getByTestId('workspace')).toBeVisible({ timeout: 30000 })
    })

    test('backup file restores global settings after the normal import reload', async ({ page }, testInfo) => {
      await page.evaluate(async () => {
        const store = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('globalSettings')
        store.updateThemeId('light')
        store.updatePreferredLanguage('en-US')
        store.updateBuiltinTemplateLanguage('en-US')
        await store.saveGlobalSettings()
      })
      await page.reload()
      await expect(page.getByTestId('workspace')).toBeVisible()
      await openDataManager(page, compact, 'export')
      const download = page.waitForEvent('download')
      await page.locator('.data-manager-modal').getByRole('button', { name: /^(Export Data|导出数据)$/ }).click()
      const file = await download
      const path = testInfo.outputPath('settings.po-backup.zip')
      await file.saveAs(path)
      await page.keyboard.press('Escape')
      await page.evaluate(async () => {
        const store = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('globalSettings')
        store.updateThemeId('dark')
        store.updatePreferredLanguage('zh-CN')
        store.updateBuiltinTemplateLanguage('zh-CN')
        await store.saveGlobalSettings()
      })
      await page.reload()
      await expect(page.getByTestId('workspace')).toBeVisible()
      await openDataManager(page, compact, 'import')
      await page.locator('.data-manager-modal input[type="file"]').setInputFiles(path)
      const navigation = page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame() })
      await page.locator('.data-manager-modal').getByRole('button', { name: /^(Import Data|导入数据)$/ }).click()
      await navigation
      await expect(page.getByTestId('workspace')).toBeVisible()
      await expect.poll(() => page.evaluate(() => {
        const store = (document.querySelector('#app') as any)?.__vue_app__?.config.globalProperties.$pinia?._s.get('globalSettings')
        return store && [store.state.selectedThemeId, store.state.preferredLanguage, store.state.builtinTemplateLanguage]
      })).toEqual(['light', 'en-US', 'en-US'])
      // Check the rendered language too: restoring only the Pinia snapshot
      // misses bootstrap consumers that still read the compatibility key.
      await expect(page.getByTestId('basic-system-optimize-button')).toHaveText('Optimize')
      const buttonBounds = await page.getByTestId('basic-system-optimize-button').evaluate(button => {
        const outer = button.getBoundingClientRect()
        const range = document.createRange()
        range.selectNodeContents(button.querySelector('.n-button__content')!)
        const content = range.getBoundingClientRect()
        return { left: outer.left, right: outer.right, contentLeft: content.left, contentRight: content.right }
      })
      expect(buttonBounds.contentLeft).toBeGreaterThanOrEqual(buttonBounds.left - 1)
      expect(buttonBounds.contentRight).toBeLessThanOrEqual(buttonBounds.right + 1)
      await page.screenshot({ path: testInfo.outputPath('restored-settings.png') })
    })

    test('extract button opens selectable results, cancel is safe, and confirmed variables survive reload', async ({ page }, testInfo) => {
      await page.goto('/#/pro/variable')
      await expect(page.locator('[data-mode="pro-variable"]')).toBeVisible()
      const modelKey = await page.evaluate(async () => {
        const workspace = document.querySelector('[data-testid="workspace"]') as any
        const services = workspace.__vueParentComponent.provides.services.value
        const models = await services.modelManager.getAllModels()
        const model = models.find((entry: any) => entry.providerMeta.id === 'openai') || models[0]
        if (!model) throw new Error('Missing built-in model fixture')
        await services.modelManager.updateModel(model.id, { enabled: true, connectionConfig: { ...model.connectionConfig, apiKey: 'fixture-no-network' } })
        const session = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('proVariableSession')
        session.updatePrompt('Plan a trip to Paris for three days.')
        session.updateOptimizeModel(model.id)
        session.setTemporaryVariable('existing', 'preserved')
        await session.saveSession()
        return model.id
      })
      await page.reload()
      await expect(page.locator('[data-mode="pro-variable"]')).toBeVisible()
      // Only model output is deterministic; button wiring, dialog, session writes and persistence are real.
      await page.evaluate(() => {
        const services = (document.querySelector('[data-testid="workspace"]') as any).__vueParentComponent.provides.services.value
        ;(window as any).__extractionRequests = []
        services.variableExtractionService.extract = async (request: unknown) => {
          ;(window as any).__extractionRequests.push(request)
          return { summary: 'Choose reusable trip details', variables: [
            { name: 'destination', value: 'Paris', reason: 'Travel destination', position: { originalText: 'Paris', occurrence: 1 } },
            { name: 'duration', value: 'three days', reason: 'Length of stay', position: { originalText: 'three days', occurrence: 1 } },
          ] }
        }
      })
      const extract = page.getByRole('button', { name: /Auto Extract Variables|自动提取变量/ })
      await extract.click()
      const dialog = page.getByRole('dialog').filter({ hasText: /Auto Extraction Results|自动提取结果/ })
      await expect(dialog).toBeVisible()
      const box = await dialog.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
      await dialog.getByRole('button', { name: /^(Cancel|取消)$/ }).click()
      await expect(dialog).toBeHidden()
      await extract.click()
      await expect(dialog).toBeVisible()
      const duration = compact ? dialog.getByRole('checkbox', { name: 'duration', exact: true })
        : dialog.locator('tr').filter({ hasText: 'duration' }).getByRole('checkbox')
      await duration.uncheck()
      await expect(duration).not.toBeChecked()
      await page.screenshot({ path: testInfo.outputPath('extraction-selection.png'), animations: 'disabled' })
      await dialog.getByRole('button', { name: /Batch Create|批量创建/ }).click()
      await expect(dialog).toBeHidden()
      const state = await page.evaluate(() => {
        const session = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('proVariableSession')
        return { prompt: session.prompt, variables: session.temporaryVariables, requests: (window as any).__extractionRequests }
      })
      expect(state.prompt).toBe('Plan a trip to {{destination}} for three days.')
      expect(state.variables).toEqual({ existing: 'preserved', destination: 'Paris' })
      expect(state.requests).toHaveLength(2)
      expect(state.requests[0]).toMatchObject({ extractionModelKey: modelKey, existingVariableNames: expect.arrayContaining(['existing']) })
      // Observe normal autosave rather than forcing a save from the test.
      await expect.poll(() => page.evaluate(async () => {
        const services = (document.querySelector('[data-testid="workspace"]') as any).__vueParentComponent.provides.services.value
        return JSON.stringify(await services.preferenceService.get('session/v1/pro-variable', ''))
      })).toContain('{{destination}}')
      await page.reload()
      await expect(page.locator('[data-mode="pro-variable"]')).toBeVisible()
      await expect.poll(() => page.evaluate(() => {
        const session = (document.querySelector('#app') as any)?.__vue_app__?.config.globalProperties.$pinia?._s.get('proVariableSession')
        return session && { prompt: session.prompt, variables: session.temporaryVariables }
      })).toEqual({ prompt: state.prompt, variables: state.variables })
    })
  })
}
