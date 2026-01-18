/**
 * Image-Text2Image Session Store
 *
 * 管理 Image 模式下 Text2Image 子模式的会话状态
 * - 原始提示词和优化结果
 * - 图像生成结果（使用 ImageRef 引用，base64 数据存储在 ImageStorageService）
 */

import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import {
  isImageRef,
  createImageRef,
  type ImageResult,
  type ImageRef,
  type IImageStorageService
} from '@prompt-optimizer/core'

type ImageResultItem = ImageResult['images'][number]

/**
 * 默认状态
 */
const createDefaultState = () => ({
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
  // ========== 状态定义（使用独立 ref，而非包装在 state 对象中）==========

  const originalPrompt = ref('')
  const optimizedPrompt = ref('')
  const reasoning = ref('')
  const chainId = ref('')
  const versionId = ref('')
  const originalImageResult = ref<ImageResult | null>(null)
  const optimizedImageResult = ref<ImageResult | null>(null)
  const isCompareMode = ref(true)
  const selectedTextModelKey = ref('')
  const selectedImageModelKey = ref('')
  const selectedTemplateId = ref<string | null>(null)
  const selectedIterateTemplateId = ref<string | null>(null)
  const lastActiveAt = ref(Date.now())

  const updatePrompt = (prompt: string) => {
    if (originalPrompt.value === prompt) return
    originalPrompt.value = prompt
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

  const updateOriginalImageResult = (result: ImageResult | null) => {
    originalImageResult.value = result
    lastActiveAt.value = Date.now()
  }

  const updateOptimizedImageResult = (result: ImageResult | null) => {
    optimizedImageResult.value = result
    lastActiveAt.value = Date.now()
  }

  const updateTextModel = (modelKey: string) => {
    if (selectedTextModelKey.value === modelKey) return
    selectedTextModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    saveSession()
  }

  const updateImageModel = (modelKey: string) => {
    if (selectedImageModelKey.value === modelKey) return
    selectedImageModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    // 异步保存完整状态（best-effort）
    saveSession()
  }

  const updateTemplate = (templateId: string | null) => {
    if (selectedTemplateId.value === templateId) return
    selectedTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession()
  }

  const updateIterateTemplate = (templateId: string | null) => {
    if (selectedIterateTemplateId.value === templateId) return
    selectedIterateTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession()
  }

  const toggleCompareMode = (enabled?: boolean) => {
    const nextValue = enabled ?? !isCompareMode.value
    if (isCompareMode.value === nextValue) return
    isCompareMode.value = nextValue
    lastActiveAt.value = Date.now()
  }

  const reset = () => {
    const defaultState = createDefaultState()
    originalPrompt.value = defaultState.originalPrompt
    optimizedPrompt.value = defaultState.optimizedPrompt
    reasoning.value = defaultState.reasoning
    chainId.value = defaultState.chainId
    versionId.value = defaultState.versionId
    originalImageResult.value = defaultState.originalImageResult
    optimizedImageResult.value = defaultState.optimizedImageResult
    isCompareMode.value = defaultState.isCompareMode
    selectedTextModelKey.value = defaultState.selectedTextModelKey
    selectedImageModelKey.value = defaultState.selectedImageModelKey
    selectedTemplateId.value = defaultState.selectedTemplateId
    selectedIterateTemplateId.value = defaultState.selectedIterateTemplateId
    lastActiveAt.value = defaultState.lastActiveAt
  }

  /**
   * 准备 ImageResult 用于保存
   * 将 base64 图像提取到 ImageStorageService，返回仅包含引用的 ImageResult
   */
  const prepareForSave = async (
    result: ImageResult | null,
    storageService: IImageStorageService
  ): Promise<ImageResult | null> => {
    if (!result || !result.images || result.images.length === 0) {
      return result
    }

    const processedImages: ImageResultItem[] = []

    for (const img of result.images) {
      // 如果已经是引用，直接保留
      if (isImageRef(img)) {
        processedImages.push(img)
        continue
      }

      // 如果有 base64 数据，保存到存储服务并创建引用
      if (img.b64) {
        try {
          const imageId = await storageService.saveImage({
            metadata: {
              id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
              mimeType: img.mimeType || 'image/png',
              sizeBytes: Math.floor(img.b64.length * 0.75),
              createdAt: Date.now(),
              accessedAt: Date.now(),
              source: 'generated',
              metadata: {
                prompt: result.metadata?.prompt,
                modelId: result.metadata?.modelId,
                configId: result.metadata?.configId
              }
            },
            data: img.b64
          })

          processedImages.push(createImageRef(imageId))
        } catch (error) {
          console.error('[ImageText2ImageSession] 保存图像失败:', error)
          // 保存失败时保留原始数据（降级处理）
          processedImages.push(img)
        }
      } else {
        // URL 或其他格式，直接保留
        processedImages.push(img)
      }
    }

    return {
      ...result,
      images: processedImages
    }
  }

  /**
   * 从 ImageRef 加载完整图像数据
   */
  const loadFromRef = async (
    result: ImageResult | null,
    storageService: IImageStorageService
  ): Promise<ImageResult | null> => {
    if (!result || !result.images || result.images.length === 0) {
      return result
    }

    const loadedImages: ImageResultItem[] = []

    for (const img of result.images) {
      // 如果是引用，从存储服务加载
      if (isImageRef(img)) {
        try {
          const fullImageData = await storageService.getImage(img.id)
          if (fullImageData) {
            loadedImages.push({
              b64: fullImageData.data,
              mimeType: fullImageData.metadata.mimeType
            })
          } else {
            console.warn(`[ImageText2ImageSession] 图像 ${img.id} 未找到`)
            // 图像未找到，保留引用（UI 会显示错误）
            loadedImages.push(img)
          }
        } catch (error) {
          console.error(`[ImageText2ImageSession] 加载图像 ${img.id} 失败:`, error)
          // 加载失败，保留引用
          loadedImages.push(img)
        }
      } else {
        // 非引用格式（URL 或 base64），直接保留
        loadedImages.push(img)
      }
    }

    return {
      ...result,
      images: loadedImages
    }
  }

  const saveSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[ImageText2ImageSession] PreferenceService 不可用，无法保存会话')
      return
    }

    if (!$services?.imageStorageService) {
      console.warn('[ImageText2ImageSession] ImageStorageService 不可用，将直接保存 base64')
    }

    try {
      // 准备保存的数据：将图像转换为引用
      let originalResultToSave = originalImageResult.value
      let optimizedResultToSave = optimizedImageResult.value

      if ($services?.imageStorageService) {
        originalResultToSave = await prepareForSave(
          originalImageResult.value,
          $services.imageStorageService
        )
        optimizedResultToSave = await prepareForSave(
          optimizedImageResult.value,
          $services.imageStorageService
        )

        // ✅ 修复：不修改运行时 ref，只在序列化时使用转换后的数据
        // 原代码会导致界面上的图像消失，因为 ImageRef 不包含实际图像数据
      }

      // 构建快照（仅包含引用，不包含 base64）
      const snapshot = {
        originalPrompt: originalPrompt.value,
        optimizedPrompt: optimizedPrompt.value,
        reasoning: reasoning.value,
        chainId: chainId.value,
        versionId: versionId.value,
        originalImageResult: originalResultToSave,
        optimizedImageResult: optimizedResultToSave,
        isCompareMode: isCompareMode.value,
        selectedTextModelKey: selectedTextModelKey.value,
        selectedImageModelKey: selectedImageModelKey.value,
        selectedTemplateId: selectedTemplateId.value,
        selectedIterateTemplateId: selectedIterateTemplateId.value,
        lastActiveAt: lastActiveAt.value,
      }

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

    if (!$services?.imageStorageService) {
      console.warn('[ImageText2ImageSession] ImageStorageService 不可用，将直接使用 session 数据')
    }

    try {
      const saved = await $services.preferenceService.get<unknown>(
        'session/v1/image-text2image',
        null
      )

      if (saved) {
        const parsed =
          typeof saved === 'string'
            ? (JSON.parse(saved) as Record<string, unknown>)
            : (saved as Record<string, unknown>)

        // 从引用加载完整图像数据
        // restore data is untrusted; cast to expected shape and validate defensively.
        let originalResultLoaded: ImageResult | null = (parsed.originalImageResult as ImageResult | null) ?? null
        let optimizedResultLoaded: ImageResult | null = (parsed.optimizedImageResult as ImageResult | null) ?? null

        if ($services?.imageStorageService) {
          originalResultLoaded = await loadFromRef(
            originalResultLoaded,
            $services.imageStorageService
          )
          optimizedResultLoaded = await loadFromRef(
            optimizedResultLoaded,
            $services.imageStorageService
          )
        }

        originalPrompt.value = typeof parsed.originalPrompt === 'string' ? parsed.originalPrompt : ''
        optimizedPrompt.value = typeof parsed.optimizedPrompt === 'string' ? parsed.optimizedPrompt : ''
        reasoning.value = typeof parsed.reasoning === 'string' ? parsed.reasoning : ''
        chainId.value = typeof parsed.chainId === 'string' ? parsed.chainId : ''
        versionId.value = typeof parsed.versionId === 'string' ? parsed.versionId : ''
        originalImageResult.value = originalResultLoaded
        optimizedImageResult.value = optimizedResultLoaded
        isCompareMode.value = typeof parsed.isCompareMode === 'boolean' ? parsed.isCompareMode : true
        selectedTextModelKey.value = typeof parsed.selectedTextModelKey === 'string' ? parsed.selectedTextModelKey : ''
        selectedImageModelKey.value = typeof parsed.selectedImageModelKey === 'string' ? parsed.selectedImageModelKey : ''
        selectedTemplateId.value = typeof parsed.selectedTemplateId === 'string' ? parsed.selectedTemplateId : null
        selectedIterateTemplateId.value = typeof parsed.selectedIterateTemplateId === 'string' ? parsed.selectedIterateTemplateId : null
        lastActiveAt.value = Date.now()
      }
      // else: 没有保存的会话，使用默认状态
    } catch (error) {
      console.error('[ImageText2ImageSession] 恢复会话失败:', error)
      reset()
    }
  }

  return {
    // ========== 状态（直接返回，Pinia 会自动追踪响应式）==========
    originalPrompt,
    optimizedPrompt,
    reasoning,
    chainId,
    versionId,
    originalImageResult,
    optimizedImageResult,
    isCompareMode,
    selectedTextModelKey,
    selectedImageModelKey,
    selectedTemplateId,
    selectedIterateTemplateId,
    lastActiveAt,

    // ========== 更新方法 ==========
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

    // ========== 持久化方法 ==========
    saveSession,
    restoreSession,
  }
})

export type ImageText2ImageSessionApi = ReturnType<typeof useImageText2ImageSession>
