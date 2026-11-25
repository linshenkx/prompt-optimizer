export const BROWSER_BRIDGE_PROTOCOL = 'po-browser-bridge/1'
export const BROWSER_BRIDGE_MAX_BYTES = 2 * 1024 * 1024
export const PRODUCT_BRIDGE_MAX_BYTES = 32 * 1024 * 1024
export type BrowserAccess = 'read' | 'compare' | 'business'

export function isBrowserAccess(access: unknown): access is BrowserAccess {
  return access === 'read' || access === 'compare' || access === 'business'
}

export function allowsBrowserAccess(granted: BrowserAccess, requested: BrowserAccess): boolean {
  return requested === 'read' || granted === requested || granted === 'business'
}

export interface BrowserSourceIdentity {
  contextId: string
  pageId: string
  browser: string
  label: string
  productVersion: string
}

export interface BrowserAuthorization {
  port: number
  ticket: string
}

export class BrowserBridgeError extends Error {
  constructor(readonly code: string) {
    super(`Browser source request failed (${code}).`)
    this.name = 'BrowserBridgeError'
  }
}

export function assertBridgeJson(value: unknown, depth = 0, budget = { remaining: 100_000 }): void {
  if (depth > 32 || --budget.remaining < 0) throw new BrowserBridgeError('INVALID_INPUT')
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (Array.isArray(value)) { for (const item of value) assertBridgeJson(item, depth + 1, budget); return }
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new BrowserBridgeError('INVALID_INPUT')
  }
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new BrowserBridgeError('INVALID_INPUT')
    assertBridgeJson(item, depth + 1, budget)
  }
}

export function publicBrowserError(error: unknown): string {
  const code = error instanceof Error && 'code' in error ? error.code : undefined
  return typeof code === 'string' && /^[A-Z][A-Z_]{0,79}$/.test(code) ? code : 'PRODUCT_REQUEST_FAILED'
}
