/**
 * 评估处理器 Composable
 *
 * 封装评估功能的业务逻辑：
 * - 单结果评估（按 variantId）
 * - 对比评估
 * - 左侧提示词分析
 */

import { computed, watch, type Ref, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useEvaluation,
  type UseEvaluationOptions,
  type UseEvaluationReturn,
  type ScoreLevel,
} from './useEvaluation'
import type { CompareEvaluationPayload } from './compareEvaluation'
import { useToast } from '../ui/useToast'
import {
  buildRewritePayload,
  buildRewritePromptFromEvaluation,
  normalizeRewriteLocaleLanguage,
  type EvaluationContentBlock,
  type EvaluationResponse,
  type EvaluationSnapshot,
  type EvaluationSubMode,
  type EvaluationTarget,
  type EvaluationTestCase,
  type EvaluationType,
  type ProEvaluationContext,
} from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'
import type { PersistedEvaluationResults } from '../../types/evaluation'

export interface ResultEvaluationTarget {
  variantId: string
  target: EvaluationTarget
  testCase: EvaluationTestCase
  snapshot: EvaluationSnapshot
}

export interface UseEvaluationHandlerOptions {
  services: Ref<AppServices | null>
  /** 左侧分析专用：当前工作区提示词 */
  analysisOptimizedPrompt: Ref<string> | ComputedRef<string>
  analysisVariables?: Ref<Record<string, string>> | ComputedRef<Record<string, string>>
  analysisTargetResolver?: (defaultTarget: EvaluationTarget) => EvaluationTarget
  evaluationModelKey: Ref<string> | ComputedRef<string>
  resolveEvaluationModelKey?: UseEvaluationOptions['resolveEvaluationModelKey']
  functionMode: Ref<string> | ComputedRef<string>
  subMode: Ref<string> | ComputedRef<string>
  proContext?: Ref<ProEvaluationContext | undefined> | ComputedRef<ProEvaluationContext | undefined>
  analysisContext?: Ref<ProEvaluationContext | undefined> | ComputedRef<ProEvaluationContext | undefined>
  resultTargets?: Ref<Record<string, ResultEvaluationTarget>> | ComputedRef<Record<string, ResultEvaluationTarget>>
  comparePayload?: Ref<CompareEvaluationPayload | null> | ComputedRef<CompareEvaluationPayload | null>
  currentIterateRequirement?: Ref<string> | ComputedRef<string>
  externalEvaluation?: UseEvaluationReturn
  persistedResults?: Ref<PersistedEvaluationResults>
}

export interface PromptPanelRef {
  openIterateDialog?: (input?: string) => void
  runIterateWithInput?: (input: string) => boolean
}

export interface ResultEvaluationViewProps {
  hasResult: boolean
  isEvaluating: boolean
  score: number | null
  hasEvaluation: boolean
  evaluationResult: EvaluationResponse | null
  scoreLevel: ScoreLevel | null
  resultLabel?: string
}

export interface UseEvaluationHandlerReturn {
  evaluation: UseEvaluationReturn
  handleEvaluate: (
    type: EvaluationType,
    options?: { userFeedback?: string; variantId?: string }
  ) => Promise<void>
  handleEvaluateWithFeedback: (
    type: EvaluationType,
    userFeedback: string,
    options?: { variantId?: string }
  ) => Promise<void>
  handleReEvaluate: () => Promise<void>
  handleEvaluateActiveWithFeedback: (userFeedback: string) => Promise<void>
  clearBeforeTest: () => void
  createApplyImprovementHandler: (
    promptPanelRef: Ref<PromptPanelRef | null>
  ) => (payload: { improvement: string; type: EvaluationType }) => void
  createRewriteFromEvaluationHandler: (
    promptPanelRef: Ref<PromptPanelRef | null>
  ) => (payload: { result: EvaluationResponse; type: EvaluationType }) => void
  getResultEvaluationProps: (variantId: string) => ResultEvaluationViewProps
  compareEvaluation: {
    hasCompareResult: ComputedRef<boolean>
    isEvaluatingCompare: ComputedRef<boolean>
    compareScore: ComputedRef<number | null>
    compareMode: ComputedRef<'generic' | 'structured' | null>
    compareStopSignals: ComputedRef<NonNullable<EvaluationResponse['metadata']>['compareStopSignals'] | null>
    compareSnapshotRoles: ComputedRef<NonNullable<EvaluationResponse['metadata']>['snapshotRoles'] | null>
  }
  panelProps: ComputedRef<{
    show: boolean
    isEvaluating: boolean
    result: EvaluationResponse | null
    streamContent: string
    outputRecord?: import('../../utils/output-document').OutputRecord
    error: string | null
    currentType: EvaluationType | null
    currentVariantId: string | null
    scoreLevel: ScoreLevel | null
    rewriteRecommendation: 'skip' | 'minor-rewrite' | 'rewrite' | null
    rewriteReasons: string[]
  }>
}

const stringifyContext = (context: ProEvaluationContext | undefined): string =>
  context ? JSON.stringify(context, null, 2) : ''

const normalizeInlineText = (content: string | undefined): string =>
  (content || '').replace(/\s+/gu, ' ').trim()

const summarizeText = (content: string | undefined, maxLength = 80): string => {
  const normalized = normalizeInlineText(content)
  if (!normalized) return ''
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized
}

const WORKSPACE_PROMPT_MARKER = '[Current workspace prompt under optimization]'
const ANALYSIS_CONVERSATION_CONTEXT_MAX_LINES = 6

const isProUserEvaluationContext = (
  context: ProEvaluationContext | undefined,
): context is Extract<ProEvaluationContext, { variables: unknown[] }> =>
  Array.isArray((context as { variables?: unknown[] } | undefined)?.variables)

const isProSystemEvaluationContext = (
  context: ProEvaluationContext | undefined,
): context is Extract<ProEvaluationContext, { targetMessage: unknown }> =>
  !!(context as { targetMessage?: unknown } | undefined)?.targetMessage

const toVariableDesignContextBlock = (
  context: ProEvaluationContext | undefined,
): EvaluationContentBlock | undefined => {
  if (!isProUserEvaluationContext(context)) return undefined

  const variableNames = Array.from(
    new Set(
      context.variables
        .map((variable) => variable.name?.trim() || '')
        .filter(Boolean)
    )
  )

  if (!variableNames.length) return undefined

  return {
    kind: 'variables',
    label: 'Variable Structure',
    summary: 'This block describes the template variable structure only. It does not include test values.',
    content: `Variables: ${variableNames.join(', ')}`,
  }
}

const toConversationDesignContextBlock = (
  context: ProEvaluationContext | undefined,
): EvaluationContentBlock | undefined => {
  if (!isProSystemEvaluationContext(context)) return undefined

  const targetRole = context.targetMessage.role?.trim() || 'system'
  const conversationLines = context.conversationMessages
    .map((message) => {
      const role = message.role?.trim() || 'unknown'
      const content = message.isTarget
        ? WORKSPACE_PROMPT_MARKER
        : summarizeText(message.content)
      if (!content) return null
      return {
        isTarget: !!message.isTarget,
        text: `- ${role}: ${content}`,
      }
    })
    .filter((item): item is { isTarget: boolean; text: string } => !!item)

  const visibleConversationLines = (() => {
    if (conversationLines.length <= ANALYSIS_CONVERSATION_CONTEXT_MAX_LINES) {
      return conversationLines.map((line) => line.text)
    }

    const targetIndex = conversationLines.findIndex((line) => line.isTarget)
    if (targetIndex < 0) {
      return conversationLines
        .slice(0, ANALYSIS_CONVERSATION_CONTEXT_MAX_LINES)
        .map((line) => line.text)
    }

    let start = Math.max(
      0,
      targetIndex - Math.floor((ANALYSIS_CONVERSATION_CONTEXT_MAX_LINES - 1) / 2)
    )
    let end = start + ANALYSIS_CONVERSATION_CONTEXT_MAX_LINES

    if (end > conversationLines.length) {
      end = conversationLines.length
      start = Math.max(0, end - ANALYSIS_CONVERSATION_CONTEXT_MAX_LINES)
    }

    return conversationLines.slice(start, end).map((line) => line.text)
  })()

  const contentLines = [
    `Target message role: ${targetRole}`,
    'Conversation context:',
  ]

  if (visibleConversationLines.length) {
    contentLines.push(...visibleConversationLines)
  }

  return {
    kind: 'conversation',
    label: 'Conversation Design Context',
    summary: `The current analysis target is the ${targetRole} message. This position is marked as "${WORKSPACE_PROMPT_MARKER}" in the conversation.`,
    content: contentLines.join('\n'),
  }
}

const buildAnalysisContextLabel = (functionMode: string, subMode: string): string => {
  if (functionMode === 'pro' && subMode === 'variable') {
    return 'Design Context (Variables)'
  }
  if (functionMode === 'pro' && subMode === 'multi') {
    return 'Design Context (Conversation)'
  }
  return 'Design Context'
}

const toDesignContextBlock = (
  context: ProEvaluationContext | undefined,
  functionMode: string,
  subMode: string,
): EvaluationContentBlock | undefined => {
  if (functionMode === 'pro' && subMode === 'variable') {
    return toVariableDesignContextBlock(context)
  }
  if (functionMode === 'pro' && subMode === 'multi') {
    return toConversationDesignContextBlock(context)
  }

  const content = stringifyContext(context)
  if (!content) return undefined
  return {
    kind: 'json',
    label: buildAnalysisContextLabel(functionMode, subMode),
    content,
  }
}

export function useEvaluationHandler(
  options: UseEvaluationHandlerOptions
): UseEvaluationHandlerReturn {
  const { locale, t } = useI18n() as unknown as {
    locale: Ref<string>
    t: (key: string) => string
  }
  const toast = useToast()
  const {
    services,
    analysisOptimizedPrompt,
    analysisVariables,
    analysisTargetResolver,
    evaluationModelKey,
    resolveEvaluationModelKey,
    functionMode,
    subMode,
    proContext,
    analysisContext,
    resultTargets,
    comparePayload,
    currentIterateRequirement,
    externalEvaluation,
    persistedResults,
  } = options

  const evaluation = externalEvaluation ?? useEvaluation(services, {
    evaluationModelKey,
    resolveEvaluationModelKey,
    functionMode,
    subMode,
  })

  if (persistedResults) {
    Object.entries(persistedResults.value.result || {}).forEach(([variantId, result]) => {
      evaluation.getResultState(variantId).result = result ?? null
    })
    evaluation.state.compare.result = persistedResults.value.compare ?? null
    evaluation.state['prompt-only'].result = persistedResults.value['prompt-only'] ?? null
    evaluation.state['prompt-iterate'].result = persistedResults.value['prompt-iterate'] ?? null

    watch(
      () => Object.fromEntries(
        Object.entries(evaluation.state.result)
          .filter(([, item]) => item.result !== null)
          .map(([variantId, item]) => [variantId, item.result])
      ),
      (next) => {
        persistedResults.value.result = { ...next }
      },
      { deep: true }
    )

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

  const handleEvaluate = async (
    type: EvaluationType,
    options?: { userFeedback?: string; variantId?: string }
  ): Promise<void> => {
    const focus = options?.userFeedback?.trim() || ''
    const evaluationContext = proContext?.value
    const promptAnalysisContext = analysisContext?.value ?? evaluationContext

    if (type === 'result') {
      const variantId = options?.variantId?.trim() || ''
      const target = variantId ? resultTargets?.value?.[variantId] : undefined
      if (!target) return

      await evaluation.evaluateResult({
        variantId,
        target: target.target,
        testCase: target.testCase,
        snapshot: target.snapshot,
        focus: focus || undefined,
      })
      return
    }

    if (type === 'compare') {
      const payload = comparePayload?.value
      if (!payload) return

      await evaluation.evaluateCompare({
        target: payload.target,
        testCases: payload.testCases,
        snapshots: payload.snapshots,
        compareHints: payload.compareHints,
        focus: focus || undefined,
      })
      return
    }

    const analysisOptimized = analysisOptimizedPrompt.value || ''
    const promptAnalysisVariables = (() => {
      const rawVariables = analysisVariables?.value
      if (!rawVariables) return undefined

      const entries = Object.entries(rawVariables).filter(([key, value]) => {
        if (!key?.trim()) return false
        if (typeof value !== 'string') return false
        return value.trim().length > 0
      })

      return entries.length
        ? Object.fromEntries(entries)
        : undefined
    })()
    const analysisDesignContext = toDesignContextBlock(
      promptAnalysisContext,
      functionMode.value,
      subMode.value,
    )
    const defaultAnalysisTarget: EvaluationTarget = {
      workspacePrompt: analysisOptimized,
      designContext:
        functionMode.value === 'basic'
          ? undefined
          : analysisDesignContext,
    }
    const analysisTarget = analysisTargetResolver?.(defaultAnalysisTarget) ?? defaultAnalysisTarget

    if (type === 'prompt-only') {
      await evaluation.evaluatePromptOnly({
        target: analysisTarget,
        focus: focus || undefined,
        variables: promptAnalysisVariables,
      })
      return
    }

    if (type === 'prompt-iterate') {
      const iterateRequirement = currentIterateRequirement?.value?.trim() || ''
      if (!iterateRequirement) {
        await evaluation.evaluatePromptOnly({
          target: analysisTarget,
          focus: focus || undefined,
          variables: promptAnalysisVariables,
        })
        return
      }

      await evaluation.evaluatePromptIterate({
        target: analysisTarget,
        iterateRequirement,
        focus: focus || undefined,
        variables: promptAnalysisVariables,
      })
    }
  }

  const handleEvaluateWithFeedback = async (
    type: EvaluationType,
    userFeedback: string,
    options?: { variantId?: string }
  ): Promise<void> => {
    await handleEvaluate(type, {
      userFeedback,
      variantId: options?.variantId,
    })
  }

  const handleReEvaluate = async (): Promise<void> => {
    const activeDetail = evaluation.state.activeDetail
    if (!activeDetail) return

    await handleEvaluate(activeDetail.type, {
      variantId: activeDetail.variantId,
    })
  }

  const handleEvaluateActiveWithFeedback = async (userFeedback: string): Promise<void> => {
    const activeDetail = evaluation.state.activeDetail
    if (!activeDetail) return

    await handleEvaluate(activeDetail.type, {
      userFeedback,
      variantId: activeDetail.variantId,
    })
  }

  const getResultEvaluationProps = (variantId: string): ResultEvaluationViewProps => {
    const target = resultTargets?.value?.[variantId]
    return {
      hasResult: !!target?.snapshot.output?.trim(),
      isEvaluating: evaluation.isEvaluatingResult(variantId),
      score: evaluation.getResultScore(variantId),
      hasEvaluation: evaluation.hasResultEvaluation(variantId),
      evaluationResult: evaluation.getResultState(variantId).result,
      scoreLevel: evaluation.getResultLevel(variantId),
      resultLabel: target?.snapshot.label,
    }
  }

  const compareEvaluation = {
    hasCompareResult: evaluation.hasCompareResult,
    isEvaluatingCompare: evaluation.isEvaluatingCompare,
    compareScore: evaluation.compareScore,
    compareMode: evaluation.compareMode,
    compareStopSignals: evaluation.compareStopSignals,
    compareSnapshotRoles: evaluation.compareSnapshotRoles,
  }

  const getIsEvaluatingForActive = (): boolean => {
    const active = evaluation.state.activeDetail
    if (!active) return false
    if (active.type === 'result') {
      return active.variantId ? evaluation.isEvaluatingResult(active.variantId) : false
    }
    return evaluation.state[active.type].isEvaluating
  }

  const panelProps = computed(() => {
    const active = evaluation.state.activeDetail
    const activeResult = evaluation.activeResult.value
    const rewriteGuidance = (() => {
      if (!active || !activeResult) return null

      const compareTarget = comparePayload?.value?.target
      const workspacePrompt =
        active.type === 'compare'
          ? compareTarget?.workspacePrompt || analysisOptimizedPrompt.value || ''
          : analysisOptimizedPrompt.value || ''
      const referencePrompt =
        active.type === 'compare'
          ? compareTarget?.referencePrompt
          : undefined
      const language = normalizeRewriteLocaleLanguage(locale.value)

      return buildRewritePayload({
        result: activeResult,
        type: active.type,
        mode: {
          functionMode: options.functionMode.value as 'basic' | 'pro' | 'image',
          subMode: options.subMode.value as EvaluationSubMode,
        },
        language,
        workspacePrompt,
        referencePrompt,
      }).compressedEvaluation.rewriteGuidance
    })()

    return {
      show: evaluation.isPanelVisible.value,
      isEvaluating: getIsEvaluatingForActive(),
      result: activeResult,
      streamContent: evaluation.activeStreamContent.value,
      outputRecord: evaluation.activeOutputRecord?.value,
      error: evaluation.activeError.value,
      currentType: active?.type ?? null,
      currentVariantId: active?.variantId ?? null,
      scoreLevel: evaluation.activeScoreLevel.value,
      rewriteRecommendation: rewriteGuidance?.recommendation ?? null,
      rewriteReasons: rewriteGuidance?.reasons || [],
    }
  })

  const clearBeforeTest = (): void => {
    Object.keys(evaluation.state.result).forEach((variantId) => {
      evaluation.clearResult('result', variantId)
    })
    evaluation.clearResult('compare')
  }

  const createApplyImprovementHandler = (
    promptPanelRef: Ref<PromptPanelRef | null>
  ) => {
    return (payload: { improvement: string; type: EvaluationType }): void => {
      const { improvement } = payload
      evaluation.closePanel()
      if (promptPanelRef.value?.openIterateDialog) {
        promptPanelRef.value.openIterateDialog(improvement)
      }
    }
  }

  const createRewriteFromEvaluationHandler = (
    promptPanelRef: Ref<PromptPanelRef | null>
  ) => {
    return (payload: { result: EvaluationResponse; type: EvaluationType }): void => {
      if (!payload.result) return

      const compareTarget = comparePayload?.value?.target
      const workspacePrompt =
        payload.type === 'compare'
          ? compareTarget?.workspacePrompt || analysisOptimizedPrompt.value || ''
          : analysisOptimizedPrompt.value || ''
      const referencePrompt =
        payload.type === 'compare'
          ? compareTarget?.referencePrompt
          : undefined
      const language = normalizeRewriteLocaleLanguage(locale.value)
      const rewritePayload = buildRewritePayload({
        result: payload.result,
        type: payload.type,
        mode: {
          functionMode: options.functionMode.value as 'basic' | 'pro' | 'image',
          subMode: options.subMode.value as EvaluationSubMode,
        },
        language,
        workspacePrompt,
        referencePrompt,
      })

      if (
        payload.type === 'compare' &&
        rewritePayload.compressedEvaluation.rewriteGuidance.recommendation === 'skip'
      ) {
        toast.info(t('evaluation.rewriteSkipped'))
        return
      }

      const rewriteInput = buildRewritePromptFromEvaluation({
        result: payload.result,
        type: payload.type,
        mode: {
          functionMode: options.functionMode.value as 'basic' | 'pro' | 'image',
          subMode: options.subMode.value as EvaluationSubMode,
        },
        language,
        workspacePrompt,
        referencePrompt,
      })
      const started = promptPanelRef.value?.runIterateWithInput?.(rewriteInput) || false

      if (started) {
        evaluation.closePanel()
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
    createRewriteFromEvaluationHandler,
    getResultEvaluationProps,
    compareEvaluation,
    panelProps,
  }
}
