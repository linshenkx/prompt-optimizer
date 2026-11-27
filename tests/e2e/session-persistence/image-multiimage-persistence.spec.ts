import { resolve } from 'node:path'

import type { Locator } from '@playwright/test'

import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import { selectModelConfiguration } from '../helpers/model-selector'
import { readOutputByTestIdText } from '../helpers/optimize'

async function fillMultiImagePrompt(workspace: Locator, value: string) {
  const input = workspace.getByTestId('image-multiimage-input')
  await expect(input).toBeVisible({ timeout: 30000 })

  const cmContent = input.locator('.cm-content').first()
  if ((await cmContent.count()) > 0) {
    await cmContent.click()
    await workspace.page().keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await workspace.page().keyboard.type(value)
    return
  }

  await input.locator('textarea').first().fill(value)
}

async function expectMultiImagePromptValue(
  workspace: Locator,
  value: string,
) {
  const input = workspace.getByTestId('image-multiimage-input')

  await expect.poll(async () => {
    const textarea = input.locator('textarea').first()
    if ((await textarea.count()) > 0) {
      return textarea.inputValue()
    }

    const cmContent = input.locator('.cm-content').first()
    if ((await cmContent.count()) > 0) {
      if ((await cmContent.locator('.cm-placeholder').count()) > 0) {
        return ''
      }
      return (await cmContent.innerText()).trim()
    }

    return ''
  }, { timeout: 30000 }).toBe(value)
}

test.describe('Image MultiImage - Session Persistence', () => {
  test('sends resized copies and keeps the originals and last result after cancelling a retry', async ({ page }) => {
    const baseURL = 'https://multiimage.example.invalid/v1'
    const model = 'fixture-vision'
    const reply = 'Keep the wide red landscape behind the blue foreground.'
    const sentImages: string[][] = []
    await page.route('**/config.js', route => route.fulfill({
      contentType: 'application/javascript',
      body: `window.runtime_config = ${JSON.stringify({ CUSTOM_API_KEY: 'fixture', CUSTOM_API_BASE_URL: baseURL, CUSTOM_API_MODEL: model })}`,
    }))
    await page.route(`${baseURL}/models`, route => route.fulfill({ json: { data: [{ id: model }] } }))
    await page.route(`${baseURL}/chat/completions`, route => {
      const messages = route.request().postDataJSON().messages
      const parts: { type: string; image_url?: { url: string } }[] = messages.find((m: { role: string }) => m.role === 'user').content
      sentImages.push(parts.flatMap(part => part.image_url ? [part.image_url.url] : []))
      const chunk = { choices: [{ index: 0, delta: { content: reply }, finish_reason: null }] }
      return route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n` })
    })

    await navigateToMode(page, 'image', 'multiimage')
    const workspace = page.locator('[data-mode="image-multiimage"]')
    await selectModelConfiguration(page, workspace.getByTestId('image-multiimage-text-model-select'), /custom/i)
    await fillMultiImagePrompt(workspace, 'Combine these two reference images.')
    const originals = await page.evaluate(() => [4096, 32].map((width, i) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = 32
      const context = canvas.getContext('2d')!
      context.fillStyle = i === 0 ? 'red' : 'blue'
      context.fillRect(0, 0, width, 32)
      return canvas.toDataURL('image/png')
    }))
    await workspace.locator('input[type="file"]').first().setInputFiles(originals.map((url, i) => ({
      name: `reference-${i + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(url.split(',')[1], 'base64'),
    })))
    const previews = workspace.getByTestId('image-multiimage-card-list').locator('.image-card__preview img')
    const previewSources = () => previews.evaluateAll(images => images.map(img => img.getAttribute('src')))
    await expect.poll(previewSources).toEqual(originals)

    const optimize = workspace.getByTestId('image-multiimage-optimize')
    const dialog = page.getByRole('dialog')
    const output = () => readOutputByTestIdText(page, 'image-multiimage-output')
    await optimize.click()
    await expect(dialog).toContainText('2048×16')
    await dialog.getByRole('button', { name: /Process and continue|处理并继续|處理並繼續/i }).click()
    await expect.poll(output).toBe(reply)
    expect(sentImages).toHaveLength(1)
    expect(sentImages[0]).toHaveLength(2)
    const resized = Buffer.from(sentImages[0][0].split(',')[1], 'base64')
    expect([resized.readUInt32BE(16), resized.readUInt32BE(20)]).toEqual([2048, 16])
    expect(sentImages[0][1]).toBe(originals[1])
    await expect.poll(previewSources).toEqual(originals)
    await expect(workspace.getByTestId('prompt-panel-version-tag-v1')).toBeVisible()

    await page.reload()
    await expect.poll(previewSources).toEqual(originals)
    await expect.poll(output).toBe(reply)
    await optimize.click()
    await dialog.getByRole('button', { name: /Cancel|取消/i }).click()
    await expect(optimize).toBeEnabled()
    await expect.poll(output).toBe(reply)
    expect(sentImages).toHaveLength(1)
    await expect.poll(previewSources).toEqual(originals)
  })

  test('refresh keeps prompt, uploaded image count and test column selection', async ({ page }) => {
    test.setTimeout(120000)

    await navigateToMode(page, 'image', 'multiimage')

    const workspace = page.locator('[data-mode="image-multiimage"]').first()
    await expect(workspace).toBeVisible({ timeout: 20000 })

    await fillMultiImagePrompt(workspace, '请把图1的人物放到图2的城市背景里，保持电影感')

    const fileInput = workspace.locator('input[type="file"]').first()
    await fileInput.setInputFiles([
      resolve(process.cwd(), 'tests/e2e/fixtures/images/text2image-output.png'),
      resolve(process.cwd(), 'packages/desktop/icons/app-icon.png'),
    ])

    await expect(workspace.getByTestId('image-multiimage-card-1')).toBeVisible({ timeout: 20000 })
    await expect(workspace.getByTestId('image-multiimage-card-2')).toBeVisible({ timeout: 20000 })

    await workspace.getByTestId('image-multiimage-columns-3').click()
    await expect(workspace.getByRole('radio', { name: '3' })).toBeChecked()

    await page.reload()
    await page.waitForLoadState('networkidle')

    const workspaceAfter = page.locator('[data-mode="image-multiimage"]').first()
    await expect(workspaceAfter).toBeVisible({ timeout: 20000 })

    await expectMultiImagePromptValue(workspaceAfter, '请把图1的人物放到图2的城市背景里，保持电影感')
    await expect(workspaceAfter.getByTestId('image-multiimage-card-1')).toBeVisible({ timeout: 20000 })
    await expect(workspaceAfter.getByTestId('image-multiimage-card-2')).toBeVisible({ timeout: 20000 })
    await expect(workspaceAfter.getByRole('radio', { name: '3' })).toBeChecked()
  })
})
