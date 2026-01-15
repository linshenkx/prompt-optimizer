import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import { fillOriginalPrompt, clickOptimizeButton, expectOptimizedResultNotEmpty } from '../helpers/optimize'
import * as path from 'path'

const MODE = 'image-image2image' as const

async function openSelectAndWaitForVisibleOptions(page: any, select: any) {
  const visibleOptions = page.locator('.n-base-select-option:visible')

  const ensureOpen = async () => {
    await select.click()
    await expect
      .poll(async () => await visibleOptions.count(), { timeout: 20000 })
      .toBeGreaterThan(0)
  }

  try {
    await ensureOpen()
  } catch {
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(200)
    await ensureOpen()
  }

  return visibleOptions
}

async function selectOption(page: any, select: any, matcher?: RegExp) {
  const options = await openSelectAndWaitForVisibleOptions(page, select)

  if (!matcher) {
    await options.first().click()
    return
  }

  const target = options.filter({ hasText: matcher }).first()
  if ((await target.count()) > 0) {
    await target.click()
    return
  }

  // Fallback: pick the first visible option.
  await options.first().click()
}

test.describe('Image Image2Image - 生成（SiliconFlow）', () => {
  test('上传输入图并在对比模式下生成 original+optimized 两张图', async ({ page }) => {
    test.setTimeout(900000)

    await navigateToMode(page, 'image', 'image2image')

    // 1) 打开上传弹窗并上传输入图
    await page.getByTestId('image-image2image-open-upload').click()

    const upload = page.getByTestId('image-image2image-upload')
    const fileInput = upload.locator('input[type="file"]')

    const seedPath = path.join(process.cwd(), 'tests/e2e/fixtures/images/text2image-output.png')
    await fileInput.setInputFiles(seedPath)

    // 等待缩略图出现，说明 session 已注入 inputImage
    await expect(page.getByTestId('image-image2image-input-preview')).toBeVisible({ timeout: 30000 })

    // 关闭 modal：不强依赖具体 DOM 结构，尽量退回到主界面继续
    await page.keyboard.press('Escape').catch(() => {})

    // 等待上传弹窗彻底关闭，避免残留遮罩层/动画拦截后续点击
    await expect(page.getByTestId('image-image2image-upload-modal')).toBeHidden({ timeout: 20000 })

    // 2) 选择文本模型（用于优化）
    const textModelSelect = page.getByTestId('image-image2image-text-model-select')
    await expect(textModelSelect).toBeVisible({ timeout: 20000 })
    await selectOption(page, textModelSelect)

    // 3) 选择优化模板（跳过）
    // 这里不强依赖具体模板（模板列表可能变化，且 focus 会触发刷新导致下拉抖动），
    // 只验证主流程：上传 → 优化 → 对比生成两张图。

    // 4) 填写提示词（复用 helper：支持 textarea/CodeMirror，并在输入后等待 optimize-button 可用）
    await fillOriginalPrompt(page, MODE, 'make it watercolor style')

    // 5) 点击优化并等待优化输出非空
    await clickOptimizeButton(page, MODE)
    await expectOptimizedResultNotEmpty(page, MODE)

    // 6) 选择图像模型：siliconflow
    const modelSelect = page.getByTestId('image-image2image-image-model-select')
    await expect(modelSelect).toBeVisible({ timeout: 20000 })

    await selectOption(page, modelSelect, /siliconflow/i)

    // 7) 打开对比模式
    const compareToggle = page.getByTestId('image-image2image-generate-compare-toggle')
    const ariaChecked = await compareToggle.getAttribute('aria-checked').catch(() => null)
    if (ariaChecked !== 'true') {
      await compareToggle.click()
    }

    // 8) 点击生成
    await page.getByTestId('image-image2image-generate-button').click()

    // 9) 断言两张结果图都非空
    const originalImg = page.getByTestId('image-image2image-original-image').locator('img')
    const optimizedImg = page.getByTestId('image-image2image-optimized-image').locator('img')

    await expect
      .poll(async () => (await originalImg.getAttribute('src')) || '', { timeout: 240000 })
      .toMatch(/^data:image\/(png|jpeg);base64,|^https?:\/\//)

    await expect
      .poll(async () => (await optimizedImg.getAttribute('src')) || '', { timeout: 240000 })
      .toMatch(/^data:image\/(png|jpeg);base64,|^https?:\/\//)
  })
})
