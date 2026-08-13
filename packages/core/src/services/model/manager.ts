import { IModelManager, ModelConfig, TextModel, TextModelConfig, TextProvider } from './types';
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
import {
  getTextModelConfigIdentity,
  hasExplicitTextModelIdentity,
  hasTextModelMetadataIdentityMismatch,
  resolveTextModelMetadata
} from './metadata-resolver';

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
                const copiedExistingModel = { ...existingModel } as TextModelConfig;
                let updatedModel = this.patchBuiltinModelUpgrade(
                  key,
                  copiedExistingModel,
                  defaultConfig
                );
                let patched = false;

                if (updatedModel !== copiedExistingModel) {
                  updatedModels[key] = updatedModel;
                  hasUpdates = true;
                  console.log(`[ModelManager] Migrated legacy builtin model: ${key}`);
                }

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

                if (this.isDeepseekConfig(updatedModel)) {
                  try {
                    await this.getRegistry();
                    const patchedDeepseekModel = this.patchDeepseekConfig(updatedModel, defaultConfig);
                    if (patchedDeepseekModel !== updatedModel) {
                      updatedModel = patchedDeepseekModel;
                      updatedModels[key] = updatedModel;
                      hasUpdates = true;
                      console.log(`[ModelManager] Patched DeepSeek metadata for model: ${key}`);
                    }
                  } catch (error) {
                    console.warn(`[ModelManager] Failed to patch DeepSeek metadata for ${key}:`, error);
                  }
                }

                const backfillableFields = this.getBackfillableBuiltinConnectionFields(
                  key,
                  updatedModel,
                  defaultConfig
                );
                const shouldAutoEnable = this.shouldAutoEnableBuiltinModel(
                  key,
                  updatedModel,
                  defaultConfig,
                  backfillableFields
                );

                // 内置模型在环境变量新增后，需要把缺失的必填连接字段回填到已有存储配置中。
                if (backfillableFields.length > 0 || shouldAutoEnable) {
                  const nextConnectionConfig = {
                    ...(updatedModel.connectionConfig || {})
                  }
                  for (const field of backfillableFields) {
                    nextConnectionConfig[field] = defaultConfig.connectionConfig?.[field]
                  }

                  updatedModel = {
                    ...updatedModel,
                    connectionConfig: nextConnectionConfig,
                    enabled: shouldAutoEnable ? true : updatedModel.enabled
                  };
                  updatedModels[key] = updatedModel;
                  hasUpdates = true;
                  if (shouldAutoEnable) {
                    console.log(`[ModelManager] Auto-enabled builtin model with new connection fields: ${key}`);
                  } else {
                    console.log(`[ModelManager] Backfilled missing connection fields for builtin model: ${key}`);
                  }
                }
              } else if (isLegacyConfig(existingModel)) {
                // 旧格式，尝试使用 Registry 转换为新格式
                try {
                  const registry = await this.getRegistry();
                  const convertedModel = this.patchDeepseekConfig(
                    await convertLegacyToTextModelConfigWithRegistry(key, existingModel, registry),
                    defaultConfig
                  );
                  updatedModels[key] = convertedModel;
                  hasUpdates = true;
                  console.log(`[ModelManager] Converted legacy model to new format (via Registry): ${key}`);
                } catch (error) {
                  // Fallback 到硬编码转换
                  console.warn(`[ModelManager] Registry conversion failed for ${key}, using fallback:`, error);
                  const convertedModel = this.patchDeepseekConfig(
                    convertLegacyToTextModelConfig(key, existingModel),
                    defaultConfig
                  );
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

  private patchBuiltinModelUpgrade(
    key: string,
    config: TextModelConfig,
    defaultConfig: TextModelConfig
  ): TextModelConfig {
    const legacyDefaultIds: Record<string, readonly string[]> = {
      openai: ['gpt-5-mini'],
      gemini: ['gemini-2.5-flash'],
      anthropic: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514'],
      zhipu: ['glm-4.7'],
      dashscope: ['qwen3.5-27b'],
      grok: ['grok-4.3']
    };
    const currentModelId = config.modelId || config.modelMeta?.id;
    if (!currentModelId || !legacyDefaultIds[key]?.includes(currentModelId)) {
      return config;
    }

    const paramOverrides = {
      ...(defaultConfig.paramOverrides || {}),
      ...(config.paramOverrides || {})
    } as Record<string, unknown>;

    if (key === 'anthropic') {
      delete paramOverrides.thinking_budget_tokens;
      delete paramOverrides.temperature;
      delete paramOverrides.top_p;
      delete paramOverrides.top_k;
      paramOverrides.effort = paramOverrides.effort || 'high';
    } else if (key === 'gemini') {
      delete paramOverrides.temperature;
      delete paramOverrides.topP;
      delete paramOverrides.topK;
      delete paramOverrides.candidateCount;
      delete paramOverrides.thinkingBudget;
    } else if (key === 'grok' && paramOverrides.reasoning_effort === 'none') {
      paramOverrides.reasoning_effort = 'high';
    }

    return {
      ...config,
      modelId: defaultConfig.modelId,
      modelMeta: defaultConfig.modelMeta,
      paramOverrides
    };
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

  private isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private toOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined
  }

  private getProviderIdFromRaw(raw: Record<string, any>): string | undefined {
    const providerId = this.toOptionalString(raw.providerId)
      || this.toOptionalString(raw.providerMeta?.id)
      || this.toOptionalString(raw.modelMeta?.providerId)
      || this.toOptionalString(raw.provider)

    return providerId === 'custom' ? 'openai-compatible' : providerId
  }

  private getModelIdFromRaw(raw: Record<string, any>): string | undefined {
    return this.toOptionalString(raw.modelId)
      || this.toOptionalString(raw.modelMeta?.id)
      || this.toOptionalString(raw.defaultModel)
  }

  private createDisabledPlaceholderConfig(
    key: string,
    rawConfig: unknown,
    error?: unknown
  ): TextModelConfig {
    const raw = this.isRecord(rawConfig) ? rawConfig : {}
    const providerId = this.getProviderIdFromRaw(raw) || 'unknown'
    const modelId = this.toOptionalString(raw.modelId)
      || this.toOptionalString(raw.modelMeta?.id)
      || this.toOptionalString(raw.defaultModel)
      || 'unknown'
    const providerMeta = this.resolvePlaceholderProviderMeta(providerId, raw.providerMeta)
    const modelMeta = this.resolvePlaceholderModelMeta(providerId, modelId, raw.modelMeta)
    const connectionConfig = this.isRecord(raw.connectionConfig)
      ? { ...raw.connectionConfig }
      : {
          ...(this.toOptionalString(raw.apiKey) ? { apiKey: raw.apiKey } : {}),
          ...(this.toOptionalString(raw.baseURL) ? { baseURL: raw.baseURL } : {})
        }
    const paramOverrides = this.isRecord(raw.paramOverrides)
      ? { ...raw.paramOverrides }
      : this.isRecord(raw.llmParams)
        ? { ...raw.llmParams }
        : {}

    console.warn(
      `[ModelManager] Failed to normalize model config ${key}, returning disabled placeholder:`,
      error
    )

    return {
      id: this.toOptionalString(raw.id) || key,
      name: this.toOptionalString(raw.name) || `Invalid Model (${key})`,
      enabled: false,
      providerId,
      modelId,
      providerMeta,
      modelMeta,
      connectionConfig,
      paramOverrides
    }
  }

  private buildDefaultBackfilledConfig(
    key: string,
    rawConfig: unknown
  ): TextModelConfig | null {
    if (!this.isRecord(rawConfig)) {
      return null
    }

    const defaultConfig = this.getDefaultModels()[key]
    if (!defaultConfig) {
      return null
    }

    const providerId = this.getProviderIdFromRaw(rawConfig)
      || defaultConfig.providerId
      || defaultConfig.providerMeta.id
    const modelId = this.getModelIdFromRaw(rawConfig)
      || defaultConfig.modelId
      || defaultConfig.modelMeta.id
    const repairedConfig = {
      ...defaultConfig,
      ...rawConfig,
      id: this.toOptionalString(rawConfig.id) || defaultConfig.id,
      name: this.toOptionalString(rawConfig.name) || defaultConfig.name,
      enabled: typeof rawConfig.enabled === 'boolean' ? rawConfig.enabled : defaultConfig.enabled,
      providerId,
      modelId,
      providerMeta: this.isRecord(rawConfig.providerMeta) && rawConfig.providerMeta.id === providerId
        ? rawConfig.providerMeta as TextProvider
        : defaultConfig.providerMeta,
      modelMeta: this.isRecord(rawConfig.modelMeta) && rawConfig.modelMeta.id === modelId && rawConfig.modelMeta.providerId === providerId
        ? rawConfig.modelMeta as TextModel
        : defaultConfig.modelMeta,
      connectionConfig: this.isRecord(rawConfig.connectionConfig)
        ? { ...defaultConfig.connectionConfig, ...rawConfig.connectionConfig }
        : { ...defaultConfig.connectionConfig },
      paramOverrides: this.isRecord(rawConfig.paramOverrides)
        ? { ...rawConfig.paramOverrides }
        : defaultConfig.paramOverrides,
      customParamOverrides: this.isRecord(rawConfig.customParamOverrides)
        ? { ...rawConfig.customParamOverrides }
        : defaultConfig.customParamOverrides
    }

    return this.migrateConfig(repairedConfig)
  }

  private resolvePlaceholderProviderMeta(
    providerId: string,
    existingProviderMeta: unknown
  ): TextProvider {
    if (this.isRecord(existingProviderMeta) && existingProviderMeta.id === providerId) {
      return {
        id: providerId,
        name: this.toOptionalString(existingProviderMeta.name) || providerId,
        description: this.toOptionalString(existingProviderMeta.description),
        corsRestricted: existingProviderMeta.corsRestricted,
        requiresApiKey: !!existingProviderMeta.requiresApiKey,
        defaultBaseURL: this.toOptionalString(existingProviderMeta.defaultBaseURL) || '',
        supportsDynamicModels: !!existingProviderMeta.supportsDynamicModels,
        connectionSchema: this.isRecord(existingProviderMeta.connectionSchema)
          ? existingProviderMeta.connectionSchema as TextProvider['connectionSchema']
          : { required: [], optional: [], fieldTypes: {} },
        apiKeyUrl: this.toOptionalString(existingProviderMeta.apiKeyUrl)
      }
    }

    try {
      return this.registry?.getAdapter(providerId).getProvider() || this.getUnknownProviderMeta(providerId)
    } catch {
      return this.getUnknownProviderMeta(providerId)
    }
  }

  private resolvePlaceholderModelMeta(
    providerId: string,
    modelId: string,
    existingModelMeta: unknown
  ): TextModel {
    if (
      this.isRecord(existingModelMeta) &&
      existingModelMeta.id === modelId &&
      existingModelMeta.providerId === providerId
    ) {
      return {
        id: modelId,
        name: this.toOptionalString(existingModelMeta.name) || modelId,
        description: this.toOptionalString(existingModelMeta.description),
        providerId,
        capabilities: this.isRecord(existingModelMeta.capabilities)
          ? existingModelMeta.capabilities as TextModel['capabilities']
          : { supportsTools: false },
        parameterDefinitions: Array.isArray(existingModelMeta.parameterDefinitions)
          ? existingModelMeta.parameterDefinitions
          : [],
        defaultParameterValues: this.isRecord(existingModelMeta.defaultParameterValues)
          ? existingModelMeta.defaultParameterValues
          : {}
      }
    }

    try {
      const adapter = this.registry?.getAdapter(providerId)
      return adapter?.getModels().find((model) => model.id === modelId)
        || adapter?.buildDefaultModel(modelId)
        || this.getUnknownModelMeta(providerId, modelId)
    } catch {
      return this.getUnknownModelMeta(providerId, modelId)
    }
  }

  private getUnknownProviderMeta(providerId: string): TextProvider {
    return {
      id: providerId,
      name: providerId === 'unknown' ? 'Unknown Provider' : `Unknown Provider (${providerId})`,
      description: 'This configuration could not be normalized. Please edit or delete it.',
      requiresApiKey: false,
      defaultBaseURL: '',
      supportsDynamicModels: false,
      connectionSchema: { required: [], optional: [], fieldTypes: {} }
    }
  }

  private getUnknownModelMeta(providerId: string, modelId: string): TextModel {
    return {
      id: modelId,
      name: modelId === 'unknown' ? 'Unknown Model' : `Unknown Model (${modelId})`,
      description: 'This configuration could not be normalized. Please edit or delete it.',
      providerId,
      capabilities: {
        supportsTools: false
      },
      parameterDefinitions: [],
      defaultParameterValues: {}
    }
  }

  private normalizeStoredTextModelConfig(
    key: string,
    rawConfig: unknown,
    registry: ITextAdapterRegistry
  ): TextModelConfig {
    try {
      let textConfig: TextModelConfig

      if (isTextModelConfig(rawConfig)) {
        textConfig = rawConfig as TextModelConfig;
      } else if (isLegacyConfig(rawConfig)) {
        textConfig = convertLegacyToTextModelConfig(key, rawConfig);
      } else {
        textConfig = convertLegacyToTextModelConfig(key, rawConfig as ModelConfig);
      }

      const migrated = this.migrateConfig(textConfig)
      return this.normalizeTextModelConfig(
        this.patchProviderMeta(this.patchDeepseekConfig(migrated)),
        registry,
        { allowLegacyMetadataMismatch: true }
      )
    } catch (error) {
      const defaultBackfilledConfig = this.buildDefaultBackfilledConfig(key, rawConfig)
      if (defaultBackfilledConfig) {
        try {
          return this.normalizeTextModelConfig(
            this.patchProviderMeta(this.patchDeepseekConfig(defaultBackfilledConfig)),
            registry,
            { allowLegacyMetadataMismatch: true }
          )
        } catch (repairError) {
          console.warn(
            `[ModelManager] Failed to repair default model config ${key}, returning disabled placeholder:`,
            repairError
          )
        }
      }

      return this.createDisabledPlaceholderConfig(key, rawConfig, error)
    }
  }

  private normalizeTextModelConfig(
    config: Partial<TextModelConfig> & Pick<TextModelConfig, 'id' | 'name' | 'enabled'>,
    registry: ITextAdapterRegistry,
    options: { allowLegacyMetadataMismatch?: boolean } = {}
  ): TextModelConfig {
    const identity = getTextModelConfigIdentity(config)

    if (!identity) {
      throw new ModelConfigError('Missing provider/model identity')
    }

    const hasIncomingMismatch = hasTextModelMetadataIdentityMismatch(
      config.providerMeta,
      config.modelMeta
    )
    if (
      hasIncomingMismatch &&
      !hasExplicitTextModelIdentity(config) &&
      !options.allowLegacyMetadataMismatch
    ) {
      throw new ModelConfigError(
        `Provider/model metadata mismatch: providerMeta.id '${config.providerMeta?.id}' does not match modelMeta.providerId '${config.modelMeta?.providerId}'`
      )
    }

    const { providerMeta, modelMeta } = resolveTextModelMetadata({
      providerId: identity.providerId,
      modelId: identity.modelId,
      registry,
      existingProviderMeta: config.providerMeta,
      existingModelMeta: config.modelMeta
    })

    return {
      ...config,
      providerId: identity.providerId,
      modelId: identity.modelId,
      providerMeta,
      modelMeta,
      connectionConfig: config.connectionConfig || {},
      paramOverrides: config.paramOverrides
    }
  }

  /**
   * 旧存储数据里 providerMeta 可能缺少新字段；用当前 adapter 的 provider 元数据补齐。
   *
   * 目前主要用于回填 `corsRestricted`，以便 UI 能正确展示 CORS 受限标签。
   */
  private patchProviderMeta(config: TextModelConfig): TextModelConfig {
    const providerMeta = config.providerMeta
    if (!providerMeta) {
      return config
    }

    const providerId = (config.providerId || providerMeta.id || config.modelMeta?.providerId || '').toLowerCase()

    // Historical metadata might incorrectly mark Ollama as CORS-restricted.
    // Ollama can be configured (CORS/reverse-proxy), so we force-disable the tag.
    if (providerId === 'ollama') {
      if (providerMeta.corsRestricted === false) {
        return config
      }
      return {
        ...config,
        providerMeta: {
          ...providerMeta,
          corsRestricted: false
        }
      }
    }

    if (providerMeta.corsRestricted !== undefined) {
      return config
    }

    try {
      if (!providerId || !this.registry) {
        return config
      }

      const latestProvider = this.registry.getAdapter(providerId).getProvider()
      if (latestProvider.corsRestricted === undefined) {
        return config
      }

      return {
        ...config,
        providerMeta: {
          ...providerMeta,
          corsRestricted: latestProvider.corsRestricted
        }
      }
    } catch {
      return config
    }
  }

  private isDeepseekConfig(config: TextModelConfig): boolean {
    const providerId = (
      config.providerId ||
      config.providerMeta?.id ||
      config.modelMeta?.providerId ||
      ''
    ).toLowerCase()

    return providerId === 'deepseek'
  }

  private patchDeepseekConfig(
    config: TextModelConfig,
    defaultConfig?: TextModelConfig
  ): TextModelConfig {
    if (!this.isDeepseekConfig(config)) {
      return config
    }

    const isBuiltinDeepseek = config.id === 'deepseek'
    const currentModelId = config.modelMeta?.id
    const migratedModelId = isBuiltinDeepseek
      ? this.getMigratedDeepseekModelId(currentModelId)
      : currentModelId

    const modelMeta = this.getDeepseekModelMeta(migratedModelId, defaultConfig)
    if (!modelMeta) {
      return config
    }

    const nextParamOverrides = this.patchDeepseekParamOverrides(
      config.paramOverrides,
      isBuiltinDeepseek,
      currentModelId
    )

    const currentParameterNames = (config.modelMeta?.parameterDefinitions || [])
      .map((definition) => definition.name)
      .join(',')
    const nextParameterNames = modelMeta.parameterDefinitions
      .map((definition) => definition.name)
      .join(',')

    const shouldUpdateModelMeta =
      !config.modelMeta ||
      config.modelMeta.id !== modelMeta.id ||
      currentParameterNames !== nextParameterNames ||
      JSON.stringify(config.modelMeta.defaultParameterValues || {}) !== JSON.stringify(modelMeta.defaultParameterValues || {})
    const shouldUpdateParams =
      JSON.stringify(config.paramOverrides || {}) !== JSON.stringify(nextParamOverrides)

    if (!shouldUpdateModelMeta && !shouldUpdateParams) {
      return config
    }

    return {
      ...config,
      providerId: 'deepseek',
      modelId: isBuiltinDeepseek ? modelMeta.id : (config.modelId || config.modelMeta?.id),
      modelMeta: isBuiltinDeepseek
        ? modelMeta
        : {
            ...config.modelMeta,
            parameterDefinitions: modelMeta.parameterDefinitions,
            defaultParameterValues: modelMeta.defaultParameterValues
          },
      paramOverrides: nextParamOverrides
    }
  }

  private getMigratedDeepseekModelId(modelId: string | undefined): string {
    if (modelId === 'deepseek-reasoner') {
      return 'deepseek-v4-pro'
    }

    if (!modelId || modelId === 'deepseek-chat') {
      return 'deepseek-v4-flash'
    }

    return modelId
  }

  private getDeepseekModelMeta(
    modelId: string | undefined,
    defaultConfig?: TextModelConfig
  ): TextModelConfig['modelMeta'] | undefined {
    const targetModelId = modelId || 'deepseek-v4-flash'

    try {
      const adapter = this.registry?.getAdapter('deepseek')
      if (adapter) {
        return adapter.getModels().find((model) => model.id === targetModelId)
          || adapter.buildDefaultModel(targetModelId)
      }
    } catch {
      // Fall through to the default metadata snapshot.
    }

    if (
      defaultConfig?.providerMeta?.id === 'deepseek' &&
      defaultConfig.modelMeta.id === targetModelId
    ) {
      return defaultConfig.modelMeta
    }

    return undefined
  }

  private patchDeepseekParamOverrides(
    paramOverrides: Record<string, unknown> | undefined,
    isBuiltinDeepseek: boolean,
    currentModelId: string | undefined
  ): Record<string, unknown> {
    const nextParamOverrides = { ...(paramOverrides || {}) }

    if (nextParamOverrides.thinking_type === undefined) {
      nextParamOverrides.thinking_type =
        isBuiltinDeepseek && currentModelId === 'deepseek-reasoner'
          ? 'enabled'
          : 'disabled'
    }

    if (
      isBuiltinDeepseek &&
      currentModelId === 'deepseek-reasoner' &&
      nextParamOverrides.reasoning_effort === undefined
    ) {
      nextParamOverrides.reasoning_effort = 'high'
    }

    return nextParamOverrides
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
    const registry = await this.getRegistry()

    return Object.entries(models).map(([key, config]) =>
      this.normalizeStoredTextModelConfig(key, config, registry)
    )
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

    const registry = await this.getRegistry()
    return this.normalizeStoredTextModelConfig(key, config, registry)
  }

  /**
   * 添加模型配置（接受 TextModelConfig）
   */
  async addModel(key: string, config: TextModelConfig): Promise<void> {
    await this.ensureInitialized();
    const registry = await this.getRegistry();
    const normalizedConfig = this.normalizeTextModelConfig(config, registry);
    this.validateTextModelConfig(normalizedConfig);

    // 保存时移除 customParamOverrides（已合并到 paramOverrides）
    const toStore = {
      ...normalizedConfig,
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
    const registry = await this.getRegistry();

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

        if (
          !hasExplicitTextModelIdentity(config) &&
          config.providerMeta &&
          !config.modelMeta &&
          hasTextModelMetadataIdentityMismatch(config.providerMeta, existingTextModelConfig.modelMeta)
        ) {
          throw new ModelConfigError(
            `Provider/model metadata mismatch: providerMeta.id '${config.providerMeta.id}' does not match modelMeta.providerId '${existingTextModelConfig.modelMeta?.providerId}'`
          );
        }

        // 合并配置
        const updatedConfig: TextModelConfig = {
          ...existingTextModelConfig,
          ...config,
          providerId: config.providerId
            ?? config.providerMeta?.id
            ?? config.modelMeta?.providerId
            ?? existingTextModelConfig.providerId
            ?? existingTextModelConfig.providerMeta?.id
            ?? existingTextModelConfig.modelMeta?.providerId,
          modelId: config.modelId
            ?? config.modelMeta?.id
            ?? existingTextModelConfig.modelId
            ?? existingTextModelConfig.modelMeta?.id,
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

        const normalizedConfig = this.normalizeTextModelConfig(updatedConfig, registry);

        // 如果更新了关键字段，需要验证配置
        if (
          config.name !== undefined ||
          config.providerId !== undefined ||
          config.modelId !== undefined ||
          config.providerMeta !== undefined ||
          config.modelMeta !== undefined ||
          config.connectionConfig !== undefined ||
          config.paramOverrides !== undefined ||
          config.enabled
        ) {
          this.validateTextModelConfig(normalizedConfig);
        }

        // 保存时移除 customParamOverrides（已合并到 paramOverrides）
        const toStore = {
          ...normalizedConfig,
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
    const registry = await this.getRegistry();
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

        textModelConfig = this.normalizeTextModelConfig(
          textModelConfig,
          registry,
          { allowLegacyMetadataMismatch: true }
        );
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
    const registry = await this.getRegistry();
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
        textModelConfig = this.normalizeTextModelConfig(
          textModelConfig,
          registry,
          { allowLegacyMetadataMismatch: true }
        );

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
   * 获取可从默认配置回填到内置模型中的缺失必填连接字段
   */
  private getBackfillableBuiltinConnectionFields(
    modelId: string,
    storedConfig: TextModelConfig,
    defaultConfig: TextModelConfig
  ): string[] {
    const builtinIds = getBuiltinModelIds();
    if (!builtinIds.includes(modelId)) {
      return [];
    }

    const requiredFields = defaultConfig.providerMeta.connectionSchema?.required || ['apiKey'];
    return requiredFields.filter((field) => {
      const storedValue = storedConfig.connectionConfig?.[field];
      const defaultValue = defaultConfig.connectionConfig?.[field];
      return !this.hasConnectionValue(storedValue) && this.hasConnectionValue(defaultValue);
    });
  }

  /**
   * 判断是否应该自动启用内置模型
   * 条件：内置模型 + 存储的配置为 disabled + 回填后能满足所有必填连接字段
   */
  private shouldAutoEnableBuiltinModel(
    modelId: string,
    storedConfig: TextModelConfig,
    defaultConfig: TextModelConfig,
    backfillableFields?: string[]
  ): boolean {
    const builtinIds = getBuiltinModelIds();
    if (!builtinIds.includes(modelId)) {
      return false;
    }

    if (storedConfig.enabled !== false) {
      return false;
    }

    const fieldsToBackfill = backfillableFields ?? this.getBackfillableBuiltinConnectionFields(modelId, storedConfig, defaultConfig);
    if (fieldsToBackfill.length === 0) {
      return false;
    }

    const requiredFields = defaultConfig.providerMeta.connectionSchema?.required || ['apiKey'];
    const mergedConnectionConfig: Record<string, unknown> = {
      ...(storedConfig.connectionConfig || {})
    };
    for (const field of fieldsToBackfill) {
      mergedConnectionConfig[field] = defaultConfig.connectionConfig?.[field];
    }

    return requiredFields.every((field) => this.hasConnectionValue(mergedConnectionConfig[field]));
  }

  private hasConnectionValue(value: unknown): boolean {
    return typeof value === 'string' ? value.trim().length > 0 : !!value;
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
    if (hasTextModelMetadataIdentityMismatch(config.providerMeta, config.modelMeta)) {
      errors.push(
        `Provider/model metadata mismatch: providerMeta.id '${config.providerMeta?.id}' does not match modelMeta.providerId '${config.modelMeta?.providerId}'`
      );
    }
    if (config.providerId && config.providerMeta?.id && config.providerId !== config.providerMeta.id) {
      errors.push(
        `Provider identity mismatch: providerId '${config.providerId}' does not match providerMeta.id '${config.providerMeta.id}'`
      );
    }
    if (config.modelId && config.modelMeta?.id && config.modelId !== config.modelMeta.id) {
      errors.push(
        `Model identity mismatch: modelId '${config.modelId}' does not match modelMeta.id '${config.modelMeta.id}'`
      );
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

        if (isTextModelConfig(model) || this.validateSingleTextModel(model)) {
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
      if (isTextModelConfig(item) || this.validateSingleTextModel(item)) {
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
    const hasMetadata =
      item.providerMeta !== undefined &&
      typeof item.providerMeta === 'object' &&
      item.modelMeta !== undefined &&
      typeof item.modelMeta === 'object';
    const hasIdentity =
      typeof item.providerId === 'string' &&
      typeof item.modelId === 'string';

    return typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.enabled === 'boolean' &&
      (hasMetadata || hasIdentity) &&
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
