import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  i18nT: vi.fn(() => 'GlobalCloud XiaoC'),
  locale: { value: 'zh-CN' },
  ready: vi.fn(),
  installI18nOnly: vi.fn(),
  installPinia: vi.fn(),
  routerUse: vi.fn(),
  watch: vi.fn(),
}))

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>()
  return {
    ...actual,
    watch: mocks.watch,
  }
})

vi.mock('@prompt-optimizer/ui', () => ({
  PromptOptimizerApp: defineComponent({
    name: 'PromptOptimizerApp',
    setup() {
      return () => h('main', { 'data-testid': 'prompt-optimizer-app' }, 'GlobalCloud XiaoC')
    },
  }),
  installI18nOnly: mocks.installI18nOnly,
  installPinia: mocks.installPinia,
  i18n: {
    global: {
      locale: mocks.locale,
      t: mocks.i18nT,
    },
  },
  router: {
    install: mocks.routerUse,
    isReady: mocks.ready,
  },
}))

describe('web main entry', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.ready.mockReset()
    mocks.installI18nOnly.mockClear()
    mocks.installPinia.mockClear()
    mocks.routerUse.mockClear()
    mocks.watch.mockClear()
    mocks.i18nT.mockClear()
    mocks.i18nT.mockReturnValue('GlobalCloud XiaoC')
    mocks.locale.value = 'zh-CN'
    mocks.ready.mockResolvedValue(undefined)
    vi.unstubAllEnvs()

    document.body.innerHTML = '<div id="app"></div>'
    document.head.innerHTML = ''
    document.title = ''
    document.documentElement.removeAttribute('lang')
  })

  it('installs app services, syncs document metadata, and mounts after router readiness', async () => {
    await import('../../src/main')
    await mocks.ready.mock.results[0]?.value
    await Promise.resolve()

    expect(mocks.installI18nOnly).toHaveBeenCalledTimes(1)
    expect(mocks.installPinia).toHaveBeenCalledTimes(1)
    expect(mocks.routerUse).toHaveBeenCalledTimes(1)
    expect(mocks.ready).toHaveBeenCalledTimes(1)
    expect(mocks.watch).toHaveBeenCalledTimes(1)
    expect(document.title).toBe('GlobalCloud XiaoC')
    expect(document.documentElement.lang).toBe('zh')
    expect(document.querySelector('[data-testid="prompt-optimizer-app"]')).not.toBeNull()
  })

  it('updates document metadata when locale changes to English', async () => {
    await import('../../src/main')

    mocks.i18nT.mockReturnValue('GlobalCloud XiaoC English')
    mocks.locale.value = 'en-US'
    const syncDocumentMetadata = mocks.watch.mock.calls[0]?.[1] as (() => void) | undefined
    syncDocumentMetadata?.()

    expect(document.title).toBe('GlobalCloud XiaoC English')
    expect(document.documentElement.lang).toBe('en')
  })

  it('loads Vercel Analytics only when deployment env is enabled', async () => {
    vi.stubEnv('VITE_VERCEL_DEPLOYMENT', 'true')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await import('../../src/main')
    window.dispatchEvent(new Event('DOMContentLoaded'))

    const script = document.head.querySelector<HTMLScriptElement>('script[src="/_vercel/insights/script.js"]')
    expect(script).not.toBeNull()
    expect(script?.defer).toBe(true)

    script?.onload?.(new Event('load'))
    script?.onerror?.(new Event('error'))

    expect(consoleSpy).toHaveBeenCalledWith('Vercel Analytics 已加载')
    expect(consoleSpy).toHaveBeenCalledWith('Vercel Analytics 加载失败')

    consoleSpy.mockRestore()
  })
})
