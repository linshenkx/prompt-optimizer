import { computed, nextTick, ref, shallowRef, watch, type Ref } from 'vue'
import type { UploadFileInfo } from 'naive-ui'

import { v4 as uuidv4 } from 'uuid'
import {
  type ImageModelConfig,
  type ImageRequest,
  type ImageResult,
  type ImageResultItem,
  type ImageSubMode,
  type OptimizationMode,
  type OptimizationRequest,
  type PromptRecordChain,
  type PromptRecordType,
  type Template,
} from '@prompt-optimizer/core'

import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { useImageGeneration } from './useImageGeneration'
import { useEvaluationHandler } from '../prompt/useEvaluationHandler'
import type { UseEvaluationReturn } from '../prompt/useEvaluation'

import type { AppServices } from '../../types/services'
import type { ModelSelectOption, SelectOption } from '../../types/select-options'

import { useImageText2ImageSession } from '../../stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../stores/session/useImageImage2ImageSession'

/**
 * 图像模式工作区 Hook（Session Store 单一真源）
 *
 * 核心原则：
 * - 所有可持久化字段都来自 image session store（text2image/image2image 各自独立）
 * - 模板对象由 templateId 派生（带竞态保护）
 * - 过程态（上传/生成进度等）为本地 ref，不写入 store
 */
export interface ImageUploadChangePayload {
  file: UploadFileInfo | null | undefined
  fileList: UploadFileInfo[]
  event?: Event
}

type TemplateKind = Template['metadata']['templateType']

export interface UseImageWorkspaceOptions {
  imageSubMode: Ref<ImageSubMode>
  setImageSubMode: (mode: ImageSubMode) => Promise<void>
  externalEvaluation?: UseEvaluationReturn
}

export function useImageWorkspace(services: Ref<AppServices | null>, options: UseImageWorkspaceOptions) {
  const toast = useToast()
  const { t } = useI18n()
  const { imageSubMode, setImageSubMode, externalEvaluation } = options

  const {
    imageModels,
    generating: isGenerating,
    progress: generationProgress,
    error: generationError,
    result: imageResult,
    generate: generateImage,
    loadImageModels,
  } = useImageGeneration()

  // 服务引用
  const modelManager = computed(() => services.value?.modelManager)
  const templateManager = computed(() => services.value?.templateManager)
  const historyManager = computed(() => services.value?.historyManager)
  const promptService = computed(() => services.value?.promptService)

  // ========== Image session stores（单一真源） ==========
  const text2imageSession = useImageText2ImageSession()
  const image2imageSession = useImageImage2ImageSession()

  const activeSession = computed(() => {
    return imageSubMode.value === 'image2image' ? image2imageSession : text2imageSession
  })

  // ========== 过程态（本地，不持久化） ==========
  const isOptimizing = ref(false)
  const isIterating = ref(false)
  const uploadStatus = ref<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const uploadProgress = ref(0)

  const resetTransientState = () => {
    uploadStatus.value = 'idle'
    uploadProgress.value = 0
  }

  // ========== 历史管理专用 ref（不写入 session store） ==========
  const currentChainId = ref('')
  const currentVersions = ref<PromptRecordChain['versions']>([])
  const currentVersionId = ref('')

  // ========== 字段级代理（持久化字段：activeSession） ==========
  const originalPrompt = computed<string>({
    get: () => activeSession.value.state.originalPrompt || '',
    set: (value) => activeSession.value.updatePrompt(value || ''),
  })

  const optimizedPrompt = computed<string>({
    get: () => activeSession.value.state.optimizedPrompt || '',
    set: (value) => {
      activeSession.value.updateOptimizedResult({
        optimizedPrompt: value || '',
        reasoning: activeSession.value.state.reasoning || '',
        chainId: activeSession.value.state.chainId || '',
        versionId: activeSession.value.state.versionId || '',
      })
    },
  })

  const optimizedReasoning = computed<string>({
    get: () => activeSession.value.state.reasoning || '',
    set: (value) => {
      activeSession.value.updateOptimizedResult({
        optimizedPrompt: activeSession.value.state.optimizedPrompt || '',
        reasoning: value || '',
        chainId: activeSession.value.state.chainId || '',
        versionId: activeSession.value.state.versionId || '',
      })
    },
  })

  const selectedTextModelKey = computed<string>({
    get: () => activeSession.value.state.selectedTextModelKey || '',
    set: (value) => activeSession.value.updateTextModel(value || ''),
  })

  const selectedImageModelKey = computed<string>({
    get: () => activeSession.value.state.selectedImageModelKey || '',
    set: (value) => activeSession.value.updateImageModel(value || ''),
  })

  const selectedTemplateId = computed<string>({
    get: () => activeSession.value.state.selectedTemplateId || '',
    set: (value) => activeSession.value.updateTemplate(value || null),
  })

  const selectedIterateTemplateId = computed<string>({
    get: () => activeSession.value.state.selectedIterateTemplateId || '',
    set: (value) => activeSession.value.updateIterateTemplate(value || null),
  })

  const isCompareMode = computed<boolean>({
    get: () => !!activeSession.value.state.isCompareMode,
    set: (value) => activeSession.value.toggleCompareMode(!!value),
  })

  const originalImageResult = computed<ImageResult | null>({
    get: () => activeSession.value.state.originalImageResult || null,
    set: (value) => activeSession.value.updateOriginalImageResult(value || null),
  })

  const optimizedImageResult = computed<ImageResult | null>({
    get: () => activeSession.value.state.optimizedImageResult || null,
    set: (value) => activeSession.value.updateOptimizedImageResult(value || null),
  })

  // Image2Image 特有：输入图像（用户要求：切换 text2image/image2image 时保留，不做清空）
  const inputImageB64 = computed<string | null>({
    get: () => image2imageSession.state.inputImageB64 || null,
    set: (value) => {
      image2imageSession.updateInputImage(value, image2imageSession.state.inputImageMime || '')
    },
  })
  const inputImageMime = computed<string>({
    get: () => image2imageSession.state.inputImageMime || '',
    set: (value) => {
      image2imageSession.updateInputImage(image2imageSession.state.inputImageB64 || null, value || '')
    },
  })

  // 当前提示词（用于生成图像）
  const currentPrompt = computed(() => optimizedPrompt.value || originalPrompt.value)

  // 根据子模式确定模板类型
  const templateType = computed<TemplateKind>(() => {
    return imageSubMode.value === 'text2image' ? 'text2imageOptimize' : 'image2imageOptimize'
  })

  // 图像模式统一使用 user 模式
  const optimizationMode = 'user' as OptimizationMode
  const advancedModeEnabled = false

  // ========== 模板对象派生（防竞态） ==========
  const selectedTemplateRef = shallowRef<Template | null>(null)
  const selectedIterateTemplateRef = shallowRef<Template | null>(null)

  let templateResolveToken = 0
  watch(
    [templateType, selectedTemplateId, templateManager],
    async ([type, templateId, manager]) => {
      const token = ++templateResolveToken
      if (!manager) {
        selectedTemplateRef.value = null
        return
      }

      try {
        const templates = await manager.listTemplatesByType(type)
        if (token !== templateResolveToken) return

        const selected = templateId ? templates.find(t => t.id === templateId) || null : null
        selectedTemplateRef.value = selected
      } catch (e) {
        if (token !== templateResolveToken) return
        console.warn('[useImageWorkspace] Failed to resolve optimize template:', e)
        selectedTemplateRef.value = null
      }
    },
    { immediate: true },
  )

  let iterateResolveToken = 0
  watch(
    [selectedIterateTemplateId, templateManager],
    async ([iterateId, manager]) => {
      const token = ++iterateResolveToken
      if (!manager) {
        selectedIterateTemplateRef.value = null
        return
      }

      try {
        const templates = await manager.listTemplatesByType('imageIterate')
        if (token !== iterateResolveToken) return
        const selected = iterateId ? templates.find(t => t.id === iterateId) || null : null
        selectedIterateTemplateRef.value = selected
      } catch (e) {
        if (token !== iterateResolveToken) return
        console.warn('[useImageWorkspace] Failed to resolve iterate template:', e)
        selectedIterateTemplateRef.value = null
      }
    },
    { immediate: true },
  )

  const selectedTemplate = computed<Template | null>({
    get: () => selectedTemplateRef.value,
    set: (template) => {
      selectedTemplateId.value = template?.id || ''
    },
  })

  const selectedIterateTemplate = computed<Template | null>({
    get: () => selectedIterateTemplateRef.value,
    set: (template) => {
      selectedIterateTemplateId.value = template?.id || ''
    },
  })

  // 预览图像URL（仅在 image2image 模式有效）
  const previewImageUrl = computed(() => {
    if (imageSubMode.value !== 'image2image') return null
    if (!inputImageB64.value) return null
    const mimeType = inputImageMime.value || 'image/png'
    return `data:${mimeType};base64,${inputImageB64.value}`
  })

  // 模型选项
  const textModelOptions = ref<ModelSelectOption[]>([])
  const imageModelOptions = ref<SelectOption<ImageModelConfig>[]>([])

  // 选中图像模型的Provider/Model信息
  const selectedImageModelInfo = computed(() => {
    if (!selectedImageModelKey.value) return null
    const selectedConfig = imageModels.value.find(m => m.id === selectedImageModelKey.value)
    if (!selectedConfig) return null

    return {
      provider: selectedConfig.provider?.name || selectedConfig.providerId || 'Unknown',
      model: selectedConfig.model?.name || selectedConfig.modelId || 'Unknown',
    }
  })

  // 选中图像模型能力（调试用）
  const selectedImageModelCapabilities = computed(() => {
    if (!selectedImageModelKey.value) return null
    const selectedConfig = imageModels.value.find(m => m.id === selectedImageModelKey.value)
    return selectedConfig?.model?.capabilities || null
  })

  const refreshTextModels = async () => {
    if (!modelManager.value) {
      textModelOptions.value = []
      return
    }

    try {
      const manager = modelManager.value
      await manager.ensureInitialized()

      const textModels = await manager.getEnabledModels()
      textModelOptions.value = textModels.map(m => ({
        label: `${m.name} (${m.providerMeta.name})`,
        primary: m.name,
        secondary: m.providerMeta.name ?? 'Unknown',
        value: m.id,
        raw: m,
      }))

      // 没有可用模型时：不要清空已选 key（避免服务/配置短暂不可用时把 session 覆盖成空）
      if (!textModels.length) {
        return
      }

      const currentKey = selectedTextModelKey.value
      const keys = new Set(textModels.map(m => m.id))
      const fallback = textModels[0]?.id || ''

      const needsFallback = (!currentKey && fallback) || (currentKey && !keys.has(currentKey))
      if (needsFallback) {
        selectedTextModelKey.value = fallback
      }
    } catch (error) {
      console.error('[useImageWorkspace] Failed to refresh text models:', error)
      textModelOptions.value = []
    }
  }

  const refreshImageModels = async () => {
    try {
      await loadImageModels()
      imageModelOptions.value = imageModels.value.map(m => ({
        label: `${m.name} (${m.provider?.name || m.providerId || 'Unknown'} - ${m.model?.name || m.modelId || 'Unknown'})`,
        primary: m.name,
        secondary: `${m.provider?.name || m.providerId || 'Unknown'} · ${m.model?.name || m.modelId || 'Unknown'}`,
        value: m.id,
        raw: m,
      }))

      // 没有可用模型时：不要清空已选 key（避免加载失败/初始化未就绪时覆盖 session）
      if (!imageModels.value.length) {
        return
      }

      const current = selectedImageModelKey.value
      const exists = imageModels.value.some(m => m.id === current)
      if (!exists) {
        selectedImageModelKey.value = imageModels.value[0]?.id || ''
      }
    } catch (e) {
      console.error('[useImageWorkspace] Failed to refresh image models:', e)
    }
  }

  const restoreTemplateSelection = async () => {
    const manager = templateManager.value
    if (!manager) return

    try {
      const currentType = templateType.value
      const templates = await manager.listTemplatesByType(currentType)
      if (!templates.length) {
        selectedTemplateRef.value = null
        selectedTemplateId.value = ''
        return
      }

      const currentId = selectedTemplateId.value
      const found = currentId ? templates.find(t => t.id === currentId) || null : null
      if (found) {
        selectedTemplateRef.value = found
        return
      }

      // 无选择或已失效：设置默认模板
      let fallback: Template | undefined
      if (currentType === 'text2imageOptimize') {
        fallback =
          templates.find(t => t.id === 'image-chinese-optimize') ||
          templates.find(t => t.id === 'image-dalle-optimize') ||
          templates.find(t => t.name.includes('通用')) ||
          templates[0]
      } else {
        fallback = templates.find(t => t.id === 'image2image-general-optimize') || templates[0]
      }

      if (fallback) {
        selectedTemplateId.value = fallback.id
        selectedTemplateRef.value = fallback
      }
    } catch (e) {
      console.error('[useImageWorkspace] Failed to restore template selection:', e)
      selectedTemplateRef.value = null
    }
  }

  const restoreImageIterateTemplateSelection = async () => {
    const manager = templateManager.value
    if (!manager) return

    try {
      const templates = await manager.listTemplatesByType('imageIterate')
      if (!templates.length) {
        selectedIterateTemplateRef.value = null
        selectedIterateTemplateId.value = ''
        return
      }

      const currentId = selectedIterateTemplateId.value
      const found = currentId ? templates.find(t => t.id === currentId) || null : null
      if (found) {
        selectedIterateTemplateRef.value = found
        return
      }

      const fallback = templates[0]
      selectedIterateTemplateId.value = fallback?.id || ''
      selectedIterateTemplateRef.value = fallback || null
    } catch (e) {
      console.error('[useImageWorkspace] Failed to restore iterate template selection:', e)
    }
  }

  // 初始化
  const initialize = async () => {
    try {
      await refreshTextModels()
      await refreshImageModels()
      await restoreTemplateSelection()
      await restoreImageIterateTemplateSelection()
    } catch (e) {
      console.error('[useImageWorkspace] Failed to initialize:', e)
    }
  }

  // 文件上传处理（写入 image2imageSession）
  const handleUploadChange = async (data: ImageUploadChangePayload) => {
    const fileEntry = data.file ?? null
    const file = fileEntry?.file ?? null

    if (!file) {
      image2imageSession.updateInputImage(null, '')
      uploadStatus.value = 'idle'
      uploadProgress.value = 0
      return
    }

    // 验证文件类型
    if (!/image\/(png|jpeg)/.test(file.type)) {
      toast.error('仅支持 PNG/JPEG 格式')
      uploadStatus.value = 'error'
      return
    }

    // 验证文件大小
    if (file.size > 10 * 1024 * 1024) {
      toast.error('文件大小不能超过 10MB')
      uploadStatus.value = 'error'
      return
    }

    uploadStatus.value = 'uploading'
    uploadProgress.value = 0

    const reader = new FileReader()

    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      image2imageSession.updateInputImage(base64, file.type)
      uploadStatus.value = 'success'
      uploadProgress.value = 100
      toast.success('图片上传成功')
    }

    reader.onerror = () => {
      toast.error('文件读取失败，请重试')
      uploadStatus.value = 'error'
    }

    reader.onprogress = e => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100)
      }
    }

    reader.readAsDataURL(file)
  }

  // 创建历史记录（并同步 chain/version 到 session store）
  const createHistoryRecord = async () => {
    if (!selectedTemplate.value || !historyManager.value) return

    try {
      const recordData = {
        id: uuidv4(),
        originalPrompt: originalPrompt.value,
        optimizedPrompt: optimizedPrompt.value,
        type: templateType.value as PromptRecordType,
        modelKey: selectedTextModelKey.value,
        templateId: selectedTemplate.value.id,
        timestamp: Date.now(),
        metadata: {
          optimizationMode: 'user' as OptimizationMode,
          functionMode: 'image',
          imageModelKey: selectedImageModelKey.value,
          hasInputImage: !!inputImageB64.value,
          compareMode: isCompareMode.value,
        },
      }

      const newRecord = await historyManager.value.createNewChain(recordData)
      currentChainId.value = newRecord.chainId
      currentVersions.value = newRecord.versions
      currentVersionId.value = newRecord.currentRecord.id

      activeSession.value.updateOptimizedResult({
        optimizedPrompt: optimizedPrompt.value,
        reasoning: optimizedReasoning.value,
        chainId: newRecord.chainId,
        versionId: newRecord.currentRecord.id,
      })

      window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
    } catch (e) {
      console.error('[useImageWorkspace] Failed to create history record:', e)
      toast.warning('历史记录保存失败，但优化结果已生成')
    }
  }

  // 优化提示词（流式写入 store.state）
  const handleOptimizePrompt = async () => {
    if (!originalPrompt.value.trim() || isOptimizing.value) return
    if (!selectedTemplate.value) {
      toast.error('请选择优化模板')
      return
    }
    if (!selectedTextModelKey.value) {
      toast.error('请选择文本模型')
      return
    }
    if (!promptService.value) {
      toast.error(t('toast.error.serviceInit'))
      return
    }

    isOptimizing.value = true
    activeSession.value.state.optimizedPrompt = ''
    activeSession.value.state.reasoning = ''

    await nextTick()

    try {
      const request: OptimizationRequest = {
        optimizationMode: 'user',
        targetPrompt: originalPrompt.value,
        templateId: selectedTemplate.value.id,
        modelKey: selectedTextModelKey.value,
      }

      await promptService.value.optimizePromptStream(request, {
        onToken: token => {
          activeSession.value.state.optimizedPrompt += token
        },
        onReasoningToken: token => {
          activeSession.value.state.reasoning += token
        },
        onComplete: async () => {
          await createHistoryRecord()
          toast.success('提示词优化完成')
        },
        onError: (error: Error) => {
          throw error
        },
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      toast.error('优化失败：' + err.message)
    } finally {
      isOptimizing.value = false
    }
  }

  // 迭代优化（流式写入 store.state）
  const handleIteratePrompt = async (payload: {
    originalPrompt: string
    optimizedPrompt: string
    iterateInput: string
  }) => {
    if (!selectedIterateTemplate.value || !promptService.value) {
      console.error('[useImageWorkspace] Missing iterate dependencies')
      return
    }

    isIterating.value = true
    const previousOptimizedPrompt = optimizedPrompt.value

    activeSession.value.state.optimizedPrompt = ''
    activeSession.value.state.reasoning = ''

    try {
      await promptService.value.iteratePromptStream(
        payload.originalPrompt,
        payload.optimizedPrompt,
        payload.iterateInput,
        selectedTextModelKey.value,
        {
          onToken: token => {
            activeSession.value.state.optimizedPrompt += token
          },
          onReasoningToken: token => {
            activeSession.value.state.reasoning += token
          },
          onComplete: async () => {
            try {
              if (historyManager.value && currentChainId.value) {
                const updatedChain = await historyManager.value.addIteration({
                  chainId: currentChainId.value,
                  originalPrompt: payload.originalPrompt,
                  optimizedPrompt: optimizedPrompt.value,
                  iterationNote: payload.iterateInput,
                  modelKey: selectedTextModelKey.value,
                  templateId: selectedIterateTemplate.value!.id,
                })
                currentVersions.value = updatedChain.versions
                currentVersionId.value = updatedChain.currentRecord.id
                activeSession.value.updateOptimizedResult({
                  optimizedPrompt: optimizedPrompt.value,
                  reasoning: optimizedReasoning.value,
                  chainId: updatedChain.chainId,
                  versionId: updatedChain.currentRecord.id,
                })
                window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
              } else {
                await createHistoryRecord()
              }
              toast.success('提示词迭代优化完成')
            } catch (e) {
              console.error('[useImageWorkspace] Failed to persist iteration:', e)
              toast.warning('迭代结果已生成，但历史记录保存失败')
            }
          },
          onError: (error: Error) => {
            throw error
          },
        },
        selectedIterateTemplate.value.id,
      )
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      toast.error('迭代优化失败：' + err.message)
      optimizedPrompt.value = previousOptimizedPrompt
    } finally {
      isIterating.value = false
    }
  }

  // 生成图像（结果写入 session store）
  const handleGenerateImage = async () => {
    if (!selectedImageModelKey.value || !currentPrompt.value.trim()) {
      toast.error('请选择图像模型并确保有有效的提示词')
      return
    }

    const imageRequest: ImageRequest = {
      prompt: currentPrompt.value,
      configId: selectedImageModelKey.value,
      count: 1,
      inputImage:
        imageSubMode.value === 'image2image' && inputImageB64.value
          ? { b64: inputImageB64.value, mimeType: inputImageMime.value || 'image/png' }
          : undefined,
      paramOverrides: { outputMimeType: 'image/png' },
    }

    try {
      if (isCompareMode.value) {
        if (originalPrompt.value.trim()) {
          await generateImage({ ...imageRequest, prompt: originalPrompt.value })
          originalImageResult.value = imageResult.value
        }
        if (optimizedPrompt.value.trim()) {
          await generateImage({ ...imageRequest, prompt: optimizedPrompt.value })
          optimizedImageResult.value = imageResult.value
        }
      } else {
        await generateImage(imageRequest)
        if (optimizedPrompt.value.trim()) {
          optimizedImageResult.value = imageResult.value
        } else if (originalPrompt.value.trim()) {
          originalImageResult.value = imageResult.value
        }
      }
      toast.success('图像生成完成')
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      toast.error('生成失败：' + err.message)
    }
  }

  // 切换版本（仅影响当前 UI 展示，不持久化 versions）
  const handleSwitchVersion = async (version: PromptRecordChain['versions'][number]) => {
    optimizedPrompt.value = version.optimizedPrompt
    currentVersionId.value = version.id
    activeSession.value.updateOptimizedResult({
      optimizedPrompt: version.optimizedPrompt || '',
      reasoning: optimizedReasoning.value || '',
      chainId: currentChainId.value || activeSession.value.state.chainId || '',
      versionId: version.id || '',
    })
    await nextTick()
  }

  // 分析：清空版本链，创建 V0（不写入历史）
  const handleAnalyze = () => {
    if (!originalPrompt.value.trim()) return

    const virtualV0Id = uuidv4()
    const virtualV0: PromptRecordChain['versions'][number] = {
      id: virtualV0Id,
      chainId: '',
      version: 0,
      originalPrompt: originalPrompt.value,
      optimizedPrompt: originalPrompt.value,
      type: 'imageOptimize',
      timestamp: Date.now(),
      modelKey: '',
      templateId: '',
    }

    currentChainId.value = ''
    currentVersions.value = [virtualV0]
    currentVersionId.value = virtualV0Id
    optimizedPrompt.value = originalPrompt.value
    activeSession.value.updateOptimizedResult({
      optimizedPrompt: originalPrompt.value,
      reasoning: '',
      chainId: '',
      versionId: '',
    })
  }

  // 图像子模式切换：由外部 source of truth 驱动
  const handleImageModeChange = async (mode: ImageSubMode) => {
    if (mode === imageSubMode.value) return
    await setImageSubMode(mode)
    resetTransientState()
    await nextTick()
  }

  // 获取图像显示源地址
  const getImageSrc = (imageItem: ImageResultItem | null | undefined) => {
    if (!imageItem) return ''
    if (imageItem.url) return imageItem.url
    if (imageItem.b64) {
      const mime = imageItem.mimeType ?? 'image/png'
      return `data:${mime};base64,${imageItem.b64}`
    }
    return ''
  }

  // 下载图像
  const downloadImageFromResult = async (imageItem: ImageResultItem | null | undefined, prefix: string) => {
    if (!imageItem) return

    if (imageItem.url) {
      try {
        const response = await fetch(imageItem.url)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${prefix}-image.png`
        a.click()
        window.URL.revokeObjectURL(url)
      } catch {
        toast.error('下载失败')
      }
      return
    }

    if (imageItem.b64) {
      const a = document.createElement('a')
      const mime = imageItem.mimeType ?? 'image/png'
      a.href = `data:${mime};base64,${imageItem.b64}`
      a.download = `${prefix}-image.png`
      a.click()
    }
  }

  // 历史记录恢复事件（App 会 dispatch image-workspace-restore）
  const handleHistoryRestore = async (event: Event) => {
    const customEvent = event as CustomEvent
    try {
      const historyData = customEvent.detail
      console.log('[useImageWorkspace] Restoring history data:', historyData)

      const mode: ImageSubMode =
        historyData.imageMode === 'image2image' ? 'image2image' : 'text2image'

      // 🔧 修复：外层 App 已经切换好子模式了（在 isLoadingExternalData 保护下）
      // 这里不需要再切换，避免触发 session restore 覆盖历史数据
      // if (mode !== imageSubMode.value) {
      //   await setImageSubMode(mode)
      // }

      const targetSession = mode === 'image2image' ? image2imageSession : text2imageSession

      targetSession.updatePrompt(historyData.originalPrompt || '')
      targetSession.updateOptimizedResult({
        optimizedPrompt: historyData.optimizedPrompt || '',
        reasoning: targetSession.state.reasoning || '',
        chainId: historyData.chainId || '',
        versionId: historyData.currentVersionId || '',
      })

      // 恢复版本信息（UI 专用）
      currentChainId.value = historyData.chainId || ''
      currentVersions.value = historyData.versions || []
      currentVersionId.value = historyData.currentVersionId || ''

      // 恢复模型选择（如果历史记录中有保存）
      if (historyData.metadata) {
        if (historyData.metadata.imageModelKey) {
          targetSession.updateImageModel(historyData.metadata.imageModelKey)
        }
        if (historyData.metadata.compareMode !== undefined) {
          targetSession.toggleCompareMode(!!historyData.metadata.compareMode)
        }
      }

      // 恢复模板选择（根据历史记录中的 templateId）
      if (historyData.templateId) {
        targetSession.updateTemplate(historyData.templateId)
      }

      resetTransientState()
      console.log('[useImageWorkspace] History data restored successfully')
    } catch (e) {
      console.error('[useImageWorkspace] Failed to restore history data:', e)
    }
  }

  const cleanup = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('image-workspace-restore', handleHistoryRestore as EventListener)
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('image-workspace-restore', handleHistoryRestore as EventListener)
    console.log('[useImageWorkspace] image-workspace-restore listener registered')
  }

  // 评估处理器（图像模式专用：testResults 不参与）
  const evaluationHandler = useEvaluationHandler({
    services,
    originalPrompt: originalPrompt as any,
    optimizedPrompt: optimizedPrompt as any,
    testContent: computed(() => ''),
    testResults: ref(null),
    evaluationModelKey: selectedTextModelKey as any,
    functionMode: computed(() => 'image'),
    subMode: computed(() => imageSubMode.value),
    externalEvaluation,
  })

  // 切换子模式时重置过程态（不清空 store 数据）
  watch(imageSubMode, () => {
    resetTransientState()
  })

  return {
    // 状态（store 为真源）
    originalPrompt,
    optimizedPrompt,
    optimizedReasoning,
    isOptimizing,
    isIterating,
    imageMode: computed(() => imageSubMode.value),
    selectedTextModelKey,
    selectedImageModelKey,
    selectedTemplateId,
    selectedIterateTemplateId,
    selectedTemplate,
    selectedIterateTemplate,
    inputImageB64,
    isCompareMode,
    originalImageResult,
    optimizedImageResult,
    currentVersions,
    currentVersionId,
    uploadStatus,
    uploadProgress,

    // 计算属性
    currentPrompt,
    previewImageUrl,
    templateType,
    textModelOptions,
    imageModelOptions,
    optimizationMode,
    advancedModeEnabled,
    selectedImageModelCapabilities,
    selectedImageModelInfo,

    // 图像生成状态（本地）
    isGenerating,
    generationProgress,
    generationError,

    // 方法
    initialize,
    handleUploadChange,
    handleOptimizePrompt,
    handleIteratePrompt,
    handleGenerateImage,
    handleImageModeChange,
    handleSwitchVersion,
    getImageSrc,
    downloadImageFromResult,
    cleanup,
    refreshTextModels,
    refreshImageModels,
    restoreTemplateSelection,
    restoreImageIterateTemplateSelection,
    resetTransientState,

    evaluationHandler,
    handleAnalyze,
  }
}
