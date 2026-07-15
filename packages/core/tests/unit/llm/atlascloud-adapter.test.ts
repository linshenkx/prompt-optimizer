import { describe, expect, it } from 'vitest'
import { AtlasCloudAdapter } from '../../../src/services/llm/adapters/atlascloud-adapter'

describe('AtlasCloudAdapter', () => {
  it('exposes Atlas Cloud provider metadata', () => {
    const adapter = new AtlasCloudAdapter()
    const provider = adapter.getProvider()

    expect(provider.id).toBe('atlascloud')
    expect(provider.name).toBe('Atlas Cloud')
    expect(provider.defaultBaseURL).toBe('https://api.atlascloud.ai/v1')
    expect(provider.supportsDynamicModels).toBe(true)
    expect(provider.requiresApiKey).toBe(true)
    expect(provider.apiKeyUrl).toBe('https://www.atlascloud.ai/console/api-keys')
    expect(provider.connectionSchema?.required).toContain('apiKey')
    expect(provider.connectionSchema?.optional).toContain('baseURL')
  })

  it('returns Atlas Cloud static models with provider metadata', () => {
    const adapter = new AtlasCloudAdapter()
    const models = adapter.getModels()

    expect(models.map((model) => model.id)).toEqual([
      'qwen/qwen3.5-flash',
      'deepseek-ai/deepseek-v4-pro',
      'deepseek-ai/deepseek-v4-flash'
    ])
    expect(models.every((model) => model.providerId === 'atlascloud')).toBe(true)
    expect(
      models.find((model) => model.id === 'deepseek-ai/deepseek-v4-pro')?.capabilities.supportsReasoning
    ).toBe(true)
    expect(
      models.find((model) => model.id === 'deepseek-ai/deepseek-v4-pro')?.defaultParameterValues
    ).toEqual(
      expect.objectContaining({
        max_tokens: 1024
      })
    )
  })
})
