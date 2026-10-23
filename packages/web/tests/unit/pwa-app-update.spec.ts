import { createApp, nextTick, type App } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ prepare: vi.fn(), requestWorker: vi.fn() }))
vi.mock('@prompt-optimizer/ui', async () => {
  const { defineComponent, h, ref } = await import('vue')
  return {
    i18n: { global: { locale: ref('zh-CN') } },
    PromptOptimizerApp: defineComponent({
      setup(_, { expose }) {
        expose({ prepareForUpdate: fixture.prepare })
        return () => h('textarea', { 'data-testid': 'draft', value: 'preserved draft' })
      },
    }),
  }
})
vi.mock('../../src/pwa/update', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/pwa/update')>(),
  requestWorkerUpdate: fixture.requestWorker,
}))
import WebApp from '../../src/App.vue'

describe('web shell update boundary', () => {
  let app: App
  let root: HTMLElement
  let oldWorkerDescriptor: PropertyDescriptor | undefined
  const flush = async () => {
    for (let step = 0; step < 8; step++) await Promise.resolve()
    await nextTick()
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.stubEnv('PROD', true)
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: false }))
    const waiting = Object.assign(new EventTarget(), { state: 'installed' })
    const registration = Object.assign(new EventTarget(), { waiting, installing: null, active: { state: 'activated' }, update: vi.fn().mockResolvedValue(undefined) })
    oldWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn().mockResolvedValue(registration) } })
    root = document.createElement('div')
    document.body.append(root)
    app = createApp(WebApp)
    app.mount(root)
    await flush()
  })
  afterEach(() => {
    app.unmount()
    root.remove()
    if (oldWorkerDescriptor) Object.defineProperty(navigator, 'serviceWorker', oldWorkerDescriptor)
    else Reflect.deleteProperty(navigator, 'serviceWorker')
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const updateButton = () => document.querySelector<HTMLButtonElement>('[data-testid="pwa-update"] .pwa-notice__primary')!

  it('locks workspace interaction while saving, then restores it if the workspace is busy', async () => {
    let resolve: (result: 'busy') => void = () => {}
    fixture.prepare.mockImplementation(() => new Promise(done => { resolve = done }))
    updateButton().click()
    await flush()
    expect(document.querySelector('.web-workspace')?.hasAttribute('inert')).toBe(true)
    expect(updateButton().disabled).toBe(true)
    expect(fixture.requestWorker).not.toHaveBeenCalled()
    resolve('busy')
    await flush()
    expect(document.querySelector('.web-workspace')?.hasAttribute('inert')).toBe(false)
    expect(document.body.textContent).toContain('请完成当前操作后再更新')
    expect(document.querySelector<HTMLTextAreaElement>('[data-testid="draft"]')?.value).toBe('preserved draft')
  })

  it('never requests worker activation after persistence fails', async () => {
    fixture.prepare.mockResolvedValue('save-failed')
    updateButton().click()
    await flush()
    expect(fixture.requestWorker).not.toHaveBeenCalled()
    expect(document.querySelector('.web-workspace')?.hasAttribute('inert')).toBe(false)
    expect(document.body.textContent).toContain('工作区未能保存')
  })

  it('retains the workspace when another open window prevents activation', async () => {
    fixture.prepare.mockResolvedValue('ready')
    fixture.requestWorker.mockResolvedValue('other-tabs')
    updateButton().click()
    await flush()
    expect(fixture.prepare).toHaveBeenCalledOnce()
    expect(fixture.requestWorker).toHaveBeenCalledOnce()
    expect(document.querySelector('.web-workspace')?.hasAttribute('inert')).toBe(false)
    expect(document.body.textContent).toContain('其他窗口')
    expect(document.querySelector<HTMLTextAreaElement>('[data-testid="draft"]')?.value).toBe('preserved draft')
  })

  it('does not advertise offline readiness after a first installation fails', async () => {
    const installing = Object.assign(new EventTarget(), { state: 'installing' })
    const registration = Object.assign(new EventTarget(), { waiting: null, installing, active: null })
    vi.mocked(navigator.serviceWorker.register).mockResolvedValueOnce(registration as unknown as ServiceWorkerRegistration)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    app.unmount()
    app = createApp(WebApp)
    app.mount(root)
    await flush()
    const installEvent = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) })
    window.dispatchEvent(installEvent)
    await flush()
    expect(document.querySelector('[data-testid="pwa-install"]')).toBeNull()
    installing.state = 'redundant'
    installing.dispatchEvent(new Event('statechange'))
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    await flush()
    expect(warn).toHaveBeenCalledWith('[PWA] App shell installation failed; online mode retained')
    expect(document.querySelector('[data-testid="pwa-install"]')).toBeNull()
    expect(document.body.textContent).toContain('部分页面需要联网打开')
    expect(document.body.textContent).not.toContain('可继续编辑本地内容')
    expect(document.querySelector<HTMLTextAreaElement>('[data-testid="draft"]')?.value).toBe('preserved draft')
  })
})
