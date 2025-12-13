/**
 * 功能模型管理器 Composable
 *
 * 提供评估模型配置的响应式接口
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { usePreferences } from '../storage/usePreferenceManager'
import {
  MODEL_SELECTION_KEYS,
  FUNCTION_MODEL_KEYS,
} from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'

/**
 * 功能模型管理器返回接口
 */
export interface UseFunctionModelManagerReturn {
  /** 评估模型 */
  evaluationModel: Ref<string>
  /** 有效的评估模型（如果未设置则跟随当前全局优化模型） */
  effectiveEvaluationModel: ComputedRef<string>
  /** 是否正在加载 */
  isLoading: Ref<boolean>
  /** 是否已初始化 */
  isInitialized: Ref<boolean>

  /** 设置评估模型 */
  setEvaluationModel: (modelId: string) => Promise<void>
  /** 获取有效评估模型（兼容旧 API） */
  getEffectiveEvaluationModel: () => ComputedRef<string>

  /** 初始化 */
  initialize: () => Promise<void>
  /** 刷新配置 */
  refresh: () => Promise<void>
}

// 全局单例实例（评估模型配置是全局的，所有组件共享）
let instance: UseFunctionModelManagerReturn | null = null
// 保存可更新的 globalOptimizeModelKey 引用
let globalOptimizeModelKeyRef: Ref<string> | ComputedRef<string> | null = null

/**
 * 功能模型管理器 Composable
 *
 * 使用全局单例模式，因为评估模型配置是全局设置，不需要按 services 区分
 */
export function useFunctionModelManager(
  services: Ref<AppServices | null>,
  globalOptimizeModelKey?: Ref<string> | ComputedRef<string>
): UseFunctionModelManagerReturn {
  // 如果传入了新的 globalOptimizeModelKey，更新引用
  if (globalOptimizeModelKey) {
    globalOptimizeModelKeyRef = globalOptimizeModelKey
  }

  // 如果已有实例，直接返回（评估模型配置是全局的）
  if (instance) {
    return instance
  }

  const { getPreference, setPreference } = usePreferences(services)

  const isLoading = ref(false)
  const isInitialized = ref(false)
  const evaluationModel = ref('')
  const globalOptimizeModelFallback = ref('')
  let initPromise: Promise<void> | null = null

  // 创建固定的 computed（只创建一次）
  // 使用全局的 globalOptimizeModelKeyRef，确保后续传入的参数能生效
  const effectiveEvaluationModel = computed(() => {
    const selectedOptimizeModel =
      globalOptimizeModelKeyRef?.value ||
      (services.value?.modelManager as any)?.selectedOptimizeModel ||
      ''
    return (
      evaluationModel.value ||
      selectedOptimizeModel ||
      globalOptimizeModelFallback.value
    )
  })

  // 初始化
  const initialize = async (): Promise<void> => {
    if (initPromise) {
      return initPromise
    }

    initPromise = (async () => {
      if (isInitialized.value) return

      isLoading.value = true
      try {
        // 读取全局优化模型（偏好）作为兜底：当运行时 services.modelManager 不可用时使用
        globalOptimizeModelFallback.value = await getPreference(
          MODEL_SELECTION_KEYS.OPTIMIZE_MODEL,
          ''
        )

        // 读取评估模型
        const savedEvaluationModel = await getPreference(
          FUNCTION_MODEL_KEYS.EVALUATION_MODEL,
          ''
        )
        evaluationModel.value = savedEvaluationModel

        isInitialized.value = true
      } finally {
        isLoading.value = false
      }
    })()

    return initPromise
  }

  const refresh = async (): Promise<void> => {
    isInitialized.value = false
    initPromise = null
    await initialize()
  }

  // 设置评估模型
  const setEvaluationModel = async (modelId: string): Promise<void> => {
    evaluationModel.value = modelId
    await setPreference(FUNCTION_MODEL_KEYS.EVALUATION_MODEL, modelId)
  }

  // 获取有效评估模型（返回同一个 computed 实例）
  const getEffectiveEvaluationModel = (): ComputedRef<string> => {
    return effectiveEvaluationModel
  }

  // 监听服务变化，自动初始化
  watch(
    services,
    async (newServices) => {
      if (newServices && !isInitialized.value) {
        await initialize()
      }
    },
    { immediate: true }
  )

  instance = {
    evaluationModel,
    effectiveEvaluationModel,
    isLoading,
    isInitialized,
    setEvaluationModel,
    getEffectiveEvaluationModel,
    initialize,
    refresh,
  }

  return instance
}

/**
 * 重置单例（用于测试）
 */
export function resetFunctionModelManagerSingleton(): void {
  instance = null
  globalOptimizeModelKeyRef = null
}
