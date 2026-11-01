import { describe, it, expect, vi } from 'vitest'
import { defineComponent, nextTick, ref, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import {
  TextAdapterRegistry,
  ModelManager,
  MemoryStorageProvider,
  ElectronModelManagerProxy,
  type TextModelConfig
} from '@prompt-optimizer/core'
import { useTextModelManager } from '../../../src/composables/model/useTextModelManager'
import { createDesktopServiceBridge } from '../../../../core/tests/utils/desktop-service-bridge'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

describe('useTextModelManager', () => {
  it.each([
    ['web', true], ['desktop', true], ['web', false], ['desktop', false],
  ] as const)('persists explicit connection clears and preserves untouched credentials (%s, clear=%s)', async (platform, clear) => {
    const registry = new TextAdapterRegistry()
    const adapter = registry.getAdapter('openai-compatible')
    const storage = new MemoryStorageProvider()
    const backend = new ModelManager(storage, registry)
    await backend.addModel('connection-clears', {
      id: 'connection-clears', name: 'Connection', enabled: false,
      providerId: adapter.getProvider().id, modelId: 'custom-model',
      providerMeta: adapter.getProvider(), modelMeta: adapter.buildDefaultModel('custom-model'),
      connectionConfig: { apiKey: 'fixture-key', baseURL: 'https://example.invalid/v1', customHeaders: { 'X-Old': 'value' } },
      paramOverrides: {},
    })
    if (platform === 'desktop') {
      Object.defineProperty(window, 'electronAPI', {
        configurable: true, value: createDesktopServiceBridge({ modelManager: backend }),
      })
    }
    let testedConfig: TextModelConfig | undefined
    const Harness = defineComponent({
      setup: () => ({ manager: useTextModelManager() }),
      template: '<div />',
    })
    const wrapper = mount(Harness, { global: { provide: { services: shallowRef({
      modelManager: platform === 'desktop' ? new ElectronModelManagerProxy() : backend,
      textAdapterRegistry: registry,
      llmService: {
        testConnection: vi.fn(async (id: string) => { testedConfig = await backend.getModel(id) }),
        fetchModelList: vi.fn().mockResolvedValue([]),
      },
    }) } } })
    try {
      const manager = (wrapper.vm as any).manager as ReturnType<typeof useTextModelManager>
      await manager.prepareForEdit('connection-clears')
      if (clear) {
        manager.form.value.connectionConfig.apiKey = ''
        manager.form.value.connectionConfig.customHeaders = {}
        await nextTick()
      }
      await manager.testFormConnection()
      expect(testedConfig).toBeDefined()
      expect(testedConfig?.connectionConfig.apiKey || '').toBe(clear ? '' : 'fixture-key')
      expect(testedConfig?.connectionConfig.customHeaders).toEqual(clear ? undefined : { 'X-Old': 'value' })
      await manager.saveForm()
      const saved = await backend.getModel('connection-clears')
      expect(saved?.connectionConfig.apiKey).toBe(clear ? undefined : 'fixture-key')
      expect(saved?.connectionConfig.customHeaders).toEqual(clear ? undefined : { 'X-Old': 'value' })
      expect(saved?.connectionConfig.baseURL).toBe('https://example.invalid/v1')
    } finally {
      wrapper.unmount()
      Reflect.deleteProperty(window, 'electronAPI')
    }
  })

  it('uses the newly selected provider metadata when testing and saving an edited model', async () => {
    const registry = new TextAdapterRegistry()
    const openaiAdapter = registry.getAdapter('openai')
    const openaiConfig: TextModelConfig = {
      id: 'openai',
      name: 'OpenAI',
      enabled: true,
      providerMeta: openaiAdapter.getProvider(),
      modelMeta: openaiAdapter.buildDefaultModel('gpt-5-mini'),
      connectionConfig: {
        apiKey: 'old-openai-key',
        baseURL: 'https://api.openai.com/v1',
      },
      paramOverrides: {},
    }

    const modelManager = {
      getAllModels: vi.fn().mockResolvedValue([]),
      getModel: vi.fn(async (id: string) => (id === 'openai' ? openaiConfig : undefined)),
      addModel: vi.fn().mockResolvedValue(undefined),
      deleteModel: vi.fn().mockResolvedValue(undefined),
      updateModel: vi.fn().mockResolvedValue(undefined),
      enableModel: vi.fn().mockResolvedValue(undefined),
      disableModel: vi.fn().mockResolvedValue(undefined),
    }
    const llmService = {
      testConnection: vi.fn().mockResolvedValue(undefined),
      fetchModelList: vi.fn().mockResolvedValue([]),
    }

    const Harness = defineComponent({
      setup() {
        const manager = useTextModelManager()
        return { manager }
      },
      template: '<div />',
    })

    const wrapper = mount(Harness, {
      global: {
        provide: {
          services: ref({
            modelManager,
            llmService,
            textAdapterRegistry: registry,
          }),
        },
      },
    })

    const manager = (wrapper.vm as any).manager as ReturnType<typeof useTextModelManager>
    await manager.prepareForEdit('openai')
    manager.selectProvider('openai-compatible')
    manager.form.value.name = 'Custom Gateway'
    manager.form.value.modelId = 'custom-model'
    manager.form.value.connectionConfig.baseURL = 'https://gateway.example.com/v1'
    manager.form.value.connectionConfig.apiKey = 'gateway-key'
    manager.form.value.connectionConfig.customHeaders = {
      'x-auth-token': 'gateway-token',
    }
    await nextTick()

    await manager.testFormConnection()

    expect(modelManager.addModel).toHaveBeenCalledTimes(1)
    const tempConfig = modelManager.addModel.mock.calls[0]?.[1] as TextModelConfig
    expect(tempConfig.providerMeta.id).toBe('openai-compatible')
    expect(tempConfig.modelMeta.providerId).toBe('openai-compatible')
    expect(tempConfig.connectionConfig.customHeaders).toEqual({
      'x-auth-token': 'gateway-token',
    })
    expect(llmService.testConnection).toHaveBeenCalledWith(tempConfig.id)

    await manager.saveForm()

    expect(modelManager.updateModel).toHaveBeenCalledTimes(1)
    const updates = modelManager.updateModel.mock.calls[0]?.[1] as Partial<TextModelConfig>
    expect(updates.providerMeta?.id).toBe('openai-compatible')
    expect(updates.modelMeta?.providerId).toBe('openai-compatible')
    expect(updates.connectionConfig?.customHeaders).toEqual({
      'x-auth-token': 'gateway-token',
    })
  })

  it('treats unknown placeholder configs as unselected drafts and preserves repair inputs', async () => {
    const registry = new TextAdapterRegistry()
    const brokenConfig: TextModelConfig = {
      id: 'broken-model',
      name: 'Broken Model',
      enabled: false,
      providerId: 'unknown',
      modelId: 'unknown',
      providerMeta: {
        id: 'unknown',
        name: 'Unknown Provider',
        requiresApiKey: false,
        defaultBaseURL: '',
        supportsDynamicModels: false,
        connectionSchema: { required: [], optional: [], fieldTypes: {} },
      },
      modelMeta: {
        id: 'unknown',
        name: 'Unknown Model',
        providerId: 'unknown',
        capabilities: {
          supportsTools: false,
        },
        parameterDefinitions: [],
        defaultParameterValues: {},
      },
      connectionConfig: {
        apiKey: 'preserve-key',
        baseURL: 'https://gateway.example.com/v1',
      },
      paramOverrides: {
        temperature: 0.2,
      },
    }

    const modelManager = {
      getAllModels: vi.fn().mockResolvedValue([brokenConfig]),
      getModel: vi.fn(async (id: string) => (id === 'broken-model' ? brokenConfig : undefined)),
      addModel: vi.fn().mockResolvedValue(undefined),
      deleteModel: vi.fn().mockResolvedValue(undefined),
      updateModel: vi.fn().mockResolvedValue(undefined),
      enableModel: vi.fn().mockResolvedValue(undefined),
      disableModel: vi.fn().mockResolvedValue(undefined),
    }
    const llmService = {
      testConnection: vi.fn().mockResolvedValue(undefined),
      fetchModelList: vi.fn().mockResolvedValue([]),
    }

    const Harness = defineComponent({
      setup() {
        const manager = useTextModelManager()
        return { manager }
      },
      template: '<div />',
    })

    const wrapper = mount(Harness, {
      global: {
        provide: {
          services: ref({
            modelManager,
            llmService,
            textAdapterRegistry: registry,
          }),
        },
      },
    })

    const manager = (wrapper.vm as any).manager as ReturnType<typeof useTextModelManager>
    await manager.prepareForEdit('broken-model')

    expect(manager.form.value.providerId).toBe('')
    expect(manager.form.value.modelId).toBe('')
    expect(manager.form.value.connectionConfig.apiKey).toBe('pres****-key')
    expect(manager.form.value.originalApiKey).toBe('preserve-key')
    expect(manager.form.value.connectionConfig.baseURL).toBe('https://gateway.example.com/v1')
    expect(manager.form.value.paramOverrides).toEqual({ temperature: 0.2 })
    expect(manager.canSaveForm.value).toBe(false)
    expect(manager.canTestFormConnection.value).toBe(false)

    manager.selectProvider('openai-compatible')
    await nextTick()

    expect(manager.form.value.providerId).toBe('openai-compatible')
    expect(manager.form.value.modelId).not.toBe('')
    expect(manager.form.value.connectionConfig.apiKey).toBe('pres****-key')
    expect(manager.form.value.originalApiKey).toBe('preserve-key')
    expect(manager.form.value.connectionConfig.baseURL).toBe('https://gateway.example.com/v1')
    expect(manager.form.value.paramOverrides).toEqual({ temperature: 0.2 })
    expect(manager.canSaveForm.value).toBe(true)
  })
})
