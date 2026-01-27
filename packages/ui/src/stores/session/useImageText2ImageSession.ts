/**
 * Image-Text2Image Session Store
 *
 * 管理 Image 模式下 Text2Image 子模式的会话状态
 * - 原始提示词和优化结果
 * - 图像生成结果（使用 ImageRef 引用，base64 数据存储在 ImageStorageService）
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import { isValidVariableName, sanitizeVariableRecord } from '../../types/variable'
import {
  isImageRef,
  createImageRef,
  type ImageResult,
  type IImageStorageService
} from '@prompt-optimizer/core'
import {
  IMAGE_TEXT2IMAGE_SESSION_KEY,
  computeStableImageId,
  queueImageStorageMaintenance,
  scheduleImageStorageGc,
} from './imageStorageMaintenance'
import {
  createDefaultEvaluationResults,
  type PersistedEvaluationResults,
} from '../../types/evaluation'

type ImageResultItem = ImageResult['images'][number]

/**
 * image 模式测试面板的版本选择：
 * - 0: v0（原始提示词）
 * - >=1: v1..vn（历史链版本号）
 * - 'latest': 跟随最新 vn
 */
export type TestPanelVersionValue = 0 | number | 'latest'

export type TestVariantId = 'a' | 'b' | 'c' | 'd'

export type TestColumnCount = 2 | 3 | 4

export interface ImageWorkspaceLayoutConfig {
  /** 主布局左侧宽度（百分比，25..50） */
  mainSplitLeftPct: number
  /** 测试区列数（2..4） */
  testColumnCount: TestColumnCount
}

export interface TestVariantConfig {
  id: TestVariantId
  /** 提示词版本（v0 / vN / latest） */
  version: TestPanelVersionValue
  /** 图像模型配置 key（configId） */
  modelKey: string
}

export type TestVariantResults = Record<TestVariantId, ImageResult | null>

export type TestVariantLastRunFingerprint = Record<TestVariantId, string>

export interface ImageText2ImageSessionState {
  originalPrompt: string
  optimizedPrompt: string
  reasoning: string
  chainId: string
  versionId: string

  /**
   * 临时变量（子模式隔离 + 持久化）
   * - image-text2image 维度持久化（刷新不丢）
   * - 不与 image-image2image / pro-* 共享
   */
  temporaryVariables: Record<string, string>

  originalImageResult: ImageResult | null
  optimizedImageResult: ImageResult | null
  // v2: 多列测试（最多 4 列）
  layout: ImageWorkspaceLayoutConfig
  testVariants: TestVariantConfig[]
  testVariantResults: TestVariantResults
  testVariantLastRunFingerprint: TestVariantLastRunFingerprint
  evaluationResults: PersistedEvaluationResults
  isCompareMode: boolean
  selectedTextModelKey: string
  selectedImageModelKey: string
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null
  lastActiveAt: number
}

/**
 * 默认状态
 */
const createDefaultState = (): ImageText2ImageSessionState => ({
  originalPrompt: '',
  optimizedPrompt: '',
  reasoning: '',
  chainId: '',
  versionId: '',
  temporaryVariables: {},
  originalImageResult: null,
  optimizedImageResult: null,
  // v2: 多列测试（最多 4 列）
  layout: { mainSplitLeftPct: 50, testColumnCount: 2 },
  testVariants: [
    { id: 'a', version: 0, modelKey: '' },
    { id: 'b', version: 'latest', modelKey: '' },
    { id: 'c', version: 'latest', modelKey: '' },
    { id: 'd', version: 'latest', modelKey: '' },
  ],
  testVariantResults: {
    a: null,
    b: null,
    c: null,
    d: null,
  },
  testVariantLastRunFingerprint: {
    a: '',
    b: '',
    c: '',
    d: '',
  },
  evaluationResults: createDefaultEvaluationResults(),
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
  const temporaryVariables = ref<Record<string, string>>({})
  const evaluationResults = ref<PersistedEvaluationResults>(createDefaultEvaluationResults())
  const originalImageResult = ref<ImageResult | null>(null)
  const optimizedImageResult = ref<ImageResult | null>(null)
  // v2: 多列测试（最多 4 列）
  const layout = ref<ImageWorkspaceLayoutConfig>({ mainSplitLeftPct: 50, testColumnCount: 2 })
  const testVariants = ref<TestVariantConfig[]>([
    { id: 'a', version: 0, modelKey: '' },
    { id: 'b', version: 'latest', modelKey: '' },
    { id: 'c', version: 'latest', modelKey: '' },
    { id: 'd', version: 'latest', modelKey: '' },
  ])
  const testVariantResults = ref<TestVariantResults>({
    a: null,
    b: null,
    c: null,
    d: null,
  })
  const testVariantLastRunFingerprint = ref<TestVariantLastRunFingerprint>({
    a: '',
    b: '',
    c: '',
    d: '',
  })
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
    testVariantResults.value = { ...testVariantResults.value, a: result }
    lastActiveAt.value = Date.now()
  }

  const updateOptimizedImageResult = (result: ImageResult | null) => {
    optimizedImageResult.value = result
    testVariantResults.value = { ...testVariantResults.value, b: result }
    lastActiveAt.value = Date.now()
  }

  const setTestColumnCount = (count: TestColumnCount) => {
    if (layout.value.testColumnCount === count) return
    layout.value = { ...layout.value, testColumnCount: count }
    lastActiveAt.value = Date.now()
    saveSession().catch(error => {
      console.error('[ImageText2ImageSession] 自动保存会话失败:', error)
    })
  }

  const setMainSplitLeftPct = (pct: number) => {
    const normalized = Number.isFinite(pct) ? Math.round(pct) : layout.value.mainSplitLeftPct
    const next = Math.min(50, Math.max(25, normalized))
    if (layout.value.mainSplitLeftPct === next) return
    layout.value = { ...layout.value, mainSplitLeftPct: next }
    lastActiveAt.value = Date.now()
    saveSession().catch(error => {
      console.error('[ImageText2ImageSession] 自动保存会话失败:', error)
    })
  }

  const updateTestVariant = (id: TestVariantId, patch: Partial<Omit<TestVariantConfig, 'id'>>) => {
    const idx = testVariants.value.findIndex(v => v.id === id)
    if (idx < 0) return
    const prev = testVariants.value[idx]
    const next: TestVariantConfig = { ...prev, ...patch, id }
    if (prev.version === next.version && prev.modelKey === next.modelKey) return
    const nextList = testVariants.value.slice()
    nextList[idx] = next
    testVariants.value = nextList
    lastActiveAt.value = Date.now()
    saveSession().catch(error => {
      console.error('[ImageText2ImageSession] 自动保存会话失败:', error)
    })
  }

  const updateTestVariantResult = (id: TestVariantId, result: ImageResult | null) => {
    testVariantResults.value = { ...testVariantResults.value, [id]: result }
    // legacy alias: A/B
    if (id === 'a') originalImageResult.value = result
    if (id === 'b') optimizedImageResult.value = result
    lastActiveAt.value = Date.now()
  }

  const setTestVariantLastRunFingerprint = (id: TestVariantId, fingerprint: string) => {
    if (testVariantLastRunFingerprint.value[id] === fingerprint) return
    testVariantLastRunFingerprint.value = { ...testVariantLastRunFingerprint.value, [id]: fingerprint }
    lastActiveAt.value = Date.now()
  }

  const updateTextModel = (modelKey: string) => {
    if (selectedTextModelKey.value === modelKey) return
    selectedTextModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    saveSession().catch(error => {
      console.error('[ImageText2ImageSession] 自动保存会话失败:', error)
    })
  }

  const updateImageModel = (modelKey: string) => {
    if (selectedImageModelKey.value === modelKey) return
    selectedImageModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    // 异步保存完整状态（best-effort）
    saveSession().catch(error => {
      console.error('[ImageText2ImageSession] 自动保存会话失败:', error)
    })
  }

  const updateTemplate = (templateId: string | null) => {
    if (selectedTemplateId.value === templateId) return
    selectedTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession().catch(error => {
      console.error('[ImageText2ImageSession] 自动保存会话失败:', error)
    })
  }

  const updateIterateTemplate = (templateId: string | null) => {
    if (selectedIterateTemplateId.value === templateId) return
    selectedIterateTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession().catch(error => {
      console.error('[ImageText2ImageSession] 自动保存会话失败:', error)
    })
  }

  const toggleCompareMode = (enabled?: boolean) => {
    const nextValue = enabled ?? !isCompareMode.value
    if (isCompareMode.value === nextValue) return
    isCompareMode.value = nextValue
    lastActiveAt.value = Date.now()
  }

  // 临时变量（持久化到 session）
  const setTemporaryVariable = (name: string, value: string) => {
    if (!isValidVariableName(name)) {
      console.warn('[ImageText2ImageSession] Ignoring invalid temporary variable name:', name)
      return
    }
    temporaryVariables.value[name] = value
    lastActiveAt.value = Date.now()
  }

  const getTemporaryVariable = (name: string): string | undefined => {
    return Object.prototype.hasOwnProperty.call(temporaryVariables.value, name)
      ? temporaryVariables.value[name]
      : undefined
  }

  const deleteTemporaryVariable = (name: string) => {
    if (!Object.prototype.hasOwnProperty.call(temporaryVariables.value, name)) return
    delete temporaryVariables.value[name]
    lastActiveAt.value = Date.now()
  }

  const clearTemporaryVariables = () => {
    temporaryVariables.value = {}
    lastActiveAt.value = Date.now()
  }

  const reset = () => {
    const defaultState = createDefaultState()
    originalPrompt.value = defaultState.originalPrompt
    optimizedPrompt.value = defaultState.optimizedPrompt
    reasoning.value = defaultState.reasoning
    chainId.value = defaultState.chainId
    versionId.value = defaultState.versionId
    temporaryVariables.value = defaultState.temporaryVariables
    originalImageResult.value = defaultState.originalImageResult
    optimizedImageResult.value = defaultState.optimizedImageResult
    layout.value = defaultState.layout
    testVariants.value = defaultState.testVariants
    testVariantResults.value = defaultState.testVariantResults
    testVariantLastRunFingerprint.value = defaultState.testVariantLastRunFingerprint
    evaluationResults.value = defaultState.evaluationResults
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
        const mimeType = img.mimeType || 'image/png'
        const imageId = await computeStableImageId(img.b64, mimeType)

        // Dedup: do not rewrite existing records.
        const existing = await storageService.getMetadata(imageId)
        if (!existing) {
          await storageService.saveImage({
            metadata: {
              id: imageId,
              mimeType,
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
        }

        processedImages.push(createImageRef(imageId))
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
    return await queueImageStorageMaintenance(async () => {
      const $services = getPiniaServices()
      if (!$services?.preferenceService) {
        throw new Error('[ImageText2ImageSession] PreferenceService 不可用，无法保存会话')
      }
      if (!$services?.imageStorageService) {
        throw new Error('[ImageText2ImageSession] ImageStorageService 不可用，无法保存会话')
      }

      // v2: 多列测试结果（最多 4 列）
      const baseVariantResults: TestVariantResults = {
        a: testVariantResults.value.a ?? originalImageResult.value,
        b: testVariantResults.value.b ?? optimizedImageResult.value,
        c: testVariantResults.value.c,
        d: testVariantResults.value.d,
      }

      const variantResultsToSave: TestVariantResults = {
        a: await prepareForSave(baseVariantResults.a, $services.imageStorageService),
        b: await prepareForSave(baseVariantResults.b, $services.imageStorageService),
        c: await prepareForSave(baseVariantResults.c, $services.imageStorageService),
        d: await prepareForSave(baseVariantResults.d, $services.imageStorageService),
      }

      // ✅ 修复：不修改运行时 ref，只在序列化时使用转换后的数据
      // 原代码会导致界面上的图像消失，因为 ImageRef 不包含实际图像数据

      // 构建快照（仅包含引用，不包含 base64）
      const snapshot = {
        originalPrompt: originalPrompt.value,
        optimizedPrompt: optimizedPrompt.value,
        reasoning: reasoning.value,
        chainId: chainId.value,
        versionId: versionId.value,
        temporaryVariables: sanitizeVariableRecord(temporaryVariables.value),
        // legacy: 仍保留 original/optimized 字段（对应 A/B）
        originalImageResult: variantResultsToSave.a,
        optimizedImageResult: variantResultsToSave.b,
        // v2: 多列 variants
        layout: layout.value,
        testVariants: testVariants.value,
        testVariantResults: variantResultsToSave,
        testVariantLastRunFingerprint: testVariantLastRunFingerprint.value,
        evaluationResults: evaluationResults.value,
        isCompareMode: isCompareMode.value,
        selectedTextModelKey: selectedTextModelKey.value,
        selectedImageModelKey: selectedImageModelKey.value,
        selectedTemplateId: selectedTemplateId.value,
        selectedIterateTemplateId: selectedIterateTemplateId.value,
        lastActiveAt: lastActiveAt.value,
      }

      await $services.preferenceService.set(IMAGE_TEXT2IMAGE_SESSION_KEY, snapshot)
      scheduleImageStorageGc($services.preferenceService, $services.imageStorageService)
    })
  }

  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      throw new Error('[ImageText2ImageSession] PreferenceService 不可用，无法恢复会话')
    }
    if (!$services?.imageStorageService) {
      throw new Error('[ImageText2ImageSession] ImageStorageService 不可用，无法恢复会话')
    }

    try {
        const saved = await $services.preferenceService.get<unknown>(
          IMAGE_TEXT2IMAGE_SESSION_KEY,
          null
        )

      if (saved) {
        const parsed =
          typeof saved === 'string'
            ? (JSON.parse(saved) as Record<string, unknown>)
            : (saved as Record<string, unknown>)

        // ==================== v2: 多列 variants ====================
        const defaultState = createDefaultState()

        // layout
        const rawLayout = parsed.layout
        if (rawLayout && typeof rawLayout === 'object') {
          const layoutRecord = rawLayout as Record<string, unknown>
          const pct =
            typeof layoutRecord['mainSplitLeftPct'] === 'number'
              ? (layoutRecord['mainSplitLeftPct'] as number)
              : defaultState.layout.mainSplitLeftPct
          const countRaw = layoutRecord['testColumnCount']
          const count: TestColumnCount = countRaw === 2 || countRaw === 3 || countRaw === 4 ? countRaw : defaultState.layout.testColumnCount
          layout.value = {
            mainSplitLeftPct: Math.min(50, Math.max(25, Math.round(pct))),
            testColumnCount: count,
          }
        } else {
          layout.value = defaultState.layout
        }

        // testVariants
        const rawVariants = parsed.testVariants
        if (Array.isArray(rawVariants)) {
          const byId = new Map<TestVariantId, TestVariantConfig>()

          const normalizeVersion = (v: unknown): TestPanelVersionValue => {
            if (v === 0) return 0
            if (v === 'latest') return 'latest'
            if (typeof v === 'number' && Number.isFinite(v) && v >= 1) return v
            return 'latest'
          }

          for (const item of rawVariants) {
            if (!item || typeof item !== 'object') continue
            const obj = item as Record<string, unknown>
            const id = obj['id']
            if (id !== 'a' && id !== 'b' && id !== 'c' && id !== 'd') continue
            const modelKey = typeof obj['modelKey'] === 'string' ? (obj['modelKey'] as string) : ''
            const version = normalizeVersion(obj['version'])
            byId.set(id, { id, modelKey, version })
          }

          testVariants.value = defaultState.testVariants.map((v) => byId.get(v.id) ?? v)
        } else {
          testVariants.value = defaultState.testVariants
        }

        // testVariantResults (优先使用 v2 字段)
        const rawVariantResults = parsed.testVariantResults
        let variantResultsLoaded: TestVariantResults | null = null
        if (rawVariantResults && typeof rawVariantResults === 'object') {
          const record = rawVariantResults as Record<string, unknown>
          const pick = (id: TestVariantId): ImageResult | null => {
            const one = record[id]
            if (!one) return null
            if (typeof one !== 'object') return null
            return one as ImageResult
          }
          variantResultsLoaded = {
            a: pick('a'),
            b: pick('b'),
            c: pick('c'),
            d: pick('d'),
          }
        }

        // legacy: original/optimized → A/B
        if (!variantResultsLoaded) {
          variantResultsLoaded = {
            a: (parsed.originalImageResult as ImageResult | null) ?? null,
            b: (parsed.optimizedImageResult as ImageResult | null) ?? null,
            c: null,
            d: null,
          }
        }

        // 从引用加载完整图像数据
        const loaded: TestVariantResults = {
          a: await loadFromRef(variantResultsLoaded.a, $services.imageStorageService),
          b: await loadFromRef(variantResultsLoaded.b, $services.imageStorageService),
          c: await loadFromRef(variantResultsLoaded.c, $services.imageStorageService),
          d: await loadFromRef(variantResultsLoaded.d, $services.imageStorageService),
        }

        testVariantResults.value = loaded
        // legacy alias
        originalImageResult.value = loaded.a
        optimizedImageResult.value = loaded.b

        // lastRunFingerprint
        const rawFingerprints = parsed.testVariantLastRunFingerprint
        if (rawFingerprints && typeof rawFingerprints === 'object') {
          const fingerprintRecord = rawFingerprints as Record<string, unknown>
          const pick = (id: TestVariantId) => (typeof fingerprintRecord[id] === 'string' ? (fingerprintRecord[id] as string) : '')
          testVariantLastRunFingerprint.value = {
            a: pick('a'),
            b: pick('b'),
            c: pick('c'),
            d: pick('d'),
          }
        } else {
          testVariantLastRunFingerprint.value = defaultState.testVariantLastRunFingerprint
        }

        originalPrompt.value = typeof parsed.originalPrompt === 'string' ? parsed.originalPrompt : ''
        optimizedPrompt.value = typeof parsed.optimizedPrompt === 'string' ? parsed.optimizedPrompt : ''
        reasoning.value = typeof parsed.reasoning === 'string' ? parsed.reasoning : ''
        chainId.value = typeof parsed.chainId === 'string' ? parsed.chainId : ''
        versionId.value = typeof parsed.versionId === 'string' ? parsed.versionId : ''

        temporaryVariables.value = sanitizeVariableRecord(parsed.temporaryVariables)
        evaluationResults.value = {
          ...createDefaultEvaluationResults(),
          ...(parsed.evaluationResults && typeof parsed.evaluationResults === 'object'
            ? (parsed.evaluationResults as PersistedEvaluationResults)
            : {}),
        }
        isCompareMode.value = typeof parsed.isCompareMode === 'boolean' ? parsed.isCompareMode : true
        selectedTextModelKey.value = typeof parsed.selectedTextModelKey === 'string' ? parsed.selectedTextModelKey : ''
        selectedImageModelKey.value = typeof parsed.selectedImageModelKey === 'string' ? parsed.selectedImageModelKey : ''
        selectedTemplateId.value = typeof parsed.selectedTemplateId === 'string' ? parsed.selectedTemplateId : null
        selectedIterateTemplateId.value = typeof parsed.selectedIterateTemplateId === 'string' ? parsed.selectedIterateTemplateId : null
        lastActiveAt.value = Date.now()

        // 如果 variants 的 modelKey 为空，尝试用 legacy selectedImageModelKey 填充一次
        const seedModelKey = selectedImageModelKey.value
        if (seedModelKey) {
          let changed = false
          const next = testVariants.value.map((v) => {
            if (v.modelKey) return v
            changed = true
            return { ...v, modelKey: seedModelKey }
          })
          if (changed) {
            testVariants.value = next
          }
        }
      }
      // else: 没有保存的会话，使用默认状态
    } catch (error) {
      reset()
      throw error
    }
  }

  return {
    // ========== 状态（直接返回，Pinia 会自动追踪响应式）==========
    originalPrompt,
    optimizedPrompt,
    reasoning,
    chainId,
    versionId,
    temporaryVariables,
    evaluationResults,
    originalImageResult,
    optimizedImageResult,
    layout,
    testVariants,
    testVariantResults,
    testVariantLastRunFingerprint,
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
    setTestColumnCount,
    setMainSplitLeftPct,
    updateTestVariant,
    updateTestVariantResult,
    setTestVariantLastRunFingerprint,
    updateTextModel,
    updateImageModel,
    updateTemplate,
    updateIterateTemplate,
    toggleCompareMode,

    setTemporaryVariable,
    getTemporaryVariable,
    deleteTemporaryVariable,
    clearTemporaryVariables,

    reset,

    // ========== 持久化方法 ==========
    saveSession,
    restoreSession,
  }
})

export type ImageText2ImageSessionApi = ReturnType<typeof useImageText2ImageSession>
