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
}

/**
 * 模型管理器接口
 */
export interface IModelManager {
  /** 获取所有模型配置 */
  getAllModels(): ModelConfig[];
  /** 获取指定模型配置 */
  getModel(key: string): ModelConfig | undefined;
  /** 添加模型配置 */
  addModel(key: string, config: ModelConfig): void;
  /** 更新模型配置 */
  updateModel(key: string, config: Partial<ModelConfig>): void;
  /** 删除模型配置 */
  deleteModel(key: string): void;
  /** 启用模型 */
  enableModel(key: string): void;
  /** 禁用模型 */
  disableModel(key: string): void;
  /** 获取启用的模型 */
  getEnabledModels(): ModelConfig[];
} 