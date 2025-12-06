import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImageService } from '../../src/services/image/service'
import { createImageModelManager } from '../../src/services/image-model/manager'
import { MemoryStorageProvider } from '../../src/services/storage/memoryStorageProvider'
import type {
  IImageAdapterRegistry,
  IImageProviderAdapter,
  ImageProvider,
  ImageModel,
  ImageModelConfig,
  ImageRequest,
  ImageResult
} from '../../src/services/image/types'
import { RequestConfigError } from '../../src/services/llm/errors'

// Build a shared stub registry + adapter for end-to-end acceptance without hitting network
const stubProvider: ImageProvider = {
  id: 'test',
  name: 'Test Provider',
  description: 'Stub provider for acceptance tests',
  requiresApiKey: false,
  defaultBaseURL: 'https://example.invalid',
  supportsDynamicModels: false
}

const stubModel: ImageModel = {
  id: 'test-model',
  name: 'Test Model',
  description: 'Stub model for acceptance tests',
  providerId: 'test',
  capabilities: { text2image: true, image2image: false },
  parameterDefinitions: [],
  defaultParameterValues: { outputMimeType: 'image/png' }
}

const fakeAdapter: IImageProviderAdapter = {
  getProvider: () => stubProvider,
  getModels: () => [stubModel],
  async getModelsAsync() { return [stubModel] },
  async validateConnection() { return true },
  async generate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    return {
      images: [{ b64: 'ZHVtbXk=', mimeType: 'image/png' }],
      metadata: {
        providerId: config.providerId,
        modelId: config.modelId,
        configId: config.id,
        finishReason: 'done'
      }
    }
  }
}

const stubRegistry: IImageAdapterRegistry = {
  getAdapter(providerId: string) {
    if (providerId.toLowerCase() !== 'test') throw new Error(`未知提供商: ${providerId}`)
    return fakeAdapter
  },
  getAllProviders() { return [stubProvider] },
  getStaticModels(providerId: string) {
    if (providerId.toLowerCase() !== 'test') return []
    return [stubModel]
  },
  async getDynamicModels(providerId: string) { return this.getStaticModels(providerId) },
  async getModels(providerId: string) { return this.getStaticModels(providerId) },
  getAllStaticModels() { return [{ provider: stubProvider, model: stubModel }] },
  supportsDynamicModels() { return false },
  async validateProviderConnection() { return true },
  validateProviderModel(providerId: string, modelId: string) {
    return providerId.toLowerCase() === 'test' && modelId === 'test-model'
  }
}

// Mock defaults.ts 以避免在模块加载时执行 getDefaultImageModels()
vi.mock('../../src/services/image-model/defaults', () => {
  return {
    getDefaultImageModels: () => ({}),
    defaultImageModels: {}
  }
})

// Mock the registry factory used by ImageService so it uses our stub registry
// 注意：vi.mock 会被提升到文件顶部，所以需要在 mock 内部定义所有依赖
vi.mock('../../src/services/image/adapters/registry', () => {
  // 在 mock 内部定义 stub 数据
  const mockStubProvider = {
    id: 'test',
    name: 'Test Provider',
    description: 'Stub provider for acceptance tests',
    requiresApiKey: false,
    defaultBaseURL: 'https://example.invalid',
    supportsDynamicModels: false
  }

  const mockStubModel = {
    id: 'test-model',
    name: 'Test Model',
    description: 'Stub model for acceptance tests',
    providerId: 'test',
    capabilities: { text2image: true, image2image: false },
    parameterDefinitions: [],
    defaultParameterValues: { outputMimeType: 'image/png' }
  }

  const mockFakeAdapter = {
    getProvider: () => mockStubProvider,
    getModels: () => [mockStubModel],
    async getModelsAsync() { return [mockStubModel] },
    async validateConnection() { return true },
    async generate(request: any, config: any) {
      return {
        images: [{ b64: 'ZHVtbXk=', mimeType: 'image/png' }],
        metadata: {
          providerId: config.providerId,
          modelId: config.modelId,
          configId: config.id,
          finishReason: 'done'
        }
      }
    },
    buildDefaultModel(modelId: string) {
      return { ...mockStubModel, id: modelId, name: modelId }
    }
  }

  const mockStubRegistry = {
    getAdapter(providerId: string) {
      if (providerId.toLowerCase() !== 'test') throw new Error(`未知提供商: ${providerId}`)
      return mockFakeAdapter
    },
    getAllProviders() { return [mockStubProvider] },
    getStaticModels(providerId: string) {
      if (providerId.toLowerCase() !== 'test') return []
      return [mockStubModel]
    },
    async getDynamicModels(providerId: string) { return this.getStaticModels(providerId) },
    async getModels(providerId: string) { return this.getStaticModels(providerId) },
    getAllStaticModels() { return [{ provider: mockStubProvider, model: mockStubModel }] },
    supportsDynamicModels() { return false },
    async validateProviderConnection() { return true },
    validateProviderModel(providerId: string, modelId: string) {
      return providerId.toLowerCase() === 'test' && modelId === 'test-model'
    }
  }

  // 创建一个构造函数形式的 mock 类
  const MockImageAdapterRegistry = function() {
    return mockStubRegistry
  }

  return {
    createImageAdapterRegistry: () => mockStubRegistry,
    ImageAdapterRegistry: MockImageAdapterRegistry
  }
})

describe('Acceptance - Image Service E2E', () => {
  let storage: MemoryStorageProvider

  beforeEach(() => {
    storage = new MemoryStorageProvider()
  })

  it('generates images end-to-end with metadata and count', async () => {
    const imageModelManager = createImageModelManager(storage, stubRegistry)
    const imageService = new ImageService(imageModelManager)

    const config: ImageModelConfig = {
      id: 'cfg-test-1',
      name: 'Acceptance Test Config',
      providerId: 'test',
      modelId: 'test-model',
      enabled: true,
      connectionConfig: {},
      paramOverrides: { outputMimeType: 'image/png' },
      // 自包含字段
      provider: stubProvider,
      model: stubModel
    }
    await imageModelManager.addConfig(config)

    const request: ImageRequest = {
      prompt: 'A scenic mountain with lake',
      configId: 'cfg-test-1',
      count: 1
    }

    const result = await imageService.generate(request)
    expect(result.images.length).toBe(1)
    expect(result.images[0].b64).toBeTypeOf('string')
    expect(result.metadata?.providerId).toBe('test')
    expect(result.metadata?.modelId).toBe('test-model')
    expect(result.metadata?.configId).toBe('cfg-test-1')
  })

  it('lists available models from enabled configs', async () => {
    const imageModelManager = createImageModelManager(storage, stubRegistry)
    const imageService = new ImageService(imageModelManager)

    const cfg: ImageModelConfig = {
      id: 'cfg-test-2',
      name: 'Available Test',
      providerId: 'test',
      modelId: 'test-model',
      enabled: true,
      connectionConfig: {},
      paramOverrides: {},
      // 自包含字段
      provider: stubProvider,
      model: stubModel
    }
    await imageModelManager.addConfig(cfg)

    const available = await imageModelManager.getEnabledConfigs()
    expect(Array.isArray(available)).toBe(true)
    expect(available.length).toBe(1)
    expect(available[0].id).toBe('cfg-test-2')
    expect(available[0].provider?.name).toBe('Test Provider')
    expect(available[0].model?.name).toBe('Test Model')
    expect(available[0].model?.capabilities.text2image).toBe(true)
  })

  it('rejects image2image when model capability is false', async () => {
    const imageModelManager = createImageModelManager(storage, stubRegistry)
    const imageService = new ImageService(imageModelManager)

    const cfg: ImageModelConfig = {
      id: 'cfg-test-3',
      name: 'i2i Disabled',
      providerId: 'test',
      modelId: 'test-model',
      enabled: true,
      connectionConfig: {},
      paramOverrides: {},
      // 自包含字段
      provider: stubProvider,
      model: stubModel
    }
    await imageModelManager.addConfig(cfg)

    const request: ImageRequest = {
      prompt: 'Transform this image',
      configId: 'cfg-test-3',
      inputImage: { b64: 'ZHVtbXk=', mimeType: 'image/png' }
    }

    await expect(imageService.generate(request)).rejects.toBeInstanceOf(RequestConfigError)
  })
})
