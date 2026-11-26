import { test, expect } from '../fixtures'
import * as path from 'path'

test.describe('Image Image2Image - Session Persistence', () => {
  const gotoMode = async (page: any, route: string) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
  }

  const getInputImageState = async (page: any) =>
    page.evaluate(() => {
      const app = (document.querySelector('#app') as any)?.__vue_app__
      const session = app?.config?.globalProperties?.$pinia?.state?.value?.imageImage2ImageSession

      return {
        inputImageB64Len: session?.inputImageB64 ? session.inputImageB64.length : 0,
        inputImageId: session?.inputImageId || null,
        inputImageMime: session?.inputImageMime || '',
      }
    })

  test('上传输入图后刷新页面，预览和 session 都应该保留', async ({ page }) => {
    const seedPath = path.join(process.cwd(), 'tests/e2e/fixtures/images/text2image-output.png')

    await gotoMode(page, '/#/image/image2image')

    const upload = page.getByTestId('image-image2image-upload')
    await upload.locator('input[type="file"]').setInputFiles(seedPath)

    await expect(page.getByTestId('image-image2image-input-preview')).toBeVisible({ timeout: 30000 })

    const beforeReload = await getInputImageState(page)
    expect(beforeReload.inputImageB64Len).toBeGreaterThan(0)
    expect(beforeReload.inputImageMime).toBe('image/png')

    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    await expect(page.getByTestId('image-image2image-input-preview')).toBeVisible({ timeout: 30000 })

    const afterReload = await getInputImageState(page)
    expect(afterReload.inputImageB64Len).toBeGreaterThan(0)
    expect(afterReload.inputImageId).toBeTruthy()
    expect(afterReload.inputImageMime).toBe('image/png')
  })
})
