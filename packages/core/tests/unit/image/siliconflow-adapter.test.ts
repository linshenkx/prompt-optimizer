import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { SiliconFlowImageAdapter } from '../../../src/services/image/adapters/siliconflow'
import type { ImageRequest, ImageModelConfig } from '../../../src/services/image/types'
import { IMAGE_ERROR_CODES } from '../../../src/constants/error-codes'

describe('SiliconFlowImageAdapter', () => {
  let adapter: SiliconFlowImageAdapter
  const realFetch = global.fetch

  beforeEach(() => {
    adapter = new SiliconFlowImageAdapter()
  })

  afterEach(() => {
    global.fetch = realFetch
  })

  describe('Provider Information', () => {
    test('should return correct provider information', () => {
      const provider = adapter.getProvider()

      expect(provider.id).toBe('siliconflow')
      expect(provider.name).toBe('SiliconFlow')
      expect(provider.requiresApiKey).toBe(true)
      expect(provider.defaultBaseURL).toBe('https://api.siliconflow.cn/v1')
      expect(provider.supportsDynamicModels).toBe(false)
      expect(provider.connectionSchema?.required).toContain('apiKey')
      expect(provider.connectionSchema?.optional).toEqual(expect.arrayContaining(['baseURL']))
    })
  })

  describe('Static Models', () => {
    test('should return static models list', () => {
      const models = adapter.getModels()

      expect(Array.isArray(models)).toBe(true)
      expect(models.length).toBeGreaterThan(0)

      const kolorsModel = models.find(m => m.id === 'Kwai-Kolors/Kolors')
      expect(kolorsModel).toBeDefined()
      expect(kolorsModel).toMatchObject({
        id: 'Kwai-Kolors/Kolors',
        name: 'Kolors',
        providerId: 'siliconflow',
        capabilities: {
          text2image: true,
          image2image: true,
          multiImage: false
        },
        parameterDefinitions: expect.any(Array)
      })

      // 验证 Flux 模型也存在
      const qwenModel = models.find(m => m.id === 'Qwen/Qwen-Image')
      expect(qwenModel).toBeDefined()
    })

    test('should include correct parameters in model definition', () => {
      const models = adapter.getModels()
      const kolorsModel = models.find(m => m.id === 'Kwai-Kolors/Kolors')

      expect(kolorsModel?.parameterDefinitions).toBeDefined()

      // 验证 image_size 参数
      const sizeParam = kolorsModel?.parameterDefinitions?.find(p => p.name === 'image_size')
      expect(sizeParam).toBeDefined()
      expect(sizeParam?.type).toBe('string')
      expect(sizeParam?.allowedValues).toContain('1024x1024')

      // 验证 num_inference_steps 参数
      const stepsParam = kolorsModel?.parameterDefinitions?.find(p => p.name === 'num_inference_steps')
      expect(stepsParam).toBeDefined()
      expect(stepsParam?.type).toBe('integer')
      expect(stepsParam?.defaultValue).toBe(20)

      // 验证 guidance_scale 参数
      const guidanceParam = kolorsModel?.parameterDefinitions?.find(p => p.name === 'guidance_scale')
      expect(guidanceParam).toBeDefined()
      expect(guidanceParam?.type).toBe('number')
      expect(guidanceParam?.defaultValue).toBe(7.5)
    })
  })

  // Dynamic model fetching is not enabled via provider flag; adapter may still expose helper, skip tests here

  // 连接验证已移除

  describe('Image Generation', () => {
    test('should generate image with valid configuration', async () => {
      const models = adapter.getModels()
      expect(models.length).toBeGreaterThan(0)
      const modelId = models[0].id

      const config: ImageModelConfig = {
        id: 'test-config',
        name: 'Test SiliconFlow Config',
        providerId: 'siliconflow',
        modelId,
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key',
          baseURL: 'https://api.siliconflow.cn/v1'
        },
        paramOverrides: {
          image_size: '1024x1024',
          num_inference_steps: 20,
          guidance_scale: 7.5
        }
      }

      const request: ImageRequest = {
        prompt: '一个美丽的景色，高质量，细节丰富',
        configId: config.id,
        count: 1,
        paramOverrides: {
          outputMimeType: 'image/png'
        }
      }

      // Mock successful generation response
      const mockGenerationResponse = {
        images: [
          {
            url: 'https://example.com/generated-image.png',
            b64: null,
            mimeType: 'image/png'
          }
        ],
        seed: 1234567890,
        timings: {
          inference: 2.5
        }
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGenerationResponse)
      })

      const result = await adapter.generate(request, config)

      expect(result).toBeDefined()
      expect(result.images).toHaveLength(1)
      expect(result.images[0]).toMatchObject({
        url: expect.any(String),
        mimeType: 'image/png'
      })
      expect(result.metadata).toBeDefined()
      expect(result.metadata?.configId).toBe(config.id)
      expect(result.metadata?.modelId).toBe(config.modelId)
      expect(result.metadata?.seed).toBe(1234567890)
    })

    test('should handle generation failure', async () => {
      const models = adapter.getModels()
      expect(models.length).toBeGreaterThan(0)
      const modelId = models[0].id

      const config: ImageModelConfig = {
        id: 'test-config',
        name: 'Test Config',
        providerId: 'siliconflow',
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
        statusText: 'Bad Request',
        json: () => Promise.resolve({
          error: {
            message: 'Invalid prompt'
          }
        })
      })

      await expect(adapter.generate(request, config)).rejects.toThrow()
    })

    test('should validate required parameters', async () => {
      const models = adapter.getModels()
      expect(models.length).toBeGreaterThan(0)
      const modelId = models[0].id

      const config: ImageModelConfig = {
        id: 'test-config',
        name: 'Test Config',
        providerId: 'siliconflow',
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
  })

  const RUN_REAL_API = process.env.RUN_REAL_API === '1'
  describe.skipIf(!RUN_REAL_API)('Real API Integration (when API key available)', () => {
    test('should perform real API call when API key is provided', async () => {
      const apiKey = process.env.VITE_SILICONFLOW_API_KEY
      if (!apiKey) {
        console.log('跳过 SiliconFlow 真实 API 测试：未设置 VITE_SILICONFLOW_API_KEY')
        return
      }

      const models = adapter.getModels()
      expect(models.length).toBeGreaterThan(0)
      const modelId = models[0].id

      const config: ImageModelConfig = {
        id: 'real-test-config',
        name: 'Real SiliconFlow Test',
        providerId: 'siliconflow',
        modelId,
        enabled: true,
        connectionConfig: {
          apiKey: apiKey,
          baseURL: 'https://api.siliconflow.cn/v1'
        },
        paramOverrides: {
          image_size: '1024x1024',
          num_inference_steps: 20,
          guidance_scale: 7.5
        }
      }

      const request: ImageRequest = {
        prompt: '星际穿越，黑洞，蒸汽朋克风格，科幻电影场景，高质量，8K分辨率',
        configId: config.id,
        count: 1
      }

      const result = await adapter.generate(request, config)

      expect(result).toBeDefined()
      expect(result.images).toHaveLength(1)
      expect(result.images[0].url).toBeTruthy()
      expect(result.metadata?.seed).toBeGreaterThan(0)

      // 验证 URL 可访问性
      if (result.images[0].url) {
        const response = await fetch(result.images[0].url, { method: 'HEAD' })
        expect(response.ok).toBe(true)
      }
    }, 30000) // 30秒超时
  })
})
