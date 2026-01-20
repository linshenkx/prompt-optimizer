import { describe, test, expect, vi, beforeEach } from 'vitest'
import { OpenAIImageAdapter } from '../../../src/services/image/adapters/openai'
import type { ImageRequest, ImageModelConfig } from '../../../src/services/image/types'
import { IMAGE_ERROR_CODES } from '../../../src/constants/error-codes'

const RUN_REAL_API = process.env.RUN_REAL_API === '1'

describe('OpenAIImageAdapter', () => {
  let adapter: OpenAIImageAdapter

  beforeEach(() => {
    adapter = new OpenAIImageAdapter()
  })

  describe('Provider Information', () => {
    test('should return correct provider information', () => {
      const provider = adapter.getProvider()

      expect(provider.id).toBe('openai')
      expect(provider.name).toBe('OpenAI')
      expect(provider.requiresApiKey).toBe(true)
      expect(provider.defaultBaseURL).toBe('https://api.openai.com/v1')
      expect(provider.supportsDynamicModels).toBe(false)
      expect(provider.connectionSchema?.required).toContain('apiKey')
      expect(provider.connectionSchema?.optional).toEqual(expect.arrayContaining(['baseURL']))
      expect(provider.connectionSchema?.fieldTypes.apiKey).toBe('string')
      expect(provider.connectionSchema?.fieldTypes.baseURL).toBe('string')
    })
  })

  describe('Static Models', () => {
    test('should return static DALL-E models', () => {
      const models = adapter.getModels()

      expect(Array.isArray(models)).toBe(true)
      expect(models.length).toBeGreaterThan(0)

      const dalleModel = models.find(m => m.id.includes('gpt-image-1'))
      expect(dalleModel).toBeDefined()
      expect(dalleModel).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        providerId: 'openai',
        capabilities: {
          text2image: true,
          image2image: expect.any(Boolean),
          multiImage: expect.any(Boolean)
        },
        parameterDefinitions: expect.any(Array)
      })
    })

    test('should include quality and size parameters', () => {
      const models = adapter.getModels()
      const model = models.find(m => m.id.includes('gpt-image-1'))

      expect(model?.parameterDefinitions).toBeDefined()
      const qualityParam = model?.parameterDefinitions?.find(p => p.name === 'quality')
      const sizeParam = model?.parameterDefinitions?.find(p => p.name === 'size')

      expect(qualityParam).toBeDefined()
      expect(qualityParam?.type).toBe('string')
      expect(qualityParam?.allowedValues).toEqual(expect.arrayContaining(['auto', 'high', 'medium', 'low']))

      expect(sizeParam).toBeDefined()
      expect(sizeParam?.allowedValues).toContain('1024x1024')
    })
  })

  // Dynamic models are not supported for OpenAI in current implementation

  // 连接验证已移除

  describe('Image Generation', () => {
    test('should generate image with GPT Image 1', async () => {
      const config: ImageModelConfig = {
        id: 'test-dalle3-config',
        name: 'Test OpenAI Image Config',
        providerId: 'openai',
        modelId: 'gpt-image-1',
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key'
        },
        paramOverrides: {
          quality: 'standard',
          size: '1024x1024'
        }
      }

      const request: ImageRequest = {
        prompt: 'A beautiful landscape with mountains and lakes',
        configId: config.id,
        count: 1
      }

      const mockResponse = {
        created: Date.now(),
        data: [
          {
            b64_json: 'aGVsbG8=',
            revised_prompt: 'A beautiful landscape with mountains and lakes, painted in a realistic style'
          }
        ]
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await adapter.generate(request, config)

      expect(result).toBeDefined()
      expect(result.images).toHaveLength(1)
      expect(result.images[0].b64).toBeDefined()
      expect(result.images[0].url?.startsWith('data:image/png;base64,')).toBe(true)
      expect(result.text).toBe('A beautiful landscape with mountains and lakes, painted in a realistic style')
      expect(result.metadata?.configId).toBe(config.id)
      expect(result.metadata?.modelId).toBe(config.modelId)
    })

    test('should generate single image with legacy id allowed', async () => {
      const config: ImageModelConfig = {
        id: 'test-dalle2-config',
        name: 'Test DALL-E 2 Config',
        providerId: 'openai',
        modelId: 'dall-e-2',
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key'
        },
        paramOverrides: {
          size: '512x512'
        }
      }

      const request: ImageRequest = {
        prompt: 'A simple drawing of a cat',
        configId: config.id,
        count: 1
      }

      const mockResponse = {
        created: Date.now(),
        data: [
          { b64_json: 'Y2F0LWltYWdlLWJhc2U2NA==' }
        ]
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await adapter.generate(request, config)

      expect(result.images).toHaveLength(1)
      expect(result.images[0].b64).toBeDefined()
    })

    test('should handle content policy violation', async () => {
      const config: ImageModelConfig = {
        id: 'test-config',
        name: 'Test Config',
        providerId: 'openai',
        modelId: 'dall-e-3',
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key'
        },
        paramOverrides: {}
      }

      const request: ImageRequest = {
        prompt: 'inappropriate content',
        configId: config.id,
        count: 1
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: {
            code: 'content_policy_violation',
            message: 'Your request was rejected as a result of our safety system.'
          }
        })
      })

      await expect(adapter.generate(request, config))
        .rejects.toThrow(/content.*policy|safety.*system|rejected.*safety/i)
    })

    test('should validate required parameters', async () => {
      const config: ImageModelConfig = {
        id: 'test-config',
        name: 'Test Config',
        providerId: 'openai',
        modelId: 'dall-e-3',
        enabled: true,
        connectionConfig: {
          // Missing apiKey
        },
        paramOverrides: {}
      }

      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: config.id,
        count: 1
      }

      await expect(adapter.generate(request, config))
        .rejects.toMatchObject({ code: IMAGE_ERROR_CODES.API_KEY_REQUIRED })
    })
  })

  describe.skipIf(!RUN_REAL_API)('Real API Integration (when API key available)', () => {
    test('should perform real API call when API key is provided', async () => {
      const apiKey = process.env.VITE_OPENAI_API_KEY
      if (!apiKey) {
        console.log('跳过 OpenAI 真实 API 测试：未设置 VITE_OPENAI_API_KEY')
        return
      }

      const config: ImageModelConfig = {
        id: 'real-openai-test',
        name: 'Real OpenAI Test',
        providerId: 'openai',
        modelId: 'dall-e-3',
        enabled: true,
        connectionConfig: {
          apiKey: apiKey
        },
        paramOverrides: {
          quality: 'standard',
          size: '1024x1024'
        }
      }

      const request: ImageRequest = {
        prompt: 'A serene mountain landscape at sunset, digital art style',
        configId: config.id,
        count: 1
      }

      const result = await adapter.generate(request, config)

      expect(result).toBeDefined()
      expect(result.images).toHaveLength(1)
      expect(result.images[0].url).toBeTruthy()

      // DALL-E 3 should provide revised prompt
      if (config.modelId === 'dall-e-3') {
        expect(result.text).toBeTruthy()
      }

      // 验证图像 URL 可访问性
      if (result.images[0].url) {
        const response = await fetch(result.images[0].url, { method: 'HEAD' })
        expect(response.ok).toBe(true)
      }
    }, 60000) // 60秒超时，OpenAI可能较慢
  })
})
