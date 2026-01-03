import { test as base, expect, type ConsoleMessage, type Page } from '@playwright/test'

const IGNORE_CONSOLE_PATTERNS: RegExp[] = [
  /favicon\.ico/i,
  /ResizeObserver loop limit exceeded/i,
  /ResizeObserver loop completed with undelivered notifications/i
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

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use, testInfo) => {
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

    try {
      await use(page)
    } finally {
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
    }

    if (testInfo.status === 'skipped') return
    if (problems.length === 0) return

    await testInfo.attach('console-and-page-errors', {
      body: problems.join('\n\n'),
      contentType: 'text/plain'
    })

    throw new Error(
      `Browser console/page errors detected (${problems.length}). See attachment: console-and-page-errors`
    )
  }
})

export { expect }

