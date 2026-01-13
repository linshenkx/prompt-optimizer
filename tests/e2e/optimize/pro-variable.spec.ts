import { test } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickOptimizeButton,
  expectOptimizedResultNotEmpty,
  verifyOptimizeButtonDisabledWhenEmpty
} from '../helpers/optimize'

const MODE = 'pro-variable' as const

test.describe('Pro Variable - 提示词优化', () => {
  test('优化带变量的提示词并生成优化结果', async ({ page }) => {
    test.setTimeout(180000)

    await navigateToMode(page, 'pro', 'variable')

    const prompt = '请根据{{任务描述}}，为{{目标用户}}编写一份{{文档类型}}，要求{{质量要求}}'
    await fillOriginalPrompt(page, MODE, prompt)
    await clickOptimizeButton(page, MODE)

    await expectOptimizedResultNotEmpty(page, MODE)
  })

  test('验证优化按钮在没有提示词时禁用', async ({ page }) => {
    await navigateToMode(page, 'pro', 'variable')
    await verifyOptimizeButtonDisabledWhenEmpty(page, MODE)
  })
})
