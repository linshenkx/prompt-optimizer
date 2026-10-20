import { describe, it, expect, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import {
  TextAdapterRegistry,
  type TextModelConfig
} from '@prompt-optimizer/core'
import { useTextModelManager } from '../../../src/composables/model/useTextModelManager'
import { allowConsole } from '../../utils/error-detection'

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
  const mountMiniMaxManager = (providerId = 'minimax', modelId = 'MiniMax-M2.7') => {
    const registry = new TextAdapterRegistry()
    const adapter = registry.getAdapter(providerId)
    const saved: TextModelConfig = {
      id: 'saved-minimax', name: 'Saved MiniMax', enabled: true, providerId, modelId,
      providerMeta: adapter.getProvider(), modelMeta: adapter.buildDefaultModel(modelId),
      connectionConfig: { apiKey: 'saved-key', baseURL: adapter.getProvider().defaultBaseURL },
      paramOverrides: { max_tokens: 123, custom_flag: true }
    }
    const modelManager = {
      getAllModels: vi.fn().mockResolvedValue([saved]),
      getModel: vi.fn().mockResolvedValue(saved),
      addModel: vi.fn().mockResolvedValue(undefined),
      updateModel: vi.fn().mockResolvedValue(undefined)
    }
    const llmService = {
      fetchModelList: vi.fn().mockResolvedValue([
        { value: 'MiniMax-M3.1-Flash', label: 'MiniMax M3.1 Flash' },
        { value: 'MiniMax-M3', label: 'MiniMax M3' }
      ])
    }
    const wrapper = mount(defineComponent({
      setup: () => ({ manager: useTextModelManager() }), template: '<div />'
    }), {
      global: { provide: { services: ref({ modelManager, llmService, textAdapterRegistry: registry }) } }
    })
    const manager = (wrapper.vm as unknown as { manager: ReturnType<typeof useTextModelManager> }).manager
    return { wrapper, manager, modelManager, llmService, saved }
  }

  it('selects Flash for a new MiniMax configuration and offers only the current static catalog', async () => {
    const { wrapper, manager } = mountMiniMaxManager()
    await manager.prepareForCreate()
    manager.selectProvider('minimax')
    await nextTick()
    expect(manager.form.value.modelId).toBe('MiniMax-M3.1-Flash')
    expect(manager.modelOptions.value.map(model => model.value)).toEqual(['MiniMax-M3.1-Flash', 'MiniMax-M3'])
    expect(manager.form.value.paramOverrides).toEqual({ reasoning_effort: 'max' })
    const effort = manager.currentParameterDefinitions.value.find(parameter => parameter.name === 'reasoning_effort')
    expect(effort?.allowedValues).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
    manager.onModelChange('MiniMax-M3')
    expect(manager.form.value.paramOverrides).toEqual({})
    expect(manager.currentParameterDefinitions.value.some(parameter => parameter.name === 'reasoning_effort')).toBe(false)
    wrapper.unmount()
  })

  it.each([
    ['minimax', 'MiniMax-M2.7', 'success'],
    ['minimax', 'private-model', 'success'],
    ['openrouter', 'minimax/minimax-m2.7', 'success'],
    ['minimax', 'MiniMax-M2.7', 'empty'],
    ['minimax', 'MiniMax-M2.7', 'failure'],
    ['openrouter', 'minimax/minimax-m2.7', 'failure']
  ])('preserves %s / %s through edit, %s refresh, save and clone', async (providerId, modelId, result) => {
    const { wrapper, manager, modelManager, llmService, saved } = mountMiniMaxManager(providerId, modelId)
    const before = JSON.stringify(saved)
    if (providerId === 'openrouter') {
      llmService.fetchModelList.mockResolvedValue([
        { value: 'minimax/minimax-m3.1-flash:free', label: 'Flash' },
        { value: 'minimax/minimax-m3', label: 'M3' }
      ])
    }
    if (result === 'empty') llmService.fetchModelList.mockResolvedValue([])
    if (result === 'failure') {
      allowConsole(/^Failed to fetch model list:/)
      llmService.fetchModelList.mockRejectedValue(new Error('Offline fixture'))
    }
    await manager.prepareForEdit(saved.id)
    expect(manager.form.value.modelId).toBe(modelId)
    await manager.refreshModelOptions(false)
    expect(manager.form.value.modelId).toBe(modelId)
    expect(manager.modelOptions.value.some(model => model.value === modelId)).toBe(true)
    expect(manager.form.value.paramOverrides).toEqual(saved.paramOverrides)
    await manager.saveForm()
    expect(modelManager.updateModel).toHaveBeenCalledWith(saved.id, expect.objectContaining({
      modelId, modelMeta: expect.objectContaining({ id: modelId }),
      connectionConfig: expect.objectContaining({ apiKey: 'saved-key' }),
      paramOverrides: { max_tokens: 123, custom_flag: true }
    }))
    await manager.prepareForClone(saved.id)
    expect(manager.form.value.modelId).toBe(modelId)
    expect(manager.form.value.paramOverrides).toEqual(saved.paramOverrides)
    expect(JSON.stringify(saved)).toBe(before)
    wrapper.unmount()
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
