/**
 * Basic-User Session Store
 *
 * 管理 Basic 模式下 User 子模式的会话状态
 * 结构与 BasicSystemSession 相同
 */

import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'

export interface TestResults {
  originalResult: string
  optimizedResult: string
}

export interface BasicUserSessionState {
  prompt: string
  optimizedPrompt: string
  reasoning: string
  chainId: string
  versionId: string
  testContent: string
  testResults: TestResults | null
  selectedOptimizeModelKey: string
  selectedTestModelKey: string
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null
  isCompareMode: boolean
  lastActiveAt: number
}

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
  const state: Ref<BasicUserSessionState> = ref(createDefaultState())

  const updatePrompt = (prompt: string) => {
    state.value.prompt = prompt
    state.value.lastActiveAt = Date.now()
  }

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

  const updateTestResults = (results: TestResults | null) => {
    state.value.testResults = results
    state.value.lastActiveAt = Date.now()
  }

  const updateTestContent = (content: string) => {
    state.value.testContent = content
    state.value.lastActiveAt = Date.now()
  }

  const updateOptimizeModel = (modelKey: string) => {
    state.value.selectedOptimizeModelKey = modelKey
    state.value.lastActiveAt = Date.now()
  }

  const updateTestModel = (modelKey: string) => {
    state.value.selectedTestModelKey = modelKey
    state.value.lastActiveAt = Date.now()
  }

  const updateTemplate = (templateId: string | null) => {
    state.value.selectedTemplateId = templateId
    state.value.lastActiveAt = Date.now()
  }

  const updateIterateTemplate = (templateId: string | null) => {
    state.value.selectedIterateTemplateId = templateId
    state.value.lastActiveAt = Date.now()
  }

  const toggleCompareMode = (enabled?: boolean) => {
    state.value.isCompareMode = enabled ?? !state.value.isCompareMode
    state.value.lastActiveAt = Date.now()
  }

  const reset = () => {
    state.value = createDefaultState()
  }

  const saveSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[BasicUserSession] PreferenceService 不可用，无法保存会话')
      return
    }

    try {
      const snapshot = JSON.stringify(state.value)
      await $services.preferenceService.set(
        'session/v1/basic-user',
        snapshot
      )
    } catch (error) {
      console.error('[BasicUserSession] 保存会话失败:', error)
    }
  }

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
        state.value = {
          ...createDefaultState(),
          ...parsed,
          lastActiveAt: Date.now(),
        }
      }
      // else: 没有保存的会话，使用默认状态
    } catch (error) {
      console.error('[BasicUserSession] 恢复会话失败:', error)
      reset()
    }
  }

  return {
    state,
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
    saveSession,
    restoreSession,
  }
})

export type BasicUserSessionApi = ReturnType<typeof useBasicUserSession>
