import { afterEach, describe, expect, it, vi } from 'vitest'
import { RapidMLXAdapter } from '../../../src/services/llm/adapters/rapid-mlx-adapter'
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry'
import { getBuiltinModelIds, getDefaultTextModels } from '../../../src/services/model/defaults'
import type { TextModelConfig } from '../../../src/services/llm/types'

const adapter = new RapidMLXAdapter()
const config = (connectionConfig: TextModelConfig['connectionConfig'] = {}): TextModelConfig => ({
  id: 'rapid-mlx-test', name: 'Rapid-MLX', enabled: true,
  providerMeta: adapter.getProvider(), modelMeta: adapter.buildDefaultModel('qwen3.5-4b-4bit'),
  connectionConfig, paramOverrides: {}
})
const card = (id: string, extra: Record<string, unknown> = {}) => ({
  id, object: 'model', created: 1795785597, owned_by: 'rapid-mlx', ...extra
})
const mockModels = (cards = [card('qwen3.5-4b-4bit', { capabilities: ['text', 'vision', 'tools'] })]) => {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ object: 'list', data: cards }), {
    headers: { 'Content-Type': 'application/json' }
  }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('RapidMLXAdapter', () => {
  it('registers an optional-key local text provider without static models', () => {
    expect(new TextAdapterRegistry().getAdapter('rapid-mlx')).toBeInstanceOf(RapidMLXAdapter)
    expect(adapter.getProvider()).toMatchObject({
      id: 'rapid-mlx', name: 'Rapid-MLX',
      description: 'Local Rapid-MLX server on Apple Silicon (OpenAI-compatible API)',
      requiresApiKey: false, corsRestricted: false, supportsDynamicModels: true,
      defaultBaseURL: 'http://localhost:8000/v1',
      connectionSchema: { required: [], optional: ['baseURL', 'apiKey'] }
    })
    expect(adapter.getModels()).toEqual([])
    expect(getBuiltinModelIds()).toContain('rapid-mlx')
    expect(getDefaultTextModels()['rapid-mlx']).toMatchObject({
      enabled: false, providerMeta: { id: 'rapid-mlx' },
      connectionConfig: { baseURL: 'http://localhost:8000/v1', apiKey: '' }
    })
  })

  it.each([
    [undefined, 'http://localhost:8000/v1/models'],
    ['   ', 'http://localhost:8000/v1/models'],
    ['http://localhost:8000', 'http://localhost:8000/v1/models'],
    [' http://localhost:8000/ ', 'http://localhost:8000/v1/models'],
    ['http://localhost:8000/v1/', 'http://localhost:8000/v1/models'],
    ['http://localhost:8000/v1/chat/completions/', 'http://localhost:8000/v1/models'],
    ['http://localhost:9000/proxy/chat/completions', 'http://localhost:9000/proxy/v1/models']
  ])('normalizes base URL %s', async (baseURL, expected) => {
    const fetch = mockModels()
    await adapter.getModelsAsync(config({ baseURL }))
    expect(String(fetch.mock.calls[0][0])).toBe(expected)
  })

  it.each([undefined, '', '  ', 'server-secret'])('uses optional API key %s', async apiKey => {
    const fetch = mockModels()
    await adapter.getModelsAsync(config({ apiKey }))
    expect(new Headers(fetch.mock.calls[0][1].headers).get('authorization'))
      .toBe(`Bearer ${apiKey?.trim() ? apiKey : 'rapid-mlx'}`)
  })

  it('filters non-text cards, preserves IDs, and maps tools and context metadata', async () => {
    mockModels([
      card('qwen3.5-4b-4bit', { capabilities: ['text', 'vision', 'tools'], context_window: 262144, max_model_len: 131072 }),
      card('mlx-community/embeddinggemma-2-4bit', { capabilities: ['embedding'], context_window: null }),
      card('mlx-community/Qwen3-Reranker-0.6B-4bit', { capabilities: ['rerank'] }),
      card('image-model', { capabilities: ['image.generation'] }),
      card('no-capabilities'),
      card('empty-capabilities', { capabilities: [] }),
      card('vendor/text-model', { capabilities: ['text'], context_window: null, max_model_len: 32768 })
    ])
    const models = await adapter.getModelsAsync(config())
    expect(models.map(model => model.id)).toEqual(['no-capabilities', 'qwen3.5-4b-4bit', 'vendor/text-model'])
    expect(models[1]).toMatchObject({
      providerId: 'rapid-mlx', capabilities: { supportsTools: true, maxContextLength: 131072 }
    })
    expect(models[2].capabilities).toMatchObject({ supportsTools: false, maxContextLength: 32768 })
  })

  it('retains the OpenAI adapter empty-list error when no text models remain', async () => {
    mockModels([card('embedding', { capabilities: ['embedding'] })])
    await expect(adapter.getModelsAsync(config())).rejects.toThrow('API returned empty model list')
  })
})
