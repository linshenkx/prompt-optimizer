import { computed, type ComputedRef, type Ref } from 'vue'

import type {
  UnifiedParameterDefinition,
  TextModel,
  TextModelConfig,
  ITextAdapterRegistry,
  ITextProviderAdapter,
  ImageModel,
  ImageModelConfig,
  IImageAdapterRegistry,
  IImageProviderAdapter
} from '@prompt-optimizer/core'

type ParameterizedModel = {
  id: string
  parameterDefinitions?: readonly UnifiedParameterDefinition[]
  defaultParameterValues?: Record<string, unknown>
}

/**
 * 简化后的参数访问器接口
 * 现在只有统一的 paramOverrides,不再区分 built-in 和 custom
 */
interface OverrideAccessors {
  getParamOverrides: () => Record<string, unknown>
  setParamOverrides: (value: Record<string, unknown>) => void
}

/**
 * 简化后的选项接口
 * 直接传入必要的参数,而不是复杂的 resolver 函数
 */
interface UseModelAdvancedParametersOptions extends OverrideAccessors {
  mode: 'text' | 'image'
  registry: Ref<ITextAdapterRegistry | IImageAdapterRegistry>
  providerId: Ref<string>
  modelId: Ref<string>
  savedModelMeta: Ref<ParameterizedModel | undefined>
}

/**
 * 统一的高级参数管理组合式函数
 *
 * 简化说明:
 * 1. 移除了 customOverrides 的概念,统一使用 paramOverrides
 * 2. 移除了 candidateModelIds 数组,直接使用 modelId
 * 3. 简化了模型元数据解析逻辑:savedModelMeta → static → buildDefault
 */
export function useModelAdvancedParameters(
  options: UseModelAdvancedParametersOptions
) {
  /**
   * 解析当前模型元数据
   * 优先级: savedModelMeta → static models → buildDefault
   */
  const currentModelMeta = computed(() => {
    const providerId = options.providerId.value
    const modelId = options.modelId.value
    const savedMeta = options.savedModelMeta.value

    if (!providerId || !modelId) return undefined

    // 优先使用已保存的模型元数据(配置中的快照)
    if (savedMeta && savedMeta.id === modelId) {
      return savedMeta
    }

    // 尝试从静态模型列表获取
    try {
      const registry = options.registry.value
      const staticModels = options.mode === 'text'
        ? (registry as ITextAdapterRegistry).getStaticModels(providerId)
        : (registry as IImageAdapterRegistry).getStaticModels(providerId)

      const staticMatch = staticModels.find(model => model.id === modelId)
      if (staticMatch) return staticMatch
    } catch (error) {
      console.warn(
        `[useModelAdvancedParameters] Failed to get static models for provider ${providerId}`,
        error
      )
    }

    // 最后使用 buildDefaultModel 构建
    try {
      const registry = options.registry.value
      const adapter = options.mode === 'text'
        ? (registry as ITextAdapterRegistry).getAdapter(providerId)
        : (registry as IImageAdapterRegistry).getAdapter(providerId)

      return adapter.buildDefaultModel(modelId)
    } catch (error) {
      console.warn(
        `[useModelAdvancedParameters] Failed to build default model for provider ${providerId}, model ${modelId}`,
        error
      )
      return undefined
    }
  })

  const currentParameterDefinitions = computed(() => {
    const definitions = currentModelMeta.value?.parameterDefinitions ?? []
    return definitions.map(definition => ({ ...definition }))
  })

  const currentParamOverrides = computed(() => options.getParamOverrides())

  const availableParameterCount = computed(() => {
    const overrides = currentParamOverrides.value || {}
    return currentParameterDefinitions.value.filter(
      definition => !Object.prototype.hasOwnProperty.call(overrides, definition.name)
    ).length
  })

  const updateParamOverrides = (overrides: Record<string, unknown>) => {
    options.setParamOverrides({ ...overrides })
  }

  /**
   * 应用模型默认参数
   * @param mergeWithExisting 是否与现有参数合并（true: 保留用户配置，补充缺失默认值；false: 完全替换）
   */
  const applyDefaultsFromModel = (mergeWithExisting = false) => {
    const defaults = currentModelMeta.value?.defaultParameterValues
    if (!defaults) return

    if (mergeWithExisting) {
      // 合并模式：保留用户已有配置，只补充缺失的默认值
      const currentOverrides = options.getParamOverrides()
      const merged = { ...defaults }
      // 用户已配置的参数优先
      for (const key of Object.keys(currentOverrides)) {
        if (currentOverrides[key] !== undefined) {
          merged[key] = currentOverrides[key]
        }
      }
      options.setParamOverrides(merged)
    } else {
      // 替换模式：直接使用默认值
      options.setParamOverrides({ ...defaults })
    }
  }

  return {
    currentModelMeta,
    currentParameterDefinitions,
    currentParamOverrides,
    availableParameterCount,
    updateParamOverrides,
    applyDefaultsFromModel
  }
}

/**
 * @deprecated 此函数已废弃，不再需要复杂的 resolver 逻辑
 * 请直接使用 useModelAdvancedParameters 并传入简化后的参数
 */
export function createTextModelMetaResolver(
  options: unknown
) {
  console.warn('[useModelAdvancedParameters] createTextModelMetaResolver is deprecated, use simplified interface')
  return () => undefined
}

/**
 * @deprecated 此函数已废弃，不再需要复杂的 resolver 逻辑
 * 请直接使用 useModelAdvancedParameters 并传入简化后的参数
 */
export function createImageModelMetaResolver(
  options: unknown
) {
  console.warn('[useModelAdvancedParameters] createImageModelMetaResolver is deprecated, use simplified interface')
  return () => undefined
}
