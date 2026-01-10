import { expect, type Page } from '@playwright/test'

/**
 * 工作区模式类型
 */
export type WorkspaceMode =
  | 'basic-system'
  | 'basic-user'
  | 'image-text2image'
  | 'image-image2image'
  | 'pro-multi'
  | 'pro-variable'

/**
 * 评估类型
 * - 'prompt-only': 仅提示词评估（分析功能）
 * - 'original': 原始提示词评估
 * - 'optimized': 优化后提示词评估
 */
export type EvaluationType = 'prompt-only' | 'original' | 'optimized'

/**
 * 获取指定模式的工作区容器
 * 使用 data-testid 和 data-mode 精确定位
 *
 * @param page Playwright Page 对象
 * @param mode 工作区模式（'basic-system' | 'basic-user'）
 * @returns 工作区定位器
 *
 * @example
 * ```typescript
 * const workspace = getWorkspace(page, 'basic-system')
 * ```
 */
export function getWorkspace(page: Page, mode: WorkspaceMode) {
  return page.locator(`[data-testid="workspace"][data-mode="${mode}"]`)
}

/**
 * 填写原始提示词
 * 使用 data-testid 精确定位输入框，不依赖文本内容
 *
 * @param page Playwright Page 对象
 * @param mode 工作区模式
 * @param value 提示词内容
 *
 * @example
 * ```typescript
 * await fillOriginalPrompt(page, 'basic-system', '写一个排序算法')
 * ```
 */
export async function fillOriginalPrompt(
  page: Page,
  mode: WorkspaceMode,
  value: string
): Promise<void> {
  const workspace = getWorkspace(page, mode)

  // 使用 testIdPrefix 动态生成的 data-testid 精确定位
  const input = workspace.locator(`[data-testid="${mode}-input"]`)
  await expect(input).toBeVisible({ timeout: 15000 })

  // 支持两种输入方式：CodeMirror 和 NInput
  const cmContent = input.locator('.cm-content')
  if ((await cmContent.count()) > 0) {
    // CodeMirror 输入
    await cmContent.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type(value)
  } else {
    // Naive UI NInput textarea
    const textarea = input.locator('textarea')
    await textarea.fill(value)
  }

  // 等待 v-model 更新：分析按钮由禁用变为可用
  const analyzeButton = workspace.locator(`[data-testid="${mode}-analyze-button"]`)
  await expect(analyzeButton).toBeEnabled({ timeout: 15000 })
}

/**
 * 点击分析按钮
 * 使用 data-testid 精确定位，不依赖按钮文本
 *
 * @param page Playwright Page 对象
 * @param mode 工作区模式
 *
 * @example
 * ```typescript
 * await clickAnalyzeButton(page, 'basic-system')
 * ```
 */
export async function clickAnalyzeButton(
  page: Page,
  mode: WorkspaceMode
): Promise<void> {
  const workspace = getWorkspace(page, mode)

  // 使用 testIdPrefix 动态生成的 data-testid 精确定位
  const button = workspace.locator(`[data-testid="${mode}-analyze-button"]`)
  await expect(button).toBeVisible({ timeout: 15000 })
  await expect(button).toBeEnabled({ timeout: 15000 })

  await button.click()
}

/**
 * 获取评估分数
 * 使用组合 data-testid 精确定位（score-badge-{type}）
 *
 * @param page Playwright Page 对象
 * @param mode 工作区模式
 * @param evalType 评估类型（默认为 'prompt-only'，即分析功能）
 * @returns 分数（0-100）
 *
 * @example
 * ```typescript
 * // 分析功能（默认）
 * const score = await getEvaluationScore(page, 'basic-system')
 * // 优化功能
 * const score = await getEvaluationScore(page, 'basic-system', 'optimized')
 * ```
 */
export async function getEvaluationScore(
  page: Page,
  mode: WorkspaceMode,
  evalType: EvaluationType = 'prompt-only'
): Promise<number> {
  const workspace = getWorkspace(page, mode)

  // 使用组合 testid 精确定位：score-badge-analysis, score-badge-original
  const scoreBadge = workspace.locator(`[data-testid="score-badge-${evalType}"]`)
  await expect(scoreBadge).toBeVisible({ timeout: 90000 })

  // 等待加载完成
  await expect(scoreBadge).not.toHaveClass(/loading/, { timeout: 60000 })

  // 获取分数值
  const scoreValue = scoreBadge.locator('[data-testid="score-value"]')
  await expect(scoreValue).toBeVisible({ timeout: 10000 })

  const scoreText = await scoreValue.textContent()
  const score = parseInt(scoreText?.trim() || '0')

  // 验证分数范围
  expect(score).toBeGreaterThan(0)
  expect(score).toBeLessThanOrEqual(100)

  return score
}

/**
 * 验证分析按钮在输入为空时禁用
 *
 * @param page Playwright Page 对象
 * @param mode 工作区模式
 */
export async function verifyAnalyzeButtonDisabledWhenEmpty(
  page: Page,
  mode: WorkspaceMode
): Promise<void> {
  const workspace = getWorkspace(page, mode)
  const button = workspace.locator(`[data-testid="${mode}-analyze-button"]`)

  await expect(button).toBeVisible({ timeout: 15000 })
  await expect(button).toBeDisabled()
}
