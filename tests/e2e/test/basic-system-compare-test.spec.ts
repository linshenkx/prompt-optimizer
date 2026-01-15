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

    // 3) 确保对比模式开启（避免默认状态变化导致误点关闭）
    const compareToggle = page.getByTestId('basic-system-test-compare-toggle')
    const ariaChecked = await compareToggle.getAttribute('aria-checked').catch(() => null)
    if (ariaChecked !== 'true') {
      await compareToggle.click()
    }

    // 4) 点击 Test
    await page.getByTestId('basic-system-test-run').click()

    // 5) 断言两份输出均非空
    await expectOutputByTestIdNotEmpty(page, 'basic-system-test-original-output')
    await expectOutputByTestIdNotEmpty(page, 'basic-system-test-optimized-output')
  })
})
