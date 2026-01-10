import { expect, type Page } from '@playwright/test'

/**
 * 等待应用加载完成
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await expect(page.locator('.loading-container')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('#app, [id="app"], main')).toBeAttached()
}

/**
 * 导航到指定模式
 * @description 先访问根路径等待应用初始化，再导航到目标路由
 */
export async function navigateToMode(
  page: Page,
  mode: 'basic' | 'pro' | 'image',
  subMode: string
): Promise<void> {
  // ✅ 先访问根路径，确保应用初始化完成
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // ✅ 再导航到目标路由
  const targetPath = `/#/${mode}/${subMode}`
  await page.goto(targetPath)
  await page.waitForLoadState('networkidle')

  // ✅ 等待应用就绪
  await waitForAppReady(page)

  // ✅ 验证 URL 正确
  await expect(page).toHaveURL(new RegExp(`\\/#\\/${mode}\\/${subMode}$`))
}
