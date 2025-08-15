import { ref, watch, nextTick, computed, reactive } from 'vue'
import { useToast } from './useToast'
import { useI18n } from 'vue-i18n'

import { v4 as uuidv4 } from 'uuid'
import type { Ref } from 'vue'
import type {
  ModelConfig,
  IModelManager,
  IHistoryManager,
  Template,
  PromptRecordChain,
  IPromptService,
  ITemplateManager,
  OptimizationMode,
  OptimizationRequest
} from '@prompt-optimizer/core'
import type { AppServices } from '../types/services'


type PromptChain = PromptRecordChain

/**
 * 提示词优化器Hook
 * @param services 服务实例引用
 * @param selectedOptimizationMode 优化模式
 * @param selectedOptimizeModel 优化模型选择
 * @param selectedTestModel 测试模型选择
 * @returns 提示词优化器接口
 */
export function usePromptOptimizer(
  services: Ref<AppServices | null>,
  selectedOptimizationMode?: Ref<OptimizationMode>,    // 优化模式
  selectedOptimizeModel?: Ref<string>,                 // 优化模型选择
  selectedTestModel?: Ref<string>                      // 测试模型选择
) {
  // 如果没有传入参数，抛出错误而不是使用默认值
  if (!selectedOptimizationMode) {
    throw new Error('selectedOptimizationMode is required for usePromptOptimizer')
  }
  const optimizationMode = selectedOptimizationMode
  const optimizeModel = selectedOptimizeModel || ref('')
  const testModel = selectedTestModel || ref('')
  const toast = useToast()
  const { t } = useI18n()
  
  // 服务引用
  const modelManager = computed(() => services.value?.modelManager)
  const templateManager = computed(() => services.value?.templateManager)
  const historyManager = computed(() => services.value?.historyManager)
  const promptService = computed(() => services.value?.promptService)
  
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
        modelKey: optimizeModel.value
      }

      // 检查promptService是否可用
      if (!promptService.value) {
        console.warn('PromptService not available, cannot optimize prompt')
        toast.error('优化服务不可用，无法执行优化')
        return
      }
      
      // 使用重构后的优化API
      await promptService.value.optimizePromptStream(
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
              const recordData = {
                id: uuidv4(),
                originalPrompt: state.prompt,
                optimizedPrompt: state.optimizedPrompt,
                type: (optimizationMode.value === 'system' ? 'optimize' : 'userOptimize') as import('@prompt-optimizer/core').PromptRecordType,
                modelKey: optimizeModel.value,
                templateId: currentTemplate.id,
                timestamp: Date.now(),
                metadata: {
                  optimizationMode: optimizationMode.value
                }
              };

              // 检查historyManager是否可用
              if (!historyManager.value) {
                console.warn('HistoryManager not available, skipping history creation')
                toast.success(t('toast.success.optimizeSuccess'))
                return
              }
              
              const newRecord = await historyManager.value.createNewChain(recordData);

              state.currentChainId = newRecord.chainId;
              state.currentVersions = newRecord.versions;
              state.currentVersionId = newRecord.currentRecord.id;

              toast.success(t('toast.success.optimizeSuccess'))
            } catch (error) {
              console.error('创建历史记录失败:', error)
              toast.error('创建历史记录失败: ' + (error as Error).message)
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
    } catch (error: any) {
      console.error(t('toast.error.optimizeFailed'), error)
      toast.error(error.message || t('toast.error.optimizeFailed'))
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
      // 检查promptService是否可用
      if (!promptService.value) {
        console.warn('PromptService not available, cannot iterate prompt')
        toast.error('优化服务不可用，无法执行迭代')
        return
      }
      
      await promptService.value.iteratePromptStream(
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

              // 检查historyManager是否可用
        if (!historyManager.value) {
          console.warn('HistoryManager not available, skipping iteration history')
          toast.success(t('toast.success.iterateSuccess'))
          return
        }
        
        const updatedChain = await historyManager.value.addIteration(iterationData);
              
              state.currentVersions = updatedChain.versions
              state.currentVersionId = updatedChain.currentRecord.id
              
              toast.success(t('toast.success.iterateComplete'))
            } catch (error) {
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
    } catch (error) {
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