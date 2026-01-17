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
import { setupErrorDetection } from './utils/error-detection'

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

// CodeMirror relies on Range geometry methods which are incomplete in jsdom.
// Provide a minimal polyfill to avoid noisy test stderr.
if (typeof Range !== 'undefined') {
  const proto = Range.prototype as any
  if (typeof proto.getClientRects !== 'function') {
    proto.getClientRects = () => []
  }
  if (typeof proto.getBoundingClientRect !== 'function') {
    proto.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      toJSON: () => ({})
    })
  }
}

console.log('[Test Setup] Global browser API mocks initialized')

// ========== Pinia 服务清理（防止测试污染）==========
import { afterEach } from 'vitest'
import { setPiniaServices } from '../src/plugins/pinia'

/**
 * 全局测试清理：确保每个测试用例后都清理 Pinia 服务
 * 避免测试用例之间的状态污染
 *
 * 这是 Codex 建议的"兜底机制"：
 * - 即使测试用例忘记手动清理，全局 afterEach 也会自动清理
 * - 配合 pinia-test-helpers.ts 中的 helper 使用效果更佳
 */
afterEach(() => {
  setPiniaServices(null)
})

console.log('[Test Setup] Pinia services cleanup registered')

// ========== UI 错误检测（console + 未捕获异常）==========
setupErrorDetection()
