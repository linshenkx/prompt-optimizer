import {
  IImageAdapterRegistry,
  IImageProviderAdapter,
  ImageProvider,
  ImageModel
} from '../types'
import { AbstractAdapterRegistry } from '../../adapters/abstract-registry'
import { ImageError } from '../errors'
import { IMAGE_ERROR_CODES } from '../../../constants/error-codes'
import { GeminiImageAdapter } from './gemini'
import { SeedreamImageAdapter } from './seedream'
import { OpenAIImageAdapter } from './openai'
import { SiliconFlowImageAdapter } from './siliconflow'
import { OpenRouterImageAdapter } from './openrouter'
import { DashScopeImageAdapter } from './dashscope'
import { ModelScopeImageAdapter } from './modelscope'

/**
 * 图像适配器注册表实现
 * 继承抽象基类，提供图像模型特定的实现
 */
export class ImageAdapterRegistry
  extends AbstractAdapterRegistry<
    IImageProviderAdapter,
    ImageProvider,
    ImageModel,
    Record<string, unknown>
  >
  implements IImageAdapterRegistry
{
  protected createUnknownProviderError(providerId: string): Error {
    return new ImageError(IMAGE_ERROR_CODES.PROVIDER_NOT_FOUND, undefined, { providerId })
  }

  protected createDynamicModelUnsupportedError(provider: ImageProvider): Error {
    return new ImageError(IMAGE_ERROR_CODES.DYNAMIC_MODELS_NOT_SUPPORTED, undefined, { providerName: provider.name })
  }

  /**
   * 初始化并注册所有适配器
   */
  protected initializeAdapters(): void {
    // 注册所有适配器
    const geminiAdapter = new GeminiImageAdapter()
    const seedreamAdapter = new SeedreamImageAdapter()
    const siliconflowAdapter = new SiliconFlowImageAdapter()
    const openaiAdapter = new OpenAIImageAdapter()
    const openrouterAdapter = new OpenRouterImageAdapter()
    const dashscopeAdapter = new DashScopeImageAdapter()
    const modelscopeAdapter = new ModelScopeImageAdapter()

    this.adapters.set('gemini', geminiAdapter)
    this.adapters.set('seedream', seedreamAdapter)
    this.adapters.set('siliconflow', siliconflowAdapter)
    this.adapters.set('openai', openaiAdapter)
    this.adapters.set('openrouter', openrouterAdapter)
    this.adapters.set('dashscope', dashscopeAdapter)
    this.adapters.set('modelscope', modelscopeAdapter)

    // 预加载静态模型缓存
    this.preloadStaticModels()
  }

  /**
   * 从适配器获取 Provider 元数据
   */
  protected getProviderFromAdapter(adapter: IImageProviderAdapter): ImageProvider {
    return adapter.getProvider()
  }

  /**
   * 从适配器获取静态模型列表
   */
  protected getModelsFromAdapter(adapter: IImageProviderAdapter): ImageModel[] {
    return adapter.getModels()
  }

  /**
   * 调用适配器的异步模型获取方法
   */
  protected async getModelsAsyncFromAdapter(
    adapter: IImageProviderAdapter,
    connectionConfig: Record<string, unknown>
  ): Promise<ImageModel[]> {
    return await adapter.getModelsAsync(connectionConfig)
  }

  /**
   * 获取错误消息的提供商类型描述
   */
  protected getProviderTypeDescription(): string {
    return '图像提供商'
  }
}

export const createImageAdapterRegistry = () => new ImageAdapterRegistry()
