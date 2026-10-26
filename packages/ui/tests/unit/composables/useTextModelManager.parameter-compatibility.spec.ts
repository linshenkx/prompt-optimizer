import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import {
  CORE_SERVICE_KEYS, MemoryStorageProvider, ModelManager, TextAdapterRegistry,
  type TextModelConfig,
} from '@prompt-optimizer/core'
import { useTextModelManager } from '../../../src/composables/model/useTextModelManager'
import { useModelAdvancedParameters } from '../../../src/composables/model/useModelAdvancedParameters'

vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const wrappers: VueWrapper[] = []
beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}) })
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })

async function setup(baseURL?: string) {
  const registry = new TextAdapterRegistry()
  const adapter = registry.getAdapter('openai')
  const model = copy({ ...adapter.getModels()[0] })
  model.parameterDefinitions = model.parameterDefinitions.filter(definition => definition.name !== 'reasoning_effort')
  model.parameterDefinitions.find(definition => definition.name === 'max_tokens')!.maxValue = 64000
  model.parameterDefinitions.find(definition => definition.name === 'max_tokens')!.max = 64000
  model.parameterDefinitions = [...model.parameterDefinitions, { name: 'vendor_knob', type: 'number', maxValue: 10 }]
  model.capabilities = { supportsTools: false, supportsReasoning: false, maxContextLength: 4096 }
  model.defaultParameterValues = { max_tokens: 64 }
  const config: TextModelConfig = {
    id: 'legacy-parameters', name: 'Original name', enabled: true,
    providerId: 'openai', modelId: model.id, providerMeta: adapter.getProvider(), modelMeta: model,
    connectionConfig: { apiKey: 'fixture-key', baseURL: baseURL ?? adapter.getProvider().defaultBaseURL, requestStyle: 'chat_completions' },
    paramOverrides: { max_tokens: 96000, vendor_knob: 2 },
  }
  const storage = new MemoryStorageProvider()
  await storage.setItem(CORE_SERVICE_KEYS.MODELS, JSON.stringify({ [config.id]: config }))
  const modelManager = new ModelManager(storage, registry)
  await modelManager.ensureInitialized()
  const llmService = { testConnection: vi.fn().mockResolvedValue(undefined) }
  const Harness = defineComponent({ setup: () => ({ manager: useTextModelManager() }), template: '<div />' })
  const wrapper = mount(Harness, {
    global: { provide: { services: ref({ modelManager, llmService, textAdapterRegistry: registry }) } },
  })
  wrappers.push(wrapper)
  const manager = wrapper.vm.manager
  await manager.prepareForEdit(config.id)
  return { manager, storage, registry, config, llmService }
}

describe('editing saved parameter definitions', () => {
  it('shows current known options without altering saved metadata, overrides or defaults', async () => {
    const { manager, storage, registry, config } = await setup()
    const before = await storage.getItem(CORE_SERVICE_KEYS.MODELS)
    expect(manager.currentParameterDefinitions.value.find(definition => definition.name === 'max_tokens')?.maxValue).toBe(1000000)
    expect(manager.currentParameterDefinitions.value.some(definition => definition.name === 'reasoning_effort')).toBe(true)
    expect(manager.currentParameterDefinitions.value.find(definition => definition.name === 'vendor_knob')?.maxValue).toBe(10)
    expect(manager.form.value.paramOverrides).toEqual(config.paramOverrides)
    expect(await storage.getItem(CORE_SERVICE_KEYS.MODELS)).toBe(before)

    manager.form.value.name = 'Renamed'
    await manager.saveForm()

    expect(await new ModelManager(storage, registry).getModel(config.id)).toEqual({ ...config, name: 'Renamed' })
  })

  it('saves an added option and a changed value under the current definitions', async () => {
    const { manager, storage, registry, config } = await setup()
    manager.updateParamOverrides({ max_tokens: 128000, reasoning_effort: 'xhigh' })
    await manager.saveForm()
    const saved = await new ModelManager(storage, registry).getModel(config.id)
    expect(saved?.paramOverrides).toEqual({ max_tokens: 128000, reasoning_effort: 'xhigh' })
    expect(saved?.modelMeta).toEqual(config.modelMeta)
  })

  it('rejects edited out-of-range values, retaining persisted data', async () => {
    const { manager, storage } = await setup()
    const before = await storage.getItem(CORE_SERVICE_KEYS.MODELS)
    manager.updateParamOverrides({ max_tokens: 1000001 })
    await expect(manager.saveForm()).rejects.toThrow('maximum value')
    expect(manager.isSaving.value).toBe(false)
    expect(await storage.getItem(CORE_SERVICE_KEYS.MODELS)).toBe(before)
  })

  it('preserves private gateway rules while allowing unrelated edits of existing values', async () => {
    const { manager, storage, registry, config } = await setup('https://private-gateway.example/v1')
    expect(manager.currentParameterDefinitions.value.find(definition => definition.name === 'max_tokens')?.maxValue).toBe(64000)
    expect(manager.currentParameterDefinitions.value.some(definition => definition.name === 'reasoning_effort')).toBe(false)
    manager.form.value.name = 'Private gateway'
    await manager.saveForm()
    expect(await new ModelManager(storage, registry).getModel(config.id)).toEqual({ ...config, name: 'Private gateway' })
    manager.updateParamOverrides({ max_tokens: 128000 })
    await expect(manager.saveForm()).rejects.toThrow('64000')
  })

  it('does not reintroduce deleted overrides on reopen', async () => {
    const { manager, config } = await setup()
    manager.updateParamOverrides({})
    await manager.saveForm()
    await manager.prepareForEdit(config.id)
    expect(manager.form.value.paramOverrides).toEqual({})
  })

  it('keeps image parameter resolution and default application behavior unchanged', () => {
    const registry = new TextAdapterRegistry()
    const savedModel = {
      id: 'saved-image', parameterDefinitions: [{ name: 'width', type: 'integer' as const, maxValue: 1024 }],
      defaultParameterValues: { width: 512 },
    }
    let overrides: Record<string, unknown> = {}
    const advanced = useModelAdvancedParameters({
      mode: 'image', registry: ref(registry), providerId: ref('openai'), modelId: ref(savedModel.id),
      savedModelMeta: ref(savedModel), connectionConfig: ref({}),
      getParamOverrides: () => overrides, setParamOverrides: value => { overrides = value },
    })
    expect(advanced.currentParameterDefinitions.value).toEqual(savedModel.parameterDefinitions)
    advanced.applyDefaultsFromModel()
    expect(overrides).toEqual({ width: 512 })
  })
})
