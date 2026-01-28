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

    // 2) 确保列数为 2（避免默认列数变化导致额外请求，影响 VCR fixture 匹配）
    const workspace = page.locator('[data-testid="workspace"][data-mode="basic-user"]').first()
    // Naive UI 的 radio button 真实可点元素是 label；若 value=2 已默认选中，click 会因拦截重试而超时。
    await workspace.getByRole('radio', { name: '2' }).check()

    // 3) 直接点击 Run All（不填写测试内容）
    await page.getByTestId('basic-user-test-run-all').click()

    // 4) 断言两份输出均非空
    await expectOutputByTestIdNotEmpty(page, 'basic-user-test-original-output')
    await expectOutputByTestIdNotEmpty(page, 'basic-user-test-optimized-output')
  })
})
