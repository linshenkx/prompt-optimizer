import { computed, ref, inject, type Ref } from 'vue'

import type { AppServices } from '../../types/services'
import type {
  ImageRequest,
  ImageResult,
  ImageModelConfig,
  Text2ImageRequest,
  Image2ImageRequest
} from '@prompt-optimizer/core'
import { getI18nErrorMessage } from '../../utils/error'

export function useImageGeneration() {
  const services = inject<Ref<AppServices | null>>('services')
  const generating = ref(false)
  const progress = ref<string | number | { phase: string; progress: number }>('idle')
  const error = ref<string>('')
  const result = ref<ImageResult | null>(null)

  const imageModels = ref<ImageModelConfig[]>([])

  const loadImageModels = async () => {
    if (!services?.value?.imageModelManager) {
      imageModels.value = []
      return
    }
    try {
      // 直接使用 getEnabledConfigs 获取自包含的配置数据
      const enabledConfigs = await services.value.imageModelManager.getEnabledConfigs()
      imageModels.value = enabledConfigs
    } catch (error) {
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
      result.value = res
      progress.value = 'done'
      return res
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

  const validateText2ImageRequest = async (req: Text2ImageRequest) => {
    if (!services?.value?.imageService) throw new Error('Image service not available')
    await services.value.imageService.validateText2ImageRequest(req)
  }

  const validateImage2ImageRequest = async (req: Image2ImageRequest) => {
    if (!services?.value?.imageService) throw new Error('Image service not available')
    await services.value.imageService.validateImage2ImageRequest(req)
  }

  return {
    services,
    imageModels,
    generating,
    progress,
    error,
    result,
    generate,
    generateText2Image,
    generateImage2Image,
    validateText2ImageRequest,
    validateImage2ImageRequest,
    loadImageModels
  }
}
