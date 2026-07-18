import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CloudflareAdapter } from '../../../src/services/llm/adapters/cloudflare-adapter'
import type { Message, TextModelConfig } from '../../../src/services/llm/types'

let mockOpenAIInstance: any
let mockOpenAIConfig: any
const realFetch = global.fetch

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      constructor(config: any) {
        mockOpenAIConfig = config
        return mockOpenAIInstance
      }
    }
  }
})

describe('CloudflareAdapter', () => {
  let adapter: CloudflareAdapter
  let mockConfig: TextModelConfig

  const mockMessages: Message[] = [
    { role: 'user', content: '用中文解释一下 RAG 是什么' }
  ]

  beforeEach(() => {
    adapter = new CloudflareAdapter()
    const provider = adapter.getProvider()
    const model = adapter.getModels()[0]

    mockConfig = {
      id: provider.id,
      name: provider.name,
      enabled: true,
      providerMeta: provider,
      modelMeta: model,
      connectionConfig: {
        apiKey: 'test-api-key',
        accountId: 'test-account-id',
        baseURL: provider.defaultBaseURL
      },
      paramOverrides: {}
    }

    vi.clearAllMocks()
    mockOpenAIConfig = undefined
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: vi.fn()
        }
      },
      models: {
        list: vi.fn()
      }
    }
  })

  afterEach(() => {
    global.fetch = realFetch
  })

  describe('getProvider', () => {
    it('should return Cloudflare provider metadata', () => {
      const provider = adapter.getProvider()

      expect(provider.id).toBe('cloudflare')
      expect(provider.name).toBe('Cloudflare')
      expect(provider.requiresApiKey).toBe(true)
      expect(provider.defaultBaseURL).toBe('https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/v1')
      expect(provider.supportsDynamicModels).toBe(true)
      expect(provider.connectionSchema?.required).toEqual(['apiKey', 'accountId'])
      expect(provider.connectionSchema?.optional).toEqual(['baseURL'])
    })
  })

  describe('getModels', () => {
    it('should return the static Qwen3 model', () => {
      const models = adapter.getModels()

      expect(models).toHaveLength(1)
      expect(models[0]).toMatchObject({
        id: '@cf/qwen/qwen3-30b-a3b-fp8',
        name: 'Qwen3 30B A3B FP8',
        providerId: 'cloudflare'
      })
    })

    it('should expose capabilities for the default model', () => {
      const model = adapter.getModels()[0]

      expect(model.capabilities.supportsTools).toBe(true)
      expect(model.capabilities.supportsReasoning).toBe(true)
      expect(model.capabilities.maxContextLength).toBe(32768)
    })
  })

  describe('getModelsAsync', () => {
    it('should fetch dynamic text-generation models from Cloudflare model search', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          result: [
            {
              name: '@cf/qwen/qwen3-30b-a3b-fp8',
              description: 'Qwen3 model from Workers AI',
              task: {
                name: 'Text Generation'
              },
              properties: [
                { property_id: 'context_window', value: '32768' },
                { property_id: 'function_calling', value: 'true' },
                { property_id: 'reasoning', value: 'true' }
              ]
            },
            {
              name: '@cf/meta/llama-3.2-3b-instruct',
              description: 'Llama text generation model',
              task: {
                name: 'Text Generation'
              },
              properties: [
                { property_id: 'context_window', value: '80000' },
                { property_id: 'function_calling', value: 'true' }
              ]
            }
          ]
        })
      })

      const models = await adapter.getModelsAsync(mockConfig)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/test-account-id/ai/models/search?task=Text%20Generation&hide_experimental=true&per_page=100',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-api-key'
          }
        })
      )
      expect(models).toHaveLength(2)
      expect(models[0]).toMatchObject({
        id: '@cf/qwen/qwen3-30b-a3b-fp8',
        providerId: 'cloudflare',
        capabilities: {
          supportsTools: true,
          supportsReasoning: true,
          maxContextLength: 32768
        }
      })
      expect(models[1]).toMatchObject({
        id: '@cf/meta/llama-3.2-3b-instruct',
        providerId: 'cloudflare'
      })
    })

    it('should keep the static default model as a fallback when Cloudflare search fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: () => Promise.resolve('upstream failed')
      })

      await expect(adapter.getModelsAsync(mockConfig)).rejects.toThrow(/Cloudflare model search failed/i)
    })
  })

  describe('sendMessage', () => {
    it('should call OpenAI SDK with a Cloudflare account-scoped baseURL', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'RAG 是检索增强生成。'
            }
          }
        ],
        model: mockConfig.modelMeta.id,
        usage: {
          prompt_tokens: 12,
          completion_tokens: 10,
          total_tokens: 22
        }
      })

      const response = await adapter.sendMessage(mockMessages, mockConfig)

      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: '@cf/qwen/qwen3-30b-a3b-fp8',
          messages: mockMessages
        })
      )
      expect(mockOpenAIConfig?.baseURL).toBe('https://api.cloudflare.com/client/v4/accounts/test-account-id/ai/v1')
      expect(response.content).toBe('RAG 是检索增强生成。')
      expect(response.metadata?.model).toBe('@cf/qwen/qwen3-30b-a3b-fp8')
    })
  })

  describe('buildDefaultModel', () => {
    it('should allow manually edited Cloudflare model IDs', () => {
      const model = adapter.buildDefaultModel('@cf/meta/llama-3.2-3b-instruct')

      expect(model.id).toBe('@cf/meta/llama-3.2-3b-instruct')
      expect(model.providerId).toBe('cloudflare')
      expect(model.name).toBe('@cf/meta/llama-3.2-3b-instruct')
    })
  })
})
