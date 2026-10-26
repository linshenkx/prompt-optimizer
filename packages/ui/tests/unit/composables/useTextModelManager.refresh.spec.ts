import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import {
  CORE_SERVICE_KEYS,
  MemoryStorageProvider,
  ModelManager,
  TextAdapterRegistry,
  type ModelOption,
  type TextModelConfig,
} from '@prompt-optimizer/core'
import { useTextModelManager } from '../../../src/composables/model/useTextModelManager'
import { allowConsole } from '../../utils/error-detection'

vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))

const toast = vi.hoisted(() => ({
  success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(),
}))
vi.mock('../../../src/composables/ui/useToast', () => ({ useToast: () => toast }))

const registry = new TextAdapterRegistry()
// Exercise every provider exposing list refresh, including native SDK providers
// and OpenAI-compatible gateways. Chrome's local model has no list endpoint.
const providers = registry.getAllProviders().filter(provider => provider.supportsDynamicModels)
const wrappers: VueWrapper[] = []
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.clearAllMocks()
})

async function setup(providerId = 'openai-compatible', modelId = 'saved-private-model') {
  const adapter = registry.getAdapter(providerId)
  const providerMeta = adapter.getProvider()
  const modelMeta = adapter.buildDefaultModel(modelId)
  const storage = new MemoryStorageProvider()
  const config: TextModelConfig = {
    id: `saved-refresh-${providerId}`,
    name: 'My saved model',
    enabled: true,
    providerId,
    modelId,
    providerMeta,
    modelMeta: {
      ...modelMeta,
      name: 'Saved model metadata',
      capabilities: { ...modelMeta.capabilities, supportsTools: false },
    },
    connectionConfig: {
      apiKey: 'private-fixture-key',
      baseURL: 'https://private-gateway.example/v1',
      ...(providerMeta.connectionSchema.optional.includes('requestStyle')
        ? { requestStyle: 'chat_completions' } : {}),
      ...(providerId === 'cloudflare' ? { accountId: 'fixture-account' } : {}),
      ...(providerId === 'openai-compatible' ? {
        customHeaders: { 'x-gateway-auth': 'private-header' },
        requestStyle: 'responses',
      } : {}),
    },
    paramOverrides: { temperature: 0.35 },
  }
  await storage.setItem(CORE_SERVICE_KEYS.MODELS, JSON.stringify({ [config.id]: config }))
  const modelManager = new ModelManager(storage, registry)
  await modelManager.ensureInitialized()
  const fetchModelList = vi.fn<(...args: unknown[]) => Promise<ModelOption[]>>()
  const Harness = defineComponent({
    setup: () => ({ manager: useTextModelManager() }),
    template: '<div />',
  })
  const wrapper = mount(Harness, {
    global: { provide: { services: ref({
      modelManager, textAdapterRegistry: registry, llmService: { fetchModelList },
    }) } },
  })
  wrappers.push(wrapper)
  const manager = wrapper.vm.manager
  await manager.prepareForEdit(config.id)
  const savedBefore = JSON.parse(JSON.stringify(await modelManager.getModel(config.id))) as TextModelConfig
  return { manager, fetchModelList, storage, config, savedBefore }
}

describe.each(providers)('model list refresh: $id', provider => {
  it.each(['missing', 'present', 'empty', 'failure'] as const)(
    'preserves the selected model and saved configuration when the response is %s',
    async response => {
      const { manager, fetchModelList, storage, config, savedBefore } = await setup(provider.id)
      const formBefore = JSON.parse(JSON.stringify(manager.form.value))
      const storedBefore = await storage.getItem(CORE_SERVICE_KEYS.MODELS)
      const options: ModelOption[] = response === 'empty' ? [] : [
        { value: 'new-recommended-model', label: 'New recommendation' },
        ...(response === 'present' ? [{ value: config.modelId!, label: 'Server model name' }] : []),
      ]
      const optionsBefore = structuredClone(options)
      if (response === 'failure') {
        allowConsole(/^Failed to fetch model list: /)
        fetchModelList.mockRejectedValue(new Error('fixture list unavailable'))
      } else {
        fetchModelList.mockResolvedValue(options)
      }

      await manager.refreshModelOptions()

      expect(fetchModelList).toHaveBeenCalledWith(provider.id, expect.objectContaining({
        modelId: config.modelId,
        connectionConfig: expect.objectContaining(config.connectionConfig),
      }))
      expect(manager.form.value).toEqual(formBefore)
      expect(await storage.getItem(CORE_SERVICE_KEYS.MODELS)).toBe(storedBefore)
      expect(manager.isLoadingModelOptions.value).toBe(false)
      expect(manager.modelOptions.value.filter(option => option.value === config.modelId)).toEqual([
        { value: config.modelId, label: response === 'present' ? 'Server model name' : config.modelId },
      ])
      if (response !== 'failure') {
        expect(manager.modelOptions.value.slice(0, options.length)).toEqual(optionsBefore)
        expect(options).toEqual(optionsBefore)
        expect(toast.success).toHaveBeenCalledTimes(1)
      } else {
        expect(toast.success).not.toHaveBeenCalled()
        const hasStaticModels = registry.getStaticModels(provider.id).length > 0
        expect(hasStaticModels ? toast.warning : toast.error).toHaveBeenCalledTimes(1)
      }

      // Refresh alone must not write; saving and recreating the manager must
      // retain credentials, explicit parameters, and the existing metadata.
      const beforeSave = new ModelManager(storage, registry)
      expect(await beforeSave.getModel(config.id)).toEqual(savedBefore)
      expect(await manager.saveForm()).toBe(config.id)
      const reloaded = new ModelManager(storage, registry)
      expect(await reloaded.getModel(config.id)).toEqual(savedBefore)
    },
  )
})

describe('model list refresh selection boundaries', () => {
  it.each(['empty', 'unavailable'] as const)('retains the selection when static fallback is %s', async fallback => {
    const { manager, fetchModelList, storage, config, savedBefore } = await setup()
    allowConsole(/^Failed to fetch model list: /)
    fetchModelList.mockRejectedValue(new Error('fixture list unavailable'))
    const staticModels = vi.spyOn(registry, 'getStaticModels')
    if (fallback === 'empty') {
      staticModels.mockReturnValue([])
    } else {
      allowConsole(/^Failed to load provider models: /)
      staticModels.mockImplementation(() => { throw new Error('fixture static list unavailable') })
    }

    await manager.refreshModelOptions()

    expect(manager.form.value.modelId).toBe(config.modelId)
    expect(manager.form.value.defaultModel).toBe(config.modelId)
    expect(manager.modelOptions.value).toEqual([{ value: config.modelId, label: config.modelId }])
    expect(manager.isLoadingModelOptions.value).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('modelManager.fetchModelsFailed')
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
    await manager.saveForm()
    expect(await new ModelManager(storage, registry).getModel(config.id)).toEqual(savedBefore)
  })

  it('retains the saved capability snapshot even for a currently recommended model', async () => {
    const modelId = registry.getStaticModels('minimax')[0].id
    const { manager, fetchModelList, storage, config, savedBefore } = await setup('minimax', modelId)
    fetchModelList.mockResolvedValue([{ value: modelId, label: 'Current recommendation' }])

    await manager.refreshModelOptions()
    await manager.saveForm()

    expect((await new ModelManager(storage, registry).getModel(config.id))?.modelMeta).toEqual(savedBefore?.modelMeta)
  })

  it.each(['create', 'clone'] as const)('preserves a nonempty %s draft through refresh and save', async mode => {
    const { manager, fetchModelList, storage, config, savedBefore } = await setup()
    if (mode === 'clone') {
      await manager.prepareForClone(config.id)
    } else {
      await manager.prepareForCreate()
      manager.selectProvider('openai-compatible')
      manager.onModelChange('my-private-draft-model')
      manager.form.value.connectionConfig.baseURL = 'https://draft-gateway.example/v1'
    }
    manager.form.value.name = `New ${mode} draft`
    const modelId = manager.form.value.modelId
    fetchModelList.mockResolvedValue([{ value: 'recommended-model', label: 'Recommendation' }])

    await manager.refreshModelOptions()
    await manager.saveForm()

    const reloaded = new ModelManager(storage, registry)
    const savedDraft = (await reloaded.getAllModels()).find(model => model.name === `New ${mode} draft`)
    expect(savedDraft?.modelId).toBe(modelId)
    expect(await reloaded.getModel(config.id)).toEqual(savedBefore)
  })

  it('only chooses the first returned model for an empty selection', async () => {
    const { manager, fetchModelList } = await setup()
    manager.form.value.modelId = ''
    manager.form.value.defaultModel = ''
    fetchModelList.mockResolvedValue([{ value: 'first-model', label: 'First model' }])

    await manager.refreshModelOptions(false)

    expect(manager.form.value.modelId).toBe('first-model')
    expect(manager.form.value.defaultModel).toBe('first-model')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('does not select a model when an empty draft receives an empty list', async () => {
    const { manager, fetchModelList } = await setup()
    manager.form.value.modelId = ''
    manager.form.value.defaultModel = ''
    fetchModelList.mockResolvedValue([])

    await manager.refreshModelOptions()

    expect(manager.form.value.modelId).toBe('')
    expect(manager.form.value.defaultModel).toBe('')
    expect(manager.modelOptions.value).toEqual([])
  })

  it('preserves a selection changed while refresh is pending', async () => {
    const { manager, fetchModelList } = await setup()
    const { promise, resolve } = Promise.withResolvers<ModelOption[]>()
    fetchModelList.mockReturnValue(promise)
    const refreshing = manager.refreshModelOptions()
    await vi.waitFor(() => expect(fetchModelList).toHaveBeenCalledOnce())
    manager.onModelChange('my-new-selection')
    resolve([{ value: 'server-recommendation', label: 'Recommendation' }])

    await refreshing

    expect(manager.form.value.modelId).toBe('my-new-selection')
    expect(manager.form.value.defaultModel).toBe('my-new-selection')
    expect(manager.modelOptions.value).toContainEqual({ value: 'my-new-selection', label: 'my-new-selection' })
  })

  it('retains intentional provider switching and first-model defaults', async () => {
    const { manager } = await setup()

    manager.selectProvider('minimax')

    expect(manager.form.value.providerId).toBe('minimax')
    expect(manager.form.value.modelId).toBe(registry.getStaticModels('minimax')[0].id)
    expect(manager.form.value.defaultModel).toBe(manager.form.value.modelId)
  })
})
