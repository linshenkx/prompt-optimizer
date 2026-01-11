import { test, expect } from '../fixtures'

/**
 * Basic User 模式 - Session 持久化测试
 *
 * 测试场景：
 * 1. 切换优化模型后刷新，验证选择是否保留（通过 UI 验证）
 * 2. 切换模板后刷新，验证选择是否保留（通过 UI 验证）
 *
 * 注意：测试验证用户看到的 UI 状态，而不是底层存储实现
 */
test.describe('Basic User - Session Persistence', () => {
  test('切换优化模型后刷新页面，选择应该保留', async ({ page }) => {
    // 1. 导航到 basic/user
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.goto('/#/basic/user')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // 等待数据加载

    // 2. 找到优化模型下拉框并记录初始值
    const modelLabel = page.getByText(/优化模型|Optimization Model/i).first()
    await expect(modelLabel).toBeVisible({ timeout: 15000 })

    const container = modelLabel.locator('xpath=ancestor::*[.//div[contains(@class,"n-base-selection")]][1]')
    const select = container.locator('.n-base-selection').first()

    // 获取初始选中的模型
    const getSelectedModel = async () => {
      return await select.textContent()
    }

    const initialModel = await getSelectedModel()
    console.log(`初始优化模型: ${initialModel || '(未设置)'}`)

    // 3. 点击下拉框并切换
    await select.click()
    await page.waitForTimeout(500)

    // 获取所有选项
    const options = await page.locator('.n-base-select-option').allTextContents()
    console.log(`可用模型选项: ${options.length} 个`)
    expect(options.length).toBeGreaterThan(0)

    // 记录要切换到的模型（选择第二个选项，如果存在）
    const targetModelIndex = options.length > 1 ? 1 : 0
    const targetModel = options[targetModelIndex]

    if (targetModelIndex === 0) {
      console.log('⚠️ 只有一个模型选项，跳过切换测试')
      return
    }

    // 点击第二个选项
    await page.locator('.n-base-select-option').nth(targetModelIndex).click()
    console.log(`切换到模型: ${targetModel}`)

    // 4. 验证切换后的值已更新
    await page.waitForTimeout(500) // 等待 UI 更新
    const afterSwitch = await getSelectedModel()
    console.log(`切换后: ${afterSwitch}`)

    // 5. 刷新页面
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // 等待恢复完成

    // 6. 验证刷新后下拉框是否显示之前选择的值（这就是持久化的意义）
    const afterRefresh = await getSelectedModel()
    console.log(`刷新后: ${afterRefresh}`)

    // 关键断言：刷新后的值应该等于切换后的值
    if (afterRefresh === targetModel) {
      console.log('✅ 持久化成功：模型选择已保留')
    } else {
      console.log(`❌ 持久化失败：期望 "${targetModel}"，实际 "${afterRefresh}"`)
    }

    // 这个断言会验证持久化是否成功
    expect(afterRefresh).toBe(targetModel)
  })

  test('切换模板后刷新页面，选择应该保留', async ({ page }) => {
    // 1. 导航到 basic/user
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.goto('/#/basic/user')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 2. 找到模板下拉框并记录初始值
    const templateLabel = page.getByText(/优化提示词模板|Optimization Template/i).first()
    await expect(templateLabel).toBeVisible({ timeout: 15000 })

    const container = templateLabel.locator('xpath=ancestor::*[.//div[contains(@class,"n-base-selection")]][1]')
    const select = container.locator('.n-base-selection').first()

    const getSelectedTemplate = async () => {
      return await select.textContent()
    }

    const initialTemplate = await getSelectedTemplate()
    console.log(`初始模板: ${initialTemplate || '(未设置)'}`)

    // 3. 点击下拉框并切换
    await select.click()
    await page.waitForTimeout(500)

    // 获取所有选项
    const options = await page.locator('.n-base-select-option').allTextContents()
    console.log(`可用模板选项: ${options.length} 个`)
    expect(options.length).toBeGreaterThan(0)

    // 记录要切换到的模板（选择第二个选项，如果存在）
    const targetIndex = options.length > 1 ? 1 : 0
    const targetTemplate = options[targetIndex]

    if (targetIndex === 0) {
      console.log('⚠️ 只有一个模板选项，跳过切换测试')
      return
    }

    // 点击第二个选项
    await page.locator('.n-base-select-option').nth(targetIndex).click()
    console.log(`切换到模板: ${targetTemplate}`)

    // 4. 验证切换后的值已更新
    await page.waitForTimeout(500)
    const afterSwitch = await getSelectedTemplate()
    console.log(`切换后: ${afterSwitch}`)

    // 5. 刷新页面
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 6. 验证刷新后下拉框是否显示之前选择的值
    const afterRefresh = await getSelectedTemplate()
    console.log(`刷新后: ${afterRefresh}`)

    // 关键断言：刷新后的值应该等于切换后的值
    if (afterRefresh === targetTemplate) {
      console.log('✅ 持久化成功：模板选择已保留')
    } else {
      console.log(`❌ 持久化失败：期望 "${targetTemplate}"，实际 "${afterRefresh}"`)
    }

    // 这个断言会验证持久化是否成功
    expect(afterRefresh).toBe(targetTemplate)
  })
})
