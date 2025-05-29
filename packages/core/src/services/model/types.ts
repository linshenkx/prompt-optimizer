/**
 * 模型配置接口
 */
export interface ModelConfig {
  /** 模型名称 */
  name: string;
  /** API基础URL */
  baseURL: string;
  /** API密钥 */
  apiKey?: string;
  /** 支持的模型列表 */
  models: string[];
  /** 默认模型 */
  defaultModel: string;
  /** 是否启用 */
  enabled: boolean;
  /** 提供商 */
  provider: 'deepseek' | 'gemini' | 'custom' | 'zhipu' | string;
  /** 是否使用Vercel代理 */
  useVercelProxy?: boolean;
  /** LLM特定参数 */
  llmParams?: Record<string, any>;
}

/**
 * 模型管理器接口
 */
export interface IModelManager {
  /** 获取所有模型配置 */
  getAllModels(): Promise<Array<ModelConfig & { key: string }>>;
  /** 获取指定模型配置 */
  getModel(key: string): Promise<ModelConfig | undefined>;
  /** 添加模型配置 */
  addModel(key: string, config: ModelConfig): Promise<void>;
  /** 更新模型配置 */
  updateModel(key: string, config: Partial<ModelConfig>): Promise<void>;
  /** 删除模型配置 */
  deleteModel(key: string): Promise<void>;
  /** 启用模型 */
  enableModel(key: string): Promise<void>;
  /** 禁用模型 */
  disableModel(key: string): Promise<void>;
  /** 获取启用的模型 */
  getEnabledModels(): Promise<Array<ModelConfig & { key: string }>>;
} 