import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GrokAdapter } from '../../../src/services/llm/adapters/grok-adapter'
import type { Message, TextModelConfig } from '../../../src/services/llm/types'

let mockOpenAIInstance: any

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      constructor() {
        return mockOpenAIInstance
      }
    }
  }
})

describe('GrokAdapter', () => {
  let adapter: GrokAdapter
  let config: TextModelConfig

  const messages: Message[] = [
    { role: 'user', content: 'Hello' }
  ]

  beforeEach(() => {
    adapter = new GrokAdapter()
    const provider = adapter.getProvider()
    const model = adapter.getModels()[0]

    config = {
      id: 'grok',
      name: 'Grok',
      enabled: true,
      providerMeta: provider,
      modelMeta: model,
      connectionConfig: {
        apiKey: 'test-grok-key',
        baseURL: provider.defaultBaseURL
      },
      paramOverrides: {
        ...(model.defaultParameterValues || {})
      }
    }

    mockOpenAIInstance = {
      chat: {
        completions: {
          create: vi.fn()
        }
      },
      models: {
        list: vi.fn()
      },
      responses: {
        create: vi.fn()
      }
    }
  })

  it('should expose Grok provider metadata', () => {
    const provider = adapter.getProvider()

    expect(provider.id).toBe('grok')
    expect(provider.name).toBe('Grok')
    expect(provider.defaultBaseURL).toBe('https://api.x.ai/v1')
    expect(provider.supportsDynamicModels).toBe(true)
    expect(provider.connectionSchema?.required).toContain('apiKey')
  })

  it('should default Grok 4.5 with high reasoning effort', () => {
    const models = adapter.getModels()

    expect(models.map(model => model.id)).toEqual(['grok-4.5'])
    expect(models[0].defaultParameterValues).toEqual({
      reasoning_effort: 'high'
    })
    expect(models[0].parameterDefinitions.map(definition => definition.name)).toContain('reasoning_effort')
  })

  it('should send reasoning_effort high through chat completions by default', async () => {
    mockOpenAIInstance.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'ok'
          },
          finish_reason: 'stop'
        }
      ]
    })

    await adapter.sendMessage(messages, config)

    expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'grok-4.5',
        messages: [{ role: 'user', content: 'Hello' }],
        reasoning_effort: 'high'
      })
    )
    expect(mockOpenAIInstance.responses.create).not.toHaveBeenCalled()
  })

  it('should fetch dynamic language models from xAI language-models endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        models: [
          { id: 'grok-4.3-mini' },
          { id: 'grok-4.3' }
        ]
      })
    })

    const models = await adapter.getModelsAsync(config)

    expect(models.map(model => model.id)).toEqual(['grok-4.3', 'grok-4.3-mini'])
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.x.ai/v1/language-models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-grok-key'
        })
      })
    )
  })
})
