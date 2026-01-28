import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 * 用于测试 Web 应用的完整用户流程
 */

// E2E 测试专用端口,避免与开发服务器冲突
const E2E_PORT = process.env.E2E_PORT || 15555;
const BASE_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  // 测试目录
  testDir: './tests/e2e',

  // 完全并行运行测试
  // 每个测试使用独立的 BrowserContext 和数据库名称，完全隔离
  fullyParallel: true,

  // CI 环境下失败时不重试,本地开发时重试一次
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // CI 环境下使用更少的 worker，本地使用所有可用核心
  workers: process.env.CI ? 1 : undefined,

  // 测试报告配置
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],

  // 共享设置
  use: {
    // 基础 URL
    baseURL: BASE_URL,

    // 收集失败测试的 trace
    trace: 'on-first-retry',

    // 截图配置
    screenshot: 'only-on-failure',

    // 视频配置
    video: 'retain-on-failure',
  },

  // 项目配置 - 不同浏览器
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // 如果需要测试其他浏览器,可以取消注释
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // 自动启动 E2E 测试专用开发服务器
  webServer: {
    // E2E 依赖 workspace 包的 dist 产物（@prompt-optimizer/core/@prompt-optimizer/ui），
    // 先构建再启动 web dev server，避免跑到过期 dist 导致交互/事件异常。
    command: `pnpm -F @prompt-optimizer/core build && pnpm -F @prompt-optimizer/ui build && pnpm -F @prompt-optimizer/web dev --port ${E2E_PORT}`,
    url: BASE_URL,
    // 为 Vite 提供最小的“启用”环境变量：让内置 SiliconFlow 图像模型在 E2E (VCR replay) 下可选，
    // 避免因本机缺少真实 key 而导致 UI 不渲染对应选项，从而无法命中既有 VCR fixtures。
    env: {
      ...process.env,
      VITE_SILICONFLOW_API_KEY: process.env.VITE_SILICONFLOW_API_KEY || 'vcr',
      VITE_DEEPSEEK_API_KEY: process.env.VITE_DEEPSEEK_API_KEY || 'vcr',
    },
    // 为了保证每次测试都使用最新构建产物，默认不复用已有 server。
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
