import { chromium, test as base, expect, type Page, type BrowserContext } from '@playwright/test'
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

async function seed(page: Page, a: string, b = '') {
  await page.evaluate(({ a, b }) => {
    const store = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicSystemSession')
    store.testVariantResults = { a: { result: a, reasoning: '' }, b: { result: b, reasoning: '' } }
  }, { a, b })
}

test('renders Markdown and independent HTML blocks, keeps state across tab lifecycle, releases only the selected column', async ({ extensionPage: page }) => {
  await seed(page, markdown, counter('other'))
  await expect(page.getByTestId('html-preview-frame')).toHaveCount(3)
  await expect(output(page).locator('.markdown-content > h1')).toHaveText('Before')
  await expect(output(page).locator('.markdown-content > p')).toHaveText(['Between.', 'After.'])
  const first = output(page).frameLocator('[data-html-preview-slot="0"] iframe').frameLocator('iframe').locator('#one')
  const second = output(page).frameLocator('[data-html-preview-slot="1"] iframe').frameLocator('iframe').locator('#two')
  const other = output(page, 1).frameLocator('[data-testid="html-preview-frame"]').frameLocator('iframe').locator('#other')
  await first.click()
  await second.click()
  await second.click()
  await other.click()
  await expect(first).toHaveText('1')
  await expect(second).toHaveText('2')
  const firstWindow = await first.evaluateHandle(() => window)
  const otherWindow = await other.evaluateHandle(() => window)
  const cdp = await page.context().newCDPSession(page)
  // Freeze/resume really suspends this page. Visibility events additionally
  // exercise application hooks; neither is claimed as native-tab throttling.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await cdp.send('Page.setWebLifecycleState', { state: 'frozen' })
  await cdp.send('Page.setWebLifecycleState', { state: 'active' })
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(await firstWindow.evaluate(() => document.querySelector('#one')?.textContent)).toBe('1')
  await second.click()
  await expect(second).toHaveText('3')
  await output(page).locator('[data-testid$="-view-source"], [data-testid="output-view-source"]').click()
  await expect(output(page).getByTestId('html-preview-frame')).toHaveCount(0)
  // Exercise the real copy action without replacing the user's OS clipboard.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (text: string) => { (window as any).__copied = text },
    } })
  })
  await output(page).locator('.output-copy-split-primary').click()
  expect(await page.evaluate(() => (window as any).__copied)).toBe(markdown)
  await expect(firstWindow.evaluate(() => document.body)).rejects.toThrow()
  expect(await otherWindow.evaluate(() => document.querySelector('#other')?.textContent)).toBe('1')
  await other.click()
  await expect(other).toHaveText('2')
  await output(page).getByTestId('output-view-preview').click()
  await expect(first).toHaveText('0')
  await first.click()
  await expect(first).toHaveText('1')
})

test('preserves CSS, inline and external scripts, modules, canvas and external requests without extension privileges', async ({ extensionPage: page }) => {
  await page.route('https://preview.example.test/**', route => {
    const url = route.request().url()
    return route.fulfill({
      contentType: url.endsWith('.js') ? 'application/javascript' : 'application/json',
      headers: { 'access-control-allow-origin': url.endsWith('/denied') ? 'https://elsewhere.test' : '*' },
      body: url.endsWith('/classic.js') ? 'window.externalLoaded=true'
        : url.endsWith('/module.js') ? 'export const answer=42' : '{"ok":true}',
    })
  })
  const html = `<!doctype html><html><head><style>body{color:rgb(12,34,56)}</style>
<script src="https://preview.example.test/classic.js"></script>
<script type="importmap">{"imports":{"demo":"https://preview.example.test/module.js"}}</script></head><body>
<h1>HTML preview</h1>${counter('counter')}<canvas width="20" height="20"></canvas><pre id="result"></pre>
<script type="module">
import {answer} from 'demo';
const ctx=document.querySelector('canvas').getContext('2d');ctx.fillStyle='rgb(0,128,255)';ctx.fillRect(0,0,20,20);
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
  await expect(frame.locator('body')).toHaveCSS('color', 'rgb(12, 34, 56)')
  expect(await frame.locator('canvas').evaluate((el: HTMLCanvasElement) => [...el.getContext('2d')!.getImageData(0,0,1,1).data])).toEqual([0,128,255,255])
  await frame.locator('#counter').click()
  await expect(frame.locator('#counter')).toHaveText('1')
  await expect(frame.locator('h1')).toHaveText('HTML preview')
  expect(page.url()).toContain('index.html#/basic/system')
})

test('replaces changed content and supports fullscreen without extra tabs', async ({ extensionPage: page }) => {
  await seed(page, markdown)
  const old = await output(page).frameLocator('[data-html-preview-slot="0"] iframe').frameLocator('iframe').locator('#one').evaluateHandle(() => window)
  await seed(page, markdown.replace('id="one"', 'id="replacement"'))
  const replacement = output(page).frameLocator('[data-html-preview-slot="0"] iframe').frameLocator('iframe').locator('#replacement')
  await expect(replacement).toBeVisible()
  await expect(old.evaluate(() => document.body)).rejects.toThrow()
  const pages = page.context().pages().length
  await output(page).getByRole('button', { name: /^(Expand|展开|展開)$/ }).click()
  const fullscreen = page.getByTestId('output-fullscreen')
  const counter = fullscreen.frameLocator('[data-html-preview-slot="0"] iframe').frameLocator('iframe').locator('#replacement')
  await counter.click()
  await expect(counter).toHaveText('1')
  expect(page.context().pages()).toHaveLength(pages)
  await page.getByRole('dialog').getByRole('button', { name: 'close', exact: true }).click()
  await seed(page, '# Plain Markdown')
  await expect(page.getByTestId('html-preview-frame')).toHaveCount(0)
  await expect(output(page).locator('h1')).toHaveText('Plain Markdown')
})

test('keeps two genuinely concurrent producers bounded under CPU throttling and renders only completed outputs', async ({ extensionPage: page }) => {
  await page.goto(page.url().replace('/basic/system', '/basic/user'))
  await expect(page.getByTestId('workspace')).toBeVisible()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const source = `# Result\n\n\`\`\`html\n<svg viewBox="0 0 100 100">${'<path d="M1 2 L3 4"/>'.repeat(2000)}</svg>${counter('large')}\n\`\`\`\n\nDone.`
  await page.evaluate(async source => {
    const session = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicUserSession')
    // Production Vue omits the DOM debug pointer used by the dev-server tests.
    // Reach the actual provider through the entry shell's rendered component.
    const app = (document.querySelector('#app') as any).__vue_app__
    const services = app._container._vnode.component.subTree.component.provides.services.value
    const model = (await services.modelManager.getAllModels())[0]
    await services.modelManager.updateModel(model.id, { enabled: true, connectionConfig: { ...model.connectionConfig, apiKey: 'fixture-no-network' } })
    session.prompt = 'Draw a page'
    session.optimizedPrompt = 'Draw a complete page'
    session.testVariants = session.testVariants.map((v: any) => ({ ...v, modelKey: model.id }))
    const state = window as any
    state.__entered = 0
    state.__emitted = 0
    state.__finished = 0
    state.__previewDuringStreaming = false
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    let finished = 0
    let finish!: () => void
    const completion = new Promise<void>(resolve => { finish = resolve })
    services.promptService.testPromptStream = async (_a: string, _b: string, _c: string, callbacks: any) => {
      if (++state.__entered === 2) release()
      await barrier
      for (let offset = 0; offset < source.length; offset += 256) {
        if (document.querySelector('[data-testid="html-preview-frame"]')) state.__previewDuringStreaming = true
        callbacks.onToken(source.slice(offset, offset + 256))
        state.__emitted++
        await new Promise(resolve => setTimeout(resolve, 4))
      }
      if (++finished === 2) finish()
      state.__finished = finished
      await completion
      await callbacks.onComplete()
    }
  }, source)
  await page.getByTestId('basic-user-test-run-all').click()
  await expect(page.getByTestId('basic-user-test-original-output').getByTestId('output-source-view')).toBeVisible()
  try {
    await expect(page.getByTestId('html-preview-frame')).toHaveCount(2, { timeout: 25000 })
  } finally {
    const metrics = await page.evaluate(() => {
      const state = window as any
      const store = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicUserSession')
      return { entered: state.__entered, finished: state.__finished, chunks: state.__emitted,
        aCharacters: store.testVariantResults.a?.result.length, bCharacters: store.testVariantResults.b?.result.length,
        outputs: [...document.querySelectorAll('.output-display-core')].map(el => (el.textContent || '').slice(-300)) }
    })
    await test.info().attach('stream-progress', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' })
  }
  expect(await page.evaluate(() => {
    const state = window as any
    const store = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicUserSession')
    return { entered: state.__entered, premature: state.__previewDuringStreaming, a: store.testVariantResults.a.result, b: store.testVariantResults.b.result }
  })).toEqual({ entered: 2, premature: false, a: source, b: source })
  for (const index of [0, 1]) {
    expect(await output(page, index).locator('.markdown-content *').count()).toBeLessThan(20)
    const preview = page.frameLocator('[data-testid="html-preview-frame"]').nth(index).frameLocator('iframe')
    await expect(preview.locator('svg path')).toHaveCount(2000)
    await preview.locator('#large').click()
    await expect(preview.locator('#large')).toHaveText('1')
  }
})
