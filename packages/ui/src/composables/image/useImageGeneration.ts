import { computed, ref, inject, type Ref } from 'vue'

import type { AppServices } from '../../types/services'
import type {
  ImageRequest,
  ImageResult,
  ImageModelConfig,
  Text2ImageRequest,
  Image2ImageRequest,
  MultiImageGenerationRequest,
  MultiImageRequest,
} from '@prompt-optimizer/core'
import { getI18nErrorMessage } from '../../utils/error'
import {
  normalizeImageSourceToPayload,
  persistImagePayloadAsAssetId,
} from '../../utils/image-asset-storage'

const normalizeRuntimeImageResult = async (
  result: ImageResult,
  services: AppServices | null | undefined,
): Promise<ImageResult> => {
  if (!Array.isArray(result.images) || result.images.length === 0) {
    return result
  }

  const normalizedImages = await Promise.all(
    result.images.map(async (image) => {
      if (!image?.url || image.b64) {
        return image
      }

      try {
        const payload = await normalizeImageSourceToPayload(image.url)
        if (!payload) {
          return image
        }

        if (services?.imageStorageService) {
          try {
            await persistImagePayloadAsAssetId({
              payload,
              storageService: services.imageStorageService,
              sourceType: 'generated',
              metadata: {
                prompt: result.metadata?.prompt,
                modelId: result.metadata?.modelId,
                configId: result.metadata?.configId,
              },
            })
          } catch (error) {
            console.warn('[useImageGeneration] Failed to persist normalized image payload:', error)
          }
        }

        return {
          b64: payload.b64,
          mimeType: payload.mimeType,
        }
      } catch (error) {
        console.warn('[useImageGeneration] Failed to normalize url image result:', error)
        return image
      }
    }),
  )

  return {
    ...result,
    images: normalizedImages,
  }
}

export function useImageGeneration() {
  const services = inject<Ref<AppServices | null>>('services')
  const generating = ref(false)
  const progress = ref<string | number | { phase: string; progress: number }>('idle')
  const error = ref<string>('')
  const result = ref<ImageResult | null>(null)

  const imageModels = ref<ImageModelConfig[]>([])
  // 只有成功读取的列表才能用于清理工作区中的失效选择。
  const isImageModelListReady = ref(false)
  let imageModelRefreshToken = 0

  const loadImageModels = async () => {
    const token = ++imageModelRefreshToken
    isImageModelListReady.value = false
    if (!services?.value?.imageModelManager) {
      imageModels.value = []
      return
    }
    try {
      // 直接使用 getEnabledConfigs 获取自包含的配置数据
      const enabledConfigs = await services.value.imageModelManager.getEnabledConfigs()
      if (token !== imageModelRefreshToken) return
      isImageModelListReady.value = true
      imageModels.value = enabledConfigs
    } catch (error) {
      if (token !== imageModelRefreshToken) return
      console.error('Failed to load image models:', error)
      imageModels.value = []
    }
  }

  const callGenerate = async (call: () => Promise<ImageResult>) => {
    error.value = ''
    result.value = null
    generating.value = true
    progress.value = 'queued'
    try {
      const res = await call()
      const normalized = await normalizeRuntimeImageResult(res, services?.value)
      result.value = normalized
      progress.value = 'done'
      return normalized
    } catch (e) {
      // Preserve structured errors ({ code, params }) coming from core / Electron preload.
      // Do not wrap non-Error objects into Error, otherwise code/params get lost.
      error.value = getI18nErrorMessage(e, 'Image generation failed')
      progress.value = 'error'
      throw e
    } finally {
      generating.value = false
    }
  }

  // 兼容入口：保留原 generate（内部可能仍会按 inputImage 推断模式）
  const generate = async (req: ImageRequest) => {
    if (!services?.value?.imageService) throw new Error('Image service not available')
    return await callGenerate(() => services.value!.imageService!.generate(req))
  }

  // 显式入口：由 UI 明确决定模式
  const generateText2Image = async (req: Text2ImageRequest) => {
    if (!services?.value?.imageService) throw new Error('Image service not available')
    return await callGenerate(() => services.value!.imageService!.generateText2Image(req))
  }

  const generateImage2Image = async (req: Image2ImageRequest) => {
    if (!services?.value?.imageService) throw new Error('Image service not available')
    return await callGenerate(() => services.value!.imageService!.generateImage2Image(req))
  }

  const generateMultiImage = async (req: MultiImageGenerationRequest) => {
    if (!services?.value?.imageService) throw new Error('Image service not available')
    return await callGenerate(() => services.value!.imageService!.generateMultiImage(req))
  }

  const validateText2ImageRequest = async (req: Text2ImageRequest) => {
    if (!services?.value?.imageService) throw new Error('Image service not available')
    await services.value.imageService.validateText2ImageRequest(req)
  }

  const validateImage2ImageRequest = async (req: Image2ImageRequest) => {
    if (!services?.value?.imageService) throw new Error('Image service not available')
    await services.value.imageService.validateImage2ImageRequest(req)
  }

  const validateMultiImageRequest = async (req: MultiImageRequest) => {
    if (!services?.value?.imageService) throw new Error('Image service not available')
    await services.value.imageService.validateMultiImageRequest(req)
  }

  return {
    services,
    imageModels,
    isImageModelListReady,
    generating,
    progress,
    error,
    result,
    generate,
    generateText2Image,
    generateImage2Image,
    generateMultiImage,
    validateText2ImageRequest,
    validateImage2ImageRequest,
    validateMultiImageRequest,
    loadImageModels
  }
}
