import { ref, computed, reactive } from 'vue'
import { useToast } from './useToast'
import { useI18n } from 'vue-i18n'
import type { Ref } from 'vue'
import type { IPromptService, OptimizationMode } from '@prompt-optimizer/core'
import type { AppServices } from '../types/services'

/**
 * 提示词测试Hook
 * @param services 服务实例引用
 * @param selectedTestModel 测试模型选择
 * @param optimizationMode 优化模式
 * @returns 提示词测试接口
 */
export function usePromptTester(
  services: Ref<AppServices | null>,
  selectedTestModel: Ref<string>,
  optimizationMode?: Ref<OptimizationMode>
) {
  const toast = useToast()
  const { t } = useI18n()
  
  // 提示词服务引用
  const promptService = computed(() => services.value?.promptService)
  
  // 创建一个 reactive 状态对象
  const state = reactive({
    // States
    testContent: '',
    testResult: '',
    testError: '',
    isTesting: false,
    
    // Methods
    handleTest: async (optimizedPrompt: string) => {
      if (!selectedTestModel.value || !optimizedPrompt) {
        toast.error(t('toast.error.incompleteTestInfo'))
        return
      }
  
      // For system prompt optimization, we need test content
      // For user prompt optimization, we don't need test content (the optimized prompt IS the user input)
      const currentOptimizationMode = optimizationMode?.value || 'system'
      if (currentOptimizationMode === 'system' && !state.testContent) {
        toast.error(t('test.error.noTestContent'))
        return
      }
  
      state.isTesting = true
      state.testError = ''
      state.testResult = ''
  
      try {
        // Determine system and user prompts based on optimization mode
        let systemPrompt = ''
        let userPrompt = ''
  
        if (currentOptimizationMode === 'user') {
          // For user prompt optimization: no system context, optimized is user
          systemPrompt = ''
          userPrompt = optimizedPrompt
        } else {
          // For system prompt optimization: optimized is system, test content is user
          systemPrompt = optimizedPrompt
          userPrompt = state.testContent
        }
  
        // 检查promptService是否可用
        if (!promptService.value) {
          console.warn('PromptService not available, cannot test prompt')
          toast.error(t('toast.error.testFailed'))
          return
        }
        
        await promptService.value.testPromptStream(
          systemPrompt,
          userPrompt,
          selectedTestModel.value,
          {
            onToken: (token: string) => {
              state.testResult += token
            },
            onComplete: () => {
              state.isTesting = false
            },
            onError: (error: Error) => {
              state.testError = error.message || t('toast.error.testFailed')
              state.isTesting = false
            }
          }
        )
      } catch (error: any) {
        console.error(t('toast.error.testFailed'), error)
        state.testError = error.message || t('toast.error.testProcessError')
      } finally {
        state.isTesting = false
      }
    },
    
    // Test with explicit context (for advanced use cases)
    handleTestWithContext: async (
      systemPrompt: string,
      userPrompt: string
    ) => {
      if (!selectedTestModel.value || !userPrompt) {
        toast.error(t('toast.error.incompleteTestInfo'))
        return
      }
  
      state.isTesting = true
      state.testError = ''
      state.testResult = ''
  
      try {
        // 检查promptService是否可用
        if (!promptService.value) {
          console.warn('PromptService not available, cannot test prompt')
          toast.error(t('toast.error.testFailed'))
          return
        }
        
        await promptService.value.testPromptStream(
          systemPrompt,
          userPrompt,
          selectedTestModel.value,
          {
            onToken: (token: string) => {
              state.testResult += token
            },
            onComplete: () => {
              state.isTesting = false
            },
            onError: (error: Error) => {
              state.testError = error.message || t('toast.error.testFailed')
              state.isTesting = false
            }
          }
        )
      } catch (error: any) {
        console.error(t('toast.error.testFailed'), error)
        state.testError = error.message || t('toast.error.testProcessError')
      } finally {
        state.isTesting = false
      }
    }
  })

  return state
}