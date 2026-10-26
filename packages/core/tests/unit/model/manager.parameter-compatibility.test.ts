import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry'
import { LLMService } from '../../../src/services/llm/service'
import { ModelManager } from '../../../src/services/model/manager'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import { CORE_SERVICE_KEYS } from '../../../src/constants/storage-keys'
import type { TextModelConfig } from '../../../src/services/model/types'

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))

describe('saved text parameter compatibility', () => {
  let registry: TextAdapterRegistry
  beforeEach(() => {
    registry = new TextAdapterRegistry()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  async function setup(overrides: Partial<TextModelConfig> = {}) {
    const adapter = registry.getAdapter('openai')
    const model = copy({ ...adapter.getModels()[0] })
    model.parameterDefinitions.find(definition => definition.name === 'max_tokens')!.maxValue = 64000
    model.parameterDefinitions.find(definition => definition.name === 'max_tokens')!.max = 64000
    model.parameterDefinitions = [...model.parameterDefinitions, { name: 'legacy_empty', type: 'string', sendEmptyString: true }]
    model.defaultParameterValues = { reasoning_effort: 'low', max_completion_tokens: 7 }
    const config: TextModelConfig = {
      id: 'saved-parameters', name: 'Saved parameters', enabled: true,
      providerId: 'openai', modelId: model.id, providerMeta: adapter.getProvider(), modelMeta: model,
      connectionConfig: { apiKey: 'fixture-key', baseURL: adapter.getProvider().defaultBaseURL, requestStyle: 'chat_completions' },
      paramOverrides: { max_tokens: 96000, temperature: 0.3 },
      ...overrides,
    }
    const storage = new MemoryStorageProvider()
    await storage.setItem(CORE_SERVICE_KEYS.MODELS, JSON.stringify({ [config.id]: config }))
    const manager = new ModelManager(storage, registry)
    await manager.ensureInitialized()
    return { storage, manager, config }
  }

  it('allows rename and reload without changing old snapshots, credentials or parameters', async () => {
    const { manager, storage, config } = await setup()
    const storedBefore = await storage.getItem(CORE_SERVICE_KEYS.MODELS)
    await manager.getModel(config.id)
    expect(await storage.getItem(CORE_SERVICE_KEYS.MODELS)).toBe(storedBefore)

    await manager.updateModel(config.id, { name: 'Renamed' })

    expect(await new ModelManager(storage, registry).getModel(config.id)).toEqual({ ...config, name: 'Renamed' })
  })

  it('accepts an edited value valid under the current definition', async () => {
    const { manager, config } = await setup()
    await manager.updateModel(config.id, { paramOverrides: { max_tokens: 128000, temperature: 0.4 } })
    expect((await manager.getModel(config.id))?.paramOverrides).toEqual({ max_tokens: 128000, temperature: 0.4 })
    expect((await manager.getModel(config.id))?.modelMeta).toEqual(config.modelMeta)
  })

  it('enables a saved configuration valid under the current rules without replacing its snapshot', async () => {
    const { manager, config } = await setup({ enabled: false })
    await manager.enableModel(config.id)
    expect(await manager.getModel(config.id)).toEqual({ ...config, enabled: true })
  })

  it('round-trips old snapshots and parameter values through export and import', async () => {
    const { manager, config } = await setup()
    const backup = (await manager.exportData()).filter(model => model.id === config.id)
    const restored = new ModelManager(new MemoryStorageProvider(), registry)
    await restored.importData(backup)
    expect(await restored.getModel(config.id)).toEqual(config)
  })

  it('rejects a newly edited value outside current limits without writing', async () => {
    const { manager, storage, config } = await setup()
    const before = await storage.getItem(CORE_SERVICE_KEYS.MODELS)
    await expect(manager.updateModel(config.id, { paramOverrides: { max_tokens: 1000001 } })).rejects.toThrow('maximum value')
    expect(await storage.getItem(CORE_SERVICE_KEYS.MODELS)).toBe(before)
  })

  it.each([undefined, {}, { temperature: 0.3 }])('validates newly added invalid values when previous overrides are %j', async paramOverrides => {
    const { manager, config } = await setup({ paramOverrides })
    await expect(manager.updateModel(config.id, { paramOverrides: { temperature: 5 } })).rejects.toThrow('maximum value')
  })

  it('preserves unchanged legacy values but still validates other edited parameters', async () => {
    const { manager, config } = await setup({ paramOverrides: { temperature: 5, max_tokens: 96000 } })
    await manager.updateModel(config.id, { paramOverrides: { temperature: 5, max_tokens: 128000 } })
    expect((await manager.getModel(config.id))?.paramOverrides).toEqual({ temperature: 5, max_tokens: 128000 })
    await expect(manager.updateModel(config.id, { paramOverrides: { temperature: 6 } })).rejects.toThrow('maximum value')
  })

  it.each(['model', 'provider'])('does not carry legacy validation exemptions across a %s switch', async identity => {
    const { manager, config } = await setup({ paramOverrides: { temperature: 5 } })
    const modelId = registry.getStaticModels('openai')[1].id
    await expect(manager.updateModel(config.id, identity === 'model'
      ? { modelId }
      : { providerId: 'minimax', modelId: registry.getStaticModels('minimax')[0].id }
    )).rejects.toThrow('maximum value')
  })

  it('keeps stricter private gateway definitions for edited values', async () => {
    const { manager, config } = await setup({
      connectionConfig: { apiKey: 'private-key', baseURL: 'https://private-gateway.example/v1' },
    })
    await manager.updateModel(config.id, { name: 'Renamed private model' })
    await expect(manager.updateModel(config.id, { paramOverrides: { max_tokens: 128000 } })).rejects.toThrow('64000')
  })

  it('does not restore deleted parameters or inject model defaults', async () => {
    const { manager, config } = await setup()
    await manager.updateModel(config.id, { paramOverrides: {} })
    expect((await manager.getModel(config.id))?.paramOverrides).toEqual({})
    await manager.updateModel(config.id, { name: 'Still empty' })
    expect((await manager.getModel(config.id))?.paramOverrides).toEqual({})
  })

  it('retains deprecated custom overrides through a rename without a new migration scheme', async () => {
    const { manager, storage, config } = await setup({
      customParamOverrides: { vendor_knob: { nested: [0, false, 'value'] } },
    })
    await manager.updateModel(config.id, { name: 'Renamed' })
    expect((await new ModelManager(storage, registry).getModel(config.id))?.paramOverrides).toEqual({
      ...config.paramOverrides, vendor_knob: { nested: [0, false, 'value'] },
    })
  })

  it('does not exempt unsafe unknown keys or malformed structures', async () => {
    const { manager, config } = await setup({ paramOverrides: { api_key: 'unsafe-fixture' } })
    await expect(manager.updateModel(config.id, { name: 'Rename' })).rejects.toThrow('potentially dangerous')
    await expect(manager.updateModel(config.id, { paramOverrides: [] as unknown as Record<string, unknown> })).rejects.toThrow('must be an object')
    await expect(manager.updateModel(config.id, { name: '' })).rejects.toThrow('Missing model name')
  })

  it('still strictly validates new configurations', async () => {
    const { manager, config } = await setup({ paramOverrides: { temperature: 5 } })
    await expect(manager.addModel('new-invalid', { ...config, id: 'new-invalid' })).rejects.toThrow('maximum value')
  })

  it.each(['message', 'stream', 'tools', 'responses'] as const)('preserves the actual SDK %s request across saving and reload', async mode => {
    const { manager, storage, config } = await setup({
      connectionConfig: { apiKey: 'fixture-key', baseURL: 'https://api.openai.com/v1',
        requestStyle: mode === 'responses' ? 'responses' : 'chat_completions' },
      paramOverrides: { max_tokens: 96000, temperature: 0.3, legacy_empty: '' },
    })
    const requests: unknown[] = []
    const connections: unknown[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      requests.push(body)
      connections.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization') })
      return new Response(body.stream
        ? `data: ${JSON.stringify({ id: 'fixture', choices: [{ index: 0, delta: { content: 'fixture' }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`
        : JSON.stringify(body.input
          ? { id: 'fixture', output: [{ type: 'message', content: [{ type: 'output_text', text: 'fixture' }] }] }
          : { id: 'fixture', choices: [{ index: 0, message: { role: 'assistant', content: 'fixture' }, finish_reason: 'stop' }] }),
      { headers: { 'Content-Type': body.stream ? 'text/event-stream' : 'application/json' } })
    }))
    async function send(current: ModelManager) {
      const service = new LLMService(current, registry)
      const messages = [{ role: 'user' as const, content: 'Fixture only' }]
      const callbacks = { onToken: vi.fn(), onComplete: vi.fn(), onError: vi.fn() }
      if (mode === 'message' || mode === 'responses') await service.sendMessageStructured(messages, config.id)
      else if (mode === 'stream') await service.sendMessageStream(messages, config.id, callbacks)
      else await service.sendMessageStreamWithTools(messages, config.id,
        [{ type: 'function', function: { name: 'fixture_tool', description: 'Fixture', parameters: { type: 'object', properties: {} } } }], callbacks)
      expect(callbacks.onError).not.toHaveBeenCalled()
    }
    await send(manager)
    await manager.updateModel(config.id, { name: 'Renamed' })
    await send(new ModelManager(storage, registry))
    expect(requests).toHaveLength(2)
    expect(requests[1]).toEqual(requests[0])
    expect(connections[1]).toEqual(connections[0])
    expect(requests[0]).toMatchObject({ model: config.modelId, temperature: 0.3, legacy_empty: '',
      [mode === 'responses' ? 'max_output_tokens' : 'max_tokens']: 96000 })
    expect(requests[0]).not.toHaveProperty('reasoning_effort')
    expect(requests[0]).not.toHaveProperty('max_completion_tokens')
  })
})
