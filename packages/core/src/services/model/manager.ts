import { IModelManager, ModelConfig } from './types';
import { IStorageProvider } from '../storage/types';
import { StorageFactory } from '../storage/factory';
import { StorageAdapter } from '../storage/adapter';
import { defaultModels } from './defaults';
import { ModelConfigError } from '../llm/errors';

/**
 * 模型管理器实现
 */
export class ModelManager implements IModelManager {
  private models: Record<string, ModelConfig>;
  private readonly storageKey = 'models';
  private readonly storage: IStorageProvider;

  constructor(storageProvider: IStorageProvider) {
    this.models = { ...defaultModels };
    // 使用适配器确保所有存储提供者都支持高级方法
    this.storage = new StorageAdapter(storageProvider);
    this.init().catch(err => console.error('初始化模型管理器失败:', err));
  }

  /**
   * 初始化模型管理器
   */
  private async init(): Promise<void> {
    try {
      // 1. 先从本地存储加载所有模型配置
      const storedData = await this.storage.getItem(this.storageKey);
      if (storedData) {
        console.log('加载模型配置:', storedData);
        this.models = JSON.parse(storedData);
      }

      // 2. 检查内置模型是否存在，不存在则添加到本地存储
      let hasChanges = false;
      Object.entries(defaultModels).forEach(([key, config]) => {
        if (!this.models[key]) {
          this.models[key] = { ...config };
          hasChanges = true;
        } else { // Model exists in storage, check for llmParams updates
          let modelUpdated = false;
          if (config.llmParams) { // If default config has llmParams
            if (!this.models[key].llmParams) { // If stored model has no llmParams
              this.models[key].llmParams = { ...config.llmParams };
              modelUpdated = true;
            } else { // Stored model has llmParams, merge new default keys
              for (const paramKey in config.llmParams) {
                if (this.models[key].llmParams[paramKey] === undefined && config.llmParams.hasOwnProperty(paramKey)) {
                  this.models[key].llmParams[paramKey] = config.llmParams[paramKey];
                  modelUpdated = true;
                }
              }
            }
          }
          // Ensure llmParams is an object if it was created/modified
          if (this.models[key].llmParams && (typeof this.models[key].llmParams !== 'object' || this.models[key].llmParams === null)) {
            this.models[key].llmParams = {}; // Initialize to empty object if invalid
            modelUpdated = true;
          }

          // Remove old top-level properties if they exist on stored model
          const oldParams = ['maxTokens', 'temperature', 'timeout'];
          for (const oldParam of oldParams) {
            if (this.models[key].hasOwnProperty(oldParam)) {
              delete this.models[key][oldParam];
              modelUpdated = true;
            }
          }

          if (modelUpdated) {
            hasChanges = true;
          }
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
    const storedData = await this.storage.getItem(this.storageKey);
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
    const storedData = await this.storage.getItem(this.storageKey);
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
    this.validateConfig(config);
    
    await this.storage.updateData<Record<string, ModelConfig>>(
      this.storageKey,
      (currentModels) => {
        const models = currentModels || {};
        if (models[key]) {
          throw new ModelConfigError(`模型 ${key} 已存在`);
        }
        return {
          ...models,
          [key]: { ...config }
        };
      }
    );
    
    // 更新内存状态
    this.models[key] = { ...config };
  }

  /**
   * 更新模型配置
   */
  async updateModel(key: string, config: Partial<ModelConfig>): Promise<void> {
    let updatedConfig: ModelConfig | undefined;
    
    await this.storage.updateData<Record<string, ModelConfig>>(
      this.storageKey,
      (currentModels) => {
        const models = currentModels || {};
        
        // 如果模型不存在，检查是否是内置模型
        if (!models[key]) {
          if (!defaultModels[key]) {
            throw new ModelConfigError(`模型 ${key} 不存在`);
          }
          // 如果是内置模型但尚未配置，创建初始配置
          models[key] = { ...defaultModels[key] };
        }
        
        // 合并配置时保留原有 enabled 状态
        updatedConfig = {
          ...models[key],
          ...config,
          // 确保 enabled 属性存在
          enabled: config.enabled !== undefined ? config.enabled : models[key].enabled
        };

        // 如果更新了关键字段, 尝试启用模型, 或者更新了llmParams，需要验证配置
        if (
          config.name !== undefined ||
          config.baseURL !== undefined ||
          config.models !== undefined ||
          config.defaultModel !== undefined ||
          config.apiKey !== undefined ||
          config.llmParams !== undefined || // Added llmParams as a trigger
          config.enabled
        ) {
          this.validateConfig(updatedConfig);
        }

        return {
          ...models,
          [key]: updatedConfig
        };
      }
    );
    
    // 只更新特定模型的内存状态，不重新加载全部数据
    if (updatedConfig) {
      this.models[key] = updatedConfig;
    }
  }

  /**
   * 删除模型配置
   */
  async deleteModel(key: string): Promise<void> {
    await this.storage.updateData<Record<string, ModelConfig>>(
      this.storageKey,
      (currentModels) => {
        const models = currentModels || {};
        if (!models[key]) {
          throw new ModelConfigError(`模型 ${key} 不存在`);
        }
        const { [key]: removed, ...remaining } = models;
        return remaining;
      }
    );
    
    // 更新内存状态
    delete this.models[key];
  }

  /**
   * 启用模型
   */
  async enableModel(key: string): Promise<void> {
    await this.storage.updateData<Record<string, ModelConfig>>(
      this.storageKey,
      (currentModels) => {
        const models = currentModels || {};
        if (!models[key]) {
          throw new ModelConfigError(`未知的模型: ${key}`);
        }

        // 使用完整验证
        this.validateEnableConfig(models[key]);

        return {
          ...models,
          [key]: {
            ...models[key],
            enabled: true
          }
        };
      }
    );
    
    // 更新内存状态 - 确保模型存在
    if (this.models[key]) {
      this.models[key].enabled = true;
    }
  }

  /**
   * 禁用模型
   */
  async disableModel(key: string): Promise<void> {
    await this.storage.updateData<Record<string, ModelConfig>>(
      this.storageKey,
      (currentModels) => {
        const models = currentModels || {};
        if (!models[key]) {
          throw new ModelConfigError(`未知的模型: ${key}`);
        }

        return {
          ...models,
          [key]: {
            ...models[key],
            enabled: false
          }
        };
      }
    );
    
    // 更新内存状态 - 确保模型存在
    if (this.models[key]) {
      this.models[key].enabled = false;
    }
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

    // Validate llmParams
    if (config.llmParams !== undefined && (typeof config.llmParams !== 'object' || config.llmParams === null || Array.isArray(config.llmParams))) {
      errors.push('llmParams必须是一个对象');
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
      await this.storage.setItem(this.storageKey, JSON.stringify(this.models));
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
export const modelManager = new ModelManager(StorageFactory.createDefault());