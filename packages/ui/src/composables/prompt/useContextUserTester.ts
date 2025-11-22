import { reactive, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getErrorMessage } from '../../utils/error'
import type { AppServices } from '../../types/services'
import type { ConversationMessage } from '../../types/variable'
import type { VariableManagerHooks } from './useVariableManager'

/**
 * ContextUser 模式测试结果接口
 */
export interface ContextUserTestResults {
  // 原始提示词结果
  originalResult: string
  originalReasoning: string
  isTestingOriginal: boolean

  // 优化提示词结果
  optimizedResult: string
  optimizedReasoning: string
  isTestingOptimized: boolean
}

/**
 * ContextUser 模式测试器接口
 */
export interface UseContextUserTester {
  // 测试结果状态
  testResults: ContextUserTestResults

  // 方法
  executeTest: (
    prompt: string,
    optimizedPrompt: string,
    testContent: string,
    isCompareMode: boolean,
    testVariables?: Record<string, string>
  ) => Promise<void>
}

/**
 * ContextUser 模式提示词测试器 Composable
 *
 * 专门用于 ContextUserWorkspace 的测试逻辑，特点：
 * - 只处理用户模式测试（user mode）
 * - 独立的测试结果状态管理
 * - 支持对比模式（原始 vs 优化）
 * - 与 ContextSystem 的 useConversationTester 对称
 *
 * @param services 服务实例引用
 * @param selectedTestModel 测试模型选择
 * @param variableManager 变量管理器
 * @returns ContextUser 测试器接口
 *
 * @example
 * ```ts
 * const contextUserTester = useContextUserTester(
 *   services,
 *   computed(() => props.selectedTestModel),
 *   variableManager
 * )
 *
 * // 执行测试
 * await contextUserTester.executeTest(
 *   prompt,
 *   optimizedPrompt,
 *   testContent,
 *   isCompareMode,
 *   testVariables
 * )
 * ```
 */
export function useContextUserTester(
  services: Ref<AppServices | null>,
  selectedTestModel: Ref<string>,
  variableManager: VariableManagerHooks | null
): UseContextUserTester {
  const toast = useToast()
  const { t } = useI18n()

  // 创建响应式状态对象
  const state = reactive<UseContextUserTester>({
    // 测试结果状态
    testResults: {
      // 原始提示词结果
      originalResult: '',
      originalReasoning: '',
      isTestingOriginal: false,

      // 优化提示词结果
      optimizedResult: '',
      optimizedReasoning: '',
      isTestingOptimized: false,
    },

    // 执行测试（支持对比模式）
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
        // 对比模式：并发测试原始和优化提示词
        await Promise.all([
          state.testPromptWithType(
            'original',
            prompt,
            optimizedPrompt,
            testContent,
            testVariables
          ),
          state.testPromptWithType(
            'optimized',
            prompt,
            optimizedPrompt,
            testContent,
            testVariables
          )
        ])
      } else {
        // 单一模式：只测试优化后的提示词
        await state.testPromptWithType(
          'optimized',
          prompt,
          optimizedPrompt,
          testContent,
          testVariables
        )
      }
    },

    /**
     * 测试特定类型的提示词（内部方法）
     */
    testPromptWithType: async (
      type: 'original' | 'optimized',
      prompt: string,
      optimizedPrompt: string,
      testContent: string,
      testVars?: Record<string, string>
    ) => {
      const isOriginal = type === 'original'
      const selectedPrompt = isOriginal ? prompt : optimizedPrompt

      // 检查提示词
      if (!selectedPrompt) {
        toast.error(
          isOriginal ? t('test.error.noOriginalPrompt') : t('test.error.noOptimizedPrompt')
        )
        return
      }

      // 设置测试状态
      if (isOriginal) {
        state.testResults.isTestingOriginal = true
        state.testResults.originalResult = ''
        state.testResults.originalReasoning = ''
      } else {
        state.testResults.isTestingOptimized = true
        state.testResults.optimizedResult = ''
        state.testResults.optimizedReasoning = ''
      }

      try {
        const streamHandler = {
          onToken: (token: string) => {
            if (isOriginal) {
              state.testResults.originalResult += token
            } else {
              state.testResults.optimizedResult += token
            }
          },
          onReasoningToken: (reasoningToken: string) => {
            if (isOriginal) {
              state.testResults.originalReasoning += reasoningToken
            } else {
              state.testResults.optimizedReasoning += reasoningToken
            }
          },
          onComplete: () => {
            // Test completed successfully
          },
          onError: (err: Error) => {
            const errorMessage = err.message || t('test.error.failed')
            console.error(`[useContextUserTester] ${type} test failed:`, errorMessage)
            const testTypeKey = type === 'original' ? 'originalTestFailed' : 'optimizedTestFailed'
            toast.error(`${t(`test.error.${testTypeKey}`)}: ${errorMessage}`)
          },
        }

        // ContextUser 模式：提示词作为用户输入
        // 固定 optimizationMode 为 'user'
        const systemPrompt = ''
        const userPrompt = selectedPrompt

        // 变量：合并全局变量 + 测试变量
        const baseVars = variableManager?.variableManager.value?.resolveAllVariables() || {}
        const variables = {
          ...baseVars,
          ...(testVars || {}),
          currentPrompt: selectedPrompt,
          userQuestion: userPrompt,
        }

        // 构造简单的消息列表（ContextUser 模式只有用户消息）
        const messages: ConversationMessage[] = [
          { role: 'user' as const, content: userPrompt },
        ]

        // 使用自定义会话测试
        await services.value!.promptService.testCustomConversationStream(
          {
            modelKey: selectedTestModel.value,
            messages,
            variables,
            tools: [], // ContextUser 模式基础不支持工具调用（如需支持可扩展）
          },
          streamHandler
        )
      } catch (error: unknown) {
        console.error(`[useContextUserTester] ${type} test error:`, error)
        const errorMessage = getErrorMessage(error) || t('test.error.failed')
        const testTypeKey = type === 'original' ? 'originalTestFailed' : 'optimizedTestFailed'
        toast.error(`${t(`test.error.${testTypeKey}`)}: ${errorMessage}`)
      } finally {
        // 重置测试状态
        if (isOriginal) {
          state.testResults.isTestingOriginal = false
        } else {
          state.testResults.isTestingOptimized = false
        }
      }
    },
  } as UseContextUserTester)

  return state
}
