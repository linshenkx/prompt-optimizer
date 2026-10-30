import { test as base, expect, type ConsoleMessage, type Page, type BrowserContext } from '@playwright/test'
import { getCurrentTestVCRFailure, setupVCRForTest } from './helpers/vcr'

const IGNORE_CONSOLE_PATTERNS: RegExp[] = [
  /favicon\.ico/i,
  /ResizeObserver loop limit exceeded/i,
  /ResizeObserver loop completed with undelivered notifications/i,
  /send was called before connect/i,
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
 * 存储隔离策略：
 * 1. 为每个测试生成唯一的测试数据库名称
 * 2. 在每次测试前清理旧的测试数据库
 * 3. 通过 init script 注入数据库名称
 * 4. 支持完全并行测试，无需担心测试间状态泄漏
 */
export const test = base.extend<{ context: BrowserContext; page: Page }>({
  // 为每个测试创建独立的 BrowserContext
  context: async ({ browser }, use) => {
    // ✅ 创建新的 BrowserContext，禁用所有存储（避免测试间状态泄漏）
    const context = await browser.newContext({
      // 禁用 localStorage 和 sessionStorage
      storageState: undefined, // 不加载任何存储状态
      // 可以在这里添加其他 context 级别的配置
    })
    // These workflow tests do not depend on services installed on the test host.
    // Return an unrecognized identity for read-only discovery probes, without
    // intercepting model catalogs, inference, or relaxing console error checks.
    const discoveryProbes = new Set([
      'http://localhost:11434/',
      'http://127.0.0.1:3425/api/hello',
      'http://127.0.0.1:8317/',
      'http://127.0.0.1:4000/health/liveliness',
      'http://127.0.0.1:9931/health',
      'http://127.0.0.1:8080/health',
    ])
    await context.route(url => discoveryProbes.has(url.href), async route => {
      if (route.request().method() !== 'GET') return route.fallback()
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await use(context)
    await context.close()
  },

  // 在独立的 context 中创建 page
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage()
    const problems: string[] = []

    // ✅ Step 1: 为本次测试生成唯一数据库名称
    // 使用 workerIndex + timestamp + random 确保唯一性
    const testDbName = `test-db-${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(36).substring(7)}`

    // ✅ Step 2: 注入测试配置到页面（合并为一次 addInitScript 调用）
    await page.addInitScript((dbName) => {
      // 清理 localStorage 和 sessionStorage（避免测试间状态泄漏）。
      // 注意：当页面导航失败落到浏览器错误页（如 chrome-error://）时，访问 storage 可能抛 SecurityError。
      // 这里容错处理，避免测试基建本身把“服务未就绪/连接中断”误报为页面脚本错误。
      try {
        localStorage.clear()
      } catch {}
      try {
        sessionStorage.clear()
      } catch {}
      // 注入测试数据库名称
      ;(window as any).__TEST_DB_NAME__ = dbName
    }, testDbName)

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
      // 不需要显式清理当前测试的数据库
      // 每个测试都会使用独立的 BrowserContext，测试结束后会释放对应的存储（IndexedDB/localStorage 等）
    }

    const vcrFailure = getCurrentTestVCRFailure()
    if (vcrFailure) {
      problems.unshift(`[vcr] ${vcrFailure}`)
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
