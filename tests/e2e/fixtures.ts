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
 * 清理旧的测试数据库
 *
 * 在测试开始前删除所有 test-db- 开头的 IndexedDB 数据库
 * 确保每次测试运行都有干净的环境
 */
async function cleanOldTestDatabases(page: Page): Promise<void> {
  try {
    await page.evaluate(async () => {
      const databases = await (indexedDB as any).databases()
      await Promise.all(
        databases
          .filter((db: any) => db.name.startsWith('test-db-'))
          .map((db: any) => {
            return new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(db.name)
              req.onsuccess = () => resolve()
              req.onerror = () => resolve() // 失败也继续，不阻塞测试
            })
          })
      )
    })
  } catch (err) {
    // indexedDB.databases() 可能在某些浏览器不支持，忽略错误
    console.warn('Failed to clean old test databases (non-critical):', err)
  }
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
    await use(context)
    await context.close()
  },

  // 在独立的 context 中创建 page
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage()
    const problems: string[] = []

    // ✅ Step 1: 清理旧的测试数据库（确保磁盘空间不会累积）
    await cleanOldTestDatabases(page)

    // ✅ Step 2: 为本次测试生成唯一数据库名称
    // 使用 workerIndex + timestamp + random 确保唯一性
    const testDbName = `test-db-${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(36).substring(7)}`

    // ✅ Step 3: 注入测试配置到页面（合并为一次 addInitScript 调用）
    await page.addInitScript((dbName) => {
      // 清理 localStorage 和 sessionStorage（避免测试间状态泄漏）
      localStorage.clear()
      sessionStorage.clear()
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
      // ✅ Step 4: 不需要显式清理当前测试的数据库
      // 下次测试会自动清理所有 test-db-* 数据库
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
