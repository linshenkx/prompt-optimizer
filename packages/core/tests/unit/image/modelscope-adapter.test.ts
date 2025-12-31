import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ModelScopeImageAdapter } from '../../../src/services/image/adapters/modelscope'
import type { ImageRequest, ImageModelConfig } from '../../../src/services/image/types'

describe('ModelScopeImageAdapter', () => {
  let adapter: ModelScopeImageAdapter

  beforeEach(() => {
    adapter = new ModelScopeImageAdapter()
  })

  describe('Provider Information', () => {
    test('should return correct provider information', () => {
      const provider = adapter.getProvider()

      expect(provider.id).toBe('modelscope')
      expect(provider.name).toBe('ModelScope')
      expect(provider.requiresApiKey).toBe(true)
      expect(provider.defaultBaseURL).toBe('https://api-inference.modelscope.cn/v1')
      expect(provider.supportsDynamicModels).toBe(false)
      expect(provider.connectionSchema?.required).toContain('apiKey')
      expect(provider.connectionSchema?.optional).toEqual(expect.arrayContaining(['baseURL']))
    })
  })

  describe('Static Models', () => {
    test('should return static models list', () => {
      const models = adapter.getModels()

      expect(Array.isArray(models)).toBe(true)
      expect(models.length).toBe(1) // Z-Image-Turbo only

      const zImageModel = models.find(m => m.id === 'Tongyi-MAI/Z-Image-Turbo')
      expect(zImageModel).toBeDefined()
      expect(zImageModel).toMatchObject({
        id: 'Tongyi-MAI/Z-Image-Turbo',
        name: 'Z-Image-Turbo',
        providerId: 'modelscope',
        capabilities: {
          text2image: true,
          image2image: false,
          multiImage: false
        },
        parameterDefinitions: expect.any(Array)
      })
    })

    test('should include correct parameters in model definition', () => {
      const models = adapter.getModels()
      const zImageModel = models.find(m => m.id === 'Tongyi-MAI/Z-Image-Turbo')

      expect(zImageModel?.parameterDefinitions).toBeDefined()

      // 验证 size 参数
      const sizeParam = zImageModel?.parameterDefinitions?.find(p => p.name === 'size')
      expect(sizeParam).toBeDefined()
      expect(sizeParam?.type).toBe('string')
      expect(sizeParam?.defaultValue).toBe('1024x1024')
      expect(sizeParam?.allowedValues).toContain('1024x1024')

      // 验证 n 参数
      const nParam = zImageModel?.parameterDefinitions?.find(p => p.name === 'n')
      expect(nParam).toBeDefined()
      expect(nParam?.type).toBe('integer')
      expect(nParam?.defaultValue).toBe(1)
    })
  })

  describe('Image Generation', () => {
    test('should validate configuration before generating', async () => {
      const invalidConfig: ImageModelConfig = {
        id: 'test-config',
        name: 'Test ModelScope Config',
        providerId: 'modelscope',
        modelId: 'Tongyi-MAI/Z-Image-Turbo',
        enabled: true,
        connectionConfig: {
          // 缺少 apiKey
        },
        provider: adapter.getProvider(),
        model: adapter.getModels()[0]
      }

      const request: ImageRequest = {
        configId: 'test-config',
        prompt: '一朵简单的红色花朵',
        count: 1
      }

      await expect(adapter.generate(request, invalidConfig)).rejects.toThrow('requires API key')
    })

    test('should validate prompt is required', async () => {
      const config: ImageModelConfig = {
        id: 'test-config',
        name: 'Test ModelScope Config',
        providerId: 'modelscope',
        modelId: 'Tongyi-MAI/Z-Image-Turbo',
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key'
        },
        provider: adapter.getProvider(),
        model: adapter.getModels()[0]
      }

      const invalidRequest: ImageRequest = {
        configId: 'test-config',
        prompt: '', // 空提示词
        count: 1
      }

      await expect(adapter.generate(invalidRequest, config)).rejects.toThrow('Prompt is required')
    })

    test('should reject requests with input images', async () => {
      const config: ImageModelConfig = {
        id: 'test-config',
        name: 'Test ModelScope Config',
        providerId: 'modelscope',
        modelId: 'Tongyi-MAI/Z-Image-Turbo',
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key'
        },
        provider: adapter.getProvider(),
        model: adapter.getModels()[0]
      }

      const request: ImageRequest = {
        configId: 'test-config',
        prompt: 'make this colorful',
        inputImage: {
          url: 'https://example.com/test.png',
          mimeType: 'image/png'
        },
        count: 1
      }

      await expect(adapter.generate(request, config)).rejects.toThrow('only supports text-to-image')
    })
  })

  describe('Real API Tests', () => {
    const hasApiKey = !!(
      process.env.MODELSCOPE_API_KEY ||
      process.env.VITE_MODELSCOPE_API_KEY
    )

    test.skipIf(!hasApiKey)('should successfully call ModelScope text-to-image API', async () => {
      const realAdapter = new ModelScopeImageAdapter()
      const apiKey = process.env.MODELSCOPE_API_KEY || process.env.VITE_MODELSCOPE_API_KEY

      const config: ImageModelConfig = {
        id: 'test-config',
        name: 'Test ModelScope Config',
        providerId: 'modelscope',
        modelId: 'Tongyi-MAI/Z-Image-Turbo',
        enabled: true,
        connectionConfig: {
          apiKey: apiKey!
        },
        paramOverrides: {
          size: '1024x1024',
          n: 1
        },
        provider: realAdapter.getProvider(),
        model: realAdapter.getModels()[0]
      }

      const request: ImageRequest = {
        configId: 'test-config',
        prompt: '一朵简单的红色花朵',
        count: 1
      }

      const result = await realAdapter.generate(request, config)

      expect(result).toBeDefined()
      expect(result.images).toBeDefined()
      expect(Array.isArray(result.images)).toBe(true)
      expect(result.images.length).toBeGreaterThan(0)
      expect(result.images[0].url).toBeDefined()
      expect(result.metadata).toBeDefined()
      expect(result.metadata?.providerId).toBe('modelscope')

      console.log('ModelScope Text-to-Image API Response:', {
        imageCount: result.images.length,
        imageUrl: result.images[0].url?.substring(0, 100),
        metadata: result.metadata
      })
    }, 180000) // 180秒超时，异步任务轮询需要更长时间
  })
})
