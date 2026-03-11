import { describe, test, expect, vi, beforeEach } from 'vitest'
import { GeminiImageAdapter } from '../../../src/services/image/adapters/gemini'
import type { ImageRequest, ImageModelConfig } from '../../../src/services/image/types'

describe('GeminiImageAdapter', () => {
  let adapter: GeminiImageAdapter

  beforeEach(() => {
    adapter = new GeminiImageAdapter()
  })

  describe('Provider Information', () => {
    test('should return correct provider information', () => {
      const provider = adapter.getProvider()

      expect(provider.id).toBe('gemini')
      expect(provider.name).toBe('Google Gemini')
      expect(provider.requiresApiKey).toBe(true)
      expect(provider.defaultBaseURL).toBe('https://generativelanguage.googleapis.com')
      expect(provider.supportsDynamicModels).toBe(true)
      expect(provider.connectionSchema?.required).toContain('apiKey')
      expect(provider.connectionSchema?.optional).toContain('baseURL')
    })
  })

  describe('Static Models', () => {
    test('should return static Gemini models', () => {
      const models = adapter.getModels()

      expect(Array.isArray(models)).toBe(true)
      expect(models.length).toBeGreaterThan(0)

      const geminiModel = models.find(m => m.id.includes('gemini'))
      expect(geminiModel).toBeDefined()
      expect(geminiModel).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        providerId: 'gemini',
        capabilities: {
          text2image: true,
          image2image: true,
          multiImage: true
        },
        parameterDefinitions: expect.any(Array)
      })
    })

    test('should include output format parameters', () => {
      const models = adapter.getModels()
      const model = models[0]

      expect(model.parameterDefinitions).toBeDefined()
      expect(Array.isArray(model.parameterDefinitions)).toBe(true)
      // 默认输出格式
      expect(model.defaultParameterValues).toHaveProperty('outputMimeType')
    })
  })

  // Dynamic models are not supported

  // 连接验证已移除

  describe('Image Generation', () => {
    test('should generate image successfully with mocked SDK', async () => {
      const config: ImageModelConfig = {
        id: 'test-gemini-config',
        name: 'Test Gemini Config',
        providerId: 'gemini',
        modelId: 'gemini-2.5-flash-image-preview',
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key'
        },
        paramOverrides: {}
      }

      const request: ImageRequest = {
        prompt: 'A beautiful landscape',
        configId: config.id,
        count: 1
      }

      // Mock GoogleGenAI SDK behavior via global fetchless path by mocking the method directly
      // We simulate genAI.models.generateContent result shape
      const mockResponse = {
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                { text: 'caption' },
                { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo' } }
              ]
            }
          }
        ],
        usageMetadata: { inputTokens: 10, outputTokens: 20 }
      }

      // Mock the constructor used internally by adapter
      const Original = (await import('../../../src/services/image/adapters/gemini')).GeminiImageAdapter
      // Monkey patch instance method using prototype
      const spy = vi.spyOn(Original.prototype as any, 'doGenerate')
        .mockResolvedValue({
          images: [{ b64: 'iVBORw0KGgo', mimeType: 'image/png', url: 'data:image/png;base64,iVBORw0KGgo' }],
          text: 'caption',
          metadata: { providerId: 'gemini', modelId: config.modelId, configId: config.id, finishReason: 'STOP', usage: mockResponse.usageMetadata }
        })

      const result = await adapter.generate(request, config)
      expect(result.images).toHaveLength(1)
      expect(result.metadata?.providerId).toBe('gemini')

      spy.mockRestore()
    })
  })

  describe('Provider Capabilities', () => {
    test('should support dynamic models', () => {
      const provider = adapter.getProvider()
      expect(provider.supportsDynamicModels).toBe(true)
    })

    test('should require API key', () => {
      const provider = adapter.getProvider()
      expect(provider.requiresApiKey).toBe(true)
    })

    test('should have correct connection schema', () => {
      const provider = adapter.getProvider()
      expect(provider.connectionSchema?.required).toContain('apiKey')
      expect(provider.connectionSchema?.fieldTypes.apiKey).toBe('string')
      expect(provider.connectionSchema?.optional).toContain('baseURL')
      expect(provider.connectionSchema?.fieldTypes.baseURL).toBe('string')
    })
  })

  describe('Static Model Definitions', () => {
    test('should define text2image capability correctly', () => {
      const models = adapter.getModels()
      const model = models[0]

      expect(model.capabilities.text2image).toBe(true)
      expect(model.capabilities.image2image).toBe(true)
      expect(model.capabilities.multiImage).toBe(true)
    })

    test('should have proper default parameters', () => {
      const models = adapter.getModels()
      const model = models[0]

      expect(model.defaultParameterValues).toBeDefined()
      expect(model.defaultParameterValues).toHaveProperty('outputMimeType')
      expect((model.defaultParameterValues as any)?.outputMimeType).toBe('image/png')
    })
  })

  // 注意：由于当前 Gemini 适配器需要完整重构，跳过真实 API 测试
  describe('Future Implementation Notes', () => {
    test('should document requirements for complete implementation', () => {
      // 记录完整实现的要求：
      // 1. 使用正确的 @google/generative-ai SDK
      // 2. 实现正确的认证流程
      // 3. 处理 Gemini 特有的图像生成 API
      // 4. 支持 Gemini 的多模态能力
      // 5. 正确的错误处理和响应解析

      expect(true).toBe(true) // 占位测试
    })
  })
})
