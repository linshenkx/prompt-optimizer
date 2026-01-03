import { afterEach, beforeEach, vi } from 'vitest'

type ConsoleLevel = 'error' | 'warn'

interface ConsoleRecord {
  level: ConsoleLevel
  message: string
  stack?: string
}

interface SetupErrorDetectionOptions {
  failOnWarn?: boolean
  ignorePatterns?: RegExp[]
}

const DEFAULT_IGNORE_PATTERNS: RegExp[] = [
  /ResizeObserver loop limit exceeded/i,
  /ResizeObserver loop completed with undelivered notifications/i
]

let currentIgnorePatterns: RegExp[] = [...DEFAULT_IGNORE_PATTERNS]
let failOnWarn = true

const allowedPatternsByTest = new Set<RegExp>()

function isIgnored(message: string): boolean {
  const patterns = [...currentIgnorePatterns, ...allowedPatternsByTest]
  return patterns.some((pattern) => pattern.test(message))
}

function toMessage(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg
      try {
        return JSON.stringify(arg)
      } catch {
        return String(arg)
      }
    })
    .join(' ')
}

function captureStack(): string | undefined {
  const error = new Error()
  if (!error.stack) return undefined
  const stackLines = error.stack.split('\n')
  return stackLines.slice(2).join('\n').trim()
}

function formatRecords(records: ConsoleRecord[]): string {
  return records
    .map((record, idx) => {
      const header = `${idx + 1}. [console.${record.level}] ${record.message}`
      if (!record.stack) return header
      return `${header}\n${record.stack}`
    })
    .join('\n\n')
}

export function allowConsole(pattern: RegExp): void {
  allowedPatternsByTest.add(pattern)
}

export function setupErrorDetection(options: SetupErrorDetectionOptions = {}): void {
  failOnWarn = options.failOnWarn ?? process.env.UI_FAIL_ON_WARN !== 'false'
  currentIgnorePatterns = [
    ...DEFAULT_IGNORE_PATTERNS,
    ...(options.ignorePatterns ?? [])
  ]

  let records: ConsoleRecord[] = []
  let onUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null = null
  let onError: ((event: ErrorEvent) => void) | null = null

  beforeEach(() => {
    records = []
    allowedPatternsByTest.clear()

    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const message = toMessage(args)
      if (isIgnored(message)) return
      records.push({ level: 'error', message, stack: captureStack() })
    })

    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      const message = toMessage(args)
      if (isIgnored(message)) return
      records.push({ level: 'warn', message, stack: captureStack() })
    })

    if (typeof window !== 'undefined' && window.addEventListener) {
      onUnhandledRejection = (event: PromiseRejectionEvent) => {
        const reason = (event as any).reason
        const message =
          reason instanceof Error
            ? reason.message
            : typeof reason === 'string'
              ? reason
              : (() => {
                  try {
                    return JSON.stringify(reason)
                  } catch {
                    return String(reason)
                  }
                })()

        if (isIgnored(message)) return
        records.push({ level: 'error', message: `[unhandledrejection] ${message}` })
      }

      onError = (event: ErrorEvent) => {
        const message = event.error instanceof Error ? event.error.message : event.message
        if (isIgnored(message)) return
        records.push({ level: 'error', message: `[window.error] ${message}` })
      }

      window.addEventListener('unhandledrejection', onUnhandledRejection)
      window.addEventListener('error', onError)
    }
  })

  afterEach(() => {
    if (typeof window !== 'undefined' && window.removeEventListener) {
      if (onUnhandledRejection) window.removeEventListener('unhandledrejection', onUnhandledRejection)
      if (onError) window.removeEventListener('error', onError)
      onUnhandledRejection = null
      onError = null
    }

    vi.restoreAllMocks()

    const errors = records.filter((r) => r.level === 'error')
    const warnings = records.filter((r) => r.level === 'warn')

    if (errors.length > 0) {
      throw new Error(`UI console errors detected:\n\n${formatRecords(errors)}`)
    }

    if (failOnWarn && warnings.length > 0) {
      throw new Error(`UI console warnings detected:\n\n${formatRecords(warnings)}`)
    }
  })
}

