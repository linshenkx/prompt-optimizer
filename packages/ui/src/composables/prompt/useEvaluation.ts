/**
 * 评估服务 Composable
 *
 * 提供 LLM 智能评估功能的响应式接口
 * - 单结果评估（按 variantId 区分）
 * - 对比评估
 * - 提示词分析
 */

import { reactive, ref, computed, type Ref, type ComputedRef } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getI18nErrorMessage } from '../../utils/error'
import { useFunctionModelManager } from '../model/useFunctionModelManager'
import {
  getCompareJudgements,
  getCompareMode,
  getCompareSnapshotRoles,
  getCompareStopSignals,
  type CompareJudgementRecord,
} from './compareResultMetadata'
import type { AppServices } from '../../types/services'
import type {
  EvaluationType,
  EvaluationResponse,
  EvaluationRequest,
  ResultEvaluationRequest,
  CompareEvaluationRequest,
  PromptOnlyEvaluationRequest,
  PromptIterateEvaluationRequest,
  EvaluationModeConfig,
  EvaluationSubMode,
  EvaluationTarget,
  EvaluationTestCase,
  EvaluationSnapshot,
  CompareAnalysisHints,
  CompareStopSignals,
  StructuredCompareRole,
} from '@prompt-optimizer/core'

/** 评分等级类型 */
export type ScoreLevel = 'excellent' | 'good' | 'acceptable' | 'poor' | 'very-poor'

/**
 * 单个评估类型的状态
 */
export interface SingleEvaluationState {
  isEvaluating: boolean
  result: EvaluationResponse | null
  streamContent: string
  error: string | null
}

export interface EvaluationDetailTarget {
  type: EvaluationType
  variantId?: string
}

/**
 * 分类型评估状态
 */
export interface TypedEvaluationState {
  /** 单结果评估状态（按 variantId 分桶） */
  result: Record<string, SingleEvaluationState>
  /** 对比评估状态 */
  compare: SingleEvaluationState
  /** 仅提示词评估状态（无需测试结果） */
  'prompt-only': SingleEvaluationState
  /** 带迭代需求的提示词评估状态 */
  'prompt-iterate': SingleEvaluationState
  /** 当前查看详情的目标 */
  activeDetail: EvaluationDetailTarget | null
}

/**
 * 评估 Composable 选项
 */
export interface UseEvaluationOptions {
  evaluationModelKey?: Ref<string> | ComputedRef<string>
  resolveEvaluationModelKey?: (type: EvaluationType) => string | Promise<string>
  language?: Ref<string> | ComputedRef<string>
  functionMode: Ref<string> | ComputedRef<string>
  subMode: Ref<string> | ComputedRef<string>
}

export interface ResultEvaluationParams {
  variantId: string
  target: EvaluationTarget
  testCase: EvaluationTestCase
  snapshot: EvaluationSnapshot
  focus?: string
}

/**
 * 评估 Composable 返回类型
 */
export interface UseEvaluationReturn {
  state: TypedEvaluationState
  isPanelVisible: Ref<boolean>

  compareScore: ComputedRef<number | null>
  compareLevel: ComputedRef<ScoreLevel | null>
  isEvaluatingCompare: ComputedRef<boolean>
  hasCompareResult: ComputedRef<boolean>
  compareMode: ComputedRef<'generic' | 'structured' | null>
  compareStopSignals: ComputedRef<CompareStopSignals | null>
  compareSnapshotRoles: ComputedRef<Record<string, StructuredCompareRole> | null>
  compareJudgements: ComputedRef<CompareJudgementRecord[]>

  promptOnlyScore: ComputedRef<number | null>
  promptOnlyLevel: ComputedRef<ScoreLevel | null>
  isEvaluatingPromptOnly: ComputedRef<boolean>
  hasPromptOnlyResult: ComputedRef<boolean>

  promptIterateScore: ComputedRef<number | null>
  promptIterateLevel: ComputedRef<ScoreLevel | null>
  isEvaluatingPromptIterate: ComputedRef<boolean>
  hasPromptIterateResult: ComputedRef<boolean>

  isAnyEvaluating: ComputedRef<boolean>
  activeResult: ComputedRef<EvaluationResponse | null>
  activeStreamContent: ComputedRef<string>
  activeError: ComputedRef<string | null>
  activeScoreLevel: ComputedRef<ScoreLevel | null>

  evaluateResult: (params: ResultEvaluationParams) => Promise<void>
  evaluateCompare: (params: {
    target: EvaluationTarget
    testCases: EvaluationTestCase[]
    snapshots: EvaluationSnapshot[]
    compareHints?: CompareAnalysisHints
    focus?: string
  }) => Promise<void>
  evaluatePromptOnly: (params: {
    target: EvaluationTarget
    focus?: string
    variables?: Record<string, string>
  }) => Promise<void>
  evaluatePromptIterate: (params: {
    target: EvaluationTarget
    iterateRequirement: string
    focus?: string
    variables?: Record<string, string>
  }) => Promise<void>

  clearResult: (type: EvaluationType, variantId?: string) => void
  clearAllResults: () => void
  showDetail: (type: EvaluationType, variantId?: string) => void
  closePanel: () => void

  getScoreLevel: (score: number | null) => ScoreLevel | null
  getResultState: (variantId: string) => SingleEvaluationState
  getResultScore: (variantId: string) => number | null
  getResultLevel: (variantId: string) => ScoreLevel | null
  isEvaluatingResult: (variantId: string) => boolean
  hasResultEvaluation: (variantId: string) => boolean
}

function createInitialSingleState(): SingleEvaluationState {
  return {
    isEvaluating: false,
    result: null,
    streamContent: '',
    error: null,
  }
}

function calculateScoreLevel(score: number | null): ScoreLevel | null {
  if (score === null || score === undefined) return null
  if (score >= 90) return 'excellent'
  if (score >= 80) return 'good'
  if (score >= 60) return 'acceptable'
  if (score >= 40) return 'poor'
  return 'very-poor'
}

export function useEvaluation(
  services: Ref<AppServices | null>,
  options: UseEvaluationOptions
): UseEvaluationReturn {
  const toast = useToast()
  const { t, locale } = useI18n() as unknown as {
    t: (key: string, ...args: unknown[]) => string
    locale: Ref<string>
  }
  const functionModelManager = useFunctionModelManager(services)
  const isPanelVisible = ref(false)

  const state = reactive<TypedEvaluationState>({
    result: {},
    compare: createInitialSingleState(),
    'prompt-only': createInitialSingleState(),
    'prompt-iterate': createInitialSingleState(),
    activeDetail: null,
  })

  const ensureResultState = (variantId: string): SingleEvaluationState => {
    const id = variantId.trim()
    if (!id) {
      return createInitialSingleState()
    }

    if (!state.result[id]) {
      state.result[id] = reactive(createInitialSingleState()) as SingleEvaluationState
    }
    return state.result[id]
  }

  const getTargetState = (type: EvaluationType, variantId?: string): SingleEvaluationState | null => {
    if (type === 'result') {
      if (!variantId?.trim()) return null
      return ensureResultState(variantId)
    }
    return state[type]
  }

  const compareScore = computed(() => state.compare.result?.score?.overall ?? null)
  const compareLevel = computed(() => calculateScoreLevel(compareScore.value))
  const isEvaluatingCompare = computed(() => state.compare.isEvaluating)
  const hasCompareResult = computed(() => state.compare.result !== null)
  const compareMode = computed(
    () => getCompareMode(state.compare.result)
  )
  const compareStopSignals = computed(
    () => getCompareStopSignals(state.compare.result)
  )
  const compareSnapshotRoles = computed(
    () => getCompareSnapshotRoles(state.compare.result)
  )
  const compareJudgements = computed(
    () => getCompareJudgements(state.compare.result)
  )

  const promptOnlyScore = computed(() => state['prompt-only'].result?.score?.overall ?? null)
  const promptOnlyLevel = computed(() => calculateScoreLevel(promptOnlyScore.value))
  const isEvaluatingPromptOnly = computed(() => state['prompt-only'].isEvaluating)
  const hasPromptOnlyResult = computed(() => state['prompt-only'].result !== null)

  const promptIterateScore = computed(() => state['prompt-iterate'].result?.score?.overall ?? null)
  const promptIterateLevel = computed(() => calculateScoreLevel(promptIterateScore.value))
  const isEvaluatingPromptIterate = computed(() => state['prompt-iterate'].isEvaluating)
  const hasPromptIterateResult = computed(() => state['prompt-iterate'].result !== null)

  const isAnyEvaluating = computed(() =>
    Object.values(state.result).some((item) => item.isEvaluating) ||
    state.compare.isEvaluating ||
    state['prompt-only'].isEvaluating ||
    state['prompt-iterate'].isEvaluating
  )

  const activeTargetState = computed(() => {
    const target = state.activeDetail
    if (!target) return null
    return getTargetState(target.type, target.variantId)
  })

  const activeResult = computed(() => activeTargetState.value?.result ?? null)
  const activeStreamContent = computed(() => activeTargetState.value?.streamContent ?? '')
  const activeError = computed(() => activeTargetState.value?.error ?? null)
  const activeScoreLevel = computed(() =>
    calculateScoreLevel(activeTargetState.value?.result?.score?.overall ?? null)
  )

  const getModelKey = async (type: EvaluationType): Promise<string> => {
    if (options.resolveEvaluationModelKey) {
      const resolvedModelKey = (await options.resolveEvaluationModelKey(type))?.trim() || ''
      if (resolvedModelKey) {
        return resolvedModelKey
      }
    }

    await functionModelManager.initialize()
    return functionModelManager.resolveEvaluationModelKey(options.evaluationModelKey?.value)
  }

  const getLanguage = (): string => {
    if (options.language?.value) {
      return options.language.value
    }
    return locale.value.startsWith('en') ? 'en' : 'zh'
  }

  const getModeConfig = (): EvaluationModeConfig => ({
    functionMode: options.functionMode.value as 'basic' | 'pro' | 'image',
    subMode: options.subMode.value as EvaluationSubMode,
  })

  const executeEvaluation = async (
    type: EvaluationType,
    request: EvaluationRequest,
    options: { variantId?: string; openPanel?: boolean } = {}
  ): Promise<void> => {
    const evaluationService = services.value?.evaluationService
    if (!evaluationService) {
      toast.error(t('evaluation.error.serviceNotReady'))
      return
    }

    const targetState = getTargetState(type, options.variantId)
    if (!targetState) return

    targetState.isEvaluating = true
    targetState.result = null
    targetState.streamContent = ''
    targetState.error = null

    if (options.openPanel !== false) {
      state.activeDetail = {
        type,
        variantId: options.variantId,
      }
      isPanelVisible.value = true
    }

    try {
      await evaluationService.evaluateStream(request, {
        onToken: (token: string) => {
          if (!targetState.isEvaluating) return
          targetState.streamContent += token
        },
        onComplete: (result: EvaluationResponse) => {
          if (!targetState.isEvaluating) return
          targetState.result = result
          targetState.isEvaluating = false
        },
        onError: (error: Error) => {
          if (!targetState.isEvaluating) return
          targetState.error = getI18nErrorMessage(error)
          targetState.isEvaluating = false
          toast.error(t('evaluation.error.failed', { error: targetState.error }))
        },
      })
    } catch (error) {
      targetState.error = getI18nErrorMessage(error)
      targetState.isEvaluating = false
      toast.error(t('evaluation.error.failed', { error: targetState.error }))
    }
  }

  const evaluateResult = async (params: ResultEvaluationParams): Promise<void> => {
    const request: ResultEvaluationRequest = {
      type: 'result',
      target: params.target,
      testCase: params.testCase,
      snapshot: params.snapshot,
      evaluationModelKey: await getModelKey('result'),
      variables: { language: getLanguage() },
      mode: getModeConfig(),
      focus: params.focus?.trim()
        ? {
            content: params.focus.trim(),
            source: 'user',
            priority: 'highest',
          }
        : undefined,
    }

    await executeEvaluation('result', request, {
      variantId: params.variantId,
      openPanel: false,
    })
  }

  const evaluateCompare = async (params: {
    target: EvaluationTarget
    testCases: EvaluationTestCase[]
    snapshots: EvaluationSnapshot[]
    compareHints?: CompareAnalysisHints
    focus?: string
  }): Promise<void> => {
    const request: CompareEvaluationRequest = {
      type: 'compare',
      target: params.target,
      testCases: params.testCases,
      snapshots: params.snapshots,
      compareHints: params.compareHints,
      evaluationModelKey: await getModelKey('compare'),
      variables: { language: getLanguage() },
      mode: getModeConfig(),
      focus: params.focus?.trim()
        ? {
            content: params.focus.trim(),
            source: 'user',
            priority: 'highest',
          }
        : undefined,
    }
    await executeEvaluation('compare', request, { openPanel: false })
  }

  const evaluatePromptOnly = async (params: {
    target: EvaluationTarget
    focus?: string
    variables?: Record<string, string>
  }): Promise<void> => {
    const request: PromptOnlyEvaluationRequest = {
      type: 'prompt-only',
      target: params.target,
      evaluationModelKey: await getModelKey('prompt-only'),
      variables: {
        ...(params.variables || {}),
        language: getLanguage(),
      },
      mode: getModeConfig(),
      focus: params.focus?.trim()
        ? {
            content: params.focus.trim(),
            source: 'user',
            priority: 'highest',
          }
        : undefined,
    }
    await executeEvaluation('prompt-only', request)
  }

  const evaluatePromptIterate = async (params: {
    target: EvaluationTarget
    iterateRequirement: string
    focus?: string
    variables?: Record<string, string>
  }): Promise<void> => {
    const request: PromptIterateEvaluationRequest = {
      type: 'prompt-iterate',
      target: params.target,
      iterateRequirement: params.iterateRequirement,
      evaluationModelKey: await getModelKey('prompt-iterate'),
      variables: {
        ...(params.variables || {}),
        language: getLanguage(),
      },
      mode: getModeConfig(),
      focus: params.focus?.trim()
        ? {
            content: params.focus.trim(),
            source: 'user',
            priority: 'highest',
          }
        : undefined,
    }
    await executeEvaluation('prompt-iterate', request)
  }

  const clearResult = (type: EvaluationType, variantId?: string): void => {
    const targetState = getTargetState(type, variantId)
    if (!targetState) return

    targetState.isEvaluating = false
    targetState.result = null
    targetState.streamContent = ''
    targetState.error = null

    if (
      state.activeDetail?.type === type &&
      state.activeDetail?.variantId === variantId
    ) {
      state.activeDetail = null
      isPanelVisible.value = false
    }
  }

  const clearAllResults = (): void => {
    Object.keys(state.result).forEach((variantId) => clearResult('result', variantId))
    clearResult('compare')
    clearResult('prompt-only')
    clearResult('prompt-iterate')
  }

  const showDetail = (type: EvaluationType, variantId?: string): void => {
    if (type === 'result' && !variantId?.trim()) return
    state.activeDetail = { type, variantId }
    isPanelVisible.value = true
  }

  const closePanel = (): void => {
    isPanelVisible.value = false
  }

  const getScoreLevel = (score: number | null): ScoreLevel | null => calculateScoreLevel(score)
  const getResultState = (variantId: string): SingleEvaluationState => ensureResultState(variantId)
  const getResultScore = (variantId: string): number | null =>
    ensureResultState(variantId).result?.score?.overall ?? null
  const getResultLevel = (variantId: string): ScoreLevel | null =>
    calculateScoreLevel(getResultScore(variantId))
  const isEvaluatingResult = (variantId: string): boolean => ensureResultState(variantId).isEvaluating
  const hasResultEvaluation = (variantId: string): boolean => ensureResultState(variantId).result !== null

  return {
    state,
    isPanelVisible,
    compareScore,
    compareLevel,
    isEvaluatingCompare,
    hasCompareResult,
    compareMode,
    compareStopSignals,
    compareSnapshotRoles,
    compareJudgements,
    promptOnlyScore,
    promptOnlyLevel,
    isEvaluatingPromptOnly,
    hasPromptOnlyResult,
    promptIterateScore,
    promptIterateLevel,
    isEvaluatingPromptIterate,
    hasPromptIterateResult,
    isAnyEvaluating,
    activeResult,
    activeStreamContent,
    activeError,
    activeScoreLevel,
    evaluateResult,
    evaluateCompare,
    evaluatePromptOnly,
    evaluatePromptIterate,
    clearResult,
    clearAllResults,
    showDetail,
    closePanel,
    getScoreLevel,
    getResultState,
    getResultScore,
    getResultLevel,
    isEvaluatingResult,
    hasResultEvaluation,
  }
}
