import { test, expect } from '../fixtures/native-output-browser'

test.describe.configure({ timeout: 90000 })
// Native visibility acceptance must run without continuous screen capture.
test.use({ viewport: { width: 1440, height: 1000 }, actionTimeout: 10000,
  ...(process.env.OUTPUT_NATIVE_TAB_TEST === '1' ? { video: 'off' as const } : {}),
})

const cases = [
  { route: 'basic/user', mode: 'basic-user', store: 'basicUserSession', columns: 4 },
  { route: 'basic/system', mode: 'basic-system', store: 'basicSystemSession', columns: 4 },
  { route: 'pro/variable', mode: 'pro-variable', store: 'proVariableSession', columns: 2 },
  { route: 'pro/multi', mode: 'pro-multi', store: 'proMultiMessageSession', columns: 2 },
]
const sources = [
  'An HTML artifact:\n```html\n<!doctype html><html><body><svg id="flight">'
    + '<path d="M1 2 L30 40 Q50 60 70 80 Z"/>\n'.repeat(3000)
    + '</svg><button id="counter" onclick="this.textContent=Number(this.textContent)+1">0</button></body></html>\n```',
  '# Dense Markdown\n' + '- **literal $` $&** [link](https://example.com)\n'.repeat(1600),
  'one long line: ' + "literal $& $' $` text ".repeat(7000),
  ('Code:\n```text\n  $` $& $\' CODE_BLOCK_0\n\n\n  literal\n```\n\n').repeat(1200),
]

test('optimization streams through the same document and commits complete history once', async ({ page, context }) => {
  await context.addInitScript(name => { (window as any).__TEST_DB_NAME__ = name }, `output-optimize-${Date.now()}`)
  await page.goto(new URL('/#/basic/user', test.info().project.use.baseURL).toString())
  await expect(page.getByTestId('workspace')).toBeVisible({ timeout: 25000 })
  const source = '```html\n<!doctype html><html><body>' + '<p>literal $& $`</p>\r\n'.repeat(300) + '</body></html>\n```'
  await page.evaluate(async source => {
    const app = (document.querySelector('#app') as any).__vue_app__
    const session = app.config.globalProperties.$pinia._s.get('basicUserSession')
    const services = (document.querySelector('[data-testid="workspace"]') as any).__vueParentComponent.provides.services.value
    const model = (await services.modelManager.getAllModels())[0]
    await services.modelManager.updateModel(model.id, { enabled: true, connectionConfig: { ...model.connectionConfig, apiKey: 'fixture-no-network' } })
    session.prompt = 'Generate a web page'
    await new Promise(resolve => setTimeout(resolve, 20))
    session.selectedOptimizeModelKey = model.id
    session.selectedTemplateId = 'user-prompt-basic'
    services.promptService.optimizePromptStream = async (_request: unknown, callbacks: any) => {
      callbacks.onReasoningToken('literal reasoning')
      callbacks.onToken(source.slice(0, 3000))
      await new Promise<void>(resolve => { (window as any).__resumeOptimization = resolve })
      callbacks.onToken(source.slice(3000))
      await callbacks.onComplete()
    }
  }, source)
  await page.getByTestId('basic-user-optimize-button').click()
  const output = page.getByTestId('basic-user-output')
  await expect(output.getByTestId('output-stop')).toBeVisible()
  await expect(output.getByTestId('output-source-view').first()).toBeVisible()
  const pending = await page.evaluate(() => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicUserSession').optimizedPrompt)
  expect(pending).toBe('')
  await page.evaluate(() => (window as any).__resumeOptimization())
  await expect(output.getByTestId('output-stop')).toHaveCount(0)
  await expect(page.getByTestId('basic-user-optimize-button')).toBeEnabled()
  const result = await page.evaluate(async () => {
    const session = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicUserSession')
    const services = (document.querySelector('[data-testid="workspace"]') as any).__vueParentComponent.provides.services.value
    const chain = await services.historyManager.getChain(session.chainId)
    return { content: session.optimizedPrompt, versions: chain.versions, chain: session.chainId }
  })
  expect(result.content === source).toBe(true)
  expect(result.chain).toBeTruthy()
  expect(result.versions).toHaveLength(1)
  expect(result.versions[0].optimizedPrompt === source).toBe(true)
})

test('stops only the selected concurrent request and persists capacity/failure outcomes', async ({ page, context }) => {
  await context.addInitScript(name => { (window as any).__TEST_DB_NAME__ = name }, `output-terminal-${Date.now()}`)
  await page.goto(new URL('/#/basic/user', test.info().project.use.baseURL).toString())
  await expect(page.getByTestId('workspace')).toBeVisible({ timeout: 25000 })
  await page.evaluate(async () => {
    const state = window as any
    const pinia = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia
    const session = pinia._s.get('basicUserSession')
    const services = (document.querySelector('[data-testid="workspace"]') as any).__vueParentComponent.provides.services.value
    const model = (await services.modelManager.getAllModels())[0]
    await services.modelManager.updateModel(model.id, { enabled: true, connectionConfig: { ...model.connectionConfig, apiKey: 'fixture-no-network' } })
    session.prompt = 'Generate output'
    session.testContent = 'Generate output'
    await new Promise(resolve => setTimeout(resolve, 20))
    session.optimizedPrompt = 'Generate output'
    session.setTestColumnCount(2)
    session.testVariants = session.testVariants.map((variant: any) => ({ ...variant, modelKey: model.id, version: 0 }))
    session.testVariantResults = { a: { result: '', reasoning: '' }, b: { result: '', reasoning: '' } }
    state.__terminalActive = 0
    state.__terminalAborted = 0
    state.__terminalMode = 'idle'
    services.promptService.testPromptStream = async (_system: string, _user: string, _model: string, callbacks: any) => {
      state.__terminalActive++
      try {
        if (!(callbacks.signal instanceof AbortSignal)) throw new Error('Missing native cancellation signal')
        callbacks.signal.addEventListener('abort', () => state.__terminalAborted++, { once: true })
        callbacks.onToken('literal $& $`\r\nkept prefix\r\n')
        if (state.__terminalMode === 'capacity') callbacks.onToken('z'.repeat(1100000))
        if (state.__terminalMode === 'failure') throw new Error('fixture provider failure')
        await new Promise((_resolve, reject) => callbacks.signal.addEventListener('abort', () => reject(callbacks.signal.reason), { once: true }))
      } finally { state.__terminalActive-- }
    }
  })
  const run = page.getByTestId('basic-user-test-run-all')
  const original = page.getByTestId('basic-user-test-original-output')
  const optimized = page.getByTestId('basic-user-test-optimized-output')
  await run.click()
  await expect.poll(() => page.evaluate(() => (window as any).__terminalActive)).toBe(2)
  await original.getByTestId('output-stop').click()
  await expect.poll(() => page.evaluate(() => (window as any).__terminalActive)).toBe(1)
  await expect(optimized.getByTestId('output-stop')).toBeVisible()
  await optimized.getByTestId('output-stop').click()
  await expect(run).toBeEnabled()
  await expect.poll(() => page.evaluate(() => (window as any).__terminalAborted)).toBe(2)
  for (const mode of ['cancelled', 'capacity', 'failed']) {
    if (mode !== 'cancelled') {
      await page.evaluate(value => { (window as any).__terminalMode = value }, mode === 'failed' ? 'failure' : mode)
      await run.click()
      await expect(run).toBeEnabled()
    }
    const records = await page.evaluate(() => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicUserSession').testVariantResults)
    for (const id of ['a', 'b']) {
      expect(records[id].status).toBe(mode)
      expect(records[id].result).toBe('literal $& $`\r\nkept prefix\r\n')
    }
    expect(await page.getByTestId('html-preview-frame').count()).toBe(0)
  }
  await page.evaluate(async () => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('sessionManager').saveAllSessions())
  await page.reload()
  await expect(page.getByTestId('workspace')).toBeVisible({ timeout: 25000 })
  const restored = await page.evaluate(() => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicUserSession').testVariantResults.a)
  expect(restored.status).toBe('failed')
  expect(restored.result).toBe('literal $& $`\r\nkept prefix\r\n')
})

for (const scenario of cases) {
  test(`${scenario.mode}: concurrent documents survive ${process.env.OUTPUT_NATIVE_TAB_TEST === '1' ? 'native background' : 'background/freeze'} under slow CPU`, async ({ page, context }) => {
    const nativeVisibility = process.env.OUTPUT_NATIVE_TAB_TEST === '1'
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await context.addInitScript(name => {
      (window as any).__TEST_DB_NAME__ = name
      ;(window as any).__outputVisibilityEvents = []
      document.addEventListener('visibilitychange', () => (window as any).__outputVisibilityEvents.push(document.visibilityState))
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as any).__copiedOutput = text }, readText: async () => (window as any).__copiedOutput || '' } })
    }, `output-architecture-${scenario.mode}-${Date.now()}`)
    await page.goto(new URL(`/#/${scenario.route}`, test.info().project.use.baseURL).toString())
    await expect(page.getByTestId('workspace')).toBeVisible({ timeout: 25000 })
    if (nativeVisibility) {
      await page.bringToFront()
      await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible')
    }
    await page.evaluate(async ({ scenario, sources }) => {
      const app = (document.querySelector('#app') as any).__vue_app__
      const pinia = app.config.globalProperties.$pinia
      const session = pinia._s.get(scenario.store)
      const services = (document.querySelector('[data-testid="workspace"]') as any).__vueParentComponent.provides.services.value
      const model = (await services.modelManager.getAllModels())[0]
      await services.modelManager.updateModel(model.id, { enabled: true, connectionConfig: { ...model.connectionConfig, apiKey: 'fixture-no-network' } })
      if (scenario.mode === 'pro-multi') {
        session.conversationMessagesSnapshot = [{ id: 'system', role: 'system', content: 'Generate the requested output' }, { id: 'user', role: 'user', content: 'Draw an SVG page' }]
        session.selectedMessageId = 'user'
      } else session.prompt = 'Draw an SVG page'
      session.testContent = 'Draw an SVG page'
      await new Promise(resolve => setTimeout(resolve, 20))
      session.optimizedPrompt = 'Draw a complete SVG page'
      session.setTestColumnCount(scenario.columns)
      session.testVariants = session.testVariants.map((variant: any) => ({ ...variant, modelKey: model.id }))
      const state = window as any
      Object.assign(state, { __outputActive: 0, __outputPeak: 0, __outputHeld: 0, __outputCalls: 0, __outputFinished: 0, __stateUpdates: 0, __receivedLengths: [], __maxSourceNodes: 0 })
      session.$subscribe(() => { state.__stateUpdates++ })
      let releaseStart!: () => void
      const start = new Promise<void>(resolve => { releaseStart = resolve })
      const resume = new Promise<void>(resolve => { state.__resumeOutput = resolve })
      const produce = async (callbacks: any) => {
        const column = state.__outputCalls++
        state.__outputActive++
        state.__outputPeak = Math.max(state.__outputPeak, state.__outputActive)
        if (state.__outputActive === scenario.columns) releaseStart()
        // Serial scheduling cannot get past this barrier.
        await start
        let held = false
        try {
          const source = sources[column]
          for (let offset = 0; offset < source.length; offset += 4096) {
            callbacks.signal?.throwIfAborted()
            callbacks.onToken(source.slice(offset, offset + 4096))
            callbacks.onReasoningToken('reason🐋\n')
            state.__receivedLengths[column] = Math.min(offset + 4096, source.length)
            state.__maxSourceNodes = Math.max(state.__maxSourceNodes, document.querySelectorAll('[data-testid="output-source-view"] *').length)
            if (!held && offset >= source.length / 2) { held = true; state.__outputHeld++; await resume }
            await new Promise(resolve => setTimeout(resolve, 8))
          }
          callbacks.onComplete()
        } finally { state.__outputActive--; state.__outputFinished++ }
      }
      services.promptService.testPromptStream = async (_system: string, _user: string, _model: string, callbacks: any) => produce(callbacks)
      services.promptService.testCustomConversationStream = async (_request: unknown, callbacks: any) => produce(callbacks)
    }, { scenario, sources })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.getByTestId(`${scenario.mode}-test-run-all`).click()
    await page.waitForFunction(count => (window as any).__outputHeld === count, scenario.columns, { timeout: 30000, polling: 100 })
    const first = page.locator('.variant-result-card .output-display-core').first()
    await expect(first.getByTestId('output-source-view')).toBeVisible()
    // Native background windows can suspend rAF; the button is already visible.
    // Skip Playwright's rAF-based stability wait without overriding visibility.
    await first.locator('.output-copy-split-primary').click({ force: nativeVisibility })
    const checkpoint = await page.evaluate(async ({ scenario }) => {
      const state = window as any
      const pinia = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia
      const services = (document.querySelector('[data-testid="workspace"]') as any).__vueParentComponent.provides.services.value
      const before = pinia._s.get(scenario.store).testVariantResults.a.result
      await pinia._s.get('sessionManager').saveAllSessions()
      const saved = await services.preferenceService.get(`session/v1/${scenario.mode}`, null)
      return { before, saved: saved.testVariantResults, lengths: state.__receivedLengths, copied: state.__copiedOutput, peak: state.__outputPeak, updates: state.__stateUpdates }
    }, { scenario })
    expect(checkpoint.before).toBe('')
    expect(checkpoint.peak).toBe(scenario.columns)
    expect(checkpoint.updates).toBeLessThan(24)
    expect(checkpoint.copied?.length).toBe(sources[0]!.slice(0, checkpoint.lengths[0]).trim().length)
    expect(checkpoint.copied === sources[0]!.slice(0, checkpoint.lengths[0]).trim()).toBe(true)
    for (let index = 0; index < scenario.columns; index++) {
      expect(checkpoint.saved['abcd'[index]!].result === sources[index]!.slice(0, checkpoint.lengths[index])).toBe(true)
    }
    // Headless Chromium keeps all tabs visible. Exercise the actual visibility
    // handlers, then freeze/resume the renderer through Chromium's lifecycle API.
    let background: typeof page | undefined
    if (nativeVisibility) {
      background = await context.newPage()
      await background.goto('about:blank')
      await background.bringToFront()
      await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('hidden')
    } else {
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
        document.dispatchEvent(new Event('visibilitychange'))
      })
    }
    if (!nativeVisibility) {
      await cdp.send('Page.setWebLifecycleState', { state: 'frozen' })
      await cdp.send('Page.setWebLifecycleState', { state: 'active' })
    }
    // Native background tabs throttle their timers. Observe real incoming data
    // there, then return to finish; also cover completion while hidden in the
    // deterministic visibility case.
    await page.evaluate(() => (window as any).__resumeOutput())
    let backgroundReceivedLengths: number[] = []
    if (nativeVisibility) {
      await expect.poll(() => page.evaluate(lengths => {
        const state = window as any
        if (!state.__receivedLengths) throw new Error(`Native page state missing: ${location.href}; discarded=${document.wasDiscarded}; resume=${typeof state.__resumeOutput}`)
        return state.__receivedLengths.some((value: number, index: number) => value > lengths[index])
      }, checkpoint.lengths), { timeout: 10000 }).toBe(true)
      backgroundReceivedLengths = await page.evaluate(() => (window as any).__receivedLengths)
      expect(await page.evaluate(() => document.visibilityState)).toBe('hidden')
      await page.bringToFront()
      await background?.close()
      await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible')
    } else {
      await page.waitForFunction(() => (window as any).__outputActive === 0, undefined, { timeout: 20000, polling: 100 })
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
        document.dispatchEvent(new Event('visibilitychange'))
      })
    }
    await page.waitForFunction(() => (window as any).__outputActive === 0, undefined, { timeout: 20000, polling: 100 })
    await expect(page.getByTestId('output-stop')).toHaveCount(0)
    const result = await page.evaluate(async scenario => {
      const pinia = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia
      await pinia._s.get('sessionManager').saveAllSessions()
      return { results: pinia._s.get(scenario.store).testVariantResults, maxSourceNodes: (window as any).__maxSourceNodes, updates: (window as any).__stateUpdates }
    }, scenario)
    for (let index = 0; index < scenario.columns; index++) expect(result.results['abcd'[index]!].result === sources[index]).toBe(true)
    expect(result.maxSourceNodes).toBeLessThan(1000)
    expect(result.updates).toBeLessThan(40)
    expect(errors).toEqual([])
    if (nativeVisibility) {
      const heapLimit = await page.evaluate(() => (performance as any).memory.jsHeapSizeLimit as number)
      expect(heapLimit).toBeLessThan(256 * 1024 * 1024)
      await page.screenshot({ path: test.info().outputPath('output-native-background.png') })
      const events = await page.evaluate(() => (window as any).__outputVisibilityEvents)
      expect(events).toContain('hidden')
      expect(events).toContain('visible')
      await test.info().attach('native-visibility', { body: JSON.stringify({ events, backgroundReceivedLengths, heapLimit, oldSpaceLimitMiB: 128, simulated: false }), contentType: 'application/json' })
    }
    await test.info().attach('output-architecture-metrics', { body: JSON.stringify({ mode: scenario.mode, peak: checkpoint.peak, updates: result.updates, maxSourceNodes: result.maxSourceNodes, sourceLengths: sources.slice(0, scenario.columns).map(value => value.length) }), contentType: 'application/json' })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    if (scenario.mode === 'basic-user') {
      await cdp.send('HeapProfiler.collectGarbage')
      const baseline = await cdp.send('Runtime.getHeapUsage')
      const samples: number[] = []
      for (let round = 0; round < 4; round++) {
        const completed = await page.evaluate(() => (window as any).__outputFinished)
        await page.evaluate(() => { (window as any).__outputCalls = 0 })
        await page.getByTestId('basic-user-test-run-all').click({ force: nativeVisibility })
        await expect.poll(() => page.evaluate(() => (window as any).__outputFinished)).toBe(completed + scenario.columns)
        await expect(page.getByTestId('basic-user-test-run-all')).toBeEnabled()
        const repeated = await page.evaluate(() => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicUserSession').testVariantResults)
        for (let index = 0; index < scenario.columns; index++) {
          expect(repeated['abcd'[index]!].status).toBe('complete')
          expect(repeated['abcd'[index]!].result === sources[index]).toBe(true)
        }
        await cdp.send('HeapProfiler.collectGarbage')
        samples.push((await cdp.send('Runtime.getHeapUsage')).usedSize)
      }
      expect(Math.max(...samples) - baseline.usedSize).toBeLessThan(8 * 1024 * 1024)
      await test.info().attach('output-heap-stability', { body: JSON.stringify({ baseline: baseline.usedSize, samples, additionalFourColumnRuns: 4 }), contentType: 'application/json' })
    }
    if (nativeVisibility) {
      const htmlOutput = page.locator('.variant-result-card .output-display-core').first()
      await expect(htmlOutput.getByTestId('html-preview-frame')).toBeVisible()
      const previewElement = await htmlOutput.getByTestId('html-preview-frame').elementHandle()
      if (!previewElement) throw new Error('Missing HTML preview element')
      const other = await context.newPage()
      await other.goto('about:blank')
      await other.bringToFront()
      await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('hidden')
      await expect(page.getByTestId('html-preview-frame')).toHaveCount(1)
      await page.bringToFront()
      await other.close()
      expect(await previewElement.evaluate(element => element.isConnected)).toBe(true)
      await expect(htmlOutput.getByTestId('html-preview-paused')).toHaveCount(0)
      await expect(htmlOutput.getByTestId('html-preview-reload')).toHaveCount(0)
      await expect(htmlOutput.getByTestId('html-preview-frame')).toBeVisible()
      await page.screenshot({ path: test.info().outputPath('output-native-preview.png') })
    }
    await page.reload()
    await expect(page.getByTestId('workspace')).toBeVisible({ timeout: 25000 })
    const restored = await page.evaluate(store => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get(store).testVariantResults, scenario.store)
    for (let index = 0; index < scenario.columns; index++) expect(restored['abcd'[index]!].result === sources[index]).toBe(true)
  })
}
