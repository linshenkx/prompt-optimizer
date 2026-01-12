import { describe, it, expect } from 'vitest'
import { ImageAdapterRegistry } from '../../../src/services/image/adapters/registry'
import { OpenRouterImageAdapter } from '../../../src/services/image/adapters/openrouter'

describe('OpenRouter Integration Test', () => {
  it('should include OpenRouter in provider list', () => {
    const registry = new ImageAdapterRegistry()
    const providers = registry.getAllProviders()

    const openrouterProvider = providers.find(p => p.id === 'openrouter')

    expect(openrouterProvider).toBeDefined()
    expect(openrouterProvider?.name).toBe('OpenRouter')
    expect(openrouterProvider?.requiresApiKey).toBe(true)
    expect(openrouterProvider?.supportsDynamicModels).toBe(true)
  })

  it('should get OpenRouter adapter successfully', () => {
    const registry = new ImageAdapterRegistry()

    expect(() => {
      const adapter = registry.getAdapter('openrouter')
      expect(adapter).toBeDefined()
      expect(adapter.getProvider().id).toBe('openrouter')
    }).not.toThrow()
  })

  it('should get OpenRouter static models', () => {
    const registry = new ImageAdapterRegistry()
    const models = registry.getStaticModels('openrouter')
    const openrouterModelId = new OpenRouterImageAdapter().getModels()[0].id

    expect(models.length).toBeGreaterThan(0)
    expect(models[0].id).toBe(openrouterModelId)
    expect(models.every(m => m.providerId === 'openrouter')).toBe(true)
    expect(models.every(m => m.capabilities.text2image)).toBe(true)
  })

  it('should support OpenRouter in all static models view', () => {
    const registry = new ImageAdapterRegistry()
    const allModels = registry.getAllStaticModels()
    const openrouterModelId = new OpenRouterImageAdapter().getModels()[0].id

    const openrouterModels = allModels.filter(item => item.provider.id === 'openrouter')

    expect(openrouterModels.length).toBeGreaterThan(0)
    expect(openrouterModels[0].model.id).toBe(openrouterModelId)
  })

  it('should support dynamic models for OpenRouter', () => {
    const registry = new ImageAdapterRegistry()

    expect(registry.supportsDynamicModels('openrouter')).toBe(true)
  })
})
