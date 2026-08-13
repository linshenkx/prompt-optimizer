import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpenAIImageAdapter } from '../../../src/services/image/adapters/openai'
import type { ImageRequest, ImageModelConfig } from '../../../src/services/image/types'
import { IMAGE_ERROR_CODES } from '../../../src/constants/error-codes'

const RUN_REAL_API = process.env.RUN_REAL_API === '1'

describe('OpenAIImageAdapter', () => {
  let adapter: OpenAIImageAdapter
  const realFetch = global.fetch

  beforeEach(() => {
    adapter = new OpenAIImageAdapter()
  })

  afterEach(() => {
    global.fetch = realFetch
  })

  describe('Provider Information', () => {
    test('should return correct provider information', () => {
      const provider = adapter.getProvider()

      expect(provider.id).toBe('openai')
      expect(provider.name).toBe('OpenAI')
      expect(provider.requiresApiKey).toBe(true)
      expect(provider.defaultBaseURL).toBe('https://api.openai.com/v1')
      expect(provider.supportsDynamicModels).toBe(true)
      expect(provider.connectionSchema?.required).toContain('apiKey')
      expect(provider.connectionSchema?.optional).toEqual(expect.arrayContaining(['baseURL']))
      expect(provider.connectionSchema?.fieldTypes.apiKey).toBe('string')
      expect(provider.connectionSchema?.fieldTypes.baseURL).toBe('string')
    })
  })

  describe('Static Models', () => {
    test('should return GPT Image 2 as the static default model', () => {
      const models = adapter.getModels()

      expect(Array.isArray(models)).toBe(true)
      expect(models.map(model => model.id)).toEqual(['gpt-image-2'])

      const imageModel = models[0]
      expect(imageModel).toMatchObject({
        id: 'gpt-image-2',
        name: expect.any(String),
        providerId: 'openai',
        capabilities: {
          text2image: true,
          image2image: expect.any(Boolean),
          multiImage: true
        },
        parameterDefinitions: expect.any(Array)
      })
    })

    test('should expose supported GPT Image 2 parameters', () => {
      const models = adapter.getModels()
      const model = models.find(m => m.id === 'gpt-image-2')

      expect(model?.parameterDefinitions).toBeDefined()
      const qualityParam = model?.parameterDefinitions?.find(p => p.name === 'quality')
      const sizeParam = model?.parameterDefinitions?.find(p => p.name === 'size')
      const backgroundParam = model?.parameterDefinitions?.find(p => p.name === 'background')

      expect(qualityParam).toBeDefined()
      expect(qualityParam?.type).toBe('string')
      expect(qualityParam?.allowedValues).toEqual(expect.arrayContaining(['auto', 'high', 'medium', 'low']))

      expect(sizeParam).toBeDefined()
      expect(sizeParam?.allowedValues).toEqual([
        '1024x1024',
        '1536x1024',
        '1024x1536',
        '2048x2048',
        '2048x1152',
        '3840x2160',
        '2160x3840',
        'auto'
      ])

      expect(backgroundParam?.allowedValues).toEqual(['auto', 'opaque'])
    })
  })

  describe('Dynamic Models', () => {
    test('should prioritize image-like models without filtering non-image models', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 'gpt-5.1' },
            { id: 'third-party-text-model', name: 'Text Model' },
            { id: 'gpt-image-2', name: 'GPT Image 2' },
            { id: 'vendor/custom-image-fast', name: 'Custom Image Fast' }
          ]
        })
      })

      const models = await adapter.getModelsAsync({
        apiKey: 'test-api-key',
        baseURL: 'https://compat.example.com'
      })

      expect(models.map(model => model.id)).toEqual([
        'gpt-image-2',
        'vendor/custom-image-fast',
        'gpt-5.1',
        'third-party-text-model'
      ])
      expect(models.find(model => model.id === 'gpt-5.1')).toBeDefined()
      expect(global.fetch).toHaveBeenCalledWith(
        'https://compat.example.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key'
          })
        })
      )
    })

    test('should fall back to static GPT Image 2 model when model fetch fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({})
      })

      const models = await adapter.getModelsAsync({ apiKey: 'test-api-key' })

      expect(models.map(model => model.id)).toEqual(['gpt-image-2'])
    })
  })

  // 连接验证已移除

  describe('Image Generation', () => {
    test('should generate image with GPT Image 2', async () => {
      const config: ImageModelConfig = {
        id: 'test-dalle3-config',
        name: 'Test OpenAI Image Config',
        providerId: 'openai',
        modelId: 'gpt-image-2',
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key'
        },
        paramOverrides: {
          quality: 'standard',
          size: '3840x2160'
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

      const [, options] = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.size).toBe('3840x2160')
      expect(body.response_format).toBeUndefined()
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
          { url: 'https://example.com/cat.png' }
        ]
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await adapter.generate(request, config)

      expect(result.images).toHaveLength(1)
      expect(result.images[0].url).toBe('https://example.com/cat.png')
    })

    test('should submit single image edits with the single image field', async () => {
      const config: ImageModelConfig = {
        id: 'test-openai-edit-config',
        name: 'Test OpenAI Edit Config',
        providerId: 'openai',
        modelId: 'gpt-image-2',
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key'
        },
        paramOverrides: {
          size: '1024x1024'
        }
      }

      const request: ImageRequest = {
        prompt: 'make this reference more cinematic',
        configId: config.id,
        inputImage: {
          b64: 'aGVsbG8=',
          mimeType: 'image/png'
        },
        count: 1
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ b64_json: 'ZWRpdA==' }]
        })
      })

      await adapter.generate(request, config)

      const [url, options] = (global.fetch as any).mock.calls[0]
      expect(url).toBe('https://api.openai.com/v1/images/edits')
      expect(options.body).toBeInstanceOf(FormData)

      const formData = options.body as FormData
      expect(formData.get('model')).toBe('gpt-image-2')
      expect(formData.get('prompt')).toBe('make this reference more cinematic')
      expect(formData.get('size')).toBe('1024x1024')
      expect(formData.get('n')).toBe('1')
      expect(formData.get('response_format')).toBeNull()
      expect(formData.getAll('image')).toHaveLength(1)
      expect(formData.getAll('image[]')).toHaveLength(0)
    })

    test('should submit multiple edit images as OpenAI image array fields', async () => {
      const config: ImageModelConfig = {
        id: 'test-openai-multi-edit-config',
        name: 'Test OpenAI Multi Edit Config',
        providerId: 'openai',
        modelId: 'gpt-image-2',
        enabled: true,
        connectionConfig: {
          apiKey: 'test-api-key'
        },
        paramOverrides: {
          size: '1024x1024',
          outputMimeType: 'image/png'
        }
      }

      const request: ImageRequest = {
        prompt: 'combine these two references into one scene',
        configId: config.id,
        inputImages: [
          { b64: 'aGVsbG8=', mimeType: 'image/png' },
          { b64: 'd29ybGQ=', mimeType: 'image/jpeg' }
        ],
        count: 1,
        paramOverrides: {
          batch_size: 4,
          n: 3,
          outputMimeType: 'image/png'
        }
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ b64_json: 'bXVsdGktZWRpdA==' }]
        })
      })

      const result = await adapter.generate(request, config)

      expect(result.images).toHaveLength(1)
      const [url, options] = (global.fetch as any).mock.calls[0]
      expect(url).toBe('https://api.openai.com/v1/images/edits')
      expect(options.body).toBeInstanceOf(FormData)

      const formData = options.body as FormData
      expect(formData.get('model')).toBe('gpt-image-2')
      expect(formData.get('prompt')).toBe('combine these two references into one scene')
      expect(formData.get('size')).toBe('1024x1024')
      expect(formData.get('n')).toBe('1')
      expect(formData.get('batch_size')).toBeNull()
      expect(formData.get('outputMimeType')).toBeNull()
      expect(formData.get('response_format')).toBeNull()
      expect(formData.getAll('image')).toHaveLength(0)
      expect(formData.getAll('image[]')).toHaveLength(2)
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
