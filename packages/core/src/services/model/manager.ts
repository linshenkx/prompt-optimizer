import { ModelConfig, IModelManager } from './types';
import { ModelConfigError } from '../llm/errors';
import { defaultModels } from './defaults';
import { IStorageProvider } from '../storage/types';
import { LocalStorageProvider } from '../storage/localStorageProvider';

/**
 * 模型管理器实现
 */
export class ModelManager implements IModelManager {
  private models: Record<string, ModelConfig>;
  private readonly storageKey = 'models';

  constructor(private storageProvider: IStorageProvider) {
    this.models = {};
    this.init().catch(err => console.error('Error during ModelManager init:', err));
  }

  /**
   * 初始化模型管理器
   */
  private async init(): Promise<void> {
    try {
      // 1. 先从本地存储加载所有模型配置
      const storedData = await this.storageProvider.getItem(this.storageKey);
      if (storedData) {
        console.log('加载模型配置:', storedData);
        this.models = JSON.parse(storedData);
      }

      // 2. 检查内置模型是否存在，不存在则添加到本地存储
      let hasChanges = false;
      Object.entries(defaultModels).forEach(([key, config]) => {
        if (!this.models[key]) {
          this.models[key] = {
            ...config
          };
          hasChanges = true;
        }
      });

      // 3. 如果有新增的内置模型，保存到本地存储
      if (hasChanges) {
        await this.saveToStorage();
      }
    } catch (error) {
      console.error('初始化模型管理器失败:', error);
    }
  }

  /**
   * 获取所有模型配置
   */
  async getAllModels(): Promise<Array<ModelConfig & { key: string }>> {
    // 每次获取都从存储重新加载最新数据
    const storedData = await this.storageProvider.getItem(this.storageKey);
    if (storedData) {
      try {
        this.models = JSON.parse(storedData);
      } catch (error) {
        console.error('解析模型配置失败:', error);
      }
    }

    const returnValue = Object.entries(this.models).map(([key, config]) => ({
      ...config,
      key
    }));
    return returnValue;
  }

  /**
   * 获取指定模型配置
   */
  async getModel(key: string): Promise<ModelConfig | undefined> {
    const storedData = await this.storageProvider.getItem(this.storageKey);
    if (storedData) {
      try {
        this.models = JSON.parse(storedData);
      } catch (error) {
        console.error('解析模型配置失败:', error);
        return undefined;
      }
    }
    return this.models[key];
  }

  /**
   * 添加模型配置
   */
  async addModel(key: string, config: ModelConfig): Promise<void> {
    const storedData = await this.storageProvider.getItem(this.storageKey);
    if (storedData) {
      this.models = JSON.parse(storedData);
    }
    if (this.models[key]) {
      throw new ModelConfigError(`模型 ${key} 已存在`);
    }
    this.validateConfig(config);
    this.models[key] = { ...config };
    await this.saveToStorage();
  }

  /**
   * 更新模型配置
   */
  async updateModel(key: string, config: Partial<ModelConfig>): Promise<void> {
    const storedData = await this.storageProvider.getItem(this.storageKey);
    if (storedData) {
      this.models = JSON.parse(storedData);
    }
    if (!this.models[key]) {
      throw new ModelConfigError(`模型 ${key} 不存在`);
    }

    // 合并配置时保留原有 enabled 状态
    const updatedConfig = {
      ...this.models[key],
      ...config,
      // 确保 enabled 属性存在
      enabled: config.enabled !== undefined ? config.enabled : this.models[key].enabled
    };

    // 如果更新了关键字段或尝试启用模型，需要验证配置
    if (
      config.name !== undefined ||
      config.baseURL !== undefined ||
      config.models !== undefined ||
      config.defaultModel !== undefined ||
      config.apiKey !== undefined ||
      config.enabled
    ) {
      this.validateConfig(updatedConfig);
    }

    this.models[key] = updatedConfig;
    await this.saveToStorage();
  }

  /**
   * 删除模型配置
   */
  async deleteModel(key: string): Promise<void> {
    const storedData = await this.storageProvider.getItem(this.storageKey);
    if (storedData) {
      this.models = JSON.parse(storedData);
    }
    if (!this.models[key]) {
      throw new ModelConfigError(`模型 ${key} 不存在`);
    }
    delete this.models[key];
    await this.saveToStorage();
  }

  /**
   * 启用模型
   */
  async enableModel(key: string): Promise<void> {
    const storedData = await this.storageProvider.getItem(this.storageKey);
    if (storedData) {
      this.models = JSON.parse(storedData);
    }
    if (!this.models[key]) {
      throw new ModelConfigError(`未知的模型: ${key}`);
    }

    // 使用完整验证
    this.validateEnableConfig(this.models[key]);

    this.models[key].enabled = true;
    await this.saveToStorage();
  }

  /**
   * 禁用模型
   */
  async disableModel(key: string): Promise<void> {
    const storedData = await this.storageProvider.getItem(this.storageKey);
    if (storedData) {
      this.models = JSON.parse(storedData);
    }
    if (!this.models[key]) {
      throw new ModelConfigError(`未知的模型: ${key}`);
    }

    this.models[key].enabled = false;
    await this.saveToStorage();
  }

  /**
   * 验证模型配置
   */
  private validateConfig(config: ModelConfig): void {
    const errors: string[] = [];

    if (!config.name) {
      errors.push('缺少模型名称(name)');
    }
    if (!config.baseURL) {
      errors.push('缺少基础URL(baseURL)');
    }
    if (!Array.isArray(config.models)) {
      errors.push('模型列表(models)必须是数组');
    } else if (config.models.length === 0) {
      errors.push('模型列表(models)不能为空');
    }
    if (!config.defaultModel) {
      errors.push('缺少默认模型(defaultModel)');
    } else if (!config.models?.includes(config.defaultModel)) {
      errors.push('默认模型必须在模型列表中');
    }

    if (errors.length > 0) {
      throw new ModelConfigError('无效的模型配置：' + errors.join('、'));
    }
  }

  private validateEnableConfig(config: ModelConfig): void {
    this.validateConfig(config);

    if (!config.apiKey) {
      throw new ModelConfigError('启用模型需要提供API密钥');
    }
  }

  /**
   * 保存配置到本地存储
   */
  private async saveToStorage(): Promise<void> {
    try {
      await this.storageProvider.setItem(this.storageKey, JSON.stringify(this.models));
    } catch (error) {
      console.error('保存模型配置失败:', error);
    }
  }

  /**
   * 获取所有已启用的模型配置
   */
  async getEnabledModels(): Promise<Array<ModelConfig & { key: string }>> {
    const allModels = await this.getAllModels();
    return allModels.filter(model => model.enabled);
  }
}

// 导出单例实例
export const modelManager = new ModelManager(new LocalStorageProvider());