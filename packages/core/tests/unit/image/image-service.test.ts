import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ImageService } from '../../../src/services/image/service'
import { SeedreamImageAdapter } from '../../../src/services/image/adapters/seedream'
import { DashScopeImageAdapter } from '../../../src/services/image/adapters/dashscope'
import type {
  IImageModelManager,
  ImageModelConfig,
  ImageRequest,
  MultiImageGenerationRequest,
  IImageAdapterRegistry,
  ImageProvider,
  ImageModel,
  ImageResult,
  MultiImageRequest
} from '../../../src/services/image/types'
import { IMAGE_ERROR_CODES } from '../../../src/constants/error-codes'

const seedreamModelId = new SeedreamImageAdapter().getModels()[0].id

const dashscopeEditModel = new DashScopeImageAdapter().getModels().find(m => m.id === 'qwen-image-edit')
if (!dashscopeEditModel) {
  throw new Error('Missing dashscope qwen-image-edit model')
}
const dashscopeEditModelId = dashscopeEditModel.id
const dashscopeEditModelName = dashscopeEditModel.name

// Mock 图像模型管理器
class MockImageModelManager implements IImageModelManager {
  private configs: Map<string, ImageModelConfig> = new Map()

  constructor() {
    // 预设一些测试配置
    this.configs.set('test-openai-config', {
      id: 'test-openai-config',
      name: 'Test OpenAI Config',
      providerId: 'openai',
      modelId: 'dall-e-3',
      enabled: true,
      connectionConfig: {
        apiKey: 'test-api-key'
      },
      paramOverrides: {},
      // 自包含字段
      provider: {
        id: 'openai',
        name: 'OpenAI',
        description: 'OpenAI provider',
        requiresApiKey: true,
        defaultBaseURL: 'https://api.openai.com/v1',
        supportsDynamicModels: false
      },
      model: {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        description: 'OpenAI DALL-E 3 model',
        providerId: 'openai',
        capabilities: {
          text2image: true,
          image2image: false,
          multiImage: false
        },
        parameterDefinitions: [],
        defaultParameterValues: {}
      }
    })

    this.configs.set('test-disabled-config', {
      id: 'test-disabled-config',
      name: 'Test Disabled Config',
      providerId: 'openai',
      modelId: 'dall-e-2',
      enabled: false,
      connectionConfig: {
        apiKey: 'test-api-key'
      },
      paramOverrides: {},
      // 自包含字段
      provider: {
        id: 'openai',
        name: 'OpenAI',
        description: 'OpenAI provider',
        requiresApiKey: true,
        defaultBaseURL: 'https://api.openai.com/v1',
        supportsDynamicModels: false
      },
      model: {
        id: 'dall-e-2',
        name: 'DALL-E 2',
        description: 'OpenAI DALL-E 2 model',
        providerId: 'openai',
        capabilities: {
          text2image: true,
          image2image: false,
          multiImage: false
        },
        parameterDefinitions: [],
        defaultParameterValues: {}
      }
    })

    // 添加支持image2image的配置用于测试
    this.configs.set('test-image2image-config', {
      id: 'test-image2image-config',
      name: 'Test Image2Image Config',
      providerId: 'seedream',
      modelId: seedreamModelId,
      enabled: true,
      connectionConfig: {
        apiKey: 'test-api-key'
      },
      paramOverrides: {},
      // 自包含字段
      provider: {
        id: 'seedream',
        name: 'SeedreamAI',
        description: 'SeedreamAI provider',
        requiresApiKey: true,
        defaultBaseURL: 'https://api.seedream.ai/v1',
        supportsDynamicModels: false
      },
      model: {
        id: seedreamModelId,
        name: 'Doubao SeedreamAI',
        description: 'SeedreamAI model',
        providerId: 'seedream',
        capabilities: {
          text2image: true,
          image2image: true,
          multiImage: false
        },
        parameterDefinitions: [],
        defaultParameterValues: {}
      }
    })

    this.configs.set('test-multiimage-config', {
      id: 'test-multiimage-config',
      name: 'Test Multi Image Config',
      providerId: 'gemini',
      modelId: 'gemini-2.5-flash-image-preview',
      enabled: true,
      connectionConfig: {
        apiKey: 'test-api-key'
      },
      paramOverrides: {},
      provider: {
        id: 'gemini',
        name: 'Gemini',
        description: 'Gemini provider',
        requiresApiKey: true,
        defaultBaseURL: 'https://generativelanguage.googleapis.com',
        supportsDynamicModels: false
      },
      model: {
        id: 'gemini-2.5-flash-image-preview',
        name: 'Gemini 2.5 Flash Image Preview',
        description: 'Gemini multimodal image model',
        providerId: 'gemini',
        capabilities: {
          text2image: true,
          image2image: true,
          multiImage: true
        },
        parameterDefinitions: [],
        defaultParameterValues: {}
      }
    })
  }

  async addConfig(config: ImageModelConfig): Promise<void> {
    this.configs.set(config.id, config)
  }

  async updateConfig(id: string, updates: Partial<ImageModelConfig>): Promise<void> {
    const existing = this.configs.get(id)
    if (existing) {
      this.configs.set(id, { ...existing, ...updates })
    }
  }

  async deleteConfig(id: string): Promise<void> {
    this.configs.delete(id)
  }

  async getConfig(id: string): Promise<ImageModelConfig | null> {
    return this.configs.get(id) || null
  }

  async getAllConfigs(): Promise<ImageModelConfig[]> {
    return Array.from(this.configs.values())
  }

  async getEnabledConfigs(): Promise<ImageModelConfig[]> {
    return Array.from(this.configs.values()).filter(config => config.enabled)
  }

  // IImportExportable 实现
  async exportData(): Promise<any[]> {
    return Array.from(this.configs.values())
  }

  async importData(data: any[]): Promise<void> {
    this.configs.clear()
    for (const config of data) {
      this.configs.set(config.id, config)
    }
  }

  async getDataType(): Promise<string> {
    return 'image-model-configs'
  }

  async validateData(data: any[]): Promise<boolean> {
    return Array.isArray(data)
  }
}

describe('ImageService', () => {
  let imageService: ImageService
  let mockModelManager: MockImageModelManager

  beforeEach(() => {
    mockModelManager = new MockImageModelManager()
    imageService = new ImageService(mockModelManager)
  })

  describe('Request Validation', () => {
    test('should reject empty prompt', async () => {
      const request: ImageRequest = {
        prompt: '',
        configId: 'test-openai-config'
      }

      await expect(imageService.validateRequest(request)).rejects.toMatchObject({
        code: IMAGE_ERROR_CODES.PROMPT_EMPTY
      })
    })

    test('should reject whitespace-only prompt', async () => {
      const request: ImageRequest = {
        prompt: '   ',
        configId: 'test-openai-config'
      }

      await expect(imageService.validateRequest(request)).rejects.toMatchObject({
        code: IMAGE_ERROR_CODES.PROMPT_EMPTY
      })
    })

    test('should reject missing configId', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: ''
      }

      await expect(imageService.validateRequest(request)).rejects.toMatchObject({
        code: IMAGE_ERROR_CODES.CONFIG_ID_EMPTY
      })
    })

    test('should reject non-existent config', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'non-existent-config'
      }

      await expect(imageService.validateRequest(request)).rejects.toMatchObject({
        code: IMAGE_ERROR_CODES.CONFIG_NOT_FOUND,
        params: { configId: 'non-existent-config' }
      })
    })

    test('should reject disabled config', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-disabled-config'
      }

      await expect(imageService.validateRequest(request)).rejects.toMatchObject({
        code: IMAGE_ERROR_CODES.CONFIG_NOT_ENABLED,
        params: { configName: 'Test Disabled Config' }
      })
    })

    test('should reject non-single count', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-openai-config',
        count: 2
      }

      await expect(imageService.validateRequest(request)).rejects.toMatchObject({
        code: IMAGE_ERROR_CODES.ONLY_SINGLE_IMAGE_SUPPORTED
      })

      const request2: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-openai-config',
        count: 0
      }

      await expect(imageService.validateRequest(request2)).rejects.toMatchObject({
        code: IMAGE_ERROR_CODES.ONLY_SINGLE_IMAGE_SUPPORTED
      })
    })

    test('should accept non-standard image formats for provider/runtime compatibility', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-image2image-config', // 使用支持image2image的配置
        inputImage: {
          b64: 'test-base64-data',
          mimeType: 'image/webp'
        }
      }

      await expect(imageService.validateRequest(request)).resolves.not.toThrow()
    })

    test('should reject oversized base64 images', async () => {
      // 创建超过10MB的base64字符串
      const largeBase64 = 'A'.repeat(Math.ceil((10 * 1024 * 1024 + 1024) * 4 / 3))

      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-image2image-config', // 使用支持image2image的配置
        inputImage: {
          b64: largeBase64,
          mimeType: 'image/png'
        }
      }

      await expect(imageService.validateRequest(request)).rejects.toMatchObject({
        code: IMAGE_ERROR_CODES.INPUT_IMAGE_TOO_LARGE,
        params: { maxSizeMB: 10 }
      })
    })

    test('should accept valid PNG input image', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-image2image-config', // 使用支持image2image的配置
        inputImage: {
          b64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          mimeType: 'image/png'
        }
      }

      await expect(imageService.validateRequest(request)).resolves.not.toThrow()
    })

    test('should accept valid JPEG input image', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-image2image-config', // 使用支持image2image的配置
        inputImage: {
          b64: '/9j/4AAQSkZJRgABAQEAAQABAAD//gA+Q1JFQVRFRC',
          mimeType: 'image/jpeg'
        }
      }

      await expect(imageService.validateRequest(request)).resolves.not.toThrow()
    })

      test('should validate model capabilities for image2image using config.model capabilities', async () => {
       // 添加一个不支持image2image的配置
       await mockModelManager.addConfig({
         id: 'text-only-config',
         name: 'Text Only Config',
         providerId: 'openai',
         modelId: 'dall-e-2', // dall-e-2 不支持 image2image
         enabled: true,
         connectionConfig: { apiKey: 'test' },
         paramOverrides: {},
         // 自包含字段
         provider: {
           id: 'openai',
           name: 'OpenAI',
           description: 'OpenAI provider',
           requiresApiKey: true,
           defaultBaseURL: 'https://api.openai.com/v1',
           supportsDynamicModels: false
         },
         model: {
           id: 'dall-e-2',
           name: 'DALL-E 2',
           description: 'OpenAI DALL-E 2 model (text-only)',
           providerId: 'openai',
           capabilities: {
             text2image: true,
             image2image: false,
             multiImage: false
           },
           parameterDefinitions: [],
           defaultParameterValues: {}
         }
       })

       const request: ImageRequest = {
         prompt: 'test prompt',
         configId: 'text-only-config',
         inputImage: {
           b64: 'test-base64',
           mimeType: 'image/png'
         }
       }

        // 即使静态列表缺失，也应使用 config.model.capabilities 做能力校验
        await expect(imageService.validateRequest(request)).rejects.toMatchObject({
          code: IMAGE_ERROR_CODES.MODEL_NOT_SUPPORT_IMAGE2IMAGE,
        })
      })

     test('should reject image2image input image url', async () => {
       const request: ImageRequest = {
         prompt: 'test prompt',
         configId: 'test-image2image-config',
         inputImage: {
           // @ts-expect-error url input is not supported
           url: 'https://example.com/image.png',
           b64: 'abc',
           mimeType: 'image/png'
         }
       }

       await expect(imageService.validateRequest(request)).rejects.toMatchObject({
         code: IMAGE_ERROR_CODES.INPUT_IMAGE_URL_NOT_SUPPORTED
       })
     })

     test('should reject image2image missing b64', async () => {
       const request: ImageRequest = {
         prompt: 'test prompt',
         configId: 'test-image2image-config',
         // @ts-expect-error b64 is required for inputImage
         inputImage: { mimeType: 'image/png' }
       }

       await expect(imageService.validateRequest(request)).rejects.toMatchObject({
         code: IMAGE_ERROR_CODES.INPUT_IMAGE_B64_REQUIRED
       })
     })

     test('should reject text2image when inputImage is provided', async () => {
       const request = {
         prompt: 'test prompt',
         configId: 'test-openai-config',
         inputImage: { b64: 'abc', mimeType: 'image/png' }
       } as unknown as Text2ImageRequest

       await expect(imageService.validateText2ImageRequest(request)).rejects.toMatchObject({
         code: IMAGE_ERROR_CODES.TEXT2IMAGE_INPUT_IMAGE_NOT_ALLOWED
       })
     })

     test('should provide clear error when using image2image-only model without input image', async () => {
       // dashscope 的 qwen-image-edit 是 image2image-only
       await mockModelManager.addConfig({
         id: 'dashscope-edit-config',
         name: 'DashScope Edit Config',
         providerId: 'dashscope',
         modelId: dashscopeEditModelId,
         enabled: true,
         connectionConfig: { apiKey: 'test' },
         paramOverrides: {},
         provider: {
           id: 'dashscope',
           name: 'DashScope',
           description: 'DashScope provider',
           requiresApiKey: true,
           defaultBaseURL: 'https://dashscope.aliyuncs.com',
           supportsDynamicModels: false
         },
         model: dashscopeEditModel
       })

       const request: ImageRequest = {
         prompt: 'edit this image',
         configId: 'dashscope-edit-config'
         // inputImage intentionally omitted
       }

       const { inputImage: _inputImage, ...text2image } = request
       await expect(imageService.validateText2ImageRequest(text2image)).rejects.toMatchObject({
         code: IMAGE_ERROR_CODES.MODEL_ONLY_SUPPORTS_IMAGE2IMAGE_NEED_INPUT,
         params: { modelName: dashscopeEditModelName }
       })
     })

     test('should validate multi-image requests when the model supports multiple input images', async () => {
       const request: MultiImageRequest = {
         prompt: 'merge these references into one scene',
         configId: 'test-multiimage-config',
         inputImages: [
           { b64: 'AAAA', mimeType: 'image/png' },
           { b64: 'BBBB', mimeType: 'image/jpeg' }
         ]
       }

       await expect(imageService.validateMultiImageRequest(request)).resolves.not.toThrow()
     })

     test('should not reject multi-image requests only because local capabilities say multiImage is unsupported', async () => {
       await mockModelManager.updateConfig('test-multiimage-config', {
         model: {
           ...(await mockModelManager.getConfig('test-multiimage-config'))!.model,
           capabilities: {
             text2image: true,
             image2image: true,
             multiImage: false,
           },
         },
       })

       const request: MultiImageRequest = {
         prompt: 'merge these references into one scene',
         configId: 'test-multiimage-config',
         inputImages: [
           { b64: 'AAAA', mimeType: 'image/png' },
           { b64: 'BBBB', mimeType: 'image/jpeg' }
         ]
       }

       await expect(imageService.validateMultiImageRequest(request)).resolves.not.toThrow()
     })

     test('should reject multi-image requests with fewer than two images', async () => {
       const request: MultiImageRequest = {
         prompt: 'merge these references into one scene',
         configId: 'test-multiimage-config',
         inputImages: [
           { b64: 'AAAA', mimeType: 'image/png' }
         ]
       }

     await expect(imageService.validateMultiImageRequest(request)).rejects.toMatchObject({
        code: IMAGE_ERROR_CODES.MULTI_IMAGE_AT_LEAST_TWO_REQUIRED
      })
     })

     test('should treat single inputImages entry as image2image in compatibility validation', async () => {
       const request: ImageRequest = {
         prompt: 'edit this image',
         configId: 'test-openai-config',
         inputImages: [
           { b64: 'AAAA', mimeType: 'image/png' }
         ]
       }

       await expect(imageService.validateRequest(request)).rejects.toMatchObject({
         code: IMAGE_ERROR_CODES.MODEL_NOT_SUPPORT_IMAGE2IMAGE
       })
     })
  })

  describe('Image Generation', () => {
    test('should generate image successfully', async () => {
      const request: ImageRequest = {
        prompt: 'A beautiful landscape',
        configId: 'test-openai-config'
      }

      // Mock 适配器的 generate 方法
      const mockResult: ImageResult = {
        images: [
          {
            url: 'https://example.com/generated-image.png',
            b64: undefined
          }
        ],
        metadata: {
          providerId: 'openai',
          modelId: 'dall-e-3',
          configId: 'test-openai-config'
        }
      }

      // 由于我们使用的是真实的适配器，我们需要mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              b64_json: 'aGVsbG8=',
              revised_prompt: 'A beautiful landscape with mountains'
            }
          ],
          created: Date.now()
        })
      })

      const result = await imageService.generate(request)

      expect(result).toBeDefined()
      expect(result.images).toHaveLength(1)
      expect(result.images[0].b64).toBeDefined()
      expect(result.images[0].url?.startsWith('data:image/png;base64,')).toBe(true)
      expect(result.metadata?.configId).toBe('test-openai-config')
      expect(result.metadata?.providerId).toBe('openai')
      expect(result.metadata?.modelId).toBe('dall-e-3')
    })

    test('should handle generation failure gracefully', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-openai-config'
      }

      // Mock fetch failure
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({
          error: {
            message: 'Invalid request'
          }
        })
      })

      await expect(imageService.generate(request)).rejects.toMatchObject({
        code: IMAGE_ERROR_CODES.GENERATION_FAILED,
        params: { details: expect.stringContaining('Invalid request') }
      })
    })

    test('should add metadata to result if missing', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-openai-config'
      }

      // Mock 适配器返回没有元数据的结果
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              b64_json: 'aGVsbG8='
            }
          ]
        })
      })

      const result = await imageService.generate(request)

      expect(result.metadata).toBeDefined()
      expect(result.metadata?.configId).toBe('test-openai-config')
      expect(result.metadata?.providerId).toBe('openai')
      expect(result.metadata?.modelId).toBe('dall-e-3')
    })

    test('should generate with ordered multi-image input', async () => {
      const registry = {
        getAdapter: vi.fn().mockReturnValue({
          generate: vi.fn().mockResolvedValue({
            images: [{ b64: 'aGVsbG8=', mimeType: 'image/png', url: 'data:image/png;base64,aGVsbG8=' }],
          }),
        }),
        getStaticModels: vi.fn().mockReturnValue([
          {
            id: 'gemini-2.5-flash-image-preview',
            name: 'Gemini 2.5 Flash Image Preview',
            providerId: 'gemini',
            capabilities: { text2image: true, image2image: true, multiImage: true },
            parameterDefinitions: [],
            defaultParameterValues: {},
          },
        ]),
        getDynamicModels: vi.fn(),
        getModels: vi.fn(),
        getAllProviders: vi.fn(),
        getAllStaticModels: vi.fn(),
        supportsDynamicModels: vi.fn(),
        validateProviderModel: vi.fn(),
      } as unknown as IImageAdapterRegistry
      const multiImageService = new ImageService(mockModelManager, registry)

      const request: MultiImageGenerationRequest = {
        prompt: 'compose 图1 and 图2 into one cinematic frame',
        configId: 'test-multiimage-config',
        inputImages: [
          { b64: 'AAAA', mimeType: 'image/png' },
          { b64: 'BBBB', mimeType: 'image/png' }
        ]
      }

      const result = await multiImageService.generateMultiImage(request)

      expect(result.images).toHaveLength(1)
      expect(result.metadata?.configId).toBe('test-multiimage-config')
      expect(result.metadata?.modelId).toBe('gemini-2.5-flash-image-preview')
      expect(registry.getAdapter).toHaveBeenCalledWith('gemini')
    })

    test('should still call the adapter for multi-image generation when local capability metadata is stale', async () => {
      await mockModelManager.updateConfig('test-multiimage-config', {
        model: {
          ...(await mockModelManager.getConfig('test-multiimage-config'))!.model,
          capabilities: {
            text2image: true,
            image2image: true,
            multiImage: false,
          },
        },
      })

      const adapterGenerate = vi.fn().mockResolvedValue({
        images: [{ b64: 'aGVsbG8=', mimeType: 'image/png', url: 'data:image/png;base64,aGVsbG8=' }],
      })

      const registry = {
        getAdapter: vi.fn().mockReturnValue({
          generate: adapterGenerate,
        }),
        getStaticModels: vi.fn().mockReturnValue([
          {
            id: 'gemini-2.5-flash-image-preview',
            name: 'Gemini 2.5 Flash Image Preview',
            providerId: 'gemini',
            capabilities: { text2image: true, image2image: true, multiImage: false },
            parameterDefinitions: [],
            defaultParameterValues: {},
          },
        ]),
        getDynamicModels: vi.fn(),
        getModels: vi.fn(),
        getAllProviders: vi.fn(),
        getAllStaticModels: vi.fn(),
        supportsDynamicModels: vi.fn(),
        validateProviderModel: vi.fn(),
      } as unknown as IImageAdapterRegistry
      const multiImageService = new ImageService(mockModelManager, registry)

      const request: MultiImageGenerationRequest = {
        prompt: 'compose 图1 and 图2 into one cinematic frame',
        configId: 'test-multiimage-config',
        inputImages: [
          { b64: 'AAAA', mimeType: 'image/png' },
          { b64: 'BBBB', mimeType: 'image/png' }
        ]
      }

      await expect(multiImageService.generateMultiImage(request)).resolves.toMatchObject({
        metadata: {
          configId: 'test-multiimage-config',
        },
      })
      expect(adapterGenerate).toHaveBeenCalledTimes(1)
    })

    test('should convert non-standard image2image input before calling the adapter', async () => {
      const adapterGenerate = vi.fn().mockResolvedValue({
        images: [{ b64: 'aGVsbG8=', mimeType: 'image/png' }],
      })
      const registry = {
        getAdapter: vi.fn().mockReturnValue({ generate: adapterGenerate }),
        getStaticModels: vi.fn().mockReturnValue([]),
        getDynamicModels: vi.fn(),
        getModels: vi.fn(),
        getAllProviders: vi.fn(),
        getAllStaticModels: vi.fn(),
        supportsDynamicModels: vi.fn(),
        validateProviderModel: vi.fn(),
      } as unknown as IImageAdapterRegistry
      const imageInputConverter = vi.fn().mockResolvedValue({
        b64: 'PNG_BASE64',
        mimeType: 'image/png',
      })
      const compatibleImageService = new ImageService(mockModelManager, registry, { imageInputConverter })
      const request = {
        prompt: 'edit this image',
        configId: 'test-image2image-config',
        inputImage: { b64: 'WEBP_BASE64', mimeType: 'image/webp' },
      }

      await compatibleImageService.generateImage2Image(request)

      expect(imageInputConverter).toHaveBeenCalledWith({ b64: 'WEBP_BASE64', mimeType: 'image/webp' })
      expect(adapterGenerate).toHaveBeenCalledTimes(1)
      expect(adapterGenerate.mock.calls[0][0].inputImage).toEqual({
        b64: 'PNG_BASE64',
        mimeType: 'image/png',
      })
      expect(request.inputImage).toEqual({ b64: 'WEBP_BASE64', mimeType: 'image/webp' })
    })

    test('should canonicalize image/jpg input as image/jpeg without conversion', async () => {
      const adapterGenerate = vi.fn().mockResolvedValue({
        images: [{ b64: 'aGVsbG8=', mimeType: 'image/png' }],
      })
      const registry = {
        getAdapter: vi.fn().mockReturnValue({ generate: adapterGenerate }),
        getStaticModels: vi.fn().mockReturnValue([]),
        getDynamicModels: vi.fn(),
        getModels: vi.fn(),
        getAllProviders: vi.fn(),
        getAllStaticModels: vi.fn(),
        supportsDynamicModels: vi.fn(),
        validateProviderModel: vi.fn(),
      } as unknown as IImageAdapterRegistry
      const imageInputConverter = vi.fn()
      const compatibleImageService = new ImageService(mockModelManager, registry, { imageInputConverter })

      await compatibleImageService.generateImage2Image({
        prompt: 'edit this image',
        configId: 'test-image2image-config',
        inputImage: { b64: 'JPEG_BASE64', mimeType: 'image/jpg' },
      })

      expect(imageInputConverter).not.toHaveBeenCalled()
      expect(adapterGenerate.mock.calls[0][0].inputImage).toEqual({
        b64: 'JPEG_BASE64',
        mimeType: 'image/jpeg',
      })
    })

    test('should keep original image2image input when conversion fails', async () => {
      const adapterGenerate = vi.fn().mockResolvedValue({
        images: [{ b64: 'aGVsbG8=', mimeType: 'image/png' }],
      })
      const registry = {
        getAdapter: vi.fn().mockReturnValue({ generate: adapterGenerate }),
        getStaticModels: vi.fn().mockReturnValue([]),
        getDynamicModels: vi.fn(),
        getModels: vi.fn(),
        getAllProviders: vi.fn(),
        getAllStaticModels: vi.fn(),
        supportsDynamicModels: vi.fn(),
        validateProviderModel: vi.fn(),
      } as unknown as IImageAdapterRegistry
      const imageInputConverter = vi.fn().mockRejectedValue(new Error('decode failed'))
      const compatibleImageService = new ImageService(mockModelManager, registry, { imageInputConverter })

      await compatibleImageService.generateImage2Image({
        prompt: 'edit this image',
        configId: 'test-image2image-config',
        inputImage: { b64: 'WEBP_BASE64', mimeType: 'image/webp' },
      })

      expect(adapterGenerate.mock.calls[0][0].inputImage).toEqual({
        b64: 'WEBP_BASE64',
        mimeType: 'image/webp',
      })
    })

    test('should normalize multi-image inputs independently', async () => {
      const adapterGenerate = vi.fn().mockResolvedValue({
        images: [{ b64: 'aGVsbG8=', mimeType: 'image/png' }],
      })
      const registry = {
        getAdapter: vi.fn().mockReturnValue({ generate: adapterGenerate }),
        getStaticModels: vi.fn().mockReturnValue([]),
        getDynamicModels: vi.fn(),
        getModels: vi.fn(),
        getAllProviders: vi.fn(),
        getAllStaticModels: vi.fn(),
        supportsDynamicModels: vi.fn(),
        validateProviderModel: vi.fn(),
      } as unknown as IImageAdapterRegistry
      const imageInputConverter = vi.fn(async (input) => {
        if (input.b64 === 'FAIL_WEBP') {
          throw new Error('decode failed')
        }
        return { b64: `${input.b64}_PNG`, mimeType: 'image/png' }
      })
      const compatibleImageService = new ImageService(mockModelManager, registry, { imageInputConverter })

      await compatibleImageService.generateMultiImage({
        prompt: 'compose references',
        configId: 'test-multiimage-config',
        inputImages: [
          { b64: 'OK_WEBP', mimeType: 'image/webp' },
          { b64: 'KEEP_PNG', mimeType: 'image/png' },
          { b64: 'FAIL_WEBP', mimeType: 'image/webp' },
        ],
      })

      expect(imageInputConverter).toHaveBeenCalledTimes(2)
      expect(adapterGenerate.mock.calls[0][0].inputImages).toEqual([
        { b64: 'OK_WEBP_PNG', mimeType: 'image/png' },
        { b64: 'KEEP_PNG', mimeType: 'image/png' },
        { b64: 'FAIL_WEBP', mimeType: 'image/webp' },
      ])
    })
  })

  describe('Error Handling', () => {
    test('should wrap adapter errors with image error code', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-openai-config'
      }

       // Mock 网络错误
       global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

       await expect(imageService.generate(request)).rejects.toMatchObject({
         code: IMAGE_ERROR_CODES.GENERATION_FAILED,
         params: { details: expect.stringContaining('Network error') }
       })
     })

    test('should handle non-Error objects gracefully', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-openai-config'
      }

      // Mock 抛出非Error对象
      global.fetch = vi.fn().mockRejectedValue('String error')

      await expect(imageService.generate(request)).rejects.toMatchObject({
        code: IMAGE_ERROR_CODES.GENERATION_FAILED,
        params: { details: expect.stringContaining('String error') }
      })
    })
  })

  describe('Edge Cases', () => {
    test('should handle missing config during generation', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-openai-config'
      }

      // 在验证后删除配置
      const originalValidate = imageService.validateRequest
      imageService.validateRequest = vi.fn().mockResolvedValue(undefined)

      // Mock getConfig 返回 null
      mockModelManager.getConfig = vi.fn().mockResolvedValue(null)

      await expect(imageService.generate(request)).rejects.toMatchObject({
        code: IMAGE_ERROR_CODES.CONFIG_NOT_FOUND,
        params: { configId: 'test-openai-config' }
      })
    })

    test('should handle count default value', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-openai-config'
        // count 未定义，应该默认为1
      }

      await expect(imageService.validateRequest(request)).resolves.not.toThrow()
    })

    test('should handle mimeType case insensitivity', async () => {
      const request: ImageRequest = {
        prompt: 'test prompt',
        configId: 'test-image2image-config', // 使用支持image2image的配置
        inputImage: {
          b64: 'test-base64',
          mimeType: 'IMAGE/PNG' // 大写
        }
      }

      await expect(imageService.validateRequest(request)).resolves.not.toThrow()
    })

    test('should handle base64 padding correctly', async () => {
      const requests = [
        {
          prompt: 'test',
          configId: 'test-image2image-config', // 使用支持image2image的配置
          inputImage: { b64: 'AAAA', mimeType: 'image/png' } // 无填充
        },
        {
          prompt: 'test',
          configId: 'test-image2image-config', // 使用支持image2image的配置
          inputImage: { b64: 'AAA=', mimeType: 'image/png' } // 1个填充
        },
        {
          prompt: 'test',
          configId: 'test-image2image-config', // 使用支持image2image的配置
          inputImage: { b64: 'AA==', mimeType: 'image/png' } // 2个填充
        }
      ]

      for (const request of requests) {
        await expect(imageService.validateRequest(request)).resolves.not.toThrow()
      }
    })
  })
})
