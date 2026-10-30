import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import { selectModelConfiguration } from '../helpers/model-selector'
import { fillOriginalPrompt, clickOptimizeButton, expectOptimizedResultNotEmpty } from '../helpers/optimize'
import * as fs from 'fs/promises'
import * as path from 'path'

const MODE = 'image-text2image' as const

function isBase64DataUrl(src: string) {
  return /^data:image\//.test(src)
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

    // 1) 选择文本模型（用于优化），避免不同环境默认模型不同导致 VCR requestHash 不稳定。
    const textModelSelect = page.getByTestId('image-text2image-text-model-select')
    await expect(textModelSelect).toBeVisible({ timeout: 20000 })
    await selectModelConfiguration(page, textModelSelect, /deepseek/i)

    // 2) 输入提示词并优化（左侧）
    // 尽量保持 prompt 简短，避免生成的优化 prompt 过长导致图像模型失败/超时。
    await fillOriginalPrompt(page, MODE, 'corgi, studio photo')
    await clickOptimizeButton(page, MODE)
    await expectOptimizedResultNotEmpty(page, MODE)

    // 3) 确保列数为 2（避免默认列数变化导致额外请求，影响 VCR fixture 匹配）
    const workspace = page.locator('[data-testid="workspace"][data-mode="image-text2image"]').first()
    // Naive UI 的 radio button 真实可点元素是 label；若 value=2 已默认选中，click 会因拦截重试而超时。
    await workspace.getByRole('radio', { name: '2' }).check()

    // 4) 选择图像模型（A/B 两列都设置为 SiliconFlow，保证请求与 fixture 匹配）
    const originalModelSelect = page.getByTestId('image-text2image-test-original-model-select')
    const optimizedModelSelect = page.getByTestId('image-text2image-test-optimized-model-select')
    await expect(originalModelSelect).toBeVisible({ timeout: 20000 })
    await expect(optimizedModelSelect).toBeVisible({ timeout: 20000 })
    await selectModelConfiguration(page, originalModelSelect, /siliconflow/i)
    await selectModelConfiguration(page, optimizedModelSelect, /siliconflow/i)
    await expect(originalModelSelect).toContainText(/siliconflow/i)
    await expect(optimizedModelSelect).toContainText(/siliconflow/i)

    // 5) 运行两列生成（original + optimized）
    await page.getByTestId('image-text2image-test-run-all').click()

    // 6) 断言两份生成结果都非空（至少 img src 有值）
    const originalImg = page.getByTestId('image-text2image-original-image').locator('img')
    const optimizedImg = page.getByTestId('image-text2image-optimized-image').locator('img')

    let originalSrc = ''
    await expect
      .poll(async () => {
        originalSrc = (await originalImg.getAttribute('src')) || ''
        return originalSrc
      }, { timeout: 240000 })
      .toMatch(/^data:image\/|^https?:\/\//)

    let optimizedSrc = ''
    await expect
      .poll(async () => {
        optimizedSrc = (await optimizedImg.getAttribute('src')) || ''
        return optimizedSrc
      }, { timeout: 240000 })
      .toMatch(/^data:image\/|^https?:\/\//)

    if (process.env.E2E_VCR_MODE === 'replay') {
      expect(originalSrc).toMatch(/^data:image\//)
      expect(optimizedSrc).toMatch(/^data:image\//)
      expect(originalSrc).not.toMatch(/^https?:\/\//)
      expect(optimizedSrc).not.toMatch(/^https?:\/\//)
    }

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
