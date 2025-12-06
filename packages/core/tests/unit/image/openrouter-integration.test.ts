import { describe, it, expect } from 'vitest'
import { ImageAdapterRegistry } from '../../../src/services/image/adapters/registry'

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

    expect(models).toHaveLength(1)
    expect(models[0].id).toBe('google/gemini-2.5-flash-image-preview')
    expect(models[0].providerId).toBe('openrouter')
    expect(models[0].capabilities.text2image).toBe(true)
    expect(models[0].capabilities.image2image).toBe(true)
  })

  it('should support OpenRouter in all static models view', () => {
    const registry = new ImageAdapterRegistry()
    const allModels = registry.getAllStaticModels()

    const openrouterModels = allModels.filter(item => item.provider.id === 'openrouter')

    expect(openrouterModels).toHaveLength(1)
    expect(openrouterModels[0].model.id).toBe('google/gemini-2.5-flash-image-preview')
  })

  it('should support dynamic models for OpenRouter', () => {
    const registry = new ImageAdapterRegistry()

    expect(registry.supportsDynamicModels('openrouter')).toBe(true)
  })
})