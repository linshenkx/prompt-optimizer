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
import { ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import { TEMPLATE_SELECTION_KEYS, type PromptAssetBinding, type PromptSessionOrigin } from '@prompt-optimizer/core'
import { coerceTestPanelVersionValue } from '../../utils/testPanelVersion'
import { persistImagePayloadAsAssetId } from '../../utils/image-asset-storage'
import { createSessionAssetBindingState } from './sessionAssetBinding'
import {
  BASIC_SYSTEM_SESSION_KEY,
  queueImageStorageMaintenance,
  scheduleImageStorageGc,
} from './imageStorageMaintenance'
import {
  createDefaultCompareSnapshotRoles,
  createDefaultCompareSnapshotRoleSignatures,
  createDefaultEvaluationResults,
  sanitizeCompareSnapshotRoles,
  sanitizeCompareSnapshotRoleSignatures,
  type PersistedCompareSnapshotRoles,
  type PersistedCompareSnapshotRoleSignatures,
  type PersistedEvaluationResults,
} from '../../types/evaluation'

/**
 * basic-system 测试面板的版本选择：
 * - 'workspace': 下方工作区当前内容（未保存草稿也算）
 * - 'previous': 动态指向最近保存版本的上一版
 * - 0: v0（原始提示词）
 * - >=1: v1..vn（历史链版本号）
 */
export type TestPanelVersionValue = 'workspace' | 'previous' | 0 | number

export type TestVariantId = 'a' | 'b' | 'c' | 'd'

export type TestColumnCount = 2 | 3 | 4

export interface BasicSystemLayoutConfig {
  /** 主布局左侧宽度（百分比，25..50） */
  mainSplitLeftPct: number
  /** 测试区列数（2..4） */
  testColumnCount: TestColumnCount
}

export interface TestVariantConfig {
  id: TestVariantId
  version: TestPanelVersionValue
  modelKey: string
}

export interface TestVariantResult {
  result: string
  reasoning: string
}

export type TestVariantResults = Record<TestVariantId, TestVariantResult>

export type TestVariantLastRunFingerprint = Record<TestVariantId, string>

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

  // 测试区域内容（system 模式必填，用于测试区输入框）
  testContent: string

  // 测试区域可选单图。base64 仅运行时持有，不进入 session 快照。
  testImageB64: string | null
  testImageMimeType: string
  testImageAssetId: string | null

  // 测试布局与列配置（basic-system 专用：最多 4 列）
  layout: BasicSystemLayoutConfig
  testVariants: TestVariantConfig[]

  // 测试结果（按列持久化，支持最多 4 列）
  testVariantResults: TestVariantResults
  testVariantLastRunFingerprint: TestVariantLastRunFingerprint

  // 评估结果（分类型持久化，用于重启恢复）
  evaluationResults: PersistedEvaluationResults
  compareSnapshotRoles: PersistedCompareSnapshotRoles<TestVariantId>
  compareSnapshotRoleSignatures: PersistedCompareSnapshotRoleSignatures<TestVariantId>

  // 模型和模板选择（只存 ID/key，不存对象）
  selectedOptimizeModelKey: string
  selectedTestModelKey: string
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null

  // 对比模式
  isCompareMode: boolean

  // 最后活跃时间
  lastActiveAt: number

  // 标准提示词资产来源坐标（内部无感 session metadata）
  assetBinding?: PromptAssetBinding
  origin?: PromptSessionOrigin
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
  testContent: '',
  testImageB64: null,
  testImageMimeType: '',
  testImageAssetId: null,
  layout: { mainSplitLeftPct: 50, testColumnCount: 2 },
  testVariants: [
    { id: 'a', version: 0, modelKey: '' },
    { id: 'b', version: 'workspace', modelKey: '' },
    { id: 'c', version: 'workspace', modelKey: '' },
    { id: 'd', version: 'workspace', modelKey: '' },
  ],
  testVariantResults: {
    a: { result: '', reasoning: '' },
    b: { result: '', reasoning: '' },
    c: { result: '', reasoning: '' },
    d: { result: '', reasoning: '' },
  },
  testVariantLastRunFingerprint: {
    a: '',
    b: '',
    c: '',
    d: '',
  },
  evaluationResults: createDefaultEvaluationResults(),
  compareSnapshotRoles: createDefaultCompareSnapshotRoles<TestVariantId>(),
  compareSnapshotRoleSignatures: createDefaultCompareSnapshotRoleSignatures<TestVariantId>(),
  selectedOptimizeModelKey: '',
  selectedTestModelKey: '',
  selectedTemplateId: null,
  selectedIterateTemplateId: null,
  isCompareMode: true,
  lastActiveAt: Date.now(),
  assetBinding: undefined,
  origin: undefined,
})

export const useBasicSystemSession = defineStore('basicSystemSession', () => {
  // ========== 状态定义（使用独立 ref，而非包装在 state 对象中）==========

  // 提示词相关
  const prompt = ref('')
  const optimizedPrompt = ref('')
  const reasoning = ref('')

  // 历史相关（只存 ID）
  const chainId = ref('')
  const versionId = ref('')

  // 测试区域内容
  const testContent = ref('')
  const testImageB64 = ref<string | null>(null)
  const testImageMimeType = ref('')
  const testImageAssetId = ref<string | null>(null)

  // 测试布局与列配置（最多 4 列）
  const layout = ref<BasicSystemLayoutConfig>({ mainSplitLeftPct: 50, testColumnCount: 2 })
  const testVariants = ref<TestVariantConfig[]>([
    { id: 'a', version: 0, modelKey: '' },
    { id: 'b', version: 'workspace', modelKey: '' },
    { id: 'c', version: 'workspace', modelKey: '' },
    { id: 'd', version: 'workspace', modelKey: '' },
  ])

  const testVariantResults = ref<TestVariantResults>({
    a: { result: '', reasoning: '' },
    b: { result: '', reasoning: '' },
    c: { result: '', reasoning: '' },
    d: { result: '', reasoning: '' },
  })

  const testVariantLastRunFingerprint = ref<TestVariantLastRunFingerprint>({
    a: '',
    b: '',
    c: '',
    d: '',
  })

  // 评估结果
  const evaluationResults = ref<PersistedEvaluationResults>(createDefaultEvaluationResults())
  const compareSnapshotRoles = ref<PersistedCompareSnapshotRoles<TestVariantId>>(
    createDefaultCompareSnapshotRoles<TestVariantId>()
  )
  const compareSnapshotRoleSignatures = ref<PersistedCompareSnapshotRoleSignatures<TestVariantId>>(
    createDefaultCompareSnapshotRoleSignatures<TestVariantId>()
  )

  // 模型和模板选择（只存 ID/key，不存对象）
  const selectedOptimizeModelKey = ref('')
  const selectedTestModelKey = ref('')
  const selectedTemplateId = ref<string | null>(null)
  const selectedIterateTemplateId = ref<string | null>(null)

  // 对比模式
  const isCompareMode = ref(true)

  // 最后活跃时间
  const lastActiveAt = ref(Date.now())
  const assetBindingState = createSessionAssetBindingState(
    () => {
      lastActiveAt.value = Date.now()
    },
    () => {
      void saveSession()
    },
  )

  /**
   * 更新提示词
   */
  const updatePrompt = (promptValue: string) => {
    if (prompt.value === promptValue) return
    prompt.value = promptValue
    lastActiveAt.value = Date.now()
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
    const nextOptimizedPrompt = payload.optimizedPrompt
    const nextReasoning = payload.reasoning || ''
    const nextChainId = payload.chainId
    const nextVersionId = payload.versionId

    if (!nextChainId && !nextVersionId) {
      assetBindingState.clearAssetBindingWithoutPersist()
    }

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

  /**
   * 更新测试内容
   */
  const updateTestContent = (content: string) => {
    if (testContent.value === content) return
    testContent.value = content
    lastActiveAt.value = Date.now()
  }

  /**
   * 同步更新测试图片运行时状态，并 best-effort 持久化。
   * 普通新增/替换不传 assetId，因此会立即清除旧引用；删除会清空全部图片字段。
   */
  const updateTestImage = (
    b64: string | null,
    mimeType: string = '',
    assetId?: string | null,
  ) => {
    const nextB64 = typeof b64 === 'string' && b64.trim() ? b64 : null
    const nextMimeType = nextB64 ? (mimeType.trim() || 'image/png') : ''
    const nextAssetId = nextB64 && typeof assetId === 'string' && assetId.trim()
      ? assetId.trim()
      : null

    const changed =
      testImageB64.value !== nextB64 ||
      testImageMimeType.value !== nextMimeType ||
      testImageAssetId.value !== nextAssetId
    if (!changed) return

    testImageB64.value = nextB64
    testImageMimeType.value = nextMimeType
    testImageAssetId.value = nextAssetId
    lastActiveAt.value = Date.now()
    void saveSession()
  }

  /**
   * 更新优化模型选择
   */
  const updateOptimizeModel = (modelKey: string) => {
    if (selectedOptimizeModelKey.value === modelKey) return
    selectedOptimizeModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    // 异步保存完整状态（best-effort）
    saveSession()
  }

  /**
   * 更新测试模型选择
   */
  const updateTestModel = (modelKey: string) => {
    if (selectedTestModelKey.value === modelKey) return
    selectedTestModelKey.value = modelKey
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * 更新模板选择
   */
  const updateTemplate = (templateId: string | null) => {
    if (selectedTemplateId.value === templateId) return
    selectedTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * 更新迭代模板选择
   */
  const updateIterateTemplate = (templateId: string | null) => {
    if (selectedIterateTemplateId.value === templateId) return
    selectedIterateTemplateId.value = templateId
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * 切换对比模式
   */
  const toggleCompareMode = (enabled?: boolean) => {
    const nextValue = enabled ?? !isCompareMode.value
    if (isCompareMode.value === nextValue) return
    isCompareMode.value = nextValue
    lastActiveAt.value = Date.now()
  }

  const updateCompareSnapshotRoles = (
    roles: PersistedCompareSnapshotRoles<TestVariantId>,
    signatures: PersistedCompareSnapshotRoleSignatures<TestVariantId>,
  ) => {
    compareSnapshotRoles.value = { ...roles }
    compareSnapshotRoleSignatures.value = { ...signatures }
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * 设置测试区列数
   */
  const setTestColumnCount = (count: TestColumnCount) => {
    if (layout.value.testColumnCount === count) return
    layout.value = { ...layout.value, testColumnCount: count }
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * 设置主布局左侧宽度（百分比）
   */
  const setMainSplitLeftPct = (pct: number) => {
    const normalized = Number.isFinite(pct) ? Math.round(pct) : layout.value.mainSplitLeftPct
    const next = Math.min(50, Math.max(25, normalized))
    if (layout.value.mainSplitLeftPct === next) return
    layout.value = { ...layout.value, mainSplitLeftPct: next }
    lastActiveAt.value = Date.now()
    saveSession()
  }

  /**
   * 更新某一列（variant）的版本/模型配置
   */
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
    saveSession()
  }

  /**
   * 重置多列测试结果与最近运行指纹
   */
  const resetTestVariantState = () => {
    const defaultState = createDefaultState()
    testVariantResults.value = defaultState.testVariantResults
    testVariantLastRunFingerprint.value = defaultState.testVariantLastRunFingerprint
    lastActiveAt.value = Date.now()
  }

  const clearContent = (options: { persist?: boolean } = {}) => {
    const defaultState = createDefaultState()
    prompt.value = defaultState.prompt
    optimizedPrompt.value = defaultState.optimizedPrompt
    reasoning.value = defaultState.reasoning
    chainId.value = defaultState.chainId
    versionId.value = defaultState.versionId
    testContent.value = defaultState.testContent
    testImageB64.value = defaultState.testImageB64
    testImageMimeType.value = defaultState.testImageMimeType
    testImageAssetId.value = defaultState.testImageAssetId
    testVariantResults.value = defaultState.testVariantResults
    testVariantLastRunFingerprint.value = defaultState.testVariantLastRunFingerprint
    evaluationResults.value = defaultState.evaluationResults
    compareSnapshotRoles.value = defaultState.compareSnapshotRoles
    compareSnapshotRoleSignatures.value = defaultState.compareSnapshotRoleSignatures
    assetBindingState.clearAssetBindingWithoutPersist()
    lastActiveAt.value = Date.now()
    if (options.persist !== false) {
      void saveSession().catch((error) => {
        console.error('[BasicSystemSession] Failed to persist cleared content:', error)
      })
    }
  }

  /**
   * 重置状态
   */
  const reset = () => {
    const defaultState = createDefaultState()
    prompt.value = defaultState.prompt
    optimizedPrompt.value = defaultState.optimizedPrompt
    reasoning.value = defaultState.reasoning
    chainId.value = defaultState.chainId
    versionId.value = defaultState.versionId
    testContent.value = defaultState.testContent
    testImageB64.value = defaultState.testImageB64
    testImageMimeType.value = defaultState.testImageMimeType
    testImageAssetId.value = defaultState.testImageAssetId
    layout.value = defaultState.layout
    testVariants.value = defaultState.testVariants
    testVariantResults.value = defaultState.testVariantResults
    testVariantLastRunFingerprint.value = defaultState.testVariantLastRunFingerprint
    evaluationResults.value = defaultState.evaluationResults
    compareSnapshotRoles.value = defaultState.compareSnapshotRoles
    compareSnapshotRoleSignatures.value = defaultState.compareSnapshotRoleSignatures
    selectedOptimizeModelKey.value = defaultState.selectedOptimizeModelKey
    selectedTestModelKey.value = defaultState.selectedTestModelKey
    selectedTemplateId.value = defaultState.selectedTemplateId
    selectedIterateTemplateId.value = defaultState.selectedIterateTemplateId
    isCompareMode.value = defaultState.isCompareMode
    assetBindingState.resetAssetBinding()
    lastActiveAt.value = Date.now()
  }

  /**
   * 保存会话到持久化存储
   * 使用 PreferenceService（Codex 要求）
   */
  const saveSession = async () => {
    const imageSnapshot = {
      b64: testImageB64.value,
      mimeType: testImageMimeType.value,
      assetId: testImageAssetId.value,
    }

    return await queueImageStorageMaintenance(async () => {
      const $services = getPiniaServices()
      if (!$services?.preferenceService) {
        console.warn('[BasicSystemSession] PreferenceService is unavailable; cannot save session')
        return
      }

      try {
        let imageAssetIdToSave = imageSnapshot.assetId
        const imageMimeTypeToSave = imageSnapshot.b64 || imageSnapshot.assetId
          ? (imageSnapshot.mimeType || 'image/png')
          : ''

        if (imageSnapshot.b64 && !imageAssetIdToSave) {
          if (!$services.imageStorageService) {
            throw new Error(
              '[BasicSystemSession] ImageStorageService is unavailable; cannot save test image',
            )
          }

          imageAssetIdToSave = await persistImagePayloadAsAssetId({
            payload: {
              b64: imageSnapshot.b64,
              mimeType: imageMimeTypeToSave,
            },
            storageService: $services.imageStorageService,
            sourceType: 'uploaded',
          })

          if (!imageAssetIdToSave) {
            throw new Error('[BasicSystemSession] Failed to persist test image')
          }

          if (
            testImageB64.value === imageSnapshot.b64 &&
            testImageMimeType.value === imageSnapshot.mimeType &&
            !testImageAssetId.value
          ) {
            testImageAssetId.value = imageAssetIdToSave
          }
        }

        const sessionState = {
          prompt: prompt.value,
          optimizedPrompt: optimizedPrompt.value,
          reasoning: reasoning.value,
          chainId: chainId.value,
          versionId: versionId.value,
          testContent: testContent.value,
          testImageAssetId: imageAssetIdToSave,
          testImageMimeType: imageMimeTypeToSave,
          layout: layout.value,
          testVariants: testVariants.value,
          testVariantResults: testVariantResults.value,
          testVariantLastRunFingerprint: testVariantLastRunFingerprint.value,
          evaluationResults: evaluationResults.value,
          compareSnapshotRoles: compareSnapshotRoles.value,
          compareSnapshotRoleSignatures: compareSnapshotRoleSignatures.value,
          selectedOptimizeModelKey: selectedOptimizeModelKey.value,
          selectedTestModelKey: selectedTestModelKey.value,
          selectedTemplateId: selectedTemplateId.value,
          selectedIterateTemplateId: selectedIterateTemplateId.value,
          isCompareMode: isCompareMode.value,
          lastActiveAt: lastActiveAt.value,
          ...assetBindingState.persistedAssetBinding(),
        }
        await $services.preferenceService.set(BASIC_SYSTEM_SESSION_KEY, sessionState)

        if ($services.imageStorageService) {
          scheduleImageStorageGc($services.preferenceService, $services.imageStorageService)
        }
      } catch (error) {
        console.error('[BasicSystemSession] Failed to save session:', error)
      }
    })
  }

  /**
   * 从持久化存储恢复会话
   * 使用 PreferenceService（Codex 要求）
   */
  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[BasicSystemSession] PreferenceService is unavailable; cannot restore session')
      return
    }

    try {
      let shouldRepairMissingTestImage = false
      const saved = await $services.preferenceService.get<unknown>(
        BASIC_SYSTEM_SESSION_KEY,
        null
      )

      if (saved) {
        const parsed =
          typeof saved === 'string'
            ? (JSON.parse(saved) as BasicSystemSessionState)
            : (saved as BasicSystemSessionState)

        const savedTestImageAssetId = typeof parsed.testImageAssetId === 'string' && parsed.testImageAssetId.trim()
          ? parsed.testImageAssetId.trim()
          : null
        let restoredTestImageAssetId = savedTestImageAssetId
        let restoredTestImageB64: string | null = null
        let restoredTestImageMimeType = typeof parsed.testImageMimeType === 'string'
          ? parsed.testImageMimeType
          : ''

        if (savedTestImageAssetId) {
          try {
            if (!$services.imageStorageService) {
              throw new Error(
                '[BasicSystemSession] ImageStorageService is unavailable; cannot restore test image',
              )
            }

            const storedImage = await $services.imageStorageService.getImage(savedTestImageAssetId)
            if (!storedImage?.data?.trim()) {
              console.info('[BasicSystemSession] Test image asset is missing; restoring session without it')
              restoredTestImageAssetId = null
              restoredTestImageMimeType = ''
              shouldRepairMissingTestImage = true
            } else {
              restoredTestImageB64 = storedImage.data
              restoredTestImageMimeType = storedImage.metadata?.mimeType || restoredTestImageMimeType || 'image/png'
            }
          } catch (error) {
            console.warn(
              '[BasicSystemSession] Failed to restore test image; restoring text session without it:',
              error,
            )
            restoredTestImageAssetId = null
            restoredTestImageB64 = null
            restoredTestImageMimeType = ''
          }
        }

        prompt.value = parsed.prompt
        optimizedPrompt.value = parsed.optimizedPrompt
        reasoning.value = parsed.reasoning
        chainId.value = parsed.chainId
        versionId.value = parsed.versionId
        testContent.value = parsed.testContent
        testImageB64.value = restoredTestImageB64
        testImageMimeType.value = restoredTestImageAssetId ? restoredTestImageMimeType : ''
        testImageAssetId.value = restoredTestImageAssetId

        const defaultState = createDefaultState()
        const coerceVersionValue = (value: unknown): TestPanelVersionValue | null => {
          const normalizedValue = coerceTestPanelVersionValue(value)
          return normalizedValue == null ? null : normalizedValue
        }

        const legacyModelKey = typeof parsed.selectedTestModelKey === 'string' ? parsed.selectedTestModelKey : ''

        const savedVariantResults = (parsed as Partial<BasicSystemSessionState>).testVariantResults
        const savedFingerprint = (parsed as Partial<BasicSystemSessionState>).testVariantLastRunFingerprint
        const nextVariantResults: TestVariantResults = { ...defaultState.testVariantResults }
        const nextFingerprint: TestVariantLastRunFingerprint = { ...defaultState.testVariantLastRunFingerprint }

        const coerceVariantResult = (value: unknown): TestVariantResult | null => {
          if (!value || typeof value !== 'object') return null
          const v = value as { result?: unknown; reasoning?: unknown }
          if (typeof v.result !== 'string') return null
          if (typeof v.reasoning !== 'string') return null
          return { result: v.result, reasoning: v.reasoning }
        }

        const ids: TestVariantId[] = ['a', 'b', 'c', 'd']
        if (savedVariantResults && typeof savedVariantResults === 'object') {
          const obj = savedVariantResults as Record<string, unknown>
          for (const id of ids) {
            const vr = coerceVariantResult(obj[id])
            if (vr) nextVariantResults[id] = vr
          }
        }

        if (savedFingerprint && typeof savedFingerprint === 'object') {
          const obj = savedFingerprint as Record<string, unknown>
          for (const id of ids) {
            const fp = obj[id]
            if (typeof fp === 'string') nextFingerprint[id] = fp
          }
        }
        testVariantResults.value = nextVariantResults
        testVariantLastRunFingerprint.value = nextFingerprint
        compareSnapshotRoles.value = sanitizeCompareSnapshotRoles(
          (parsed as Partial<BasicSystemSessionState>).compareSnapshotRoles,
          ids
        )
        compareSnapshotRoleSignatures.value = sanitizeCompareSnapshotRoleSignatures(
          (parsed as Partial<BasicSystemSessionState>).compareSnapshotRoleSignatures,
          ids
        )

        const savedLayout = (parsed as Partial<BasicSystemSessionState>).layout
        const savedLeftRaw = savedLayout && typeof savedLayout.mainSplitLeftPct === 'number'
          ? savedLayout.mainSplitLeftPct
          : defaultState.layout.mainSplitLeftPct
        const savedLeft = Math.min(50, Math.max(25, Math.round(savedLeftRaw)))
        const savedCols = savedLayout && (savedLayout.testColumnCount === 2 || savedLayout.testColumnCount === 3 || savedLayout.testColumnCount === 4)
          ? savedLayout.testColumnCount
          : defaultState.layout.testColumnCount
        layout.value = {
          mainSplitLeftPct: savedLeft,
          testColumnCount: savedCols,
        }

        // variants
        const fromSavedVariants = (parsed as Partial<BasicSystemSessionState>).testVariants
        if (Array.isArray(fromSavedVariants) && fromSavedVariants.length) {
          const normalized: TestVariantConfig[] = defaultState.testVariants.map((d) => {
            const found = fromSavedVariants.find((v) => v?.id === d.id)
            return {
              id: d.id,
              version: coerceVersionValue(found?.version) ?? d.version,
              modelKey: typeof found?.modelKey === 'string' ? found.modelKey : legacyModelKey,
            }
          })
          testVariants.value = normalized
        } else {
          testVariants.value = defaultState.testVariants.map((v) => ({ ...v, modelKey: legacyModelKey }))
        }
        evaluationResults.value = {
          ...createDefaultEvaluationResults(),
          ...(parsed.evaluationResults && typeof parsed.evaluationResults === 'object'
            ? (parsed.evaluationResults as PersistedEvaluationResults)
            : {}),
        }
        selectedOptimizeModelKey.value = parsed.selectedOptimizeModelKey
        selectedTestModelKey.value = parsed.selectedTestModelKey
        selectedTemplateId.value = parsed.selectedTemplateId
        selectedIterateTemplateId.value = parsed.selectedIterateTemplateId
        isCompareMode.value = parsed.isCompareMode
        assetBindingState.restoreAssetBinding(parsed)
        lastActiveAt.value = Date.now()
      }

      // 兼容迁移：模板选择（从旧 TEMPLATE_SELECTION_KEYS 迁移一次）
      if (!selectedTemplateId.value) {
        const legacyTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.SYSTEM_OPTIMIZE_TEMPLATE,
          ''
        )
        if (legacyTemplateId) {
          selectedTemplateId.value = legacyTemplateId
        }
      }
      if (!selectedIterateTemplateId.value) {
        const legacyIterateTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.ITERATE_TEMPLATE,
          ''
        )
        if (legacyIterateTemplateId) {
          selectedIterateTemplateId.value = legacyIterateTemplateId
        }
      }

      if (shouldRepairMissingTestImage) {
        await saveSession()
      }
    } catch (error) {
      reset()
      console.error('[BasicSystemSession] Failed to restore session:', error)
    }
  }

  return {
    // ========== 状态（直接返回，Pinia 会自动追踪响应式）==========
    prompt,
    optimizedPrompt,
    reasoning,
    chainId,
    versionId,
    testContent,
    testImageB64,
    testImageMimeType,
    testImageAssetId,
    layout,
    testVariants,
    testVariantResults,
    testVariantLastRunFingerprint,
    evaluationResults,
    compareSnapshotRoles,
    compareSnapshotRoleSignatures,
    selectedOptimizeModelKey,
    selectedTestModelKey,
    selectedTemplateId,
    selectedIterateTemplateId,
    isCompareMode,
    lastActiveAt,
    assetBinding: assetBindingState.assetBinding,
    origin: assetBindingState.origin,

    // ========== 更新方法 ==========
    updatePrompt,
    updateOptimizedResult,
    updateTestContent,
    updateTestImage,
    updateOptimizeModel,
    updateTestModel,
    updateTemplate,
    updateIterateTemplate,
    toggleCompareMode,
    updateCompareSnapshotRoles,
    setTestColumnCount,
    setMainSplitLeftPct,
    resetTestVariantState,
    clearContent,
    updateAssetBinding: assetBindingState.updateAssetBinding,
    clearAssetBinding: assetBindingState.clearAssetBinding,
    updateTestVariant,
    reset,

    // ========== 持久化方法 ==========
    saveSession,
    restoreSession,
  }
})

export type BasicSystemSessionApi = ReturnType<typeof useBasicSystemSession>
