import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickOptimizeButton,
  expectOptimizedResultNotEmpty,
  verifyOptimizeButtonDisabledWhenEmpty
} from '../helpers/optimize'

const MODE = 'basic-user' as const

async function selectOptimizeModel(page: any, matcher: RegExp) {
  const modelLabel = page.getByText(/优化模型|Optimization Model/i).first()
  await expect(modelLabel).toBeVisible({ timeout: 20000 })

  const container = modelLabel.locator(
    'xpath=ancestor::*[.//div[contains(@class,"n-base-selection")]][1]'
  )
  const select = container.locator('.n-base-selection').first()
  await expect(select).toBeVisible({ timeout: 20000 })
  await select.click()

  const option = page.locator('.n-base-select-option').filter({ hasText: matcher }).first()
  await expect(option).toBeVisible({ timeout: 20000 })
  await option.click()
  await expect(select).toContainText(matcher)
}

test.describe('Basic User - 提示词优化', () => {
  test('优化提示词并生成优化结果', async ({ page }) => {
    test.setTimeout(180000)

    await navigateToMode(page, 'basic', 'user')
    // Pin the recorded provider so built-in default-model updates do not invalidate VCR replay.
    await selectOptimizeModel(page, /deepseek/i)

    await fillOriginalPrompt(page, MODE, '帮我写一封邮件，关于项目进度汇报')
    await clickOptimizeButton(page, MODE)

    await expectOptimizedResultNotEmpty(page, MODE)
  })

  test('验证优化按钮在没有提示词时禁用', async ({ page }) => {
    await navigateToMode(page, 'basic', 'user')
    await verifyOptimizeButtonDisabledWhenEmpty(page, MODE)
  })
})
