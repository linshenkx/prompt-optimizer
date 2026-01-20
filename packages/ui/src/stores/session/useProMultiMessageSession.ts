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
import { TEMPLATE_SELECTION_KEYS, type ConversationMessage } from '@prompt-optimizer/core'
import {
  createDefaultEvaluationResults,
  type PersistedEvaluationResults,
} from '../../types/evaluation'

export interface TestResults {
  originalResult: string
  originalReasoning: string
  optimizedResult: string
  optimizedReasoning: string
}

/**
 * 默认状态
 */
const createDefaultState = () => ({
  conversationMessagesSnapshot: [],
  selectedMessageId: '',
  optimizedPrompt: '',
  reasoning: '',
  chainId: '',
  versionId: '',
  messageChainMap: {},
  testResults: null,
  evaluationResults: createDefaultEvaluationResults(),
  selectedOptimizeModelKey: '',
  selectedTestModelKey: '',
  selectedTemplateId: null,
  selectedIterateTemplateId: null,
  isCompareMode: true,
  lastActiveAt: Date.now(),
})

export const useProMultiMessageSession = defineStore('proMultiMessageSession', () => {
  // ========== 状态定义（使用独立 ref，而非包装在 state 对象中）==========

  // 对话消息快照（仅用于恢复）
  const conversationMessagesSnapshot = ref<ConversationMessage[]>([])

  // 当前选中的消息ID
  const selectedMessageId = ref('')

  // 当前消息的优化结果
  const optimizedPrompt = ref('')

  // 🔧 Codex 修复：添加 reasoning 字段，与其他 session store 保持一致
  const reasoning = ref('')

  // 历史相关（只存 ID）
  const chainId = ref('')
  const versionId = ref('')

  // 消息-历史链映射（Codex 要求：Map 改 Record）
  const messageChainMap = ref<Record<string, string>>({})

  // 测试结果
  const testResults = ref<TestResults | null>(null)

  // 评估结果
  const evaluationResults = ref<PersistedEvaluationResults>(createDefaultEvaluationResults())

  // 模型和模板选择（只存 ID/key）
  const selectedOptimizeModelKey = ref('')
  const selectedTestModelKey = ref('')
  const selectedTemplateId = ref<string | null>(null)
  const selectedIterateTemplateId = ref<string | null>(null)

  // 对比模式
  const isCompareMode = ref(true)

  // 最后活跃时间
  const lastActiveAt = ref(Date.now())

  /**
   * 更新对话消息快照
   */
  const updateConversationMessages = (messages: ConversationMessage[]) => {
    conversationMessagesSnapshot.value = messages
    lastActiveAt.value = Date.now()
  }

  /**
   * 选择消息
   */
  const selectMessage = (messageId: string) => {
    selectedMessageId.value = messageId
    lastActiveAt.value = Date.now()
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
    const nextOptimizedPrompt = payload.optimizedPrompt
    const nextReasoning = payload.reasoning
    const nextChainId = payload.chainId
    const nextVersionId = payload.versionId

    const changed =
      optimizedPrompt.value !== nextOptimizedPrompt ||
      reasoning.value !== nextReasoning ||
      chainId.value !== nextChainId ||
      versionId.value !== nextVersionId

    if (!changed) return

    optimizedPrompt.value = nextOptimizedPrompt
    reasoning.value = nextReasoning
    chainId.value = nextChainId
    versionId.value = nextVersionId
    lastActiveAt.value = Date.now()
  }

  /**
   * 更新消息-历史链映射
   */
  const updateMessageChainMap = (messageId: string, chainId: string) => {
    messageChainMap.value[messageId] = chainId
    lastActiveAt.value = Date.now()
  }

  /**
   * 批量更新消息-历史链映射
   */
  const setMessageChainMap = (map: Record<string, string>) => {
    messageChainMap.value = { ...map }
    lastActiveAt.value = Date.now()
  }

  /**
   * 移除消息的历史链映射
   */
  const removeMessageChainMapping = (messageId: string) => {
    delete messageChainMap.value[messageId]
    lastActiveAt.value = Date.now()
  }

  /**
   * 更新测试结果
   */
  const updateTestResults = (results: TestResults | null) => {
    const prev = testResults.value

    // 检查是否相同
    const isSame =
      prev === results ||
      (!!prev &&
        !!results &&
        prev.originalResult === results.originalResult &&
        prev.originalReasoning === results.originalReasoning &&
        prev.optimizedResult === results.optimizedResult &&
        prev.optimizedReasoning === results.optimizedReasoning)

    if (isSame) return

    // 直接赋值给 ref（现在是响应式的）
    testResults.value = results
    lastActiveAt.value = Date.now()
  }

  /**
   * 更新优化模型选择
   */
  const updateOptimizeModel = (modelKey: string) => {
    if (selectedOptimizeModelKey.value === modelKey) return
    selectedOptimizeModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    // 异步保存完整状态（best-effort）
    saveSession()
  }

  /**
   * 更新测试模型选择
   */
  const updateTestModel = (modelKey: string) => {
    if (selectedTestModelKey.value === modelKey) return
    selectedTestModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * 更新模板选择
   */
  const updateTemplate = (templateId: string | null) => {
    if (selectedTemplateId.value === templateId) return
    selectedTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * 更新迭代模板选择
   */
  const updateIterateTemplate = (templateId: string | null) => {
    if (selectedIterateTemplateId.value === templateId) return
    selectedIterateTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * 切换对比模式
   */
  const toggleCompareMode = (enabled?: boolean) => {
    const nextValue = enabled ?? !isCompareMode.value
    if (isCompareMode.value === nextValue) return
    isCompareMode.value = nextValue
    lastActiveAt.value = Date.now()
  }

  /**
   * 重置状态
   */
  const reset = () => {
    const defaultState = createDefaultState()
    conversationMessagesSnapshot.value = defaultState.conversationMessagesSnapshot
    selectedMessageId.value = defaultState.selectedMessageId
    optimizedPrompt.value = defaultState.optimizedPrompt
    reasoning.value = defaultState.reasoning
    chainId.value = defaultState.chainId
    versionId.value = defaultState.versionId
    messageChainMap.value = defaultState.messageChainMap
    testResults.value = defaultState.testResults
    evaluationResults.value = defaultState.evaluationResults
    selectedOptimizeModelKey.value = defaultState.selectedOptimizeModelKey
    selectedTestModelKey.value = defaultState.selectedTestModelKey
    selectedTemplateId.value = defaultState.selectedTemplateId
    selectedIterateTemplateId.value = defaultState.selectedIterateTemplateId
    isCompareMode.value = defaultState.isCompareMode
    lastActiveAt.value = defaultState.lastActiveAt
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
      // 构建完整的会话状态对象用于序列化
      const sessionState = {
        conversationMessagesSnapshot: conversationMessagesSnapshot.value,
        selectedMessageId: selectedMessageId.value,
        optimizedPrompt: optimizedPrompt.value,
        reasoning: reasoning.value,
        chainId: chainId.value,
        versionId: versionId.value,
        messageChainMap: messageChainMap.value,
        testResults: testResults.value,
        evaluationResults: evaluationResults.value,
        selectedOptimizeModelKey: selectedOptimizeModelKey.value,
        selectedTestModelKey: selectedTestModelKey.value,
        selectedTemplateId: selectedTemplateId.value,
        selectedIterateTemplateId: selectedIterateTemplateId.value,
        isCompareMode: isCompareMode.value,
        lastActiveAt: lastActiveAt.value,
      }
      await $services.preferenceService.set(
        'session/v1/pro-multi',
        sessionState
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
      const saved = await $services.preferenceService.get<unknown>(
        'session/v1/pro-multi',
        null
      )

      if (saved) {
        const parsed =
          typeof saved === 'string'
            ? (JSON.parse(saved) as Record<string, unknown>)
            : (saved as Record<string, unknown>)
        conversationMessagesSnapshot.value = Array.isArray(parsed.conversationMessagesSnapshot)
          ? (parsed.conversationMessagesSnapshot as ConversationMessage[])
          : []
        selectedMessageId.value = typeof parsed.selectedMessageId === 'string' ? parsed.selectedMessageId : ''
        optimizedPrompt.value = typeof parsed.optimizedPrompt === 'string' ? parsed.optimizedPrompt : ''
        reasoning.value = typeof parsed.reasoning === 'string' ? parsed.reasoning : ''
        chainId.value = typeof parsed.chainId === 'string' ? parsed.chainId : ''
        versionId.value = typeof parsed.versionId === 'string' ? parsed.versionId : ''
        messageChainMap.value = (parsed.messageChainMap && typeof parsed.messageChainMap === 'object')
          ? (parsed.messageChainMap as Record<string, string>)
          : {}
        testResults.value = (parsed.testResults && typeof parsed.testResults === 'object')
          ? (parsed.testResults as TestResults)
          : null
        evaluationResults.value = {
          ...createDefaultEvaluationResults(),
          ...(parsed.evaluationResults && typeof parsed.evaluationResults === 'object'
            ? (parsed.evaluationResults as PersistedEvaluationResults)
            : {}),
        }
        selectedOptimizeModelKey.value = typeof parsed.selectedOptimizeModelKey === 'string' ? parsed.selectedOptimizeModelKey : ''
        selectedTestModelKey.value = typeof parsed.selectedTestModelKey === 'string' ? parsed.selectedTestModelKey : ''
        selectedTemplateId.value = typeof parsed.selectedTemplateId === 'string' ? parsed.selectedTemplateId : null
        selectedIterateTemplateId.value = typeof parsed.selectedIterateTemplateId === 'string' ? parsed.selectedIterateTemplateId : null
        isCompareMode.value = typeof parsed.isCompareMode === 'boolean' ? parsed.isCompareMode : true
        lastActiveAt.value = Date.now()
      }
      // else: 没有保存的会话，使用默认状态

      // 兼容迁移：模板选择（从旧 TEMPLATE_SELECTION_KEYS 迁移一次）
      if (!selectedTemplateId.value) {
        const legacyTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.CONTEXT_SYSTEM_OPTIMIZE_TEMPLATE,
          ''
        )
        if (legacyTemplateId) {
          selectedTemplateId.value = legacyTemplateId
        }
      }
      if (!selectedIterateTemplateId.value) {
        const legacyIterateTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.CONTEXT_ITERATE_TEMPLATE,
          ''
        )
        if (legacyIterateTemplateId) {
          selectedIterateTemplateId.value = legacyIterateTemplateId
        }
      }
    } catch (error) {
      console.error('[ProMultiMessageSession] 恢复会话失败:', error)
      reset()
    }
  }

  return {
    // ========== 状态（直接返回，Pinia 会自动追踪响应式）==========
    conversationMessagesSnapshot,
    selectedMessageId,
    optimizedPrompt,
    reasoning,
    chainId,
    versionId,
    messageChainMap,
    testResults,
    evaluationResults,
    selectedOptimizeModelKey,
    selectedTestModelKey,
    selectedTemplateId,
    selectedIterateTemplateId,
    isCompareMode,
    lastActiveAt,

    // ========== 更新方法 ==========
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
    updateIterateTemplate,
    toggleCompareMode,
    reset,

    // ========== 持久化方法 ==========
    saveSession,
    restoreSession,
  }
})

export type ProMultiMessageSessionApi = ReturnType<typeof useProMultiMessageSession>
