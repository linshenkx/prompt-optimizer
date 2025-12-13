/**
 * 评估服务 Composable
 *
 * 提供 LLM 智能评估功能的响应式接口
 * - 原始提示词评估
 * - 优化后提示词评估
 * - 对比评估
 *
 * 支持分类型独立评估状态，每种评估类型有独立的结果缓存
 */

import { reactive, ref, computed, type Ref, type ComputedRef } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getErrorMessage } from '../../utils/error'
import { useFunctionModelManager } from '../model/useFunctionModelManager'
import type { AppServices } from '../../types/services'
import type {
  EvaluationType,
  EvaluationResponse,
  OriginalEvaluationRequest,
  OptimizedEvaluationRequest,
  CompareEvaluationRequest,
  EvaluationModeConfig,
  EvaluationSubMode,
  ProEvaluationContext,
} from '@prompt-optimizer/core'

/** 评分等级类型 */
export type ScoreLevel = 'excellent' | 'good' | 'acceptable' | 'poor' | 'very-poor'

/**
 * 单个评估类型的状态
 */
export interface SingleEvaluationState {
  /** 是否正在评估 */
  isEvaluating: boolean
  /** 评估结果 */
  result: EvaluationResponse | null
  /** 流式输出内容 */
  streamContent: string
  /** 错误信息 */
  error: string | null
}

/**
 * 分类型评估状态
 */
export interface TypedEvaluationState {
  /** 原始提示词评估状态 */
  original: SingleEvaluationState
  /** 优化后评估状态 */
  optimized: SingleEvaluationState
  /** 对比评估状态 */
  compare: SingleEvaluationState
  /** 当前查看详情的类型 */
  activeDetailType: EvaluationType | null
}

/**
 * 评估 Composable 选项
 */
export interface UseEvaluationOptions {
  /** 评估模型 Key（如果未设置则使用默认） */
  evaluationModelKey?: Ref<string> | ComputedRef<string>
  /** 语言设置 */
  language?: Ref<string> | ComputedRef<string>
  /** 功能模式（必填） */
  functionMode: Ref<string> | ComputedRef<string>
  /** 子模式（必填） */
  subMode: Ref<string> | ComputedRef<string>
}

/**
 * 评估 Composable 返回类型
 */
export interface UseEvaluationReturn {
  /** 分类型评估状态 */
  state: TypedEvaluationState
  /** 详情面板是否可见 */
  isPanelVisible: Ref<boolean>

  // ===== 原始评估相关 =====
  /** 原始评估分数 */
  originalScore: ComputedRef<number | null>
  /** 原始评估等级 */
  originalLevel: ComputedRef<ScoreLevel | null>
  /** 是否正在评估原始 */
  isEvaluatingOriginal: ComputedRef<boolean>
  /** 是否有原始评估结果 */
  hasOriginalResult: ComputedRef<boolean>

  // ===== 优化评估相关 =====
  /** 优化评估分数 */
  optimizedScore: ComputedRef<number | null>
  /** 优化评估等级 */
  optimizedLevel: ComputedRef<ScoreLevel | null>
  /** 是否正在评估优化 */
  isEvaluatingOptimized: ComputedRef<boolean>
  /** 是否有优化评估结果 */
  hasOptimizedResult: ComputedRef<boolean>

  // ===== 对比评估相关 =====
  /** 对比评估分数 */
  compareScore: ComputedRef<number | null>
  /** 对比评估等级 */
  compareLevel: ComputedRef<ScoreLevel | null>
  /** 是否正在对比评估 */
  isEvaluatingCompare: ComputedRef<boolean>
  /** 是否有对比评估结果 */
  hasCompareResult: ComputedRef<boolean>
  /** 优化后是否更好 */
  isOptimizedBetter: ComputedRef<boolean | null>

  // ===== 通用计算属性 =====
  /** 是否有任何评估正在进行 */
  isAnyEvaluating: ComputedRef<boolean>
  /** 当前详情的评估结果 */
  activeResult: ComputedRef<EvaluationResponse | null>
  /** 当前详情的流式内容 */
  activeStreamContent: ComputedRef<string>
  /** 当前详情的错误 */
  activeError: ComputedRef<string | null>
  /** 当前详情的评分等级 */
  activeScoreLevel: ComputedRef<ScoreLevel | null>

  // ===== 评估方法 =====
  /** 评估原始提示词 */
  evaluateOriginal: (params: {
    originalPrompt: string
    testContent?: string
    testResult: string
    proContext?: ProEvaluationContext
  }) => Promise<void>
  /** 评估优化后提示词 */
  evaluateOptimized: (params: {
    originalPrompt: string
    optimizedPrompt: string
    testContent?: string
    testResult: string
    proContext?: ProEvaluationContext
  }) => Promise<void>
  /** 对比评估 */
  evaluateCompare: (params: {
    originalPrompt: string
    optimizedPrompt: string
    testContent?: string
    originalTestResult: string
    optimizedTestResult: string
    proContext?: ProEvaluationContext
  }) => Promise<void>

  // ===== 状态管理方法 =====
  /** 清除指定类型的评估结果 */
  clearResult: (type: EvaluationType) => void
  /** 清除所有评估结果 */
  clearAllResults: () => void
  /** 显示指定类型的详情面板 */
  showDetail: (type: EvaluationType) => void
  /** 关闭详情面板 */
  closePanel: () => void

  // ===== 工具方法 =====
  /** 根据分数获取等级 */
  getScoreLevel: (score: number | null) => ScoreLevel | null
}

/**
 * 创建单个评估状态的初始值
 */
function createInitialSingleState(): SingleEvaluationState {
  return {
    isEvaluating: false,
    result: null,
    streamContent: '',
    error: null,
  }
}

/**
 * 根据分数计算等级
 */
function calculateScoreLevel(score: number | null): ScoreLevel | null {
  if (score === null || score === undefined) return null
  if (score >= 90) return 'excellent'
  if (score >= 80) return 'good'
  if (score >= 60) return 'acceptable'
  if (score >= 40) return 'poor'
  return 'very-poor'
}

/**
 * 评估 Composable
 *
 * @param services 服务实例引用
 * @param options 选项配置
 * @returns 评估接口
 */
export function useEvaluation(
  services: Ref<AppServices | null>,
  options: UseEvaluationOptions
): UseEvaluationReturn {
  const toast = useToast()
  const { t, locale } = useI18n()

  // 获取功能模型管理器
  const functionModelManager = useFunctionModelManager(services)

  // 详情面板可见性
  const isPanelVisible = ref(false)

  // 分类型评估状态
  const state = reactive<TypedEvaluationState>({
    original: createInitialSingleState(),
    optimized: createInitialSingleState(),
    compare: createInitialSingleState(),
    activeDetailType: null,
  })

  // ===== 原始评估计算属性 =====
  const originalScore = computed(() => state.original.result?.score?.overall ?? null)
  const originalLevel = computed(() => calculateScoreLevel(originalScore.value))
  const isEvaluatingOriginal = computed(() => state.original.isEvaluating)
  const hasOriginalResult = computed(() => state.original.result !== null)

  // ===== 优化评估计算属性 =====
  const optimizedScore = computed(() => state.optimized.result?.score?.overall ?? null)
  const optimizedLevel = computed(() => calculateScoreLevel(optimizedScore.value))
  const isEvaluatingOptimized = computed(() => state.optimized.isEvaluating)
  const hasOptimizedResult = computed(() => state.optimized.result !== null)

  // ===== 对比评估计算属性 =====
  const compareScore = computed(() => state.compare.result?.score?.overall ?? null)
  const compareLevel = computed(() => calculateScoreLevel(compareScore.value))
  const isEvaluatingCompare = computed(() => state.compare.isEvaluating)
  const hasCompareResult = computed(() => state.compare.result !== null)
  const isOptimizedBetter = computed(() => state.compare.result?.isOptimizedBetter ?? null)

  // ===== 通用计算属性 =====
  const isAnyEvaluating = computed(() =>
    state.original.isEvaluating ||
    state.optimized.isEvaluating ||
    state.compare.isEvaluating
  )

  const activeResult = computed(() => {
    if (!state.activeDetailType) return null
    return state[state.activeDetailType].result
  })

  const activeStreamContent = computed(() => {
    if (!state.activeDetailType) return ''
    return state[state.activeDetailType].streamContent
  })

  const activeError = computed(() => {
    if (!state.activeDetailType) return null
    return state[state.activeDetailType].error
  })

  const activeScoreLevel = computed(() => {
    if (!state.activeDetailType) return null
    const score = state[state.activeDetailType].result?.score?.overall ?? null
    return calculateScoreLevel(score)
  })

  /**
   * 获取评估模型 Key
   * 规则：
   * - 只要用户在「功能模型」里配置过评估模型（持久化有值），就始终使用该值
   * - 否则使用调用方传入的 evaluationModelKey（通常为全局优化模型）
   * - 若调用方未传入，则兜底跟随当前全局优化模型
   */
  const getModelKey = async (): Promise<string> => {
    // 1) 持久化评估模型配置：一旦配置过就优先生效
    await functionModelManager.initialize()
    if (functionModelManager.evaluationModel.value) {
      return functionModelManager.evaluationModel.value
    }

    // 2) 默认：调用方提供的 key（通常是全局优化模型）
    const passedModelKey = options.evaluationModelKey?.value || ''
    if (passedModelKey) {
      return passedModelKey
    }

    // 3) 兜底：未设置评估模型且调用方未传入时，跟随当前全局优化模型
    const selectedOptimizeModel =
      (services.value?.modelManager as any)?.selectedOptimizeModel || ''
    if (selectedOptimizeModel) return selectedOptimizeModel
    return ''
  }

  /**
   * 获取语言设置
   */
  const getLanguage = (): string => {
    if (options.language?.value) {
      return options.language.value
    }
    // 从 i18n locale 获取语言，映射到模板支持的语言
    const currentLocale = locale.value
    if (currentLocale.startsWith('en')) {
      return 'en'
    }
    return 'zh'
  }

  /**
   * 获取评估模式配置
   */
  const getModeConfig = (): EvaluationModeConfig => {
    return {
      functionMode: options.functionMode.value as 'basic' | 'pro' | 'image',
      subMode: options.subMode.value as EvaluationSubMode,
    }
  }

  /**
   * 执行评估的通用方法
   */
  const executeEvaluation = async (
    type: EvaluationType,
    request: OriginalEvaluationRequest | OptimizedEvaluationRequest | CompareEvaluationRequest,
    openPanel: boolean = true
  ): Promise<void> => {
    const evaluationService = services.value?.evaluationService
    if (!evaluationService) {
      toast.error(t('evaluation.error.serviceNotReady'))
      return
    }

    const targetState = state[type]

    // 重置目标状态
    targetState.isEvaluating = true
    targetState.result = null
    targetState.streamContent = ''
    targetState.error = null

    // 设置当前详情类型并打开面板
    if (openPanel) {
      state.activeDetailType = type
      isPanelVisible.value = true
    }

    try {
      await evaluationService.evaluateStream(request, {
        onToken: (token: string) => {
          targetState.streamContent += token
        },
        onComplete: (result: EvaluationResponse) => {
          targetState.result = result
          targetState.isEvaluating = false
        },
        onError: (error: Error) => {
          targetState.error = getErrorMessage(error)
          targetState.isEvaluating = false
          toast.error(t('evaluation.error.failed', { error: targetState.error }))
        },
      })
    } catch (error) {
      targetState.error = getErrorMessage(error)
      targetState.isEvaluating = false
      toast.error(t('evaluation.error.failed', { error: targetState.error }))
    }
  }

  /**
   * 评估原始提示词
   */
  const evaluateOriginal = async (params: {
    originalPrompt: string
    testContent?: string
    testResult: string
    proContext?: ProEvaluationContext
  }): Promise<void> => {
    const request: OriginalEvaluationRequest = {
      type: 'original',
      originalPrompt: params.originalPrompt,
      testContent: params.testContent || '',
      testResult: params.testResult,
      evaluationModelKey: await getModelKey(),
      variables: { language: getLanguage() },
      mode: getModeConfig(),
      proContext: params.proContext,
    }
    await executeEvaluation('original', request, false)
  }

  /**
   * 评估优化后提示词
   */
  const evaluateOptimized = async (params: {
    originalPrompt: string
    optimizedPrompt: string
    testContent?: string
    testResult: string
    proContext?: ProEvaluationContext
  }): Promise<void> => {
    const request: OptimizedEvaluationRequest = {
      type: 'optimized',
      originalPrompt: params.originalPrompt,
      optimizedPrompt: params.optimizedPrompt,
      testContent: params.testContent || '',
      testResult: params.testResult,
      evaluationModelKey: await getModelKey(),
      variables: { language: getLanguage() },
      mode: getModeConfig(),
      proContext: params.proContext,
    }
    await executeEvaluation('optimized', request, false)
  }

  /**
   * 对比评估
   */
  const evaluateCompare = async (params: {
    originalPrompt: string
    optimizedPrompt: string
    testContent?: string
    originalTestResult: string
    optimizedTestResult: string
    proContext?: ProEvaluationContext
  }): Promise<void> => {
    const request: CompareEvaluationRequest = {
      type: 'compare',
      originalPrompt: params.originalPrompt,
      optimizedPrompt: params.optimizedPrompt,
      testContent: params.testContent || '',
      originalTestResult: params.originalTestResult,
      optimizedTestResult: params.optimizedTestResult,
      evaluationModelKey: await getModelKey(),
      variables: { language: getLanguage() },
      mode: getModeConfig(),
      proContext: params.proContext,
    }
    await executeEvaluation('compare', request, false)
  }

  /**
   * 清除指定类型的评估结果
   */
  const clearResult = (type: EvaluationType): void => {
    const targetState = state[type]
    targetState.result = null
    targetState.streamContent = ''
    targetState.error = null

    // 如果当前详情是被清除的类型，关闭面板
    if (state.activeDetailType === type) {
      state.activeDetailType = null
      isPanelVisible.value = false
    }
  }

  /**
   * 清除所有评估结果
   */
  const clearAllResults = (): void => {
    clearResult('original')
    clearResult('optimized')
    clearResult('compare')
  }

  /**
   * 显示指定类型的详情面板
   */
  const showDetail = (type: EvaluationType): void => {
    state.activeDetailType = type
    isPanelVisible.value = true
  }

  /**
   * 关闭详情面板
   */
  const closePanel = (): void => {
    isPanelVisible.value = false
  }

  /**
   * 根据分数获取等级
   */
  const getScoreLevel = (score: number | null): ScoreLevel | null => {
    return calculateScoreLevel(score)
  }

  return {
    state,
    isPanelVisible,

    // 原始评估
    originalScore,
    originalLevel,
    isEvaluatingOriginal,
    hasOriginalResult,

    // 优化评估
    optimizedScore,
    optimizedLevel,
    isEvaluatingOptimized,
    hasOptimizedResult,

    // 对比评估
    compareScore,
    compareLevel,
    isEvaluatingCompare,
    hasCompareResult,
    isOptimizedBetter,

    // 通用
    isAnyEvaluating,
    activeResult,
    activeStreamContent,
    activeError,
    activeScoreLevel,

    // 方法
    evaluateOriginal,
    evaluateOptimized,
    evaluateCompare,
    clearResult,
    clearAllResults,
    showDetail,
    closePanel,
    getScoreLevel,
  }
}
