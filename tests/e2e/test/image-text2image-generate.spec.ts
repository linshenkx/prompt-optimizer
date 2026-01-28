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

async function openSelectAndWaitForVisibleOptions(page: any, select: any) {
  const visibleOptions = page.locator('.n-base-select-option:visible')

  const ensureOpen = async () => {
    await select.click()
    await expect.poll(async () => await visibleOptions.count(), { timeout: 20000 }).toBeGreaterThan(0)
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

    // 2) 确保列数为 2（避免默认列数变化导致额外请求，影响 VCR fixture 匹配）
    const workspace = page.locator('[data-testid="workspace"][data-mode="image-text2image"]').first()
    // Naive UI 的 radio button 真实可点元素是 label；若 value=2 已默认选中，click 会因拦截重试而超时。
    await workspace.getByRole('radio', { name: '2' }).check()

    // 3) 选择图像模型（A/B 两列都设置为 SiliconFlow，保证请求与 fixture 匹配）
    const originalModelSelect = page.getByTestId('image-text2image-test-original-model-select')
    const optimizedModelSelect = page.getByTestId('image-text2image-test-optimized-model-select')
    await expect(originalModelSelect).toBeVisible({ timeout: 20000 })
    await expect(optimizedModelSelect).toBeVisible({ timeout: 20000 })
    await selectOption(page, originalModelSelect, /siliconflow/i)
    await selectOption(page, optimizedModelSelect, /siliconflow/i)

    // 4) 运行两列生成（original + optimized）
    await page.getByTestId('image-text2image-test-run-all').click()

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
