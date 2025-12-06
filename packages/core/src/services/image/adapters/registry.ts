import {
  IImageAdapterRegistry,
  IImageProviderAdapter,
  ImageProvider,
  ImageModel
} from '../types'
import { GeminiImageAdapter } from './gemini'
import { SeedreamImageAdapter } from './seedream'
import { OpenAIImageAdapter } from './openai'
import { SiliconFlowImageAdapter } from './siliconflow'
import { OpenRouterImageAdapter } from './openrouter'
import { DashScopeImageAdapter } from './dashscope'

/**
 * 图像适配器注册表实现
 * 支持静态和动态模型获取的统一管理
 */
export class ImageAdapterRegistry implements IImageAdapterRegistry {
  private adapters: Map<string, IImageProviderAdapter> = new Map()
  private staticModelsCache: Map<string, ImageModel[]> = new Map()

  constructor() {
    this.initializeAdapters()
  }

  private initializeAdapters(): void {
    // 注册所有适配器
    const geminiAdapter = new GeminiImageAdapter()
    const seedreamAdapter = new SeedreamImageAdapter()
    const siliconflowAdapter = new SiliconFlowImageAdapter()
    const openaiAdapter = new OpenAIImageAdapter()
    const openrouterAdapter = new OpenRouterImageAdapter()
    const dashscopeAdapter = new DashScopeImageAdapter()

    this.adapters.set('gemini', geminiAdapter)
    this.adapters.set('seedream', seedreamAdapter)
    this.adapters.set('siliconflow', siliconflowAdapter)
    this.adapters.set('openai', openaiAdapter)
    this.adapters.set('openrouter', openrouterAdapter)
    this.adapters.set('dashscope', dashscopeAdapter)

    // 预加载静态模型缓存
    this.preloadStaticModels()
  }

  private preloadStaticModels(): void {
    this.adapters.forEach((adapter, providerId) => {
      if (adapter.getProvider().id === providerId) {
        this.staticModelsCache.set(providerId, adapter.getModels())
      }
    })
  }

  // 基础适配器管理
  getAdapter(providerId: string): IImageProviderAdapter {
    const adapter = this.adapters.get(providerId.toLowerCase())
    if (!adapter) {
      throw new Error(`未知图像提供商: ${providerId}`)
    }
    return adapter
  }

  // 元数据查询
  getAllProviders(): ImageProvider[] {
    const providers: ImageProvider[] = []
    const seenIds = new Set<string>()

    this.adapters.forEach((adapter) => {
      const provider = adapter.getProvider()
      if (!seenIds.has(provider.id)) {
        seenIds.add(provider.id)
        providers.push(provider)
      }
    })

    return providers
  }

  // 静态模型获取（即时可用）
  getStaticModels(providerId: string): ImageModel[] {
    const normalizedId = providerId.toLowerCase()

    // 尝试从缓存获取
    if (this.staticModelsCache.has(normalizedId)) {
      return this.staticModelsCache.get(normalizedId)!
    }

    // 如果缓存未命中，从适配器获取
    const adapter = this.getAdapter(normalizedId)
    const models = adapter.getModels()
    this.staticModelsCache.set(normalizedId, models)
    return models
  }

  // 动态模型获取（需要连接配置）
  async getDynamicModels(providerId: string, connectionConfig: Record<string, any>): Promise<ImageModel[]> {
    const adapter = this.getAdapter(providerId)
    const provider = adapter.getProvider()

    if (!provider.supportsDynamicModels) {
      throw new Error(`Provider ${provider.name} does not support dynamic model loading`)
    }

    try {
      return await adapter.getModelsAsync(connectionConfig)
    } catch (error) {
      console.warn(`Failed to load dynamic models for ${providerId}:`, error)
      throw error
    }
  }

  // 统一的模型获取接口（自动选择静态或动态）
  async getModels(providerId: string, connectionConfig?: Record<string, any>): Promise<ImageModel[]> {
    const adapter = this.getAdapter(providerId)
    const provider = adapter.getProvider()

    // 如果支持动态获取且提供了连接配置，尝试动态获取
    if (provider.supportsDynamicModels && connectionConfig) {
      try {
        const dynamicModels = await this.getDynamicModels(providerId, connectionConfig)

        // 合并静态和动态模型，动态模型优先
        const staticModels = this.getStaticModels(providerId)
        const dynamicIds = new Set(dynamicModels.map(m => m.id))
        const mergedModels = [
          ...dynamicModels,
          ...staticModels.filter(m => !dynamicIds.has(m.id))
        ]

        return mergedModels
      } catch (error) {
        console.warn(`Dynamic model loading failed for ${providerId}, falling back to static models:`, error)
        // 降级到静态模型
        return this.getStaticModels(providerId)
      }
    }

    // 返回静态模型
    return this.getStaticModels(providerId)
  }

  // 获取所有静态模型的组合视图
  getAllStaticModels(): Array<{ provider: ImageProvider; model: ImageModel }> {
    const result: Array<{ provider: ImageProvider; model: ImageModel }> = []

    for (const provider of this.getAllProviders()) {
      const models = this.getStaticModels(provider.id)
      for (const model of models) {
        result.push({ provider, model })
      }
    }

    return result
  }

  // 能力检查
  supportsDynamicModels(providerId: string): boolean {
    try {
      const adapter = this.getAdapter(providerId)
      return adapter.getProvider().supportsDynamicModels
    } catch {
      return false
    }
  }

  // 验证方法
  validateProviderModel(providerId: string, modelId: string): boolean {
    try {
      const models = this.getStaticModels(providerId)
      return models.some(model => model.id === modelId)
    } catch {
      return false
    }
  }

  // 辅助方法：清除缓存
  clearCache(): void {
    this.staticModelsCache.clear()
    this.preloadStaticModels()
  }

}

export const createImageAdapterRegistry = () => new ImageAdapterRegistry()

