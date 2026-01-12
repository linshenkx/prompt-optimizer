import { describe, it, expect, beforeEach } from 'vitest'
import { OpenRouterImageAdapter } from '../../../src/services/image/adapters/openrouter'
import type { ImageModelConfig } from '../../../src/services/image/types'

describe('OpenRouterImageAdapter', () => {
  let adapter: OpenRouterImageAdapter

  beforeEach(() => {
    adapter = new OpenRouterImageAdapter()
  })

  describe('Provider Information', () => {
    it('should provide correct provider information', () => {
      const provider = adapter.getProvider()

      expect(provider.id).toBe('openrouter')
      expect(provider.name).toBe('OpenRouter')
      expect(provider.requiresApiKey).toBe(true)
      expect(provider.supportsDynamicModels).toBe(true)
      expect(provider.defaultBaseURL).toBe('https://openrouter.ai/api/v1')
    })

    it('should have correct connection schema', () => {
      const provider = adapter.getProvider()
      expect(provider.connectionSchema?.required).toContain('apiKey')
      expect(provider.connectionSchema?.optional).toEqual(expect.arrayContaining(['baseURL']))
      expect(provider.connectionSchema?.fieldTypes.apiKey).toBe('string')
      expect(provider.connectionSchema?.fieldTypes.baseURL).toBe('string')
    })
  })

  describe('Model Management', () => {
    it('should provide static models list', () => {
      const models = adapter.getModels()

      expect(models.length).toBeGreaterThan(0)
      expect(models[0].id).toBe('openai/gpt-5-image-mini')
      expect(models[0].name).toBe('GPT-5 Image Mini')
      expect(models[0].providerId).toBe('openrouter')
    })

    it('should have correct model capabilities', () => {
      const models = adapter.getModels()
      const model = models[0]

      expect(model.capabilities.text2image).toBe(true)
      expect(model.capabilities.image2image).toBe(true)
      expect(model.capabilities.multiImage).toBe(true)
    })

    it('should build default model correctly', () => {
      const defaultModel = adapter.buildDefaultModel('custom/test-model')

      expect(defaultModel.id).toBe('custom/test-model')
      expect(defaultModel.name).toBe('custom/test-model')
      expect(defaultModel.providerId).toBe('openrouter')
      expect(defaultModel.capabilities.text2image).toBe(true)
      expect(defaultModel.capabilities.image2image).toBe(true)
    })
  })

  describe('Test Requests', () => {
    it('should create valid text2image test request', () => {
      const testRequest = adapter['getTestImageRequest']('text2image')

      expect(testRequest.prompt).toBe('a simple red flower')
      expect(testRequest.count).toBe(1)
      expect(testRequest.inputImage).toBeUndefined()
    })

    it('should create valid image2image test request', () => {
      const testRequest = adapter['getTestImageRequest']('image2image')

      expect(testRequest.prompt).toBe('make this image more colorful')
      expect(testRequest.count).toBe(1)
      expect(testRequest.inputImage).toBeDefined()
      expect(testRequest.inputImage?.mimeType).toBe('image/png')
      expect(testRequest.inputImage?.b64).toBeDefined()
    })
  })

  describe('Parameter Definitions', () => {
    it('should not expose user-level parameters', () => {
      const params = adapter['getParameterDefinitions']('any-model')

      expect(params).toHaveLength(0)
      expect(params).toEqual([])
    })

    it('should not provide user-configurable parameter values', () => {
      const defaults = adapter['getDefaultParameterValues']('any-model')

      expect(defaults).toEqual({})
      expect(Object.keys(defaults)).toHaveLength(0)
    })
  })

  describe('Request Validation', () => {
    let mockConfig: ImageModelConfig

    beforeEach(() => {
      const modelId = adapter.getModels()[0].id
      mockConfig = {
        id: 'test-config',
        name: 'Test Config',
        providerId: 'openrouter',
        modelId,
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key'
        },
        provider: adapter.getProvider(),
        model: adapter.getModels()[0]
      }
    })

    it('should validate request without errors', () => {
      const request = {
        prompt: 'test prompt',
        configId: 'test-config'
      }

      expect(() => {
        adapter['validateRequest'](request, mockConfig)
      }).not.toThrow()
    })

    it('should throw error for empty prompt', () => {
      const request = {
        prompt: '',
        configId: 'test-config'
      }

      expect(() => {
        adapter['validateRequest'](request, mockConfig)
      }).toThrow('Prompt is required')
    })

    it('should validate config without errors', () => {
      expect(() => {
        adapter['validateConfig'](mockConfig)
      }).not.toThrow()
    })

    it('should throw error for missing API key', () => {
      const configWithoutKey = {
        ...mockConfig,
        connectionConfig: {}
      }

      expect(() => {
        adapter['validateConfig'](configWithoutKey)
      }).toThrow('OpenRouter requires API key')
    })
  })

  describe('URL Parsing', () => {
    it('should correctly parse data URL format', () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ'
      const [header, base64Data] = dataUrl.split(',')
      const mimeMatch = header.match(/data:([^;]+)/)

      expect(mimeMatch?.[1]).toBe('image/jpeg')
      expect(base64Data).toBe('/9j/4AAQSkZJRgABAQAAAQ')
    })

    it('should handle PNG data URL', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA'
      const [header, base64Data] = dataUrl.split(',')
      const mimeMatch = header.match(/data:([^;]+)/)

      expect(mimeMatch?.[1]).toBe('image/png')
      expect(base64Data).toBe('iVBORw0KGgoAAAANSUhEUgAA')
    })
  })
})
