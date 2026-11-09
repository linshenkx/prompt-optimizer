import { test, expect, type Locator } from '@playwright/test'

test.use({ actionTimeout: 10000 })
test.describe.configure({ timeout: 60000 })

const source = [
  '中文长段落：' + '生成过程中应按面板宽度自动换行，完整保留原文。'.repeat(180),
  'English paragraph: ' + 'Long streaming output stays readable inside its panel. '.repeat(100),
  'https://example.com/' + 'unbroken-path-segment'.repeat(400),
  'FINAL LINE',
].join('\n')

async function expectWrapped(output: Locator) {
  const scroller = output.locator('.cm-scroller')
  await expect(scroller).toBeVisible()
  await expect.poll(() => scroller.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  const firstLine = output.locator('.cm-line').first()
  await expect.poll(() => firstLine.evaluate(element =>
    element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight),
  )).toBeGreaterThan(2)
}

for (const width of [1440, 390]) {
  test(`wraps streamed and completed source at ${width}px without changing copied text`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 1000 })
    await context.addInitScript(name => {
      const state = window as any
      state.__TEST_DB_NAME__ = name
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => { state.__copiedOutput = text },
          readText: async () => state.__copiedOutput || '',
        },
      })
    }, `output-wrapping-${width}-${Date.now()}`)
    await page.goto('/#/basic/user')
    await expect(page.getByTestId('workspace')).toBeVisible({ timeout: 25000 })
    await page.evaluate(async source => {
      const session = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicUserSession')
      const services = (document.querySelector('[data-testid="workspace"]') as any).__vueParentComponent.provides.services.value
      const model = (await services.modelManager.getAllModels())[0]
      await services.modelManager.updateModel(model.id, { enabled: true, connectionConfig: { ...model.connectionConfig, apiKey: 'fixture-no-network' } })
      session.prompt = 'Generate readable long output'
      session.testContent = 'Generate readable long output'
      await new Promise(resolve => setTimeout(resolve, 20))
      session.optimizedPrompt = 'Generate readable long output'
      session.setTestColumnCount(2)
      session.testVariants = session.testVariants.map((variant: any) => ({ ...variant, modelKey: model.id, version: 0 }))
      const state = window as any
      state.__resumeWrapping = []
      services.promptService.testPromptStream = async (_system: string, _user: string, _model: string, callbacks: any) => {
        callbacks.onToken(source.slice(0, 2000))
        await new Promise<void>(resolve => state.__resumeWrapping.push(resolve))
        callbacks.onToken(source.slice(2000))
        await callbacks.onComplete()
      }
    }, source)
    if (width < 768) await page.getByTestId('workspace-region-test').click()
    await page.getByTestId('basic-user-test-run-all').click()
    const output = page.getByTestId('basic-user-test-original-output')
    await expect.poll(() => page.evaluate(() => (window as any).__resumeWrapping.length)).toBe(2)
    await expectWrapped(output)
    await page.evaluate(() => (window as any).__resumeWrapping.forEach((resume: () => void) => resume()))
    await expect(page.getByTestId('basic-user-test-run-all')).toBeEnabled()

    // Recreate the source view after completion, as switching Preview/Source does.
    const menu = output.getByTestId('output-view-menu')
    if (await menu.isVisible()) {
      await menu.click()
      await page.locator('.n-dropdown-option').filter({ hasText: /^(Source|原文)$/ }).click()
    } else {
      await output.locator('[data-testid$="-view-source"]').click()
    }
    await expectWrapped(output)
    // Virtualized long lines refine their estimated heights as they enter view.
    await expect.poll(async () => {
      await output.locator('.cm-scroller').evaluate(element => { element.scrollTop = element.scrollHeight })
      return output.locator('.cm-line').last().textContent()
    }).toBe('FINAL LINE')
    await expect.poll(() => output.locator('.cm-scroller').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    const copy = output.locator('.output-copy-split-primary')
    if (await copy.isVisible()) await copy.click()
    else {
      await output.getByTestId('output-compact-actions').click()
      await page.locator('.n-dropdown-option').filter({ hasText: /^(Copy only|仅复制|僅複製)$/ }).click()
    }
    await expect.poll(() => page.evaluate(() => (window as any).__copiedOutput)).toBe(source)
  })
}
