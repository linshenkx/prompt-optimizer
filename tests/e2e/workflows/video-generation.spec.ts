import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'

// Like the other workspaces, a completed optimization opens the preview. Editing uses Source.
const showGeneratedSource = async (page: Page, version = 1) => {
  await expect(page.getByTestId(`prompt-panel-version-tag-v${version}`)).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('video-output').getByRole('button', { name: /^(原文|Source)$/i }).click()
}

// Individual tests override these routes with fixtures. No test in this workflow may submit to a live provider.
test.beforeEach(async ({ context }) => {
  await context.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.runtime_config = {};' }))
  await context.route(/\/(?:contents\/generations\/tasks|video_generation|files\/(?:list|retrieve)|chat\/completions|responses)(?:[/?]|$)/, route => route.abort())
})

test('author, edit and test a video prompt, then resume the paid task after a reload', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript',
    body: 'window.runtime_config = {CUSTOM_API_KEY:"mock-key", CUSTOM_API_BASE_URL:"https://video-test.invalid/v1", CUSTOM_API_MODEL:"video-writer", SEEDANCE_API_KEY:"mock-ark-key"};' }))
  const multiShot = 'A red sailboat at dawn. The sailboat crosses the bay.'
  const natural = 'At dawn, a red sailboat glides across the bay.'
  const prompts: { role: string; content: string }[][] = []
  await page.route('**/chat/completions*', route => {
    const messages = route.request().postDataJSON().messages
    prompts.push(messages)
    const reply = /Shot-by-Shot Lines|逐镜结构/.test(messages[0].content) ? multiShot : natural
    return route.fulfill({ json: { id: 'chat-1', object: 'chat.completion', choices: [
      { index: 0, finish_reason: 'stop', message: { role: 'assistant', content: reply } },
    ] } })
  })
  const posts: {content: {text?:string}[]; duration:number; generate_audio:boolean}[] = []
  let complete = false
  await page.route('https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks**', async route => {
    if (route.request().method() === 'POST') {
      posts.push(route.request().postDataJSON())
      await route.fulfill({json:{id:'cgt-e2e'}})
    } else await route.fulfill({json:{id:'cgt-e2e', status:complete?'succeeded':'running',updated_at:Math.floor(Date.now()/1000),
      content:complete?{video_url:'https://video-test.invalid/clip.mp4'}:{}}})
  })
  const mp4 = await readFile('tests/e2e/fixtures/video-preview.mp4')
  await page.context().route('https://video-test.invalid/clip.mp4', route => route.fulfill({
    status: 200, contentType: 'video/mp4', body: mp4,
    headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
  }))
  await page.goto('/')
  await page.getByTestId('function-mode-video').click()
  await expect(page).toHaveURL(/#\/video\/create$/)
  const brief = page.getByTestId('video-input').locator('textarea')
  const editor = page.getByTestId('video-output').locator('textarea')
  const template = page.getByTestId('video-template-select')
  const chooseTemplate = async (name: RegExp) => {
    await template.click()
    await page.locator('.n-base-select-option .swc-primary').filter({ hasText: name }).click()
  }
  const creativeBrief = 'A 6-second (1:1) shot of a red sailboat crossing a bay at dawn.'
  await brief.fill(creativeBrief)
  await expect(template).toContainText(/Cinematic single shot|电影感单镜头/i)
  await chooseTemplate(/^(Multi-shot storyboard|多镜头分镜脚本)$/i)
  await page.getByTestId('video-optimize-button').click()
  await showGeneratedSource(page)
  await expect(editor).toHaveValue(multiShot)
  const sourceA = page.getByTestId('video-source-a')
  await sourceA.click()
  await page.locator('.n-base-select-menu:visible .n-base-select-option').getByText('v1', { exact: true }).click()
  await chooseTemplate(/^(Cinematic single shot|电影感单镜头)$/i)
  await expect(editor).toHaveValue(multiShot)
  await page.getByTestId('video-param-shared-duration').locator('.n-select').click()
  await page.locator('.n-base-select-option').filter({ hasText: /^8\s*(?:秒|s)$/ }).click()
  await page.getByTestId('video-param-shared-ratio').locator('.n-select').click()
  await page.locator('.n-base-select-option').filter({ hasText: /^9:16$/ }).click()
  await expect(editor).toHaveValue(multiShot)
  expect(prompts).toHaveLength(1)
  await page.getByTestId('video-optimize-button').click()
  // Both new chains start at v1. Wait for the second response before switching its preview to source.
  await expect(page.getByTestId('video-output').getByText(natural, { exact: true })).toBeVisible()
  await showGeneratedSource(page)
  await expect(editor).toHaveValue(natural)
  expect(prompts).toHaveLength(2)
  expect(prompts[1][0].content).not.toContain('[ACTION]')
  for (const [, user] of prompts) {
    expect(user.content).toContain(creativeBrief)
    expect(user.content).not.toMatch(/9:16|16:9|480p|\b(?:4|8)\s*(?:s\b|秒)/)
  }
  expect(posts).toHaveLength(0)
  await editor.fill('A low tracking shot of the red sailboat passing a buoy.')
  await chooseTemplate(/^(Multi-shot storyboard|多镜头分镜脚本)$/i)
  await expect(editor).toHaveValue('A low tracking shot of the red sailboat passing a buoy.')
  expect(prompts).toHaveLength(2)
  await expect(sourceA).toContainText(/历史版本|歷史版本|history version/i)
  await sourceA.click()
  await page.locator('.n-base-select-menu:visible').getByRole('button', { name: /查看提示词|檢視提示詞|View prompt/i }).click()
  const preview = page.getByTestId('test-source-preview')
  await expect(preview).toContainText('The sailboat crosses the bay.')
  await preview.getByRole('button').filter({ hasText: /^(关闭|關閉|Close)$/i }).click()
  await page.getByTestId('video-run-a').click()
  const olderConfirmation = page.getByRole('alertdialog').or(page.getByRole('dialog')).last()
  await expect(olderConfirmation).toContainText(/8\s*(?:秒|s).*9:16/)
  await olderConfirmation.getByRole('button', { name: /cancel|取消/i }).click()
  await sourceA.click()
  await page.locator('.n-base-select-menu:visible .n-base-select-option').filter({ hasText: /^(原始提示词|原始提示詞|Original Prompt)$/i }).click()
  await sourceA.click()
  const choices = page.locator('.n-base-select-menu:visible .n-base-select-option')
  await expect(choices).toHaveCount(4)
  await expect(choices.nth(1)).toHaveText(/(Previous|上一版).*\(v1\)/i)
  await expect(choices.last()).toHaveText('v1')
  await expect(page.locator('.n-base-select-menu:visible')).not.toContainText('red sailboat')
  await page.screenshot({ path: info.outputPath('video-source-versions.png') })
  await choices.last().click()
  await sourceA.click()
  await page.locator('.n-base-select-menu:visible').getByRole('button', { name: /查看提示词|檢視提示詞|View prompt/i }).click()
  await expect(preview).toContainText(natural)
  await preview.getByRole('button').filter({ hasText: /^(关闭|關閉|Close)$/i }).click()
  await page.getByTestId('video-run-a').click()
  const historyConfirm = page.getByRole('alertdialog').or(page.getByRole('dialog')).last()
  await expect(historyConfirm).toContainText('A · v1')
  await historyConfirm.getByRole('button', { name: /cancel|取消/i }).click()
  expect(posts).toHaveLength(0)
  const generate = page.getByTestId('video-run-b')
  await generate.click()
  const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog')).last()
  await expect(dialog).toContainText('2.97')
  await dialog.locator('button').filter({hasText:/cancel|取消/i}).click()
  expect(posts).toHaveLength(0)
  await generate.click()
  await dialog.getByRole('button', {name:/确认并生成|確認並產生|Confirm and generate/i}).click()
  await expect(page.getByTestId('video-status-b')).toContainText(/排队|排隊|Queued|生成中|產生中|Generating/i)
  expect(posts).toHaveLength(1)
  expect(posts[0]).toMatchObject({content: [{ type: 'text', text: await editor.inputValue() }], duration: 8, ratio: '9:16', generate_audio: false})
  await expect(page.getByTestId('video-status-b')).toContainText(/生成中|產生中|Generating/i, { timeout: 10000 })
  const elapsed = page.getByTestId('video-elapsed-b')
  await expect(elapsed).toContainText(/\d{2}:\d{2}/)
  const initialElapsed = await elapsed.innerText()
  await expect(elapsed).not.toHaveText(initialElapsed)
  await page.reload()
  await expect(editor).toHaveValue('A low tracking shot of the red sailboat passing a buoy.')
  await expect(elapsed).toContainText(/\d{2}:\d{2}/)
  complete = true
  const player = page.locator('video')
  await expect(player).toHaveAttribute('src','https://video-test.invalid/clip.mp4',{timeout:20000})
  await expect(elapsed).toHaveCount(0)
  expect(posts).toHaveLength(1)
  await expect(page.getByTestId('video-usage-b')).toContainText('¥')
  await expect(page.getByTestId('video-usage-b')).not.toContainText(/not reported/i)
  await expect(generate).toBeEnabled()
  await expect.poll(() => player.evaluate(el => (el as HTMLVideoElement).duration)).toBe(4)
  await player.evaluate(async el => {
    const video = el as HTMLVideoElement
    video.muted = true
    await video.play()
  })
  await expect.poll(() => player.evaluate(el => (el as HTMLVideoElement).currentTime)).toBeGreaterThan(0.2)
  await player.evaluate(el => (el as HTMLVideoElement).pause())
  const download = page.waitForEvent('download')
  await page.getByRole('button', {name:/下载 MP4|下載 MP4|Download MP4/i}).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('cgt-e2e.mp4')
  expect(await readFile((await file.path())!)).toEqual(mp4)
  await page.screenshot({path:info.outputPath('video-desktop.png')})
  await page.setViewportSize({width:390,height:844})
  await expect(brief).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByTestId('video-test')).toBeHidden()
  await page.screenshot({path:info.outputPath('video-mobile.png')})
  await page.getByTestId('workspace-region-test').click()
  await expect(player).toBeVisible()
  await expect(brief).toBeHidden()
  const sourceB = page.getByTestId('video-source-b')
  if (!await sourceB.isVisible()) await page.getByTestId('test-config-toggle').click()
  await sourceB.click()
  await page.locator('.n-base-select-menu:visible').getByRole('button', { name: /查看提示词|檢視提示詞|View prompt/i }).click()
  await preview.getByRole('button', { name: /前往编辑|前往編輯|Go to editor/i }).click()
  await expect(editor).toBeVisible()
  await expect(editor).toHaveValue('A low tracking shot of the red sailboat passing a buoy.')
  expect(posts).toHaveLength(1)
})

test('compares videos with independent native playback and seeking, and keeps the latest result in its own column', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.runtime_config={SEEDANCE_API_KEY:"mock-key"};' }))
  const fullClip = await readFile('tests/e2e/fixtures/video-preview.mp4')
  const shortClip = await readFile('tests/e2e/fixtures/video-preview-short.mp4')
  // A seekable MP4 origin must honor the browser's byte-range requests.
  await page.route('https://video-test.invalid/*.mp4', route => {
    const fixture = route.request().url().endsWith('cgt-2.mp4') ? shortClip : fullClip
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '')
    const start = Number(range?.[1] || 0)
    const end = range?.[2] ? Math.min(Number(range[2]), fixture.length - 1) : fixture.length - 1
    return route.fulfill({ status: range ? 206 : 200, contentType: 'video/mp4', body: fixture.subarray(start, end + 1),
      headers: { 'Accept-Ranges': 'bytes', ...(range && { 'Content-Range': 'bytes ' + start + '-' + end + '/' + fixture.length }) } })
  })
  const original = 'A red sail enters the bay.'
  const optimized = 'Track the red sail from a low angle as it crosses the bay.'
  const posts: string[] = []
  let complete = false
  await page.route('https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks**', async route => {
    if (route.request().method() === 'POST') {
      posts.push(route.request().postDataJSON().content[0].text)
      return route.fulfill({ json: { id: 'cgt-' + posts.length } })
    }
    const id = route.request().url().split('/').pop()!
    if (!complete) return route.fulfill({ json: { id, status: 'running' } })
    const count = id === 'cgt-1' ? 40000 : 54000
    return route.fulfill({ json: { id, status: 'succeeded', content: { video_url: 'https://video-test.invalid/' + id + '.mp4' },
      usage: { completion_tokens: count, total_tokens: count } } })
  })
  await page.goto('/#/video/create')
  await page.getByTestId('video-input').locator('textarea').fill(original)
  const editor = page.getByTestId('video-output').locator('textarea')
  await editor.fill(optimized)
  const a = page.getByTestId('video-result-a'), b = page.getByTestId('video-result-b')
  await expect(a.getByTestId('video-source-a')).toHaveCount(1)
  await expect(b.getByTestId('video-source-b')).toHaveCount(1)
  await expect(b.getByTestId('video-run-b')).toHaveText(/生成视频|產生影片|Generate video/i)
  const runAll = page.getByTestId('video-run-all')
  await runAll.click()
  const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog')).last()
  await expect(confirm).toContainText(/2 个视频|2 個影片|2 video generation tasks/)
  await expect(confirm).toContainText('2.97')
  await confirm.getByRole('button', { name: /cancel|取消/i }).click()
  expect(posts).toEqual([])
  await runAll.click()
  await confirm.getByRole('button', { name: /确认并生成|確認並產生|Confirm and generate/i }).click()
  await expect.poll(() => posts).toEqual([original, optimized])
  await expect(page.getByTestId('video-run-a')).toBeDisabled()
  await expect(page.getByTestId('video-run-b')).toBeDisabled()
  await expect(b.locator('.result-meta')).not.toContainText('Seedance 2.0 Fast')
  const laterEdit = 'A later edit is not the submitted prompt.'
  await editor.fill(laterEdit)
  await expect(a.getByTestId('video-origin-a')).toHaveCount(0)
  await expect(b.getByTestId('video-origin-b')).toContainText(/上次提交|Previous submission/i)
  await b.locator('summary').click()
  await expect(b.locator('.snapshot')).toHaveText(optimized)
  await expect(b.locator('details')).toContainText('Seedance 2.0 Fast')
  await b.locator('summary').click()
  await b.getByRole('button', { name: /查询任务|查詢任務|Check task/i }).click()
  await expect(page.getByTestId('video-status-b')).toContainText(/生成中|產生中|Generating/i)
  await page.reload()
  await expect(editor).toHaveValue(laterEdit)
  complete = true
  const playerA = a.locator('video'), playerB = b.locator('video')
  await expect(playerA).toHaveAttribute('src', /cgt-1\.mp4$/, { timeout: 18000 })
  await expect(playerB).toHaveAttribute('src', /cgt-2\.mp4$/, { timeout: 18000 })
  const boundsA = await playerA.boundingBox(), boundsB = await playerB.boundingBox()
  expect(boundsB!.x).toBeGreaterThanOrEqual(boundsA!.x + boundsA!.width)
  expect(Math.abs(boundsB!.y - boundsA!.y)).toBeLessThan(4)
  await expect(page.getByTestId('video-usage-a')).toContainText('40,000')
  await expect(page.getByTestId('video-usage-a')).toContainText('¥1.48')
  await expect(page.getByTestId('video-usage-b')).toContainText('54,000')
  await expect(page.getByTestId('video-usage-b')).toContainText('¥2.00')
  await expect(page.getByTestId('video-usage-b').locator('[title]')).toHaveAttribute('title', /¥1\.998/)
  await b.locator('summary').click()
  await expect(b.locator('.snapshot')).toHaveText(optimized)
  await b.locator('summary').click()
  const videoTimes = () => page.locator('video').evaluateAll((videos: HTMLVideoElement[]) =>
    videos.map(v => !v.seeking && v.paused ? v.currentTime : null))
  await expect(page.getByTestId('video-shared-timeline')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^(同步播放|同步暂停|同步暫停|Play together|Pause together)$/i })).toHaveCount(0)
  await expect(playerA).toHaveJSProperty('controls', true)
  await expect(playerB).toHaveJSProperty('controls', true)
  await expect.poll(() => playerB.evaluate((v: HTMLVideoElement) => v.seekable.length)).toBeGreaterThan(0)
  await playerB.evaluate((v: HTMLVideoElement) => { v.currentTime = 1 })
  await expect.poll(videoTimes).toEqual([0, 1])
  await playerA.press('Space')
  await expect.poll(() => playerA.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.1)
  await expect(playerB).toHaveJSProperty('paused', true)
  await expect(playerB).toHaveJSProperty('currentTime', 1)
  await playerA.press('Space')
  await expect(playerA).toHaveJSProperty('paused', true)
  const beforeSeek = await playerA.evaluate((v: HTMLVideoElement) => v.currentTime)
  await playerA.press('ArrowRight')
  await expect.poll(() => playerA.evaluate((v: HTMLVideoElement) => v.seeking ? 0 : v.currentTime)).toBeGreaterThan(beforeSeek)
  await expect(playerB).toHaveJSProperty('currentTime', 1)
  await page.screenshot({ path: info.outputPath('video-comparison.png') })
  await expect(page.locator('[data-testid^="video-record-"]')).toHaveCount(0)
  await page.getByTestId('video-columns-3').click()
  const c = page.getByTestId('video-result-c')
  await expect(c).toBeVisible()
  await expect(c.locator('video')).toHaveCount(0)
  const generateA = page.getByTestId('video-run-a')
  await generateA.click()
  await confirm.getByRole('button', { name: /确认并生成|確認並產生|Confirm and generate/i }).click()
  await expect(playerA).toHaveAttribute('src', /cgt-3\.mp4$/, { timeout: 15000 })
  await expect(playerB).toHaveAttribute('src', /cgt-2\.mp4$/)
  await page.reload()
  await expect(playerA).toHaveAttribute('src', /cgt-3\.mp4$/)
  await expect(playerB).toHaveAttribute('src', /cgt-2\.mp4$/)
  await expect(c.locator('video')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('workspace-region-test').click()
  await expect(playerA).toBeVisible()
  await expect(playerB).toBeVisible()
  await expect(page.getByTestId('video-run-a')).toHaveCount(0)
  await expect(page.getByTestId('mobile-result-run-a')).toBeVisible()
  await expect.poll(() => playerB.evaluate((v: HTMLVideoElement) => v.seekable.length)).toBeGreaterThan(0)
  await playerB.evaluate((v: HTMLVideoElement) => { v.currentTime = 1 })
  await expect.poll(videoTimes).toEqual([0, 1])
  const narrowA = await playerA.boundingBox(), narrowB = await playerB.boundingBox()
  expect(narrowB!.y).toBeGreaterThan(narrowA!.y)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(posts).toEqual([original, optimized, original])
})

test('validates every column before confirmation and sends the rendered variables in the submitted snapshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript',
    body: 'window.runtime_config={SEEDANCE_API_KEY:"fixture-key"};' }))
  const posts: string[] = []
  await page.route('**/contents/generations/tasks**', route => {
    if (route.request().method() === 'POST') {
      posts.push(route.request().postDataJSON().content[0].text)
      return route.fulfill({ json: { id: 'cgt-rendered' } })
    }
    return route.fulfill({ json: { id: 'cgt-rendered', status: 'failed', error: { message: 'Fixture finished' } } })
  })
  await page.goto('/#/video/create')
  await page.getByTestId('video-input').locator('textarea').fill('A harbor at dawn')
  const editor = page.getByTestId('video-output').locator('textarea')
  const draft = '{{subject}} crosses the bay. Setting: {{originalPrompt}}.'
  await editor.fill(draft)
  const generate = page.getByTestId('video-run-b')
  const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog'))
  await page.getByTestId('video-run-all').click()
  await expect(page.locator('.n-message').filter({ hasText: /B.*subject/ })).toBeVisible()
  await expect(confirm).toHaveCount(0)
  await editor.fill('{{{subject}}}')
  await generate.click()
  await expect(page.locator('.n-message').filter({ hasText: /B.*Mustache/i })).toBeVisible()
  await expect(confirm).toHaveCount(0)
  expect(posts).toEqual([])

  await editor.fill(draft)
  await page.getByRole('button', { name: /变量管理|變數管理|Variable Manager/i }).click()
  await page.getByRole('button', { name: /添加变量|新增變數|Add Variable/i }).click()
  const form = page.getByRole('dialog').last()
  await form.getByRole('textbox').nth(0).fill('subject')
  await form.getByRole('textbox').nth(1).fill('A red sailboat')
  await form.getByRole('button', { name: /^(添加|新增|Add)$/i }).click()
  await expect(page.getByRole('dialog').last()).toContainText('A red sailboat')
  await page.keyboard.press('Escape')
  await generate.click()
  await confirm.last().getByRole('button', { name: /确认并生成|確認並產生|Confirm and generate/i }).click()
  const rendered = 'A red sailboat crosses the bay. Setting: A harbor at dawn.'
  await expect.poll(() => posts).toEqual([rendered])
  const b = page.getByTestId('video-result-b')
  await b.locator('summary').click()
  await expect(b.locator('.snapshot')).toHaveText(rendered)
  await expect(editor).toHaveValue(draft)
})

test('opens two videos from a legacy single-column session with usage and no new generation', async ({ page }) => {
  const dbName = 'video-legacy-' + Date.now()
  await page.addInitScript(name => { Object.assign(window, { __TEST_DB_NAME__: name }) }, dbName)
  await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript',
    body: 'window.runtime_config={SEEDANCE_API_KEY:"fixture-key"};' }))
  const calls: string[] = []
  await page.route('**/contents/generations/tasks**', route => { calls.push(route.request().method()); return route.abort() })
  await page.goto('/#/video/create')
  await expect(page.getByTestId('video-run-b')).toBeVisible()
  await page.goto('/config.js')
  const now = Date.now()
  await page.evaluate(({ dbName, now }) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(dbName)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction('storage', 'readwrite')
      const legacy = (id: string, time: number, prompt: string, tokens?: number) => ({ id, submittedAt: time, prompt, tokens,
        model: 'doubao-seedance-2-0-fast-260128', status: 'succeeded', params: { duration: 4, resolution: '480p', ratio: '16:9' },
        images: [], videoUrl: 'https://video-test.invalid/' + id + '.mp4', expiresAt: now + 86400000 })
      const runs = [legacy('legacy-newer', now, 'Second video', 40000), legacy('legacy-older', now - 10000, 'First video')]
      const originalPrompt = 'A red sail'
      const root = { id: 'red-v1', chainId: 'red', version: 1, type: 'videoOptimize', originalPrompt, optimizedPrompt: 'Harbor at dawn',
        modelKey: 'writer', templateId: 'video-natural', timestamp: now - 3000 }
      const versionTwo = { ...root, id: 'red-v2', type: 'iterate', version: 2, optimizedPrompt: 'Harbor at noon', previousId: root.id, timestamp: now - 2000 }
      const other = { ...root, id: 'unrelated', chainId: 'other', optimizedPrompt: 'A different take', timestamp: now - 1000 }
      const storage = tx.objectStore('storage')
      storage.put({ key: 'prompt_history', timestamp: now, value: JSON.stringify([root, versionTwo, other]) })
      storage.put({ key: 'pref:session/v1/video-create', timestamp: now,
        value: JSON.stringify({ originalPrompt, optimizedPrompt: 'An edited draft', lastGeneratedPrompt: versionTwo.optimizedPrompt, runs }) })
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }
  }), { dbName, now })
  const clip = await readFile('tests/e2e/fixtures/video-preview.mp4')
  await page.route('https://video-test.invalid/*.mp4', route => route.fulfill({ contentType: 'video/mp4', body: clip }))
  await page.goto('/#/video/create')
  await expect(page.getByTestId('video-result-a').locator('video')).toHaveAttribute('src', /legacy-older/)
  await expect(page.getByTestId('video-result-b').locator('video')).toHaveAttribute('src', /legacy-newer/)
  await expect(page.getByTestId('video-origin-a')).toContainText(/历史单列结果|歷史單欄結果|single-column result/i)
  await expect(page.getByTestId('video-origin-b')).toContainText(/历史单列结果|歷史單欄結果|single-column result/i)
  await expect(page.getByTestId('video-usage-a')).toContainText('¥')
  const legacyUsage = page.getByTestId('video-usage-b')
  await expect(legacyUsage).toContainText('¥1.48')
  await expect(legacyUsage).not.toContainText(/总 token|總 token|Total tokens/i)
  await expect(page.getByTestId('video-result-b').locator('.result-meta')).toContainText('Seedance 2.0 Fast')
  expect(calls).toEqual([])
  const source = page.getByTestId('video-source-a')
  await source.click()
  const versions = page.locator('.n-base-select-menu:visible .n-base-select-option')
  await expect(versions).toHaveCount(5)
  await expect(versions.nth(3)).toHaveText('v1')
  await expect(versions.last()).toHaveText('v2')
  await versions.filter({ hasText: /(Previous|上一版).*\(v2\)/i }).click()
  await page.getByTestId('video-output').locator('textarea').fill('Harbor at noon')
  await source.click()
  await expect(versions.nth(1)).toHaveText(/^(Previous|上一版)$/i)
  await page.locator('.n-base-select-menu:visible').getByRole('button', { name: /查看提示词|檢視提示詞|View prompt/i }).click()
  const preview = page.getByTestId('test-source-preview')
  await expect(preview).toContainText('Harbor at dawn')
  await preview.getByRole('button').filter({ hasText: /^(关闭|關閉|Close)$/i }).click()
  await page.route('**/contents/generations/tasks/legacy-newer', route => {
    calls.push(route.request().method())
    return route.fulfill({ json: { id: 'legacy-newer', status: 'succeeded', content: { video_url: 'https://video-test.invalid/legacy-newer.mp4' },
      usage: { completion_tokens: 40000, total_tokens: 40123 } } })
  })
  await page.getByTestId('video-result-b').getByRole('button', { name: /查询用量|查詢用量|Check usage/i }).click()
  await expect(legacyUsage).toContainText('40,123')
  await page.reload()
  await expect(legacyUsage).toContainText('40,123')
  await expect(source).toContainText(/Previous|上一版/i)
  expect(calls).toEqual(['GET'])
})

test('views, copies and selects a video template and uses its actual messages after a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript',
    body: 'window.runtime_config={CUSTOM_API_KEY:"mock",CUSTOM_API_BASE_URL:"https://video-test.invalid/v1",CUSTOM_API_MODEL:"video-writer"};' }))
  const calls: { role: string; content: unknown }[][] = []
  const output = '{"my_format":"hold the last frame"}'
  await page.route('**/chat/completions*', route => {
    calls.push(route.request().postDataJSON().messages)
    return route.fulfill({ json: { id: 'chat-custom', object: 'chat.completion', choices: [
      { index: 0, finish_reason: 'stop', message: { role: 'assistant', content: output } },
    ] } })
  })
  await page.goto('/#/video/create')
  const picker = page.getByTestId('video-template-select')
  const editor = page.getByTestId('video-output').locator('textarea')
  const brief = page.getByTestId('video-input').locator('textarea')
  await brief.fill('A skater stops at the edge of the ice.')
  await editor.fill('An existing manual draft.')
  await page.getByTestId('header-modal-actions').getByRole('button', { name: /功能提示词|功能提示詞|Templates/i }).click()

  const manager = page.getByRole('dialog').first()
  const natural = manager.locator('.n-card').filter({ has: page.getByText(/^(Cinematic single shot|电影感单镜头)$/i) }).last()
  await natural.getByRole('button', { name: /^(View|查看|檢視)$/i }).click()
  const detail = page.getByRole('dialog').last()
  await expect(detail.locator('textarea').first()).toHaveValue(/运镜轨迹|camera trajectory/is)
  await detail.locator('.n-card__action').getByRole('button', { name: /^(Close|关闭|關閉)$/i }).click()
  await natural.getByRole('button', { name: /^(Copy|复制|複製)$/i }).click()
  const form = page.getByRole('dialog').last()
  await form.locator('form input').first().fill('My storyboard')
  await form.locator('form textarea').nth(0).fill('Use my storyboard schema.')
  await form.locator('form textarea').nth(1).fill('Scene {{{originalPrompt}}}{{#duration}} / {{duration}}s{{/duration}}{{#referenceRoles}} / {{{referenceRoles}}}{{/referenceRoles}}')
  await form.getByRole('button', { name: /^(Add|添加|新增)$/i }).click()
  await manager.getByText('My storyboard', { exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(picker).toContainText('My storyboard')
  await expect(editor).toHaveValue('An existing manual draft.')
  await picker.click()
  await page.locator('.n-base-select-menu').getByRole('button', { name: /Configure|配置|設定/i }).click()
  await expect(manager.getByText('My storyboard', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(picker).toContainText('My storyboard')
  await expect(editor).toHaveValue('An existing manual draft.')
  expect(calls).toHaveLength(0)
  await page.getByTestId('video-optimize-button').click()
  const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog')).last()
  await confirm.getByRole('button', { name: /优化提示词|優化提示詞|Optimize prompt/i }).click()
  await showGeneratedSource(page)
  await expect(editor).toHaveValue(output)
  expect(calls).toEqual([[
    { role: 'system', content: 'Use my storyboard schema.' },
    { role: 'user', content: 'Scene A skater stops at the edge of the ice.' },
  ]])

  await page.getByTestId('video-input-mode-references').click()
  await page.locator('input[type=file][accept*="webp"]').setInputFiles('tests/e2e/fixtures/images/text2image-output.png')
  await expect(page.getByTestId('video-reference-card-1').locator('img')).toBeVisible()
  await page.getByTestId('video-optimize-button').click()
  await expect.poll(() => calls.length).toBe(2)
  expect(calls[1]).toEqual([
    { role: 'system', content: 'Use my storyboard schema.' },
    { role: 'user', content: [
      { type: 'text', text: expect.stringMatching(/ice\. \/ 1\. (References|Image references|Reference image|多图参考|多圖參考|参考图|參考圖)$/i) },
      { type: 'image_url', image_url: { url: expect.stringMatching(/^data:image\/png;base64,/) } },
    ] },
  ])
})

test('manages video configurations and keeps a running task bound to its original account', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const requests: { url: string; method: string; auth?: string; model?: string }[] = []
  const proxy = 'https://ark-fixture.invalid/api/v3'
  const routeTasks = async (route: import('@playwright/test').Route) => {
    const request = route.request()
    const url = new URL(request.url())
    requests.push({ url: url.href, method: request.method(), auth: request.headers().authorization,
      model: request.method() === 'POST' ? request.postDataJSON().model : undefined })
    if (url.search) return route.fulfill({ json: { total: 0, items: [] } })
    if (request.method() === 'POST') return route.fulfill({ json: { id: 'cgt-studio' } })
    return route.fulfill({ json: { id: 'cgt-studio', status: 'failed', error: { message: 'Fixture finished' }, usage: { completion_tokens: 40000 } } })
  }
  await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript',
    body: 'window.runtime_config={SEEDANCE_API_KEY:"fixture-environment"};' }))
  await page.route('https://ark.cn-beijing.volces.com/**', routeTasks)
  await page.route('https://ark-fixture.invalid/**', routeTasks)
  await page.goto('/#/video/create')
  const manager = page.getByTestId('video-model-manager')
  const manage = page.getByTestId('video-manage-models')
  const picker = page.getByTestId('video-model-b')
  await expect(page.getByTestId('video-result-a').getByTestId('video-model-a')).toContainText('Seedance 2.0 Fast')
  await expect(picker).toContainText('Seedance 2.0 Fast')
  await expect(picker).toHaveRole('button')
  await expect(picker).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('video-param-shared-duration')).toBeVisible()
  await expect(page.getByTestId('video-param-b-duration')).toHaveCount(0)
  await manage.click()
  await expect(manager.getByTestId('video-model-row-seedance')).toContainText(/Environment key|使用環境金鑰|使用环境密钥/i)
  await page.getByTestId('add-video-model').click()
  const field = (name: string) => page.getByTestId('video-config-' + name).locator('input')
  await field('name').fill('Studio Ark')
  await field('wire-model').fill('ep-studio-fast')
  await field('url').fill(proxy)
  await field('key').fill('fixture-studio')
  await page.getByTestId('video-config-save').click()
  const row = manager.locator('[data-testid^="video-model-row-"]').filter({ hasText: 'Studio Ark' }).first()
  await expect(row).toContainText(/Saved key|已儲存金鑰|已保存密钥/i)
  await row.getByRole('button', { name: /Test Connection|测试连接|測試連線/i }).click()
  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0]).toEqual({ url: proxy + '/contents/generations/tasks?page_size=1', method: 'GET', auth: 'Bearer fixture-studio', model: undefined })
  await page.screenshot({ path: info.outputPath('video-models-desktop.png') })
  await row.getByRole('button', { name: /Clone|克隆|複製/i }).click()
  const clone = 'Studio backup'
  await field('name').fill(clone)
  await page.getByTestId('video-config-save').click()
  const clonedRow = manager.locator('[data-testid^="video-model-row-"]').filter({ hasText: clone })
  await clonedRow.getByRole('button', { name: /^Disable$|禁用|停用/i }).click()
  await expect(clonedRow.getByRole('button', { name: /^Enable$|^启用$|^啟用$/i })).toBeVisible()
  await clonedRow.getByRole('button', { name: /Delete|删除|刪除/i }).click()
  await page.getByRole('dialog').or(page.getByRole('alertdialog')).filter({ hasText: /“Studio backup”|「Studio backup」/ }).getByRole('button', { name: /Delete|删除|刪除/i }).click()
  await expect(clonedRow).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(manager).toBeHidden()
  await picker.click()
  await page.getByRole('button', { name: 'ep-studio-fast', exact: true }).click()
  await expect(picker).toContainText('Studio Ark')
  const editor = page.getByTestId('video-output').locator('textarea')
  await editor.fill('A stationary camera watches the tide.')
  await page.getByTestId('video-run-b').click()
  const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog')).last()
  await expect(confirm).toContainText('ep-studio-fast')
  await expect(confirm).not.toContainText('1.49')
  await confirm.getByRole('button', { name: /Confirm and generate|确认并生成|確認並產生/i }).click()
  await expect.poll(() => requests.filter(req => req.method === 'POST').length).toBe(1)
  await picker.click()
  await page.getByRole('button', { name: 'doubao-seedance-2-0-fast-260128', exact: true }).click()
  await expect(picker).toContainText('Seedance 2.0 Fast')
  await expect(picker).toBeEnabled()
  await page.reload()
  await expect(picker).toContainText('Seedance 2.0 Fast')
  await expect(page.getByTestId('video-status-b')).toContainText(/Failed|失败|失敗/i, { timeout: 18000 })
  await expect(page.getByTestId('video-usage-b')).toContainText('40,000')
  await expect(page.getByTestId('video-usage-b')).not.toContainText('¥')
  expect(requests.filter(req => req.method === 'POST')).toEqual([{ url: proxy + '/contents/generations/tasks',
    method: 'POST', auth: 'Bearer fixture-studio', model: 'ep-studio-fast' }])
  expect(requests.filter(req => req.url.endsWith('/cgt-studio'))).toContainEqual({
    url: proxy + '/contents/generations/tasks/cgt-studio', method: 'GET', auth: 'Bearer fixture-studio', model: undefined,
  })
  await picker.click()
  await page.getByRole('button', { name: 'ep-studio-fast', exact: true }).click()
  await manage.click()
  await row.getByRole('button', { name: /^Disable$|禁用|停用/i }).click()
  await expect(row.getByRole('button', { name: /^Enable$|^启用$|^啟用$/i })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('video-result-b')).toContainText('Studio Ark')
  await expect(page.getByTestId('video-run-b')).toBeDisabled()
  await expect(page.getByTestId('video-model-a')).toContainText('Seedance 2.0 Fast')
  await expect(picker).toBeVisible()
  await picker.click()
  await page.getByRole('button', { name: 'doubao-seedance-2-0-fast-260128', exact: true }).click()
  await expect(page.getByTestId('video-run-b')).toBeEnabled()
  expect(requests.filter(req => req.method === 'POST')).toHaveLength(1)
  await manage.click()
  await row.getByRole('button', { name: /^Enable$|^启用$|^啟用$/i }).click()
  await expect(row.getByRole('button', { name: /^Disable$|禁用|停用/i })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('workspace-region-test').click()
  const splitDuration = page.getByTestId('video-param-shared-duration-split')
  if (!await splitDuration.isVisible()) await page.getByTestId('test-config-toggle').click()
  await splitDuration.click()
  const mobileDuration = page.getByTestId('video-param-b-duration')
  const mobileOptions = page.locator('.n-base-select-menu:visible')
  await expect(picker).toHaveAttribute('aria-expanded', 'false')
  await mobileDuration.locator('.n-select').click()
  await mobileOptions.locator('.n-base-select-option').getByText(/^8\s*(s|秒)$/).click()
  await expect(mobileOptions).toHaveCount(0)
  await expect(mobileDuration).toContainText(/8\s*(s|秒)/)
  await expect(page.getByTestId('video-param-a-duration')).toContainText(/4\s*(s|秒)/)
  await page.getByTestId('video-result-b').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('video-parameters-mobile.png') })
  await picker.click()
  await page.locator('.text-model-menu__configure[aria-label$="Studio Ark"]').click()
  await expect(field('name')).toHaveValue('Studio Ark')
  await field('name').fill('Studio team')
  await page.getByTestId('video-config-save').click()
  await expect(manager.getByText('Studio team', { exact: true })).toBeVisible()
  const functionsTab = page.getByTestId('model-manager-tabs').locator('[data-name="function"]')
  await expect(functionsTab).toHaveText(/^(Functions|功能)$/)
  await expect(functionsTab).toBeInViewport({ ratio: 1 })
  await page.screenshot({ path: info.outputPath('video-models-mobile.png') })
})

test('switches and persists reference and frame uploads, generates with the active mode, and reopens a favorite', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript',
    body: 'window.runtime_config={SEEDANCE_API_KEY:"mock-ark-key"};' }))
  const submissions: { content: unknown[] }[] = []
  await page.route('**/contents/generations/tasks**', route => {
    if (route.request().method() === 'POST') {
      submissions.push(route.request().postDataJSON())
      return route.fulfill({ json: { id: 'cgt-frames' } })
    }
    return route.fulfill({ json: { id: 'cgt-frames', status: 'succeeded', content: { video_url: 'https://video-test.invalid/frames.mp4' } } })
  })
  const clip = await readFile('tests/e2e/fixtures/video-preview.mp4')
  await page.route('https://video-test.invalid/frames.mp4', route => route.fulfill({ contentType: 'video/mp4', body: clip }))
  await page.goto('/#/video/create')
  const editor = page.getByTestId('video-output').locator('textarea')
  const brief = page.getByTestId('video-input').locator('textarea')
  const divider = page.getByTestId('video-workspace').getByRole('separator')
  await divider.press('ArrowLeft')
  await expect(divider).toHaveAttribute('aria-valuenow', '49')
  await brief.fill('A red sail on the horizon')
  const prompt = 'Track the sail at water level.'
  await editor.fill(prompt)

  const pngPath = 'tests/e2e/fixtures/images/text2image-output.png'
  const secondPng = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 24
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'blue'
    ctx.fillRect(0, 0, 32, 24)
    return canvas.toDataURL('image/png')
  })
  const blue = { name: 'blue.png', mimeType: 'image/png', buffer: Buffer.from(secondPng.split(',')[1], 'base64') }
  const dropBlue = async (picker: ReturnType<Page['getByTestId']>) => {
    await picker.locator('.reference-image-picker__surface').evaluate(async (target, source) => {
      const transfer = new DataTransfer()
      const blob = await (await fetch(source)).blob()
      transfer.items.add(new File([blob], 'blue.png', { type: 'image/png' }))
      target.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }))
    }, secondPng)
  }

  await expect(page.getByTestId('video-reference-upload')).toHaveCount(0)
  await page.getByTestId('video-input-mode-references').click()
  const refs = page.getByTestId('video-reference-upload')
  const reference1 = page.getByTestId('video-reference-card-1')
  const reference2 = page.getByTestId('video-reference-card-2')
  await refs.locator('input[type=file]').setInputFiles(pngPath)
  await expect(reference1.locator('img')).toBeVisible()
  await expect(reference1.locator('img')).toHaveCSS('object-fit', 'cover')
  const firstRefUrl = (await reference1.locator('img').getAttribute('src'))!
  await reference1.locator('img').click()
  const enlarged = page.locator('img.n-image-preview')
  await expect(enlarged).toHaveAttribute('src', firstRefUrl)
  await page.keyboard.press('Escape')
  await expect(enlarged).toBeHidden()
  await dropBlue(refs)
  await expect(reference2.locator('img')).toBeVisible()
  const blueUrl = (await reference2.locator('img').getAttribute('src'))!
  await reference2.locator('.image-card__footer').dragTo(reference1)
  await expect(reference1.locator('img')).toHaveAttribute('src', blueUrl)
  await expect(reference2.locator('img')).toHaveAttribute('src', firstRefUrl)

  await page.getByTestId('video-input-mode-frames').click()
  const first = page.getByTestId('video-first-frame-upload')
  const last = page.getByTestId('video-last-frame-upload')
  const firstImage = page.getByTestId('video-first-frame-preview').locator('img')
  const lastImage = page.getByTestId('video-last-frame-preview').locator('img')
  const generate = page.getByTestId('video-run-b')
  await expect(last.locator('input[type=file]')).toBeDisabled()
  await expect(generate).toBeDisabled()
  await dropBlue(first)
  await expect(firstImage).toHaveAttribute('src', blueUrl)
  await expect(firstImage).toHaveCSS('object-fit', 'contain')
  await expect(generate).toBeEnabled()
  await first.locator('input[type=file]').setInputFiles(pngPath)
  await expect(firstImage).toHaveAttribute('src', firstRefUrl)
  await last.locator('input[type=file]').setInputFiles(blue)
  await expect(lastImage).toHaveAttribute('src', blueUrl)
  await page.getByTestId('video-frame-swap').click()
  await expect(firstImage).toHaveAttribute('src', blueUrl)
  await expect(lastImage).toHaveAttribute('src', firstRefUrl)

  await generate.click()
  const confirmation = page.getByRole('alertdialog').or(page.getByRole('dialog')).last()
  await confirmation.getByRole('button', { name: /确认并生成|確認並產生|Confirm and generate/i }).click()
  await expect.poll(() => submissions.length).toBe(1)
  expect(submissions[0].content).toEqual([
    { type: 'text', text: prompt },
    { type: 'image_url', role: 'first_frame', image_url: { url: blueUrl } },
    { type: 'image_url', role: 'last_frame', image_url: { url: firstRefUrl } },
  ])
  await expect(page.getByTestId('video-result-b').locator('video')).toBeVisible()
  await page.reload()
  await expect(divider).toHaveAttribute('aria-valuenow', '49')
  await expect(firstImage).toHaveAttribute('src', blueUrl)
  await expect(lastImage).toHaveAttribute('src', firstRefUrl)
  await first.locator('.image-card__remove').click()
  await expect(firstImage).toBeVisible()
  await last.locator('.image-card__remove').click()
  await first.locator('.image-card__remove').click()
  await expect(last.locator('input[type=file]')).toBeDisabled()
  await expect(generate).toBeDisabled()
  await page.getByTestId('video-input-mode-references').click()
  await expect(reference1.locator('img')).toHaveAttribute('src', blueUrl)
  await expect(reference2.locator('img')).toHaveAttribute('src', firstRefUrl)

  await page.getByTestId('video-output-favorite').click()
  await page.getByTestId('favorite-editor-title').locator('input').fill('Video test favorite')
  await page.getByTestId('favorite-editor-save').click()
  await expect(page.getByTestId('favorite-editor-save')).toBeHidden()
  await page.goto('/#/favorites')
  const favorite = page.getByTestId('favorite-workspace-list-item').filter({ hasText: 'Video test favorite' })
  await expect(favorite).toContainText(/Video|视频|影片/i)
  await favorite.click()
  await page.getByTestId('favorite-detail-use').click()
  await expect(page).toHaveURL(/#\/video\/create$/)
  await expect(brief).toHaveValue('A red sail on the horizon')
  await expect(editor).toHaveValue(prompt)
})

test('revises the edited draft in the same chain and compares saved versions after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript',
    body: 'window.runtime_config={CUSTOM_API_KEY:"mock",CUSTOM_API_BASE_URL:"https://video-test.invalid/v1",CUSTOM_API_MODEL:"video-writer"};' }))
  const original = 'At dawn {{boat}} passes the buoy, left to right. No subtitles.'
  const first = 'At dawn {{boat}} passes the buoy from left to right. A low camera tracks it. No subtitles.'
  const edited = first.replace('the buoy', 'buoy 17')
  const feedback = 'Change only the camera to a fixed position.'
  const final = edited.replace('tracks it', 'stays fixed')
  const requests: { role: string; content: string }[][] = []
  await page.route('**/chat/completions*', route => {
    requests.push(route.request().postDataJSON().messages)
    return route.fulfill({ json: { id: 'text', choices: [{ index: 0, finish_reason: 'stop',
      message: { role: 'assistant', content: requests.length === 1 ? first : final } }] } })
  })
  await page.goto('/#/video/create')
  const editor = page.getByTestId('video-output').locator('textarea')
  await page.getByTestId('video-input').locator('textarea').fill(original)
  await page.getByTestId('video-optimize-button').click()
  await showGeneratedSource(page)
  await expect(editor).toHaveValue(first)
  await editor.fill(edited)
  await page.getByTestId('prompt-panel-continue-optimize').click()
  const modal = page.getByTestId('prompt-panel-iterate-modal')
  await expect(modal).toContainText(/Targeted revision|按反馈局部修改/i)
  await page.getByTestId('prompt-panel-iterate-input').locator('textarea').fill(feedback)
  await page.getByTestId('prompt-panel-iterate-submit').click()
  await showGeneratedSource(page, 2)
  await expect(editor).toHaveValue(final)
  expect(requests).toHaveLength(2)
  for (const expected of [original, edited, feedback]) expect(requests[1][1].content).toContain(expected)
  await expect(page.getByTestId('prompt-panel-version-tag-v2')).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(editor).toHaveValue(final)
  await page.getByTestId('video-source-a').click()
  await page.locator('.n-base-select-menu:visible').getByText('v1', { exact: true }).click()
  await page.getByTestId('video-source-a').click()
  await page.locator('.n-base-select-menu:visible').getByRole('button', { name: /查看提示词|檢視提示詞|View prompt/i }).click()
  await expect(page.getByRole('dialog').last()).toContainText(first)
  await page.getByRole('dialog').last().locator('button').filter({ hasText: /^(关闭|關閉|Close)$/i }).click()
  await page.getByTestId('prompt-panel-version-tag-v1').click()
  await expect(editor).toHaveValue(first)
  await page.getByTestId('prompt-panel-version-tag-v2').click()
  await expect(editor).toHaveValue(final)
  await editor.fill(final + ' Keep the distant bell.')
  await page.getByRole('button', {name:/保存修改|儲存修改|Save changes/i}).click()
  await expect(page.getByTestId('prompt-panel-version-tag-v3')).toHaveAttribute('aria-pressed', 'true')
  expect(requests).toHaveLength(2)
})

test('uses a managed custom revision on a pasted draft and keeps that draft as V1', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript',
    body: 'window.runtime_config={CUSTOM_API_KEY:"mock",CUSTOM_API_BASE_URL:"https://video-test.invalid/v1",CUSTOM_API_MODEL:"writer"};' }))
  const draft = 'Eye-level shot of a skier. Follow the skier to the right.'
  const revised = 'Eye-level shot of a skier. The camera stays fixed as the skier moves to the right.'
  const feedback = 'Lock the camera.'
  const requests: { role: string; content: string }[][] = []
  await page.route('**/chat/completions*', route => {
    requests.push(route.request().postDataJSON().messages)
    return route.fulfill({ json: { id: 'text', choices: [{ index: 0, finish_reason: 'stop',
      message: { role: 'assistant', content: revised } }] } })
  })
  await page.goto('/#/video/create')
  const editor = page.getByTestId('video-output').locator('textarea')
  await editor.fill(draft)
  await page.getByTestId('header-modal-actions').getByRole('button', { name: /功能提示词|功能提示詞|Templates/i }).click()
  const manager = page.getByRole('dialog').first()
  await manager.getByRole('button', { name: /视频 · 按反馈迭代|影片 · 按回饋迭代|Video · Revision/i }).click()
  const builtin = manager.locator('.n-card').filter({ has: page.getByText(/^(按反馈局部修改|Targeted revision)$/i) }).last()
  await builtin.getByRole('button', { name: /^(Copy|复制|複製)$/i }).click()
  const form = page.getByRole('dialog').last()
  await form.locator('form input').first().fill('Camera edit')
  await form.locator('form textarea').nth(0).fill('Edit the camera only.')
  await form.locator('form textarea').nth(1).fill('{{{lastOptimizedPrompt}}} / {{{iterateInput}}}{{#ratio}} / {{ratio}}{{/ratio}}')
  await form.getByRole('button', { name: /^(Add|添加|新增)$/i }).click()
  await manager.getByText('Camera edit', { exact: true }).click()
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(editor).toHaveValue(draft)
  await page.getByTestId('prompt-panel-continue-optimize').click()
  await expect(page.getByTestId('prompt-panel-iterate-modal')).toContainText('Camera edit')
  await page.getByTestId('prompt-panel-iterate-input').locator('textarea').fill(feedback)
  await page.getByTestId('prompt-panel-iterate-submit').click()
  await showGeneratedSource(page, 2)
  await expect(editor).toHaveValue(revised)
  await page.getByTestId('prompt-panel-version-tag-v1').click()
  await expect(editor).toHaveValue(draft)
  expect(requests).toEqual([[{ role: 'system', content: 'Edit the camera only.' },
    { role: 'user', content: draft + ' / ' + feedback }]])
})
