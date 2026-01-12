import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickAnalyzeButton,
  getEvaluationScore,
  verifyAnalyzeButtonDisabledWhenEmpty
} from '../helpers/analysis'

/**
 * Basic User 模式 - 提示词分析测试
 *
 * ✨ 最佳范式示例：
 * - 使用 data-testid 精确定位，不依赖文本内容
 * - 容器隔离：通过 data-mode 区分不同工作区
 * - 类型安全：使用 TypeScript 类型定义
 * - 代码复用：与 basic-system 使用相同的辅助函数
 *
 * 功能：分析用户提示词并显示评估分数
 *
 * 前提：
 * - .env.local 已配置 API keys
 * - 实际调用 LLM API（会产生费用）
 *
 * 测试流程：
 * 1. 导航到 basic-user 工作区
 * 2. 填写提示词
 * 3. 点击"分析"按钮
 * 4. 等待 LLM 响应
 * 5. 验证评估结果和分数显示
 */

const MODE = 'basic-user' as const

test.describe('Basic User - 提示词分析', () => {
  test('分析提示词并显示评估结果', async ({ page }) => {
    test.setTimeout(180000) // 3分钟超时

    // 1. 导航到 basic-user 工作区
    await navigateToMode(page, 'basic', 'user')

    // 2. 填写提示词（使用 data-testid 定位）
    const testPrompt = '帮我写一封邮件，关于项目进度汇报'
    await fillOriginalPrompt(page, MODE, testPrompt)

    // 3. 点击分析按钮（使用 data-testid 定位）
    await clickAnalyzeButton(page, MODE)

    // 4. 验证评估分数（使用 data-testid 定位）
    const score = await getEvaluationScore(page, MODE)
  })

  test('验证分析按钮在没有提示词时禁用', async ({ page }) => {
    await navigateToMode(page, 'basic', 'user')

    // 分析按钮应该在没有输入时禁用
    await verifyAnalyzeButtonDisabledWhenEmpty(page, MODE)
  })
})
