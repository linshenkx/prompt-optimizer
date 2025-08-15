import { ref, watch, computed, reactive, type Ref } from 'vue'
import { useToast } from './useToast'
import { useI18n } from 'vue-i18n'

import { v4 as uuidv4 } from 'uuid'
import type { IHistoryManager, PromptRecordChain, PromptRecord } from '@prompt-optimizer/core'
import type { AppServices } from '../types/services'

type PromptChain = PromptRecordChain

/**
 * 提示词历史管理Hook
 * @param services 服务实例引用
 * @param prompt 提示词
 * @param optimizedPrompt 优化后的提示词
 * @param currentChainId 当前链ID
 * @param currentVersions 当前版本列表
 * @param currentVersionId 当前版本ID
 * @returns 提示词历史管理接口
 */
export function usePromptHistory(
  services: Ref<AppServices | null>,
  prompt: Ref<string>,
  optimizedPrompt: Ref<string>,
  currentChainId: Ref<string>,
  currentVersions: Ref<PromptChain['versions']>,
  currentVersionId: Ref<string>
) {
  const toast = useToast()
  const { t } = useI18n()
  
  // 历史记录管理器引用
  const historyManager = computed(() => services.value?.historyManager)

  // 创建一个 reactive 状态对象
  const state = reactive({
    history: [] as PromptChain[],
    showHistory: false,
    
    handleSelectHistory: async (context: { record: PromptRecord, chainId: string, rootPrompt: string }) => {
      try {
        const { record, chainId, rootPrompt } = context

        // 设置工作区内容
        prompt.value = rootPrompt
        optimizedPrompt.value = record.optimizedPrompt

        // 检查historyManager是否可用
        if (!historyManager.value) {
          console.warn('HistoryManager not available, cannot load history')
          toast.error(t('toast.error.loadHistoryFailed'))
          return
        }
        
        // 加载现有链（而不是创建新链）- 这是修复迭代断层问题的关键
        const existingChain = await historyManager.value.getChain(chainId)

        // 恢复完整的链状态，保持版本历史连贯性
        currentChainId.value = existingChain.chainId
        currentVersions.value = existingChain.versions
        currentVersionId.value = record.id

        await refreshHistory()
        state.showHistory = false

        toast.success(t('toast.success.historyLoaded'))
      } catch (error) {
        console.error('[History] 加载历史记录失败:', error)
        toast.error(t('toast.error.loadHistoryFailed'))
      }
    },

    handleClearHistory: async () => {
    try {
      // 检查historyManager是否可用
      if (!historyManager.value) {
        console.warn('HistoryManager not available, cannot clear history')
        toast.error(t('toast.error.clearHistoryFailed'))
        return
      }
      
      await historyManager.value.clearHistory()
      
      // 清空当前显示的内容
      prompt.value = '';
      optimizedPrompt.value = '';
      currentChainId.value = '';
      currentVersions.value = [];
      currentVersionId.value = '';
      
      // 立即更新历史记录，确保UI能够反映最新状态
        state.history = []
      toast.success(t('toast.success.historyClear'))
    } catch (error) {
      console.error(t('toast.error.clearHistoryFailed'), error)
      toast.error(t('toast.error.clearHistoryFailed'))
    }
    },

    handleDeleteChain: async (chainId: string) => {
    try {
      // 检查historyManager是否可用
      if (!historyManager.value) {
        console.warn('HistoryManager not available, cannot delete chain')
        toast.error(t('toast.error.historyChainDeleteFailed'))
        return
      }
      
      // 获取链中的所有记录
      const allChains = await historyManager.value.getAllChains()
      const chain = allChains.find((c: any) => c.chainId === chainId)
      
      if (chain) {
        // 删除链中的所有记录
        for (const record of chain.versions) {
          await historyManager.value.deleteRecord(record.id)
        }
        
        // 如果当前正在查看的是被删除的链，则清空当前显示
        if (currentChainId.value === chainId) {
          prompt.value = '';
          optimizedPrompt.value = '';
          currentChainId.value = '';
          currentVersions.value = [];
          currentVersionId.value = '';
        }
        
        // 立即更新历史记录，确保UI能够反映最新状态
        // 检查historyManager是否可用
      if (!historyManager.value) {
        console.warn('HistoryManager not available, cannot get updated chains')
        return
      }
      
      const updatedChains = await historyManager.value.getAllChains()
          state.history = [...updatedChains]
        toast.success(t('toast.success.historyChainDeleted'))
      }
    } catch (error) {
      console.error(t('toast.error.historyChainDeleteFailed'), error)
      toast.error(t('toast.error.historyChainDeleteFailed'))
    }
    },

    initHistory: async () => {
    try {
      await refreshHistory()
    } catch (error) {
      console.error(t('toast.error.loadHistoryFailed'), error)
      toast.error(t('toast.error.loadHistoryFailed'))
    }
  }
  })

  // 添加一个刷新历史记录的函数
  const refreshHistory = async () => {
    // 检查historyManager是否可用
    if (!historyManager.value) {
      console.warn('HistoryManager not available, cannot refresh history')
      return
    }
    
    const chains = await historyManager.value.getAllChains()
    state.history = [...chains]
  }

  // Watch history display state
  watch(() => state.showHistory, async (newVal) => {
    if (newVal) {
      await refreshHistory()
    }
  })

  // Watch version changes, update history
  watch([currentVersions], async () => {
    await refreshHistory()
  })

  // 监听服务实例变化，初始化历史记录
  watch(services, async () => {
    if (services.value?.historyManager) {
      await refreshHistory()
    }
  }, { immediate: true })

  return state
}