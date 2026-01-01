/**
 * Basic-System Session Store
 *
 * 管理 Basic 模式下 System 子模式的会话状态
 * - 原始提示词和优化结果
 * - 历史版本链
 * - 测试结果
 * - 模型和模板选择（只持久化 ID/key）
 *
 * 设计原则（基于 Codex 审查）：
 * - 只持久化 ID/key，不持久化完整对象
 * - 所有持久化统一走 PreferenceService
 * - 使用 Record 而非 Map（便于序列化）
 */

import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'

/**
 * 测试结果结构
 */
export interface TestResults {
  originalResult: string
  optimizedResult: string
}

/**
 * Basic-System 会话状态
 */
export interface BasicSystemSessionState {
  // 提示词相关
  prompt: string
  optimizedPrompt: string
  reasoning: string

  // 历史相关（只存 ID）
  chainId: string
  versionId: string

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
const createDefaultState = (): BasicSystemSessionState => ({
  prompt: '',
  optimizedPrompt: '',
  reasoning: '',
  chainId: '',
  versionId: '',
  testResults: null,
  selectedOptimizeModelKey: '',
  selectedTestModelKey: '',
  selectedTemplateId: null,
  selectedIterateTemplateId: null,
  isCompareMode: true,
  lastActiveAt: Date.now(),
})

export const useBasicSystemSession = defineStore('basicSystemSession', () => {
  /**
   * 会话状态
   */
  const state: Ref<BasicSystemSessionState> = ref(createDefaultState())

  /**
   * 更新提示词
   */
  const updatePrompt = (prompt: string) => {
    state.value.prompt = prompt
    state.value.lastActiveAt = Date.now()
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
    state.value.optimizedPrompt = payload.optimizedPrompt
    state.value.reasoning = payload.reasoning || ''
    state.value.chainId = payload.chainId
    state.value.versionId = payload.versionId
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
   * 更新迭代模板选择
   */
  const updateIterateTemplate = (templateId: string | null) => {
    state.value.selectedIterateTemplateId = templateId
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
   * 保存会话到持久化存储
   * 使用 PreferenceService（Codex 要求）
   */
  const saveSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[BasicSystemSession] PreferenceService 不可用，无法保存会话')
      return
    }

    try {
      const snapshot = JSON.stringify(state.value)
      await $services.preferenceService.set(
        'session/v1/basic-system',
        snapshot
      )
    } catch (error) {
      console.error('[BasicSystemSession] 保存会话失败:', error)
    }
  }

  /**
   * 从持久化存储恢复会话
   * 使用 PreferenceService（Codex 要求）
   */
  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[BasicSystemSession] PreferenceService 不可用，无法恢复会话')
      return
    }

    try {
      const saved = await $services.preferenceService.get(
        'session/v1/basic-system',
        ''
      )

      if (saved) {
        const parsed = JSON.parse(saved) as BasicSystemSessionState
        state.value = {
          ...createDefaultState(),
          ...parsed,
          lastActiveAt: Date.now(), // 更新活跃时间
        }
      }
    } catch (error) {
      console.error('[BasicSystemSession] 恢复会话失败:', error)
      // 恢复失败时保持当前状态或重置为默认
      reset()
    }
  }

  return {
    // 状态
    state,

    // 更新方法
    updatePrompt,
    updateOptimizedResult,
    updateTestResults,
    updateOptimizeModel,
    updateTestModel,
    updateTemplate,
    updateIterateTemplate,
    toggleCompareMode,
    reset,

    // 持久化方法
    saveSession,
    restoreSession,
  }
})

export type BasicSystemSessionApi = ReturnType<typeof useBasicSystemSession>
