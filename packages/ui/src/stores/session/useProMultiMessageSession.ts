/**
 * Pro-MultiMessage Session Store (Pro-system，多消息模式)
 *
 * 管理 Pro 模式下 System 子模式的会话状态
 * 特点：
 * - 多轮对话消息管理
 * - 消息-历史链映射（Codex 要求使用 Record）
 * - 当前选中消息的优化结果
 */

import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import type { ConversationMessage } from '@prompt-optimizer/core'

export interface TestResults {
  originalResult: string
  optimizedResult: string
}

/**
 * Pro-MultiMessage 会话状态
 */
export interface ProMultiMessageSessionState {
  // 对话消息快照（仅用于恢复）
  conversationMessagesSnapshot: ConversationMessage[]

  // 当前选中的消息ID
  selectedMessageId: string

  // 当前消息的优化结果
  optimizedPrompt: string

  // 🔧 Codex 修复：添加 reasoning 字段，与其他 session store 保持一致
  reasoning: string

  // 历史相关（只存 ID）
  chainId: string
  versionId: string

  // 消息-历史链映射（Codex 要求：Map 改 Record）
  messageChainMap: Record<string, string>

  // 测试结果
  testResults: TestResults | null

  // 模型和模板选择（只存 ID/key）
  selectedOptimizeModelKey: string
  selectedTestModelKey: string
  selectedTemplateId: string | null

  // 对比模式
  isCompareMode: boolean

  // 最后活跃时间
  lastActiveAt: number
}

const createDefaultState = (): ProMultiMessageSessionState => ({
  conversationMessagesSnapshot: [],
  selectedMessageId: '',
  optimizedPrompt: '',
  reasoning: '', // 🔧 Codex 修复：添加默认值
  chainId: '',
  versionId: '',
  messageChainMap: {},
  testResults: null,
  selectedOptimizeModelKey: '',
  selectedTestModelKey: '',
  selectedTemplateId: null,
  isCompareMode: true,
  lastActiveAt: Date.now(),
})

export const useProMultiMessageSession = defineStore('proMultiMessageSession', () => {
  const state: Ref<ProMultiMessageSessionState> = ref(createDefaultState())

  /**
   * 更新对话消息快照
   */
  const updateConversationMessages = (messages: ConversationMessage[]) => {
    state.value.conversationMessagesSnapshot = messages
    state.value.lastActiveAt = Date.now()
  }

  /**
   * 选择消息
   */
  const selectMessage = (messageId: string) => {
    state.value.selectedMessageId = messageId
    state.value.lastActiveAt = Date.now()
  }

  /**
   * 更新优化结果
   * 🔧 Codex 修复：添加 reasoning 字段支持
   */
  const updateOptimizedResult = (payload: {
    optimizedPrompt: string
    reasoning: string
    chainId: string
    versionId: string
  }) => {
    state.value.optimizedPrompt = payload.optimizedPrompt
    state.value.reasoning = payload.reasoning
    state.value.chainId = payload.chainId
    state.value.versionId = payload.versionId
    state.value.lastActiveAt = Date.now()
  }

  /**
   * 更新消息-历史链映射
   */
  const updateMessageChainMap = (messageId: string, chainId: string) => {
    state.value.messageChainMap[messageId] = chainId
    state.value.lastActiveAt = Date.now()
  }

  /**
   * 批量更新消息-历史链映射
   */
  const setMessageChainMap = (map: Record<string, string>) => {
    state.value.messageChainMap = { ...map }
    state.value.lastActiveAt = Date.now()
  }

  /**
   * 移除消息的历史链映射
   */
  const removeMessageChainMapping = (messageId: string) => {
    delete state.value.messageChainMap[messageId]
    state.value.lastActiveAt = Date.now()
  }

  /**
   * 更新测试结果
   */
  const updateTestResults = (results: TestResults | null) => {
    state.value.testResults = results
    state.value.lastActiveAt = Date.now()
  }

  /**
   * 更新优化模型选择
   */
  const updateOptimizeModel = (modelKey: string) => {
    state.value.selectedOptimizeModelKey = modelKey
    state.value.lastActiveAt = Date.now()
  }

  /**
   * 更新测试模型选择
   */
  const updateTestModel = (modelKey: string) => {
    state.value.selectedTestModelKey = modelKey
    state.value.lastActiveAt = Date.now()
  }

  /**
   * 更新模板选择
   */
  const updateTemplate = (templateId: string | null) => {
    state.value.selectedTemplateId = templateId
    state.value.lastActiveAt = Date.now()
  }

  /**
   * 切换对比模式
   */
  const toggleCompareMode = (enabled?: boolean) => {
    state.value.isCompareMode = enabled ?? !state.value.isCompareMode
    state.value.lastActiveAt = Date.now()
  }

  /**
   * 重置状态
   */
  const reset = () => {
    state.value = createDefaultState()
  }

  /**
   * 保存会话
   */
  const saveSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[ProMultiMessageSession] PreferenceService 不可用，无法保存会话')
      return
    }

    try {
      const snapshot = JSON.stringify(state.value)
      await $services.preferenceService.set(
        'session/v1/pro-system',
        snapshot
      )
    } catch (error) {
      console.error('[ProMultiMessageSession] 保存会话失败:', error)
    }
  }

  /**
   * 恢复会话
   */
  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[ProMultiMessageSession] PreferenceService 不可用，无法恢复会话')
      return
    }

    try {
      const saved = await $services.preferenceService.get(
        'session/v1/pro-system',
        ''
      )

      if (saved) {
        const parsed = JSON.parse(saved) as ProMultiMessageSessionState
        state.value = {
          ...createDefaultState(),
          ...parsed,
          lastActiveAt: Date.now(),
        }
      }
      // else: 没有保存的会话，使用默认状态
    } catch (error) {
      console.error('[ProMultiMessageSession] 恢复会话失败:', error)
      reset()
    }
  }

  return {
    state,
    updateConversationMessages,
    selectMessage,
    updateOptimizedResult,
    updateMessageChainMap,
    setMessageChainMap,
    removeMessageChainMapping,
    updateTestResults,
    updateOptimizeModel,
    updateTestModel,
    updateTemplate,
    toggleCompareMode,
    reset,
    saveSession,
    restoreSession,
  }
})

export type ProMultiMessageSessionApi = ReturnType<typeof useProMultiMessageSession>
