import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import LocalServiceDiscovery from '../../../src/components/LocalServiceDiscovery.vue'
import type { LocalServiceResult, TextModelConfig } from '@prompt-optimizer/core'

const { discover } = vi.hoisted(() => ({ discover: vi.fn() }))
vi.mock('@prompt-optimizer/core', async original => ({
  ...await original<typeof import('@prompt-optimizer/core')>(), discoverLocalServices: discover,
}))
vi.mock('vue-i18n', async original => ({
  ...await original<typeof import('vue-i18n')>(), useI18n: () => ({ t: (key: string) => key }),
}))
const service: LocalServiceResult = {
  kind: 'magpie', name: 'Magpie', baseURL: 'http://127.0.0.1:3425/v1', status: 'ready',
  models: [{ id: 'first', name: 'First model' }],
}
const ollama: LocalServiceResult = { ...service, kind: 'ollama', name: 'Ollama', baseURL: 'http://localhost:11434/v1' }
const wrappers: VueWrapper[] = []
function setup(active = true, models: TextModelConfig[] = []) {
  const wrapper = mount(LocalServiceDiscovery, { props: { active, models } })
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  delete window.electronAPI
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('local provider discovery shortcuts', () => {
  it('renders nothing initially and shows only discovered service icons and names', async () => {
    const pending = Promise.withResolvers<LocalServiceResult[]>()
    discover.mockReturnValue(pending.promise)
    const wrapper = setup(false)
    expect(discover).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="local-service-discovery"]').exists()).toBe(false)
    await wrapper.setProps({ active: true })
    expect(wrapper.find('[data-testid="local-service-discovery"]').exists()).toBe(false)
    pending.resolve([ollama, service])
    await flushPromises()
    expect(wrapper.text()).toContain('localDiscovery.found')
    expect(wrapper.text()).toContain('Ollama')
    expect(wrapper.text()).toContain('Magpie')
    expect(wrapper.findAll('svg')).toHaveLength(2)
    expect(wrapper.findAll('input')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('First model')
    await wrapper.get('[data-testid="local-service-create-magpie"]').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual([service])
  })

  it.each(['unavailable', 'timeout', 'unauthorized', 'incompatible'] as const)('stays empty for %s services', async status => {
    discover.mockResolvedValue([{ ...service, status, models: [] }])
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.find('[data-testid="local-service-discovery"]').exists()).toBe(false)
  })

  it('stays empty when the discovery request fails', async () => {
    discover.mockRejectedValue(new Error('connection refused'))
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.find('[data-testid="local-service-discovery"]').exists()).toBe(false)
  })

  it('hides existing addresses regardless of model ID or enabled state', async () => {
    discover.mockResolvedValue([service, ollama])
    const models = [{ modelId: 'different-model', enabled: false, connectionConfig: { baseURL: 'http://localhost:3425/' } }] as TextModelConfig[]
    const wrapper = setup(true, models)
    await flushPromises()
    expect(wrapper.find('[data-testid="local-service-create-magpie"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="local-service-create-ollama"]').exists()).toBe(true)
    await wrapper.setProps({ models: [...models, { connectionConfig: { baseURL: 'http://127.0.0.1:11434/v1/' } } as TextModelConfig] })
    expect(wrapper.find('[data-testid="local-service-discovery"]').exists()).toBe(false)
    await wrapper.setProps({ models: [] })
    expect(wrapper.findAll('button')).toHaveLength(2)
    expect(discover).toHaveBeenCalledTimes(1)
  })

  it('shows a confirmed service with an empty model catalog', async () => {
    discover.mockResolvedValue([{ ...service, models: [] }])
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.find('[data-testid="local-service-create-magpie"]').exists()).toBe(true)
  })

  it('deduplicates equivalent discovered endpoints', async () => {
    discover.mockResolvedValue([service, { ...service, baseURL: 'http://localhost:3425/v1/' }])
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.findAll('button')).toHaveLength(1)
  })

  it('uses the desktop discovery bridge', async () => {
    const desktopDiscover = vi.fn().mockResolvedValue([service])
    window.electronAPI = { localServices: { discover: desktopDiscover } } as unknown as Window['electronAPI']
    const wrapper = setup()
    await flushPromises()
    expect(desktopDiscover).toHaveBeenCalledWith({})
    expect(discover).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="local-service-create-magpie"]').exists()).toBe(true)
  })

  it('cancels on close and ignores stale results after reopening', async () => {
    const first = Promise.withResolvers<LocalServiceResult[]>()
    const second = Promise.withResolvers<LocalServiceResult[]>()
    discover.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const wrapper = setup()
    const signal = discover.mock.calls[0][1].signal as AbortSignal
    await wrapper.setProps({ active: false })
    expect(signal.aborted).toBe(true)
    await wrapper.setProps({ active: true })
    first.resolve([ollama])
    await flushPromises()
    expect(wrapper.findAll('button')).toHaveLength(0)
    second.resolve([service])
    await flushPromises()
    expect(wrapper.find('[data-testid="local-service-create-magpie"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="local-service-create-ollama"]').exists()).toBe(false)
  })
})

describe('browser AI in the shared discovery row', () => {
  it.each(['available', 'downloadable', 'downloading'] as const)('shows %s Chrome AI without creating a session or downloading', async availability => {
    const create = vi.fn()
    vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue(availability), create })
    discover.mockResolvedValue([])
    const wrapper = setup()
    await flushPromises()
    const chip = wrapper.get('[data-testid="local-service-create-chrome-built-in"]')
    expect(chip.text()).toContain('Chrome AI')
    expect(wrapper.text().includes('localDiscovery.download')).toBe(availability !== 'available')
    await chip.trigger('click')
    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ kind: 'chrome-built-in', availability, baseURL: '' })
    expect(create).not.toHaveBeenCalled()
  })
  it('keeps Chrome discoverable alongside an untouched placeholder but hides any saved or explicitly disabled connection', async () => {
    vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue('available') })
    discover.mockResolvedValue([])
    const placeholder = { id: 'chrome-built-in', providerId: 'chrome-built-in', providerMeta: { id: 'chrome-built-in' }, enabled: false, connectionConfig: {}, activationState: { userConfigured: false } } as TextModelConfig
    const wrapper = setup(true, [placeholder])
    await flushPromises()
    expect(wrapper.findAll('button')).toHaveLength(1)
    await wrapper.setProps({ models: [{ ...placeholder, activationState: { userConfigured: true } }] })
    expect(wrapper.findAll('button')).toHaveLength(0)
    await wrapper.setProps({ models: [{ ...placeholder, enabled: true }] })
    expect(wrapper.findAll('button')).toHaveLength(0)
    await wrapper.setProps({ models: [{ ...placeholder, id: 'custom-chrome-copy' }] })
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
  it('shows browser AI even if every HTTP probe fails', async () => {
    vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue('available') })
    discover.mockRejectedValue(new Error('blocked'))
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.find('[data-testid="local-service-create-chrome-built-in"]').exists()).toBe(true)
  })
  it('ignores late browser capability results on close', async () => {
    const pending = Promise.withResolvers<string>()
    vi.stubGlobal('LanguageModel', { availability: vi.fn().mockReturnValue(pending.promise) })
    discover.mockResolvedValue([])
    const wrapper = setup()
    await wrapper.setProps({ active: false })
    pending.resolve('available')
    await flushPromises()
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
  it('keeps unsupported browsers empty and still displays newly discovered HTTP services', async () => {
    vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue('unavailable') })
    discover.mockResolvedValue([
      { ...service, kind: 'lmstudio', name: 'LM Studio', baseURL: 'http://localhost:1234/v1' },
      { ...service, kind: 'cc-switch', name: 'CC Switch', baseURL: 'http://localhost:15721/v1' },
      { ...service, kind: 'cliproxyapi', name: 'CLIProxyAPI', baseURL: 'http://localhost:8317/v1' },
      { ...service, kind: 'litellm', name: 'LiteLLM', baseURL: 'http://localhost:4000/v1' },
      { ...service, kind: 'llamacpp', name: 'llama.cpp', baseURL: 'http://localhost:9931/v1' },
    ])
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.find('[data-testid="local-service-create-lmstudio"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="local-service-create-cc-switch"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="local-service-create-cliproxyapi"]').find('svg').exists()).toBe(true)
    expect(wrapper.find('[data-testid="local-service-create-litellm"]').find('svg').exists()).toBe(true)
    expect(wrapper.find('[data-testid="local-service-create-llamacpp"]').find('svg').exists()).toBe(true)
    expect(wrapper.find('[data-testid="local-service-create-chrome-built-in"]').exists()).toBe(false)
  })
})
