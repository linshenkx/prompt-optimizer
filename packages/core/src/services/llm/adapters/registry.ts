import type {
  ITextAdapterRegistry,
  ITextProviderAdapter,
  TextProvider,
  TextModel,
  TextModelConfig
} from '../types';
import { AbstractAdapterRegistry } from '../../adapters/abstract-registry';
import { OpenAIAdapter } from './openai-adapter';
import { AnthropicAdapter } from './anthropic-adapter';
import { GeminiAdapter } from './gemini-adapter';
import { DeepseekAdapter } from './deepseek-adapter';
import { SiliconflowAdapter } from './siliconflow-adapter';
import { ZhipuAdapter } from './zhipu-adapter';
import { DashScopeAdapter } from './dashscope-adapter';
import { OpenRouterAdapter } from './openrouter-adapter';

/**
 * 文本模型适配器注册表实现
 * 继承抽象基类，提供文本模型特定的实现
 */
export class TextAdapterRegistry
  extends AbstractAdapterRegistry<
    ITextProviderAdapter,
    TextProvider,
    TextModel,
    TextModelConfig
  >
  implements ITextAdapterRegistry
{
  /**
   * 初始化并注册所有适配器
   */
  protected initializeAdapters(): void {
    // 注册适配器
    const openaiAdapter = new OpenAIAdapter();
    const deepseekAdapter = new DeepseekAdapter();
    const siliconflowAdapter = new SiliconflowAdapter();
    const zhipuAdapter = new ZhipuAdapter();
    const anthropicAdapter = new AnthropicAdapter();
    const geminiAdapter = new GeminiAdapter();
    const dashscopeAdapter = new DashScopeAdapter();
    const openrouterAdapter = new OpenRouterAdapter();

    this.adapters.set('openai', openaiAdapter);
    this.adapters.set('deepseek', deepseekAdapter);
    this.adapters.set('siliconflow', siliconflowAdapter);
    this.adapters.set('zhipu', zhipuAdapter);
    this.adapters.set('anthropic', anthropicAdapter);
    this.adapters.set('gemini', geminiAdapter);
    this.adapters.set('dashscope', dashscopeAdapter);
    this.adapters.set('openrouter', openrouterAdapter);

    // 预加载静态模型缓存
    this.preloadStaticModels();
  }

  /**
   * 从适配器获取 Provider 元数据
   */
  protected getProviderFromAdapter(adapter: ITextProviderAdapter): TextProvider {
    return adapter.getProvider();
  }

  /**
   * 从适配器获取静态模型列表
   */
  protected getModelsFromAdapter(adapter: ITextProviderAdapter): TextModel[] {
    return adapter.getModels();
  }

  /**
   * 调用适配器的异步模型获取方法
   */
  protected async getModelsAsyncFromAdapter(
    adapter: ITextProviderAdapter,
    config: TextModelConfig
  ): Promise<TextModel[]> {
    if (!adapter.getModelsAsync) {
      const provider = adapter.getProvider();
      throw new Error(`Adapter ${provider.name} 未实现 getModelsAsync 方法`);
    }
    return await adapter.getModelsAsync(config);
  }

  /**
   * 获取错误消息的提供商类型描述
   */
  protected getProviderTypeDescription(): string {
    return '文本模型提供商';
  }
}

/**
 * 工厂函数：创建 TextAdapterRegistry 实例
 */
export const createTextAdapterRegistry = () => new TextAdapterRegistry();
