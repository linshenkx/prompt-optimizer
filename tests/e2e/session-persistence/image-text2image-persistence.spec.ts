import { test, expect } from '../fixtures'

/**
 * Image Text2Image 模式 - Session 持久化测试
 *
 * 注意：当前 session 使用 PreferenceService（IndexedDB 等）持久化，
 * 不再依赖 localStorage，因此测试应以 UI 状态为准。
 */
test.describe('Image Text2Image - Session Persistence', () => {
  const normalizeText = (text: string | null | undefined) =>
    String(text || '').replace(/\s+/g, ' ').trim()

  const gotoMode = async (page: any, route: string) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
  }

  const getSelectByLabel = async (page: any, label: RegExp) => {
    const labelEl = page.getByText(label).first()
    await expect(labelEl).toBeVisible({ timeout: 20000 })

    const container = labelEl.locator(
      'xpath=ancestor::*[.//div[contains(@class,"n-base-selection")]][1]'
    )
    const select = container.locator('.n-base-selection').first()
    await expect(select).toBeVisible({ timeout: 20000 })
    return select
  }

  test('切换文本模型后刷新页面，选择应该保留', async ({ page }) => {
    await gotoMode(page, '/#/image/text2image')

    const select = await getSelectByLabel(page, /Text Model|文本模型|文字模型/i)
    await select.click()

    const optionLocator = page.locator('.n-base-select-option')
    await expect(optionLocator.first()).toBeVisible({ timeout: 20000 })

    const count = await optionLocator.count()
    expect(count).toBeGreaterThan(0)
    if (count < 2) test.skip(true, 'only one text model option')

    const target = normalizeText(await optionLocator.nth(1).textContent())
    await optionLocator.nth(1).click()

    await expect
      .poll(async () => normalizeText(await select.textContent()), { timeout: 20000 })
      .toBe(target)

    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    const selectAfter = await getSelectByLabel(page, /Text Model|文本模型|文字模型/i)
    await expect
      .poll(async () => normalizeText(await selectAfter.textContent()), { timeout: 20000 })
      .toBe(target)
  })

  test('切换模板后刷新页面，选择应该保留', async ({ page }) => {
    await gotoMode(page, '/#/image/text2image')

    const select = await getSelectByLabel(page, /Optimization Template|优化.*模板|優化.*模板/i)
    await select.click()

    const optionLocator = page.locator('.n-base-select-option')
    await expect(optionLocator.first()).toBeVisible({ timeout: 20000 })

    const count = await optionLocator.count()
    expect(count).toBeGreaterThan(0)
    if (count < 2) test.skip(true, 'only one template option')

    const target = normalizeText(await optionLocator.nth(1).textContent())
    await optionLocator.nth(1).click()

    await expect
      .poll(async () => normalizeText(await select.textContent()), { timeout: 20000 })
      .toBe(target)

    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    const selectAfter = await getSelectByLabel(page, /Optimization Template|优化.*模板|優化.*模板/i)
    await expect
      .poll(async () => normalizeText(await selectAfter.textContent()), { timeout: 20000 })
      .toBe(target)
  })
})
