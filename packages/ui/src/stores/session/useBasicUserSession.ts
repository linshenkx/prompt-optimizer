/**
 * Basic-User Session Store
 *
 * 管理 Basic 模式下 User 子模式的会话状态
 * 结构与 BasicSystemSession 相同
 */

import { defineStore } from 'pinia'
import { readSessionSnapshot, createSessionSnapshotWriter, runSessionWrite, type SessionWritePermit } from './sessionPersistence'
import { ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import { TEMPLATE_SELECTION_KEYS, type PromptAssetBinding, type PromptSessionOrigin } from '@prompt-optimizer/core'
import { coerceTestPanelVersionValue } from '../../utils/testPanelVersion'
import { createSessionAssetBindingState } from './sessionAssetBinding'
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
 * basic-user 测试面板的版本选择：
 * - 'workspace': 下方工作区当前内容（未保存草稿也算）
 * - 'previous': 动态指向最近保存版本的上一版
 * - 0: v0（原始提示词）
 * - >=1: v1..vn（历史链版本号）
 */
export type TestPanelVersionValue = 'workspace' | 'previous' | 0 | number

export type TestVariantId = 'a' | 'b' | 'c' | 'd'

export type TestColumnCount = 2 | 3 | 4

export interface TestVariantResult {
  /** Resolved prompt sent for this answer, independent of later edits. */
  requestPrompt?: string
  result: string
  reasoning: string
}

export type TestVariantResults = Record<TestVariantId, TestVariantResult>

export type TestVariantLastRunFingerprint = Record<TestVariantId, string>

export interface TestVariantConfig {
  id: TestVariantId
  version: TestPanelVersionValue
  modelKey: string
}

export interface BasicUserLayoutConfig {
  /** main split: left pane width percent (25..50) */
  mainSplitLeftPct: number

  /** test area: visible result columns */
  testColumnCount: TestColumnCount
}

/**
 * Basic-User 会话状态
 */
export interface BasicUserSessionState {
  // 提示词相关
  prompt: string
  optimizedPrompt: string
  reasoning: string

  // 历史相关（只存 ID）
  chainId: string
  versionId: string

  // 测试区域内容
  testContent: string

  // 测试布局与列配置（basic-user 专用：最多 4 列）
  layout: BasicUserLayoutConfig
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
const createDefaultState = (): BasicUserSessionState => ({
  prompt: '',
  optimizedPrompt: '',
  reasoning: '',
  chainId: '',
  versionId: '',
  testContent: '',
  layout: {
    mainSplitLeftPct: 50,
    testColumnCount: 2,
  },
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

export const useBasicUserSession = defineStore('basicUserSession', () => {
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

  // 测试布局与列配置
  const layout = ref<BasicUserLayoutConfig>({
    mainSplitLeftPct: 50,
    testColumnCount: 2,
  })

  const testVariants = ref<TestVariantConfig[]>([
    { id: 'a', version: 0, modelKey: '' },
    { id: 'b', version: 'workspace', modelKey: '' },
    { id: 'c', version: 'workspace', modelKey: '' },
    { id: 'd', version: 'workspace', modelKey: '' },
  ])

  // 测试结果（按列持久化）
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
    testVariantResults.value = defaultState.testVariantResults
    testVariantLastRunFingerprint.value = defaultState.testVariantLastRunFingerprint
    evaluationResults.value = defaultState.evaluationResults
    compareSnapshotRoles.value = defaultState.compareSnapshotRoles
    compareSnapshotRoleSignatures.value = defaultState.compareSnapshotRoleSignatures
    assetBindingState.clearAssetBindingWithoutPersist()
    lastActiveAt.value = Date.now()
    if (options.persist !== false) {
      void saveSession().catch((error) => {
        console.error('[BasicUserSession] Failed to persist cleared content:', error)
      })
    }
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
  const sessionSnapshot = createSessionSnapshotWriter(() => sessionContent)

  const saveSession = (permit?: SessionWritePermit): Promise<boolean> =>
    runSessionWrite(getPiniaServices()?.preferenceService, persistSession, permit)

  const persistSession = async (): Promise<boolean> => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[BasicUserSession] PreferenceService is unavailable; cannot save session')
      return false
    }

    try {
      const sessionState = {
        prompt: prompt.value,
        optimizedPrompt: optimizedPrompt.value,
        reasoning: reasoning.value,
        chainId: chainId.value,
        versionId: versionId.value,
        testContent: testContent.value,
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
      await sessionSnapshot.write($services.preferenceService,
        'session/v1/basic-user',
        sessionState
      )
      return true
    } catch (error) {
      console.error('[BasicUserSession] Failed to save session:', error)
      return false
    }
  }

  /**
   * 从持久化存储恢复会话
   * 使用 PreferenceService（Codex 要求）
   */
  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[BasicUserSession] PreferenceService is unavailable; cannot restore session')
      return
    }

    try {
      const saved = await readSessionSnapshot<unknown>($services.preferenceService,
        'session/v1/basic-user',
        null
      )

      if (saved) {
        const parsed =
          typeof saved === 'string'
            ? (JSON.parse(saved) as BasicUserSessionState)
            : (saved as BasicUserSessionState)
        prompt.value = parsed.prompt
        optimizedPrompt.value = parsed.optimizedPrompt
        reasoning.value = parsed.reasoning
        chainId.value = parsed.chainId
        versionId.value = parsed.versionId
        testContent.value = parsed.testContent

        const defaultState = createDefaultState()
        const coerceVersionValue = (value: unknown): TestPanelVersionValue | null => {
          const normalizedValue = coerceTestPanelVersionValue(value)
          return normalizedValue == null ? null : normalizedValue
        }

        const legacyModelKey = typeof parsed.selectedTestModelKey === 'string' ? parsed.selectedTestModelKey : ''

        const savedVariantResults = (parsed as Partial<BasicUserSessionState>).testVariantResults
        const savedFingerprint = (parsed as Partial<BasicUserSessionState>).testVariantLastRunFingerprint
        const nextVariantResults: TestVariantResults = { ...defaultState.testVariantResults }
        const nextFingerprint: TestVariantLastRunFingerprint = { ...defaultState.testVariantLastRunFingerprint }

        const coerceVariantResult = (value: unknown): TestVariantResult | null => {
          if (!value || typeof value !== 'object') return null
          const v = value as { result?: unknown; reasoning?: unknown; requestPrompt?: unknown }
          if (typeof v.result !== 'string') return null
          if (typeof v.reasoning !== 'string') return null
          return { result: v.result, reasoning: v.reasoning, ...(typeof v.requestPrompt === 'string' ? { requestPrompt: v.requestPrompt } : {}) }
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

        const savedLayout = (parsed as Partial<BasicUserSessionState>).layout
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

        const fromSavedVariants = (parsed as Partial<BasicUserSessionState>).testVariants
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
          testVariants.value = defaultState.testVariants.map((variant) => ({
            ...variant,
            modelKey: legacyModelKey,
          }))
        }
        evaluationResults.value = {
          ...createDefaultEvaluationResults(),
          ...(parsed.evaluationResults && typeof parsed.evaluationResults === 'object'
            ? (parsed.evaluationResults as PersistedEvaluationResults)
            : {}),
        }
        compareSnapshotRoles.value = sanitizeCompareSnapshotRoles(
          (parsed as Partial<BasicUserSessionState>).compareSnapshotRoles,
          ids
        )
        compareSnapshotRoleSignatures.value = sanitizeCompareSnapshotRoleSignatures(
          (parsed as Partial<BasicUserSessionState>).compareSnapshotRoleSignatures,
          ids
        )
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
          TEMPLATE_SELECTION_KEYS.USER_OPTIMIZE_TEMPLATE,
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
      sessionSnapshot.restored($services.preferenceService, 'session/v1/basic-user')
    } catch (error) {
      console.error('[BasicUserSession] Failed to restore session:', error)
      // 恢复失败时保持当前状态或重置为默认
      reset()
    }
  }

  const sessionContent = {
    // ========== 状态（直接返回，Pinia 会自动追踪响应式）==========
    prompt,
    optimizedPrompt,
    reasoning,
    chainId,
    versionId,
    testContent,
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

  }

  return {
    ...sessionContent,
    // ========== 更新方法 ==========
    updatePrompt,
    updateOptimizedResult,
    updateTestContent,
    setTestColumnCount,
    setMainSplitLeftPct,
    resetTestVariantState,
    clearContent,
    updateAssetBinding: assetBindingState.updateAssetBinding,
    clearAssetBinding: assetBindingState.clearAssetBinding,
    updateTestVariant,
    updateOptimizeModel,
    updateTestModel,
    updateTemplate,
    updateIterateTemplate,
    toggleCompareMode,
    updateCompareSnapshotRoles,
    reset,

    // ========== 持久化方法 ==========
    saveSession,
    restoreSession,
  }
})

export type BasicUserSessionApi = ReturnType<typeof useBasicUserSession>
