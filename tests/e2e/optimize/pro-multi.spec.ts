import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  addProMultiUserMessage,
  selectProMultiMessageForOptimization,
  clickProMultiOptimizeButton,
  expectOptimizedResultNotEmpty
} from '../helpers/optimize'

const MODE = 'pro-multi' as const

test.describe('Pro Multi - 提示词优化', () => {
  test('自动选择最新消息并优化，生成优化结果', async ({ page }) => {
    test.setTimeout(180000)

    await navigateToMode(page, 'pro', 'multi')

    // 初始状态：未选择消息时应该显示空提示（我们为它加了稳定 testid）
    await expect(page.getByTestId('pro-multi-empty-select-message')).toBeVisible({ timeout: 20000 })

    // 1) 添加一条用户消息
    await addProMultiUserMessage(page, '请帮我写一个项目周报，包含进度、风险、下周计划')

    // 2) Pro Multi 会自动选择最新消息进行优化
    await selectProMultiMessageForOptimization(page, 0)

    // 3) 点击 Pro Multi 的优化按钮
    await clickProMultiOptimizeButton(page)

    // 4) 验证右侧 PromptPanel 出现优化结果（不依赖文案）
    await expectOptimizedResultNotEmpty(page, MODE)
  })
})
