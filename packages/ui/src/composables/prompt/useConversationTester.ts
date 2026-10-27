import { beginOutputStream } from '../../utils/output-document'
import { reactive, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getI18nErrorMessage } from '../../utils/error'
import type { ToolDefinition, ToolCall, ToolCallResult, ConversationMessage } from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'
import type { VariableManagerHooks } from './useVariableManager'
import type { TestAreaPanelInstance } from '../../components/types/test-area'
import { runTasksWithExecutionMode } from '../../utils/runTasksSequentially'
import {
  COMPARE_BASELINE_VARIANT_ID,
  COMPARE_CANDIDATE_VARIANT_ID,
  createCompareTestVariantStateMap,
  type CompareTestVariantId,
} from './testVariantState'

/**
 * 多对话模式专用测试 Composable
 *
 * 专门处理上下文-多消息模式的测试逻辑，包括：
 * - 选中消息的 V0 对比
 * - 会话上下文处理
 * - 工具调用支持
 *
 * @param services 服务实例引用
 * @param selectedTestModel 测试模型选择
 * @param optimizationContext 优化上下文（会话消息）
 * @param optimizationContextTools 上下文工具列表
 * @param variableManager 变量管理器
 * @param selectedMessageId 当前选中的消息ID（用于对比模式）
 * @returns 多对话测试接口
 */
export function useConversationTester(
  services: Ref<AppServices | null>,
  selectedTestModel: Ref<string>,
  optimizationContext: Ref<ConversationMessage[]>,
  optimizationContextTools: Ref<ToolDefinition[]>,
  variableManager: VariableManagerHooks | null,
  selectedMessageId?: Ref<string>
) {
  const toast = useToast()
  const { t } = useI18n()

  const state = reactive({
    variantStates: createCompareTestVariantStateMap(),

    /**
     * 执行多对话测试（支持对比模式）
     * @param isCompareMode 是否对比模式
     * @param testVariables 测试变量
     * @param testPanelRef 测试面板引用（用于工具调用回调）
     */
    executeTest: async (
      isCompareMode: boolean,
      testVariables?: Record<string, string>,
      testPanelRef?: TestAreaPanelInstance | null
    ) => {
      if (!services.value?.promptService) {
        toast.error(t('toast.error.serviceInit'))
        return
      }

      if (!selectedTestModel.value) {
        toast.error(t('test.error.noModel'))
        return
      }

      // 检查会话上下文
      if (!optimizationContext.value || optimizationContext.value.length === 0) {
        toast.error(t('test.error.noConversation'))
        return
      }

      if (isCompareMode) {
        await runTasksWithExecutionMode(
          [COMPARE_BASELINE_VARIANT_ID, COMPARE_CANDIDATE_VARIANT_ID] as const,
          async (variantId) => {
            await state.testConversation(variantId, testVariables, testPanelRef)
          }
        )
      } else {
        // 单一模式：只测试优化后的会话
        await state.testConversation(COMPARE_CANDIDATE_VARIANT_ID, testVariables, testPanelRef)
      }
    },

    /**
     * 测试特定类型的会话（原始 vs 优化）
     */
    testConversation: async (
      variantId: CompareTestVariantId,
      testVars?: Record<string, string>,
      testPanelRef?: TestAreaPanelInstance | null
    ) => {
      const isOriginal = variantId === COMPARE_BASELINE_VARIANT_ID
      const targetState = state.variantStates[variantId]

      // 设置测试状态
      targetState.isRunning = true
      targetState.result = ''
      targetState.reasoning = ''
      const stream = beginOutputStream(targetState)

      // 清除对应类型的工具调用数据
      testPanelRef?.clearToolCalls(variantId)

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
            console.error(`[useConversationTester] ${variantId} test failed:`, errorMessage)
            const testTypeKey = isOriginal ? 'originalTestFailed' : 'optimizedTestFailed'
            toast.error(`${t(`test.error.${testTypeKey}`)}: ${errorMessage}`)
          },
        }

        // 变量：合并全局变量 + 测试变量
        const baseVars = variableManager?.variableManager.value?.resolveAllVariables() || {}
        const variables = {
          ...baseVars,
          ...(testVars || {}),
        }

        // 构造会话消息：
        // - 原始会话（original）：只有选中的消息使用 originalContent（V0），其他消息使用当前版本
        // - 优化会话（optimized）：所有消息都使用当前版本
        const messages: ConversationMessage[] = isOriginal
          ? optimizationContext.value.map(msg => ({
              ...msg,
              content: (selectedMessageId?.value && msg.id === selectedMessageId.value)
                ? (msg.originalContent || msg.content)
                : msg.content
            }))
          : optimizationContext.value

        // 检查是否有工具
        const hasTools = optimizationContextTools.value?.length > 0

        // 使用自定义会话测试
        await services.value!.promptService.testCustomConversationStream(
          {
            modelKey: selectedTestModel.value,
            messages,
            variables,
            tools: hasTools ? optimizationContextTools.value : [],
          },
          {
            ...streamHandler,
            onToolCall: (toolCall: ToolCall) => {
              if (!hasTools) return
              console.log(
                `[useConversationTester] ${variantId} test tool call received:`,
                toolCall
              )
              const toolCallResult: ToolCallResult = {
                toolCall,
                status: 'success',
                timestamp: new Date(),
              }
              testPanelRef?.handleToolCall(toolCallResult, variantId)
            },
          }
        )
      } catch (error: unknown) {
        console.error(`[useConversationTester] ${variantId} test error:`, error)
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
