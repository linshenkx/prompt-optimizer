import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { SeedreamImageAdapter } from '../../../src/services/image/adapters/seedream'
import type { ImageRequest, ImageModelConfig } from '../../../src/services/image/types'
import { IMAGE_ERROR_CODES } from '../../../src/constants/error-codes'

const RUN_REAL_API = process.env.RUN_REAL_API === '1'

describe('SeedreamImageAdapter', () => {
  let adapter: SeedreamImageAdapter
  let modelId: string
  const realFetch = global.fetch

  beforeEach(() => {
    adapter = new SeedreamImageAdapter()
    modelId = adapter.getModels()[0].id
  })

  afterEach(() => {
    global.fetch = realFetch
  })

  describe('Provider Information', () => {
    test('should return correct provider information', () => {
      const provider = adapter.getProvider()

      expect(provider.id).toBe('seedream')
      expect(provider.name).toBe('Seedream')
      expect(provider.requiresApiKey).toBe(true)
      expect(provider.defaultBaseURL).toBe('https://ark.cn-beijing.volces.com/api/v3')
      expect(provider.supportsDynamicModels).toBe(false)
      expect(provider.apiKeyUrl).toBe('https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey')
      expect(provider.connectionSchema?.required).toContain('apiKey')
      expect(provider.connectionSchema?.optional).toEqual(expect.arrayContaining(['baseURL']))
    })
  })

  describe('Static Models', () => {
    test('should return static Seedream models', () => {
      const models = adapter.getModels()

      expect(Array.isArray(models)).toBe(true)
      expect(models.length).toBeGreaterThan(0)

      const seedreamModel = models.find(m => m.id.includes('seedream') || m.id.includes('doubao'))
      expect(seedreamModel).toBeDefined()
      expect(seedreamModel).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        providerId: 'seedream',
        capabilities: {
          text2image: true,
          image2image: expect.any(Boolean),
          multiImage: expect.any(Boolean)
        },
        parameterDefinitions: expect.any(Array)
      })
    })

    test('should include Seedream 4.0, 4.5, and 5.0 lite model ids', () => {
      const modelIds = adapter.getModels().map(model => model.id)

      expect(modelIds).toEqual(expect.arrayContaining([
        'doubao-seedream-4-0-250828',
        'doubao-seedream-4-5-251128',
        'doubao-seedream-5-0-lite-260128'
      ]))
    })

    test('should declare multi-image capability for Seedream 4.0', () => {
      const model = adapter.getModels()[0]

      expect(model.capabilities.image2image).toBe(true)
      expect(model.capabilities.multiImage).toBe(true)
    })

    test('should declare multi-image capability for Seedream 4.5', () => {
      const model = adapter.getModels().find(item => item.id === 'doubao-seedream-4-5-251128')

      expect(model).toBeDefined()
      expect(model?.capabilities.image2image).toBe(true)
      expect(model?.capabilities.multiImage).toBe(true)
    })

    test('should include watermark and size parameters', () => {
      const models = adapter.getModels()
      const model = models[0]

      expect(model.parameterDefinitions).toBeDefined()
      const watermarkParam = model.parameterDefinitions?.find(p => p.name === 'watermark')
      const sizeParam = model.parameterDefinitions?.find(p => p.name === 'size')

      expect(watermarkParam).toBeDefined()
      expect(watermarkParam?.type).toBe('boolean')

      expect(sizeParam).toBeDefined()
      expect(sizeParam?.allowedValues).toContain('1024x1024')
    })
  })

  // Dynamic models not supported

  // Connection validation not implemented for Seedream adapter

  describe('Image Generation', () => {
    test('should generate image with Seedream/Doubao model', async () => {
      const config: ImageModelConfig = {
        id: 'test-seedream-config',
        name: 'Test Seedream Config',
        providerId: 'seedream',
        modelId,
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key',
          baseURL: 'https://ark.cn-beijing.volces.com/api/v3'
        },
        paramOverrides: {
          size: '1024x1024',
          watermark: false
        }
      }

      const request: ImageRequest = {
        prompt: '美丽的山水画，中国传统艺术风格',
        configId: config.id,
        count: 1,
        paramOverrides: {
          outputMimeType: 'image/png'
        }
      }

      const mockResponse = {
        code: 0,
        data: [
          {
            url: 'https://example.com/seedream-generated-image.png'
          }
        ],
        task_id: 'task-123456',
        created_at: Date.now()
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await adapter.generate(request, config)

      expect(result).toBeDefined()
      expect(result.images).toHaveLength(1)
      expect(result.images[0]).toMatchObject({
        url: expect.any(String)
      })
      expect(result.metadata).toBeDefined()
      expect(result.metadata?.configId).toBe(config.id)
      expect(result.metadata?.modelId).toBe(config.modelId)
    })

    test('should handle generation failure', async () => {
      const config: ImageModelConfig = {
        id: 'test-config',
        name: 'Test Config',
        providerId: 'seedream',
        modelId,
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key'
        },
        paramOverrides: {}
      }

      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: config.id,
        count: 1
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          code: 400,
          message: 'Invalid request parameters'
        })
      })

      await expect(adapter.generate(request, config)).rejects.toThrow()
    })

    test('should validate required parameters', async () => {
      const config: ImageModelConfig = {
        id: 'test-config',
        name: 'Test Config',
        providerId: 'seedream',
        modelId,
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

    test('should handle Chinese prompts correctly', async () => {
      const config: ImageModelConfig = {
        id: 'chinese-test-config',
        name: 'Chinese Test Config',
        providerId: 'seedream',
        modelId,
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key'
        },
        paramOverrides: {}
      }

      const request: ImageRequest = {
        prompt: '古代中国山水画，水墨画风格，朦胧意境',
        configId: config.id,
        count: 1
      }

      const mockResponse = {
        code: 0,
        data: [
          { url: 'https://example.com/chinese-landscape.png' }
        ]
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await adapter.generate(request, config)

      expect(result).toBeDefined()
      expect(result.images).toHaveLength(1)
      // 验证请求体中包含正确的中文提示词
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('古代中国山水画')
        })
      )
    })

    test('should send multiple reference images as an image array', async () => {
      const config: ImageModelConfig = {
        id: 'multi-seedream-config',
        name: 'Multi Seedream Config',
        providerId: 'seedream',
        modelId,
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key',
          baseURL: 'https://ark.cn-beijing.volces.com/api/v3'
        },
        paramOverrides: {}
      }

      const request: ImageRequest = {
        prompt: '将两张参考图融合成一张统一画面',
        configId: config.id,
        count: 1,
        inputImages: [
          { b64: 'AAAA', mimeType: 'image/png' },
          { b64: 'BBBB', mimeType: 'image/jpeg' }
        ]
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          code: 0,
          data: [{ url: 'https://example.com/multi-image.png' }]
        })
      })

      await adapter.generate(request, config)

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"image":["data:image/png;base64,AAAA","data:image/jpeg;base64,BBBB"]')
        })
      )
    })

    test('should force response_format to b64_json even when stored overrides request url output', async () => {
      const config: ImageModelConfig = {
        id: 'seedream-b64-config',
        name: 'Seedream B64 Config',
        providerId: 'seedream',
        modelId,
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key',
          baseURL: 'https://ark.cn-beijing.volces.com/api/v3'
        },
        paramOverrides: {
          response_format: 'url',
          size: '2K'
        }
      }

      const request: ImageRequest = {
        prompt: '返回 base64 结果',
        configId: config.id,
        count: 1,
        paramOverrides: {
          response_format: 'url'
        }
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          code: 0,
          data: [{ b64_json: 'aGVsbG8=' }]
        })
      })

      await adapter.generate(request, config)

      const [, init] = vi.mocked(fetch).mock.calls[0]!
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>

      expect(body.response_format).toBe('b64_json')
    })

    test('should send Seedream 5.0 lite specific payload fields', async () => {
      const config: ImageModelConfig = {
        id: 'seedream-50-config',
        name: 'Seedream 5.0 Config',
        providerId: 'seedream',
        modelId: 'doubao-seedream-5-0-lite-260128',
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key',
          baseURL: 'https://ark.cn-beijing.volces.com/api/v3'
        },
        paramOverrides: {
          output_format: 'jpeg',
          tools: ['web_search'],
          size: '2048x2048'
        }
      }

      const request: ImageRequest = {
        prompt: '结合联网信息生成新闻插画',
        configId: config.id,
        count: 1
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          code: 0,
          data: [{ b64_json: 'aGVsbG8=' }]
        })
      })

      await adapter.generate(request, config)

      const [, init] = vi.mocked(fetch).mock.calls[0]!
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>

      expect(body.output_format).toBe('jpeg')
      expect(body.tools).toEqual(['web_search'])
      expect(body.response_format).toBe('b64_json')
      expect(body.sequential_image_generation).toBeUndefined()
    })
  })

  describe('Provider Capabilities', () => {
    test('should not support dynamic models', () => {
      const provider = adapter.getProvider()
      expect(provider.supportsDynamicModels).toBe(false)
    })

    test('should require API key', () => {
      const provider = adapter.getProvider()
      expect(provider.requiresApiKey).toBe(true)
    })

    test('should support optional baseURL configuration', () => {
      const provider = adapter.getProvider()
      expect(provider.connectionSchema?.optional).toContain('baseURL')
      expect(provider.defaultBaseURL).toBe('https://ark.cn-beijing.volces.com/api/v3')
    })
  })

  describe('Parameter Validation', () => {
    test('should validate size parameter values', () => {
      const models = adapter.getModels()
      const model = models[0]
      const sizeParam = model.parameterDefinitions?.find(p => p.name === 'size')

      expect(sizeParam?.allowedValues).toContain('1024x1024')
      expect(sizeParam?.allowedValues).toContain('512x512')
    })

    test('should use the documented size schema for Seedream 4.5', () => {
      const model = adapter.getModels().find(item => item.id === 'doubao-seedream-4-5-251128')
      const sizeParam = model?.parameterDefinitions?.find(p => p.name === 'size')

      expect(sizeParam?.defaultValue).toBe('2048x2048')
      expect(sizeParam?.allowedValues).toEqual(expect.arrayContaining(['2K', '4K', '2048x2048']))
      expect(sizeParam?.allowedValues).not.toContain('1K')
      expect(sizeParam?.allowedValues).not.toContain('512x512')
    })

    test('should expose Seedream 5.0 lite specific parameters', () => {
      const model = adapter.getModels().find(item => item.id === 'doubao-seedream-5-0-lite-260128')
      const parameterNames = model?.parameterDefinitions.map(p => p.name) || []

      expect(parameterNames).toEqual(expect.arrayContaining(['size', 'output_format', 'tools']))
      expect(parameterNames).not.toContain('sequential_image_generation')
      expect(parameterNames).not.toContain('watermark')
    })

    test('should validate watermark parameter', () => {
      const models = adapter.getModels()
      const model = models[0]
      const watermarkParam = model.parameterDefinitions?.find(p => p.name === 'watermark')

      expect(watermarkParam?.type).toBe('boolean')
      expect(watermarkParam?.defaultValue).toBe(false)
    })
  })

  describe.skipIf(!RUN_REAL_API)('Real API Integration (when API key available)', () => {
    test('should perform real API call when API key is provided', async () => {
      const apiKey = process.env.VITE_SEEDREAM_API_KEY || process.env.VITE_ARK_API_KEY
      if (!apiKey) {
        return
      }

      const config: ImageModelConfig = {
        id: 'real-seedream-test',
        name: 'Real Seedream Test',
        providerId: 'seedream',
        modelId,
        enabled: true,
        connectionConfig: {
          apiKey: apiKey,
          baseURL: process.env.VITE_SEEDREAM_BASE_URL || process.env.VITE_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
        },
        paramOverrides: {
          size: '1024x1024',
          watermark: false
        }
      }

      const request: ImageRequest = {
        prompt: '中国传统山水画，水墨画风格，远山如黛，云雾缭绕',
        configId: config.id,
        count: 1
      }

      const result = await adapter.generate(request, config)

      expect(result).toBeDefined()
      expect(result.images).toHaveLength(1)
      expect(result.images[0].b64).toBeTruthy()
      expect(result.images[0].mimeType).toBe('image/png')
      expect(result.images[0].url).toBeFalsy()
    }, 45000) // 45秒超时
  })
})
