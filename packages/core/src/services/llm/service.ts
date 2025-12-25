import { ILLMService, Message, StreamHandlers, LLMResponse, ModelOption, ToolDefinition } from './types';
import type { TextModelConfig, ModelConfig } from '../model/types';
import { ModelManager } from '../model/manager';
import { APIError, RequestConfigError } from './errors';
import { isRunningInElectron } from '../../utils/environment';
import { ElectronLLMProxy } from './electron-proxy';
import type { ITextAdapterRegistry } from './types';
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
  private validateModelConfig(modelConfig: TextModelConfig): void {
    if (!modelConfig) {
      throw new RequestConfigError('Model config cannot be empty');
    }
    if (!modelConfig.providerMeta || !modelConfig.providerMeta.id) {
      throw new RequestConfigError('Model provider metadata cannot be empty');
    }
    if (!modelConfig.modelMeta || !modelConfig.modelMeta.id) {
      throw new RequestConfigError('Model metadata cannot be empty');
    }
    if (!modelConfig.enabled) {
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

      console.log('Sending message:', {
        provider: modelConfig.providerMeta.id,
        model: modelConfig.modelMeta.id,
        messagesCount: messages.length
      });

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
    callbacks: StreamHandlers
  ): Promise<void> {
    try {
      console.log('Starting stream request:', { provider, messagesCount: messages.length });
      this.validateMessages(messages);

      const modelConfig = await this.modelManager.getModel(provider);
      if (!modelConfig) {
        throw new RequestConfigError(`Model ${provider} not found`);
      }

      this.validateModelConfig(modelConfig);

      console.log('Model instance retrieved:', {
        provider: modelConfig.providerMeta.id,
        model: modelConfig.modelMeta.id
      });

      // 通过 Registry 获取 Adapter
      const adapter = this.registry.getAdapter(modelConfig.providerMeta.id);

      const runtimeConfig = this.prepareRuntimeConfig(modelConfig);

      // 使用 Adapter 发送流式消息
      await adapter.sendMessageStream(messages, runtimeConfig, callbacks);

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
    callbacks: StreamHandlers
  ): Promise<void> {
    try {
      console.log('Starting stream request with tools:', {
        provider,
        messagesCount: messages.length,
        toolsCount: tools.length
      });

      this.validateMessages(messages);

      const modelConfig = await this.modelManager.getModel(provider);
      if (!modelConfig) {
        throw new RequestConfigError(`Model ${provider} not found`);
      }

      this.validateModelConfig(modelConfig);

      console.log('Model instance retrieved (with tools):', {
        provider: modelConfig.providerMeta.id,
        model: modelConfig.modelMeta.id,
        tools: tools.map(t => t.function.name)
      });

      // 通过 Registry 获取 Adapter
      const adapter = this.registry.getAdapter(modelConfig.providerMeta.id);

      const runtimeConfig = this.prepareRuntimeConfig(modelConfig);

      // 使用 Adapter 发送带工具的流式消息
      await adapter.sendMessageStreamWithTools(messages, runtimeConfig, tools, callbacks);

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
      console.log('Testing connection provider:', {
        provider: provider,
      });

      // 发送一个简单的测试消息
      const testMessages: Message[] = [
        {
          role: 'user',
          content: 'Please reply ok'
        }
      ];

      // 使用 sendMessage 进行测试
      await this.sendMessage(testMessages, provider);

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

      console.log(`获取 ${modelConfig.name || provider} 的模型列表`);

      // 使用 Registry 获取模型列表
      const providerId = modelConfig.providerMeta.id;
      const models = await this.registry.getModels(providerId, modelConfig);

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
      baseConfig?.providerMeta.id ??
      customTextConfig?.providerMeta?.id ??
      customLegacyConfig?.provider ??
      provider
    ).toLowerCase();

    const adapter = this.registry.getAdapter(providerId);
    const providerMeta = adapter.getProvider();

    const desiredModelId = (
      baseConfig?.modelMeta.id ??
      customTextConfig?.modelMeta?.id ??
      customLegacyConfig?.defaultModel ??
      adapter.getModels()[0]?.id ??
      providerMeta.id
    );

    let modelMeta = baseConfig?.modelMeta;
    if (!modelMeta || modelMeta.id !== desiredModelId) {
      modelMeta = adapter.getModels().find(model => model.id === desiredModelId);
      if (!modelMeta) {
        modelMeta = adapter.buildDefaultModel(desiredModelId);
      }
    }

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
