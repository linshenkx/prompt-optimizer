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
  fullyParallel: true,

  // CI 环境下失败时不重试,本地开发时重试一次
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // CI 环境下使用更少的 worker
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
    command: `pnpm -F @prompt-optimizer/web dev --port ${E2E_PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
