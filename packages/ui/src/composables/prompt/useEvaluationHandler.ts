/**
 * 评估处理器 Composable
 *
 * 封装评估功能的完整处理逻辑，便于在不同组件中复用
 * 将 useEvaluation 与业务逻辑整合，提供开箱即用的评估功能
 */

import { computed, watch, type Ref, type ComputedRef } from 'vue'
import { useEvaluation, type UseEvaluationReturn, type ScoreLevel } from './useEvaluation'
import type { AppServices } from '../../types/services'
import type { EvaluationType, EvaluationResponse, ProEvaluationContext } from '@prompt-optimizer/core'
import type { PersistedEvaluationResults } from '../../types/evaluation'

/**
 * 测试结果数据结构
 */
export interface TestResultsData {
  originalResult?: string
  optimizedResult?: string
}

/**
 * 评估处理器选项
 */
export interface UseEvaluationHandlerOptions {
  /** 服务实例 */
  services: Ref<AppServices | null>
  /** 原始提示词 */
  originalPrompt: Ref<string> | ComputedRef<string>
  /** 优化后的提示词 */
  optimizedPrompt: Ref<string> | ComputedRef<string>
  /** 测试内容 */
  testContent: Ref<string> | ComputedRef<string>
  /** 测试结果数据 */
  testResults: Ref<TestResultsData | null>
  /** 评估模型 Key */
  evaluationModelKey: Ref<string> | ComputedRef<string>
  /** 功能模式（必填） */
  functionMode: Ref<string> | ComputedRef<string>
  /** 子模式（必填） */
  subMode: Ref<string> | ComputedRef<string>
  /**
   * Pro 模式上下文（可选）
   * - Pro-System: 包含 targetMessage 和 conversationMessages
   * - Pro-User: 包含 variables, rawPrompt, resolvedPrompt
   */
  proContext?: Ref<ProEvaluationContext | undefined> | ComputedRef<ProEvaluationContext | undefined>
  /**
   * 当前迭代需求（可选）
   * 用于 prompt-iterate 类型的重新评估，来自当前版本的 iterationNote
   */
  currentIterateRequirement?: Ref<string> | ComputedRef<string>
  /**
   * 外部评估实例（可选）
   * 如果提供，则使用该实例而不是创建新的
   * 用于 Workspace 共享全局评估状态的场景
   */
  externalEvaluation?: UseEvaluationReturn

  /**
   * Persist evaluation results (per type) into a submode session store.
   *
   * This keeps results stable across restart and avoids global cross-mode state.
   */
  persistedResults?: Ref<PersistedEvaluationResults>
}

/**
 * PromptPanel 组件引用类型（用于打开迭代弹窗）
 */
export interface PromptPanelRef {
  openIterateDialog?: (input?: string) => void
}

/**
 * 评估处理器返回类型
 */
export interface UseEvaluationHandlerReturn {
  /** 原始 useEvaluation 返回值 */
  evaluation: UseEvaluationReturn

  /** 执行评估 */
  handleEvaluate: (type: EvaluationType, options?: { userFeedback?: string }) => Promise<void>

  /** 带用户反馈的评估 */
  handleEvaluateWithFeedback: (type: EvaluationType, userFeedback: string) => Promise<void>

  /** 重新评估（从详情面板触发） */
  handleReEvaluate: () => Promise<void>

  /** 带反馈评估（基于当前详情类型触发） */
  handleEvaluateActiveWithFeedback: (userFeedback: string) => Promise<void>

  /**
   * 测试前清空评估结果
   * 应在执行测试前调用，确保旧的评估结果不会残留
   */
  clearBeforeTest: () => void

  /**
   * 创建应用改进建议的处理器
   * @param promptPanelRef PromptPanel 组件引用
   * @returns 处理函数，可直接绑定到 @apply-improvement 事件
   */
  createApplyImprovementHandler: (
    promptPanelRef: Ref<PromptPanelRef | null>
  ) => (payload: { improvement: string; type: EvaluationType }) => void

  /** TestAreaPanel 评估事件处理器 */
  handlers: {
    onEvaluateOriginal: () => Promise<void>
    onEvaluateOptimized: () => Promise<void>
    onEvaluateCompare: () => Promise<void>
    onShowOriginalDetail: () => void
    onShowOptimizedDetail: () => void
    onShowCompareDetail: () => void
  }

  /** 用于 TestAreaPanel 的评估相关 props（响应式） */
  testAreaEvaluationProps: ComputedRef<{
    showEvaluation: boolean
    hasOriginalResult: boolean
    hasOptimizedResult: boolean
    isEvaluatingOriginal: boolean
    isEvaluatingOptimized: boolean
    originalScore: number | null
    optimizedScore: number | null
    hasOriginalEvaluation: boolean
    hasOptimizedEvaluation: boolean
    // 新增：评估结果和等级，用于悬浮预览
    originalEvaluationResult: EvaluationResponse | null
    optimizedEvaluationResult: EvaluationResponse | null
    originalScoreLevel: ScoreLevel | null
    optimizedScoreLevel: ScoreLevel | null
  }>

  /** 用于对比评估的计算属性 */
  compareEvaluation: {
    hasCompareResult: ComputedRef<boolean>
    isEvaluatingCompare: ComputedRef<boolean>
    compareScore: ComputedRef<number | null>
  }

  /** 用于 EvaluationPanel 的 props（响应式） */
  panelProps: ComputedRef<{
    show: boolean
    isEvaluating: boolean
    result: EvaluationResponse | null
    streamContent: string
    error: string | null
    currentType: EvaluationType | null
    scoreLevel: ScoreLevel | null
  }>
}

/**
 * 评估处理器 Composable
 *
 * @param options 配置选项
 * @returns 评估处理器接口
 *
 * @example
 * ```ts
 * const evaluationHandler = useEvaluationHandler({
 *   services,
 *   originalPrompt: toRef(optimizer, 'prompt'),
 *   optimizedPrompt: toRef(optimizer, 'optimizedPrompt'),
 *   testContent,
 *   testResults,
 *   evaluationModelKey: computed(() => modelManager.selectedOptimizeModel),
 * })
 *
 * // 在 TestAreaPanel 中使用
 * <TestAreaPanel
 *   v-bind="evaluationHandler.testAreaEvaluationProps.value"
 *   @evaluate-original="evaluationHandler.handlers.onEvaluateOriginal"
 *   @evaluate-optimized="evaluationHandler.handlers.onEvaluateOptimized"
 *   @show-original-detail="evaluationHandler.handlers.onShowOriginalDetail"
 *   @show-optimized-detail="evaluationHandler.handlers.onShowOptimizedDetail"
 * />
 * ```
 */
export function useEvaluationHandler(
  options: UseEvaluationHandlerOptions
): UseEvaluationHandlerReturn {
  const {
    services,
    originalPrompt,
    optimizedPrompt,
    testContent,
    testResults,
    evaluationModelKey,
    functionMode,
    subMode,
    proContext,
    currentIterateRequirement,
    externalEvaluation,
    persistedResults,
  } = options

  // 使用外部评估实例或创建新的
  // 当 Workspace 需要共享全局评估状态时，应传入 externalEvaluation
  const evaluation = externalEvaluation ?? useEvaluation(services, {
    evaluationModelKey,
    functionMode,
    subMode,
  })

  // Optional: bind evaluation results to a persisted store.
  // - Initialize evaluation state from persisted results.
  // - Keep persisted results updated when evaluation results change.
  if (persistedResults) {
    // Initialize (restore) results.
    evaluation.state.original.result = persistedResults.value.original ?? null
    evaluation.state.optimized.result = persistedResults.value.optimized ?? null
    evaluation.state.compare.result = persistedResults.value.compare ?? null
    evaluation.state['prompt-only'].result = persistedResults.value['prompt-only'] ?? null
    evaluation.state['prompt-iterate'].result = persistedResults.value['prompt-iterate'] ?? null

    // Keep persisted results updated.
    watch(() => evaluation.state.original.result, (next) => {
      if (persistedResults.value.original === next) return
      persistedResults.value.original = next ?? null
    })
    watch(() => evaluation.state.optimized.result, (next) => {
      if (persistedResults.value.optimized === next) return
      persistedResults.value.optimized = next ?? null
    })
    watch(() => evaluation.state.compare.result, (next) => {
      if (persistedResults.value.compare === next) return
      persistedResults.value.compare = next ?? null
    })
    watch(() => evaluation.state['prompt-only'].result, (next) => {
      if (persistedResults.value['prompt-only'] === next) return
      persistedResults.value['prompt-only'] = next ?? null
    })
    watch(() => evaluation.state['prompt-iterate'].result, (next) => {
      if (persistedResults.value['prompt-iterate'] === next) return
      persistedResults.value['prompt-iterate'] = next ?? null
    })
  }

  /**
   * 执行评估
   */
  const handleEvaluate = async (
    type: EvaluationType,
    options?: { userFeedback?: string }
  ): Promise<void> => {
    const original = originalPrompt.value || ''
    const optimized = optimizedPrompt.value || ''
    const content = testContent.value || ''
    const results = testResults.value
    const context = proContext?.value
    const userFeedback = options?.userFeedback?.trim() || ''

    // 🔧 预先计算 trim 结果，避免重复调用
    const originalTrimmed = original?.trim()
    const optimizedTrimmed = optimized?.trim()
    const shouldPassOriginal =
      originalTrimmed &&
      optimizedTrimmed &&
      originalTrimmed !== optimizedTrimmed

    if (type === 'original') {
      await evaluation.evaluateOriginal({
        originalPrompt: original,
        testContent: content,
        testResult: results?.originalResult || '',
        proContext: context,
        userFeedback: userFeedback || undefined,
      })
    } else if (type === 'optimized') {
      await evaluation.evaluateOptimized({
        originalPrompt: original,
        optimizedPrompt: optimized,
        testContent: content,
        testResult: results?.optimizedResult || '',
        proContext: context,
        userFeedback: userFeedback || undefined,
      })
    } else if (type === 'compare') {
      await evaluation.evaluateCompare({
        originalPrompt: original,
        optimizedPrompt: optimized,
        testContent: content,
        originalTestResult: results?.originalResult || '',
        optimizedTestResult: results?.optimizedResult || '',
        proContext: context,
        userFeedback: userFeedback || undefined,
      })
    } else if (type === 'prompt-only') {
      // 仅提示词评估（无需测试结果）
      // 🔧 如果原始和优化内容一致，说明是分析模式，不传 originalPrompt
      // 让评估聚焦在提示词本身，避免"优化前后无变化"的误判
      await evaluation.evaluatePromptOnly({
        originalPrompt: shouldPassOriginal ? original : '',
        optimizedPrompt: optimized,
        proContext: context,
        userFeedback: userFeedback || undefined,
      })
    } else if (type === 'prompt-iterate') {
      // 带迭代需求的提示词评估
      const iterateRequirement = currentIterateRequirement?.value?.trim() || ''
      if (!iterateRequirement) {
        // 迭代需求为空时，降级为 prompt-only 评估
        // 🔧 同样处理分析模式场景
        await evaluation.evaluatePromptOnly({
          originalPrompt: shouldPassOriginal ? original : '',
          optimizedPrompt: optimized,
          proContext: context,
          userFeedback: userFeedback || undefined,
        })
      } else {
        // 🔧 迭代评估同样处理分析模式场景
        await evaluation.evaluatePromptIterate({
          originalPrompt: shouldPassOriginal ? original : '',
          optimizedPrompt: optimized,
          iterateRequirement,
          proContext: context,
          userFeedback: userFeedback || undefined,
        })
      }
    }
  }

  const handleEvaluateWithFeedback = async (
    type: EvaluationType,
    userFeedback: string
  ): Promise<void> => {
    await handleEvaluate(type, { userFeedback })
  }

  /**
   * 重新评估（从详情面板触发）
   * 规则：始终使用“当前业务状态”重新组装请求并执行一次评估
   *
   * 说明：该策略不保存/重放 lastRequest，且不会隐式复用历史反馈。
   */
  const handleReEvaluate = async (): Promise<void> => {
    const currentType = evaluation.state.activeDetailType
    if (currentType) {
      await handleEvaluate(currentType)
    }
  }

  const handleEvaluateActiveWithFeedback = async (userFeedback: string): Promise<void> => {
    const currentType = evaluation.state.activeDetailType
    if (currentType) {
      await handleEvaluate(currentType, { userFeedback })
    }
  }

  /**
   * 事件处理器
   */
  const handlers = {
    onEvaluateOriginal: () => handleEvaluate('original'),
    onEvaluateOptimized: () => handleEvaluate('optimized'),
    onEvaluateCompare: () => handleEvaluate('compare'),
    onShowOriginalDetail: () => evaluation.showDetail('original'),
    onShowOptimizedDetail: () => evaluation.showDetail('optimized'),
    onShowCompareDetail: () => evaluation.showDetail('compare'),
  }

  /**
   * TestAreaPanel 评估相关 props
   */
  const testAreaEvaluationProps = computed(() => ({
    showEvaluation: true,
    hasOriginalResult: !!testResults.value?.originalResult,
    hasOptimizedResult: !!testResults.value?.optimizedResult,
    isEvaluatingOriginal: evaluation.isEvaluatingOriginal.value,
    isEvaluatingOptimized: evaluation.isEvaluatingOptimized.value,
    originalScore: evaluation.originalScore.value,
    optimizedScore: evaluation.optimizedScore.value,
    hasOriginalEvaluation: evaluation.hasOriginalResult.value,
    hasOptimizedEvaluation: evaluation.hasOptimizedResult.value,
    // 新增：评估结果和等级，用于悬浮预览
    originalEvaluationResult: evaluation.state.original.result,
    optimizedEvaluationResult: evaluation.state.optimized.result,
    originalScoreLevel: evaluation.originalLevel.value,
    optimizedScoreLevel: evaluation.optimizedLevel.value,
  }))

  /**
   * 对比评估相关
   */
  const compareEvaluation = {
    hasCompareResult: evaluation.hasCompareResult,
    isEvaluatingCompare: evaluation.isEvaluatingCompare,
    compareScore: evaluation.compareScore,
  }

  /**
   * EvaluationPanel props
   */
  const getIsEvaluatingForType = (type: EvaluationType): boolean => {
    switch (type) {
      case 'original':
        return evaluation.state.original.isEvaluating
      case 'optimized':
        return evaluation.state.optimized.isEvaluating
      case 'compare':
        return evaluation.state.compare.isEvaluating
      case 'prompt-only':
        return evaluation.state['prompt-only'].isEvaluating
      case 'prompt-iterate':
        return evaluation.state['prompt-iterate'].isEvaluating
    }
  }

  const panelProps = computed(() => {
    const activeType = evaluation.state.activeDetailType
    return {
      show: evaluation.isPanelVisible.value,
      isEvaluating: activeType
        ? getIsEvaluatingForType(activeType)
        : false,
      result: evaluation.activeResult.value,
      streamContent: evaluation.activeStreamContent.value,
      error: evaluation.activeError.value,
      currentType: activeType,
      scoreLevel: evaluation.activeScoreLevel.value,
    }
  })

  /**
   * 测试前清空评估结果
   * 应在执行测试前调用，确保旧的评估结果不会残留
   * 注：只清除测试相关的评估（original/optimized/compare），保留左侧提示词评估（prompt-only/prompt-iterate）
   */
  const clearBeforeTest = (): void => {
    evaluation.clearResult('original')
    evaluation.clearResult('optimized')
    evaluation.clearResult('compare')
  }

  /**
   * 创建应用改进建议的处理器
   * 关闭评估面板并打开迭代弹窗，将改进建议预填充
   *
   * @param promptPanelRef PromptPanel 组件引用
   * @returns 处理函数，可直接绑定到 @apply-improvement 事件
   */
  const createApplyImprovementHandler = (
    promptPanelRef: Ref<PromptPanelRef | null>
  ) => {
    return (payload: { improvement: string; type: EvaluationType }): void => {
      const { improvement } = payload

      // 关闭评估面板
      evaluation.closePanel()

      // 打开迭代弹窗并预填充改进建议
      if (promptPanelRef.value?.openIterateDialog) {
        promptPanelRef.value.openIterateDialog(improvement)
      }
    }
  }

  return {
    evaluation,
    handleEvaluate,
    handleEvaluateWithFeedback,
    handleReEvaluate,
    handleEvaluateActiveWithFeedback,
    clearBeforeTest,
    createApplyImprovementHandler,
    handlers,
    testAreaEvaluationProps,
    compareEvaluation,
    panelProps,
  }
}
