import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import { fillOriginalPrompt, clickOptimizeButton, expectOptimizedResultNotEmpty } from '../helpers/optimize'
import * as fs from 'fs/promises'
import * as path from 'path'

const MODE = 'image-text2image' as const

function isBase64DataUrl(src: string) {
  return /^data:image\/(png|jpeg);base64,/.test(src)
}

async function saveBase64DataUrlAsPng(dataUrl: string, outPath: string) {
  const base64 = dataUrl.split(',')[1] || ''
  const buf = Buffer.from(base64, 'base64')
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, buf)
}

test.describe('Image Text2Image - 生成（SiliconFlow）', () => {
  test('切换到 SiliconFlow 图像模型并生成图片（对比模式）', async ({ page }) => {
    // Record mode may be slow (two image generations); keep replay fast.
    test.setTimeout(900000)

    await navigateToMode(page, 'image', 'text2image')

    // 1) 输入提示词并优化（左侧）
    // 尽量保持 prompt 简短，避免生成的优化 prompt 过长导致图像模型失败/超时。
    await fillOriginalPrompt(page, MODE, 'corgi, studio photo')
    await clickOptimizeButton(page, MODE)
    await expectOptimizedResultNotEmpty(page, MODE)

    // 2) 选择图像模型（右侧）：过滤 siliconflow，选择第一项
    const modelSelect = page.getByTestId('image-text2image-image-model-select')
    await expect(modelSelect).toBeVisible({ timeout: 20000 })
    await modelSelect.click()

    // Naive UI 下拉选项：通过菜单文本匹配 siliconflow（不依赖具体模型名）
    const option = page.locator('.n-base-select-option').filter({ hasText: /siliconflow/i }).first()
    await expect(option).toBeVisible({ timeout: 20000 })
    await option.click()

    // 3) 打开对比模式：生成 original + optimized 两张图
    const compareToggle = page.getByTestId('image-text2image-generate-compare-toggle')
    const ariaChecked = await compareToggle.getAttribute('aria-checked').catch(() => null)
    if (ariaChecked !== 'true') {
      await compareToggle.click()
    }

    // 4) 点击生成
    await page.getByTestId('image-text2image-generate-button').click()

    // 5) 断言两份生成结果都非空（至少 img src 有值）
    const originalImg = page.getByTestId('image-text2image-original-image').locator('img')
    const optimizedImg = page.getByTestId('image-text2image-optimized-image').locator('img')

    let originalSrc = ''
    await expect
      .poll(async () => {
        originalSrc = (await originalImg.getAttribute('src')) || ''
        return originalSrc
      }, { timeout: 240000 })
      .toMatch(/^data:image\/(png|jpeg);base64,|^https?:\/\//)

    let optimizedSrc = ''
    await expect
      .poll(async () => {
        optimizedSrc = (await optimizedImg.getAttribute('src')) || ''
        return optimizedSrc
      }, { timeout: 240000 })
      .toMatch(/^data:image\/(png|jpeg);base64,|^https?:\/\//)

    // 在 record 模式下保存一张样例图供 image2image 上传复用。
    // 如果是 base64，直接落盘；如果是 URL（siliconflow 默认返回 url），则通过 Playwright 下载落盘。
    if (process.env.E2E_VCR_MODE === 'record') {
      const outPath = path.join(process.cwd(), 'tests/e2e/fixtures/images/text2image-output.png')

      if (isBase64DataUrl(optimizedSrc)) {
        await saveBase64DataUrlAsPng(optimizedSrc, outPath)
      } else if (optimizedSrc.startsWith('http')) {
        const res = await page.request.get(optimizedSrc)
        if (res.ok()) {
          const buf = await res.body()
          await fs.mkdir(path.dirname(outPath), { recursive: true })
          await fs.writeFile(outPath, buf)
        }
      }

      // If still missing, keep a url marker for debugging.
      try {
        await fs.access(outPath)
      } catch {
        if (optimizedSrc) {
          await fs.mkdir(path.dirname(outPath), { recursive: true })
          await fs.writeFile(outPath + '.url.txt', optimizedSrc, 'utf-8')
        }
      }
    }
  })
})
