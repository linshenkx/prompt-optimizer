import { ref, nextTick, computed, reactive, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getErrorMessage } from '../../utils/error'
import { v4 as uuidv4 } from 'uuid'
import type {
  Template,
  PromptRecordChain,
  OptimizationRequest,
  ToolDefinition
} from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'

type PromptChain = PromptRecordChain

/**
 * ContextUser 模式提示词优化器接口
 */
export interface UseContextUserOptimization {
  // 状态
  prompt: string
  optimizedPrompt: string
  optimizedReasoning: string
  isOptimizing: boolean
  isIterating: boolean
  selectedTemplate: Template | null
  selectedIterateTemplate: Template | null
  currentChainId: string
  currentVersions: PromptChain['versions']
  currentVersionId: string

  // 方法
  optimize: () => Promise<void>
  iterate: (payload: { originalPrompt: string, optimizedPrompt: string, iterateInput: string }) => Promise<void>
  switchVersion: (version: PromptChain['versions'][number]) => Promise<void>
}

/**
 * ContextUser 模式提示词优化器 Composable
 *
 * 专门用于 ContextUserWorkspace 的优化逻辑，特点：
 * - 只处理单条用户消息优化
 * - 独立的状态管理
 * - 支持版本历史和迭代
 * - 与 ContextSystem 的 useConversationOptimization 对称
 *
 * @param services 服务实例引用
 * @param selectedOptimizeModel 优化模型选择
 * @param selectedTemplate 优化模板（用户模式）
 * @param selectedIterateTemplate 迭代模板
 * @returns ContextUser 优化器接口
 *
 * @example
 * ```ts
 * const contextUserOptimization = useContextUserOptimization(
 *   services,
 *   computed(() => props.selectedOptimizeModel),
 *   computed(() => props.selectedTemplate),
 *   computed(() => props.selectedIterateTemplate)
 * )
 *
 * // 执行优化
 * await contextUserOptimization.optimize()
 * ```
 */
export function useContextUserOptimization(
  services: Ref<AppServices | null>,
  selectedOptimizeModel: Ref<string>,
  selectedTemplate: Ref<Template | null>,
  selectedIterateTemplate: Ref<Template | null>
): UseContextUserOptimization {
  const toast = useToast()
  const { t } = useI18n()

  // 服务引用
  const historyManager = computed(() => services.value?.historyManager)
  const promptService = computed(() => services.value?.promptService)

  // 使用 reactive 创建响应式状态对象
  const state = reactive<UseContextUserOptimization>({
    // 状态
    prompt: '',
    optimizedPrompt: '',
    optimizedReasoning: '',
    isOptimizing: false,
    isIterating: false,
    selectedTemplate: null,
    selectedIterateTemplate: null,
    currentChainId: '',
    currentVersions: [],
    currentVersionId: '',

    // 方法
    optimize: async () => {
      if (!state.prompt.trim() || state.isOptimizing) return

      if (!selectedTemplate.value) {
        toast.error(t('toast.error.noOptimizeTemplate'))
        return
      }

      if (!selectedOptimizeModel.value) {
        toast.error(t('toast.error.noOptimizeModel'))
        return
      }

      // 在开始优化前立即清空状态
      state.isOptimizing = true
      state.optimizedPrompt = ''
      state.optimizedReasoning = ''

      // 等待一个微任务确保状态更新完成
      await nextTick()

      try {
        // 构建优化请求
        const request: OptimizationRequest = {
          optimizationMode: 'user',  // ContextUser 固定为 user 模式
          targetPrompt: state.prompt,
          templateId: selectedTemplate.value.id,
          modelKey: selectedOptimizeModel.value
        }

        // 使用流式优化 API
        await promptService.value!.optimizePromptStream(
          request,
          {
            onToken: (token: string) => {
              state.optimizedPrompt += token
            },
            onReasoningToken: (reasoningToken: string) => {
              state.optimizedReasoning += reasoningToken
            },
            onComplete: async () => {
              if (!selectedTemplate.value) return

              try {
                // 创建历史记录
                const recordData = {
                  id: uuidv4(),
                  originalPrompt: state.prompt,
                  optimizedPrompt: state.optimizedPrompt,
                  type: 'contextUserOptimize' as const,  // ContextUser 专用类型
                  modelKey: selectedOptimizeModel.value,
                  templateId: selectedTemplate.value.id,
                  timestamp: Date.now(),
                  metadata: {
                    optimizationMode: 'user' as const,
                    functionMode: 'pro' as const  // ContextUser 属于 pro 模式
                  }
                }

                const newRecord = await historyManager.value!.createNewChain(recordData)

                state.currentChainId = newRecord.chainId
                state.currentVersions = newRecord.versions
                state.currentVersionId = newRecord.currentRecord.id

                toast.success(t('toast.success.optimizeSuccess'))
              } catch (error: unknown) {
                console.error('创建历史记录失败:', error)
                toast.error('创建历史记录失败: ' + getErrorMessage(error))
              } finally {
                state.isOptimizing = false
              }
            },
            onError: (error: Error) => {
              console.error(t('toast.error.optimizeProcessFailed'), error)
              toast.error(error.message || t('toast.error.optimizeFailed'))
              state.isOptimizing = false
            }
          }
        )
      } catch (error: unknown) {
        console.error(t('toast.error.optimizeFailed'), error)
        toast.error(getErrorMessage(error) || t('toast.error.optimizeFailed'))
      } finally {
        state.isOptimizing = false
      }
    },

    // 迭代优化
    iterate: async ({ originalPrompt, optimizedPrompt: lastOptimizedPrompt, iterateInput }) => {
      if (!originalPrompt || !lastOptimizedPrompt || !iterateInput || state.isIterating) return

      if (!selectedIterateTemplate.value) {
        toast.error(t('toast.error.noIterateTemplate'))
        return
      }

      // 在开始迭代前立即清空状态
      state.isIterating = true
      state.optimizedPrompt = ''
      state.optimizedReasoning = ''

      // 等待一个微任务确保状态更新完成
      await nextTick()

      try {
        await promptService.value!.iteratePromptStream(
          originalPrompt,
          lastOptimizedPrompt,
          iterateInput,
          selectedOptimizeModel.value,
          {
            onToken: (token: string) => {
              state.optimizedPrompt += token
            },
            onReasoningToken: (reasoningToken: string) => {
              state.optimizedReasoning += reasoningToken
            },
            onComplete: async () => {
              if (!selectedIterateTemplate.value) {
                state.isIterating = false
                return
              }

              try {
                // 保存迭代历史
                const iterationData = {
                  chainId: state.currentChainId,
                  originalPrompt: originalPrompt,
                  optimizedPrompt: state.optimizedPrompt,
                  iterationNote: iterateInput,
                  modelKey: selectedOptimizeModel.value,
                  templateId: selectedIterateTemplate.value.id
                }

                const updatedChain = await historyManager.value!.addIteration(iterationData)

                state.currentVersions = updatedChain.versions
                state.currentVersionId = updatedChain.currentRecord.id

                toast.success(t('toast.success.iterateComplete'))
              } catch (error: unknown) {
                console.error('[History] 迭代记录失败:', error)
                toast.warning(t('toast.warning.historyFailed'))
              } finally {
                state.isIterating = false
              }
            },
            onError: (error: Error) => {
              console.error('[Iterate] 迭代失败:', error)
              toast.error(t('toast.error.iterateFailed'))
              state.isIterating = false
            }
          },
          selectedIterateTemplate.value.id
        )
      } catch (error: unknown) {
        console.error('[Iterate] 迭代失败:', error)
        toast.error(t('toast.error.iterateFailed'))
        state.isIterating = false
      }
    },

    // 切换版本
    switchVersion: async (version: PromptChain['versions'][number]) => {
      // 强制更新内容，确保UI同步
      state.optimizedPrompt = version.optimizedPrompt
      state.currentVersionId = version.id

      // 等待一个微任务确保状态更新完成
      await nextTick()
    }
  })

  // 同步 selectedTemplate 和 selectedIterateTemplate
  // 这样外部可以通过 props 控制，内部也能访问
  const syncTemplates = () => {
    state.selectedTemplate = selectedTemplate.value
    state.selectedIterateTemplate = selectedIterateTemplate.value
  }

  // 初始同步
  syncTemplates()

  // 监听变化并同步（使用 Vue 的响应式系统自动处理）
  const unwatchTemplate = () => {
    state.selectedTemplate = selectedTemplate.value
  }
  const unwatchIterateTemplate = () => {
    state.selectedIterateTemplate = selectedIterateTemplate.value
  }

  // 返回 reactive 对象
  return state
}
