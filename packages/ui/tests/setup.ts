/**
 * 全局测试设置文件
 * 为所有测试提供通用的 mock 和环境配置
 */

import { vi } from 'vitest'
import { config } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zhCN from '../src/i18n/locales/zh-CN'
import zhTW from '../src/i18n/locales/zh-TW'
import enUS from '../src/i18n/locales/en-US'

// 创建测试用的 i18n 实例
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    'en-US': enUS,
  }
})

// 配置 Vue Test Utils 全局插件
config.global.plugins = [i18n]

// 配置 Naive UI 全局插件
// 为了避免在每个测试中都需要手动配置 Naive UI,我们在全局设置中配置它
config.global.stubs = {
  // 保留 Teleport 以支持 Naive UI 的弹窗组件
  Teleport: true
}

// 创建全局消息 API mock (Naive UI 依赖)
if (typeof window !== 'undefined') {
  (window as any).$message = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn()
  }
}

// Mock navigator.clipboard API (JSDOM doesn't provide this)
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue('mocked clipboard content')
  }
})

// Mock document.execCommand for fallback clipboard functionality
Object.assign(document, {
  execCommand: vi.fn().mockReturnValue(true)
})

// Mock window.getComputedStyle (needed for Vue Transition and DOM tests)
// Vue's Transition component needs transitionDelay, transitionDuration, etc.
const mockComputedStyle = {
  transitionDelay: '',
  transitionDuration: '',
  transitionProperty: '',
  animationDelay: '',
  animationDuration: '',
  animationName: '',
  display: 'block',
  getPropertyValue: vi.fn().mockReturnValue('')
}
Object.assign(window, {
  getComputedStyle: vi.fn().mockReturnValue(mockComputedStyle)
})

// Mock ResizeObserver (commonly used in modern components)
// 使用真正的类而不是 vi.fn().mockImplementation()，因为某些库在模块顶层实例化
class MockResizeObserver {
  callback: ResizeObserverCallback | null = null
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  constructor(callback?: ResizeObserverCallback) {
    this.callback = callback || null
  }
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

// Mock IntersectionObserver (used for lazy loading and scroll detection)
class MockIntersectionObserver {
  callback: IntersectionObserverCallback | null = null
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn().mockReturnValue([])
  root = null
  rootMargin = ''
  thresholds: number[] = []
  constructor(callback?: IntersectionObserverCallback) {
    this.callback = callback || null
  }
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

// Mock MutationObserver (used by CodeMirror and other DOM manipulation libraries)
class MockMutationObserver {
  callback: MutationCallback | null = null
  observe = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn().mockReturnValue([])
  constructor(callback?: MutationCallback) {
    this.callback = callback || null
  }
}
global.MutationObserver = MockMutationObserver as unknown as typeof MutationObserver

// Mock window.matchMedia (used for responsive design)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock scrollTo methods
Object.assign(window, {
  scrollTo: vi.fn(),
  scroll: vi.fn(),
})

Object.assign(Element.prototype, {
  scrollTo: vi.fn(),
  scroll: vi.fn(),
  scrollIntoView: vi.fn(),
})

console.log('[Test Setup] Global browser API mocks initialized')