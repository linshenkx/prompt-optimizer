import { ref, computed, inject } from 'vue'

import { useI18n } from 'vue-i18n'
import { useToast } from '../ui/useToast'
import type {
  ImageProvider,
  ImageModel,
  ImageModelConfig,
  IImageAdapterRegistry,
  IImageModelManager,
  IImageService
} from '@prompt-optimizer/core'
import { useModelAdvancedParameters } from './useModelAdvancedParameters'

type EditableImageModelConfig = Omit<ImageModelConfig, 'provider' | 'model'> & {
  provider?: ImageProvider
  model?: ImageModel
}

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  try {
    return String(error)
  } catch {
    return 'Unknown error'
  }
}

export function useImageModelManager() {
  const { t } = useI18n()
  const toast = useToast()

  // 按spec设计使用依赖注入
  const registry = inject<IImageAdapterRegistry>('imageRegistry')!
  const imageModelManager = inject<IImageModelManager>('imageModelManager')!
  const imageService = inject<IImageService>('imageService')!

  // 状态管理
  const providers = ref<ImageProvider[]>([])
  const models = ref<ImageModel[]>([])
  const dynamicModels = ref<ImageModel[]>([])
  const configs = ref<ImageModelConfig[]>([])

  // UI状态
  const isLoadingDynamicModels = ref(false)
  const isLoadingProviders = ref(false)
  const isTestingConnection = ref(false)
  const isSaving = ref(false)
  const selectedProviderId = ref('')
  const selectedModelId = ref('')

  // 表单状态（不包含provider和model字段，仅用于编辑）
  const configForm = ref<EditableImageModelConfig>({
    id: '',
    name: '',
    providerId: '',
    modelId: '',
    enabled: true,
    connectionConfig: {},
    paramOverrides: {}
  })

  // 连接和模型加载状态
  const connectionStatus = ref<{
    type: 'success' | 'error' | 'warning' | 'info'
    messageKey: string
    detail?: string
  } | null>(null)

  const testResult = ref<{
    success: boolean
    image?: {
      url?: string
      b64?: string
      mimeType?: string
    }
    testType: 'text2image' | 'image2image'
  } | null>(null)

  const modelLoadingStatus = ref<{
    type: 'success' | 'error' | 'warning' | 'info'
    messageKey: string
    count?: number
    detail?: string
  } | null>(null)

  // 计算属性（按spec设计增强状态管理）
  const isLoadingModels = computed(() => isLoadingDynamicModels.value)

  const selectedProvider = computed(() =>
    providers.value.find(p => p.id === selectedProviderId.value)
  )

  const selectedModel = computed(() =>
    models.value.find(m => m.id === selectedModelId.value)
  )

  // 简化后的接口:直接传入必要的参数
  const advancedParameters = useModelAdvancedParameters({
    mode: 'image',
    registry: computed(() => registry),
    providerId: selectedProviderId,
    modelId: selectedModelId,
    savedModelMeta: computed(() => {
      if (configForm.value.id) {
        const existing = configs.value.find(config => config.id === configForm.value.id)
        if (existing?.model && existing.model.id === selectedModelId.value) {
          return existing.model
        }
      }
      if (configForm.value.model && configForm.value.model.id === selectedModelId.value) {
        return configForm.value.model
      }
      return selectedModel.value
    }),
    getParamOverrides: () => configForm.value.paramOverrides ?? {},
    setParamOverrides: value => {
      configForm.value.paramOverrides = { ...value }
    }
  })

  const {
    currentParameterDefinitions,
    currentParamOverrides,
    availableParameterCount,
    updateParamOverrides,
    applyDefaultsFromModel
  } = advancedParameters

  // 额外的状态计算属性（提升用户体验）
  const hasStaticModels = computed(() => {
    if (!selectedProviderId.value) return false
    try {
      return registry.getStaticModels(selectedProviderId.value).length > 0
    } catch {
      return false
    }
  })

  const hasDynamicModels = computed(() => dynamicModels.value.length > 0)

  const supportsDynamicModels = computed(() =>
    selectedProvider.value?.supportsDynamicModels || false
  )

  const isConnectionConfigured = computed(() => {
    if (!selectedProvider.value?.supportsDynamicModels) return true
    return hasValidConnectionConfig(configForm.value.connectionConfig || {})
  })

  const canRefreshModels = computed(() =>
    supportsDynamicModels.value && isConnectionConfigured.value && !isLoadingDynamicModels.value
  )

  const canTestConnection = computed(() => {
    // 测试期间禁用
    if (isTestingConnection.value) return false
    // 必须有必需的连接配置
    if (!isConnectionConfigured.value) return false
    // 必须有模型 ID（发送请求所需）
    if (!configForm.value.modelId?.trim()) return false
    // 必须有 provider
    if (!configForm.value.providerId) return false

    return true
  })

  // 初始化数据加载
  const loadProviders = async () => {
    isLoadingProviders.value = true
    try {
      providers.value = registry.getAllProviders()
    } catch (error) {
      console.error('Failed to load providers:', error)
      toast.error(t('image.provider.loadFailed'))
    } finally {
      isLoadingProviders.value = false
    }
  }

  const loadConfigs = async () => {
    try {
      configs.value = await imageModelManager.getAllConfigs()
    } catch (error) {
      console.error('Failed to load configs:', error)
      toast.error(t('image.config.loadFailed'))
    }
  }

  // 直接调用新接口
  const updateConfig = async (id: string, updates: Partial<ImageModelConfig>) => {
    await imageModelManager.updateConfig(id, updates)
  }

  const addConfig = async (config: ImageModelConfig) => {
    await imageModelManager.addConfig(config)
  }

  const deleteConfig = async (id: string) => {
    await imageModelManager.deleteConfig(id)
  }

  // 提供商变更处理（按spec设计的渐进式体验）
  const onProviderChange = async (
    providerId: string,
    options: boolean | { autoSelectFirstModel?: boolean; resetOverrides?: boolean } = true
  ) => {
    const normalized =
      typeof options === 'boolean'
        ? { autoSelectFirstModel: options, resetOverrides: options }
        : {
            autoSelectFirstModel: options.autoSelectFirstModel ?? true,
            resetOverrides:
              options.resetOverrides ?? (options.autoSelectFirstModel ?? true)
          }

    selectedProviderId.value = providerId
    configForm.value.providerId = providerId

    if (normalized.resetOverrides) {
      configForm.value.paramOverrides = {}
    }

    // 只有在需要自动选择时才重置模型ID
    if (normalized.autoSelectFirstModel) {
      selectedModelId.value = ''
      configForm.value.modelId = ''
    }

    // 重置所有相关状态
    connectionStatus.value = null
    modelLoadingStatus.value = null
    dynamicModels.value = []

    if (!providerId) {
      models.value = []
      configForm.value.connectionConfig = {}
      return
    }

    // 更新默认API地址
    const providerMeta = providers.value.find(p => p.id === providerId)
    if (providerMeta?.defaultBaseURL) {
      configForm.value.connectionConfig = {
        baseURL: (configForm.value.connectionConfig?.baseURL) || providerMeta.defaultBaseURL,
        ...(configForm.value.connectionConfig || {})
      }
    }

    // 1. 立即显示静态模型（即时响应）
    try {
      const staticModels = registry.getStaticModels(providerId)
      models.value = staticModels

      // 只有在需要自动选择且当前没有选中模型时才自动选择第一个模型
      if (normalized.autoSelectFirstModel && staticModels.length > 0) {
        const firstModel = staticModels[0]
        selectedModelId.value = firstModel.id
        configForm.value.modelId = firstModel.id

        modelLoadingStatus.value = {
          type: 'success',
          messageKey: 'image.model.staticLoaded',
          count: staticModels.length
        }
      } else if (staticModels.length > 0) {
        // 编辑模式：不自动选择，但仍显示成功加载的状态
        modelLoadingStatus.value = {
          type: 'success',
          messageKey: 'image.model.staticLoaded',
          count: staticModels.length
        }
      } else {
        modelLoadingStatus.value = {
          type: 'info',
          messageKey: 'image.model.noStaticModels'
        }
      }
    } catch (error) {
      console.error('Failed to load static models:', error)
      models.value = []
      modelLoadingStatus.value = {
        type: 'error',
        messageKey: 'image.model.staticLoadFailed'
      }
    }

    // 2. 如果支持动态获取且用户已配置连接信息
    if (registry.supportsDynamicModels(providerId)) {
      const connectionConfig = getConnectionConfig()
      if (connectionConfig && hasValidConnectionConfig(connectionConfig)) {
        // 异步加载动态模型，不阻塞UI
        refreshDynamicModels().catch(error => {
          console.warn('Dynamic model loading failed after provider change:', error)
        })
      } else {
        // 提示用户需要配置连接信息
        modelLoadingStatus.value = {
          type: 'warning',
          messageKey: 'image.model.connectionRequired'
        }
      }
    }
  }

  // 获取连接配置（辅助方法）
  const getConnectionConfig = () => {
    return configForm.value.connectionConfig ?? {}
  }

  // 验证连接配置是否有效（辅助方法）
  const hasValidConnectionConfig = (connectionConfig: Record<string, unknown>) => {
    const provider = selectedProvider.value
    if (!provider?.connectionSchema) return true

    return provider.connectionSchema.required.every(field => connectionConfig[field])
  }

  // 详细校验：返回缺失字段与类型不符列表
  const validateConnectionConfigDetailed = (connectionConfig: Record<string, unknown>) => {
    const provider = selectedProvider.value
    const missing: string[] = []
    const typeErrors: { field: string; expected: string; actual: string }[] = []
    if (!provider?.connectionSchema) return { ok: true, missing, typeErrors }
    const schema = provider.connectionSchema

    for (const field of schema.required) {
      if (!(field in (connectionConfig || {})) || connectionConfig[field] === '' || connectionConfig[field] === undefined) {
        missing.push(field)
      }
    }
    for (const [field, expected] of Object.entries(schema.fieldTypes || {})) {
      if (field in (connectionConfig || {})) {
        const actual = typeof connectionConfig[field]
        if (actual !== expected) {
          typeErrors.push({ field, expected, actual })
        }
      }
    }
    return { ok: missing.length === 0 && typeErrors.length === 0, missing, typeErrors }
  }

  // 连接配置变更处理（增强响应性）
  const onConnectionConfigChange = async () => {
    connectionStatus.value = null

    // 如果支持动态模型且连接配置完整，自动刷新模型
    if (selectedProvider.value?.supportsDynamicModels) {
      const connectionConfig = configForm.value.connectionConfig || {}
      if (hasValidConnectionConfig(connectionConfig)) {
        // 配置有效时，异步刷新动态模型
        refreshDynamicModels().catch(error => {
          console.warn('Failed to refresh models after connection config change:', error)
          modelLoadingStatus.value = {
            type: 'warning',
            messageKey: 'image.model.refreshFailed'
          }
        })
      } else {
        // 配置无效时，回退到静态模型并提示
        try {
          const staticModels = registry.getStaticModels(selectedProviderId.value)
          models.value = staticModels
          dynamicModels.value = []

          modelLoadingStatus.value = {
            type: 'warning',
            messageKey: 'image.model.connectionRequired'
          }
        } catch (error) {
          console.error('Failed to load static models:', error)
          models.value = []
        }
      }
    }
  }

  // 连接测试
  // 辅助函数：根据模型能力选择测试类型
  const selectTestType = (model: ImageModel): 'text2image' | 'image2image' => {
    const capabilities = model.capabilities || {}
    const text2image = capabilities?.text2image
    const image2image = capabilities?.image2image

    if (text2image && !image2image) {
      return 'text2image'  // 只支持文生图
    }

    if (!text2image && image2image) {
      return 'image2image' // 只支持图生图
    }

    if (text2image && image2image) {
      return 'text2image'  // 两种都支持，优先文生图
    }

    throw new Error('模型不支持任何图像生成功能')
  }

  const testConnection = async () => {
    if (!selectedProvider.value || !hasValidConnectionConfig(configForm.value.connectionConfig || {})) {
      return
    }

    // 检查是否选择了模型
    if (!configForm.value.modelId) {
      toast.error(t('image.model.selectRequired'))
      return
    }

    isTestingConnection.value = true
    connectionStatus.value = { type: 'info', messageKey: 'image.connection.testing' }

    try {
      // 本地先做详细校验，给出缺失与类型错误提示
      const detail = validateConnectionConfigDetailed(configForm.value.connectionConfig || {})
      if (!detail.ok) {
        const parts: string[] = []
        if (detail.missing.length) parts.push(t('image.connection.validation.missing', { fields: detail.missing.join(', ') }))
        if (detail.typeErrors.length) {
          parts.push(detail.typeErrors.map(e => t('image.connection.validation.invalidType', e)).join('; '))
        }
        connectionStatus.value = { type: 'error', messageKey: 'image.connection.testFailed', detail: parts.join('；') }
        toast.error(parts.join('；'))
        return
      }

      // 获取选中的模型信息：优先使用缓存，不存在时通过registry构建
      let selectedModel = models.value.find(m => m.id === configForm.value.modelId)
      if (!selectedModel) {
        // 对于自定义模型ID，使用adapter的buildDefaultModel方法构建
        try {
          const adapter = registry.getAdapter(selectedProviderId.value)
          selectedModel = adapter.buildDefaultModel(configForm.value.modelId)
        } catch (error) {
          throw new Error(`无法构建模型 ${configForm.value.modelId}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // 根据模型能力确定测试类型
      const testType = selectTestType(selectedModel)

      // 构建完整的模型配置
      const completeConfig: ImageModelConfig = {
        id: configForm.value.id || 'test',
        name: configForm.value.name || 'Test Config',
        providerId: selectedProviderId.value,
        modelId: configForm.value.modelId,
        enabled: true,
        connectionConfig: configForm.value.connectionConfig || {},
        paramOverrides: configForm.value.paramOverrides || {},
        // 测试时使用简化的provider和model对象
        provider: selectedProvider.value!,
        model: selectedModel!
      }

      // 无感 IPC：通过 imageService 统一执行连接测试
      const result = await imageService.testConnection(completeConfig)

      // 测试成功
      connectionStatus.value = {
        type: 'success',
        messageKey: 'image.connection.testSuccess'
      }

      // 保存测试结果图片用于显示
      testResult.value = {
        success: true,
        image: result.images[0],
        testType
      }

      // 连接成功后自动刷新模型（如果支持动态获取）
      await refreshDynamicModels()
      toast.success(t('image.connection.testSuccess'))

    } catch (error) {
      const message = toErrorMessage(error)
      console.error('Connection test failed:', error)
      connectionStatus.value = {
        type: 'error',
        messageKey: 'image.connection.testError',
        detail: message
      }
      toast.error(`${t('image.connection.testError')}: ${message}`)
    } finally {
      isTestingConnection.value = false
    }
  }

  // 动态模型刷新（按spec设计的合并逻辑）
  const refreshDynamicModels = async () => {
    if (!selectedProviderId.value || !registry.supportsDynamicModels(selectedProviderId.value)) {
      return
    }

    const connectionConfig = getConnectionConfig()
    if (!connectionConfig || !hasValidConnectionConfig(connectionConfig)) {
      const detail = validateConnectionConfigDetailed(connectionConfig || {})
      const parts: string[] = []
      if (detail.missing.length) parts.push(t('image.connection.validation.missing', { fields: detail.missing.join(', ') }))
      if (detail.typeErrors.length) parts.push(detail.typeErrors.map(e => t('image.connection.validation.invalidType', e)).join('; '))
      modelLoadingStatus.value = { type: 'warning', messageKey: 'image.model.connectionRequired', detail: parts.join('；') }
      return
    }

    isLoadingDynamicModels.value = true
    modelLoadingStatus.value = {
      type: 'info',
      messageKey: 'image.model.loading'
    }

    try {
      // 无感 IPC：通过 imageService 统一拉取动态模型
      const fetchedDynamicModels = await imageService.getDynamicModels(selectedProviderId.value, connectionConfig)
      dynamicModels.value = fetchedDynamicModels

      // 合并静态和动态模型，动态模型优先（按spec设计）
      const staticModels = registry.getStaticModels(selectedProviderId.value)
      models.value = mergeDynamicModels(staticModels, fetchedDynamicModels)

      modelLoadingStatus.value = {
        type: 'success',
        messageKey: 'image.model.dynamicLoaded',
        count: fetchedDynamicModels.length
      }

    } catch (error) {
      console.warn('Failed to load dynamic models, using static list:', error)

      // 自动降级到静态模型，保持用户体验（按spec设计）
      const staticModels = registry.getStaticModels(selectedProviderId.value)
      models.value = staticModels
      dynamicModels.value = []

      modelLoadingStatus.value = {
        type: 'warning',
        messageKey: 'image.model.dynamicFailed',
        count: staticModels.length,
        detail: toErrorMessage(error)
      }
    } finally {
      isLoadingDynamicModels.value = false
    }
  }

  // 合并动态模型的辅助方法（按spec设计）
  const mergeDynamicModels = (staticModels: ImageModel[], dynamicModels: ImageModel[]): ImageModel[] => {
    const dynamicIds = new Set(dynamicModels.map(m => m.id))
    return [...dynamicModels, ...staticModels.filter(m => !dynamicIds.has(m.id))]
  }

  // 手动刷新模型
  const refreshModels = async () => {
    if (!selectedProvider.value?.supportsDynamicModels) {
      toast.info(t('image.model.refreshNotSupported'))
      return
    }

    if (!hasValidConnectionConfig(configForm.value.connectionConfig || {})) {
      toast.warning(t('image.connection.configRequired'))
      return
    }

    // 显示加载状态
    isLoadingDynamicModels.value = true
    modelLoadingStatus.value = {
      type: 'info',
      messageKey: 'image.model.refreshing'
    }

    try {
      await refreshDynamicModels()
      toast.success(t('image.model.refreshSuccess'))
    } catch (error) {
      toast.error(t('image.model.refreshError'))
    } finally {
      isLoadingDynamicModels.value = false
    }
  }

  // 模型选择变更
  const onModelChange = (modelId: string) => {
    selectedModelId.value = modelId
    configForm.value.modelId = modelId

    if (modelId && selectedProviderId.value) {
      applyDefaultsFromModel()
    }
  }

  // 保存配置（优化版本：使用缓存的模型对象）
  const saveConfig = async () => {
    if (!configForm.value.name || !selectedProviderId.value || !selectedModelId.value) {
      toast.error(t('image.config.incomplete'))
      return
    }

    isSaving.value = true

    try {
      // 从缓存中获取provider信息
      const cachedProvider = providers.value.find(p => p.id === selectedProviderId.value)

      if (!cachedProvider) {
        throw new Error(`提供商不存在: ${selectedProviderId.value}`)
      }

      // 获取模型信息：优先使用缓存，不存在时通过registry构建
      let cachedModel = models.value.find(m => m.id === selectedModelId.value)
      if (!cachedModel) {
        // 对于自定义模型ID，使用adapter的buildDefaultModel方法构建
        try {
          const adapter = registry.getAdapter(selectedProviderId.value)
          cachedModel = adapter.buildDefaultModel(selectedModelId.value)
        } catch (error) {
          throw new Error(`无法构建模型 ${selectedModelId.value}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // 组装完整的自包含配置
      const completeConfig: ImageModelConfig = {
        ...configForm.value,
        // 嵌入完整的provider和model信息
        provider: cachedProvider,
        model: cachedModel
      }

      if (configForm.value.id) {
        await imageModelManager.updateConfig(configForm.value.id, completeConfig)
        toast.success(t('image.config.updateSuccess'))
      } else {
        const newConfig = { ...completeConfig, id: generateConfigId() }
        await imageModelManager.addConfig(newConfig)
        toast.success(t('image.config.createSuccess'))
      }

      // 重新加载配置列表
      await loadConfigs()

      // 重置表单
      resetForm()

    } catch (error) {
      console.error('Failed to save config:', error)
      toast.error(`${t('image.config.saveFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      isSaving.value = false
    }
  }

  // 重置表单
  const resetForm = () => {
    selectedProviderId.value = ''
    selectedModelId.value = ''
    configForm.value = {
      id: '',
      name: '',
      providerId: '',
      modelId: '',
      enabled: true,
      connectionConfig: {},
      paramOverrides: {}
      // 注意：不设置provider和model字段，它们由saveConfig时从缓存填充
    }
    models.value = []
    connectionStatus.value = null
    modelLoadingStatus.value = null
    testResult.value = null
  }

  // 生成配置ID
  const generateConfigId = () => {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 初始化
  const initialize = async () => {
    await Promise.all([
      loadProviders(),
      loadConfigs()
    ])
  }

  return {
    // 数据状态
    providers,
    models,
    dynamicModels,
    configs,
    selectedProviderId,
    selectedModelId,
    configForm,

    // UI状态
    isLoadingModels,
    isLoadingProviders,
    isTestingConnection,
    isSaving,
    connectionStatus,
    modelLoadingStatus,
    testResult,

    // 计算属性（按spec设计增强的状态管理）
    selectedProvider,
    selectedModel,
    hasStaticModels,
    hasDynamicModels,
    supportsDynamicModels,
    isConnectionConfigured,
    canRefreshModels,
    canTestConnection,
    currentParameterDefinitions,
    currentParamOverrides,
    availableParameterCount,

    // 方法
    onProviderChange,
    onConnectionConfigChange,
    testConnection,
    refreshModels,
    onModelChange,
    updateParamOverrides,
    saveConfig,
    resetForm,
    initialize,
    loadConfigs,
    loadProviders,
    updateConfig,
    deleteConfig
  }
}
