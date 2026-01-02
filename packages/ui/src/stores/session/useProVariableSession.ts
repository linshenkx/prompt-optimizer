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

export interface TestResults {
  originalResult: string
  optimizedResult: string
}

export interface ProVariableSessionState {
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

const createDefaultState = (): ProVariableSessionState => ({
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
  const state: Ref<ProVariableSessionState> = ref(createDefaultState())

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
      console.warn('[ProVariableSession] PreferenceService 不可用，无法保存会话')
      return
    }

    try {
      const snapshot = JSON.stringify(state.value)
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
        const parsed = JSON.parse(saved) as ProVariableSessionState
        state.value = {
          ...createDefaultState(),
          ...parsed,
          lastActiveAt: Date.now(),
        }
      }
      // else: 没有保存的会话，使用默认状态
    } catch (error) {
      console.error('[ProVariableSession] 恢复会话失败:', error)
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

export type ProVariableSessionApi = ReturnType<typeof useProVariableSession>
