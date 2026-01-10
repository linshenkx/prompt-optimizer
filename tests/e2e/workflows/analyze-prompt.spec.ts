import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'

type RouteCase = {
  name: string
  mode: 'basic' | 'pro' | 'image'
  subMode: string
  hashPath: string
  modelLabel: RegExp
  templateLabel: RegExp
}

const ROUTES: RouteCase[] = [
  {
    name: 'basic-system',
    mode: 'basic' as const,
    subMode: 'system' as const,
    hashPath: '/#/basic/system',
    modelLabel: /优化模型|Optimization Model/i,
    templateLabel: /优化提示词模板|Optimization Template/i,
  },
  {
    name: 'basic-user',
    mode: 'basic' as const,
    subMode: 'user' as const,
    hashPath: '/#/basic/user',
    modelLabel: /优化模型|Optimization Model/i,
    templateLabel: /优化提示词模板|Optimization Template/i,
  },
  {
    name: 'pro-multi',
    mode: 'pro' as const,
    subMode: 'multi' as const,
    hashPath: '/#/pro/multi',
    modelLabel: /优化模型|Optimization Model/i,
    templateLabel: /优化提示词模板|Optimization Template/i,
  },
  {
    name: 'pro-variable',
    mode: 'pro' as const,
    subMode: 'variable' as const,
    hashPath: '/#/pro/variable',
    modelLabel: /优化模型|Optimization Model/i,
    templateLabel: /优化提示词模板|Optimization Template/i,
  },
  {
    name: 'image-text2image',
    mode: 'image' as const,
    subMode: 'text2image' as const,
    hashPath: '/#/image/text2image',
    modelLabel: /Text Model|文本模型|优化模型|Optimization Model/i,
    templateLabel: /Optimization Template|优化.*模板/i,
  },
  {
    name: 'image-image2image',
    mode: 'image' as const,
    subMode: 'image2image' as const,
    hashPath: '/#/image/image2image',
    modelLabel: /Text Model|文本模型|优化模型|Optimization Model/i,
    templateLabel: /Optimization Template|优化.*模板/i,
  },
]

/**
 * 验证下拉框有选项
 * @description 检查 Naive UI Select 组件是否渲染了选项
 */
async function expectSelectHasOptions(page: Parameters<typeof test>[0]['page'], label: RegExp): Promise<void> {
  const labelNode = page.getByText(label).first()
  await expect(labelNode).toBeVisible({ timeout: 15000 })

  // 找到包含该 label 的最近选择器容器（Naive UI NSelect 会渲染 .n-base-selection）
  const container = labelNode.locator(
    'xpath=ancestor::*[.//div[contains(@class,"n-base-selection")]][1]'
  )
  const select = container.locator('.n-base-selection').first()

  await expect(select).toBeVisible({ timeout: 15000 })
  await select.click()

  // 有选项时会渲染 .n-base-select-option；空态会渲染 empty slot
  const firstOption = page.locator('.n-base-select-option').first()
  await expect(firstOption).toBeVisible({ timeout: 15000 })

  const optionCount = await page.locator('.n-base-select-option').count()
  expect(optionCount).toBeGreaterThan(0)

  await page.keyboard.press('Escape')
}

test.describe('Route Initialization: 模型/模板下拉框有值', () => {
  for (const route of ROUTES) {
    test(route.name, async ({ page }) => {
      // ✅ 使用 navigateToMode 导航（内部先访问根路径等待初始化）
      await navigateToMode(page, route.mode, route.subMode)

      // ✅ 验证模型和模板下拉框都加载了选项
      await expectSelectHasOptions(page, route.modelLabel)
      await expectSelectHasOptions(page, route.templateLabel)
    })
  }
})
