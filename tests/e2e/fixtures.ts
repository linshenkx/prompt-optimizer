import { test as base, expect, type ConsoleMessage, type Page, type BrowserContext } from '@playwright/test'
import { setupVCRForTest } from './helpers/vcr'

const IGNORE_CONSOLE_PATTERNS: RegExp[] = [
  /favicon\.ico/i,
  /ResizeObserver loop limit exceeded/i,
  /ResizeObserver loop completed with undelivered notifications/i,
  // Vue Router warnings during route migration (pro/user -> pro/variable, pro/system -> pro/multi)
  /Vue Router warn.*No match found for location with path "\/(pro\/user|pro\/system)"/i,
  /Router.*非法 subMode.*重定向/i
]

function shouldIgnoreConsoleMessage(message: string): boolean {
  return IGNORE_CONSOLE_PATTERNS.some((pattern) => pattern.test(message))
}

function formatConsoleMessage(msg: ConsoleMessage): string {
  const type = msg.type()
  const location = msg.location()
  const loc = location.url ? ` @ ${location.url}:${location.lineNumber}:${location.columnNumber}` : ''
  return `[console.${type}] ${msg.text()}${loc}`
}

/**
 * 自定义测试 fixture，扩展页面功能
 *
 * - 为每个测试创建独立的 BrowserContext 确保存储完全隔离
 * - 支持完全并行测试，无需担心测试间状态泄漏
 * - 监控控制台错误和页面错误
 */
export const test = base.extend<{ context: BrowserContext; page: Page }>({
  // 为每个测试创建独立的 BrowserContext
  context: async ({ browser }, use) => {
    const context = await browser.newContext()
    await use(context)
    await context.close()
  },

  // 在独立的 context 中创建 page
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage()
    const problems: string[] = []

    const onConsole = (msg: ConsoleMessage) => {
      const type = msg.type()
      if (type !== 'error' && type !== 'warning') return

      const text = msg.text()
      if (shouldIgnoreConsoleMessage(text)) return
      problems.push(formatConsoleMessage(msg))
    }

    const onPageError = (error: Error) => {
      const message = error?.stack ? error.stack : String(error)
      if (shouldIgnoreConsoleMessage(message)) return
      problems.push(`[pageerror] ${message}`)
    }

    page.on('console', onConsole)
    page.on('pageerror', onPageError)

    // 🎬 设置 VCR（录制/回放 LLM API）
    // 从 titlePath 提取相对路径，去掉 tests/e2e/ 前缀
    const fullPath = testInfo.titlePath[0] || 'unknown-test'
    const testName = fullPath.replace(/^tests\/e2e\//, '')
    const testCase = testInfo.title || 'unknown-case'
    await setupVCRForTest(page, testName, testCase)

    try {
      await use(page)
    } finally {
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
      await page.close()
    }

    if (testInfo.status === 'skipped') return
    if (problems.length === 0) return

    await testInfo.attach('console-and-page-errors', {
      body: problems.join('\n\n'),
      contentType: 'text/plain'
    })

    throw new Error(
      `Browser console/page errors detected (${problems.length}). See attachment: console-and-page-errors\n\n` +
      problems.join('\n\n')
    )
  }
})

export { expect }
