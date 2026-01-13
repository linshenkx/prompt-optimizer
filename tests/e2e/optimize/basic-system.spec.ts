import { test } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickOptimizeButton,
  expectOptimizedResultNotEmpty,
  verifyOptimizeButtonDisabledWhenEmpty
} from '../helpers/optimize'

const MODE = 'basic-system' as const

test.describe('Basic System - 提示词优化', () => {
  test('优化提示词并生成优化结果', async ({ page }) => {
    test.setTimeout(180000)

    await navigateToMode(page, 'basic', 'system')

    await fillOriginalPrompt(page, MODE, '写一个排序算法')
    await clickOptimizeButton(page, MODE)

    await expectOptimizedResultNotEmpty(page, MODE)
  })

  test('验证优化按钮在没有提示词时禁用', async ({ page }) => {
    await navigateToMode(page, 'basic', 'system')
    await verifyOptimizeButtonDisabledWhenEmpty(page, MODE)
  })
})
