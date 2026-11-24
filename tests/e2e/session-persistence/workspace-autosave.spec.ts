import { test, expect, type Page } from '@playwright/test'

const editPrompt = async (page: Page, value: string) => {
  const input = page.getByTestId('basic-user-input')
  if (await input.locator('textarea').count()) {
    await input.locator('textarea').first().fill(value)
  } else {
    await input.locator('.cm-content').fill(value)
  }
}

const expectPrompt = async (page: Page, value: string) => {
  const input = page.getByTestId('basic-user-input')
  await expect(input).toBeVisible()
  if (await input.locator('textarea').count()) {
    await expect(input.locator('textarea').first()).toHaveValue(value)
  } else {
    await expect(input.locator('.cm-content')).toHaveText(value)
  }
}

const storedText = (page: Page, dbName: string, workspace: string, field: string) => page.evaluate(({ dbName, workspace, field }) => new Promise<string | null>((resolve, reject) => {
  const open = indexedDB.open(dbName)
  open.onerror = () => reject(open.error)
  open.onsuccess = () => {
    const db = open.result
    if (!db.objectStoreNames.contains('storage')) { db.close(); resolve(null); return }
    const tx = db.transaction('storage', 'readonly')
    const get = tx.objectStore('storage').get('pref:session/v1/' + workspace)
    get.onsuccess = () => resolve(get.result ? JSON.parse(get.result.value)[field] : null)
    get.onerror = () => reject(get.error)
    tx.oncomplete = () => db.close()
  }
}), { dbName, workspace, field })

const storedPrompt = (page: Page, dbName: string) => storedText(page, dbName, 'basic-user', 'prompt')

const systemTestInput = async (page: Page, compact: boolean) => {
  if (compact) await page.getByTestId('workspace-region-test').click()
  return page.getByTestId('basic-system-test-input').locator('textarea')
}

const switchWorkspace = async (page: Page, compact: boolean, to: 'user' | 'system') => {
  if (compact) {
    await page.getByTestId('compact-mode-select').click()
    await page.getByTestId('compact-mode-basic-' + to).click()
  } else {
    await page.getByTestId('sub-mode-' + to).click()
  }
  await expect(page.locator('[data-mode="basic-' + to + '"]')).toBeVisible()
}

for (const width of [1440, 390]) {
  test.describe('workspace autosave at ' + width + 'px', () => {
    test.use({ viewport: { width, height: 900 } })

    test('submits ordinary edits and restores them after a real refresh and route switch', async ({ page }) => {
      const dbName = 'test-autosave-' + width + '-' + Date.now()
      await page.addInitScript(name => {
        (window as Window & { __TEST_DB_NAME__?: string }).__TEST_DB_NAME__ = name
      }, dbName)
      await page.goto('/#/basic/user')
      await expect(page.getByTestId('basic-user-input')).toBeVisible()
      await editPrompt(page, 'Draft stored by workspace autosave')
      await expect.poll(() => storedPrompt(page, dbName), { timeout: 3500 })
        .toBe('Draft stored by workspace autosave')
      await page.reload()
      await expectPrompt(page, 'Draft stored by workspace autosave')

      await editPrompt(page, 'Draft stored while leaving the workspace')
      await switchWorkspace(page, width === 390, 'system')
      await expect.poll(() => storedPrompt(page, dbName), { timeout: 3500 })
        .toBe('Draft stored while leaving the workspace')
      const testInput = 'Test input restored after refresh'
      await (await systemTestInput(page, width === 390)).fill(testInput)
      await expect.poll(() => storedText(page, dbName, 'basic-system', 'testContent'), { timeout: 3500 }).toBe(testInput)
      await page.reload()
      await expect(await systemTestInput(page, width === 390)).toHaveValue(testInput)
      await switchWorkspace(page, width === 390, 'user')
      await expectPrompt(page, 'Draft stored while leaving the workspace')
    })

    test('warns about a reload while a draft cannot be written and retains it on cancel', async ({ page }) => {
      await page.addInitScript(name => {
        (window as Window & { __TEST_DB_NAME__?: string }).__TEST_DB_NAME__ = name
      }, 'test-autosave-guard-' + width + '-' + Date.now())
      await page.goto('/#/basic/user')
      await expect(page.getByTestId('basic-user-input')).toBeVisible()
      await page.evaluate(() => new Promise<void>(ready => {
        void navigator.locks.request('prompt-optimizer:workspace-persistence', { mode: 'exclusive' }, () =>
          new Promise<void>(release => {
            Object.assign(window, { releaseTestWorkspaceLock: release })
            ready()
          }),
        )
      }))
      await editPrompt(page, 'Unsaved draft retained when refresh is cancelled')
      const editor = page.getByTestId('basic-user-input')
      if (await editor.locator('textarea').count()) await editor.locator('textarea').first().click()
      else await editor.locator('.cm-content').click()

      const prompt = page.waitForEvent('dialog', { timeout: 3500 })
      const reload = page.reload({ timeout: 4000 }).catch(() => {})
      const confirmation = await prompt
      expect(confirmation.type()).toBe('beforeunload')
      await confirmation.dismiss()
      await expectPrompt(page, 'Unsaved draft retained when refresh is cancelled')
      await reload
      await page.evaluate(() => {
        (window as Window & { releaseTestWorkspaceLock?: () => void }).releaseTestWorkspaceLock?.()
      })
    })
  })
}
