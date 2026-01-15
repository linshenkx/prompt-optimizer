import { test } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickOptimizeButton,
  expectOptimizedResultNotEmpty,
  expectOutputByTestIdNotEmpty,
} from '../helpers/optimize'

const MODE = 'basic-user' as const

test.describe('Basic User - 测试（无需填写测试内容）', () => {
  test('优化后直接测试，原始/优化结果都非空', async ({ page }) => {
    test.setTimeout(240000)

    await navigateToMode(page, 'basic', 'user')

    // 1) 左侧优化
    await fillOriginalPrompt(page, MODE, '你是一个诗人')
    await clickOptimizeButton(page, MODE)
    await expectOptimizedResultNotEmpty(page, MODE)

    // 2) 对比模式开启（不依赖默认状态）
    const compareToggle = page.getByTestId('basic-user-test-compare-toggle')
    const ariaChecked = await compareToggle.getAttribute('aria-checked').catch(() => null)
    if (ariaChecked !== 'true') {
      await compareToggle.click()
    }

    // 3) 直接点击 Test（不填写测试内容）
    await page.getByTestId('basic-user-test-run').click()

    // 4) 断言两份输出均非空
    await expectOutputByTestIdNotEmpty(page, 'basic-user-test-original-output')
    await expectOutputByTestIdNotEmpty(page, 'basic-user-test-optimized-output')
  })
})
