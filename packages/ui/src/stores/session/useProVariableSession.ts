/**
 * Pro-Variable Session Store (Pro-user，变量模式)
 *
 * 管理 Pro 模式下 User 子模式的会话状态
 * 结构与 BasicSystemSession 类似，但专注于变量优化场景
 *
 * 注意：临时变量由独立的 temporaryVariables store 管理
 */

import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import { TEMPLATE_SELECTION_KEYS } from '@prompt-optimizer/core'

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
  prompt: '',
  optimizedPrompt: '',
  reasoning: '',
  chainId: '',
  versionId: '',
  testContent: '',
  testResults: null,
  selectedOptimizeModelKey: '',
  selectedTestModelKey: '',
  selectedTemplateId: null,
  selectedIterateTemplateId: null,
  isCompareMode: true,
  lastActiveAt: Date.now(),
})

export const useProVariableSession = defineStore('proVariableSession', () => {
  // ========== 状态定义（使用独立 ref，而非包装在 state 对象中）==========

  const prompt = ref('')
  const optimizedPrompt = ref('')
  const reasoning = ref('')
  const chainId = ref('')
  const versionId = ref('')
  const testContent = ref('')
  const testResults = ref<TestResults | null>(null)
  const selectedOptimizeModelKey = ref('')
  const selectedTestModelKey = ref('')
  const selectedTemplateId = ref<string | null>(null)
  const selectedIterateTemplateId = ref<string | null>(null)
  const isCompareMode = ref(true)
  const lastActiveAt = ref(Date.now())

  const updatePrompt = (promptValue: string) => {
    if (prompt.value === promptValue) return
    prompt.value = promptValue
    lastActiveAt.value = Date.now()
  }

  const updateOptimizedResult = (payload: {
    optimizedPrompt: string
    reasoning?: string
    chainId: string
    versionId: string
  }) => {
    const nextOptimizedPrompt = payload.optimizedPrompt
    const nextReasoning = payload.reasoning || ''
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

  const updateTestContent = (content: string) => {
    if (testContent.value === content) return
    testContent.value = content
    lastActiveAt.value = Date.now()
  }

  const updateOptimizeModel = (modelKey: string) => {
    if (selectedOptimizeModelKey.value === modelKey) return
    selectedOptimizeModelKey.value = modelKey
    lastActiveAt.value = Date.now()
  }

  const updateTestModel = (modelKey: string) => {
    if (selectedTestModelKey.value === modelKey) return
    selectedTestModelKey.value = modelKey
    lastActiveAt.value = Date.now()
  }

  const updateTemplate = (templateId: string | null) => {
    if (selectedTemplateId.value === templateId) return
    selectedTemplateId.value = templateId
    lastActiveAt.value = Date.now()
  }

  const updateIterateTemplate = (templateId: string | null) => {
    if (selectedIterateTemplateId.value === templateId) return
    selectedIterateTemplateId.value = templateId
    lastActiveAt.value = Date.now()
  }

  const toggleCompareMode = (enabled?: boolean) => {
    const nextValue = enabled ?? !isCompareMode.value
    if (isCompareMode.value === nextValue) return
    isCompareMode.value = nextValue
    lastActiveAt.value = Date.now()
  }

  const reset = () => {
    const defaultState = createDefaultState()
    prompt.value = defaultState.prompt
    optimizedPrompt.value = defaultState.optimizedPrompt
    reasoning.value = defaultState.reasoning
    chainId.value = defaultState.chainId
    versionId.value = defaultState.versionId
    testContent.value = defaultState.testContent
    testResults.value = defaultState.testResults
    selectedOptimizeModelKey.value = defaultState.selectedOptimizeModelKey
    selectedTestModelKey.value = defaultState.selectedTestModelKey
    selectedTemplateId.value = defaultState.selectedTemplateId
    selectedIterateTemplateId.value = defaultState.selectedIterateTemplateId
    isCompareMode.value = defaultState.isCompareMode
    lastActiveAt.value = defaultState.lastActiveAt
  }

  const saveSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[ProVariableSession] PreferenceService 不可用，无法保存会话')
      return
    }

    try {
      // 构建完整的会话状态对象用于序列化
      const sessionState = {
        prompt: prompt.value,
        optimizedPrompt: optimizedPrompt.value,
        reasoning: reasoning.value,
        chainId: chainId.value,
        versionId: versionId.value,
        testContent: testContent.value,
        testResults: testResults.value,
        selectedOptimizeModelKey: selectedOptimizeModelKey.value,
        selectedTestModelKey: selectedTestModelKey.value,
        selectedTemplateId: selectedTemplateId.value,
        selectedIterateTemplateId: selectedIterateTemplateId.value,
        isCompareMode: isCompareMode.value,
        lastActiveAt: lastActiveAt.value,
      }
      const snapshot = JSON.stringify(sessionState)
      await $services.preferenceService.set(
        'session/v1/pro-user',
        snapshot
      )
    } catch (error) {
      console.error('[ProVariableSession] 保存会话失败:', error)
    }
  }

  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[ProVariableSession] PreferenceService 不可用，无法恢复会话')
      return
    }

    try {
      const saved = await $services.preferenceService.get(
        'session/v1/pro-user',
        ''
      )

      if (saved) {
        const parsed = JSON.parse(saved)
        prompt.value = parsed.prompt || ''
        optimizedPrompt.value = parsed.optimizedPrompt || ''
        reasoning.value = parsed.reasoning || ''
        chainId.value = parsed.chainId || ''
        versionId.value = parsed.versionId || ''
        testContent.value = parsed.testContent || ''
        testResults.value = parsed.testResults || null
        selectedOptimizeModelKey.value = parsed.selectedOptimizeModelKey || ''
        selectedTestModelKey.value = parsed.selectedTestModelKey || ''
        selectedTemplateId.value = parsed.selectedTemplateId || null
        selectedIterateTemplateId.value = parsed.selectedIterateTemplateId || null
        isCompareMode.value = parsed.isCompareMode ?? true
        lastActiveAt.value = Date.now()
      }
      // else: 没有保存的会话，使用默认状态

      // 兼容迁移：模板选择（从旧 TEMPLATE_SELECTION_KEYS 迁移一次）
      if (!selectedTemplateId.value) {
        const legacyTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.CONTEXT_USER_OPTIMIZE_TEMPLATE,
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
      console.error('[ProVariableSession] 恢复会话失败:', error)
      reset()
    }
  }

  return {
    // ========== 状态（直接返回，Pinia 会自动追踪响应式）==========
    prompt,
    optimizedPrompt,
    reasoning,
    chainId,
    versionId,
    testContent,
    testResults,
    selectedOptimizeModelKey,
    selectedTestModelKey,
    selectedTemplateId,
    selectedIterateTemplateId,
    isCompareMode,
    lastActiveAt,

    // ========== 更新方法 ==========
    updatePrompt,
    updateOptimizedResult,
    updateTestContent,
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

export type ProVariableSessionApi = ReturnType<typeof useProVariableSession>
