import { test, expect } from '../fixtures'
import { navigateToMode, openFavoritesPage } from '../helpers/common'

async function preferSimplifiedChinese(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      get: () => 'zh-CN',
    })
    Object.defineProperty(navigator, 'languages', {
      configurable: true,
      get: () => ['zh-CN', 'zh'],
    })
  })
}

test.describe('zh-CN main path localization', () => {
  test('renders the main workspace and favorites page with Chinese user-facing labels', async ({ page }) => {
    await preferSimplifiedChinese(page)

    await navigateToMode(page, 'basic', 'user')

    await expect(page.locator('body')).toContainText('小词')
    await expect(page.getByTestId('function-mode-selector')).toContainText('基础')
    await expect(page.getByTestId('function-mode-selector')).toContainText('上下文')
    await expect(page.getByTestId('function-mode-selector')).toContainText('图像')
    await expect(page.getByTestId('optimization-mode-selector')).toContainText('用户提示词优化')
    await expect(page.getByTestId('header-page-destinations')).toContainText('收藏夹')
    await expect(page.getByTestId('header-modal-actions')).toContainText('功能提示词')
    await expect(page.getByTestId('header-modal-actions')).toContainText('历史记录')
    await expect(page.getByTestId('header-modal-actions')).toContainText('模型管理')
    await expect(page.getByTestId('language-switch')).toHaveAttribute('aria-label', /切换语言/)

    await openFavoritesPage(page)

    await expect(page.getByTestId('favorites-page')).toContainText('收藏夹')
    await expect(page.getByTestId('favorites-page-return')).toContainText('返回工作区')
    await expect(page.getByTestId('favorites-manager-workspace')).toContainText('收藏列表')
    await expect(page.getByTestId('favorites-manager-workspace')).toContainText('还没有收藏任何提示词')
    await expect(page.getByTestId('favorites-manager-workspace')).toContainText('添加')
    await expect(page.getByTestId('favorites-manager-workspace')).toContainText('导入')
  })
})
