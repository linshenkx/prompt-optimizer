import type {
  ITextAdapterRegistry,
  ITextProviderAdapter,
  TextProvider,
  TextModel,
  TextModelConfig
} from '../types'
import { OpenAIAdapter } from './openai-adapter'
import { AnthropicAdapter } from './anthropic-adapter'
import { GeminiAdapter } from './gemini-adapter'
import { DeepseekAdapter } from './deepseek-adapter'
import { SiliconflowAdapter } from './siliconflow-adapter'
import { ZhipuAdapter } from './zhipu-adapter'
import { DashScopeAdapter } from './dashscope-adapter'

/**
 * 文本模型适配器注册表实现
 * 支持静态和动态模型获取的统一管理
 *
 * 职责：
 * - 管理所有TextProviderAdapter实例
 * - 提供统一的Adapter查找接口
 * - 缓存静态模型列表以提升性能
 * - 支持动态模型获取（仅OpenAI）
 * - 提供fallback机制（动态获取失败时回退到静态）
 */
export class TextAdapterRegistry implements ITextAdapterRegistry {
  private adapters: Map<string, ITextProviderAdapter> = new Map()
  private staticModelsCache: Map<string, TextModel[]> = new Map()

  constructor() {
    this.initializeAdapters()
  }

  /**
   * 初始化并注册所有适配器
   */
  private initializeAdapters(): void {
    // 注册适配器
    const openaiAdapter = new OpenAIAdapter()
    const deepseekAdapter = new DeepseekAdapter()
    const siliconflowAdapter = new SiliconflowAdapter()
    const zhipuAdapter = new ZhipuAdapter()
    const anthropicAdapter = new AnthropicAdapter()
    const geminiAdapter = new GeminiAdapter()
    const dashscopeAdapter = new DashScopeAdapter()

    this.adapters.set('openai', openaiAdapter)
    this.adapters.set('deepseek', deepseekAdapter)
    this.adapters.set('siliconflow', siliconflowAdapter)
    this.adapters.set('zhipu', zhipuAdapter)
    this.adapters.set('anthropic', anthropicAdapter)
    this.adapters.set('gemini', geminiAdapter)
    this.adapters.set('dashscope', dashscopeAdapter)

    // 预加载静态模型缓存
    this.preloadStaticModels()
  }

  /**
   * 预加载所有Provider的静态模型到缓存
   */
  private preloadStaticModels(): void {
    this.adapters.forEach((adapter, providerId) => {
      if (adapter.getProvider().id === providerId) {
        this.staticModelsCache.set(providerId, adapter.getModels())
      }
    })
  }

  // ===== 基础适配器管理 =====

  /**
   * 通过providerId获取适配器实例
   * @param providerId Provider ID（自动转换为小写）
   * @returns 适配器实例
   * @throws {Error} 当providerId不存在时
   */
  public getAdapter(providerId: string): ITextProviderAdapter {
    const adapter = this.adapters.get(providerId.toLowerCase())
    if (!adapter) {
      throw new Error(`未知文本模型提供商: ${providerId}`)
    }
    return adapter
  }

  // ===== 元数据查询 =====

  /**
   * 获取所有已注册的Provider元数据
   * @returns Provider元数据数组
   */
  public getAllProviders(): TextProvider[] {
    const providers: TextProvider[] = []
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

  // ===== 静态模型获取（即时可用） =====

  /**
   * 获取静态模型列表（带缓存）
   * @param providerId Provider ID
   * @returns 静态模型数组
   */
  public getStaticModels(providerId: string): TextModel[] {
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

  // ===== 动态模型获取（需要连接配置） =====

  /**
   * 动态获取模型列表（仅OpenAI支持）
   * @param providerId Provider ID
   * @param config 模型配置（包含连接信息）
   * @returns 动态获取的模型数组
   * @throws {Error} 当Provider不支持动态获取时
   */
  public async getDynamicModels(
    providerId: string,
    config: TextModelConfig
  ): Promise<TextModel[]> {
    const adapter = this.getAdapter(providerId)
    const provider = adapter.getProvider()

    if (!provider.supportsDynamicModels) {
      throw new Error(`Provider ${provider.name} 不支持动态模型获取`)
    }

    try {
      // 调用Adapter的getModelsAsync方法
      if (!adapter.getModelsAsync) {
        throw new Error(`Adapter ${provider.name} 未实现 getModelsAsync 方法`)
      }

      return await adapter.getModelsAsync(config)
    } catch (error) {
      console.warn(`动态获取模型失败 (${providerId}):`, error)
      throw error
    }
  }

  // ===== 统一的模型获取接口（自动选择静态或动态） =====

  /**
   * 统一的模型获取接口
   * 优先动态获取，失败则fallback到静态模型
   *
   * @param providerId Provider ID
   * @param config 模型配置（可选，提供时尝试动态获取）
   * @returns 模型数组
   */
  public async getModels(
    providerId: string,
    config?: TextModelConfig
  ): Promise<TextModel[]> {
    const adapter = this.getAdapter(providerId)
    const provider = adapter.getProvider()

    // 如果支持动态获取且提供了连接配置，尝试动态获取
    if (provider.supportsDynamicModels && config) {
      try {
        const dynamicModels = await this.getDynamicModels(providerId, config)

        // 合并静态和动态模型，动态模型优先
        const staticModels = this.getStaticModels(providerId)
        const dynamicIds = new Set(dynamicModels.map((m) => m.id))
        const mergedModels = [
          ...dynamicModels,
          ...staticModels.filter((m) => !dynamicIds.has(m.id))
        ]

        return mergedModels
      } catch (error) {
        console.warn(
          `动态模型加载失败 (${providerId})，回退到静态模型:`,
          error
        )
        // 降级到静态模型
        return this.getStaticModels(providerId)
      }
    }

    // 返回静态模型
    return this.getStaticModels(providerId)
  }

  /**
   * 获取所有静态模型的组合视图
   * @returns Provider-Model对数组
   */
  public getAllStaticModels(): Array<{ provider: TextProvider; model: TextModel }> {
    const result: Array<{ provider: TextProvider; model: TextModel }> = []

    for (const provider of this.getAllProviders()) {
      const models = this.getStaticModels(provider.id)
      for (const model of models) {
        result.push({ provider, model })
      }
    }

    return result
  }

  // ===== 能力检查 =====

  /**
   * 检查Provider是否支持动态模型获取
   * @param providerId Provider ID
   * @returns 是否支持动态获取
   */
  public supportsDynamicModels(providerId: string): boolean {
    try {
      const adapter = this.getAdapter(providerId)
      return adapter.getProvider().supportsDynamicModels
    } catch {
      return false
    }
  }

  // ===== 验证方法 =====

  /**
   * 验证Provider和Model组合是否有效
   * @param providerId Provider ID
   * @param modelId Model ID
   * @returns 是否有效
   */
  public validateProviderModel(providerId: string, modelId: string): boolean {
    try {
      const models = this.getStaticModels(providerId)
      return models.some((model) => model.id === modelId)
    } catch {
      return false
    }
  }

  // ===== 辅助方法：清除缓存 =====

  /**
   * 清除静态模型缓存并重新加载
   */
  public clearCache(): void {
    this.staticModelsCache.clear()
    this.preloadStaticModels()
  }
}

/**
 * 工厂函数：创建TextAdapterRegistry实例
 */
export const createTextAdapterRegistry = () => new TextAdapterRegistry()
