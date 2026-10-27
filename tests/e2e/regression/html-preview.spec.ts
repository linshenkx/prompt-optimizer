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
fetch('https://preview-data.example.test/private').then(()=>{result.fetchBlocked=false},()=>{result.fetchBlocked=true}).finally(()=>{document.querySelector('#isolation').textContent=JSON.stringify(result)});
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

test.beforeEach(async ({ page, context }) => {
  await context.addInitScript(name => {
    (window as Window & { __TEST_DB_NAME__?: string }).__TEST_DB_NAME__ = name
  }, `html-preview-${Date.now()}`)
  await page.route('https://preview-assets.example.test/demo.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.addEventListener("DOMContentLoaded",()=>document.body.dataset.externalScript="loaded")',
  }))
  await page.goto('/#/basic/system')
  await expect(page.getByTestId('workspace')).toBeVisible({ timeout: 25000 })
})

test('runs HTML, CSS, scripts, canvas and animation with parent/storage/network isolation', async ({ page }) => {
  let dataRequests = 0
  page.on('request', request => {
    if (request.url().includes('preview-data.example.test')) dataRequests++
  })
  await seedOutput(page, `Here is the page:\n\n\`\`\`html\n${html}\n\`\`\``)
  const output = page.locator('.variant-result-card .output-display-core').first()
  await expect(output.getByTestId('output-view-html')).toBeVisible()
  await expect(page.getByTestId('html-preview-frame')).toHaveCount(0)
  await output.getByTestId('output-view-html').click()
  const preview = output.frameLocator('[data-testid="html-preview-frame"]').frameLocator('iframe')
  await expect(preview.locator('h1')).toHaveText('Interactive HTML')
  await expect(preview.locator('body')).toHaveAttribute('data-external-script', 'loaded')
  await expect(preview.locator('body')).toHaveCSS('background-color', 'rgb(230, 240, 255)')
  await preview.locator('#counter').click()
  await expect(preview.locator('#counter')).toHaveText('1')
  await expect(preview.locator('#isolation')).toHaveText(JSON.stringify({
    parentDOM: true, storage: true, cookies: true, desktopBridge: true, topNavigation: true, fetchBlocked: true,
  }))
  expect(dataRequests).toBe(0)
  expect(page.url()).toContain('/#/basic/system')
  expect(await preview.locator('canvas').evaluate((canvas: HTMLCanvasElement) =>
    [...canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data],
  )).toEqual([0, 128, 255, 255])
  await expect.poll(async () => Number(await preview.locator('body').getAttribute('data-ticks'))).toBeGreaterThan(1)
  await expect(preview.locator('#gpu')).not.toBeEmpty()
  test.info().annotations.push({ type: 'WebGPU', description: await preview.locator('#gpu').innerText() })

  await output.getByTestId('html-preview-reload').click()
  await expect(preview.locator('#counter')).toHaveText('0')
  const childFrame = await preview.locator('body').evaluateHandle(() => window)
  await output.locator('[data-testid$="-view-source"], [data-testid="output-view-source"]').click()
  await expect(output.getByTestId('html-preview-frame')).toHaveCount(0)
  await expect(output.locator('textarea')).toHaveValue(`Here is the page:\n\n\`\`\`html\n${html}\n\`\`\``)
  // Removing the browsing context also destroys the script execution context.
  await expect(childFrame.evaluate(() => document.body)).rejects.toThrow()
})

test('moves the preview into fullscreen and destroys it when output changes', async ({ page }) => {
  await seedOutput(page, html)
  const output = page.locator('.variant-result-card .output-display-core').first()
  await output.getByTestId('output-view-html').click()
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

test('offers the HTML preview in the mobile view menu', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await seedOutput(page, html)
  await page.getByTestId('workspace-region-test').click()
  const output = page.locator('.variant-result-card .output-display-core').first()
  await output.getByTestId('output-view-menu').click()
  await page.locator('.n-dropdown-option').filter({ hasText: /^(HTML preview|网页预览|網頁預覽)$/ }).click()
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
  expect((await output.locator('.html-preview-toolbar').boundingBox())!.height).toBeLessThan(130)
  await page.screenshot({ path: test.info().outputPath('html-preview-mobile.png'), fullPage: true })
})
