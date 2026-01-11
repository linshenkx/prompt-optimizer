/**
 * 共享类型定义
 * 文本模型和图像模型服务的通用类型
 */

/**
 * 连接参数的类型安全定义
 * 用于定义 Provider 所需的连接配置结构
 */
export interface ConnectionSchema {
  /** 必需字段，如 ['apiKey'] */
  required: string[];
  /** 可选字段，如 ['baseURL', 'timeout', 'region'] */
  optional: string[];
  /** 字段类型约束 */
  fieldTypes: Record<string, 'string' | 'number' | 'boolean'>;
}

/**
 * 基础 Provider 接口
 * 定义所有服务提供商的共同属性
 */
export interface BaseProvider {
  /** Provider 唯一标识，如 'openai', 'gemini' */
  readonly id: string;
  /** 显示名称，如 'OpenAI', 'Google Gemini' */
  readonly name: string;
  /** 描述信息 */
  readonly description?: string;
  /** 是否必须提供 API Key */
  readonly requiresApiKey: boolean;
  /** 默认 API 地址 */
  readonly defaultBaseURL: string;
  /** 是否支持动态获取模型列表 */
  readonly supportsDynamicModels: boolean;
  /** 连接参数结构定义 */
  readonly connectionSchema?: ConnectionSchema;
  /** API Key 获取页面 URL（可选）*/
  readonly apiKeyUrl?: string;
}

/**
 * 基础 Model 接口
 * 定义所有模型的共同属性
 */
export interface BaseModel {
  /** 模型唯一标识，如 'gpt-4', 'dall-e-3' */
  readonly id: string;
  /** 显示名称 */
  readonly name: string;
  /** 模型描述 */
  readonly description?: string;
  /** 所属 Provider ID */
  readonly providerId: string;
  /** 默认参数值 */
  readonly defaultParameterValues?: Record<string, unknown>;
}
