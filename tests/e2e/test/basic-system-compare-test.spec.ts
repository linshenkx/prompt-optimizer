import { test } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickOptimizeButton,
  expectOptimizedResultNotEmpty,
  expectOutputByTestIdNotEmpty,
} from '../helpers/optimize'

const MODE = 'basic-system' as const

test.describe('Basic System - 测试（对比模式）', () => {
  test('先优化，再在对比模式下测试，原始/优化结果都非空', async ({ page }) => {
    test.setTimeout(240000)

    await navigateToMode(page, 'basic', 'system')

    // 1) 左侧优化
    await fillOriginalPrompt(page, MODE, '你是一个诗人')
    await clickOptimizeButton(page, MODE)
    await expectOptimizedResultNotEmpty(page, MODE)

    // 2) 右侧测试输入
    const testInput = page.getByTestId('basic-system-test-input').locator('textarea')
    await testInput.fill('写一首小诗，表达ai时代的迷茫')

    // 3) 确保列数为 2（避免默认列数变化导致额外请求，影响 VCR fixture 匹配）
    const workspace = page.locator('[data-testid="workspace"][data-mode="basic-system"]').first()
    // Naive UI 的 radio button 真实可点元素是 label；若 value=2 已默认选中，click 会因拦截重试而超时。
    await workspace.getByRole('radio', { name: '2' }).check()

    // 4) 点击 Run All（触发 A=Original + B=Latest 两列测试）
    await page.getByTestId('basic-system-test-run-all').click()

    // 5) 断言两份输出均非空
    await expectOutputByTestIdNotEmpty(page, 'basic-system-test-original-output')
    await expectOutputByTestIdNotEmpty(page, 'basic-system-test-optimized-output')
  })
})
