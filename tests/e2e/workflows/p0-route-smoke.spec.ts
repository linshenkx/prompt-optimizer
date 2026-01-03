import { test, expect } from '../fixtures'

const ROUTES: Array<{ name: string; hashPath: string }> = [
  { name: 'basic-system', hashPath: '/#/basic/system' },
  { name: 'basic-user', hashPath: '/#/basic/user' },
  { name: 'pro-system', hashPath: '/#/pro/system' },
  { name: 'pro-user', hashPath: '/#/pro/user' },
  { name: 'image-text2image', hashPath: '/#/image/text2image' },
  { name: 'image-image2image', hashPath: '/#/image/image2image' }
]

test.describe('P0 route smoke', () => {
  for (const route of ROUTES) {
    test(route.name, async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // 应用初始化完成后再跳转到目标路由，避免 services/watch 初始化阶段把深链接当成根路径覆盖
      await page.goto(route.hashPath)
      await page.waitForLoadState('networkidle')

      // 等待应用进入 isReady（loading-container 会在未就绪时渲染）
      await expect(page.locator('.loading-container')).toHaveCount(0, { timeout: 15000 })

      await expect(page).toHaveURL(new RegExp(`#${route.hashPath.replace('/#', '')}$`))
      await expect(page.locator('#app, [id="app"], main')).toBeAttached()

      // 页面应渲染出一定的 DOM（避免空白屏）
      const appDescendants = await page.locator('#app *').count()
      expect(appDescendants).toBeGreaterThan(0)
    })
  }
})
