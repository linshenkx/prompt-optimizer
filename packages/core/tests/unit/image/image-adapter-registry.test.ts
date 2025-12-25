import { describe, it, expect } from 'vitest'
import { ImageAdapterRegistry } from '../../../src/services/image/adapters/registry'

describe('ImageAdapterRegistry', () => {
  const registry = new ImageAdapterRegistry()

  it('should return available providers', () => {
    const providers = registry.getAllProviders()

    expect(providers).toBeInstanceOf(Array)
    expect(providers.length).toBeGreaterThan(0)

    // 检查必要的 provider
    const providerIds = providers.map(p => p.id)
    expect(providerIds).toContain('gemini')
    expect(providerIds).toContain('openai')
    expect(providerIds).toContain('seedream')
    expect(providerIds).toContain('siliconflow')
  })

  it('should return providers with correct structure', () => {
    const providers = registry.getAllProviders()

    providers.forEach(provider => {
      expect(provider).toHaveProperty('id')
      expect(provider).toHaveProperty('name')
      expect(provider).toHaveProperty('description')
      expect(provider).toHaveProperty('requiresApiKey')
      expect(provider).toHaveProperty('defaultBaseURL')
      expect(provider).toHaveProperty('supportsDynamicModels')
      expect(provider).toHaveProperty('connectionSchema')

      expect(typeof provider.id).toBe('string')
      expect(typeof provider.name).toBe('string')
      expect(typeof provider.description).toBe('string')
      expect(typeof provider.requiresApiKey).toBe('boolean')
      expect(typeof provider.supportsDynamicModels).toBe('boolean')
    })
  })

  it('should get adapters for all available providers', () => {
    const providers = registry.getAllProviders()

    providers.forEach(provider => {
      expect(() => registry.getAdapter(provider.id)).not.toThrow()
    })
  })

  it('should get static models for providers', () => {
    const providers = registry.getAllProviders()

    providers.forEach(provider => {
      const models = registry.getStaticModels(provider.id)
      expect(Array.isArray(models)).toBe(true)

      // 验证模型结构
      models.forEach(model => {
        expect(model).toHaveProperty('id')
        expect(model).toHaveProperty('name')
        expect(model).toHaveProperty('providerId')
        expect(model).toHaveProperty('capabilities')
        expect(model.providerId).toBe(provider.id)
      })
    })
  })

  // 别名不再支持

  // 连接验证已移除

  it('should check dynamic model support', () => {
    const providers = registry.getAllProviders()

    providers.forEach(provider => {
      const supportsDynamic = registry.supportsDynamicModels(provider.id)
      expect(typeof supportsDynamic).toBe('boolean')
      expect(supportsDynamic).toBe(provider.supportsDynamicModels)
    })
  })

  it('should get all static models combined view', () => {
    const allModels = registry.getAllStaticModels()

    expect(Array.isArray(allModels)).toBe(true)
    expect(allModels.length).toBeGreaterThan(0)

    allModels.forEach(item => {
      expect(item).toHaveProperty('provider')
      expect(item).toHaveProperty('model')
      expect(item.model.providerId).toBe(item.provider.id)
    })
  })

  // 移除别名映射相关测试

  it('should clear cache and reload models', () => {
    // 获取清除前的模型
    const modelsBefore = registry.getStaticModels('openai')

    // 清除缓存
    registry.clearCache()

    // 获取清除后的模型
    const modelsAfter = registry.getStaticModels('openai')

    // 应该仍然有相同的模型
    expect(modelsAfter).toEqual(modelsBefore)
  })

  it('should throw error for unknown provider', () => {
    expect(() => registry.getAdapter('unknown')).toThrow()
  })
})
