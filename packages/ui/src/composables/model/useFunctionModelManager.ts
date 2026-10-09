/**
 * 功能模型管理器 Composable
 *
 * 提供评估模型配置的响应式接口
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { usePreferences } from '../storage/usePreferenceManager'
import {
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
  /** 图片识别模型 */
  imageRecognitionModel: Ref<string>
  /** 有效的图片识别模型（图片提取功能要求显式设置） */
  effectiveImageRecognitionModel: ComputedRef<string>
  /** 是否正在加载 */
  isLoading: Ref<boolean>
  /** 是否已初始化 */
  isInitialized: Ref<boolean>

  /** 设置评估模型 */
  setEvaluationModel: (modelId: string) => Promise<void>
  /** 设置图片识别模型 */
  setImageRecognitionModel: (modelId: string) => Promise<void>
  /** 获取有效评估模型（兼容旧 API） */
  getEffectiveEvaluationModel: () => ComputedRef<string>
  /** 按评估配置、全局优化模型、调用方回退模型的顺序选择 */
  resolveEvaluationModelKey: (fallbackModelKey?: string) => string
  /** 获取有效图片识别模型（兼容旧 API） */
  getEffectiveImageRecognitionModel: () => ComputedRef<string>

  /** 初始化 */
  initialize: () => Promise<void>
  /** 刷新配置 */
  refresh: () => Promise<void>
}

// 全局单例实例（评估模型配置是全局的，所有组件共享）
// 注意：单例模式适用于当前架构（Web/Extension/Desktop 各自独立进程/页面）
// 如果未来出现同一页面多宿主场景，需要改为 keyed 单例或依赖注入模式
let instance: UseFunctionModelManagerReturn | null = null
// 保存可更新的 globalOptimizeModelKey 引用
let globalOptimizeModelKeyRef: Ref<string> | ComputedRef<string> | null = null

/**
 * 功能模型管理器 Composable
 *
 * 使用全局单例模式，因为评估模型配置是全局设置，不需要按 services 区分。
 *
 * 架构约束：
 * - 当前 Web/Extension/Desktop 各自独立运行，不共享 JS 上下文
 * - 单例绑定首次传入的 services，后续调用复用同一实例
 * - 如需多宿主支持，可改用 resetFunctionModelManagerSingleton() 重置或改为 keyed 单例
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
  const imageRecognitionModel = ref('')
  const globalOptimizeModelFallback = ref('')
  let initPromise: Promise<void> | null = null

  // 统一评估模型优先级，避免工作区测试模型覆盖全局优化模型
  const resolveEvaluationModelKey = (fallbackModelKey = ''): string => {
    // 优先级：
    // 1) 用户配置的评估模型
    // 2) 调用方传入的全局优化模型 key（运行时状态）
    // 3) 调用方的回退模型（例如工作区测试模型）
    // 4) 首个启用模型
    return (
      evaluationModel.value ||
      globalOptimizeModelKeyRef?.value ||
      fallbackModelKey ||
      globalOptimizeModelFallback.value
    )
  }
  // 固定的 computed 使用可更新的全局模型引用
  const effectiveEvaluationModel = computed(() => resolveEvaluationModelKey())

  const effectiveImageRecognitionModel = computed(() => {
    return imageRecognitionModel.value
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
        // 兜底：从当前可用模型中选一个
        if (services.value?.modelManager) {
          const allModels = await services.value.modelManager.getAllModels()
          const enabledModels = allModels.filter(m => m.enabled)
          globalOptimizeModelFallback.value = enabledModels[0]?.id || ''
        } else {
          globalOptimizeModelFallback.value = ''
        }

        // 读取评估模型
        const savedEvaluationModel = await getPreference(
          FUNCTION_MODEL_KEYS.EVALUATION_MODEL,
          ''
        )
        evaluationModel.value = savedEvaluationModel

        const savedImageRecognitionModel = await getPreference(
          FUNCTION_MODEL_KEYS.IMAGE_RECOGNITION_MODEL,
          ''
        )
        imageRecognitionModel.value = savedImageRecognitionModel

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

  const setImageRecognitionModel = async (modelId: string): Promise<void> => {
    imageRecognitionModel.value = modelId
    await setPreference(FUNCTION_MODEL_KEYS.IMAGE_RECOGNITION_MODEL, modelId)
  }

  // 获取有效评估模型（返回同一个 computed 实例）
  const getEffectiveEvaluationModel = (): ComputedRef<string> => {
    return effectiveEvaluationModel
  }

  const getEffectiveImageRecognitionModel = (): ComputedRef<string> => {
    return effectiveImageRecognitionModel
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
    imageRecognitionModel,
    effectiveImageRecognitionModel,
    isLoading,
    isInitialized,
    setEvaluationModel,
    setImageRecognitionModel,
    getEffectiveEvaluationModel,
    resolveEvaluationModelKey,
    getEffectiveImageRecognitionModel,
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
