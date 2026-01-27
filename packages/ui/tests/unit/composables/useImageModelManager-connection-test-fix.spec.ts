import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type {
  IImageAdapterRegistry,
  IImageModelManager,
  ImageProvider,
  ImageModel,
  ImageModelConfig,
  IImageProviderAdapter
} from '@prompt-optimizer/core'

// Mock the useImageModelManager composable logic
describe('Image Model Manager Connection Test Fix', () => {
  let mockRegistry: IImageAdapterRegistry
  let mockImageModelManager: IImageModelManager
  let mockAdapter: IImageProviderAdapter

  beforeEach(() => {
    // Mock adapter with buildDefaultModel capability
    mockAdapter = {
      getProvider: vi.fn(() => ({
        id: 'openrouter',
        name: 'OpenRouter',
        requiresApiKey: true,
        defaultBaseURL: 'https://openrouter.ai/api/v1',
        supportsDynamicModels: false
      } as ImageProvider)),

      getModels: vi.fn(() => [
        {
          id: 'google/gemini-2.5-flash-image',
          name: 'Gemini 2.5 Flash Image Preview',
          providerId: 'openrouter',
          capabilities: { text2image: true, image2image: true, multiImage: true },
          parameterDefinitions: [],
          defaultParameterValues: {}
        } as ImageModel
      ]),

      buildDefaultModel: vi.fn((modelId: string) => ({
        id: modelId,
        name: modelId,
        providerId: 'openrouter',
        capabilities: { text2image: true, image2image: true, multiImage: true },
        parameterDefinitions: [],
        defaultParameterValues: {}
      } as ImageModel)),

      getModelsAsync: vi.fn(),
      validateConnection: vi.fn(),
      generate: vi.fn()
    }

    // Mock registry
    mockRegistry = {
      getAdapter: vi.fn(() => mockAdapter),
      getAllProviders: vi.fn(),
      getStaticModels: vi.fn(() => [
        {
           id: 'google/gemini-2.5-flash-image',
          name: 'Gemini 2.5 Flash Image Preview',
          providerId: 'openrouter',
          capabilities: { text2image: true, image2image: true, multiImage: true },
          parameterDefinitions: [],
          defaultParameterValues: {}
        } as ImageModel
      ]),
      getDynamicModels: vi.fn(),
      getModels: vi.fn(),
      getAllStaticModels: vi.fn(),
      supportsDynamicModels: vi.fn(),
      validateProviderConnection: vi.fn(),
      validateProviderModel: vi.fn()
    }
  })

  it('should find model in static models list', () => {
    // 模拟静态模型列表
    const models = ref([
      {
           id: 'google/gemini-2.5-flash-image',
        name: 'Gemini 2.5 Flash Image Preview',
        providerId: 'openrouter',
        capabilities: { text2image: true, image2image: true, multiImage: true },
        parameterDefinitions: [],
        defaultParameterValues: {}
      } as ImageModel
    ])

    const configForm = ref({
       modelId: 'google/gemini-2.5-flash-image',
      providerId: 'openrouter'
    })

    // 测试在静态模型列表中查找
    let selectedModel = models.value.find(m => m.id === configForm.value.modelId)

    expect(selectedModel).toBeDefined()
     expect(selectedModel!.id).toBe('google/gemini-2.5-flash-image')
    expect(selectedModel!.name).toBe('Gemini 2.5 Flash Image Preview')
  })

  it('should use buildDefaultModel for custom model ID', () => {
    // 模拟静态模型列表（不包含自定义模型）
    const models = ref([
      {
         id: 'google/gemini-2.5-flash-image',
        name: 'Gemini 2.5 Flash Image Preview',
        providerId: 'openrouter',
        capabilities: { text2image: true, image2image: true, multiImage: true },
        parameterDefinitions: [],
        defaultParameterValues: {}
      } as ImageModel
    ])

    const configForm = ref({
      modelId: 'custom/my-random-model',  // 用户随意填写的模型ID
      providerId: 'openrouter'
    })

    // 测试连接测试逻辑
    let selectedModel = models.value.find(m => m.id === configForm.value.modelId)

    // 应该未在静态列表中找到
    expect(selectedModel).toBeUndefined()

    // 模拟buildDefaultModel调用
    if (!selectedModel) {
      const adapter = mockRegistry.getAdapter('openrouter')
      selectedModel = adapter.buildDefaultModel(configForm.value.modelId)
    }

    // 验证通过buildDefaultModel构建的模型
    expect(selectedModel).toBeDefined()
    expect(selectedModel!.id).toBe('custom/my-random-model')
    expect(selectedModel!.name).toBe('custom/my-random-model')
    expect(selectedModel!.providerId).toBe('openrouter')
    expect(selectedModel!.capabilities.text2image).toBe(true)

    // 验证buildDefaultModel被调用
    expect(mockAdapter.buildDefaultModel).toHaveBeenCalledWith('custom/my-random-model')
  })

  it('should handle buildDefaultModel errors gracefully', () => {
    const models = ref<ImageModel[]>([])
    const configForm = ref({
      modelId: 'invalid/model',
      providerId: 'openrouter'
    })

    // Mock buildDefaultModel to throw error
    mockAdapter.buildDefaultModel = vi.fn(() => {
      throw new Error('Invalid model ID format')
    })

    mockRegistry.getAdapter = vi.fn(() => mockAdapter)

    let selectedModel = models.value.find(m => m.id === configForm.value.modelId)

    expect(selectedModel).toBeUndefined()

    // 测试错误处理
    expect(() => {
      if (!selectedModel) {
        try {
          const adapter = mockRegistry.getAdapter('openrouter')
          selectedModel = adapter.buildDefaultModel(configForm.value.modelId)
        } catch (error) {
          throw new Error(`无法构建模型 ${configForm.value.modelId}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }).toThrow('无法构建模型 invalid/model: Invalid model ID format')
  })
})

// 集成测试：验证修复前后的行为差异
describe('Connection Test Behavior Comparison', () => {
  it('should demonstrate the difference between old and new logic', () => {
    const models = ref<ImageModel[]>([])
    const configForm = ref({
      modelId: 'user-custom-model-123',
      providerId: 'openrouter'
    })

    // 旧逻辑（修复前）：直接查找，找不到就报错
    const oldLogic = () => {
      const selectedModel = models.value.find(m => m.id === configForm.value.modelId)
      if (!selectedModel) {
        throw new Error('选中的模型未找到')  // 这里会报错
      }
      return selectedModel
    }

    // 新逻辑（修复后）：查找 + buildDefaultModel后备
    const newLogic = () => {
      let selectedModel = models.value.find(m => m.id === configForm.value.modelId)
      if (!selectedModel) {
        // 使用buildDefaultModel构建
        selectedModel = {
          id: configForm.value.modelId,
          name: configForm.value.modelId,
          providerId: configForm.value.providerId,
          capabilities: { text2image: true, image2image: true, multiImage: true },
          parameterDefinitions: [],
          defaultParameterValues: {}
        } as ImageModel
      }
      return selectedModel
    }

    // 验证旧逻辑失败
    expect(() => oldLogic()).toThrow('选中的模型未找到')

    // 验证新逻辑成功
    const result = newLogic()
    expect(result).toBeDefined()
    expect(result.id).toBe('user-custom-model-123')
    expect(result.providerId).toBe('openrouter')
  })
})
