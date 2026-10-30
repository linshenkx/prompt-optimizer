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

const { fetchLocalModels } = vi.hoisted(() => ({ fetchLocalModels: vi.fn() }))
vi.mock('@prompt-optimizer/core', async original => ({
  ...await original<typeof import('@prompt-optimizer/core')>(), fetchLocalServiceModels: fetchLocalModels,
}))

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
  fetchLocalModels.mockReset()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.unstubAllGlobals()
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
  return { manager, modelManager, fetchModelList, storage, config, savedBefore }
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


describe('local provider shortcut draft', () => {
  const service = {
    kind: 'magpie' as const, name: 'Magpie', baseURL: 'http://127.0.0.1:4567/v1', status: 'ready' as const,
    models: [{ id: 'first/model', name: 'First' }, { id: 'second/model', name: 'Second' }],
  }

  it.each(['ollama', 'magpie', 'lmstudio', 'cc-switch', 'cliproxyapi', 'litellm', 'llamacpp'] as const)('prefills a %s connection without saving until the user submits', async kind => {
    const { manager, storage, config, savedBefore, fetchModelList } = await setup()
    const before = await storage.getItem(CORE_SERVICE_KEYS.MODELS)
    expect(await manager.prepareForLocalService({ ...service, kind })).toBe(true)
    expect(await storage.getItem(CORE_SERVICE_KEYS.MODELS)).toBe(before)
    expect(manager.form.value).toMatchObject({
      id: '', name: 'Magpie', modelId: '', enabled: true,
      providerId: kind === 'ollama' || kind === 'magpie' ? kind : 'openai-compatible',
      connectionConfig: { baseURL: service.baseURL }, paramOverrides: {},
    })
    expect(manager.editingModelId.value).toBeNull()
    expect(manager.form.value.connectionConfig.apiKey).toBeUndefined()
    expect(manager.form.value.connectionConfig.customHeaders).toBeUndefined()
    expect(fetchModelList).not.toHaveBeenCalled()
    expect(manager.modelOptions.value).toEqual([])
    expect(fetchLocalModels).not.toHaveBeenCalled()
    if (kind === 'magpie') {
      expect(manager.canRefreshModelOptions.value).toBe(false)
      expect(manager.canSaveForm.value).toBe(false)
      await manager.refreshModelOptions()
      expect(fetchModelList).not.toHaveBeenCalled()
      manager.form.value.connectionConfig.apiKey = 'user-entered-test-key'
      expect(manager.canRefreshModelOptions.value).toBe(true)
      expect(fetchModelList).not.toHaveBeenCalled()
    }
    fetchLocalModels.mockResolvedValue([{ value: 'first/model', label: 'First' }])
    await manager.refreshModelOptions()
    expect(fetchLocalModels).toHaveBeenCalledWith(expect.objectContaining({
      kind, baseURL: service.baseURL, apiKey: kind === 'magpie' ? 'user-entered-test-key' : '',
    }), expect.anything())
    expect(fetchModelList).not.toHaveBeenCalled()
    const id = await manager.saveForm()
    const reloaded = new ModelManager(storage, registry)
    expect(await reloaded.getModel(config.id)).toEqual(savedBefore)
    expect(await reloaded.getModel(id!)).toMatchObject({ modelId: 'first/model', connectionConfig: { baseURL: service.baseURL } })
    if (kind !== 'magpie' && kind !== 'ollama') {
      expect((await reloaded.getModel(id!))?.connectionConfig.localServiceKind).toBe(kind)
      await manager.prepareForEdit(id!)
      expect(manager.form.value.connectionConfig.localServiceKind).toBe(kind)
      manager.selectProvider('openai')
      expect(manager.form.value.connectionConfig.localServiceKind).toBeFalsy()
    }
  })

  it('rechecks saved addresses and rejects an existing connection with another model ID', async () => {
    const { manager, modelManager, config } = await setup()
    await modelManager.updateModel(config.id, { connectionConfig: { baseURL: 'http://localhost:4567/' } })
    manager.models.value = []
    const formBefore = JSON.parse(JSON.stringify(manager.form.value))
    expect(await manager.prepareForLocalService(service)).toBe(false)
    expect(manager.form.value).toEqual(formBefore)
    expect(manager.models.value.some(model => model.id === config.id)).toBe(true)
  })

  it('can prepare an empty service catalog and leaves model selection to the user', async () => {
    const { manager, storage } = await setup()
    const before = await storage.getItem(CORE_SERVICE_KEYS.MODELS)
    expect(await manager.prepareForLocalService({ ...service, models: [] })).toBe(true)
    expect(manager.form.value.modelId).toBe('')
    expect(manager.canSaveForm.value).toBe(false)
    expect(await storage.getItem(CORE_SERVICE_KEYS.MODELS)).toBe(before)
  })

  it('requires a browser gateway key for manually selected Magpie too', async () => {
    const { manager, fetchModelList } = await setup()
    await manager.prepareForCreate()
    manager.selectProvider('magpie')
    expect(manager.form.value.modelId).toBe('')
    expect(manager.form.value.connectionConfig.baseURL).toBe('http://127.0.0.1:3425/v1')
    expect(manager.connectionFields.value.find(field => field.name === 'apiKey')?.required).toBe(true)
    expect(manager.canRefreshModelOptions.value).toBe(false)
    await manager.refreshModelOptions()
    expect(fetchModelList).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('localDiscovery.magpieApiKeyHint')
    manager.form.value.connectionConfig.apiKey = 'user-entered-test-key'
    expect(manager.canRefreshModelOptions.value).toBe(true)
  })

  it('keeps Magpie models empty on authentication failure instead of adding static placeholders', async () => {
    const { manager } = await setup()
    await manager.prepareForLocalService(service)
    manager.form.value.connectionConfig.apiKey = 'invalid-test-key'
    fetchLocalModels.mockRejectedValue(new Error('HTTP 401'))
    await manager.refreshModelOptions()
    expect(manager.modelOptions.value).toEqual([])
    expect(manager.form.value.modelId).toBe('')
    expect(manager.canSaveForm.value).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('localDiscovery.magpieApiKeyHint')
    expect(toast.warning).not.toHaveBeenCalled()
    expect(manager.isLoadingModelOptions.value).toBe(false)
  })

  it('discards a cancelled shortcut without adding a connection', async () => {
    const { manager, storage } = await setup()
    const before = await storage.getItem(CORE_SERVICE_KEYS.MODELS)
    await manager.prepareForLocalService(service)
    manager.resetFormState()
    expect(await storage.getItem(CORE_SERVICE_KEYS.MODELS)).toBe(before)
    await manager.prepareForLocalService({ ...service, kind: 'lmstudio' })
    expect(manager.canRefreshModelOptions.value).toBe(true)
  })
})

describe('Chrome discovery draft reuses the built-in connection', () => {
  const service = {
    kind: 'chrome-built-in' as const, name: 'Chrome AI', baseURL: '' as const, status: 'ready' as const,
    availability: 'available' as const, models: [{ id: 'gemini-nano', name: 'Gemini Nano' }],
  }
  it('saves into the existing placeholder only after explicit submission', async () => {
    vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue('available') })
    const { manager, modelManager, storage } = await setup()
    const before = await storage.getItem(CORE_SERVICE_KEYS.MODELS)
    expect(await manager.prepareForLocalService(service)).toBe(true)
    expect(manager.form.value).toMatchObject({ originalId: 'chrome-built-in', providerId: 'chrome-built-in', enabled: true, connectionConfig: {} })
    expect(await storage.getItem(CORE_SERVICE_KEYS.MODELS)).toBe(before)
    expect(await manager.saveForm()).toBe('chrome-built-in')
    const saved = await modelManager.getModel('chrome-built-in')
    expect(saved).toMatchObject({ enabled: true, activationState: { userConfigured: true } })
    expect((await modelManager.getAllModels()).filter(model => model.providerId === 'chrome-built-in')).toHaveLength(1)
    expect(await manager.prepareForLocalService(service)).toBe(false)
  })
  it('cancels without saving, downloading or enabling the placeholder', async () => {
    const create = vi.fn()
    vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue('downloadable'), create })
    const { manager, storage } = await setup()
    const before = await storage.getItem(CORE_SERVICE_KEYS.MODELS)
    await manager.prepareForLocalService({ ...service, availability: 'downloadable' })
    expect(manager.form.value.enabled).toBe(false)
    manager.resetFormState()
    expect(await storage.getItem(CORE_SERVICE_KEYS.MODELS)).toBe(before)
    expect(create).not.toHaveBeenCalled()
  })
  it('respects a user-disabled existing Chrome connection', async () => {
    const { manager, modelManager } = await setup()
    await modelManager.updateModel('chrome-built-in', { enabled: false, activationState: { userConfigured: true } })
    expect(await manager.prepareForLocalService(service)).toBe(false)
    expect((await modelManager.getModel('chrome-built-in'))?.enabled).toBe(false)
  })
})

describe('CC Switch protocol drafts', () => {
  it.each(['anthropic', 'openai-compatible'] as const)('prefills the detected %s protocol', async providerId => {
    const { manager } = await setup()
    const requestStyle = providerId === 'openai-compatible' ? 'responses' as const : undefined
    await manager.prepareForLocalService({ kind: 'cc-switch', name: 'CC Switch', status: 'ready', baseURL: 'http://localhost:15721', models: [{ id: 'routed-model', name: 'Routed' }], providerId, requestStyle })
    expect(manager.form.value.providerId).toBe(providerId)
    expect(manager.form.value.connectionConfig.requestStyle).toBe(requestStyle)
    expect(manager.form.value.connectionConfig.apiKey).toBeUndefined()
    expect(manager.form.value.modelId).toBe('')
    expect(manager.canRefreshModelOptions.value).toBe(true)
    fetchLocalModels.mockResolvedValue([{ value: 'routed-model', label: 'Routed' }])
    await manager.refreshModelOptions()
    expect(manager.form.value.modelId).toBe('routed-model')
    expect(manager.canTestFormConnection.value).toBe(true)
    expect(manager.form.value.connectionConfig.apiKey).toBeUndefined()
  })
})

describe('local catalog request lifecycle', () => {
  const service = { kind: 'lmstudio' as const, name: 'LM Studio', status: 'ready' as const, models: [], baseURL: 'http://localhost:1234/v1' }
  it('requests a user key after 401 without losing discovery or inventing a model', async () => {
    const { manager } = await setup()
    await manager.prepareForLocalService(service)
    fetchLocalModels.mockRejectedValue(new Error('HTTP 401'))
    await manager.refreshModelOptions()
    expect(manager.canRefreshModelOptions.value).toBe(false)
    expect(manager.modelOptions.value).toEqual([])
    expect(toast.error).toHaveBeenCalledWith('localDiscovery.apiKeyHint')
    manager.form.value.connectionConfig.apiKey = 'entered-key'
    expect(manager.canRefreshModelOptions.value).toBe(true)
  })
  it.each(['cancel', 'close', 'key', 'address'] as const)('ignores a late catalog after %s changes', async change => {
    const { manager } = await setup()
    await manager.prepareForLocalService(service)
    const pending = Promise.withResolvers<ModelOption[]>()
    fetchLocalModels.mockReturnValue(pending.promise)
    const refreshing = manager.refreshModelOptions()
    if (change === 'cancel') {
      manager.resetFormState()
      await manager.prepareForLocalService(service)
      expect(manager.canRefreshModelOptions.value).toBe(true)
    }
    else if (change === 'close') {
      manager.cancelLocalModelRequest()
      expect(manager.isLoadingModelOptions.value).toBe(false)
    }
    else if (change === 'key') manager.form.value.connectionConfig.apiKey = 'changed-key'
    else manager.form.value.connectionConfig.baseURL = 'http://localhost:4321/v1'
    pending.resolve([{ value: 'old-response', label: 'Old' }])
    await refreshing
    expect(manager.modelOptions.value).toEqual([])
    expect(manager.form.value.modelId).toBe('')
  })
})
