import { beginOutputStream } from '../../utils/output-document'
import { reactive, type Ref, type ComputedRef } from 'vue'

import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getI18nErrorMessage } from '../../utils/error'
import type { OptimizationMode } from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'
import type { ConversationMessage } from '../../types/variable'
import type { VariableManagerHooks } from './useVariableManager'
import { runTasksWithExecutionMode } from '../../utils/runTasksSequentially'
import {
  COMPARE_BASELINE_VARIANT_ID,
  COMPARE_CANDIDATE_VARIANT_ID,
  createCompareTestVariantStateMap,
  type CompareTestVariantId,
} from './testVariantState'

/**
 * 基础模式提示词测试 Composable
 *
 * 专门处理基础模式的提示词测试，支持：
 * - System prompt 测试
 * - User prompt 测试
 * - 变量注入
 * - 对比模式（原始 vs 优化）
 *
 * @param services 服务实例引用
 * @param selectedTestModel 测试模型选择
 * @param optimizationMode 当前优化模式
 * @param variableManager 变量管理器
 * @returns 基础测试接口
 */
type OptimizationModeSource = Ref<OptimizationMode> | ComputedRef<OptimizationMode>

export function usePromptTester(
  services: Ref<AppServices | null>,
  selectedTestModel: Ref<string>,
  optimizationMode: OptimizationModeSource,
  variableManager: VariableManagerHooks | null
) {
  const toast = useToast()
  const { t } = useI18n()

  // 创建一个 reactive 状态对象
  const state = reactive({
    // States - 测试结果状态（内部统一按 variantId 分桶）
    variantStates: createCompareTestVariantStateMap(),

    // Methods
    /**
     * 执行基础模式测试（支持对比模式）
     * @param prompt 原始提示词
     * @param optimizedPrompt 优化后的提示词
     * @param testContent 测试内容
     * @param isCompareMode 是否对比模式
     * @param testVariables 测试变量
     */
    executeTest: async (
      prompt: string,
      optimizedPrompt: string,
      testContent: string,
      isCompareMode: boolean,
      testVariables?: Record<string, string>
    ) => {
      if (!services.value?.promptService) {
        toast.error(t('toast.error.serviceInit'))
        return
      }

      if (!selectedTestModel.value) {
        toast.error(t('test.error.noModel'))
        return
      }

      if (isCompareMode) {
        // 产品默认并行；自动化环境回退串行，避免录制/回放把结果落到错误列。
        await runTasksWithExecutionMode(
          [COMPARE_BASELINE_VARIANT_ID, COMPARE_CANDIDATE_VARIANT_ID] as const,
          async (variantId) => {
            await state.testPromptWithType(
              variantId,
              prompt,
              optimizedPrompt,
              testContent,
              testVariables
            )
          }
        )
      } else {
        // 单一模式：只测试优化后的提示词
        await state.testPromptWithType(
          COMPARE_CANDIDATE_VARIANT_ID,
          prompt,
          optimizedPrompt,
          testContent,
          testVariables
        )
      }
    },

    /**
     * 测试特定类型的提示词（基础模式）
     */
    testPromptWithType: async (
      variantId: CompareTestVariantId,
      prompt: string,
      optimizedPrompt: string,
      testContent: string,
      testVars?: Record<string, string>
    ) => {
      const isOriginal = variantId === COMPARE_BASELINE_VARIANT_ID
      const selectedPrompt = isOriginal ? prompt : optimizedPrompt
      const targetState = state.variantStates[variantId]

      // 检查提示词
      if (!selectedPrompt) {
        toast.error(
          isOriginal ? t('test.error.noOriginalPrompt') : t('test.error.noOptimizedPrompt')
        )
        return
      }

      // 设置测试状态
      targetState.isRunning = true
      targetState.result = ''
      targetState.reasoning = ''
      const stream = beginOutputStream(targetState)

      try {
        const streamHandler = {
          signal: stream.signal,
          onToken: stream.onToken,
          onReasoningToken: stream.onReasoningToken,
          onComplete: () => {
            stream.finish()
            // Test completed successfully
          },
          onError: (err: Error) => {
            const errorMessage = err.message || t('test.error.failed')
            console.error(`[usePromptTester] ${variantId} test failed:`, errorMessage)
            const testTypeKey = isOriginal ? 'originalTestFailed' : 'optimizedTestFailed'
            toast.error(`${t(`test.error.${testTypeKey}`)}: ${errorMessage}`)
          },
        }

        // 构造系统消息和用户消息
        let systemPrompt = ''
        let userPrompt = ''

        if (optimizationMode.value === 'user') {
          // 用户提示词模式：提示词作为用户输入
          systemPrompt = ''
          userPrompt = selectedPrompt
        } else {
          // 系统提示词模式：提示词作为系统消息
          systemPrompt = selectedPrompt
          userPrompt =
            testContent || 'Please follow your role instructions and show your capabilities in the conversation.'
        }

        // 变量：合并全局变量 + 测试变量
        const baseVars = variableManager?.variableManager.value?.resolveAllVariables() || {}
        const variables = {
          ...baseVars,
          ...(testVars || {}),
          currentPrompt: selectedPrompt,
          userQuestion: userPrompt,
        }

        // 构造简单的消息列表
        const messages: ConversationMessage[] = [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: userPrompt },
        ]

        // 使用自定义会话测试
        await services.value!.promptService.testCustomConversationStream(
          {
            modelKey: selectedTestModel.value,
            messages,
            variables,
            tools: [], // 基础模式不支持工具调用
          },
          streamHandler
        )
      } catch (error: unknown) {
        console.error(`[usePromptTester] ${variantId} test error:`, error)
        const errorMessage = getI18nErrorMessage(error, t('test.error.failed'))
        const testTypeKey = isOriginal ? 'originalTestFailed' : 'optimizedTestFailed'
        toast.error(`${t(`test.error.${testTypeKey}`)}: ${errorMessage}`)
      } finally {
        stream.finish(true)
        targetState.isRunning = false
      }
    },
  })

  return state
}
