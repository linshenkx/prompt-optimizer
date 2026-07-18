import type {
  ILLMService,
  Message,
  StreamHandlers,
  LLMResponse,
  ModelOption,
  ToolDefinition,
  TextModel,
  ITextAdapterRegistry,
  StreamRequestOptions
} from './types';
import type { TextModelConfig, ModelConfig } from '../model/types';
import { ModelManager } from '../model/manager';
import { resolveTextModelMetadata } from '../model/metadata-resolver';
import { APIError, RequestConfigError } from './errors';
import { isRunningInElectron } from '../../utils/environment';
import { ElectronLLMProxy } from './electron-proxy';
import { TextAdapterRegistry } from './adapters/registry';
import { mergeOverrides, splitOverridesBySchema } from '../model/parameter-utils';

/**
 * LLM服务实现 - 基于 Adapter 架构
 */
export class LLMService implements ILLMService {
  private registry: ITextAdapterRegistry;

  constructor(
    private modelManager: ModelManager,
    registry?: ITextAdapterRegistry
  ) {
    this.registry = registry ?? new TextAdapterRegistry();
  }

  /**
   * 验证消息格式
   */
  private validateMessages(messages: Message[]): void {
    if (!Array.isArray(messages)) {
      throw new RequestConfigError('Messages must be an array');
    }
    if (messages.length === 0) {
      throw new RequestConfigError('Messages array cannot be empty');
    }
    messages.forEach(msg => {
      if (!msg.role || !msg.content) {
        throw new RequestConfigError('Invalid message format: missing required fields');
      }
      if (!['system', 'user', 'assistant', 'tool'].includes(msg.role)) {
        throw new RequestConfigError(`Unsupported message role: ${msg.role}`);
      }
      if (typeof msg.content !== 'string') {
        throw new RequestConfigError('Message content must be a string');
      }
    });
  }

  /**
   * 验证模型配置
   */
  private validateModelConfig(
    modelConfig: TextModelConfig,
    options: { allowDisabled?: boolean } = {}
  ): void {
    if (!modelConfig) {
      throw new RequestConfigError('Model config cannot be empty');
    }
    if (!modelConfig.providerMeta || !modelConfig.providerMeta.id) {
      throw new RequestConfigError('Model provider metadata cannot be empty');
    }
    if (!modelConfig.modelMeta || !modelConfig.modelMeta.id) {
      throw new RequestConfigError('Model metadata cannot be empty');
    }
    // Default behavior: disabled models cannot be used for normal requests.
    // Connection testing is allowed to bypass this check (align with image model test behavior).
    if (!options.allowDisabled && !modelConfig.enabled) {
      throw new RequestConfigError('Model is not enabled');
    }
  }

  /**
   * 发送消息（结构化格式）
   */
  async sendMessageStructured(messages: Message[], provider: string): Promise<LLMResponse> {
    try {
      if (!provider) {
        throw new RequestConfigError('Model provider cannot be empty');
      }

      const modelConfig = await this.modelManager.getModel(provider);
      if (!modelConfig) {
        throw new RequestConfigError(`Model ${provider} not found`);
      }

      this.validateModelConfig(modelConfig);
      this.validateMessages(messages);

      // 通过 Registry 获取 Adapter
      const adapter = this.registry.getAdapter(modelConfig.providerMeta.id);

      const runtimeConfig = this.prepareRuntimeConfig(modelConfig);

      // 使用 Adapter 发送消息
      return await adapter.sendMessage(messages, runtimeConfig);

    } catch (error: any) {
      if (error instanceof RequestConfigError || error instanceof APIError) {
        throw error;
      }
      throw new APIError(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * 发送消息（传统格式，只返回主要内容）
   */
  async sendMessage(messages: Message[], provider: string): Promise<string> {
    const response = await this.sendMessageStructured(messages, provider);
    
    // 只返回主要内容，不包含推理内容
    // 如果需要推理内容，请使用 sendMessageStructured 方法
    return response.content;
  }

  /**
   * 发送消息（流式,支持结构化和传统格式）
   */
  async sendMessageStream(
    messages: Message[],
    provider: string,
    callbacks: StreamHandlers,
    options?: StreamRequestOptions
  ): Promise<void> {
    try {
      options?.signal?.throwIfAborted();
      this.validateMessages(messages);

      const modelConfig = await this.modelManager.getModel(provider);
      if (!modelConfig) {
        throw new RequestConfigError(`Model ${provider} not found`);
      }

      this.validateModelConfig(modelConfig);

      // 通过 Registry 获取 Adapter
      const adapter = this.registry.getAdapter(modelConfig.providerMeta.id);

      const runtimeConfig = this.prepareRuntimeConfig(modelConfig);

      // 使用 Adapter 发送流式消息
      await adapter.sendMessageStream(messages, runtimeConfig, callbacks, options);

    } catch (error) {
      console.error('Stream request failed:', error);
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 发送消息（流式,支持工具调用）
   * 🆕 支持工具调用的流式消息发送
   */
  async sendMessageStreamWithTools(
    messages: Message[],
    provider: string,
    tools: ToolDefinition[],
    callbacks: StreamHandlers,
    options?: StreamRequestOptions
  ): Promise<void> {
    try {
      options?.signal?.throwIfAborted();
      this.validateMessages(messages);

      const modelConfig = await this.modelManager.getModel(provider);
      if (!modelConfig) {
        throw new RequestConfigError(`Model ${provider} not found`);
      }

      this.validateModelConfig(modelConfig);

      // 通过 Registry 获取 Adapter
      const adapter = this.registry.getAdapter(modelConfig.providerMeta.id);

      const runtimeConfig = this.prepareRuntimeConfig(modelConfig);

      // 使用 Adapter 发送带工具的流式消息
      await adapter.sendMessageStreamWithTools(messages, runtimeConfig, tools, callbacks, options);

    } catch (error) {
      console.error('Stream request with tools failed:', error);
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }


  /**
   * 测试连接
   */
  async testConnection(provider: string): Promise<void> {
    try {
      if (!provider) {
        throw new RequestConfigError('Model provider cannot be empty');
      }

      const modelConfig = await this.modelManager.getModel(provider);
      if (!modelConfig) {
        throw new RequestConfigError(`Model ${provider} not found`);
      }

      // Align with image model connection testing: allow testing even if the model is disabled.
      this.validateModelConfig(modelConfig, { allowDisabled: true });

      // 发送一个简单的测试消息
      const testMessages: Message[] = [
        {
          role: 'user',
          content: 'Please reply ok'
        }
      ];

      this.validateMessages(testMessages);

      // Send directly through the adapter to avoid the normal "enabled" constraint.
      const adapter = this.registry.getAdapter(modelConfig.providerMeta.id);
      const runtimeConfig = this.prepareRuntimeConfig(modelConfig);
      await adapter.sendMessage(testMessages, runtimeConfig);

    } catch (error: any) {
      if (error instanceof RequestConfigError || error instanceof APIError) {
        throw error;
      }
      throw new APIError(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * 获取模型列表，以下拉选项格式返回
   * @param provider 提供商标识
   * @param customConfig 自定义配置（可选）
   */
  async fetchModelList(
    provider: string,
    customConfig?: Partial<TextModelConfig> | Partial<ModelConfig>
  ): Promise<ModelOption[]> {
    try {
      // 获取基础配置
      const baseConfig = await this.modelManager.getModel(provider);
      const modelConfig = await this.buildEffectiveModelConfig(provider, baseConfig, customConfig);

      // 使用 Registry 获取模型列表
      const providerId = modelConfig.providerMeta.id;
      let models: TextModel[] = [];

      // NOTE: Registry.getModels() will silently fall back to static models when dynamic fetch fails.
      // For explicit "fetch model list" actions, we want to surface the failure so UI can avoid
      // misleading "success" toasts and optionally fall back with a warning.
      if (this.registry.supportsDynamicModels(providerId)) {
        const dynamicModels = await this.registry.getDynamicModels(providerId, modelConfig);

        const staticModels = this.registry.getStaticModels(providerId);
        const dynamicIds = new Set(dynamicModels.map((m) => m.id));

        // Merge static + dynamic for completeness; dynamic wins.
        models = [
          ...dynamicModels,
          ...staticModels.filter((m) => !dynamicIds.has(m.id))
        ];
      } else {
        models = this.registry.getStaticModels(providerId);
      }

      // 转换为选项格式
      return models.map(model => ({
        value: model.id,
        label: model.name
      }));
    } catch (error: any) {
      console.error('Failed to fetch model list:', error);
      if (error instanceof RequestConfigError || error instanceof APIError) {
        throw error;
      }
      throw new APIError(`Failed to fetch model list: ${error.message}`);
    }
  }

  private prepareRuntimeConfig(modelConfig: TextModelConfig): TextModelConfig {
    const schema = modelConfig.modelMeta?.parameterDefinitions ?? [];

    // 合并参数：支持旧格式的 customParamOverrides（向后兼容）
    // 优先级：requestOverrides > customOverrides
    // requestOverrides 包含当前 paramOverrides（可能已合并或未合并）
    // customOverrides 确保旧数据的自定义参数不丢失
    const mergedOverrides = mergeOverrides({
      schema,
      includeDefaults: false,
      customOverrides: modelConfig.customParamOverrides,  // 🔧 兼容旧格式：自定义参数
      requestOverrides: modelConfig.paramOverrides        // 当前参数（包含内置 + 可能已合并的自定义）
    });

    return {
      ...modelConfig,
      paramOverrides: mergedOverrides
    };
  }

  /**
   * 构建用于获取模型列表的有效模型配置
   * 支持 TextModelConfig 与 传统 ModelConfig 两种输入结构
   */
  private async buildEffectiveModelConfig(
    provider: string,
    baseConfig?: TextModelConfig | null,
    customConfig?: Partial<TextModelConfig> | Partial<ModelConfig>
  ): Promise<TextModelConfig> {
    const customTextConfig = isTextConfigLike(customConfig) ? customConfig : undefined;
    const customLegacyConfig = isLegacyConfigLike(customConfig) ? customConfig : undefined;

    const providerId = (
      customTextConfig?.providerMeta?.id ??
      normalizeLegacyProviderId(customLegacyConfig?.provider) ??
      baseConfig?.providerMeta.id ??
      provider
    ).toLowerCase();
    const baseProviderId = baseConfig?.providerMeta.id?.toLowerCase();

    const adapter = this.registry.getAdapter(providerId);

    const desiredModelId = (
      customTextConfig?.modelMeta?.id ??
      customLegacyConfig?.defaultModel ??
      (baseProviderId === providerId ? baseConfig?.modelMeta.id : undefined) ??
      adapter.getModels()[0]?.id ??
      providerId
    );

    const { providerMeta, modelMeta } = resolveTextModelMetadata({
      providerId,
      modelId: desiredModelId,
      registry: this.registry,
      existingProviderMeta: customTextConfig?.providerMeta ?? (baseProviderId === providerId ? baseConfig?.providerMeta : undefined),
      existingModelMeta: customTextConfig?.modelMeta ?? (baseProviderId === providerId ? baseConfig?.modelMeta : undefined)
    });

    const connectionConfig = {
      ...(baseConfig?.connectionConfig ?? {}),
      ...(customTextConfig?.connectionConfig ?? {})
    };

    if (customLegacyConfig?.apiKey) {
      connectionConfig.apiKey = customLegacyConfig.apiKey;
    }
    if (customLegacyConfig?.baseURL) {
      connectionConfig.baseURL = customLegacyConfig.baseURL;
    }
    if (!connectionConfig.baseURL && providerMeta.defaultBaseURL) {
      connectionConfig.baseURL = providerMeta.defaultBaseURL;
    }

    const schema = modelMeta.parameterDefinitions ?? [];
    const legacySplit = splitOverridesBySchema(schema, customLegacyConfig?.llmParams ?? {});
    const combinedBuiltIn = {
      ...(baseConfig?.paramOverrides ?? {}),
      ...(customTextConfig?.paramOverrides ?? {}),
      ...legacySplit.builtIn
    };
    const combinedCustom = {
      ...(baseConfig?.customParamOverrides ?? {}),
      ...(customTextConfig?.customParamOverrides ?? {}),
      ...legacySplit.custom
    };

    return {
      id: baseConfig?.id ?? provider,
      name: customTextConfig?.name ?? customLegacyConfig?.name ?? baseConfig?.name ?? providerMeta.name,
      enabled: baseConfig?.enabled ?? (customTextConfig?.enabled ?? true),
      providerMeta,
      modelMeta,
      connectionConfig,
      paramOverrides: combinedBuiltIn,
      customParamOverrides: combinedCustom
    };
  }

}

/**
 * 创建LLM服务实例的工厂函数
 * @param modelManager 模型管理器实例
 * @returns LLM服务实例
 */
export function createLLMService(modelManager: ModelManager): ILLMService {
  // 在Electron环境中，返回代理实例
  if (isRunningInElectron()) {
    console.log('[LLM Service Factory] Electron environment detected, using proxy.');
    return new ElectronLLMProxy();
  }

  // 创建 Registry 实例
  const registry = new TextAdapterRegistry();

  // 返回注入了 Registry 的 LLMService 实例
  return new LLMService(modelManager, registry);
}

// eslint-disable-next-line @typescript-eslint/ban-types
type LegacyLike = Partial<ModelConfig> & {}

/**
 * 辅助方法: 判断是否为TextModelConfig结构
 */
function isTextConfigLike(config?: Partial<TextModelConfig> | Partial<ModelConfig>): config is Partial<TextModelConfig> {
  return !!config && typeof config === 'object' && 'providerMeta' in config;
}

/**
 * 辅助方法: 判断是否为传统ModelConfig结构
 */
function isLegacyConfigLike(config?: Partial<TextModelConfig> | Partial<ModelConfig>): config is LegacyLike {
  return !!config && typeof config === 'object' && (
    'provider' in config || 'defaultModel' in config || 'baseURL' in config
  );
}

function normalizeLegacyProviderId(provider?: string): string | undefined {
  if (!provider) {
    return undefined;
  }
  return provider === 'custom' ? 'openai-compatible' : provider;
}
