/**
 * Basic-User Session Store
 *
 * 管理 Basic 模式下 User 子模式的会话状态
 * 结构与 BasicSystemSession 相同
 */

import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import { TEMPLATE_SELECTION_KEYS } from '@prompt-optimizer/core'

/**
 * 测试结果结构
 */
export interface TestResults {
  originalResult: string
  originalReasoning: string
  optimizedResult: string
  optimizedReasoning: string
}

/**
 * Basic-User 会话状态
 */
export interface BasicUserSessionState {
  // 提示词相关
  prompt: string
  optimizedPrompt: string
  reasoning: string

  // 历史相关（只存 ID）
  chainId: string
  versionId: string

  // 测试区域内容
  testContent: string

  // 测试结果
  testResults: TestResults | null

  // 模型和模板选择（只存 ID/key，不存对象）
  selectedOptimizeModelKey: string
  selectedTestModelKey: string
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null

  // 对比模式
  isCompareMode: boolean

  // 最后活跃时间
  lastActiveAt: number
}

/**
 * 默认状态
 */
const createDefaultState = (): BasicUserSessionState => ({
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

export const useBasicUserSession = defineStore('basicUserSession', () => {
  // ========== 状态定义（使用独立 ref，而非包装在 state 对象中）==========

  // 提示词相关
  const prompt = ref('')
  const optimizedPrompt = ref('')
  const reasoning = ref('')

  // 历史相关（只存 ID）
  const chainId = ref('')
  const versionId = ref('')

  // 测试区域内容
  const testContent = ref('')

  // 测试结果
  const testResults = ref<TestResults | null>(null)

  // 模型和模板选择（只存 ID/key，不存对象）
  const selectedOptimizeModelKey = ref('')
  const selectedTestModelKey = ref('')
  const selectedTemplateId = ref<string | null>(null)
  const selectedIterateTemplateId = ref<string | null>(null)

  // 对比模式
  const isCompareMode = ref(true)

  // 最后活跃时间
  const lastActiveAt = ref(Date.now())

  /**
   * 更新提示词
   */
  const updatePrompt = (promptValue: string) => {
    if (prompt.value === promptValue) return
    prompt.value = promptValue
    lastActiveAt.value = Date.now()
  }

  /**
   * 更新优化结果
   */
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
   * 更新测试内容
   */
  const updateTestContent = (content: string) => {
    if (testContent.value === content) return
    testContent.value = content
    lastActiveAt.value = Date.now()
  }

  /**
   * 更新优化模型选择
   */
  const updateOptimizeModel = (modelKey: string) => {
    if (selectedOptimizeModelKey.value === modelKey) return
    selectedOptimizeModelKey.value = modelKey
    lastActiveAt.value = Date.now()
  }

  /**
   * 更新测试模型选择
   */
  const updateTestModel = (modelKey: string) => {
    if (selectedTestModelKey.value === modelKey) return
    selectedTestModelKey.value = modelKey
    lastActiveAt.value = Date.now()
  }

  /**
   * 更新模板选择
   */
  const updateTemplate = (templateId: string | null) => {
    if (selectedTemplateId.value === templateId) return
    selectedTemplateId.value = templateId
    lastActiveAt.value = Date.now()
  }

  /**
   * 更新迭代模板选择
   */
  const updateIterateTemplate = (templateId: string | null) => {
    if (selectedIterateTemplateId.value === templateId) return
    selectedIterateTemplateId.value = templateId
    lastActiveAt.value = Date.now()
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
    lastActiveAt.value = Date.now()
  }

  /**
   * 保存会话到持久化存储
   * 使用 PreferenceService（Codex 要求）
   */
  const saveSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[BasicUserSession] PreferenceService 不可用，无法保存会话')
      return
    }

    try {
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
        'session/v1/basic-user',
        snapshot
      )
    } catch (error) {
      console.error('[BasicUserSession] 保存会话失败:', error)
    }
  }

  /**
   * 从持久化存储恢复会话
   * 使用 PreferenceService（Codex 要求）
   */
  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[BasicUserSession] PreferenceService 不可用，无法恢复会话')
      return
    }

    try {
      const saved = await $services.preferenceService.get(
        'session/v1/basic-user',
        ''
      )

      if (saved) {
        const parsed = JSON.parse(saved) as BasicUserSessionState
        prompt.value = parsed.prompt
        optimizedPrompt.value = parsed.optimizedPrompt
        reasoning.value = parsed.reasoning
        chainId.value = parsed.chainId
        versionId.value = parsed.versionId
        testContent.value = parsed.testContent
        testResults.value = parsed.testResults
        selectedOptimizeModelKey.value = parsed.selectedOptimizeModelKey
        selectedTestModelKey.value = parsed.selectedTestModelKey
        selectedTemplateId.value = parsed.selectedTemplateId
        selectedIterateTemplateId.value = parsed.selectedIterateTemplateId
        isCompareMode.value = parsed.isCompareMode
        lastActiveAt.value = Date.now()
      }

      // 兼容迁移：模板选择（从旧 TEMPLATE_SELECTION_KEYS 迁移一次）
      if (!selectedTemplateId.value) {
        const legacyTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.USER_OPTIMIZE_TEMPLATE,
          ''
        )
        if (legacyTemplateId) {
          selectedTemplateId.value = legacyTemplateId
        }
      }
      if (!selectedIterateTemplateId.value) {
        const legacyIterateTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.ITERATE_TEMPLATE,
          ''
        )
        if (legacyIterateTemplateId) {
          selectedIterateTemplateId.value = legacyIterateTemplateId
        }
      }
    } catch (error) {
      console.error('[BasicUserSession] 恢复会话失败:', error)
      // 恢复失败时保持当前状态或重置为默认
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

export type BasicUserSessionApi = ReturnType<typeof useBasicUserSession>
