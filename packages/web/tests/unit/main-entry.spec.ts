import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
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
      locale: { value: 'zh-CN' },
      t: vi.fn(() => 'GlobalCloud XiaoC'),
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
    mocks.ready.mockResolvedValue(undefined)

    document.body.innerHTML = '<div id="app"></div>'
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
})
