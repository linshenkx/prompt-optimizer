import { test, expect } from '@playwright/test'

const firstThought = '先分析图形的结构与比例。'.repeat(24)
const secondThought = '再计算车架和车轮的位置。'

for (const scenario of [
  { route: 'basic/user', store: 'basicUserSession', run: 'basic-user-test-run-all' },
  { route: 'arena', store: 'arena-session', run: 'arena-run-all' },
]) {
  test(`${scenario.route}: reasoning has a visible viewport and survives completion and reload`, async ({ page, context }) => {
    await context.addInitScript(name => { (window as any).__TEST_DB_NAME__ = name }, `reasoning-${scenario.route}-${Date.now()}`)
    await page.goto(`/#/${scenario.route}`)
    await expect(page.getByTestId(scenario.run)).toBeVisible({ timeout: 25000 })
    await page.evaluate(async ({ scenario, firstThought, secondThought }) => {
      const app = (document.querySelector('#app') as any).__vue_app__
      const session = app.config.globalProperties.$pinia._s.get(scenario.store)
      const root = document.querySelector('[data-testid="arena-workspace"], [data-testid="workspace"]') as any
      const services = root.__vueParentComponent.provides.services.value
      const model = (await services.modelManager.getAllModels())[0]
      await services.modelManager.updateModel(model.id, { enabled: true,
        connectionConfig: { ...model.connectionConfig, apiKey: 'fixture-no-network' } })
      let continueReasoning!: () => void
      let complete!: () => void
      const nextReasoning = new Promise<void>(resolve => { continueReasoning = resolve })
      const finish = new Promise<void>(resolve => { complete = resolve })
      Object.assign(window, { __continueReasoning: continueReasoning, __completeReasoning: complete })
      const produce = async (callbacks: any) => {
        callbacks.onReasoningToken(firstThought)
        await nextReasoning
        callbacks.onReasoningToken(`\n${secondThought}`)
        await finish
        callbacks.onToken('这是最终正文。')
        callbacks.onComplete?.()
      }
      if (scenario.route === 'arena') {
        await session.refreshConfigs()
        session.state.prompt = '绘制一个简单的自行车图形。'
        session.state.contestants.forEach((column: any) => {
          column.kind = 'text'; column.configKey = model.id; column.modelId = model.modelMeta.id
        })
        services.llmService.sendMessageStream = async (_messages: unknown, _config: unknown, callbacks: any) => produce(callbacks)
      } else {
        session.prompt = '绘制一个简单的自行车图形。'
        session.testContent = '绘制图形'
        session.optimizedPrompt = '绘制图形'
        session.setTestColumnCount(2)
        session.testVariants = session.testVariants.map((variant: any) => ({ ...variant, modelKey: model.id, version: 0 }))
        services.promptService.testPromptStream = async (_system: string, _user: string, _model: string, callbacks: any) => produce(callbacks)
      }
    }, { scenario, firstThought, secondThought })

    await page.getByTestId(scenario.run).click()
    const output = scenario.route === 'arena'
      ? page.getByTestId('arena-deck').locator('.output-display-core').first()
      : page.getByTestId('basic-user-test-original-output')
    const reasoning = output.locator('.reasoning-content')
    await expect(reasoning).toBeVisible()
    await expect(reasoning.locator('.cm-content')).toContainText(firstThought)
    expect((await reasoning.boundingBox())?.height ?? 0).toBeGreaterThan(100)
    const wrapping = await reasoning.locator('.cm-line').first().evaluate(line => {
      const scroller = line.closest('.cm-scroller')!
      return { height: line.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(line).lineHeight),
        overflow: scroller.scrollWidth - scroller.clientWidth }
    })
    expect(wrapping.height).toBeGreaterThan(wrapping.lineHeight * 2)
    expect(wrapping.overflow).toBeLessThanOrEqual(1)
    await page.evaluate(() => (window as any).__continueReasoning())
    await expect(reasoning.locator('.cm-content')).toContainText(secondThought)
    await expect(reasoning.locator('.cm-line')).toHaveCount(2)
    await page.screenshot({ path: test.info().outputPath('reasoning-wrapped.png'), animations: 'disabled' })
    await page.evaluate(() => (window as any).__completeReasoning())
    await expect(output.getByTestId('output-stop')).toHaveCount(0)
    await expect(output.locator('.output-display-body')).toContainText('这是最终正文。')
    if (!await output.locator('.n-collapse-item--active').count()) await output.locator('.n-collapse-item__header-main').click()
    await expect(reasoning.locator('.markdown-content')).toBeVisible()
    await expect(reasoning.locator('.markdown-content')).toContainText(firstThought)
    await expect(reasoning.locator('.markdown-content')).toContainText(secondThought)
    await expect.poll(async () => (await reasoning.boundingBox())?.height ?? 0).toBeGreaterThan(40)
    await page.evaluate(async store => {
      const session = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get(store)
      await session.saveSession()
    }, scenario.store)
    await page.reload()
    await expect(output.locator('.output-display-body')).toContainText('这是最终正文。')
    if (!await output.locator('.n-collapse-item--active').count()) await output.locator('.n-collapse-item__header-main').click()
    await expect(reasoning.locator('.markdown-content')).toBeVisible()
    await expect(reasoning.locator('.markdown-content')).toContainText(firstThought)
    await expect(reasoning.locator('.markdown-content')).toContainText(secondThought)
    await expect.poll(async () => (await reasoning.boundingBox())?.height ?? 0).toBeGreaterThan(40)
    await page.screenshot({ path: test.info().outputPath('reasoning-visible.png'), animations: 'disabled' })
  })
}
