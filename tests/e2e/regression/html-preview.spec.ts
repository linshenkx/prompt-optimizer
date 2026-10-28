import { test, expect, type Page } from '@playwright/test'

test.use({ actionTimeout: 10000 })
test.describe.configure({ timeout: 60000 })

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>body{background:rgb(230,240,255);font-family:sans-serif;padding:20px}button{padding:12px}canvas{display:block;margin:16px 0}</style>
<script src="https://preview-assets.example.test/demo.js"></script></head><body>
<h1>Interactive HTML</h1><button id="counter" onclick="this.textContent=Number(this.textContent)+1">0</button>
<canvas width="80" height="40"></canvas><pre id="isolation"></pre><p id="gpu"></p>
<script>
const ctx=document.querySelector('canvas').getContext('2d');ctx.fillStyle='rgb(0,128,255)';ctx.fillRect(0,0,80,40);
const result={};
for(const [key,read] of Object.entries({parentDOM:()=>parent.parent.document.body,storage:()=>localStorage.length,cookies:()=>document.cookie})){
try{read();result[key]=false}catch{result[key]=true}}
result.desktopBridge=typeof window.electronAPI==='undefined';
try{parent.parent.location.href='https://preview-navigation.example.test/';result.topNavigation=false}catch{result.topNavigation=true}
Promise.all([
fetch('https://preview-data.example.test/private').then(()=>{result.fetchBlocked=false},()=>{result.fetchBlocked=true}),
fetch('https://preview-data.example.test/no-cors').then(()=>{result.corsBlocked=false},()=>{result.corsBlocked=true})
]).then(()=>{document.querySelector('#isolation').textContent=JSON.stringify(result)});
let ticks=0;function tick(){document.body.dataset.ticks=String(++ticks);requestAnimationFrame(tick)}tick();
(async()=>{let state='unavailable';try{if(navigator.gpu){state=await navigator.gpu.requestAdapter()?'adapter available':'no adapter'}}catch(e){state=e.message}document.querySelector('#gpu').textContent=state})();
</script></body></html>`

async function seedOutput(page: Page, content: string) {
  // Supply a completed model result through the actual session store, without
  // invoking a model or replacing the real output/preview components.
  await page.evaluate(content => {
    const app = (document.querySelector('#app') as any).__vue_app__
    const store = app.config.globalProperties.$pinia._s.get('basicSystemSession')
    store.testVariantResults = { ...store.testVariantResults, a: { result: content, reasoning: '' } }
  }, content)
}

test('keeps code-block contents literal without exponentially multiplying the document', async ({ page }) => {
  const code = 'currency: $`'
  await seedOutput(page, 'Explanation\n\n' + (`\`\`\`text\n${code}\n\`\`\`\n\n`).repeat(16))
  const output = page.locator('.variant-result-card .output-display-core').first()
  await expect(output.locator('pre code')).toHaveCount(16)
  expect((await output.locator('pre code').allTextContents()).map(text => text.trim())).toEqual(Array(16).fill(code))
  expect(await output.locator('.markdown-content *').count()).toBeLessThan(100)
})

test.beforeEach(async ({ page, context }) => {
  await context.addInitScript(name => {
    (window as Window & { __TEST_DB_NAME__?: string }).__TEST_DB_NAME__ = name
  }, `html-preview-${Date.now()}`)
  await page.route('https://preview-assets.example.test/demo.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.addEventListener("DOMContentLoaded",()=>document.body.dataset.externalScript="loaded")',
  }))
  await page.route('https://preview-data.example.test/**', route => route.fulfill({
    contentType: 'application/json', body: '{"ok":true}',
    // Playwright supplies permissive CORS headers when the header is absent.
    headers: { 'access-control-allow-origin': route.request().url().endsWith('/private') ? '*' : 'https://other-origin.example.test' },
  }))
  await page.goto('/#/basic/system')
  await expect(page.getByTestId('workspace')).toBeVisible({ timeout: 25000 })
})

test('keeps independent interactive previews and their state across visibility changes', async ({ page }) => {
  const counter = '<button id="counter" onclick="this.textContent=Number(this.textContent)+1">0</button>'
  await seedOutput(page, counter)
  await page.evaluate(content => {
    const store = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicSystemSession')
    store.testVariantResults = { ...store.testVariantResults, b: { result: content, reasoning: '' } }
  }, counter)
  const outputs = page.locator('.variant-result-card .output-display-core')
  const first = outputs.nth(0).frameLocator('[data-testid="html-preview-frame"]').frameLocator('iframe').locator('#counter')
  await first.click()
  await expect(first).toHaveText('1')
  const second = outputs.nth(1).frameLocator('[data-testid="html-preview-frame"]').frameLocator('iframe').locator('#counter')
  await second.click()
  await second.click()
  await expect(second).toHaveText('2')
  await expect(first).toHaveText('1')
  await expect(page.getByTestId('html-preview-frame')).toHaveCount(2)
  const firstContext = await first.evaluateHandle(() => window)
  const secondContext = await second.evaluateHandle(() => window)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByTestId('html-preview-frame')).toHaveCount(2)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByTestId('html-preview-frame')).toHaveCount(2)
  expect(await firstContext.evaluate(() => document.querySelector('#counter')?.textContent)).toBe('1')
  expect(await secondContext.evaluate(() => document.querySelector('#counter')?.textContent)).toBe('2')
  await first.click()
  await expect(first).toHaveText('2')
  await expect(second).toHaveText('2')
  await expect(page.getByTestId('html-preview-reload')).toHaveCount(0)
  await expect(page.getByTestId('html-preview-paused')).toHaveCount(0)
})

test('keeps several HTML blocks in one Markdown document with independent interaction and exact source copying', async ({ page }) => {
  const block = (id: string) => `<html><body><button id="${id}" onclick="this.textContent=Number(this.textContent)+1">0</button></body></html>`
  const source = `# Before\n\n\`\`\`html\n${block('one')}\n\`\`\`\n\nBetween **both** pages.\n\n~~~html\n${block('two')}\n~~~\n\nAfter.`
  await seedOutput(page, source)
  const output = page.locator('.variant-result-card .output-display-core').first()
  await expect(output.getByTestId('html-preview-frame')).toHaveCount(2)
  await expect(output.locator('.markdown-content > h1')).toHaveText('Before')
  await expect(output.locator('.markdown-content > p')).toHaveText(['Between both pages.', 'After.'])
  const first = output.frameLocator('[data-html-preview-slot="0"] [data-testid="html-preview-frame"]').frameLocator('iframe').locator('#one')
  const second = output.frameLocator('[data-html-preview-slot="1"] [data-testid="html-preview-frame"]').frameLocator('iframe').locator('#two')
  await first.click()
  await second.click()
  await second.click()
  await expect(first).toHaveText('1')
  await expect(second).toHaveText('2')
  await output.locator('[data-testid$="-view-source"], [data-testid="output-view-source"]').click()
  await expect(output.getByTestId('html-preview-frame')).toHaveCount(0)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await output.locator('.output-copy-split-primary').click()
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe(source)
  await output.getByTestId('output-view-preview').click()
  await expect(output.getByTestId('html-preview-frame')).toHaveCount(2)
})

test('runs HTML, CSS, scripts, canvas and external data with parent/storage isolation and normal CORS', async ({ page }) => {
  let dataRequests = 0
  page.on('request', request => {
    if (request.url().includes('preview-data.example.test')) dataRequests++
  })
  await seedOutput(page, `Here is the page:\n\n\`\`\`html\n${html}\n\`\`\``)
  const output = page.locator('.variant-result-card .output-display-core').first()
  await expect(output.getByTestId('output-view-preview')).toHaveText(/^(Preview|预览|預覽)$/)
  await expect(output.getByTestId('output-view-html')).toHaveCount(0)
  await expect(page.getByTestId('html-preview-frame')).toHaveCount(1)
  await expect(output.locator('.markdown-content > p').first()).toHaveText('Here is the page:')
  const preview = output.frameLocator('[data-testid="html-preview-frame"]').frameLocator('iframe')
  await expect(preview.locator('h1')).toHaveText('Interactive HTML')
  await expect(preview.locator('body')).toHaveAttribute('data-external-script', 'loaded')
  await expect(preview.locator('body')).toHaveCSS('background-color', 'rgb(230, 240, 255)')
  await preview.locator('#counter').click()
  await expect(preview.locator('#counter')).toHaveText('1')
  await expect(preview.locator('#isolation')).not.toBeEmpty()
  expect(JSON.parse(await preview.locator('#isolation').innerText())).toEqual({
    parentDOM: true, storage: true, cookies: true, desktopBridge: true, topNavigation: true, fetchBlocked: false, corsBlocked: true,
  })
  expect(dataRequests).toBe(2)
  expect(page.url()).toContain('/#/basic/system')
  expect(await preview.locator('canvas').evaluate((canvas: HTMLCanvasElement) =>
    [...canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data],
  )).toEqual([0, 128, 255, 255])
  await expect.poll(async () => Number(await preview.locator('body').getAttribute('data-ticks'))).toBeGreaterThan(1)
  await expect(preview.locator('#gpu')).not.toBeEmpty()
  test.info().annotations.push({ type: 'WebGPU', description: await preview.locator('#gpu').innerText() })

  const childFrame = await preview.locator('body').evaluateHandle(() => window)
  await output.locator('[data-testid$="-view-source"], [data-testid="output-view-source"]').click()
  await expect(output.getByTestId('html-preview-frame')).toHaveCount(0)
  await expect(output.getByTestId('output-source-view')).toBeVisible()
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await output.locator('.output-copy-split-primary').click()
  // The Windows native clipboard normalizes line endings to CRLF.
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe(`Here is the page:\n\n\`\`\`html\n${html}\n\`\`\``)
  // Removing the browsing context also destroys the script execution context.
  await expect(childFrame.evaluate(() => document.body)).rejects.toThrow()
})

test('moves the preview into fullscreen and destroys it when output changes', async ({ page }) => {
  await seedOutput(page, html)
  const output = page.locator('.variant-result-card .output-display-core').first()
  await output.getByRole('button', { name: /^(Expand|展开|展開)$/ }).click()
  const fullscreen = page.getByTestId('output-fullscreen')
  await expect(fullscreen.getByTestId('html-preview-frame')).toBeVisible()
  await expect(output.getByTestId('html-preview-frame')).toHaveCount(0)
  const preview = fullscreen.frameLocator('[data-testid="html-preview-frame"]').frameLocator('iframe')
  await preview.locator('#counter').click()
  await expect(preview.locator('#counter')).toHaveText('1')
  await page.screenshot({ path: test.info().outputPath('html-preview-fullscreen.png') })
  // Keyboard events in the isolated document do not bubble to the modal.
  await page.getByRole('dialog').getByRole('button', { name: 'close', exact: true }).click()
  await expect(fullscreen).toHaveCount(0)
  await expect(output.getByTestId('html-preview-frame')).toBeVisible()
  await seedOutput(page, '# Ordinary Markdown\n\n**Still works**')
  await expect(page.getByTestId('html-preview-frame')).toHaveCount(0)
  await expect(output.locator('h1')).toHaveText('Ordinary Markdown')
})

test('uses the same preview entry in the mobile view menu', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await seedOutput(page, html)
  await page.getByTestId('workspace-region-test').click()
  const output = page.locator('.variant-result-card .output-display-core').first()
  await output.getByTestId('output-view-menu').click()
  await page.locator('.n-dropdown-option').filter({ hasText: /^(Preview|预览|預覽)$/ }).click()
  const preview = output.frameLocator('[data-testid="html-preview-frame"]').frameLocator('iframe')
  await expect(preview.locator('h1')).toBeVisible()
  await preview.locator('#counter').click()
  await expect(preview.locator('#counter')).toHaveText('1')
  const box = await output.getByTestId('html-preview-frame').boundingBox()
  expect(box?.width).toBeLessThanOrEqual(360)
  expect(box?.height).toBeGreaterThan(250)
  const outputBox = (await output.boundingBox())!
  const expandBox = (await output.getByRole('button', { name: /^(Expand|展开|展開)$/ }).boundingBox())!
  expect(expandBox.x + expandBox.width).toBeLessThanOrEqual(outputBox.x + outputBox.width + 1)
  await expect(output.locator('.html-preview-toolbar')).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('html-preview-mobile.png'), fullPage: true })
})

test('batches long fenced HTML while generating, keeps every token, and previews SVG afterward', async ({ page }) => {
  await page.goto('/#/basic/user')
  await expect(page.getByTestId('workspace')).toBeVisible()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const source = 'Here is the page:\n```html\n<!doctype html><html><body><h1>SVG flight</h1><svg id="flight" viewBox="0 0 100 100">'
    + '<path d="M1 2 L30 40 Q50 60 70 80 Z" fill="#df783c"/>\n'.repeat(400)
    + '</svg><button id="counter" onclick="this.textContent=Number(this.textContent)+1">0</button></body></html>\n```'
  const chunks = Math.ceil(source.length / 128)
  await page.evaluate(async ({ source }) => {
    const app = (document.querySelector('#app') as any).__vue_app__
    const session = app.config.globalProperties.$pinia._s.get('basicUserSession')
    const services = (document.querySelector('[data-testid="workspace"]') as any).__vueParentComponent.provides.services.value
    const model = (await services.modelManager.getAllModels())[0]
    await services.modelManager.updateModel(model.id, { enabled: true, connectionConfig: { ...model.connectionConfig, apiKey: 'fixture-no-network' } })
    session.prompt = 'Draw an SVG page'
    session.optimizedPrompt = 'Draw a complete SVG page'
    session.testVariants = session.testVariants.map((variant: any) => ({ ...variant, modelKey: model.id }))
    const state = window as any
    state.__streamUpdates = 0
    state.__activeStreams = 0
    state.__peakStreams = 0
    state.__outputMetrics = { textareaWrites: 0, rewrittenCharacters: 0, emittedChunks: 0, maxLongTaskMs: 0 }
    const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
    Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
      ...valueDescriptor,
      set(value) {
        if (this.classList.contains('output-source-input')) {
          state.__outputMetrics.textareaWrites++
          state.__outputMetrics.rewrittenCharacters += String(value).length
        }
        valueDescriptor.set!.call(this, value)
      },
    })
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) state.__outputMetrics.maxLongTaskMs = Math.max(state.__outputMetrics.maxLongTaskMs, entry.duration)
    }).observe({ entryTypes: ['longtask'] })
    session.$subscribe(() => { state.__streamUpdates++ })
    services.promptService.testPromptStream = async (_system: string, _prompt: string, _model: string, callbacks: any) => {
      state.__activeStreams++
      state.__peakStreams = Math.max(state.__peakStreams, state.__activeStreams)
      for (let offset = 0; offset < source.length; offset += 128) {
        callbacks.onToken(source.slice(offset, offset + 128))
        state.__outputMetrics.emittedChunks++
        await new Promise(resolve => setTimeout(resolve, 4))
      }
      callbacks.onComplete()
      state.__activeStreams--
    }
  }, { source })
  await page.getByTestId('basic-user-test-run-all').click()
  const output = page.getByTestId('basic-user-test-original-output')
  await expect(output.getByTestId('output-source-view')).toBeVisible()
  expect(await output.locator('.n-input__textarea-mirror').count()).toBe(0)
  await expect(page.getByTestId('html-preview-frame')).toHaveCount(0)
  try {
    await expect(page.getByTestId('html-preview-frame')).toHaveCount(2, { timeout: 20000 })
  } finally {
    const metrics = await page.evaluate(() => {
      const state = window as any
      const session = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicUserSession')
      return { ...state.__outputMetrics, peakStreams: state.__peakStreams, aCharacters: session.testVariantResults.a.result.length, bCharacters: session.testVariantResults.b.result.length }
    })
    await test.info().attach('output-resource-metrics', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' })
  }
  const result = await page.evaluate(() => {
    const session = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$pinia._s.get('basicUserSession')
    return { a: session.testVariantResults.a.result, b: session.testVariantResults.b.result, updates: (window as any).__streamUpdates, peakStreams: (window as any).__peakStreams }
  })
  expect(result.a).toBe(source)
  expect(result.b).toBe(source)
  expect(result.peakStreams).toBe(2)
  expect(result.updates).toBeLessThan(chunks)
  const preview = output.frameLocator('[data-testid="html-preview-frame"]').frameLocator('iframe')
  await expect(preview.locator('#flight path')).toHaveCount(400)
  await preview.locator('#counter').click()
  await expect(preview.locator('#counter')).toHaveText('1')
})
