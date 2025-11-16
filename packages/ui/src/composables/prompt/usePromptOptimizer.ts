import { ref, nextTick, computed, reactive, type Ref, type ComputedRef } from 'vue'

import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getErrorMessage } from '../../utils/error'

import { v4 as uuidv4 } from 'uuid'
import type {
  IModelManager,
  IHistoryManager,
  Template,
  PromptRecordChain,
  PromptRecordType,
  IPromptService,
  ITemplateManager,
  OptimizationMode,
  OptimizationRequest,
  ConversationMessage,
  ToolDefinition
} from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'
import { useFunctionMode, type FunctionMode } from '../mode'


type PromptChain = PromptRecordChain

interface AdvancedContextPayload {
  variables: Record<string, string>
  messages?: ConversationMessage[]
  tools?: ToolDefinition[]
}

/**
 * 提示词优化器Hook
 * @param services 服务实例引用
 * @param optimizationMode 当前优化模式（从 basicSubMode/proSubMode 计算得出的 computed）
 * @param selectedOptimizeModel 优化模型选择
 * @param selectedTestModel 测试模型选择
 * @param contextMode 上下文模式（用于变量替换策略，兼容性保留）
 * @returns 提示词优化器接口
 * @deprecated optimizationMode 参数建议传入 computed 值（从 basicSubMode/proSubMode 动态计算）
 */
type OptimizationModeSource = Ref<OptimizationMode> | ComputedRef<OptimizationMode>

export function usePromptOptimizer(
  services: Ref<AppServices | null>,
  optimizationMode: OptimizationModeSource,    // 必需参数，接受 computed
  selectedOptimizeModel?: Ref<string>,                 // 优化模型选择
  selectedTestModel?: Ref<string>,                     // 测试模型选择
  contextMode?: Ref<import('@prompt-optimizer/core').ContextMode>  // 上下文模式
) {
  const optimizeModel = selectedOptimizeModel || ref('')
  const testModel = selectedTestModel || ref('')
  const toast = useToast()
  const { t } = useI18n()
  
  // 服务引用
  const modelManager = computed(() => services.value?.modelManager)
  const templateManager = computed(() => services.value?.templateManager)
  const historyManager = computed(() => services.value?.historyManager)
  const promptService = computed(() => services.value?.promptService)
  const { functionMode } = useFunctionMode(services)
  
  // 使用 reactive 创建一个响应式状态对象，而不是单独的 ref
  const state = reactive({
    // 状态
    prompt: '',
    optimizedPrompt: '',
    optimizedReasoning: '', // 优化推理内容
    isOptimizing: false,
    isIterating: false,
    selectedOptimizeTemplate: null as Template | null,  // 系统提示词优化模板
    selectedUserOptimizeTemplate: null as Template | null,  // 用户提示词优化模板
    selectedIterateTemplate: null as Template | null,
    currentChainId: '',
    currentVersions: [] as PromptChain['versions'],
  currentVersionId: '',
  
  // 方法 (将在下面定义并绑定到 state)
  handleOptimizePrompt: async () => {},
  handleOptimizePromptWithContext: async (_advancedContext: AdvancedContextPayload) => {},
  handleIteratePrompt: async (payload: { originalPrompt: string, optimizedPrompt: string, iterateInput: string }) => {},
  handleSwitchVersion: async (version: PromptChain['versions'][number]) => {}
})
  
  // 注意：存储键现在由 useTemplateManager 统一管理
  
  // 优化提示词
  state.handleOptimizePrompt = async () => {
    if (!state.prompt.trim() || state.isOptimizing) return

    // 根据优化模式选择对应的模板
    const currentTemplate = optimizationMode.value === 'system' 
      ? state.selectedOptimizeTemplate 
      : state.selectedUserOptimizeTemplate

    if (!currentTemplate) {
      toast.error(t('toast.error.noOptimizeTemplate'))
      return
    }

    if (!optimizeModel.value) {
      toast.error(t('toast.error.noOptimizeModel'))
      return
    }

    // 在开始优化前立即清空状态，确保没有竞态条件
    state.isOptimizing = true
    state.optimizedPrompt = ''  // 强制同步清空
    state.optimizedReasoning = '' // 强制同步清空
    
    // 等待一个微任务确保状态更新完成
    await nextTick()

    try {
      // 构建优化请求
      const request: OptimizationRequest = {
        optimizationMode: optimizationMode.value,
        targetPrompt: state.prompt,
        templateId: currentTemplate.id,
        modelKey: optimizeModel.value,
        contextMode: contextMode?.value  // 传递上下文模式
      }

      // 使用重构后的优化API
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
            if (!currentTemplate) return

            try {
              // Create new record chain with enhanced metadata，ElectronProxy会自动处理序列化
              // 依据 functionMode 与当前模板类型决定历史记录类型
              const isPro = (functionMode.value as FunctionMode) === 'pro'
              const baseType = (optimizationMode.value === 'system' ? 'optimize' : 'userOptimize') as PromptRecordType
              const recordType = (() => {
                if (isPro) {
                  return (optimizationMode.value === 'system' ? 'conversationMessageOptimize' : 'contextUserOptimize') as PromptRecordType
                }
                // 兼容：若选择的是 context 模板（即使当前模式非 pro），也记录为 context*
                const tplType = currentTemplate.metadata?.templateType
                if (tplType === 'conversationMessageOptimize' || tplType === 'contextUserOptimize') return tplType as PromptRecordType
                return baseType
              })()

              const recordData = {
                id: uuidv4(),
                originalPrompt: state.prompt,
                optimizedPrompt: state.optimizedPrompt,
                type: recordType,
                modelKey: optimizeModel.value,
                templateId: currentTemplate.id,
                timestamp: Date.now(),
                metadata: {
                  optimizationMode: optimizationMode.value,
                  functionMode: functionMode.value
                }
              };

              const newRecord = await historyManager.value!.createNewChain(recordData);

              state.currentChainId = newRecord.chainId;
              state.currentVersions = newRecord.versions;
              state.currentVersionId = newRecord.currentRecord.id;

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
  }
  
  // 带上下文的优化提示词
  state.handleOptimizePromptWithContext = async (advancedContext: AdvancedContextPayload) => {
    // 对于系统模式，检查消息而不是prompt
    const hasMessages = advancedContext.messages && Object.keys(advancedContext.messages).length > 0
    const hasPrompt = state.prompt.trim()

    // 至少需要有消息或prompt其中之一
    if ((!hasMessages && !hasPrompt) || state.isOptimizing) {
      console.log('[usePromptOptimizer] Skipping optimization:', { hasMessages, hasPrompt, isOptimizing: state.isOptimizing })
      return
    }

    // 根据优化模式选择对应的模板
    const currentTemplate = optimizationMode.value === 'system' 
      ? state.selectedOptimizeTemplate 
      : state.selectedUserOptimizeTemplate

    if (!currentTemplate) {
      toast.error(t('toast.error.noOptimizeTemplate'))
      return
    }

    if (!optimizeModel.value) {
      toast.error(t('toast.error.noOptimizeModel'))
      return
    }

    // 在开始优化前立即清空状态，确保没有竞态条件
    state.isOptimizing = true
    state.optimizedPrompt = ''  // 强制同步清空
    state.optimizedReasoning = '' // 强制同步清空
    
    // 等待一个微任务确保状态更新完成
    await nextTick()

    try {
      // 构建带有高级上下文的优化请求
      // 在系统模式下，如果没有单独的prompt，使用消息内容作为描述
      const targetPrompt = state.prompt.trim() ||
        (advancedContext.messages && Object.keys(advancedContext.messages).length > 0
          ? t('toast.info.multiTurnOptimizationPrompt', { count: Object.keys(advancedContext.messages).length })
          : '');

      const request: OptimizationRequest = {
        optimizationMode: optimizationMode.value,
        targetPrompt,
        templateId: currentTemplate.id,
        modelKey: optimizeModel.value,
        contextMode: contextMode?.value,  // 传递上下文模式
        // 关键：添加高级上下文
        advancedContext: {
          variables: advancedContext.variables,
          messages: advancedContext.messages,
          tools: advancedContext.tools  // 🆕 添加工具传递
        }
      }

      console.log('[usePromptOptimizer] Starting optimization with advanced context:', request.advancedContext)

      // 使用重构后的优化API
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
            if (!currentTemplate) return

            // 创建历史记录 - 包含上下文信息
            try {
              const isPro = (functionMode.value as FunctionMode) === 'pro'
              const baseType = (optimizationMode.value === 'system' ? 'optimize' : 'userOptimize') as PromptRecordType
              const recordType = (() => {
                if (isPro) return (optimizationMode.value === 'system' ? 'conversationMessageOptimize' : 'contextUserOptimize') as PromptRecordType
                const tplType = currentTemplate.metadata?.templateType
                if (tplType === 'conversationMessageOptimize' || tplType === 'contextUserOptimize') return tplType as PromptRecordType
                return baseType
              })()

              const recordData = {
                id: uuidv4(),
                originalPrompt: targetPrompt,  // 使用 targetPrompt 而不是 state.prompt
                optimizedPrompt: state.optimizedPrompt,
                type: recordType,
                modelKey: optimizeModel.value,
                templateId: currentTemplate.id,
                timestamp: Date.now(),
                // 添加上下文信息到历史记录
                metadata: {
                  optimizationMode: optimizationMode.value,
                  functionMode: functionMode.value,
                  hasAdvancedContext: true,
                  variableCount: Object.keys(advancedContext.variables).length,
                  messageCount: advancedContext.messages?.length || 0,
                  conversationSnapshot: advancedContext.messages?.map(msg => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                    originalContent: msg.originalContent,
                    chainId: (msg as any).chainId,
                    appliedVersion: (msg as any).appliedVersion
                  }))
                }
              };

              const newRecord = await historyManager.value!.createNewChain(recordData);

              state.currentChainId = newRecord.chainId;
              state.currentVersions = newRecord.versions;
              state.currentVersionId = newRecord.currentRecord.id;

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
  }
  
  // 迭代优化
  state.handleIteratePrompt = async ({ originalPrompt, optimizedPrompt: lastOptimizedPrompt, iterateInput }: { originalPrompt: string, optimizedPrompt: string, iterateInput: string }) => {
    if (!originalPrompt || !lastOptimizedPrompt || !iterateInput || state.isIterating) return
    if (!state.selectedIterateTemplate) {
      toast.error(t('toast.error.noIterateTemplate'))
      return
    }

    // 在开始迭代前立即清空状态，确保没有竞态条件
    state.isIterating = true
    state.optimizedPrompt = ''  // 强制同步清空
    state.optimizedReasoning = '' // 强制同步清空
    
    // 等待一个微任务确保状态更新完成
    await nextTick()
    
    try {
      await promptService.value!.iteratePromptStream(
        originalPrompt,
        lastOptimizedPrompt,
        iterateInput,
        optimizeModel.value,
        {
          onToken: (token: string) => {
            state.optimizedPrompt += token
          },
          onReasoningToken: (reasoningToken: string) => {
            state.optimizedReasoning += reasoningToken
          },
          onComplete: async (_response: unknown) => {
            if (!state.selectedIterateTemplate) {
              state.isIterating = false
              return
            }
            
            try {
              // 使用正确的addIteration方法来保存迭代历史，ElectronProxy会自动处理序列化
              const iterationData = {
                chainId: state.currentChainId,
                originalPrompt: originalPrompt,
                optimizedPrompt: state.optimizedPrompt,
                iterationNote: iterateInput,
                modelKey: optimizeModel.value,
                templateId: state.selectedIterateTemplate.id
              };

              const updatedChain = await historyManager.value!.addIteration(iterationData);
              
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
        state.selectedIterateTemplate.id
      )
    } catch (error: unknown) {
      console.error('[Iterate] 迭代失败:', error)
      toast.error(t('toast.error.iterateFailed'))
      state.isIterating = false
    }
  }
  
  // 切换版本 - 增强版本，确保强制更新
  state.handleSwitchVersion = async (version: PromptChain['versions'][number]) => {
    // 强制更新内容，确保UI同步
    state.optimizedPrompt = version.optimizedPrompt;
    state.currentVersionId = version.id;
    
    // 等待一个微任务确保状态更新完成
    await nextTick()
  }
  
  // 注意：模板初始化、选择保存和变化监听现在都由 useTemplateManager 负责

  // 返回 reactive 对象，而不是包含多个 ref 的对象
  return state
} 
