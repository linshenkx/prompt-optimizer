import { defineStore } from 'pinia'
import { readSessionSnapshot, createSessionSnapshotWriter, runSessionWrite, type SessionWritePermit } from './sessionPersistence'
import { ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import { isValidVariableName, sanitizeVariableRecord } from '../../types/variable'
import {
  isImageRef,
  createImageRef,
  type ImageResult,
  type IImageStorageService,
  type ImageInputRef,
  type PromptAssetBinding,
  type PromptSessionOrigin,
} from '@prompt-optimizer/core'
import {
  normalizeImageSourceToPayload,
  persistImagePayloadAsAssetId,
} from '../../utils/image-asset-storage'
import {
  IMAGE_MULTIIMAGE_SESSION_KEY,
  computeStableImageId,
  queueImageStorageMaintenance,
  scheduleImageStorageGc,
} from './imageStorageMaintenance'
import { createSessionAssetBindingState } from './sessionAssetBinding'
import {
  createDefaultEvaluationResults,
  type PersistedEvaluationResults,
} from '../../types/evaluation'

type ImageResultItem = ImageResult['images'][number]

export type TestPanelVersionValue = 'workspace' | 'previous' | 0 | number
export type TestVariantId = 'a' | 'b' | 'c' | 'd'
export type TestColumnCount = 2 | 3 | 4

export interface ImageWorkspaceLayoutConfig {
  mainSplitLeftPct: number
  testColumnCount: TestColumnCount
}

export interface TestVariantConfig {
  id: TestVariantId
  version: TestPanelVersionValue
  modelKey: string
}

export interface MultiImageSessionInputItem extends ImageInputRef {
  id: string
  assetId: string | null
}

export interface ImageMultiImageSessionState {
  originalPrompt: string
  optimizedPrompt: string
  reasoning: string
  chainId: string
  versionId: string
  temporaryVariables: Record<string, string>
  inputImages: MultiImageSessionInputItem[]
  originalImageResult: ImageResult | null
  optimizedImageResult: ImageResult | null
  layout: ImageWorkspaceLayoutConfig
  testVariants: TestVariantConfig[]
  testVariantResults: Record<TestVariantId, ImageResult | null>
  testVariantLastRunFingerprint: Record<TestVariantId, string>
  evaluationResults: PersistedEvaluationResults
  isCompareMode: boolean
  selectedTextModelKey: string
  selectedImageModelKey: string
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null
  lastActiveAt: number
  assetBinding?: PromptAssetBinding
  origin?: PromptSessionOrigin
}

const createDefaultState = (): ImageMultiImageSessionState => ({
  originalPrompt: '',
  optimizedPrompt: '',
  reasoning: '',
  chainId: '',
  versionId: '',
  temporaryVariables: {},
  inputImages: [],
  originalImageResult: null,
  optimizedImageResult: null,
  layout: { mainSplitLeftPct: 50, testColumnCount: 2 },
  testVariants: [
    { id: 'a', version: 0, modelKey: '' },
    { id: 'b', version: 'workspace', modelKey: '' },
    { id: 'c', version: 'workspace', modelKey: '' },
    { id: 'd', version: 'workspace', modelKey: '' },
  ],
  testVariantResults: { a: null, b: null, c: null, d: null },
  testVariantLastRunFingerprint: { a: '', b: '', c: '', d: '' },
  evaluationResults: createDefaultEvaluationResults(),
  isCompareMode: true,
  selectedTextModelKey: '',
  selectedImageModelKey: '',
  selectedTemplateId: null,
  selectedIterateTemplateId: null,
  lastActiveAt: Date.now(),
  assetBinding: undefined,
  origin: undefined,
})

const createRuntimeImageId = () =>
  `multi_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

const createMissingInputAssetError = (assetId: string) =>
  Object.assign(
    new Error(`[ImageMultiImageSession] Missing input image asset: ${assetId}`),
    {
      code: 'error.storage.read',
      params: {
        reason: 'session_referenced_image_missing',
        key: IMAGE_MULTIIMAGE_SESSION_KEY,
        assetId,
      },
    },
  )

const isTestColumnCount = (value: unknown): value is TestColumnCount =>
  value === 2 || value === 3 || value === 4

const isVariantId = (value: unknown): value is TestVariantId =>
  value === 'a' || value === 'b' || value === 'c' || value === 'd'

const parseLayout = (value: unknown): ImageWorkspaceLayoutConfig => {
  const defaults = createDefaultState().layout
  if (!value || typeof value !== 'object') return defaults

  const record = value as Record<string, unknown>
  const mainSplitLeftPct =
    typeof record.mainSplitLeftPct === 'number' && Number.isFinite(record.mainSplitLeftPct)
      ? Math.min(50, Math.max(25, Math.round(record.mainSplitLeftPct)))
      : defaults.mainSplitLeftPct
  const testColumnCount = isTestColumnCount(record.testColumnCount)
    ? record.testColumnCount
    : defaults.testColumnCount

  return {
    mainSplitLeftPct,
    testColumnCount,
  }
}

const parseTestVariants = (value: unknown): TestVariantConfig[] => {
  const defaults = createDefaultState().testVariants
  if (!Array.isArray(value)) return defaults

  const byId = new Map(defaults.map((item) => [item.id, item]))
  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== 'object') continue
    const item = rawItem as Record<string, unknown>
    if (!isVariantId(item.id)) continue
    byId.set(item.id, {
      id: item.id,
      version:
        item.version === 'workspace' ||
        item.version === 'previous' ||
        (typeof item.version === 'number' && Number.isFinite(item.version))
          ? (item.version as TestPanelVersionValue)
          : byId.get(item.id)?.version ?? 'workspace',
      modelKey: typeof item.modelKey === 'string' ? item.modelKey : byId.get(item.id)?.modelKey ?? '',
    })
  }

  return (['a', 'b', 'c', 'd'] as TestVariantId[]).map(
    (id) => byId.get(id) || defaults.find((item) => item.id === id)!,
  )
}

const parseTestVariantFingerprints = (value: unknown): Record<TestVariantId, string> => {
  const defaults = createDefaultState().testVariantLastRunFingerprint
  if (!value || typeof value !== 'object') return defaults

  const record = value as Record<string, unknown>
  return {
    a: typeof record.a === 'string' ? record.a : defaults.a,
    b: typeof record.b === 'string' ? record.b : defaults.b,
    c: typeof record.c === 'string' ? record.c : defaults.c,
    d: typeof record.d === 'string' ? record.d : defaults.d,
  }
}

const saveInputImage = async (
  image: MultiImageSessionInputItem,
  storageService: IImageStorageService,
): Promise<string> => {
  const normalizedMime = image.mimeType || 'image/png'
  const stableId = await computeStableImageId(image.b64, normalizedMime)
  const existing = await storageService.getMetadata(stableId)
  if (!existing) {
    await storageService.saveImage({
      metadata: {
        id: stableId,
        mimeType: normalizedMime,
        sizeBytes: Math.floor(image.b64.length * 0.75),
        createdAt: Date.now(),
        accessedAt: Date.now(),
        source: 'uploaded',
      },
      data: image.b64,
    })
  }
  return stableId
}

const prepareForSave = async (
  result: ImageResult | null,
  storageService: IImageStorageService,
): Promise<ImageResult | null> => {
  if (!result || !result.images || result.images.length === 0) {
    return result
  }

  const processedImages: ImageResultItem[] = []

  for (const img of result.images) {
    if (isImageRef(img)) {
      processedImages.push(img)
      continue
    }

    const payload = img.b64
      ? {
          b64: img.b64,
          mimeType: img.mimeType || 'image/png',
        }
      : img.url
        ? await normalizeImageSourceToPayload(img.url)
        : null

    if (!payload) {
      processedImages.push(img)
      continue
    }

    const imageId = await persistImagePayloadAsAssetId({
      payload,
      storageService,
      sourceType: 'generated',
      metadata: {
        prompt: result.metadata?.prompt,
        modelId: result.metadata?.modelId,
        configId: result.metadata?.configId,
      },
    })

    if (imageId) {
      processedImages.push(createImageRef(imageId))
      continue
    }

    processedImages.push(img)
  }

  return {
    ...result,
    images: processedImages,
  }
}

const loadFromRef = async (
  result: ImageResult | null,
  storageService: IImageStorageService,
): Promise<ImageResult | null> => {
  if (!result || !result.images || result.images.length === 0) {
    return result
  }

  const loadedImages: ImageResultItem[] = []

  for (const img of result.images) {
    if (isImageRef(img)) {
      try {
        const fullImageData = await storageService.getImage(img.id)
        if (fullImageData) {
          loadedImages.push({
            b64: fullImageData.data,
            mimeType: fullImageData.metadata.mimeType,
          })
        } else {
          console.warn(`[ImageMultiImageSession] Image ${img.id} was not found`)
          loadedImages.push(img)
        }
      } catch (error) {
        console.error(`[ImageMultiImageSession] Failed to load image ${img.id}:`, error)
        loadedImages.push(img)
      }
    } else {
      if (img.url && !img.b64) {
        try {
          const payload = await normalizeImageSourceToPayload(img.url)
          if (payload?.b64) {
            try {
              await persistImagePayloadAsAssetId({
                payload,
                storageService,
                sourceType: 'generated',
                metadata: {
                  prompt: result.metadata?.prompt,
                  modelId: result.metadata?.modelId,
                  configId: result.metadata?.configId,
                },
              })
            } catch (error) {
              console.warn('[ImageMultiImageSession] Failed to persist legacy URL image during restore:', error)
            }

            loadedImages.push({
              b64: payload.b64,
              mimeType: payload.mimeType,
            })
            continue
          }
        } catch (error) {
          console.warn('[ImageMultiImageSession] Failed to restore legacy URL image:', error)
        }
      }

      loadedImages.push(img)
    }
  }

  return {
    ...result,
    images: loadedImages,
  }
}

export const useImageMultiImageSession = defineStore('imageMultiImageSession', () => {
  const originalPrompt = ref('')
  const optimizedPrompt = ref('')
  const reasoning = ref('')
  const chainId = ref('')
  const versionId = ref('')
  const temporaryVariables = ref<Record<string, string>>({})
  const inputImages = ref<MultiImageSessionInputItem[]>([])
  const originalImageResult = ref<ImageResult | null>(null)
  const optimizedImageResult = ref<ImageResult | null>(null)
  const layout = ref<ImageWorkspaceLayoutConfig>({ mainSplitLeftPct: 50, testColumnCount: 2 })
  const testVariants = ref<TestVariantConfig[]>(createDefaultState().testVariants)
  const testVariantResults = ref<Record<TestVariantId, ImageResult | null>>(createDefaultState().testVariantResults)
  const testVariantLastRunFingerprint = ref<Record<TestVariantId, string>>(createDefaultState().testVariantLastRunFingerprint)
  const evaluationResults = ref<PersistedEvaluationResults>(createDefaultEvaluationResults())
  const isCompareMode = ref(true)
  const selectedTextModelKey = ref('')
  const selectedImageModelKey = ref('')
  const selectedTemplateId = ref<string | null>(null)
  const selectedIterateTemplateId = ref<string | null>(null)
  const lastActiveAt = ref(Date.now())
  const assetBindingState = createSessionAssetBindingState(
    () => {
      lastActiveAt.value = Date.now()
    },
    () => {
      void saveSession().catch((error) => {
        console.error('[ImageMultiImageSession] Failed to auto-save asset binding:', error)
      })
    },
  )

  const touch = () => {
    lastActiveAt.value = Date.now()
  }

  const updatePrompt = (prompt: string) => {
    if (originalPrompt.value === prompt) return
    originalPrompt.value = prompt
    touch()
  }

  const updateOptimizedResult = (payload: {
    optimizedPrompt: string
    reasoning?: string
    chainId: string
    versionId: string
  }) => {
    if (!payload.chainId && !payload.versionId) {
      assetBindingState.clearAssetBindingWithoutPersist()
    }
    optimizedPrompt.value = payload.optimizedPrompt
    reasoning.value = payload.reasoning || ''
    chainId.value = payload.chainId
    versionId.value = payload.versionId
    touch()
  }

  const updateOriginalImageResult = (result: ImageResult | null) => {
    originalImageResult.value = result
    testVariantResults.value = { ...testVariantResults.value, a: result }
    touch()
  }

  const updateOptimizedImageResult = (result: ImageResult | null) => {
    optimizedImageResult.value = result
    testVariantResults.value = { ...testVariantResults.value, b: result }
    touch()
  }

  const updateTextModel = (modelKey: string) => {
    selectedTextModelKey.value = modelKey
    touch()
  }

  const updateImageModel = (modelKey: string) => {
    selectedImageModelKey.value = modelKey
    touch()
  }

  const updateTemplate = (templateId: string | null) => {
    selectedTemplateId.value = templateId
    touch()
  }

  const updateIterateTemplate = (templateId: string | null) => {
    selectedIterateTemplateId.value = templateId
    touch()
  }

  const setTemporaryVariable = (name: string, value: string) => {
    if (!isValidVariableName(name)) return
    temporaryVariables.value[name] = value
    touch()
  }

  const getTemporaryVariable = (name: string): string | undefined => {
    return temporaryVariables.value[name]
  }

  const deleteTemporaryVariable = (name: string) => {
    if (!(name in temporaryVariables.value)) return
    const next = { ...temporaryVariables.value }
    delete next[name]
    temporaryVariables.value = next
    touch()
  }

  const clearTemporaryVariables = () => {
    temporaryVariables.value = {}
    touch()
  }

  const toggleCompareMode = (enabled?: boolean) => {
    isCompareMode.value = enabled ?? !isCompareMode.value
    touch()
  }

  const setTestColumnCount = (count: TestColumnCount) => {
    layout.value = { ...layout.value, testColumnCount: count }
    touch()
  }

  const setMainSplitLeftPct = (pct: number) => {
    layout.value = {
      ...layout.value,
      mainSplitLeftPct: Math.min(50, Math.max(25, Math.round(pct))),
    }
    touch()
  }

  const updateTestVariant = (id: TestVariantId, patch: Partial<Omit<TestVariantConfig, 'id'>>) => {
    const index = testVariants.value.findIndex((item) => item.id === id)
    if (index < 0) return
    const next = testVariants.value.slice()
    next[index] = { ...next[index], ...patch, id }
    testVariants.value = next
    touch()
  }

  const updateTestVariantResult = (id: TestVariantId, result: ImageResult | null) => {
    testVariantResults.value = {
      ...testVariantResults.value,
      [id]: result,
    }
    touch()
  }

  const setTestVariantLastRunFingerprint = (id: TestVariantId, fingerprint: string) => {
    testVariantLastRunFingerprint.value = {
      ...testVariantLastRunFingerprint.value,
      [id]: fingerprint,
    }
    touch()
  }

  const addInputImage = async (image: ImageInputRef) => {
    inputImages.value = [
      ...inputImages.value,
      {
        id: createRuntimeImageId(),
        assetId: null,
        b64: image.b64,
        mimeType: image.mimeType || 'image/png',
      },
    ]
    touch()
  }

  const replaceInputImages = (images: ImageInputRef[]) => {
    inputImages.value = images.map((image) => ({
      id: createRuntimeImageId(),
      assetId: null,
      b64: image.b64,
      mimeType: image.mimeType || 'image/png',
    }))
    touch()
  }

  const removeInputImage = (id: string) => {
    inputImages.value = inputImages.value.filter((item) => item.id !== id)
    touch()
  }

  const reorderInputImages = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const next = inputImages.value.slice()
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) return
    next.splice(toIndex, 0, moved)
    inputImages.value = next
    touch()
  }

  const reset = () => {
    const defaults = createDefaultState()
    originalPrompt.value = defaults.originalPrompt
    optimizedPrompt.value = defaults.optimizedPrompt
    reasoning.value = defaults.reasoning
    chainId.value = defaults.chainId
    versionId.value = defaults.versionId
    temporaryVariables.value = defaults.temporaryVariables
    inputImages.value = defaults.inputImages
    originalImageResult.value = defaults.originalImageResult
    optimizedImageResult.value = defaults.optimizedImageResult
    layout.value = defaults.layout
    testVariants.value = defaults.testVariants
    testVariantResults.value = defaults.testVariantResults
    testVariantLastRunFingerprint.value = defaults.testVariantLastRunFingerprint
    evaluationResults.value = defaults.evaluationResults
    isCompareMode.value = defaults.isCompareMode
    selectedTextModelKey.value = defaults.selectedTextModelKey
    selectedImageModelKey.value = defaults.selectedImageModelKey
    selectedTemplateId.value = defaults.selectedTemplateId
    selectedIterateTemplateId.value = defaults.selectedIterateTemplateId
    assetBindingState.resetAssetBinding()
    lastActiveAt.value = defaults.lastActiveAt
  }

  const clearContent = (options: { persist?: boolean } = {}) => {
    const defaults = createDefaultState()
    originalPrompt.value = defaults.originalPrompt
    optimizedPrompt.value = defaults.optimizedPrompt
    reasoning.value = defaults.reasoning
    chainId.value = defaults.chainId
    versionId.value = defaults.versionId
    temporaryVariables.value = defaults.temporaryVariables
    inputImages.value = defaults.inputImages
    originalImageResult.value = defaults.originalImageResult
    optimizedImageResult.value = defaults.optimizedImageResult
    testVariantResults.value = defaults.testVariantResults
    testVariantLastRunFingerprint.value = defaults.testVariantLastRunFingerprint
    evaluationResults.value = defaults.evaluationResults
    assetBindingState.clearAssetBindingWithoutPersist()
    lastActiveAt.value = Date.now()
    if (options.persist !== false) {
      void saveSession().catch((error) => {
        console.error('[ImageMultiImageSession] Failed to persist cleared content:', error)
      })
    }
  }

  const sessionSnapshot = createSessionSnapshotWriter(() => sessionContent)

  const saveSession = (permit?: SessionWritePermit): Promise<boolean> =>
    runSessionWrite(getPiniaServices()?.preferenceService, persistSession, permit)

  const persistSession = async () => {
    return await queueImageStorageMaintenance(async () => {
      const capturedContent = sessionSnapshot.capture()
      const $services = getPiniaServices()
      if (!$services?.preferenceService) {
        throw new Error('[ImageMultiImageSession] PreferenceService is unavailable; cannot save session')
      }
      if (!$services?.imageStorageService) {
        throw new Error('[ImageMultiImageSession] ImageStorageService is unavailable; cannot save session')
      }
      const imageStorageService = $services.imageStorageService

      const persistedImages = await Promise.all(
        inputImages.value.map(async (image) => ({
          id: image.id,
          assetId: await saveInputImage(image, imageStorageService),
          mimeType: image.mimeType || 'image/png',
        })),
      )

      // Keep an idle save observationally quiet. Replacing an unchanged array
      // looks like a new edit to autosave and the app-update checkpoint.
      // Match IDs rather than positions: the list may be reordered while the
      // image storage writes are pending.
      const savedAssetIds = new Map(persistedImages.map(image => [image.id, image.assetId]))
      if (inputImages.value.some(image => {
        const assetId = savedAssetIds.get(image.id)
        return assetId && assetId !== image.assetId
      })) {
        inputImages.value = inputImages.value.map(image => {
          const assetId = savedAssetIds.get(image.id)
          return assetId && assetId !== image.assetId ? { ...image, assetId } : image
        })
      }

      const baseVariantResults = {
        a: testVariantResults.value.a ?? originalImageResult.value,
        b: testVariantResults.value.b ?? optimizedImageResult.value,
        c: testVariantResults.value.c,
        d: testVariantResults.value.d,
      }

      const variantResultsToSave = {
        a: await prepareForSave(baseVariantResults.a, imageStorageService),
        b: await prepareForSave(baseVariantResults.b, imageStorageService),
        c: await prepareForSave(baseVariantResults.c, imageStorageService),
        d: await prepareForSave(baseVariantResults.d, imageStorageService),
      }

      await sessionSnapshot.write($services.preferenceService, IMAGE_MULTIIMAGE_SESSION_KEY, {
        originalPrompt: originalPrompt.value,
        optimizedPrompt: optimizedPrompt.value,
        reasoning: reasoning.value,
        chainId: chainId.value,
        versionId: versionId.value,
        temporaryVariables: sanitizeVariableRecord(temporaryVariables.value),
        inputImages: persistedImages,
        originalImageResult: variantResultsToSave.a,
        optimizedImageResult: variantResultsToSave.b,
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
        ...assetBindingState.persistedAssetBinding(),
      }, capturedContent)

      scheduleImageStorageGc($services.preferenceService, imageStorageService)
    })
  }

  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      throw new Error('[ImageMultiImageSession] PreferenceService is unavailable; cannot restore session')
    }
    if (!$services?.imageStorageService) {
      throw new Error('[ImageMultiImageSession] ImageStorageService is unavailable; cannot restore session')
    }
    const imageStorageService = $services.imageStorageService

    const saved = await readSessionSnapshot<unknown>($services.preferenceService,IMAGE_MULTIIMAGE_SESSION_KEY, null)
    if (!saved) {
      sessionSnapshot.restored($services.preferenceService, IMAGE_MULTIIMAGE_SESSION_KEY)
      return
    }

    const parsed =
      typeof saved === 'string'
        ? (JSON.parse(saved) as Record<string, unknown>)
        : (saved as Record<string, unknown>)

    const rawImages = Array.isArray(parsed.inputImages) ? parsed.inputImages : []
    const restoredImages = await Promise.all(
      rawImages.map(async (item) => {
        const record = (item || {}) as Record<string, unknown>
        const assetId = typeof record.assetId === 'string' ? record.assetId : null
        let mimeType = typeof record.mimeType === 'string' ? record.mimeType : 'image/png'
        let b64 = typeof record.b64 === 'string' ? record.b64 : ''

        if (!b64 && assetId) {
          const fullImage = await imageStorageService.getImage(assetId)
          if (!fullImage?.data?.trim()) {
            throw createMissingInputAssetError(assetId)
          }

          b64 = fullImage.data
          mimeType = fullImage.metadata?.mimeType || mimeType
        }

        if (!b64.trim()) {
          throw new Error('[ImageMultiImageSession] Missing input image base64 data in persisted session')
        }

        return {
          id: typeof record.id === 'string' ? record.id : createRuntimeImageId(),
          assetId,
          b64,
          mimeType,
        } satisfies MultiImageSessionInputItem
      }),
    )

    const rawVariantResults = parsed.testVariantResults
    let variantResultsLoaded: Record<TestVariantId, ImageResult | null> | null = null
    if (rawVariantResults && typeof rawVariantResults === 'object') {
      const record = rawVariantResults as Record<string, unknown>
      const pick = (id: TestVariantId): ImageResult | null => {
        const one = record[id]
        if (!one || typeof one !== 'object') return null
        return one as ImageResult
      }
      variantResultsLoaded = {
        a: pick('a'),
        b: pick('b'),
        c: pick('c'),
        d: pick('d'),
      }
    }

    if (!variantResultsLoaded) {
      variantResultsLoaded = {
        a: (parsed.originalImageResult as ImageResult | null) ?? null,
        b: (parsed.optimizedImageResult as ImageResult | null) ?? null,
        c: null,
        d: null,
      }
    }

    const loadedVariantResults = {
      a: await loadFromRef(variantResultsLoaded.a, imageStorageService),
      b: await loadFromRef(variantResultsLoaded.b, imageStorageService),
      c: await loadFromRef(variantResultsLoaded.c, imageStorageService),
      d: await loadFromRef(variantResultsLoaded.d, imageStorageService),
    }

    originalPrompt.value = typeof parsed.originalPrompt === 'string' ? parsed.originalPrompt : ''
    optimizedPrompt.value = typeof parsed.optimizedPrompt === 'string' ? parsed.optimizedPrompt : ''
    reasoning.value = typeof parsed.reasoning === 'string' ? parsed.reasoning : ''
    chainId.value = typeof parsed.chainId === 'string' ? parsed.chainId : ''
    versionId.value = typeof parsed.versionId === 'string' ? parsed.versionId : ''
    temporaryVariables.value = sanitizeVariableRecord(parsed.temporaryVariables)
    inputImages.value = restoredImages
    originalImageResult.value = loadedVariantResults.a
    optimizedImageResult.value = loadedVariantResults.b
    layout.value = parseLayout(parsed.layout)
    testVariants.value = parseTestVariants(parsed.testVariants)
    testVariantResults.value = loadedVariantResults
    testVariantLastRunFingerprint.value = parseTestVariantFingerprints(
      parsed.testVariantLastRunFingerprint,
    )
    evaluationResults.value = (parsed.evaluationResults as PersistedEvaluationResults) ?? createDefaultEvaluationResults()
    isCompareMode.value = typeof parsed.isCompareMode === 'boolean' ? parsed.isCompareMode : true
    selectedTextModelKey.value = typeof parsed.selectedTextModelKey === 'string' ? parsed.selectedTextModelKey : ''
    selectedImageModelKey.value = typeof parsed.selectedImageModelKey === 'string' ? parsed.selectedImageModelKey : ''
    selectedTemplateId.value = typeof parsed.selectedTemplateId === 'string' ? parsed.selectedTemplateId : null
    selectedIterateTemplateId.value = typeof parsed.selectedIterateTemplateId === 'string' ? parsed.selectedIterateTemplateId : null
    assetBindingState.restoreAssetBinding(parsed)
    lastActiveAt.value = Date.now()
    sessionSnapshot.restored($services.preferenceService, IMAGE_MULTIIMAGE_SESSION_KEY)
  }

  const sessionContent = {
    originalPrompt,
    optimizedPrompt,
    reasoning,
    chainId,
    versionId,
    temporaryVariables,
    inputImages,
    originalImageResult,
    optimizedImageResult,
    layout,
    testVariants,
    testVariantResults,
    testVariantLastRunFingerprint,
    evaluationResults,
    isCompareMode,
    selectedTextModelKey,
    selectedImageModelKey,
    selectedTemplateId,
    selectedIterateTemplateId,
    lastActiveAt,
    assetBinding: assetBindingState.assetBinding,
    origin: assetBindingState.origin,
  }

  return {
    ...sessionContent,
    updatePrompt,
    updateOptimizedResult,
    updateOriginalImageResult,
    updateOptimizedImageResult,
    updateTextModel,
    updateImageModel,
    updateTemplate,
    updateIterateTemplate,
    setTemporaryVariable,
    getTemporaryVariable,
    deleteTemporaryVariable,
    clearTemporaryVariables,
    toggleCompareMode,
    setTestColumnCount,
    setMainSplitLeftPct,
    updateTestVariant,
    updateTestVariantResult,
    setTestVariantLastRunFingerprint,
    addInputImage,
    replaceInputImages,
    removeInputImage,
    reorderInputImages,
    clearContent,
    updateAssetBinding: assetBindingState.updateAssetBinding,
    clearAssetBinding: assetBindingState.clearAssetBinding,
    reset,
    saveSession,
    restoreSession,
  }
})

export type ImageMultiImageSessionApi = ReturnType<typeof useImageMultiImageSession>
