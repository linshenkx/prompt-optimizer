import { ref, computed, inject, watch, type Ref } from 'vue'

import { useI18n } from 'vue-i18n'
import { useToast } from '../ui/useToast'
import {
  type ModelOption,
  type CustomRequestHeaderInput,
  CHROME_BUILT_IN_PROVIDER_ID,
  type ChromeBuiltInDownloadProgress,
  type ChromeBuiltInStatus,
  type TextModel,
  type TextModelConfig,
  type TextProvider,
  checkChromeBuiltInAvailability,
  getBuiltinModelIds,
  markChromeBuiltInUserConfigured,
  normalizeCustomRequestHeaders,
  prepareChromeBuiltInModel,
  resolveTextModelMetadata,
  validateCustomRequestHeaders
} from '@prompt-optimizer/core'
import { formatErrorSummary, getI18nErrorMessage } from '../../utils/error'
import { useModelAdvancedParameters } from './useModelAdvancedParameters'
import { computeConnectionConfig } from './useConnectionConfig'
import type { AppServices } from '../../types/services'

type CustomHeaderRow = { key?: unknown; name?: unknown; value?: unknown }
type TextConnectionValue = string | number | boolean | Record<string, string> | CustomHeaderRow[] | undefined
interface TextConnectionConfig {
  [key: string]: TextConnectionValue
}

interface TextModelForm {
  id: string
  originalId?: string
  name: string
  enabled: boolean
  providerId: string
  modelId: string
  connectionConfig: TextConnectionConfig
  paramOverrides: Record<string, unknown>
  displayMaskedKey: boolean
  originalApiKey?: string
  defaultModel?: string
}

interface SetProviderOptions {
  autoSelectFirstModel?: boolean
  resetOverrides?: boolean
  resetConnectionConfig?: boolean
}

const generateTextModelId = (providerId: string, nonce?: number) => {
  const normalizedProvider = (providerId || 'custom').toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  const rand = Math.random().toString(36).slice(2, 10)
  // Include a nonce so retries remain unique even if Date.now/Math.random are mocked/stubbed.
  const noncePart = typeof nonce === 'number' ? `_${nonce}` : ''
  return `text_${normalizedProvider}_${Date.now()}_${rand}${noncePart}`
}

export function useTextModelManager() {
  const { t } = useI18n()
  const toast = useToast()

  const getErrorDetail = (error: unknown, fallback = t('common.error')) => {
    return getI18nErrorMessage(error, fallback)
  }

  const withLocalizedError = (
    key: string,
    error: unknown,
    params: Record<string, unknown> = {},
    fallback = t('common.error')
  ) => {
    return t(key, {
      ...params,
      error: getErrorDetail(error, fallback),
    })
  }

  const services = inject<Ref<AppServices | null>>('services', ref(null))
  if (!services.value) {
    throw new Error('Services not provided!')
  }

  const modelManager = services.value.modelManager
  const llmService = services.value.llmService
  const textAdapterRegistry = services.value.textAdapterRegistry
  if (!textAdapterRegistry) {
    throw new Error('textAdapterRegistry not provided!')
  }

  const models = ref<TextModelConfig[]>([])
  const loadingModels = ref(false)
  const testingConnections = ref<Record<string, boolean>>({})

  const providers = ref<TextProvider[]>([])
  const providersLoaded = ref(false)
  const isLoadingProviders = ref(false)

  const form = ref<TextModelForm>({
    id: '',
    name: '',
    enabled: true,
    providerId: '',
    modelId: '',
    connectionConfig: {},
    paramOverrides: {},
    displayMaskedKey: false
  })

  const editingModelId = ref<string | null>(null)
  const editingModelMeta = ref<TextModel | null>(null)
  const formReady = ref(false)
  const isSaving = ref(false)
  const isTestingFormConnection = ref(false)
  const formConnectionStatus = ref<{
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
  } | null>(null)
  const chromeBuiltInStatus = ref<ChromeBuiltInStatus | null>(null)
  const isCheckingChromeBuiltIn = ref(false)
  const isPreparingChromeBuiltIn = ref(false)
  const chromeBuiltInDownloadProgress = ref<ChromeBuiltInDownloadProgress | null>(null)

  const modelOptions = ref<ModelOption[]>([])
  const isLoadingModelOptions = ref(false)
  const currentProviderType = computed(() => form.value.providerId || 'custom')
  const isChromeBuiltInProvider = computed(() => currentProviderType.value === CHROME_BUILT_IN_PROVIDER_ID)

  const providerOptions = computed(() =>
    providers.value.map(provider => ({
      label: provider.name,
      value: provider.id,
      disabled: false
    }))
  )

  const selectedProvider = computed(() => {
    if (!form.value.providerId) return null
    return providers.value.find(p => p.id === form.value.providerId) || null
  })

  // 简化后的接口:直接传入必要的参数
  const advancedParameters = useModelAdvancedParameters({
    mode: 'text',
    registry: computed(() => textAdapterRegistry),
    providerId: computed(() => form.value.providerId || ''),
    modelId: computed(() => form.value.modelId || ''),
    savedModelMeta: computed(() => editingModelMeta.value || undefined),
    getParamOverrides: () => form.value.paramOverrides ?? {},
    setParamOverrides: value => {
      form.value.paramOverrides = { ...value }
    }
  })

  const {
    currentParameterDefinitions,
    availableParameterCount,
    updateParamOverrides
  } = advancedParameters

  const connectionFields = computed(() => {
    if (!selectedProvider.value?.connectionSchema) return []

    const provider = selectedProvider.value
    const schema = provider.connectionSchema!
    const fields: Array<{
      name: string
      required: boolean
      type: string
      placeholder?: string
      options?: Array<{ label: string; value: string }>
    }> = []

    const buildField = (fieldName: string, required: boolean) => ({
      name: fieldName,
      required,
      type: schema.fieldTypes[fieldName] || 'string',
      placeholder: fieldName === 'baseURL' ? provider.defaultBaseURL : '',
      options: fieldName === 'requestStyle'
        ? [
            {
              label: t('modelManager.connection.requestStyleOptions.chatCompletions'),
              value: 'chat_completions'
            },
            {
              label: t('modelManager.connection.requestStyleOptions.responses'),
              value: 'responses'
            }
          ]
        : undefined
    })

    for (const fieldName of schema.required) {
      fields.push(buildField(fieldName, true))
    }

    for (const fieldName of schema.optional) {
      fields.push(buildField(fieldName, false))
    }

    return fields
  })

  const isConnectionConfigured = computed(() => {
    if (!selectedProvider.value?.connectionSchema) return true

    const schema = selectedProvider.value.connectionSchema!
    const config = form.value.connectionConfig || {}

    return schema.required.every(field => !!config[field])
  })

  const canTestFormConnection = computed(() => {
    // 测试期间禁用
    if (isTestingFormConnection.value) return false
    // 必须有必需的连接配置
    if (!isConnectionConfigured.value) return false
    // 必须有模型 ID（发送请求所需）
    if (!form.value.modelId?.trim()) return false
    // 必须有 provider
    if (!form.value.providerId) return false
    if (isChromeBuiltInProvider.value && chromeBuiltInStatus.value?.availability !== 'available') return false

    return true
  })
  const canSaveForm = computed(() => {
    if (isSaving.value) return false
    if (!form.value.name?.trim()) return false
    if (!form.value.providerId?.trim()) return false
    if (!form.value.modelId?.trim()) return false
    return true
  })
  const canRefreshModelOptions = computed(() => {
    return selectedProvider.value?.supportsDynamicModels && isConnectionConfigured.value && !isLoadingModelOptions.value
  })

  const modalTitle = computed(() => (editingModelId.value ? t('modelManager.editModel') : t('modelManager.addModel')))

  const isDefaultModel = (id: string) => {
    return getBuiltinModelIds().includes(id)
  }

  const getCustomHeaderValidationMessage = () => {
    if (form.value.providerId !== 'openai-compatible') return null

    const validation = validateCustomRequestHeaders(
      form.value.connectionConfig.customHeaders as CustomRequestHeaderInput
    )
    if (validation.valid) return null

    const details = validation.errors
      .map((error) => {
        const reasonKey = `modelManager.customHeaders.validation.${error.reason}`
        const reason = t(reasonKey)
        return `${error.key}: ${reason === reasonKey ? error.reason : reason}`
      })
      .join('; ')

    return t('modelManager.customHeaders.validationError', { details })
  }

  const normalizeConnectionCustomHeaders = (connectionConfig: TextConnectionConfig): TextConnectionConfig => {
    if (form.value.providerId !== 'openai-compatible') {
      connectionConfig.customHeaders = undefined
      return connectionConfig
    }

    const customHeaders = normalizeCustomRequestHeaders(
      connectionConfig.customHeaders as CustomRequestHeaderInput
    )
    if (customHeaders) {
      connectionConfig.customHeaders = customHeaders
    } else {
      connectionConfig.customHeaders = undefined
    }

    return connectionConfig
  }

  const resetFormState = () => {
    form.value = {
      id: '',
      name: '',
      enabled: true,
      providerId: '',
      modelId: '',
      connectionConfig: {},
      paramOverrides: {},
      displayMaskedKey: false
    }
    editingModelId.value = null
    editingModelMeta.value = null
    formReady.value = false
    modelOptions.value = []
    formConnectionStatus.value = null
    chromeBuiltInStatus.value = null
    chromeBuiltInDownloadProgress.value = null
  }

  const ensureProvidersLoaded = async () => {
    if (providersLoaded.value) return
    isLoadingProviders.value = true
    try {
      providers.value = textAdapterRegistry?.getAllProviders?.() || []
      providersLoaded.value = true
    } catch (error) {
      console.error('Failed to load text model providers:', error)
      toast.error(t('modelManager.loadFailed'))
      providers.value = []
    } finally {
      isLoadingProviders.value = false
    }
  }

  const loadStaticModelsForProvider = (providerId: string) => {
    if (!providerId || !textAdapterRegistry) {
      modelOptions.value = []
      return
    }
    try {
      const staticModels = textAdapterRegistry.getStaticModels(providerId)
      modelOptions.value = staticModels.map((model: TextModel) => ({
        value: model.id,
        label: model.name || model.id
      }))
    } catch (error) {
      console.error('Failed to load provider models:', error)
      modelOptions.value = []
    }
  }

  const isUnknownIdentity = (value: unknown) => {
    return typeof value !== 'string' || value.trim().length === 0 || value === 'unknown'
  }

  const getEditableIdentity = (model: TextModelConfig) => {
    const providerId = model.providerId ?? model.providerMeta?.id ?? ''
    const modelId = model.modelId ?? model.modelMeta?.id ?? ''
    const providerExists = providers.value.some(provider => provider.id === providerId)

    if (isUnknownIdentity(providerId) || isUnknownIdentity(modelId) || !providerExists) {
      return { providerId: '', modelId: '' }
    }

    return { providerId, modelId }
  }

  const refreshChromeBuiltInStatus = async () => {
    if (!isChromeBuiltInProvider.value) {
      chromeBuiltInStatus.value = null
      chromeBuiltInDownloadProgress.value = null
      return
    }

    isCheckingChromeBuiltIn.value = true
    try {
      chromeBuiltInStatus.value = await checkChromeBuiltInAvailability()
    } catch (error) {
      chromeBuiltInStatus.value = {
        availability: 'unavailable',
        error: getErrorDetail(error)
      }
    } finally {
      isCheckingChromeBuiltIn.value = false
    }
  }

  const prepareChromeBuiltInDownload = async () => {
    if (!isChromeBuiltInProvider.value || isPreparingChromeBuiltIn.value) return

    isPreparingChromeBuiltIn.value = true
    chromeBuiltInDownloadProgress.value = null
    formConnectionStatus.value = { type: 'info', message: t('modelManager.chromeBuiltIn.preparing') }

    try {
      chromeBuiltInStatus.value = await prepareChromeBuiltInModel((progress) => {
        chromeBuiltInDownloadProgress.value = progress
        chromeBuiltInStatus.value = { availability: 'downloading' }
      })

      if (chromeBuiltInStatus.value.availability === 'available') {
        form.value.enabled = true
        formConnectionStatus.value = { type: 'success', message: t('modelManager.chromeBuiltIn.ready') }
        toast.success(t('modelManager.chromeBuiltIn.ready'))
      } else {
        formConnectionStatus.value = {
          type: 'warning',
          message: t(`modelManager.chromeBuiltIn.status.${chromeBuiltInStatus.value.availability}`)
        }
      }
    } catch (error) {
      chromeBuiltInStatus.value = {
        availability: 'unavailable',
        error: getErrorDetail(error)
      }
      formConnectionStatus.value = {
        type: 'error',
        message: t('modelManager.chromeBuiltIn.prepareFailed', { error: getErrorDetail(error) })
      }
      toast.error(t('modelManager.chromeBuiltIn.prepareFailed', { error: getErrorDetail(error) }))
    } finally {
      isPreparingChromeBuiltIn.value = false
    }
  }

  const loadModels = async () => {
    loadingModels.value = true
    try {
      const all = await modelManager.getAllModels()
      models.value = all
        .map((model: TextModelConfig) => ({ ...model }))
        .sort((a: TextModelConfig, b: TextModelConfig) => {
          if (a.enabled !== b.enabled) {
            return a.enabled ? -1 : 1
          }
          const aDefault = isDefaultModel(a.id)
          const bDefault = isDefaultModel(b.id)
          if (aDefault !== bDefault) {
            return aDefault ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })
    } catch (error) {
      console.error('Failed to load models:', error)
      toast.error(t('modelManager.loadFailed'))
    } finally {
      loadingModels.value = false
    }
  }

  const testConfigConnection = async (id: string) => {
    if (!id || testingConnections.value[id]) return
    testingConnections.value[id] = true
    try {
      const model = await modelManager.getModel(id)
      if (!model) {
        throw new Error(t('modelManager.noModelsAvailable'))
      }
      await llmService.testConnection(id)
      toast.success(t('modelManager.testSuccess', { provider: model.name }))
    } catch (error) {
      console.error('Connection test failed:', error)
      const model = await modelManager.getModel(id)
      const modelName = model?.name || id
      toast.error(t('modelManager.testFailed', {
        provider: modelName,
        error: getErrorDetail(error)
      }))
    } finally {
      delete testingConnections.value[id]
    }
  }

  const enableModel = async (id: string) => {
    try {
      const model = await modelManager.getModel(id)
      if (!model) throw new Error(t('modelManager.noModelsAvailable'))
      if (id === CHROME_BUILT_IN_PROVIDER_ID) {
        await modelManager.updateModel(id, markChromeBuiltInUserConfigured(model, true))
      } else {
        await modelManager.enableModel(id)
      }
      await loadModels()
      toast.success(t('modelManager.enableSuccess'))
    } catch (error: unknown) {
      console.error('Failed to enable model:', error)
      toast.error(withLocalizedError('modelManager.enableFailed', error))
    }
  }

  const disableModel = async (id: string) => {
    try {
      const model = await modelManager.getModel(id)
      if (!model) throw new Error(t('modelManager.noModelsAvailable'))
      if (id === CHROME_BUILT_IN_PROVIDER_ID) {
        await modelManager.updateModel(id, markChromeBuiltInUserConfigured(model, false))
      } else {
        await modelManager.disableModel(id)
      }
      await loadModels()
      toast.success(t('modelManager.disableSuccess'))
    } catch (error: unknown) {
      console.error('Failed to disable model:', error)
      toast.error(withLocalizedError('modelManager.disableFailed', error))
    }
  }

  const prepareForClone = async (id: string) => {
    try {
      const model = await modelManager.getModel(id)
      if (!model) throw new Error(t('modelManager.noModelsAvailable'))

      resetFormState()
      await ensureProvidersLoaded()
      formReady.value = false

      form.value = {
        id: '',
        name: `${model.name || id} (Copy)`,
        enabled: model.enabled,
        providerId: getEditableIdentity(model).providerId,
        modelId: getEditableIdentity(model).modelId,
        connectionConfig: JSON.parse(JSON.stringify(model.connectionConfig ?? {})) as TextConnectionConfig,
        paramOverrides: model.paramOverrides ? JSON.parse(JSON.stringify(model.paramOverrides)) : {},
        displayMaskedKey: false,
        originalApiKey: typeof model.connectionConfig?.apiKey === 'string' ? model.connectionConfig.apiKey : undefined,
        defaultModel: getEditableIdentity(model).modelId
      }
      editingModelMeta.value = form.value.modelId ? model.modelMeta : null

      if (form.value.providerId) {
        setProvider(form.value.providerId, {
          autoSelectFirstModel: false,
          resetOverrides: false,
          resetConnectionConfig: false
        })
      } else {
        modelOptions.value = []
      }

      if (!modelOptions.value.some(option => option.value === form.value.modelId) && form.value.modelId) {
        modelOptions.value.push({ value: form.value.modelId, label: form.value.modelId })
      }
    } catch (error: unknown) {
      console.error('Failed to prepare clone model draft:', error)
      toast.error(t('modelManager.cloneFailed'))
      throw error
    } finally {
      formReady.value = true
    }
  }

  const deleteModel = async (id: string) => {
    try {
      await modelManager.deleteModel(id)
      await loadModels()
      toast.success(t('modelManager.deleteSuccess'))
    } catch (error: unknown) {
      console.error('Failed to delete model:', error)
      toast.error(withLocalizedError('modelManager.deleteFailed', error))
    }
  }

  const maskApiKey = (value: string) => {
    const keyLength = value.length
    if (keyLength <= 8) return '*'.repeat(keyLength)
    const visiblePart = 4
    const prefix = value.substring(0, visiblePart)
    const suffix = value.substring(keyLength - visiblePart)
    const maskedLength = keyLength - visiblePart * 2
    return `${prefix}${'*'.repeat(maskedLength)}${suffix}`
  }

  const setProvider = (providerId: string, options: SetProviderOptions = {}) => {
    const {
      autoSelectFirstModel = true,
      resetOverrides = true,
      resetConnectionConfig = true
    } = options

    const repairingMissingProvider = !form.value.providerId && !!providerId
    const shouldResetOverrides = resetOverrides && !repairingMissingProvider
    const shouldResetConnectionConfig = resetConnectionConfig && !repairingMissingProvider

    form.value.providerId = providerId
    formConnectionStatus.value = null
    chromeBuiltInDownloadProgress.value = null
    if (shouldResetOverrides) {
      form.value.paramOverrides = {}
    }

    if (!providerId) {
      form.value.connectionConfig = {}
      modelOptions.value = []
      return
    }

    loadStaticModelsForProvider(providerId)

    // 使用共享函数处理连接配置
    const providerMeta = providers.value.find(p => p.id === providerId)
    form.value.connectionConfig = computeConnectionConfig(
      form.value.connectionConfig,
      providerMeta,
      shouldResetConnectionConfig
    ) as TextConnectionConfig

    if (autoSelectFirstModel && modelOptions.value.length > 0) {
      const firstModelId = modelOptions.value[0].value
      form.value.modelId = firstModelId
      form.value.defaultModel = firstModelId
      // 切换提供商后自动应用第一个模型的默认参数
      if (firstModelId && providerId && !repairingMissingProvider) {
        advancedParameters.applyDefaultsFromModel(false)
      }
    }
  }

  const prepareForCreate = async () => {
    resetFormState()
    await ensureProvidersLoaded()
    formReady.value = false

    if (providers.value.length > 0) {
      setProvider(providers.value[0].id, {
        autoSelectFirstModel: true,
        resetOverrides: true
      })
      // 创建模式：自动应用第一个模型的默认参数
      if (form.value.modelId && form.value.providerId) {
        advancedParameters.applyDefaultsFromModel(false)
      }
    }

    formReady.value = true
  }

  const prepareForEdit = async (id: string, forceReload = true) => {
    // 如果已经在编辑同一个模型且不强制重新加载，则跳过
    if (!forceReload && editingModelId.value === id && formReady.value) {
      return
    }

    resetFormState()
    editingModelId.value = id
    await ensureProvidersLoaded()
    formReady.value = false

    try {
      const model = await modelManager.getModel(id)
      if (!model) {
        throw new Error(t('modelManager.noModelsAvailable'))
      }

      const connectionConfig: TextConnectionConfig = { ...(model.connectionConfig ?? {}) }
      const rawApiKey = connectionConfig.apiKey ?? ''
      if (rawApiKey) {
        connectionConfig.apiKey = maskApiKey(String(rawApiKey))
      }

      form.value = {
        id: model.id,
        originalId: model.id,
        name: model.name,
        enabled: model.enabled,
        providerId: getEditableIdentity(model).providerId,
        modelId: getEditableIdentity(model).modelId,
        connectionConfig,
        paramOverrides: model.paramOverrides ? JSON.parse(JSON.stringify(model.paramOverrides)) : {},
        displayMaskedKey: !!rawApiKey,
        originalApiKey: String(rawApiKey) || undefined,
        defaultModel: getEditableIdentity(model).modelId
      }
      editingModelMeta.value = form.value.modelId ? model.modelMeta : null

      if (form.value.providerId) {
        setProvider(form.value.providerId, {
          autoSelectFirstModel: false,
          resetOverrides: false,
          resetConnectionConfig: false
        })
      } else {
        modelOptions.value = []
      }
      if (!modelOptions.value.some(option => option.value === form.value.modelId) && form.value.modelId) {
        modelOptions.value.push({ value: form.value.modelId, label: form.value.modelId })
      }

      // 编辑时不自动刷新模型列表，避免不必要的网络请求和延迟
      // 用户可以通过手动点击刷新按钮来获取最新模型列表
    } catch (error) {
      console.error('Failed to load models:', error)
      toast.error(t('modelManager.loadFailed'))
    } finally {
      formReady.value = true
    }
  }


  const isModelListBlockedError = (error: unknown) => {
    const message = getErrorDetail(error, '').toLowerCase()
    const code = typeof (error as { code?: unknown })?.code === 'string'
      ? String((error as { code?: string }).code).toLowerCase()
      : ''
    const status = (error as { status?: unknown; statusCode?: unknown })?.status
      ?? (error as { statusCode?: unknown })?.statusCode
      ?? (error as { response?: { status?: unknown } })?.response?.status

    return status === 403
      || message.includes('403')
      || message.includes('blocked')
      || message.includes('your request was blocked')
      || code.includes('forbidden')
  }

  const ensureCurrentModelOption = () => {
    const currentId = form.value.modelId?.trim()
    if (!currentId) return
    if (!modelOptions.value.some(option => option.value === currentId)) {
      modelOptions.value = [
        { value: currentId, label: currentId },
        ...modelOptions.value,
      ]
    }
  }

  const refreshModelOptions = async (showSuccess = true) => {
    if (!form.value.providerId) return

    const customHeaderError = getCustomHeaderValidationMessage()
    if (customHeaderError) {
      toast.error(customHeaderError)
      return
    }

    const baseURL = (form.value.connectionConfig.baseURL as string)?.trim()
    if (!baseURL) {
      toast.error(t('modelManager.needBaseUrl'))
      return
    }

    isLoadingModelOptions.value = true

    // Keep this outside try/catch so we can fall back to static models on error.
    const providerTemplateId = form.value.providerId || currentProviderType.value || 'custom'

    try {
      const connectionConfig: TextConnectionConfig = {
        baseURL,
        ...form.value.connectionConfig,
        apiKey: form.value.displayMaskedKey && form.value.originalApiKey
          ? form.value.originalApiKey
          : form.value.connectionConfig.apiKey
      }
      normalizeConnectionCustomHeaders(connectionConfig)

      const existingConfig = form.value.originalId ? await modelManager.getModel(form.value.originalId) : undefined

      let { providerMeta, modelMeta } = resolveFormMetadata(
        providerTemplateId,
        form.value.modelId,
        existingConfig
      )

      if (textAdapterRegistry && providerTemplateId) {
        try {
          const adapter = textAdapterRegistry.getAdapter(providerTemplateId)
          if (!providerMeta) {
            providerMeta = adapter.getProvider()
          }
          const staticModels = adapter.getModels()
          if (form.value.modelId) {
            modelMeta = staticModels.find((m: TextModel) => m.id === form.value.modelId) || modelMeta
          }
          if (!modelMeta) {
            modelMeta = staticModels[0]
          }
          if (!modelMeta && form.value.modelId) {
            modelMeta = adapter.buildDefaultModel(form.value.modelId)
          }
        } catch (error) {
          console.warn(`[useTextModelManager] Failed to load metadata for provider ${providerTemplateId}`, error)
        }
      }

      const fetchedModels = await llmService.fetchModelList(providerTemplateId, {
        providerId: providerMeta?.id || providerTemplateId,
        modelId: form.value.modelId || modelMeta?.id,
        connectionConfig,
        providerMeta,
        modelMeta: modelMeta ? { ...modelMeta, id: form.value.modelId || modelMeta.id } : undefined
      } as Partial<TextModelConfig>)

      modelOptions.value = fetchedModels
      if (showSuccess) {
        toast.success(t('modelManager.fetchModelsSuccess', { count: fetchedModels.length }))
      }

      if (fetchedModels.length > 0 && !fetchedModels.some((m: { value: string }) => m.value === form.value.modelId)) {
        form.value.modelId = fetchedModels[0].value
        form.value.defaultModel = fetchedModels[0].value
      }
    } catch (error: unknown) {
      console.warn('Failed to fetch model list:', error)

      // Keep UX consistent: if dynamic fetch fails, fall back to static/current models
      // and explain gateway blocks (e.g. 403 on /v1/models) without blocking manual use.
      const errorMessage = getErrorDetail(error, t('modelManager.loadFailed'))
      const blocked = isModelListBlockedError(error)

      let staticCount = 0
      try {
        const staticModels = textAdapterRegistry.getStaticModels(providerTemplateId)
        staticCount = staticModels.length
      } catch {
        staticCount = 0
      }

      loadStaticModelsForProvider(providerTemplateId)
      ensureCurrentModelOption()

      const optionCount = modelOptions.value.length
      if (optionCount > 0) {
        toast.warning(
          blocked
            ? t('modelManager.fetchModelsBlockedFallback', {
                error: errorMessage,
                count: optionCount,
              })
            : t('modelManager.fetchModelsFallback', {
                error: errorMessage,
                count: optionCount,
              }),
        )
      } else if (blocked) {
        toast.error(t('modelManager.fetchModelsBlockedFailed', { error: errorMessage }))
      } else {
        toast.error(t('modelManager.fetchModelsFailed', { error: errorMessage }))
      }

      // Keep the currently saved model id so users can continue without remote list.
      if (form.value.modelId?.trim()) {
        form.value.defaultModel = form.value.modelId
      }
    } finally {
      isLoadingModelOptions.value = false
    }
  }

  const resolveFormMetadata = (
    providerId: string,
    modelId: string,
    existingConfig?: TextModelConfig
  ) => resolveTextModelMetadata({
    providerId,
    modelId,
    registry: textAdapterRegistry,
    existingProviderMeta: existingConfig?.providerMeta,
    existingModelMeta: existingConfig?.modelMeta
  })

  const updateExistingModel = async () => {
    if (!form.value.originalId) {
      throw new Error('Invalid edit session')
    }

    const existingConfig = await modelManager.getModel(form.value.originalId)
    if (!existingConfig) {
      throw new Error('Model not found')
    }

    const connectionConfig: TextConnectionConfig = {
      baseURL: (form.value.connectionConfig.baseURL as string)?.trim() || existingConfig.connectionConfig?.baseURL,
      ...form.value.connectionConfig
    }

    if (form.value.displayMaskedKey) {
      if (form.value.originalApiKey) {
        connectionConfig.apiKey = form.value.originalApiKey
      } else {
        delete connectionConfig.apiKey
      }
    } else if (form.value.connectionConfig.apiKey) {
      connectionConfig.apiKey = form.value.connectionConfig.apiKey
    } else {
      delete connectionConfig.apiKey
    }
    normalizeConnectionCustomHeaders(connectionConfig)

    const { providerMeta, modelMeta } = resolveFormMetadata(
      form.value.providerId,
      form.value.modelId,
      existingConfig
    )

    const updates = {
      name: form.value.name,
      enabled: form.value.enabled,
      providerId: form.value.providerId,
      modelId: form.value.modelId,
      providerMeta,
      modelMeta,
      connectionConfig,
      paramOverrides: { ...(form.value.paramOverrides || {}) }
    } as Partial<TextModelConfig>
    if (form.value.originalId === CHROME_BUILT_IN_PROVIDER_ID || providerMeta.id === CHROME_BUILT_IN_PROVIDER_ID) {
      updates.activationState = markChromeBuiltInUserConfigured(existingConfig, form.value.enabled).activationState
    }

    await modelManager.updateModel(form.value.originalId, updates)
    return form.value.originalId
  }

  const createNewModel = async () => {
    // Auto-generate a stable internal id for the config.
    // Text models use the id as the storage key and runtime selector.
    const providerId = form.value.providerId || 'custom'
    // Extremely unlikely, but avoid collisions with built-in keys or existing custom configs.
    let modelKey = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateTextModelId(providerId, attempt)
      const existingModel = await modelManager.getModel(candidate)
      if (!existingModel && !isDefaultModel(candidate)) {
        modelKey = candidate
        break
      }
    }

    if (!modelKey) {
      throw new Error(t('modelManager.modelIdGenerateFailed'))
    }

    const { providerMeta, modelMeta } = resolveFormMetadata(
      form.value.providerId,
      form.value.defaultModel || form.value.modelId
    )

    const connectionConfig: TextConnectionConfig = {
      ...form.value.connectionConfig
    }
    if (form.value.displayMaskedKey && form.value.originalApiKey) {
      connectionConfig.apiKey = form.value.originalApiKey
    }
    normalizeConnectionCustomHeaders(connectionConfig)

    const newConfig = {
      id: modelKey,
      name: form.value.name,
      enabled: form.value.enabled,
      providerId: providerMeta.id,
      modelId: modelMeta.id,
      providerMeta,
      modelMeta,
      connectionConfig,
      paramOverrides: { ...(form.value.paramOverrides ?? {}) }
    } as TextModelConfig

    await modelManager.addModel(modelKey, newConfig)
    return modelKey
  }

  const saveForm = async () => {
    if (isSaving.value) return null
    if (!canSaveForm.value) {
      throw new Error('No provider or model selected')
    }
    isSaving.value = true
    try {
      const customHeaderError = getCustomHeaderValidationMessage()
      if (customHeaderError) {
        throw new Error(customHeaderError)
      }

      const savedId = editingModelId.value ? await updateExistingModel() : await createNewModel()
      await loadModels()
      return savedId
    } finally {
      isSaving.value = false
    }
  }

  const testFormConnection = async () => {
    // 使用 canTestFormConnection 的完整校验逻辑
    if (!canTestFormConnection.value) return

    isTestingFormConnection.value = true
    formConnectionStatus.value = { type: 'info', message: t('modelManager.testing') }

    try {
      if (!form.value.providerId || !form.value.modelId) {
        throw new Error('No model selected')
      }

      const customHeaderError = getCustomHeaderValidationMessage()
      if (customHeaderError) {
        throw new Error(customHeaderError)
      }

      // 编辑模式下获取现有配置，新增模式下为 undefined
      const existingConfig = editingModelId.value ? await modelManager.getModel(editingModelId.value) : undefined

      const { providerMeta, modelMeta } = resolveFormMetadata(
        form.value.providerId,
        form.value.modelId,
        existingConfig
      )

      const baseURL = typeof form.value.connectionConfig?.baseURL === 'string'
        ? form.value.connectionConfig.baseURL.trim()
        : undefined

      const connectionConfig: TextConnectionConfig = {
        baseURL: baseURL || existingConfig?.connectionConfig?.baseURL,
        ...existingConfig?.connectionConfig,
        ...form.value.connectionConfig,
        apiKey: form.value.displayMaskedKey && form.value.originalApiKey
          ? form.value.originalApiKey
          : (form.value.connectionConfig.apiKey || existingConfig?.connectionConfig?.apiKey)
      }
      normalizeConnectionCustomHeaders(connectionConfig)

      const tempConfig = {
        id: `temp-test-${editingModelId.value || 'new'}-${Date.now()}`,
        name: form.value.name || form.value.modelId,
        enabled: form.value.enabled,
        providerId: providerMeta.id,
        modelId: modelMeta.id,
        providerMeta,
        modelMeta,
        connectionConfig,
        paramOverrides: { ...(form.value.paramOverrides || {}) }
      } as TextModelConfig

      await modelManager.addModel(tempConfig.id, tempConfig)

      try {
        // 测试临时模型
        await llmService.testConnection(tempConfig.id)
        const displayName = form.value.name || form.value.modelId
        formConnectionStatus.value = { type: 'success', message: t('modelManager.testSuccess', { provider: displayName }) }
        toast.success(t('modelManager.testSuccess', { provider: displayName }))
      } finally {
        // 清理临时模型
        try {
          await modelManager.deleteModel(tempConfig.id)
        } catch (cleanupError) {
          console.warn('Failed to clean up temporary test model:', cleanupError)
        }
      }

    } catch (error) {
      console.error('Connection test failed:', error)
      const displayName = form.value.name || form.value.modelId
      const summary = t('modelManager.testConnection')
      formConnectionStatus.value = {
        type: 'error',
        message: formatErrorSummary(`${summary} (${displayName})`, error)
      }
      toast.error(withLocalizedError('modelManager.testFailed', error, { provider: displayName }))
    } finally {
      isTestingFormConnection.value = false
    }
  }

  watch(() => form.value.connectionConfig.apiKey, (newValue) => {
    if (!editingModelId.value) return
    const val = newValue ?? ''
    const isMasked = typeof val === 'string' && val.includes('*')
    form.value.displayMaskedKey = isMasked
    if (!isMasked && typeof val === 'string') {
      form.value.originalApiKey = val
    }
  })

  watch(
    () => form.value.providerId,
    () => {
      void refreshChromeBuiltInStatus()
    }
  )

  const onModelChange = (modelId: string) => {
    form.value.modelId = modelId
    form.value.defaultModel = modelId || ''

    if (modelId && form.value.providerId) {
      // 编辑模式：合并参数（保留用户已有配置）
      // 创建模式：替换参数（使用新模型的默认值）
      const isEditing = !!editingModelId.value
      advancedParameters.applyDefaultsFromModel(isEditing)
    }
  }

  return {
    // list state
    models,
    loadingModels,
    loadModels,
    isDefaultModel,
    testingConnections,
    testConfigConnection,
    enableModel,
    disableModel,
    prepareForClone,
    deleteModel,

    // providers
    providers,
    isLoadingProviders,
    loadProviders: ensureProvidersLoaded,
    selectProvider: setProvider,

    // form state & helpers
    form,
    formReady,
    isSaving,
    canSaveForm,
    modalTitle,
    editingModelId,
    providerOptions,
    connectionFields,
    modelOptions,
    isLoadingModelOptions,
    currentParameterDefinitions,
    availableParameterCount,
    currentProviderType,
    isChromeBuiltInProvider,
    chromeBuiltInStatus,
    isCheckingChromeBuiltIn,
    isPreparingChromeBuiltIn,
    chromeBuiltInDownloadProgress,
    refreshChromeBuiltInStatus,
    prepareChromeBuiltInDownload,
    selectedProvider,
    updateParamOverrides,
    onModelChange,
    prepareForCreate,
    prepareForEdit,
    refreshModelOptions,
    saveForm,
    resetFormState,
    isTestingFormConnection,
    canTestFormConnection,
    testFormConnection,
    isConnectionConfigured,
    canRefreshModelOptions,
    formConnectionStatus
  }
}

export type TextModelManager = ReturnType<typeof useTextModelManager>
