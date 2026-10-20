import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry'
import { LLMService } from '../../../src/services/llm/service'
import { ModelManager } from '../../../src/services/model/manager'
import { getDefaultTextModels } from '../../../src/services/model/defaults'
import type { TextModelConfig } from '../../../src/services/model/types'
import { createMockStorage } from '../../mocks/mockStorage'

const flash = 'MiniMax-M3.1-Flash'
const messages = [{ role: 'user' as const, content: 'Hello' }]

describe('MiniMax real SDK transport', () => {
  let registry: TextAdapterRegistry
  let manager: ModelManager
  let service: LLMService
  let requests: Array<{ url: string; body: Record<string, any> }>
  let listedIds: string[]

  beforeEach(async () => {
    registry = new TextAdapterRegistry()
    manager = new ModelManager(createMockStorage(), registry)
    await manager.ensureInitialized()
    service = new LLMService(manager, registry)
    requests = []
    listedIds = [ 'MiniMax-M2.7', 'MiniMax-M3', flash, 'MiniMax-M2.7-highspeed' ]
    // Keep the real SDK and adapter; intercept only serialized HTTP requests.
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      if (request.method === 'GET') {
        requests.push({ url: request.url, body: {} })
        return Response.json({ object: 'list', data: listedIds.map(id => ({ id, object: 'model' })) })
      }
      const body = await request.json()
      requests.push({ url: request.url, body })
      if (body.stream) {
        return new Response([
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { reasoning_content: 'Thinking', content: 'Hello' }, finish_reason: null }] })}\n\n`,
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`,
          'data: [DONE]\n\n'
        ].join(''), { headers: { 'Content-Type': 'text/event-stream' } })
      }
      return Response.json({
        id: 'fixture', object: 'chat.completion', model: body.model,
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hello', reasoning_content: 'Thinking' }, finish_reason: 'stop' }]
      })
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  async function saveConfig(modelId = flash, providerId = 'minimax', overrides: Record<string, unknown> = {}) {
    const adapter = registry.getAdapter(providerId)
    const modelMeta = adapter.getModels().find(model => model.id === modelId) || adapter.buildDefaultModel(modelId)
    const config: TextModelConfig = {
      id: 'fixture', name: 'Fixture', enabled: true, providerId, modelId,
      providerMeta: adapter.getProvider(), modelMeta,
      connectionConfig: { apiKey: 'fixture-key', baseURL: adapter.getProvider().defaultBaseURL },
      paramOverrides: { ...modelMeta.defaultParameterValues, ...overrides }, customParamOverrides: {}
    }
    await manager.addModel(config.id, config)
    return config
  }

  it.each(['https://api.minimax.io/v1', 'https://api.minimaxi.com/v1'])(
    'sends the fresh default through ModelManager, LLMService and SDK at %s', async baseURL => {
      const defaults = getDefaultTextModels(registry)
      expect(defaults.minimax.modelId).toBe(flash)
      await manager.updateModel('minimax', {
        enabled: true, connectionConfig: { apiKey: 'fixture-key', baseURL }
      })
      const response = await service.sendMessageStructured(messages, 'minimax')
      expect(response.content).toBe('Hello')
      expect(response.reasoning).toBe('Thinking')
      expect(requests).toEqual([{
        url: `${baseURL}/chat/completions`,
        body: { model: flash, messages, reasoning_effort: 'max' }
      }])
    }
  )

  it.each(['low', 'medium', 'high', 'xhigh', 'max'])('serializes explicit Flash effort %s', async effort => {
    await saveConfig(flash, 'minimax', { reasoning_effort: effort, thinking: { type: 'adaptive' } })
    await service.sendMessageStructured(messages, 'fixture')
    expect(requests[0].body).toMatchObject({ model: flash, reasoning_effort: effort, thinking: { type: 'adaptive' } })
    expect(requests[0].body).not.toHaveProperty('service_tier')
    expect(requests[0].body).not.toHaveProperty('reasoning_split')
  })

  it('keeps M3 thinking control and does not introduce an effort default', async () => {
    await saveConfig('MiniMax-M3', 'minimax', { thinking: { type: 'disabled' } })
    await service.sendMessageStructured(messages, 'fixture')
    expect(requests[0].body).toEqual({ model: 'MiniMax-M3', messages, thinking: { type: 'disabled' } })
  })

  it.each([
    ['minimax', 'MiniMax-M2.7'],
    ['minimax', 'private-model'],
    ['openrouter', 'minimax/minimax-m2.7'],
    ['openai-compatible', 'MiniMax-M2.7']
  ])('preserves saved/custom %s model %s and explicit parameters', async (providerId, modelId) => {
    await saveConfig(modelId, providerId, { reasoning_effort: 'high', reasoning_split: false, max_tokens: 128 })
    await service.sendMessageStructured(messages, 'fixture')
    expect(requests[0].body).toEqual({ model: modelId, messages, reasoning_effort: 'high', reasoning_split: false, max_tokens: 128 })
    expect((await manager.getModel('fixture'))?.modelId).toBe(modelId)
  })

  it('filters direct discovery to current models in default order with current metadata', async () => {
    const config = await saveConfig()
    const options = await service.fetchModelList('minimax', config)
    expect(options.map(model => model.value)).toEqual([flash, 'MiniMax-M3'])
    const models = await registry.getAdapter('minimax').getModelsAsync!(config)
    expect(models[0].capabilities.maxContextLength).toBe(1000000)
    expect(models[0].defaultParameterValues).toEqual({ reasoning_effort: 'max' })
    expect(requests[0].url).toBe('https://api.minimax.io/v1/models')
  })

  it('keeps Flash first when discovery omits it and the static fallback is merged', async () => {
    listedIds = ['MiniMax-M3', 'MiniMax-M2.7']
    const config = await saveConfig()
    const options = await service.fetchModelList('minimax', config)
    expect(options.map(model => model.value)).toEqual([flash, 'MiniMax-M3'])
  })

  it('filters gateway discovery while retaining other providers and verified route metadata', async () => {
    listedIds = ['minimax/minimax-m2.7', 'minimax/minimax-m3', 'minimax/minimax-m3.1-flash:free', 'vendor/other', 'openrouter/free']
    const config = await saveConfig('minimax/minimax-m3.1-flash:free', 'openrouter')
    const models = await registry.getAdapter('openrouter').getModelsAsync!(config)
    expect(models.map(model => model.id)).toEqual(['minimax/minimax-m3.1-flash:free', 'minimax/minimax-m3', 'openrouter/free', 'vendor/other'])
    expect(models[0].capabilities.maxContextLength).toBe(1000000)
    expect(models[1].capabilities.maxContextLength).toBe(1048576)
    expect(models[1].parameterDefinitions.find(parameter => parameter.name === 'max_tokens')?.maxValue).toBe(512000)
    expect(getDefaultTextModels(registry).openrouter.modelId).toBe('openrouter/free')
    await service.sendMessageStructured(messages, 'fixture')
    expect(requests.at(-1)).toEqual({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      body: { model: 'minimax/minimax-m3.1-flash:free', messages }
    })
  })

  it('preserves streaming reasoning and tool definitions at the HTTP boundary', async () => {
    await saveConfig()
    const callbacks = { onToken: vi.fn(), onReasoningToken: vi.fn(), onComplete: vi.fn(), onError: vi.fn() }
    const tools = [{ type: 'function' as const, function: { name: 'lookup', description: 'Look up a value', parameters: { type: 'object', properties: {} } } }]
    await service.sendMessageStreamWithTools(messages, 'fixture', tools, callbacks)
    expect(requests[0].body).toMatchObject({ model: flash, reasoning_effort: 'max', stream: true, tools })
    expect(callbacks.onToken).toHaveBeenCalledWith('Hello')
    expect(callbacks.onReasoningToken).toHaveBeenCalledWith('Thinking')
    expect(callbacks.onComplete).toHaveBeenCalled()
    expect(callbacks.onError).not.toHaveBeenCalled()
  })

  it('preserves the existing image-understanding payload', async () => {
    const config = await saveConfig()
    await registry.getAdapter('minimax').sendImageUnderstanding!({
      userPrompt: 'Describe the image', images: [{ b64: 'aW1hZ2U=', mimeType: 'image/png' }]
    }, config)
    expect(requests[0].body).toMatchObject({
      model: flash, reasoning_effort: 'max',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Describe the image' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,aW1hZ2U=' } }
      ] }]
    })
  })
})
