import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect } from '../fixtures'

test.describe('image upload compression', () => {
  test('automatically compresses an image larger than 10MB before storing it', async ({ page }) => {
    await page.goto('/#/image/image2image')
    await expect(page.locator('.loading-container')).toHaveCount(0, { timeout: 15_000 })

    await expect(page.getByText(/Supports PNG\/JPEG up to 50MB/)).toBeVisible()

    const fixture = readFileSync(resolve(
      process.cwd(),
      'tests/e2e/fixtures/images/text2image-output.png',
    ))
    const oversizedImage = Buffer.concat([
      fixture,
      Buffer.alloc(10 * 1024 * 1024 + 1),
    ])

    await page
      .getByTestId('image-image2image-upload')
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'oversized-reference.png',
        mimeType: 'image/png',
        buffer: oversizedImage,
      })

    await expect(page.getByText(/Image prepared for model compatibility:/)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('image-image2image-input-preview')).toBeVisible({ timeout: 30_000 })

    const storedImage = await page.evaluate(() => {
      const app = (document.querySelector('#app') as any)?.__vue_app__
      const session = app?.config?.globalProperties?.$pinia?.state?.value?.imageImage2ImageSession
      return {
        base64Length: session?.inputImageB64?.length || 0,
        mimeType: session?.inputImageMime || '',
      }
    })

    expect(storedImage.base64Length).toBeGreaterThan(0)
    expect(storedImage.base64Length).toBeLessThan((10 * 1024 * 1024 * 4) / 3)
    expect(storedImage.mimeType).toBe('image/png')
  })

  test('asks before a material resize and leaves the session unchanged when cancelled', async ({ page }) => {
    await page.goto('/#/image/image2image')
    await expect(page.locator('.loading-container')).toHaveCount(0, { timeout: 15_000 })

    const highResolutionPng = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 6000
      canvas.height = 100
      const context = canvas.getContext('2d')!
      context.fillStyle = '#3366ff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/png').split(',')[1]
    })

    await page
      .getByTestId('image-image2image-upload')
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'high-resolution.png',
        mimeType: 'image/png',
        buffer: Buffer.from(highResolutionPng, 'base64'),
      })

    await expect(page.getByText('Confirm image processing')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByTestId('image-image2image-input-preview')).toHaveCount(0)

    const storedBase64Length = await page.evaluate(() => {
      const app = (document.querySelector('#app') as any)?.__vue_app__
      const session = app?.config?.globalProperties?.$pinia?.state?.value?.imageImage2ImageSession
      return session?.inputImageB64?.length || 0
    })
    expect(storedBase64Length).toBe(0)
  })

  test('stores the prepared image only after material resize is confirmed', async ({ page }) => {
    await page.goto('/#/image/image2image')
    await expect(page.locator('.loading-container')).toHaveCount(0, { timeout: 15_000 })

    const highResolutionPng = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 6000
      canvas.height = 100
      const context = canvas.getContext('2d')!
      context.fillStyle = '#3366ff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/png').split(',')[1]
    })

    await page
      .getByTestId('image-image2image-upload')
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'high-resolution.png',
        mimeType: 'image/png',
        buffer: Buffer.from(highResolutionPng, 'base64'),
      })

    await expect(page.getByText('Confirm image processing')).toBeVisible()
    await page.getByRole('button', { name: 'Process and continue' }).click()
    await expect(page.getByTestId('image-image2image-input-preview')).toBeVisible({ timeout: 30_000 })

    const storedImage = await page.evaluate(() => {
      const app = (document.querySelector('#app') as any)?.__vue_app__
      const session = app?.config?.globalProperties?.$pinia?.state?.value?.imageImage2ImageSession
      return {
        base64Length: session?.inputImageB64?.length || 0,
        mimeType: session?.inputImageMime || '',
      }
    })
    expect(storedImage.base64Length).toBeGreaterThan(0)
    expect(storedImage.mimeType).toBe('image/png')
  })
})
