import {
  IImageModelManager,
  ImageModelConfig,
  ImageModelConfigInput,
  IImageAdapterRegistry
} from '../image/types'
import { IStorageProvider } from '../storage/types'
import { StorageAdapter } from '../storage/adapter'
import { CORE_SERVICE_KEYS } from '../../constants/storage-keys'
import { ImportExportError } from '../../interfaces/import-export'
import { IMAGE_ERROR_CODES, IMPORT_EXPORT_ERROR_CODES, type ErrorParams } from '../../constants/error-codes'
import { BaseError } from '../llm/errors'
import { getDefaultImageModels, getBuiltinImageConfigIds } from './defaults'

class ImageModelManagerError extends BaseError {
  constructor(code: string, message?: string, params?: ErrorParams) {
    super(code, message, params)
  }
}

/**
 * 图像模型管理器：专注于配置管理，遵循新的三层架构
 * 负责ImageModelConfig的CRUD操作和组合查询
 */
export class ImageModelManager implements IImageModelManager {
  private readonly storageKey = CORE_SERVICE_KEYS.IMAGE_MODELS
  private readonly storage: IStorageProvider
  private readonly registry: IImageAdapterRegistry
  private initPromise: Promise<void> | null = null

  constructor(storageProvider: IStorageProvider, registry: IImageAdapterRegistry) {
    this.storage = new StorageAdapter(storageProvider)
    this.registry = registry
  }

  // === 初始化（写入默认配置） ===
  public async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.init()
    }
    return this.initPromise
  }

  public async isInitialized(): Promise<boolean> {
    const raw = await this.storage.getItem(this.storageKey)
    return !!raw
  }

  private async init(): Promise<void> {
    try {
      const raw = await this.storage.getItem(this.storageKey)
      if (!raw) {
        // 没有任何配置，直接写入默认项
        const defaults = getDefaultImageModels(this.registry)
        await this.storage.setItem(this.storageKey, JSON.stringify(defaults))
        return
      }

      // 已有配置：补齐缺失的默认项（不覆盖用户已有）
      let data: Record<string, ImageModelConfig>
      try {
        data = JSON.parse(raw) || {}
      } catch {
        data = {}
      }
      // 轻量迁移：为旧数据补齐缺失的 id（仅填充 id，不推导 provider/model）
      // 说明：旧数据仅存在于开发阶段，不再做字段补齐（如 providerId/modelId/provider/model）。
      // 目的仅为让 UI 能识别并删除这些条目，避免因缺少 id 无法操作。
      let changed = false
      for (const [key, cfg] of Object.entries(data)) {
        if (cfg && typeof cfg === 'object' && !(cfg as any).id) {
          ;(cfg as any).id = key
          changed = true
        }
      }
      const defaults = getDefaultImageModels(this.registry)
      // 合并默认项，并检查是否需要自动启用内置模型
      for (const [key, cfg] of Object.entries(defaults)) {
        if (!data[key]) {
          // 添加缺失的默认模型
          data[key] = cfg
          changed = true
        } else {
          let existingConfig = data[key]
          const upgradedConfig = this.patchBuiltinModelUpgrade(key, existingConfig, cfg)
          if (upgradedConfig !== existingConfig) {
            existingConfig = upgradedConfig
            data[key] = upgradedConfig
            changed = true
            console.log(`[ImageModelManager] Migrated legacy builtin model: ${key}`)
          }
          const backfillableFields = this.getBackfillableBuiltinConnectionFields(
            key,
            existingConfig,
            cfg
          )
          const shouldAutoEnable = this.shouldAutoEnableBuiltinModel(
            key,
            existingConfig,
            cfg,
            backfillableFields
          )

          if (backfillableFields.length > 0 || shouldAutoEnable) {
            const nextConnectionConfig = {
              ...(existingConfig.connectionConfig || {})
            }
            for (const field of backfillableFields) {
              nextConnectionConfig[field] = cfg.connectionConfig?.[field]
            }

            data[key] = {
              ...existingConfig,
              connectionConfig: nextConnectionConfig,
              enabled: shouldAutoEnable ? true : existingConfig.enabled
            }
            changed = true
            if (shouldAutoEnable) {
              console.log(`[ImageModelManager] Auto-enabled builtin model with new connection fields: ${key}`)
            } else {
              console.log(`[ImageModelManager] Backfilled missing connection fields for builtin model: ${key}`)
            }
          }
        }
      }

      if (changed) {
        await this.storage.setItem(this.storageKey, JSON.stringify(data))
      }
    } catch (e) {
      // 初始化失败时，尽量写入默认项，避免空列表
      try {
        const defaults = getDefaultImageModels(this.registry)
        await this.storage.setItem(this.storageKey, JSON.stringify(defaults))
      } catch {}
    }
  }

  private patchBuiltinModelUpgrade(
    key: string,
    config: ImageModelConfig,
    defaultConfig: ImageModelConfig
  ): ImageModelConfig {
    const legacyDefaultIds: Record<string, readonly string[]> = {
      'image-gemini-nanobanana': ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview'],
      'image-dashscope': ['qwen-image'],
      'image-seedream-50-lite': ['doubao-seedream-5-0-260128']
    }
    const currentModelId = config.modelId || config.model?.id
    if (!currentModelId || !legacyDefaultIds[key]?.includes(currentModelId)) {
      return config
    }

    return {
      ...config,
      modelId: defaultConfig.modelId,
      model: defaultConfig.model,
      paramOverrides: {
        ...(defaultConfig.paramOverrides || {}),
        ...(config.paramOverrides || {})
      }
    }
  }

  // === 配置 CRUD 操作 ===

  async addConfig(config: ImageModelConfigInput): Promise<void> {
    // 确保配置是自包含的
    const completeConfig = this.ensureSelfContained(config)
    this.validateConfig(completeConfig)

    // 保存时移除 customParamOverrides（已合并到 paramOverrides）
    const toStore = {
      ...completeConfig,
      customParamOverrides: undefined
    }

    await this.storage.updateData<Record<string, ImageModelConfig>>(
      this.storageKey,
      (current) => {
        const data = current || {}
        if (data[toStore.id]) {
          throw new ImageModelManagerError(
            IMAGE_ERROR_CODES.CONFIG_ALREADY_EXISTS,
            undefined,
            { configId: toStore.id },
          )
        }
        return { ...data, [toStore.id]: toStore }
      }
    )
  }

  async updateConfig(id: string, updates: Partial<ImageModelConfigInput>): Promise<void> {
    await this.storage.updateData<Record<string, ImageModelConfig>>(
      this.storageKey,
      (current) => {
        const data = current || {}
        if (!data[id]) {
          throw new ImageModelManagerError(
            IMAGE_ERROR_CODES.CONFIG_DOES_NOT_EXIST,
            undefined,
            { configId: id },
          )
        }

        const updated: ImageModelConfig = {
          ...data[id],
          ...updates,
          id: data[id].id // 保护id不被更新
        }

        // 确保更新后的配置是自包含的
        const completeConfig = this.ensureSelfContained(updated)
        this.validateConfig(completeConfig)

        // 保存时移除 customParamOverrides（已合并到 paramOverrides）
        const toStore = {
          ...completeConfig,
          customParamOverrides: undefined
        }

        return { ...data, [id]: toStore }
      }
    )
  }

  async deleteConfig(id: string): Promise<void> {
    await this.storage.updateData<Record<string, ImageModelConfig>>(
      this.storageKey,
      (current) => {
        const data = current || {}

        // 强制删除：无论配置是否存在都尝试删除
        // 这确保损坏的配置也能被清理
        if (!data[id]) {
          console.warn(`[ImageModelManager] Config ${id} not found in storage, but proceeding anyway`)
          // 仍然返回原数据，因为确实没什么可删的
          return data
        }

        // 配置存在，正常删除
        const { [id]: removed, ...rest } = data
        console.log(`[ImageModelManager] Successfully deleted config: ${id}`)
        return rest
      }
    )
  }

  async getConfig(id: string): Promise<ImageModelConfig | null> {
    const raw = await this.storage.getItem(this.storageKey)
    const data: Record<string, ImageModelConfig> = raw ? JSON.parse(raw) : {}
    const cfg = data[id]
    if (!cfg) return null

    // 轻量迁移兜底：返回前补齐缺失的 id，避免 UI 无法删除
    if (!(cfg as any).id) {
      ;(cfg as any).id = id
    }

    // 读时迁移：合并 customParamOverrides 到 paramOverrides
    const migrated = this.migrateConfig(cfg)

    // 尝试修复损坏的配置，确保能够正常读取和删除
    try {
      return this.ensureSelfContained(migrated)
    } catch (error) {
      // 即使修复失败，也返回配置（已在ensureSelfContained中标记为disabled）
      console.warn(`[ImageModelManager] Failed to fully repair config ${id}, but returning for deletion:`, error)
      return migrated
    }
  }

  async getAllConfigs(): Promise<ImageModelConfig[]> {
    const raw = await this.storage.getItem(this.storageKey)
    const data: Record<string, ImageModelConfig> = raw ? JSON.parse(raw) : {}

    // 轻量迁移兜底：为缺失 id 的旧记录补齐 id，并尝试修复损坏的配置
    return Object.entries(data).map(([key, cfg]) => {
      if (!cfg || typeof cfg !== 'object') {
        return null
      }

      // 始终使用存储键作为公开的 id，保持删除等操作一致
      ;(cfg as any).id = key

      // 读时迁移：合并 customParamOverrides 到 paramOverrides
      const migrated = this.migrateConfig(cfg)

      // 尝试修复配置，如果失败则返回占位配置（标记为disabled）
      try {
        return this.ensureSelfContained(migrated)
      } catch (error) {
        console.warn(`[ImageModelManager] Failed to repair config ${key}, returning placeholder:`, error)
        // 返回最小占位配置，确保能在UI中显示和删除
        return {
          ...migrated,
          id: key,
          enabled: false
        } as ImageModelConfig
      }
    }).filter((cfg): cfg is ImageModelConfig => cfg !== null)
  }

  async getEnabledConfigs(): Promise<ImageModelConfig[]> {
    const all = await this.getAllConfigs()
    return all.filter(config => config.enabled)
  }

  // === 导入导出 ===

  async exportData(): Promise<ImageModelConfig[]> {
    try {
      return await this.getAllConfigs()
    } catch (error) {
      throw new ImportExportError(
        'Failed to export image model configurations',
        await this.getDataType(),
        error as Error,
        IMPORT_EXPORT_ERROR_CODES.EXPORT_FAILED,
      )
    }
  }

  async importData(data: any): Promise<void> {
    if (!Array.isArray(data)) {
      throw new ImportExportError(
        'Invalid data format: expected array of ImageModelConfig',
        await this.getDataType(),
        undefined,
        IMPORT_EXPORT_ERROR_CODES.VALIDATION_ERROR,
      )
    }

    const configs = data as ImageModelConfigInput[]
    const failed: { config: ImageModelConfigInput, error: Error }[] = []

    for (const config of configs) {
      try {
        const completeConfig = this.ensureSelfContained(config)
        this.validateConfig(completeConfig)

        // 检查是否已存在
        const existing = await this.getConfig(completeConfig.id)
        if (existing) {
          // 更新现有配置
          await this.updateConfig(completeConfig.id, completeConfig)
        } else {
          // 添加新配置
          await this.addConfig(completeConfig)
        }
      } catch (error) {
        failed.push({ config, error: error as Error })
      }
    }

    if (failed.length > 0) {
      console.warn(`[ImageModelManager] Failed to import ${failed.length} configurations`)
      // 可以选择抛出异常或者只记录警告
    }
  }

  async getDataType(): Promise<string> {
    return 'image-model-configs'
  }

  async validateData(data: any): Promise<boolean> {
    if (!Array.isArray(data)) {
      return false
    }

    return data.every(item => {
      try {
        this.validateConfig(this.ensureSelfContained(item))
        return true
      } catch {
        return false
      }
    })
  }

  // === 私有辅助方法 ===

  /**
   * 迁移配置：合并 customParamOverrides 到 paramOverrides
   * 用于向后兼容读取旧数据格式
   */
  private migrateConfig(config: ImageModelConfig): ImageModelConfig {
    // 如果没有 customParamOverrides，直接返回
    if (!config.customParamOverrides || Object.keys(config.customParamOverrides).length === 0) {
      return config
    }

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

  private getConfigIdentity(config: ImageModelConfigInput): { providerId: string, modelId: string } {
    const providerId = config.providerId || config.provider?.id || config.model?.providerId
    const modelId = config.modelId || config.model?.id

    if (!providerId || !modelId) {
      throw new ImageModelManagerError(
        IMAGE_ERROR_CODES.CONFIG_INVALID,
        'Missing provider/model identity',
        { details: 'Missing providerId/modelId' },
      )
    }

    return { providerId, modelId }
  }

  // 确保配置是自包含的（包含完整的provider和model信息）
  private ensureSelfContained(config: ImageModelConfigInput): ImageModelConfig {
    let identity: { providerId: string, modelId: string }

    try {
      identity = this.getConfigIdentity(config)
    } catch (error) {
      console.warn(`[ImageModelManager] Cannot infer identity for config ${config.id}, marking as disabled:`, error)
      identity = {
        providerId: config.provider?.id || config.model?.providerId || 'unknown',
        modelId: config.model?.id || 'unknown'
      }
    }

    const baseConfig = {
      ...config,
      providerId: identity.providerId,
      modelId: identity.modelId,
      paramOverrides: config.paramOverrides ?? {}
    }

    try {
      const adapter = this.registry.getAdapter(identity.providerId)
      const latestProvider = adapter.getProvider()
      const latestStaticModel = this.registry
        .getStaticModels(identity.providerId)
        .find(model => model.id === identity.modelId)
      const storedModelMatchesIdentity =
        config.model?.id === identity.modelId &&
        config.model.providerId === identity.providerId
      const resolvedModel = latestStaticModel
        ? {
            ...(storedModelMatchesIdentity ? config.model : {}),
            ...latestStaticModel
          }
        : storedModelMatchesIdentity && config.model
          ? config.model
          : adapter.buildDefaultModel(identity.modelId)

      let completeConfig: ImageModelConfig = {
        ...baseConfig,
        provider: {
          ...(config.provider?.id === identity.providerId ? config.provider : {}),
          ...latestProvider
        },
        model: resolvedModel
      }

      const providerId = (completeConfig.provider.id || completeConfig.providerId || '').toLowerCase()

      // Historical metadata might incorrectly mark Ollama as CORS-restricted.
      // Ollama can be configured (CORS/reverse-proxy), so we force-disable the tag.
      if (providerId === 'ollama' && completeConfig.provider.corsRestricted !== false) {
        completeConfig = {
          ...completeConfig,
          provider: {
            ...completeConfig.provider,
            corsRestricted: false
          }
        }
      }

      return completeConfig
    } catch (error) {
      // 对于无法修复的旧配置，创建占位数据并禁用，允许用户查看和删除
      console.warn(`[ImageModelManager] Cannot repair legacy config ${config.id}, marking as disabled:`, error)
      return {
        ...baseConfig,
        enabled: false,
        provider: {
          id: identity.providerId || 'unknown',
          name: `Unknown Provider (${identity.providerId || 'unknown'})`,
          description: 'This configuration is corrupted and cannot be repaired.',
          requiresApiKey: false,
          supportsDynamicModels: false,
          defaultBaseURL: '',
          connectionSchema: { required: [], optional: [], fieldTypes: {} }
        },
        model: {
          id: identity.modelId || 'unknown',
          name: `Unknown Model (${identity.modelId || 'unknown'})`,
          description: 'This configuration is corrupted. Please delete it and create a new one.',
          providerId: identity.providerId || 'unknown',
          capabilities: {
            text2image: false,
            image2image: false,
            multiImage: false
          },
          parameterDefinitions: [],
          defaultParameterValues: {}
        },
        paramOverrides: config.paramOverrides ?? {}
      } as ImageModelConfig
    }
  }

  /**
   * 获取可从默认配置回填到内置模型中的缺失必填连接字段
   */
  private getBackfillableBuiltinConnectionFields(
    configId: string,
    storedConfig: ImageModelConfig,
    defaultConfig: ImageModelConfig
  ): string[] {
    const builtinIds = getBuiltinImageConfigIds()
    if (!builtinIds.includes(configId)) {
      return []
    }

    const requiredFields = defaultConfig.provider.connectionSchema?.required || ['apiKey']
    return requiredFields.filter((field) => {
      const storedValue = storedConfig.connectionConfig?.[field]
      const defaultValue = defaultConfig.connectionConfig?.[field]
      return !this.hasConnectionValue(storedValue) && this.hasConnectionValue(defaultValue)
    })
  }

  /**
   * 判断是否应该自动启用内置模型
   * 条件：内置模型 + 存储的配置为 disabled + 回填后能满足所有必填连接字段
   */
  private shouldAutoEnableBuiltinModel(
    configId: string,
    storedConfig: ImageModelConfig,
    defaultConfig: ImageModelConfig,
    backfillableFields?: string[]
  ): boolean {
    const builtinIds = getBuiltinImageConfigIds()
    if (!builtinIds.includes(configId)) {
      return false
    }

    if (storedConfig.enabled !== false) {
      return false
    }

    const fieldsToBackfill = backfillableFields ?? this.getBackfillableBuiltinConnectionFields(configId, storedConfig, defaultConfig)
    if (fieldsToBackfill.length === 0) {
      return false
    }

    const requiredFields = defaultConfig.provider.connectionSchema?.required || ['apiKey']
    const mergedConnectionConfig: Record<string, unknown> = {
      ...(storedConfig.connectionConfig || {})
    }
    for (const field of fieldsToBackfill) {
      mergedConnectionConfig[field] = defaultConfig.connectionConfig?.[field]
    }

    return requiredFields.every((field) => this.hasConnectionValue(mergedConnectionConfig[field]))
  }

  private hasConnectionValue(value: unknown): boolean {
    return typeof value === 'string' ? value.trim().length > 0 : !!value
  }

  private validateConfig(config: ImageModelConfig): void {
    const errors: string[] = []

    // 验证必需字段
    if (!config.id || typeof config.id !== 'string') {
      errors.push('Missing or invalid id')
    }
    if (!config.name || typeof config.name !== 'string') {
      errors.push('Missing or invalid name')
    }
    if (!config.providerId || typeof config.providerId !== 'string') {
      errors.push('Missing or invalid providerId')
    }
    if (!config.modelId || typeof config.modelId !== 'string') {
      errors.push('Missing or invalid modelId')
    }
    if (typeof config.enabled !== 'boolean') {
      errors.push('Missing or invalid enabled flag')
    }

    // 验证自包含数据字段
    if (!config.provider || typeof config.provider !== 'object') {
      errors.push('Missing or invalid provider data')
    }
    if (!config.model || typeof config.model !== 'object') {
      errors.push('Missing or invalid model data')
    }
    if (config.provider?.id && config.provider.id !== config.providerId) {
      errors.push(`Provider identity mismatch: providerId ${config.providerId} does not match provider.id ${config.provider.id}`)
    }
    if (config.model?.id && config.model.id !== config.modelId) {
      errors.push(`Model identity mismatch: modelId ${config.modelId} does not match model.id ${config.model.id}`)
    }
    if (config.model?.providerId && config.model.providerId !== config.providerId) {
      errors.push(`Provider/model metadata mismatch: providerId ${config.providerId} does not match model.providerId ${config.model.providerId}`)
    }

    // 验证连接配置（如果存在）
    if (config.connectionConfig !== undefined) {
      if (typeof config.connectionConfig !== 'object' || config.connectionConfig === null) {
        errors.push('connectionConfig must be an object')
      }
    }

    // 验证参数覆盖（如果存在）
    if (config.paramOverrides !== undefined) {
      if (typeof config.paramOverrides !== 'object' || config.paramOverrides === null) {
        errors.push('paramOverrides must be an object')
      }
    }

    if (config.customParamOverrides !== undefined) {
      if (typeof config.customParamOverrides !== 'object' || config.customParamOverrides === null) {
        errors.push('customParamOverrides must be an object')
      }
    }

    // 验证提供商是否存在
    try {
      this.registry.getAdapter(config.providerId)
    } catch {
      errors.push(`Unknown provider: ${config.providerId}`)
    }

    // 模型存在性由各自来源保证：
    // - 动态模型：API实时获取，理论上必然存在
    // - 静态模型：代码预置，由开发者维护
    // - 自定义模型：用户自行负责
    // 因此不需要在此验证模型是否存在

    if (errors.length > 0) {
      throw new ImageModelManagerError(
        IMAGE_ERROR_CODES.CONFIG_INVALID,
        errors.join(', '),
        { details: errors.join(', ') },
      )
    }
  }
}

export function createImageModelManager(
  storageProvider: IStorageProvider,
  registry: IImageAdapterRegistry
): ImageModelManager {
  return new ImageModelManager(storageProvider, registry)
}
