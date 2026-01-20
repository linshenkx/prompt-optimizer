import { IModelManager, ModelConfig, TextModelConfig } from './types';
import { IStorageProvider } from '../storage/types';
import { StorageAdapter } from '../storage/adapter';
import { getAllModels, getBuiltinModelIds } from './defaults';
import { ModelConfigError } from '../llm/errors';
import { validateOverrides } from './parameter-utils';
import { ElectronConfigManager, isElectronRenderer } from './electron-config';
import { CORE_SERVICE_KEYS } from '../../constants/storage-keys';
import { ImportExportError } from '../../interfaces/import-export';
import { IMPORT_EXPORT_ERROR_CODES } from '../../constants/error-codes';
import {
  convertLegacyToTextModelConfig,
  convertLegacyToTextModelConfigWithRegistry,
  isLegacyConfig,
  isTextModelConfig
} from './converter';
import type { ITextAdapterRegistry } from '../llm/types';

/**
 * 模型管理器实现
 */
export class ModelManager implements IModelManager {
  private readonly storageKey = CORE_SERVICE_KEYS.MODELS;
  private readonly storage: IStorageProvider;
  private initPromise: Promise<void>;
  private registry?: ITextAdapterRegistry;

  constructor(storageProvider: IStorageProvider, registry?: ITextAdapterRegistry) {
    // 使用适配器确保所有存储提供者都支持高级方法
    this.storage = new StorageAdapter(storageProvider);
    this.registry = registry;
    this.initPromise = this.init().catch(err => {
      console.error('Model manager initialization failed:', err);
      throw err;
    });
  }

  /**
   * 懒加载获取 Registry 实例
   * 使用动态 import 避免循环依赖
   */
  private async getRegistry(): Promise<ITextAdapterRegistry> {
    if (!this.registry) {
      try {
        // 动态导入避免循环依赖
        const { TextAdapterRegistry } = await import('../llm/adapters/registry');
        this.registry = new TextAdapterRegistry();
        console.log('[ModelManager] Lazy-loaded TextAdapterRegistry');
      } catch (error) {
        console.error('[ModelManager] Failed to load TextAdapterRegistry:', error);
        throw new ModelConfigError('Failed to load model adapter registry');
      }
    }
    return this.registry;
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
              // 检查现有模型是否为新格式
              const existingModel = updatedModels[key];

              if (isTextModelConfig(existingModel)) {
                // 已经是新格式，保留用户配置，仅在缺失关键字段时补齐默认值
                const updatedModel = { ...existingModel } as TextModelConfig;
                let patched = false;

                if (!updatedModel.providerMeta && defaultConfig.providerMeta) {
                  updatedModel.providerMeta = defaultConfig.providerMeta;
                  patched = true;
                }

                if (!updatedModel.modelMeta && defaultConfig.modelMeta) {
                  updatedModel.modelMeta = defaultConfig.modelMeta;
                  patched = true;
                }

                if (patched) {
                  updatedModels[key] = updatedModel;
                  hasUpdates = true;
                  console.log(`[ModelManager] Patched missing metadata for model: ${key}`);
                }

                // 检查是否需要自动注入 apiKey 并启用内置模型
                if (this.shouldAutoEnableBuiltinModel(key, updatedModel, defaultConfig)) {
                  updatedModels[key] = {
                    ...updatedModel,
                    connectionConfig: {
                      ...(updatedModel.connectionConfig || {}),
                      apiKey: defaultConfig.connectionConfig?.apiKey
                    },
                    enabled: true
                  };
                  hasUpdates = true;
                  console.log(`[ModelManager] Auto-enabled builtin model with new API key: ${key}`);
                }
              } else if (isLegacyConfig(existingModel)) {
                // 旧格式，尝试使用 Registry 转换为新格式
                try {
                  const registry = await this.getRegistry();
                  const convertedModel = await convertLegacyToTextModelConfigWithRegistry(key, existingModel, registry);
                  updatedModels[key] = convertedModel;
                  hasUpdates = true;
                  console.log(`[ModelManager] Converted legacy model to new format (via Registry): ${key}`);
                } catch (error) {
                  // Fallback 到硬编码转换
                  console.warn(`[ModelManager] Registry conversion failed for ${key}, using fallback:`, error);
                  const convertedModel = convertLegacyToTextModelConfig(key, existingModel);
                  updatedModels[key] = convertedModel;
                  hasUpdates = true;
                  console.log(`[ModelManager] Converted legacy model to new format (via fallback): ${key}`);
                }
              } else {
                // 未知格式，使用默认配置替换
                updatedModels[key] = defaultConfig;
                hasUpdates = true;
                console.log(`[ModelManager] Replaced unknown format with default: ${key}`);
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
   * 获取默认模型配置（返回TextModelConfig格式）
   * 注意：每次调用都会重新计算，确保环境变量变化能被感知
   */
  private getDefaultModels(): Record<string, TextModelConfig> {
    // 在Electron环境下使用配置管理器生成配置
    if (isElectronRenderer()) {
      const configManager = ElectronConfigManager.getInstance();
      if (configManager.isInitialized()) {
        // ElectronConfigManager 已支持 getAllModels()
        return configManager.generateDefaultModels();
      }
    }

    // 调用函数重新计算（而非使用静态常量），确保环境变量变化能被感知
    return getAllModels();
  }

  /**
   * 迁移配置：合并 customParamOverrides 到 paramOverrides
   * 用于向后兼容读取旧数据格式
   */
  private migrateConfig(config: TextModelConfig): TextModelConfig {
    // 如果没有 customParamOverrides，直接返回
    if (!config.customParamOverrides || Object.keys(config.customParamOverrides).length === 0) {
      return config
    }

    // 添加迁移日志
    console.warn(
      `[ModelManager] Migrating customParamOverrides to paramOverrides for model '${config.id}'. ` +
      `The 'customParamOverrides' field is deprecated and will be removed in v3.0.`
    )

    // 合并 customParamOverrides 到 paramOverrides
    return {
      ...config,
      paramOverrides: {
        ...(config.paramOverrides || {}),
        ...(config.customParamOverrides || {})
      }
      // 保留 customParamOverrides 字段以防版本回退，但新代码不再使用
    }
  }

  /**
   * 从存储获取模型配置，如果不存在则返回默认配置
   * 返回any类型以兼容新旧格式
   */
  private async getModelsFromStorage(): Promise<Record<string, any>> {
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
   * 获取所有模型配置（返回 TextModelConfig）
   */
  async getAllModels(): Promise<TextModelConfig[]> {
    await this.ensureInitialized();
    const models = await this.getModelsFromStorage();

    // 转换为 TextModelConfig 数组
    return Object.entries(models).map(([key, config]) => {
      let textConfig: TextModelConfig

      // 检查是否已经是新格式
      if (isTextModelConfig(config)) {
        textConfig = config as TextModelConfig;
      }
      // 传统格式，转换为新格式
      else if (isLegacyConfig(config)) {
        textConfig = convertLegacyToTextModelConfig(key, config);
      }
      // 未知格式，尝试转换
      else {
        textConfig = convertLegacyToTextModelConfig(key, config as ModelConfig);
      }

      // 读时迁移：合并 customParamOverrides 到 paramOverrides
      return this.migrateConfig(textConfig)
    });
  }

  /**
   * 获取指定模型配置（返回 TextModelConfig）
   */
  async getModel(key: string): Promise<TextModelConfig | undefined> {
    await this.ensureInitialized();
    const models = await this.getModelsFromStorage();
    const config = models[key];

    if (!config) {
      return undefined;
    }

    let textConfig: TextModelConfig

    // 检查是否已经是新格式
    if (isTextModelConfig(config)) {
      textConfig = config as TextModelConfig;
    }
    // 传统格式，转换为新格式
    else if (isLegacyConfig(config)) {
      textConfig = convertLegacyToTextModelConfig(key, config);
    }
    // 未知格式，尝试转换
    else {
      textConfig = convertLegacyToTextModelConfig(key, config as ModelConfig);
    }

    // 读时迁移：合并 customParamOverrides 到 paramOverrides
    return this.migrateConfig(textConfig)
  }

  /**
   * 添加模型配置（接受 TextModelConfig）
   */
  async addModel(key: string, config: TextModelConfig): Promise<void> {
    await this.ensureInitialized();
    this.validateTextModelConfig(config);

    // 保存时移除 customParamOverrides（已合并到 paramOverrides）
    const toStore = {
      ...config,
      customParamOverrides: undefined
    }

    await this.storage.updateData<Record<string, any>>(
      this.storageKey,
      (currentModels) => {
        // 使用存储中的数据，如果不存在则使用默认配置
        const models = currentModels || this.getDefaultModels();

        if (models[key]) {
          throw new ModelConfigError(`Model ${key} already exists`);
        }

        return {
          ...models,
          [key]: toStore // 存储清理后的配置
        };
      }
    );
  }

  /**
   * 更新模型配置（接受部分 TextModelConfig）
   */
  async updateModel(key: string, config: Partial<TextModelConfig>): Promise<void> {
    await this.ensureInitialized();

    await this.storage.updateData<Record<string, any>>(
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
          models[key] = defaults[key];
        }

        // 获取现有配置并转换为 TextModelConfig
        const existingConfig = models[key];
        let existingTextModelConfig: TextModelConfig;

        if (isTextModelConfig(existingConfig)) {
          existingTextModelConfig = existingConfig as TextModelConfig;
        } else if (isLegacyConfig(existingConfig)) {
          existingTextModelConfig = convertLegacyToTextModelConfig(key, existingConfig);
        } else {
          existingTextModelConfig = convertLegacyToTextModelConfig(key, existingConfig as ModelConfig);
        }

        // 合并配置
        const updatedConfig: TextModelConfig = {
          ...existingTextModelConfig,
          ...config,
          // 确保 enabled 属性存在
          enabled: config.enabled !== undefined ? config.enabled : existingTextModelConfig.enabled,
          // Deep merge connectionConfig
          connectionConfig: {
            ...existingTextModelConfig.connectionConfig,
            ...(config.connectionConfig || {})
          },
          // 处理 paramOverrides：如果明确传入了 paramOverrides，则直接替换而不是合并
          // 这样可以确保用户删除的参数不会被错误地保留
          paramOverrides: config.paramOverrides !== undefined
            ? config.paramOverrides
            : existingTextModelConfig.paramOverrides || {}
        };

        // 如果更新了关键字段，需要验证配置
        if (
          config.name !== undefined ||
          config.providerMeta !== undefined ||
          config.modelMeta !== undefined ||
          config.connectionConfig !== undefined ||
          config.paramOverrides !== undefined ||
          config.enabled
        ) {
          this.validateTextModelConfig(updatedConfig);
        }

        // 保存时移除 customParamOverrides（已合并到 paramOverrides）
        const toStore = {
          ...updatedConfig,
          customParamOverrides: undefined
        }

        // 返回完整的模型数据，确保所有模型都被保留
        return {
          ...models,
          [key]: toStore
        };
      }
    );
  }

  /**
   * 删除模型配置
   */
  async deleteModel(key: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage.updateData<Record<string, any>>(
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
    await this.storage.updateData<Record<string, any>>(
      this.storageKey,
      (currentModels) => {
        // 使用存储中的数据，如果不存在则使用默认配置
        const models = currentModels || this.getDefaultModels();

        if (!models[key]) {
          throw new ModelConfigError(`Unknown model: ${key}`);
        }

        // 获取现有配置并转换为 TextModelConfig
        const existingConfig = models[key];
        let textModelConfig: TextModelConfig;

        if (isTextModelConfig(existingConfig)) {
          textModelConfig = existingConfig as TextModelConfig;
        } else if (isLegacyConfig(existingConfig)) {
          textModelConfig = convertLegacyToTextModelConfig(key, existingConfig);
        } else {
          textModelConfig = convertLegacyToTextModelConfig(key, existingConfig as ModelConfig);
        }

        // 使用完整验证
        this.validateTextModelConfig(textModelConfig);

        return {
          ...models,
          [key]: {
            ...textModelConfig,
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
    await this.storage.updateData<Record<string, any>>(
      this.storageKey,
      (currentModels) => {
        // 使用存储中的数据，如果不存在则使用默认配置
        const models = currentModels || this.getDefaultModels();

        if (!models[key]) {
          throw new ModelConfigError(`Unknown model: ${key}`);
        }

        // 获取现有配置并转换为 TextModelConfig
        const existingConfig = models[key];
        let textModelConfig: TextModelConfig;

        if (isTextModelConfig(existingConfig)) {
          textModelConfig = existingConfig as TextModelConfig;
        } else if (isLegacyConfig(existingConfig)) {
          textModelConfig = convertLegacyToTextModelConfig(key, existingConfig);
        } else {
          textModelConfig = convertLegacyToTextModelConfig(key, existingConfig as ModelConfig);
        }

        return {
          ...models,
          [key]: {
            ...textModelConfig,
            enabled: false
          }
        };
      }
    );
  }

  /**
   * 判断是否应该自动启用内置模型
   * 条件：内置模型 + 存储的 apiKey 为空 + enabled 为 false + 新配置有 apiKey
   */
  private shouldAutoEnableBuiltinModel(
    modelId: string,
    storedConfig: TextModelConfig,
    defaultConfig: TextModelConfig
  ): boolean {
    // 1. 必须是内置模型
    const builtinIds = getBuiltinModelIds();
    if (!builtinIds.includes(modelId)) {
      return false;
    }

    // 2. 存储的配置必须是禁用状态
    if (storedConfig.enabled !== false) {
      return false;
    }

    // 3. 存储的 apiKey 必须为空
    const storedApiKey = storedConfig.connectionConfig?.apiKey?.trim() || '';
    if (storedApiKey !== '') {
      return false;
    }

    // 4. 新的默认配置必须有 apiKey
    const newApiKey = defaultConfig.connectionConfig?.apiKey?.trim() || '';
    if (newApiKey === '') {
      return false;
    }

    return true;
  }

  /**
   * 验证 TextModelConfig 配置
   */
  private validateTextModelConfig(config: TextModelConfig): void {
    const errors: string[] = [];

    if (!config.id) {
      errors.push('Missing configuration id');
    }
    if (!config.name) {
      errors.push('Missing model name (name)');
    }
    if (!config.providerMeta || !config.providerMeta.id) {
      errors.push('Missing or invalid provider metadata (providerMeta)');
    }
    if (!config.modelMeta || !config.modelMeta.id) {
      errors.push('Missing or invalid model metadata (modelMeta)');
    }
    if (!config.connectionConfig) {
      errors.push('Missing connection configuration (connectionConfig)');
    }

    // Validate paramOverrides & customParamOverrides structure
    if (config.paramOverrides !== undefined && (typeof config.paramOverrides !== 'object' || config.paramOverrides === null || Array.isArray(config.paramOverrides))) {
      errors.push('paramOverrides must be an object');
    }
    if (config.customParamOverrides !== undefined && (typeof config.customParamOverrides !== 'object' || config.customParamOverrides === null || Array.isArray(config.customParamOverrides))) {
      errors.push('customParamOverrides must be an object');
    }

    // Validate overrides content using unified schema
    const schema = config.modelMeta?.parameterDefinitions ?? [];
    const validation = validateOverrides({
      schema,
      overrides: config.paramOverrides,
      customOverrides: config.customParamOverrides,
      allowUnknown: true
    });

    if (validation.errors.length > 0) {
      validation.errors.forEach((error) => {
        errors.push(`Parameter ${error.parameterName}: ${error.message}`);
      });
    }

    if (validation.warnings.length > 0) {
      // warnings 不阻止保存，但在控制台提示
      validation.warnings.forEach((warning) => {
        console.warn(`[ModelManager] ${warning.message}`);
      });
    }

    if (errors.length > 0) {
      throw new ModelConfigError('Invalid TextModelConfig: ' + errors.join(', '));
    }
  }



  /**
   * 获取所有已启用的模型配置（返回 TextModelConfig）
   */
  async getEnabledModels(): Promise<TextModelConfig[]> {
    await this.ensureInitialized();
    const allModels = await this.getAllModels();
    return allModels.filter(model => model.enabled);
  }

  // 实现 IImportExportable 接口

  /**
   * 导出所有模型配置（返回 TextModelConfig）
   */
  async exportData(): Promise<TextModelConfig[]> {
    try {
      return await this.getAllModels();
    } catch (error) {
      throw new ImportExportError(
        'Failed to export model data',
        await this.getDataType(),
        error as Error,
        IMPORT_EXPORT_ERROR_CODES.EXPORT_FAILED,
      );
    }
  }

  /**
   * 导入模型配置（支持 TextModelConfig 和传统 ModelConfig）
   */
  async importData(data: any): Promise<void> {
    // 基本格式验证：必须是数组
    if (!Array.isArray(data)) {
      throw new ImportExportError(
        'Invalid model data format: data must be an array of model configurations',
        await this.getDataType(),
        undefined,
        IMPORT_EXPORT_ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const models = data as Array<TextModelConfig | (ModelConfig & { key: string })>;
    const failedModels: { model: any; error: Error }[] = [];

    // Import each model individually, capturing failures
    for (const model of models) {
      try {
        // 判断是新格式还是旧格式
        let textModelConfig: TextModelConfig;
        let key: string;

        if (isTextModelConfig(model)) {
          // 新格式：直接使用
          textModelConfig = model as TextModelConfig;
          key = textModelConfig.id;
        } else {
          // 旧格式：转换后使用
          const legacyModel = model as ModelConfig & { key: string };
          if (!legacyModel.key) {
            console.warn(`Skipping model without key:`, model);
            failedModels.push({ model, error: new Error('Missing key field') });
            continue;
          }
          key = legacyModel.key;
          textModelConfig = convertLegacyToTextModelConfig(key, legacyModel);
        }

        // 验证单个模型
        if (!this.validateSingleTextModel(textModelConfig)) {
          console.warn(`Skipping invalid model configuration:`, model);
          failedModels.push({ model, error: new Error('Invalid model configuration') });
          continue;
        }

        // 检查模型是否已存在
        const existingModel = await this.getModel(key);

        if (existingModel) {
          // 模型已存在，更新配置
          await this.updateModel(key, {
            ...textModelConfig,
            enabled: textModelConfig.enabled !== undefined ? textModelConfig.enabled : existingModel.enabled
          });
          console.log(`Model ${key} already exists, configuration updated`);
        } else {
          // 如果模型不存在，添加新模型
          await this.addModel(key, textModelConfig);
          console.log(`Imported new model ${key}`);
        }
      } catch (error) {
        console.warn(`Error importing model:`, error);
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
   * 验证模型数据格式（支持新旧格式）
   */
  async validateData(data: any): Promise<boolean> {
    if (!Array.isArray(data)) {
      return false;
    }

    return data.every(item => {
      // 检查是否为新格式
      if (isTextModelConfig(item)) {
        return this.validateSingleTextModel(item);
      }
      // 检查是否为旧格式
      return this.validateSingleModel(item);
    });
  }

  /**
   * 验证单个 TextModelConfig 配置
   */
  private validateSingleTextModel(item: any): boolean {
    return typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.enabled === 'boolean' &&
      item.providerMeta !== undefined &&
      typeof item.providerMeta === 'object' &&
      item.modelMeta !== undefined &&
      typeof item.modelMeta === 'object' &&
      item.connectionConfig !== undefined &&
      typeof item.connectionConfig === 'object';
  }

  /**
   * 验证单个传统模型配置
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
