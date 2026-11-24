import { chromium, test as base, expect, type Page, type BrowserContext, type Locator } from '@playwright/test'
import { resolve } from 'node:path'

// Load the built extension in its own headless profile. A web-hosted copy cannot
// reproduce extension CSP, manifest sandboxing or packaged-resource failures.
const test = base.extend<{ extensionContext: BrowserContext; extensionPage: Page }>({
  extensionContext: async ({}, use, info) => {
    const extension = resolve('packages/extension/dist')
    const context = await chromium.launchPersistentContext(info.outputPath('profile'), {
      channel: 'chromium', headless: true, timeout: 15000,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    })
    try { await use(context) } finally { await context.close() }
  },
  extensionPage: async ({ extensionContext: context }, use) => {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10000 })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    await page.goto(`chrome-extension://${new URL(worker.url()).host}/index.html#/basic/system`, { timeout: 15000 })
    await expect(page.getByTestId('workspace')).toBeVisible()
    await use(page)
  },
})

const counter = (id: string) => `<button id="${id}" onclick="this.textContent=Number(this.textContent)+1">0</button>`
const markdown = `# Before\n\n\`\`\`html\n${counter('one')}\n\`\`\`\n\nBetween.\n\n\`\`\`html\n${counter('two')}\n\`\`\`\n\nAfter.`
const output = (page: Page, index = 0) => page.locator('.variant-result-card .output-display-core').nth(index)

async function clickCounter(button: Locator, host: Locator) {
  // Bring the embedding frame into view before acting in its nested document.
  await host.evaluate(el => el.scrollIntoView({ block: 'start', inline: 'nearest' }))
  await expect(button).toBeInViewport()
  await button.focus()
  await expect(button).toBeFocused()
  await button.click()
}

async function seed(page: Page, a: string, b = '') {
  await page.evaluate(({ a, b }) => {
    const store = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicSystemSession')
    store.testVariantResults = { a: { result: a, reasoning: '' }, b: { result: b, reasoning: '' } }
  }, { a, b })
}

test('keeps extension previews independent across freeze and source view', async ({ extensionPage: page }) => {
  await seed(page, markdown, counter('other'))
  const firstOutput = output(page)
  const firstHost = firstOutput.locator('[data-html-preview-slot="0"] iframe')
  const secondHost = firstOutput.locator('[data-html-preview-slot="1"] iframe')
  const first = firstHost.contentFrame().frameLocator('iframe').locator('#one')
  const second = secondHost.contentFrame().frameLocator('iframe').locator('#two')
  const other = output(page, 1).frameLocator('[data-testid="html-preview-frame"]').frameLocator('iframe').locator('#other')
  await clickCounter(first, firstHost)
  await expect(first).toHaveText('1')
  await expect(second).toHaveText('0')
  const otherWindow = await other.evaluateHandle(() => window)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Page.setWebLifecycleState', { state: 'frozen' })
  await cdp.send('Page.setWebLifecycleState', { state: 'active' })
  await expect(first).toHaveText('1')
  await firstOutput.getByTestId(/-view-source$/).click()
  await expect(firstOutput.getByTestId('html-preview-frame')).toHaveCount(0)
  expect(await otherWindow.evaluate(() => document.querySelector('#other')?.textContent)).toBe('0')
})

test('runs scripts and external requests without granting extension privileges', async ({ extensionPage: page }) => {
  await page.route('https://preview.example.test/**', route => {
    const url = route.request().url()
    return route.fulfill({
      contentType: url.endsWith('.js') ? 'application/javascript' : 'application/json',
      headers: { 'access-control-allow-origin': url.endsWith('/denied') ? 'https://elsewhere.test' : '*' },
      body: url.endsWith('/classic.js') ? 'window.externalLoaded=true'
        : url.endsWith('/module.js') ? 'export const answer=42' : '{"ok":true}',
    })
  })
  const html = `<!doctype html><html><head>
<script src="https://preview.example.test/classic.js"></script>
<script type="importmap">{"imports":{"demo":"https://preview.example.test/module.js"}}</script></head><body>
<h1>HTML preview</h1><pre id="result"></pre>
<script type="module">
import {answer} from 'demo';
const denied=(fn)=>{try{fn();return false}catch{return true}};
const result={external:window.externalLoaded,answer,
  parentBlocked:denied(()=>parent.document.body),topBlocked:denied(()=>top.document.body),
  storageBlocked:denied(()=>localStorage.length),cookiesBlocked:denied(()=>document.cookie),
  extensionAPI:typeof window.chrome?.runtime?.sendMessage,
  navigationBlocked:denied(()=>{top.location.href='https://unexpected-navigation.test/';})};
result.fetch=(await (await fetch('https://preview.example.test/allowed')).json()).ok;
result.corsBlocked=await fetch('https://preview.example.test/denied').then(()=>false,()=>true);
document.querySelector('#result').textContent=JSON.stringify(result);
parent.postMessage({type:'prompt-optimizer:render-html',html:'<h1>FORGED</h1>'},'*');
</script></body></html>`
  await seed(page, html)
  const frame = output(page).frameLocator('[data-testid="html-preview-frame"]').frameLocator('iframe')
  await expect(frame.locator('#result')).not.toBeEmpty()
  expect(JSON.parse(await frame.locator('#result').innerText())).toEqual({
    external: true, answer: 42, parentBlocked: true, topBlocked: true,
    storageBlocked: true, cookiesBlocked: true, extensionAPI: 'undefined',
    navigationBlocked: true, fetch: true, corsBlocked: true,
  })
  await expect(frame.locator('h1')).toHaveText('HTML preview')
  expect(page.url()).toContain('index.html#/basic/system')
})

test('opens an interactive fullscreen preview in the same tab', async ({ extensionPage: page }) => {
  await seed(page, counter('fullscreen-counter'))
  const pages = page.context().pages().length
  await output(page).getByRole('button', { name: /^(Expand|展开|展開)$/ }).click()
  const fullscreen = page.getByTestId('output-fullscreen')
  const host = fullscreen.getByTestId('html-preview-frame')
  const button = host.contentFrame().frameLocator('iframe').locator('#fullscreen-counter')
  await clickCounter(button, host)
  await expect(button).toHaveText('1')
  expect(page.context().pages()).toHaveLength(pages)
  await page.getByRole('dialog').getByRole('button', { name: 'close', exact: true }).click()
  await expect(fullscreen).toHaveCount(0)
})

test('renders both concurrent long HTML outputs only after streaming completes', async ({ extensionPage: page }) => {
  await page.goto(page.url().replace('/basic/system', '/basic/user'))
  await expect(page.getByTestId('workspace')).toBeVisible()
  const source = `# Result\n\n\`\`\`html\n<svg viewBox="0 0 100 100">${'<path d="M1 2 L3 4"/>'.repeat(2000)}</svg>\n\`\`\`\n\nDone.`
  const stream = await page.evaluateHandle(async source => {
    // Production Vue omits the DOM debug pointer used by the dev-server tests.
    // Reach the actual provider through the entry shell's rendered component.
    const app = (document.querySelector('#app') as any).__vue_app__
    const session = app.config.globalProperties.$pinia._s.get('basicUserSession')
    const services = app._container._vnode.component.subTree.component.provides.services.value
    const model = (await services.modelManager.getAllModels())[0]
    await services.modelManager.updateModel(model.id, { enabled: true, connectionConfig: { ...model.connectionConfig, apiKey: 'fixture-no-network' } })
    session.prompt = 'Draw a page'
    session.optimizedPrompt = 'Draw a complete page'
    session.testVariants = session.testVariants.map((v: any) => ({ ...v, modelKey: model.id }))
    let complete!: () => void
    const completion = new Promise<void>(resolve => { complete = resolve })
    const stream = { started: 0, complete }
    services.promptService.testPromptStream = async (_a: string, _b: string, _c: string, callbacks: any) => {
      callbacks.onToken(source)
      stream.started++
      await completion
      callbacks.onComplete()
    }
    return stream
  }, source)
  await page.getByTestId('basic-user-test-run-all').click()
  await expect.poll(() => stream.evaluate(state => state.started)).toBe(2)
  const outputs = [
    page.getByTestId('basic-user-test-original-output'),
    page.getByTestId('basic-user-test-optimized-output'),
  ]
  for (const output of outputs) {
    await expect(output.getByTestId('output-source-view')).toBeVisible()
    await expect(output.getByTestId('html-preview-frame')).toHaveCount(0)
  }
  await stream.evaluate(state => state.complete())
  for (const output of outputs) {
    const preview = output.getByTestId('html-preview-frame').contentFrame().frameLocator('iframe')
    await expect(preview.locator('svg path')).toHaveCount(2000)
  }
})
