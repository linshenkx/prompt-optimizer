import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import { fillOriginalPrompt, clickOptimizeButton, expectOptimizedResultNotEmpty } from '../helpers/optimize'
import * as path from 'path'

const MODE = 'image-image2image' as const

async function openSelectAndWaitForVisibleOptions(page: any, select: any) {
  const visibleMenu = page.locator('.swc-select-menu').last()
  const visibleOptions = visibleMenu.locator('.n-base-select-option')

  const ensureOpen = async () => {
    await select.click()
    await expect(visibleMenu).toBeVisible({ timeout: 20000 })
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
  // Naive UI 下拉选项存在动画/重渲染，直接 click 可能卡在“not stable / not visible”重试直到 test 超时。
  // 这里做两次尝试：失败则收起下拉并重开；第二次使用 force click。
  for (let attempt = 0; attempt < 2; attempt++) {
    const options = await openSelectAndWaitForVisibleOptions(page, select)

    if (!matcher) {
      await options.first().click({ timeout: 20000, force: attempt > 0 })
      return
    }

    const target = options.filter({ hasText: matcher }).first()
    if ((await target.count()) === 0) {
      // 明确失败：图像模型必须命中 SiliconFlow，否则会导致 VCR requestHash 不匹配。
      await page.keyboard.press('Escape').catch(() => {})
      throw new Error(`[E2E] selectOption: option not found for matcher: ${String(matcher)}`)
    }

    try {
      await target.click({ timeout: 20000, force: attempt > 0 })
      await expect.poll(async () => (await select.textContent()) || '', { timeout: 10000 }).toMatch(matcher)
      return
    } catch {
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(200)
    }
  }
}

async function selectPreferredMultimodalTextModel(page: any, select: any) {
  const preferredMatchers = [/qwen3\.5-27b/i, /qwen/i, /gemini/i, /阿里百炼|dashscope/i, /deepseek/i]

  for (const matcher of preferredMatchers) {
    const options = await openSelectAndWaitForVisibleOptions(page, select)
    const target = options.filter({ hasText: matcher }).first()

    if ((await target.count()) > 0) {
      await target.click({ timeout: 20000 })
      await expect.poll(async () => (await select.textContent()) || '', { timeout: 10000 }).toMatch(matcher)
      return
    }

    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(200)
  }

  const options = await openSelectAndWaitForVisibleOptions(page, select)
  const optionTexts = (await options.allTextContents())
    .map((text: string) => text.trim())
    .filter(Boolean)
    .join(' | ')
  await page.keyboard.press('Escape').catch(() => {})
  throw new Error(
    `[E2E] image-image2image text model must support multimodal optimize; expected one of deepseek/qwen/gemini/dashscope, available options: ${optionTexts}`
  )
}

test.describe('Image Image2Image - 生成（SiliconFlow）', () => {
  test('上传输入图并在对比模式下生成 original+optimized 两张图', async ({ page }) => {
    test.setTimeout(900000)

    await navigateToMode(page, 'image', 'image2image')

    // 1) 上传输入图
    const upload = page.getByTestId('image-image2image-upload')
    const fileInput = upload.locator('input[type="file"]')

    const seedPath = path.join(process.cwd(), 'tests/e2e/fixtures/images/text2image-output.png')
    await fileInput.setInputFiles(seedPath)

    // 等待缩略图出现，说明 session 已注入 inputImage
    await expect(page.getByTestId('image-image2image-input-preview')).toBeVisible({ timeout: 30000 })

    // 2) 选择文本模型（用于优化）
    const textModelSelect = page.getByTestId('image-image2image-text-model-select')
    await expect(textModelSelect).toBeVisible({ timeout: 20000 })
    await selectPreferredMultimodalTextModel(page, textModelSelect)

    // 3) 选择优化模板（跳过）
    // 这里不强依赖具体模板（模板列表可能变化，且 focus 会触发刷新导致下拉抖动），
    // 只验证主流程：上传 → 优化 → 对比生成两张图。

    // 4) 填写提示词（复用 helper：支持 textarea/CodeMirror，并在输入后等待 optimize-button 可用）
    await fillOriginalPrompt(page, MODE, 'make it watercolor style')

    // 5) 点击优化并等待优化输出非空
    await clickOptimizeButton(page, MODE)
    await expectOptimizedResultNotEmpty(page, MODE)

    // 6) 确保列数为 2（避免默认列数变化导致额外请求，影响 VCR fixture 匹配）
    const workspace = page.locator('[data-testid="workspace"][data-mode="image-image2image"]').first()
    // Naive UI 的 radio button 真实可点元素是 label；若 value=2 已默认选中，click 会因拦截重试而超时。
    await workspace.getByRole('radio', { name: '2' }).check()

    // 7) 选择图像模型：A/B 两列都设置为 SiliconFlow，保证请求与 fixture 匹配
    const originalModelSelect = page.getByTestId('image-image2image-test-original-model-select')
    const optimizedModelSelect = page.getByTestId('image-image2image-test-optimized-model-select')
    await expect(originalModelSelect).toBeVisible({ timeout: 20000 })
    await expect(optimizedModelSelect).toBeVisible({ timeout: 20000 })
    await selectOption(page, originalModelSelect, /siliconflow/i)
    await selectOption(page, optimizedModelSelect, /siliconflow/i)
    await expect(originalModelSelect).toContainText(/siliconflow/i)
    await expect(optimizedModelSelect).toContainText(/siliconflow/i)

    // 8) 运行两列生成（original + optimized）
    await page.getByTestId('image-image2image-test-run-all').click()

    // 9) 断言两张结果图都非空
    const originalImg = page.getByTestId('image-image2image-original-image').locator('img')
    const optimizedImg = page.getByTestId('image-image2image-optimized-image').locator('img')

    await expect
      .poll(async () => (await originalImg.getAttribute('src')) || '', { timeout: 240000 })
      .toMatch(/^data:image\/|^https?:\/\//)

    await expect
      .poll(async () => (await optimizedImg.getAttribute('src')) || '', { timeout: 240000 })
      .toMatch(/^data:image\/|^https?:\/\//)

    if (process.env.E2E_VCR_MODE === 'replay') {
      const originalSrc = (await originalImg.getAttribute('src')) || ''
      const optimizedSrc = (await optimizedImg.getAttribute('src')) || ''
      expect(originalSrc).toMatch(/^data:image\//)
      expect(optimizedSrc).toMatch(/^data:image\//)
      expect(originalSrc).not.toMatch(/^https?:\/\//)
      expect(optimizedSrc).not.toMatch(/^https?:\/\//)
    }
  })
})
