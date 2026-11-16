import { describe, expect, it, vi } from 'vitest'
import { ModelManager } from '../../../src/services/model/manager'
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import { CORE_SERVICE_KEYS } from '../../../src/constants/storage-keys'
import { decodeTextModelSelection, encodeTextModelSelection } from '../../../src/services/model/selection'
import { LLMService } from '../../../src/services/llm/service'
import { ElectronModelManagerProxy } from '../../../src/services/model/electron-proxy'
import { decodeImageModelSelection, encodeImageModelSelection, cleanLocalParameterOverrides } from '../../../src/services/model/selection'
import { ImageModelManager } from '../../../src/services/image-model/manager'
import { createImageAdapterRegistry } from '../../../src/services/image/adapters/registry'
import { ImageService } from '../../../src/services/image/service'
import { describeRuntimeModel, resolveRuntimeTextModel } from '../../../src/services/model/runtime-selection'
import { resolveTextModelSelection } from '../../../src/services/model/selection'

async function setup() {
  const registry = new TextAdapterRegistry()
  const adapter = registry.getAdapter('openai')
  const models = adapter.getModels()
  const storage = new MemoryStorageProvider()
  const manager = new ModelManager(storage, registry)
  await manager.ensureInitialized()
  await manager.addModel('connection', {
    id: 'connection', name: 'Office gateway', enabled: true,
    providerId: 'openai', modelId: models[0].id,
    providerMeta: adapter.getProvider(), modelMeta: models[0],
    connectionConfig: { apiKey: 'test-only-key', baseURL: 'http://localhost:9999/v1' },
  })
  return { registry, adapter, models, storage, manager }
}

describe('workspace-local text model selections', () => {
  it('isolates parameters for the same model, survives a new manager, and sends them through the real service', async () => {
    const { registry, adapter, manager, models, storage } = await setup()
    const before = await storage.getItem(CORE_SERVICE_KEYS.MODELS)
    const a = encodeTextModelSelection('connection', models[0].id, { reasoning_effort: 'high', temperature: 0.6 })
    const b = encodeTextModelSelection('connection', models[0].id, { reasoning_effort: 'none' })
    const send = vi.spyOn(adapter, 'sendMessageStream').mockResolvedValue()
    const service = new LLMService(manager, registry)
    await Promise.all([a, b].map(key => service.sendMessageStream([{ role: 'user', content: 'task' }], key, { onToken() {}, onComplete() {}, onError() {} })))
    expect(send.mock.calls[0][1].paramOverrides).toMatchObject({ reasoning_effort: 'high', temperature: 0.6 })
    expect(send.mock.calls[1][1].paramOverrides).toMatchObject({ reasoning_effort: 'none' })
    expect((await new ModelManager(storage, registry).getModel(a))?.paramOverrides).toMatchObject({ reasoning_effort: 'high' })
    expect(await storage.getItem(CORE_SERVICE_KEYS.MODELS)).toBe(before)
    expect(encodeTextModelSelection('connection', models[0].id, {})).toBe(encodeTextModelSelection('connection', models[0].id))
  })

  it('round-trips local image parameters without persisting a configuration or adding animation defaults', async () => {
    const registry = createImageAdapterRegistry()
    const adapter = registry.getAdapter('openai')
    const storage = new MemoryStorageProvider()
    const manager = new ImageModelManager(storage, registry)
    const model = adapter.buildDefaultModel('gpt-image-2.6-flare')
    await storage.setItem(CORE_SERVICE_KEYS.IMAGE_MODELS, JSON.stringify({ image: { id: 'image', name: 'Image', enabled: true,
      providerId: 'openai', modelId: model.id, provider: adapter.getProvider(), model, connectionConfig: { apiKey: 'test-key' }, paramOverrides: { output_format: 'png' } } }))
    const before = await storage.getItem(CORE_SERVICE_KEYS.IMAGE_MODELS)
    const key = encodeImageModelSelection('image', model.id, { output_format: 'gif', size: 'auto' })
    expect(decodeImageModelSelection(key)?.paramOverrides).toEqual({ output_format: 'gif', size: 'auto' })
    const generate = vi.spyOn(adapter, 'generate').mockResolvedValue({ images: [] })
    await new ImageService(manager, registry).generateText2Image({ configId: key, prompt: 'A flower' })
    expect(generate.mock.calls[0][1].paramOverrides).toMatchObject({ output_format: 'gif', size: 'auto' })
    expect(generate.mock.calls[0][1].paramOverrides).not.toHaveProperty('frame_count')
    expect((await manager.getConfig('image'))?.paramOverrides?.output_format).toBe('png')
    expect((await new ImageModelManager(storage, registry).getConfig(key))?.paramOverrides?.output_format).toBe('gif')
    expect(await storage.getItem(CORE_SERVICE_KEYS.IMAGE_MODELS)).toBe(before)
  })

  it('excludes root connection and prototype keys while preserving nested request data', () => {
    const overrides = JSON.parse('{"apiKey":"secret","access_token":"secret","clientSecret":"secret","baseURL":"https://private.test","__proto__":{},"max_tokens":42,"extra_body":{"password":"secret","thinking":true}}')
    expect(cleanLocalParameterOverrides(overrides)).toEqual({ extra_body: { password: 'secret', thinking: true }, max_tokens: 42 })
    expect(decodeTextModelSelection(encodeTextModelSelection('a', 'b', overrides))?.paramOverrides).toEqual({ extra_body: { password: 'secret', thinking: true }, max_tokens: 42 })
    expect(decodeTextModelSelection('text-selection:v1:' + encodeURIComponent(JSON.stringify(['a', 'b', []])))).toBeNull()
  })

  it('preserves complete JSON values and business field names in text, image and execution snapshots', async () => {
    const parameters = { response_format: { type: 'json_schema', json_schema: { name: 'answer', schema: {
      type: 'object', properties: { password: { type: 'string' }, endpoint: { type: 'string' },
        headers: { type: 'object' }, note: { default: null } }, required: ['password', 'endpoint'],
      additionalProperties: false,
    } } }, extension: { values: [null, false, 0, ''], optional: null }, nullable: null }
    const before = JSON.stringify(parameters)
    expect(decodeTextModelSelection(encodeTextModelSelection('a', 'b', parameters))?.paramOverrides).toEqual(parameters)
    expect(decodeImageModelSelection(encodeImageModelSelection('a', 'b', parameters))?.paramOverrides).toEqual(parameters)
    const { manager } = await setup()
    const config = (await manager.getModel('connection'))!
    config.paramOverrides = parameters
    expect(describeRuntimeModel(config).parameters.response_format).toEqual(parameters.response_format)
    expect(JSON.stringify(parameters)).toBe(before)
  })

  it('uses identical inheritance in normal and arena selections when changing models', async () => {
    const { registry, manager, models } = await setup()
    const config = (await manager.getModel('connection'))!
    config.modelMeta = { ...config.modelMeta, parameterDefinitions: [...config.modelMeta.parameterDefinitions,
      { name: 'old_model_only', type: 'integer' }] }
    config.customParamOverrides = { legacy_extension: { enabled: false } }
    config.paramOverrides = { temperature: 0.6, old_model_only: 7, gateway_extension: { limit: 2 } }
    const before = JSON.stringify(config)
    for (const paramOverrides of [undefined, {}, { temperature: 0.2 }]) {
      const selection = { configId: config.id, modelId: models[1].id, paramOverrides }
      const normal = resolveTextModelSelection(config, selection, registry)
      const arena = resolveRuntimeTextModel(config, selection, registry)
      expect(normal.paramOverrides).toEqual(arena.paramOverrides)
      expect(normal.paramOverrides).toMatchObject({ legacy_extension: { enabled: false }, gateway_extension: { limit: 2 },
        temperature: paramOverrides?.temperature ?? 0.6 })
      expect(normal.paramOverrides).not.toHaveProperty('old_model_only')
      expect(normal.modelMeta.id).toBe(models[1].id)
      expect(normal.customParamOverrides).toBeUndefined()
    }
    expect(JSON.stringify(config)).toBe(before)
  })

  it('executes the image model pinned by the selection after its shared configuration changes', async () => {
    const registry = createImageAdapterRegistry()
    const adapter = registry.getAdapter('openai')
    const model = adapter.buildDefaultModel('gpt-image-2.6-flare')
    const replacement = adapter.buildDefaultModel('gpt-image-2.5-flare')
    const storage = new MemoryStorageProvider()
    const manager = new ImageModelManager(storage, registry)
    const key = encodeImageModelSelection('image', model.id, { output_format: 'png' })
    await storage.setItem(CORE_SERVICE_KEYS.IMAGE_MODELS, JSON.stringify({ image: { id: 'image', name: 'Image', enabled: true,
      providerId: 'openai', modelId: replacement.id, provider: adapter.getProvider(), model: replacement,
      connectionConfig: { apiKey: 'test-only-key' } } }))
    const generate = vi.spyOn(adapter, 'generate').mockResolvedValue({ images: [] })
    await new ImageService(manager, registry).generateText2Image({ configId: key, prompt: 'A flower' })
    expect(generate.mock.calls[0][1]).toMatchObject({ modelId: model.id, model: { id: model.id } })
    expect((await manager.getConfig('image'))?.modelId).toBe(replacement.id)
  })

  it('resolves the same local selection in the Electron renderer without an IPC configuration write', async () => {
    const { manager, models } = await setup()
    const config = await manager.getModel('connection')
    const updateModel = vi.fn()
    vi.stubGlobal('window', { electronAPI: { model: { getAllModels: async () => [config], updateModel } } })
    try {
      const proxy = new ElectronModelManagerProxy()
      expect((await proxy.getModel(encodeTextModelSelection('connection', models[1].id)))?.modelMeta.id).toBe(models[1].id)
      expect(updateModel).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })
  it('round-trips private IDs without embedding credentials; malformed references stay invalid', () => {
    const key = encodeTextModelSelection('工作/配置:#1', 'private/model:latest')
    expect(decodeTextModelSelection(key)).toEqual({ configId: '工作/配置:#1', modelId: 'private/model:latest' })
    expect(decodeTextModelSelection('ordinary-config')).toBeNull()
    expect(decodeTextModelSelection('text-selection:v1:%broken')).toBeNull()
    expect(decodeTextModelSelection('text-selection:v1:%5B1%2C2%5D')).toBeNull()
  })

  it('resolves simultaneous column choices independently without writing or changing the saved configuration', async () => {
    const { manager, models, storage } = await setup()
    const before = await storage.getItem(CORE_SERVICE_KEYS.MODELS)
    const [a, b] = await Promise.all([
      manager.getModel(encodeTextModelSelection('connection', models[0].id)),
      manager.getModel(encodeTextModelSelection('connection', models[1].id)),
    ])
    expect(a?.modelId).toBe(models[0].id)
    expect(b?.modelId).toBe(models[1].id)
    expect(b?.modelMeta.id).toBe(models[1].id)
    expect(b?.connectionConfig).toEqual(a?.connectionConfig)
    expect((await manager.getModel('connection'))?.modelId).toBe(models[0].id)
    expect(await storage.getItem(CORE_SERVICE_KEYS.MODELS)).toBe(before)
    expect((await manager.exportData()).some(model => model.id.startsWith('text-selection:'))).toBe(false)
    const reloaded = new ModelManager(storage)
    expect((await reloaded.getModel(encodeTextModelSelection('connection', models[1].id)))?.modelId).toBe(models[1].id)
  })

  it('passes the selected model to the actual LLM adapter and honors disabled/deleted connections', async () => {
    const { registry, adapter, manager, models } = await setup()
    const key = encodeTextModelSelection('connection', models[1].id)
    const send = vi.spyOn(adapter, 'sendMessage').mockResolvedValue({ content: 'ok' })
    const llm = new LLMService(manager, registry)
    await llm.sendMessage([{ role: 'user', content: 'hello' }], key)
    expect(send.mock.calls[0][1]).toMatchObject({ modelId: models[1].id, modelMeta: { id: models[1].id } })
    await manager.disableModel('connection')
    await expect(llm.sendMessage([{ role: 'user', content: 'hello' }], key)).rejects.toThrow()
    expect(send).toHaveBeenCalledTimes(1)
    await manager.deleteModel('connection')
    expect(await manager.getModel(key)).toBeUndefined()
  })
})
