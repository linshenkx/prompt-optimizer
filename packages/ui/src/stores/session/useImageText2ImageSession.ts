/**
 * Image-Text2Image Session Store
 *
 * 管理 Image 模式下 Text2Image 子模式的会话状态
 * - 原始提示词和优化结果
 * - 图像生成结果（可持久化 base64）
 */

import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import type { ImageResult } from '@prompt-optimizer/core'

export interface ImageText2ImageSessionState {
  // 提示词相关
  originalPrompt: string
  optimizedPrompt: string
  reasoning: string

  // 历史相关（只存 ID）
  chainId: string
  versionId: string

  // 图像结果
  originalImageResult: ImageResult | null
  optimizedImageResult: ImageResult | null

  // 对比模式
  isCompareMode: boolean

  // 模型选择（只存 key）
  selectedTextModelKey: string   // 文本优化模型
  selectedImageModelKey: string  // 图像生成模型

  // 模板选择（只存 ID）
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null

  // 最后活跃时间
  lastActiveAt: number
}

const createDefaultState = (): ImageText2ImageSessionState => ({
  originalPrompt: '',
  optimizedPrompt: '',
  reasoning: '',
  chainId: '',
  versionId: '',
  originalImageResult: null,
  optimizedImageResult: null,
  isCompareMode: true,
  selectedTextModelKey: '',
  selectedImageModelKey: '',
  selectedTemplateId: null,
  selectedIterateTemplateId: null,
  lastActiveAt: Date.now(),
})

export const useImageText2ImageSession = defineStore('imageText2ImageSession', () => {
  const state: Ref<ImageText2ImageSessionState> = ref(createDefaultState())

  const updatePrompt = (prompt: string) => {
    state.value.originalPrompt = prompt
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

  const updateOriginalImageResult = (result: ImageResult | null) => {
    state.value.originalImageResult = result
    state.value.lastActiveAt = Date.now()
  }

  const updateOptimizedImageResult = (result: ImageResult | null) => {
    state.value.optimizedImageResult = result
    state.value.lastActiveAt = Date.now()
  }

  const updateTextModel = (modelKey: string) => {
    state.value.selectedTextModelKey = modelKey
    state.value.lastActiveAt = Date.now()
  }

  const updateImageModel = (modelKey: string) => {
    state.value.selectedImageModelKey = modelKey
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
      console.warn('[ImageText2ImageSession] PreferenceService 不可用，无法保存会话')
      return
    }

    try {
      const snapshot = JSON.stringify(state.value)
      await $services.preferenceService.set(
        'session/v1/image-text2image',
        snapshot
      )
    } catch (error) {
      console.error('[ImageText2ImageSession] 保存会话失败:', error)
    }
  }

  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[ImageText2ImageSession] PreferenceService 不可用，无法恢复会话')
      return
    }

    try {
      const saved = await $services.preferenceService.get(
        'session/v1/image-text2image',
        ''
      )

      if (saved) {
        const parsed = JSON.parse(saved) as ImageText2ImageSessionState
        state.value = {
          ...createDefaultState(),
          ...parsed,
          lastActiveAt: Date.now(),
        }
      }
      // else: 没有保存的会话，使用默认状态
    } catch (error) {
      console.error('[ImageText2ImageSession] 恢复会话失败:', error)
      reset()
    }
  }

  return {
    state,
    updatePrompt,
    updateOptimizedResult,
    updateOriginalImageResult,
    updateOptimizedImageResult,
    updateTextModel,
    updateImageModel,
    updateTemplate,
    updateIterateTemplate,
    toggleCompareMode,
    reset,
    saveSession,
    restoreSession,
  }
})

export type ImageText2ImageSessionApi = ReturnType<typeof useImageText2ImageSession>
