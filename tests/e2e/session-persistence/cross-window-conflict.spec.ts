import { test, expect, type Page } from '@playwright/test'

// These windows deliberately share an origin and IndexedDB. No model requests
// are needed: exercise the real app's pagehide checkpoint and route restoration.
const input = (page: Page) => page.getByTestId('basic-user-input')

async function readPrompt(page: Page) {
  const editor = input(page)
  if (await editor.locator('textarea').count()) return editor.locator('textarea').first().inputValue()
  if (await editor.locator('.cm-content').count()) return editor.locator('.cm-content').innerText()
  return ''
}

async function editPrompt(page: Page, value: string) {
  const editor = input(page)
  await expect(editor).toBeVisible()
  if (await editor.locator('textarea').count()) await editor.locator('textarea').first().fill(value)
  else {
    await editor.locator('.cm-content').click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.insertText(value)
  }
  await expect.poll(() => readPrompt(page)).toBe(value)
}

async function openWorkspace(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('workspace')).toBeVisible({ timeout: 20000 })
  await page.goto('/#/basic/user')
  await expect(input(page)).toBeVisible({ timeout: 20000 })
}

async function checkpoint(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
}

async function savedPrompt(page: Page, dbName: string): Promise<string | null> {
  return page.evaluate(name => new Promise<string | null>((resolve, reject) => {
    const request = indexedDB.open(name)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('storage', 'readonly')
      const get = transaction.objectStore('storage').get('pref:session/v1/basic-user')
      get.onsuccess = () => resolve(get.result ? JSON.parse(get.result.value).prompt : null)
      get.onerror = () => reject(get.error)
      transaction.oncomplete = () => db.close()
    }
  }), dbName)
}

for (const viewport of [{ width: 360, height: 725 }, { width: 1440, height: 900 }]) {
  test(`keeps the latest snapshot and the conflicting draft at ${viewport.width}px`, async ({ context, page }) => {
    const dbName = `test-cross-window-${viewport.width}-${Date.now()}`
    await context.addInitScript(name => {
      (window as Window & { __TEST_DB_NAME__?: string }).__TEST_DB_NAME__ = name
    }, dbName)
    await page.setViewportSize(viewport)
    await openWorkspace(page)
    await editPrompt(page, 'Shared baseline')
    await checkpoint(page)
    await expect.poll(() => savedPrompt(page, dbName)).toBe('Shared baseline')

    const other = await context.newPage()
    try {
      await other.setViewportSize(viewport)
      await openWorkspace(other)
      await expect.poll(() => readPrompt(other)).toBe('Shared baseline')
      await editPrompt(page, 'Latest saved prompt')
      await checkpoint(page)
      await expect.poll(() => savedPrompt(page, dbName)).toBe('Latest saved prompt')

      await editPrompt(other, 'Keep this unsaved draft')
      await checkpoint(other)
      await expect(other.getByText(/另一个窗口已更新|Another window updated/).first()).toBeVisible()
      expect(await savedPrompt(other, dbName)).toBe('Latest saved prompt')

      await other.goto('/#/basic/system')
      await expect(other.locator('[data-mode="basic-system"]')).toBeVisible()
      await other.goto('/#/basic/user')
      await expect.poll(() => readPrompt(other)).toBe('Keep this unsaved draft')
      // A deliberate reload after copying the draft must restore the winner.
      await other.reload()
      await expect(input(other)).toBeVisible({ timeout: 20000 })
      await expect.poll(() => readPrompt(other), { timeout: 20000 }).toBe('Latest saved prompt')
    } finally { await other.close() }
  })
}
