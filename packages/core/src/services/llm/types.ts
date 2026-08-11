import type { UnifiedParameterDefinition } from '../model/parameter-schema'
import type { ModelConfig, TextModelConfig as ModelTextModelConfig } from '../model/types';
import type { RegionalEndpoint } from '../shared/types'

export type { RegionalEndpoint } from '../shared/types'

// === 核心架构类型（三层分离：Provider → Model → Configuration） ===

/**
 * 连接参数的类型安全定义
 * 定义提供商所需的连接参数结构
 */
export interface ConnectionSchema {
  /** 必需字段，如 ['apiKey'] */
  required: string[]
  /** 可选字段，如 ['baseURL', 'timeout', 'organization'] */
  optional: string[]
  /** 字段类型约束 */
  fieldTypes: Record<string, 'string' | 'number' | 'boolean'>
}

/**
 * 文本模型服务提供商静态定义（由适配器提供）
 * 定义LLM服务提供商的元数据和能力
 */
export interface TextProvider {
  /** provider 唯一标识，如 'openai', 'gemini', 'anthropic' */
  readonly id: string
  /** 显示名称，如 'OpenAI', 'Google Gemini', 'Anthropic' */
  readonly name: string
  /** 描述信息 */
  readonly description?: string
  /**
   * 浏览器环境是否会被 CORS 限制（无法直接请求该 API）。
   * - true: Web 端可能因 CORS 被浏览器拦截，建议使用 Desktop 或自行配置代理
   * - false/undefined: 未标记为 CORS 限制（不代表一定可用，仍可能受网络/鉴权等影响）
   */
  readonly corsRestricted?: boolean
  /** 是否必须提供 API Key */
  readonly requiresApiKey: boolean
  /** 默认 API 地址 */
  readonly defaultBaseURL: string
  /** Optional region-specific API and documentation endpoints. */
  readonly regionalEndpoints?: readonly RegionalEndpoint[]
  /** 是否支持动态获取模型列表 */
  readonly supportsDynamicModels: boolean
  /** 连接参数结构定义（如果支持动态获取） */
  readonly connectionSchema?: ConnectionSchema
  /** API Key 获取页面 URL（可选）*/
  readonly apiKeyUrl?: string
}

export type ParameterDefinition = UnifiedParameterDefinition;

/**
 * 文本模型静态定义（由适配器提供）
 * 定义LLM模型的能力和参数schema
 */
export interface TextModel {
  /** 模型唯一标识，如 'gpt-4', 'gemini-2.0-flash' */
  readonly id: string
  /** 显示名称，如 'GPT-4', 'Gemini 2.0 Flash' */
  readonly name: string
  /** 模型描述 */
  readonly description?: string
  /** 所属 provider，如 'openai', 'gemini' */
  readonly providerId: string
  /** 模型能力定义 */
  readonly capabilities: {
    /** 是否支持工具调用 */
    supportsTools: boolean
    /** 是否支持推理内容（如 o1 系列） */
    supportsReasoning?: boolean
    /** 最大上下文长度 */
    maxContextLength?: number
  }
  /** 模型特定参数定义 */
  readonly parameterDefinitions: readonly ParameterDefinition[]
  /** 默认参数值 */
  readonly defaultParameterValues?: Record<string, unknown>
}

/**
 * 用户文本模型配置（Configuration 层）
 *
 * 统一复用 model/types 中的 TextModelConfig，避免双定义漂移。
 */
export type TextModelConfig = ModelTextModelConfig

/**
 * 工具调用相关类型
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: object;
}

export interface ToolDefinition {
  type: 'function';
  function: FunctionDefinition;
}
/**
 * 消息角色类型
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * 消息类型
 */
export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ImageUnderstandingImageInput {
  b64: string;
  mimeType?: string;
}

export interface ImageUnderstandingRequest {
  systemPrompt?: string;
  userPrompt: string;
  images: ImageUnderstandingImageInput[];
  paramOverrides?: Record<string, unknown>;
  responseMimeType?: string;
}

/**
 * LLM响应结构
 */
export interface LLMResponse {
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];  // 🆕 工具调用信息
  metadata?: {
    model?: string;
    tokens?: number;
    finishReason?: string;
  };
}

/**
 * 流式响应处理器
 * 支持传统格式和结构化格式
 */
export interface StreamHandlers {
  // 主要内容流（必需，向后兼容）
  onToken: (token: string) => void;
  
  // 推理内容流（可选，新增功能）
  onReasoningToken?: (token: string) => void;
  
  // 工具调用处理（🆕 新增功能）
  onToolCall?: (toolCall: ToolCall) => void;
  
  // 完成回调（现在传递完整响应，向后兼容通过可选参数）
  onComplete: (response?: LLMResponse) => void;
  
  // 错误回调
  onError: (error: Error) => void;
}

/**
 * 模型信息接口
 */
export interface ModelInfo {
  id: string;  // 模型ID，用于API调用
  name: string; // 显示名称
}

/**
 * 用于下拉选择组件的模型选项格式
 */
export interface ModelOption {
  value: string; // 选项值，通常是模型ID
  label: string; // 显示标签，通常是模型名称
}

/**
 * LLM服务接口
 */
export interface ILLMService {
  /**
   * 发送消息（传统格式，返回合并的字符串）
   * @deprecated 建议使用 sendMessageStructured 获得更好的语义支持
   * @throws {RequestConfigError} 当参数无效时
   * @throws {APIError} 当请求失败时
   */
  sendMessage(messages: Message[], provider: string): Promise<string>;

  /**
   * 发送消息（结构化格式）
   * @throws {RequestConfigError} 当参数无效时
   * @throws {APIError} 当请求失败时
   */
  sendMessageStructured(messages: Message[], provider: string): Promise<LLMResponse>;



  /**
   * 发送流式消息（支持结构化和传统格式）
   * @throws {RequestConfigError} 当参数无效时
   * @throws {APIError} 当请求失败时
   */
  sendMessageStream(
    messages: Message[],
    provider: string,
    callbacks: StreamHandlers
  ): Promise<void>;

  /**
   * 发送支持工具调用的流式消息（🆕 新增功能）
   * @throws {RequestConfigError} 当参数无效时
   * @throws {APIError} 当请求失败时
   */
  sendMessageStreamWithTools(
    messages: Message[],
    provider: string,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void>;

  /**
   * 测试连接
   */
  testConnection(provider: string): Promise<void>;

  /**
   * 获取模型列表，以下拉选项格式返回
   * @param provider 提供商标识
   * @param customConfig 自定义配置（可选）
   * @throws {RequestConfigError} 当参数无效时
   * @throws {APIError} 当请求失败时
   */
  fetchModelList(provider: string, customConfig?: Partial<ModelConfig>): Promise<ModelOption[]>;
}

// === Adapter层接口定义 ===

/**
 * 文本模型Provider适配器接口
 * 每个LLM服务提供商需要实现此接口
 *
 * 职责：
 * - 封装特定Provider的SDK调用逻辑
 * - 提供Provider和Model元数据
 * - 处理请求/响应转换
 * - 保留原始错误堆栈信息
 */
export interface ITextProviderAdapter {
  /**
   * 获取Provider元数据
   * @returns Provider静态信息
   */
  getProvider(): TextProvider

  /**
   * 获取静态模型列表
   * @returns 该Provider支持的所有模型定义
   */
  getModels(): TextModel[]

  /**
   * 动态获取模型列表（如果Provider支持）
   * @param config 连接配置
   * @returns 动态获取的模型列表
   * @throws {Error} 如果Provider不支持动态获取
   */
  getModelsAsync?(config: TextModelConfig): Promise<TextModel[]>

  /**
   * 发送消息（结构化格式）
   * @param messages 消息数组
   * @param config 模型配置
   * @returns LLM响应
   * @throws SDK原始错误（保留完整堆栈）
   */
  sendMessage(messages: Message[], config: TextModelConfig): Promise<LLMResponse>

  /**
   * 发送流式消息
   * @param messages 消息数组
   * @param config 模型配置
   * @param callbacks 流式响应回调
   * @throws SDK原始错误（保留完整堆栈）
   */
  sendMessageStream(
    messages: Message[],
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void>

  /**
   * 发送支持工具调用的流式消息
   * @param messages 消息数组
   * @param config 模型配置
   * @param tools 工具定义
   * @param callbacks 流式响应回调
   * @throws SDK原始错误（保留完整堆栈）
   */
  sendMessageStreamWithTools(
    messages: Message[],
    config: TextModelConfig,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void>

  /**
   * Send an image-understanding request with one or more reference images.
   * Providers that do not support multimodal text understanding should throw at request time.
   */
  sendImageUnderstanding(
    request: ImageUnderstandingRequest,
    config: TextModelConfig
  ): Promise<LLMResponse>

  /**
   * Stream an image-understanding request with one or more reference images.
   * Providers that do not support multimodal streaming should throw at request time.
   */
  sendImageUnderstandingStream(
    request: ImageUnderstandingRequest,
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void>

  /**
   * 为未知模型ID构建默认元数据（兜底逻辑）
   * @param modelId 模型ID
   * @returns 包含默认capabilities的TextModel对象
   */
  buildDefaultModel(modelId: string): TextModel
}

/**
 * 文本模型Adapter注册表接口
 * 管理所有Adapter实例，提供统一查询接口
 */
export interface ITextAdapterRegistry {
  /**
   * 通过providerId获取Adapter实例
   * @param providerId Provider唯一标识
   * @returns Adapter实例
   * @throws {Error} 如果providerId不存在
   */
  getAdapter(providerId: string): ITextProviderAdapter

  /**
   * 获取所有Provider元数据
   * @returns 所有已注册Provider的元数据数组
   */
  getAllProviders(): TextProvider[]

  /**
   * 获取指定Provider的静态模型列表（带缓存）
   * @param providerId Provider唯一标识
   * @returns 静态模型列表
   */
  getStaticModels(providerId: string): TextModel[]

  /**
   * 动态获取模型列表（仅支持的Provider）
   * @param providerId Provider唯一标识
   * @param config 连接配置
   * @returns 动态获取的模型列表
   * @throws {Error} 如果Provider不支持动态获取
   */
  getDynamicModels(providerId: string, config: TextModelConfig): Promise<TextModel[]>

  /**
   * 获取模型列表（统一接口）
   * 优先尝试动态获取，失败则fallback到静态列表
   * @param providerId Provider唯一标识
   * @param config 连接配置（可选）
   * @returns 模型列表
   */
  getModels(providerId: string, config?: TextModelConfig): Promise<TextModel[]>

  /**
   * 检查Provider是否支持动态模型获取
   * @param providerId Provider唯一标识
   * @returns 是否支持
   */
  supportsDynamicModels(providerId: string): boolean

  /**
   * 验证Provider和Model是否匹配
   * @param providerId Provider唯一标识
   * @param modelId Model唯一标识
   * @returns 是否有效
   */
  validateProviderModel(providerId: string, modelId: string): boolean
}
