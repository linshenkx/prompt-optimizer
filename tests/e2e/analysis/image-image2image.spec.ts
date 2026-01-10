import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickAnalyzeButton,
  getEvaluationScore,
  verifyAnalyzeButtonDisabledWhenEmpty
} from '../helpers/analysis'

/**
 * Image Image2Image 模式 - 提示词分析测试
 *
 * ✨ 最佳范式示例：
 * - 使用 data-testid 精确定位，不依赖文本内容
 * - 容器隔离：通过 data-mode 区分不同工作区
 * - 类型安全：使用 TypeScript 类型定义
 *
 * 功能：分析图生图提示词并显示评估分数
 *
 * 前提：
 * - .env.local 已配置 API keys
 * - 实际调用 LLM API（会产生费用）
 *
 * 测试流程：
 * 1. 导航到 image-image2image 工作区
 * 2. 填写图生图提示词
 * 3. 点击"分析"按钮
 * 4. 等待 LLM 响应
 * 5. 验证评估结果和分数显示
 *
 * 注意：本测试仅测试提示词分析功能，不涉及图片上传
 */

const MODE = 'image-image2image' as const

test.describe('Image Image2Image - 提示词分析', () => {
  test('分析提示词并显示评估结果', async ({ page }) => {
    test.setTimeout(180000) // 3分钟超时

    // 1. 导航到 image-image2image 工作区
    await navigateToMode(page, 'image', 'image2image')

    // 2. 等待服务和组件完全初始化

    // 3. 填写图生图提示词（使用 data-testid 定位）
    const testPrompt = 'Convert to watercolor painting style, soft colors, artistic brush strokes'
    await fillOriginalPrompt(page, MODE, testPrompt)

    // 4. 点击分析按钮（使用 data-testid 定位）
    await clickAnalyzeButton(page, MODE)

    // 5. 验证评估分数（使用 data-testid 定位）
    const score = await getEvaluationScore(page, MODE)
  })

  test('验证分析按钮在没有提示词时禁用', async ({ page }) => {
    await navigateToMode(page, 'image', 'image2image')

    // 分析按钮应该在没有输入时禁用
    await verifyAnalyzeButtonDisabledWhenEmpty(page, MODE)
  })
})
