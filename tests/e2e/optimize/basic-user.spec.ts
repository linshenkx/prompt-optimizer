import { test } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickOptimizeButton,
  expectOptimizedResultNotEmpty,
  verifyOptimizeButtonDisabledWhenEmpty
} from '../helpers/optimize'

const MODE = 'basic-user' as const

test.describe('Basic User - 提示词优化', () => {
  test('优化提示词并生成优化结果', async ({ page }) => {
    test.setTimeout(180000)

    await navigateToMode(page, 'basic', 'user')

    await fillOriginalPrompt(page, MODE, '帮我写一封邮件，关于项目进度汇报')
    await clickOptimizeButton(page, MODE)

    await expectOptimizedResultNotEmpty(page, MODE)
  })

  test('验证优化按钮在没有提示词时禁用', async ({ page }) => {
    await navigateToMode(page, 'basic', 'user')
    await verifyOptimizeButtonDisabledWhenEmpty(page, MODE)
  })
})
