import { IModelManager, ModelConfig } from './types';
import { IStorageProvider } from '../storage/types';
import { StorageAdapter } from '../storage/adapter';
import { defaultModels } from './defaults';
import { ModelConfigError } from '../llm/errors';
import { validateLLMParams } from './validation';
import { ElectronConfigManager, isElectronRenderer } from './electron-config';
import { CORE_SERVICE_KEYS } from '../../constants/storage-keys';
import { ImportExportError } from '../../interfaces/import-export';

/**
 * 模型管理器实现
 */
export class ModelManager implements IModelManager {
  private readonly storageKey = CORE_SERVICE_KEYS.MODELS;
  private readonly storage: IStorageProvider;
  private initPromise: Promise<void>;

  constructor(storageProvider: IStorageProvider) {
    // 使用适配器确保所有存储提供者都支持高级方法
    this.storage = new StorageAdapter(storageProvider);
    this.initPromise = this.init().catch(err => {
      console.error('Model manager initialization failed:', err);
      throw err;
    });
  }

  /**
   * 确保初始化完成
   */
  public async ensureInitialized(): Promise<void> {
    await this.initPromise;
  }

  /**
   * 检查管理器是否已初始化
   */
  public async isInitialized(): Promise<boolean> {
    const storedData = await this.storage.getItem(this.storageKey);
    return !!storedData;
  }

  /**
   * 初始化模型管理器
   */
  private async init(): Promise<void> {
    try {
      console.log('[ModelManager] Initializing...');

      // 在Electron渲染进程中，先同步环境变量
      if (isElectronRenderer()) {
        console.log('[ModelManager] Electron environment detected, syncing config from main process...');
        const configManager = ElectronConfigManager.getInstance();
        await configManager.syncFromMainProcess();
        console.log('[ModelManager] Environment variables synced from main process');
      }

      // 从存储中加载现有配置
      const storedData = await this.storage.getItem(this.storageKey);

      if (storedData) {
        try {
          const storedModels = JSON.parse(storedData);
          console.log('[ModelManager] Loaded existing models from storage');

          // 确保所有默认模型都存在，但保留用户的自定义配置
          const defaults = this.getDefaultModels();
          let hasUpdates = false;
          const updatedModels = { ...storedModels };

          for (const [key, defaultConfig] of Object.entries(defaults)) {
            if (!updatedModels[key]) {
              // 添加缺失的默认模型
              updatedModels[key] = defaultConfig;
              hasUpdates = true;
              console.log(`[ModelManager] Added missing default model: ${key}`);
            } else {
              // 更新现有模型的默认字段（保留用户的关键自定义配置）
              const existingModel = updatedModels[key];
              const updatedModel = {
                ...defaultConfig,
                // 保留用户配置的关键字段
                name: existingModel.name !== undefined ? existingModel.name : defaultConfig.name,
                baseURL: existingModel.baseURL || defaultConfig.baseURL,
                defaultModel: existingModel.defaultModel !== undefined ? existingModel.defaultModel : defaultConfig.defaultModel,
                apiKey: existingModel.apiKey || defaultConfig.apiKey,
                enabled: existingModel.enabled !== undefined ? existingModel.enabled : defaultConfig.enabled,
                // 保留用户的自定义 llmParams
                llmParams: existingModel.llmParams || defaultConfig.llmParams
              };

              // 检查是否有变化
              if (JSON.stringify(updatedModels[key]) !== JSON.stringify(updatedModel)) {
                updatedModels[key] = updatedModel;
                hasUpdates = true;
                console.log(`[ModelManager] Updated default model: ${key}`);
              }
            }
          }

          // 如果有更新，保存到存储
          if (hasUpdates) {
            await this.storage.setItem(this.storageKey, JSON.stringify(updatedModels));
            console.log('[ModelManager] Saved updated models to storage');
          }
        } catch (error) {
          console.error('[ModelManager] Failed to parse stored models, initializing with defaults:', error);
          await this.storage.setItem(this.storageKey, JSON.stringify(this.getDefaultModels()));
        }
      } else {
        console.log('[ModelManager] No existing models found, initializing with defaults');
        await this.storage.setItem(this.storageKey, JSON.stringify(this.getDefaultModels()));
      }

      console.log('[ModelManager] Initialization completed');
    } catch (error) {
      console.error('[ModelManager] Initialization failed:', error);
      // 如果初始化失败，至少保存默认配置到存储
      try {
        await this.storage.setItem(this.storageKey, JSON.stringify(this.getDefaultModels()));
      } catch (saveError) {
        console.error('[ModelManager] Failed to save default models:', saveError);
      }
    }
  }

  /**
   * 获取默认模型配置
   */
  private getDefaultModels(): Record<string, ModelConfig> {
    // 在Electron环境下使用配置管理器生成配置
    if (isElectronRenderer()) {
      const configManager = ElectronConfigManager.getInstance();
      if (configManager.isInitialized()) {
        return configManager.generateDefaultModels();
      } else {
        console.warn('[ModelManager] ElectronConfigManager not initialized, using fallback defaults');
      }
    }

    // 否则使用原有的默认配置
    return defaultModels;
  }

  /**
   * 从存储获取模型配置，如果不存在则返回默认配置
   */
  private async getModelsFromStorage(): Promise<Record<string, ModelConfig>> {
    const storedData = await this.storage.getItem(this.storageKey);
    if (storedData) {
      try {
        return JSON.parse(storedData);
      } catch (error) {
        console.error('[ModelManager] Failed to parse stored models, using defaults:', error);
      }
    }
    return this.getDefaultModels();
  }

  /**
   * 获取所有模型配置
   */
  async getAllModels(): Promise<Array<ModelConfig & { key: string }>> {
    await this.ensureInitialized();
    const models = await this.getModelsFromStorage();
    return Object.entries(models).map(([key, config]) => ({
      key,
      ...config
    }));
  }

  /**
   * 获取指定模型配置
   */
  async getModel(key: string): Promise<ModelConfig | undefined> {
    await this.ensureInitialized();
    const models = await this.getModelsFromStorage();
    return models[key];
  }

  /**
   * 添加模型配置
   */
  async addModel(key: string, config: ModelConfig): Promise<void> {
    await this.ensureInitialized();
    this.validateConfig(config);

    await this.storage.updateData<Record<string, ModelConfig>>(
      this.storageKey,
      (currentModels) => {
        // 使用存储中的数据，如果不存在则使用默认配置
        const models = currentModels || this.getDefaultModels();

        if (models[key]) {
          throw new ModelConfigError(`Model ${key} already exists`);
        }

        return {
          ...models,
          [key]: {
            ...config,
            // Deep copy llmParams to avoid reference sharing
            ...(config.llmParams && { llmParams: { ...config.llmParams } })
          }
        };
      }
    );
  }

  /**
   * 更新模型配置
   */
  async updateModel(key: string, config: Partial<ModelConfig>): Promise<void> {
    await this.ensureInitialized();

    await this.storage.updateData<Record<string, ModelConfig>>(
      this.storageKey,
      (currentModels) => {
        // 使用存储中的数据，如果不存在则使用默认配置
        const models = currentModels || this.getDefaultModels();

        // 如果模型不存在，检查是否是内置模型
        if (!models[key]) {
          const defaults = this.getDefaultModels();
          if (!defaults[key]) {
            throw new ModelConfigError(`Model ${key} does not exist`);
          }
          // 如果是内置模型但尚未配置，创建初始配置
          models[key] = {
            ...defaults[key],
            // Deep copy llmParams to avoid reference sharing
            ...(defaults[key].llmParams && { llmParams: { ...defaults[key].llmParams } })
          };
        }

        // 合并配置时保留原有 enabled 状态
        const updatedConfig = {
          ...models[key],
          ...config,
          // 确保 enabled 属性存在
          enabled: config.enabled !== undefined ? config.enabled : models[key].enabled,
          // Deep copy llmParams to avoid reference sharing
          ...(config.llmParams && { llmParams: { ...config.llmParams } })
        };

        // 如果更新了关键字段, 尝试启用模型, 或者更新了llmParams，需要验证配置
        if (
          config.name !== undefined ||
          config.baseURL !== undefined ||
          config.models !== undefined ||
          config.defaultModel !== undefined ||
          config.apiKey !== undefined ||
          config.llmParams !== undefined ||
          config.enabled
        ) {
          this.validateConfig(updatedConfig);
        }

        // 返回完整的模型数据，确保所有模型都被保留
        return {
          ...models,
          [key]: updatedConfig
        };
      }
    );
  }

  /**
   * 删除模型配置
   */
  async deleteModel(key: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage.updateData<Record<string, ModelConfig>>(
      this.storageKey,
      (currentModels) => {
        // 使用存储中的数据，如果不存在则使用默认配置
        const models = currentModels || this.getDefaultModels();

        if (!models[key]) {
          throw new ModelConfigError(`Model ${key} does not exist`);
        }
        const { [key]: removed, ...remaining } = models;
        return remaining;
      }
    );
  }

  /**
   * 启用模型
   */
  async enableModel(key: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage.updateData<Record<string, ModelConfig>>(
      this.storageKey,
      (currentModels) => {
        // 使用存储中的数据，如果不存在则使用默认配置
        const models = currentModels || this.getDefaultModels();

        if (!models[key]) {
          throw new ModelConfigError(`Unknown model: ${key}`);
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
  }

  /**
   * 禁用模型
   */
  async disableModel(key: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage.updateData<Record<string, ModelConfig>>(
      this.storageKey,
      (currentModels) => {
        // 使用存储中的数据，如果不存在则使用默认配置
        const models = currentModels || this.getDefaultModels();

        if (!models[key]) {
          throw new ModelConfigError(`Unknown model: ${key}`);
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
  }

  /**
   * 验证模型配置
   */
  private validateConfig(config: ModelConfig): void {
    const errors: string[] = [];

    if (!config.name) {
      errors.push('Missing model name (name)');
    }
    if (!config.baseURL) {
      errors.push('Missing base URL (baseURL)');
    }
    if (!config.defaultModel) {
      errors.push('Missing default model (defaultModel)');
    }

    // Validate llmParams structure
    if (config.llmParams !== undefined && (typeof config.llmParams !== 'object' || config.llmParams === null || Array.isArray(config.llmParams))) {
      errors.push('llmParams must be an object');
    }

    // Validate llmParams content for security and correctness
    if (config.llmParams && typeof config.llmParams === 'object') {
      const provider = config.provider || 'openai'; // Default to openai provider for validation
      const validation = validateLLMParams(config.llmParams, provider);
      
      if (!validation.isValid) {
        const paramErrors = validation.errors.map(error => 
          `Parameter ${error.parameterName}: ${error.message}`
        );
        errors.push(...paramErrors);
      }
    }

    if (errors.length > 0) {
      throw new ModelConfigError('Invalid model configuration: ' + errors.join(', '));
    }
  }

  private validateEnableConfig(config: ModelConfig): void {
    this.validateConfig(config);
    // API key允许为空字符串，某些服务（如Ollama）不需要API key
  }



  /**
   * 获取所有已启用的模型配置
   */
  async getEnabledModels(): Promise<Array<ModelConfig & { key: string }>> {
    await this.ensureInitialized();
    const allModels = await this.getAllModels();
    return allModels.filter(model => model.enabled);
  }

  // 实现 IImportExportable 接口

  /**
   * 导出所有模型配置
   */
  async exportData(): Promise<ModelConfig[]> {
    try {
      return await this.getAllModels();
    } catch (error) {
      throw new ImportExportError(
        'Failed to export model data',
        await this.getDataType(),
        error as Error
      );
    }
  }

  /**
   * 导入模型配置
   */
  async importData(data: any): Promise<void> {
    // 基本格式验证：必须是数组
    if (!Array.isArray(data)) {
      throw new Error('Invalid model data format: data must be an array of model configurations');
    }

    const models = data as (ModelConfig & { key: string })[];
    const failedModels: { model: ModelConfig & { key: string }; error: Error }[] = [];

    // Import each model individually, capturing failures
    for (const model of models) {
      try {
        // 使用 validateData 验证单个模型
        if (!this.validateSingleModel(model)) {
          console.warn(`Skipping invalid model configuration:`, model);
          failedModels.push({ model, error: new Error('Invalid model configuration') });
          continue;
        }

        // 检查模型是否已存在（包括内置模型）
        const existingModel = await this.getModel(model.key);

        if (existingModel) {
          // 内置模型和自定义模型都允许更新配置，使用导入文件中的启用状态
          const mergedConfig: ModelConfig = {
            name: model.name,
            baseURL: model.baseURL || existingModel.baseURL,
            models: model.models || existingModel.models,
            defaultModel: model.defaultModel || existingModel.defaultModel,
            provider: model.provider || existingModel.provider,
            enabled: model.enabled !== undefined ? model.enabled : existingModel.enabled, // 优先使用导入的启用状态
            ...(model.apiKey !== undefined && { apiKey: model.apiKey }),
            ...(model.useVercelProxy !== undefined && { useVercelProxy: model.useVercelProxy }),
            ...(model.llmParams !== undefined && { llmParams: model.llmParams })
          };
          await this.updateModel(model.key, mergedConfig);
          console.log(`Model ${model.key} already exists, configuration updated (using imported enabled status: ${mergedConfig.enabled})`);
        } else {
          // 如果模型不存在，添加新的自定义模型，使用导入文件中的启用状态
          const newModelConfig: ModelConfig = {
            name: model.name,
            baseURL: model.baseURL || 'https://api.example.com/v1', // 提供默认值
            models: model.models || [],
            defaultModel: model.defaultModel || (model.models && model.models[0]) || 'default-model',
            provider: model.provider || 'custom',
            enabled: model.enabled !== undefined ? model.enabled : false, // 使用导入的启用状态，默认为false
            ...(model.apiKey !== undefined && { apiKey: model.apiKey }),
            ...(model.useVercelProxy !== undefined && { useVercelProxy: model.useVercelProxy }),
            ...(model.llmParams !== undefined && { llmParams: model.llmParams })
          };
          await this.addModel(model.key, newModelConfig);
          console.log(`Imported new model ${model.key} (enabled: ${newModelConfig.enabled})`);
        }
      } catch (error) {
        console.warn(`Error importing model ${model.key}:`, error);
        failedModels.push({ model, error: error as Error });
      }
    }

    if (failedModels.length > 0) {
      console.warn(`Failed to import ${failedModels.length} models`);
      // 不抛出错误，允许部分成功的导入
    }
  }

  /**
   * 获取数据类型标识
   */
  async getDataType(): Promise<string> {
    return 'models';
  }

  /**
   * 验证模型数据格式
   */
  async validateData(data: any): Promise<boolean> {
    if (!Array.isArray(data)) {
      return false;
    }

    return data.every(item => this.validateSingleModel(item));
  }

  /**
   * 验证单个模型配置
   */
  private validateSingleModel(item: any): boolean {
    return typeof item === 'object' &&
      item !== null &&
      typeof item.key === 'string' && // 导入数据必须包含key
      typeof item.name === 'string' &&
      typeof item.baseURL === 'string' &&
      typeof item.defaultModel === 'string' &&
      typeof item.enabled === 'boolean' &&
      typeof item.provider === 'string';
  }
}

/**
 * 创建模型管理器的工厂函数
 * @param storageProvider 存储提供器实例
 * @returns 模型管理器实例
 */
export function createModelManager(storageProvider: IStorageProvider): ModelManager {
  return new ModelManager(storageProvider);
}