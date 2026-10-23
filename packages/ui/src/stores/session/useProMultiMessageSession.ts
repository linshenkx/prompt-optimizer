/**
 * Pro-MultiMessage Session Store (Pro-system，多消息模式)
 *
 * 管理 Pro 模式下 System 子模式的会话状态
 * 特点：
 * - 多轮对话消息管理
 * - 消息-历史链映射（Codex 要求使用 Record）
 * - 当前选中消息的优化结果
 */

import { defineStore } from 'pinia'
import { readSessionSnapshot, createSessionSnapshotWriter, runSessionWrite, type SessionWritePermit } from './sessionPersistence'
import { ref } from 'vue'
import { getPiniaServices } from '../../plugins/pinia'
import { TEMPLATE_SELECTION_KEYS, type ConversationMessage, type PromptAssetBinding, type PromptSessionOrigin } from '@prompt-optimizer/core'
import { coerceTestPanelVersionValue } from '../../utils/testPanelVersion'
import { isValidVariableName, sanitizeVariableRecord } from '../../types/variable'
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
 * Pro-MultiMessage 会话状态
 */
export interface ProMultiMessageSessionState {
  conversationMessagesSnapshot: ConversationMessage[]
  selectedMessageId: string
  optimizedPrompt: string
  reasoning: string
  chainId: string
  versionId: string

  /**
   * 临时变量（子模式隔离 + 持久化）
   * - pro-multi 维度持久化（刷新不丢）
   * - 不与 pro-variable / image-* 共享
   */
  temporaryVariables: Record<string, string>

  messageChainMap: Record<string, string>
  layout: ProMultiLayoutConfig
  testVariants: TestVariantConfig[]
  testVariantResults: TestVariantResults
  testVariantLastRunFingerprint: TestVariantLastRunFingerprint
  evaluationResults: PersistedEvaluationResults
  compareSnapshotRoles: PersistedCompareSnapshotRoles<TestVariantId>
  compareSnapshotRoleSignatures: PersistedCompareSnapshotRoleSignatures<TestVariantId>
  selectedOptimizeModelKey: string
  selectedTestModelKey: string
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null
  isCompareMode: boolean
  lastActiveAt: number
  assetBinding?: PromptAssetBinding
  origin?: PromptSessionOrigin
}

/**
 * pro-multi 测试面板的版本选择（针对“当前选中消息”）：
 * - 0: v0（原始消息内容）
 * - >=1: v1..vn（历史链版本号）
 * - 'workspace': 下方工作区当前内容（未保存草稿也算）
 * - 'previous': 动态指向最近保存版本的上一版
 */
export type TestPanelVersionValue = 'workspace' | 'previous' | 0 | number

export type TestVariantId = 'a' | 'b' | 'c' | 'd'

export type TestColumnCount = 2 | 3 | 4

export interface ProMultiLayoutConfig {
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
  /** Resolved prompt sent for this answer, independent of later edits. */
  requestPrompt?: string
  result: string
  reasoning: string
}

export type TestVariantResults = Record<TestVariantId, TestVariantResult>

export type TestVariantLastRunFingerprint = Record<TestVariantId, string>

/**
 * 默认状态
 */
const createDefaultState = (): ProMultiMessageSessionState => ({
  conversationMessagesSnapshot: [],
  selectedMessageId: '',
  optimizedPrompt: '',
  reasoning: '',
  chainId: '',
  versionId: '',
  temporaryVariables: {},
  messageChainMap: {},
  // v2: 多列测试（最多 4 列）
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

export const useProMultiMessageSession = defineStore('proMultiMessageSession', () => {
  // ========== 状态定义（使用独立 ref，而非包装在 state 对象中）==========

  // 对话消息快照（仅用于恢复）
  const conversationMessagesSnapshot = ref<ConversationMessage[]>([])

  // 当前选中的消息ID
  const selectedMessageId = ref('')

  // 当前消息的优化结果
  const optimizedPrompt = ref('')

  // 🔧 Codex 修复：添加 reasoning 字段，与其他 session store 保持一致
  const reasoning = ref('')

  // 历史相关（只存 ID）
  const chainId = ref('')
  const versionId = ref('')

  // 消息-历史链映射（Codex 要求：Map 改 Record）
  const messageChainMap = ref<Record<string, string>>({})

  // 临时变量（子模式隔离 + 持久化）
  const temporaryVariables = ref<Record<string, string>>({})

  // 多列测试（最多 4 列）
  const layout = ref<ProMultiLayoutConfig>({ mainSplitLeftPct: 50, testColumnCount: 2 })
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

  // 模型和模板选择（只存 ID/key）
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
   * 更新对话消息快照
   */
  const updateConversationMessages = (messages: ConversationMessage[]) => {
    conversationMessagesSnapshot.value = messages
    lastActiveAt.value = Date.now()
  }

  /**
   * 选择消息
   */
  const selectMessage = (messageId: string) => {
    selectedMessageId.value = messageId
    lastActiveAt.value = Date.now()
  }

  /**
   * 更新优化结果
   * 🔧 Codex 修复：添加 reasoning 字段支持
   */
  const updateOptimizedResult = (payload: {
    optimizedPrompt: string
    reasoning: string
    chainId: string
    versionId: string
  }) => {
    const nextOptimizedPrompt = payload.optimizedPrompt
    const nextReasoning = payload.reasoning
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
   * 更新消息-历史链映射
   */
  const updateMessageChainMap = (messageId: string, chainId: string) => {
    messageChainMap.value[messageId] = chainId
    lastActiveAt.value = Date.now()
  }

  /**
   * 批量更新消息-历史链映射
   */
  const setMessageChainMap = (map: Record<string, string>) => {
    messageChainMap.value = { ...map }
    lastActiveAt.value = Date.now()
  }

  /**
   * 移除消息的历史链映射
   */
  const removeMessageChainMapping = (messageId: string) => {
    delete messageChainMap.value[messageId]
    lastActiveAt.value = Date.now()
  }

  // 临时变量（持久化到 session）
  const setTemporaryVariable = (name: string, value: string) => {
    if (!isValidVariableName(name)) {
      console.warn('[ProMultiMessageSession] Ignoring invalid temporary variable name:', name)
      return
    }
    temporaryVariables.value[name] = value
    lastActiveAt.value = Date.now()
    void saveSession()
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
    void saveSession()
  }

  const clearTemporaryVariables = () => {
    temporaryVariables.value = {}
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

  const setTestColumnCount = (count: TestColumnCount) => {
    if (layout.value.testColumnCount === count) return
    layout.value = { ...layout.value, testColumnCount: count }
    lastActiveAt.value = Date.now()
    saveSession()
  }

  const setMainSplitLeftPct = (pct: number) => {
    const clamped = Math.min(50, Math.max(25, Math.round(pct)))
    if (layout.value.mainSplitLeftPct === clamped) return
    layout.value = { ...layout.value, mainSplitLeftPct: clamped }
    lastActiveAt.value = Date.now()
    saveSession()
  }

  const updateTestVariant = (id: TestVariantId, patch: Partial<Omit<TestVariantConfig, 'id'>>) => {
    const idx = testVariants.value.findIndex((v) => v.id === id)
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

  const resetTestVariantState = () => {
    const defaultState = createDefaultState()
    testVariantResults.value = defaultState.testVariantResults
    testVariantLastRunFingerprint.value = defaultState.testVariantLastRunFingerprint
    lastActiveAt.value = Date.now()
  }

  const clearContent = (options: { persist?: boolean } = {}) => {
    const defaultState = createDefaultState()
    conversationMessagesSnapshot.value = defaultState.conversationMessagesSnapshot
    selectedMessageId.value = defaultState.selectedMessageId
    optimizedPrompt.value = defaultState.optimizedPrompt
    reasoning.value = defaultState.reasoning
    chainId.value = defaultState.chainId
    versionId.value = defaultState.versionId
    temporaryVariables.value = defaultState.temporaryVariables
    messageChainMap.value = defaultState.messageChainMap
    testVariantResults.value = defaultState.testVariantResults
    testVariantLastRunFingerprint.value = defaultState.testVariantLastRunFingerprint
    evaluationResults.value = defaultState.evaluationResults
    compareSnapshotRoles.value = defaultState.compareSnapshotRoles
    compareSnapshotRoleSignatures.value = defaultState.compareSnapshotRoleSignatures
    assetBindingState.clearAssetBindingWithoutPersist()
    lastActiveAt.value = Date.now()
    if (options.persist !== false) {
      void saveSession().catch((error) => {
        console.error('[ProMultiMessageSession] Failed to persist cleared content:', error)
      })
    }
  }

  /**
   * 重置状态
   */
  const reset = () => {
    const defaultState = createDefaultState()
    conversationMessagesSnapshot.value = defaultState.conversationMessagesSnapshot
    selectedMessageId.value = defaultState.selectedMessageId
    optimizedPrompt.value = defaultState.optimizedPrompt
    reasoning.value = defaultState.reasoning
    chainId.value = defaultState.chainId
    versionId.value = defaultState.versionId
    temporaryVariables.value = defaultState.temporaryVariables
    messageChainMap.value = defaultState.messageChainMap
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
    lastActiveAt.value = defaultState.lastActiveAt
  }

  /**
   * 保存会话
   */
  const sessionSnapshot = createSessionSnapshotWriter(() => sessionContent)

  const saveSession = (permit?: SessionWritePermit): Promise<boolean> =>
    runSessionWrite(getPiniaServices()?.preferenceService, persistSession, permit)

  const persistSession = async (): Promise<boolean> => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[ProMultiMessageSession] PreferenceService is unavailable; cannot save session')
      return false
    }

    try {
      // 构建完整的会话状态对象用于序列化
      const sessionState = {
        conversationMessagesSnapshot: conversationMessagesSnapshot.value,
        selectedMessageId: selectedMessageId.value,
        optimizedPrompt: optimizedPrompt.value,
        reasoning: reasoning.value,
        chainId: chainId.value,
        versionId: versionId.value,
        temporaryVariables: sanitizeVariableRecord(temporaryVariables.value),
        messageChainMap: messageChainMap.value,
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
        'session/v1/pro-multi',
        sessionState
      )
      return true
    } catch (error) {
      console.error('[ProMultiMessageSession] Failed to save session:', error)
      return false
    }
  }

  /**
   * 恢复会话
   */
  const restoreSession = async () => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[ProMultiMessageSession] PreferenceService is unavailable; cannot restore session')
      return
    }

    try {
      const saved = await readSessionSnapshot<unknown>($services.preferenceService,
        'session/v1/pro-multi',
        null
      )

      if (saved) {
        const parsed =
          typeof saved === 'string'
            ? (JSON.parse(saved) as Record<string, unknown>)
            : (saved as Record<string, unknown>)
        conversationMessagesSnapshot.value = Array.isArray(parsed.conversationMessagesSnapshot)
          ? (parsed.conversationMessagesSnapshot as ConversationMessage[])
          : []
        selectedMessageId.value = typeof parsed.selectedMessageId === 'string' ? parsed.selectedMessageId : ''
        optimizedPrompt.value = typeof parsed.optimizedPrompt === 'string' ? parsed.optimizedPrompt : ''
        reasoning.value = typeof parsed.reasoning === 'string' ? parsed.reasoning : ''
        chainId.value = typeof parsed.chainId === 'string' ? parsed.chainId : ''
        versionId.value = typeof parsed.versionId === 'string' ? parsed.versionId : ''

        temporaryVariables.value = sanitizeVariableRecord(parsed.temporaryVariables)
        messageChainMap.value = (parsed.messageChainMap && typeof parsed.messageChainMap === 'object')
          ? (parsed.messageChainMap as Record<string, string>)
          : {}

        // ==================== v2: 多列 variants ====================
        // 默认状态
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
            return coerceTestPanelVersionValue(v) ?? 'workspace'
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

          testVariants.value = defaultState.testVariants.map((v) => {
            const restored = byId.get(v.id)
            return restored ? restored : v
          })
        } else {
          testVariants.value = defaultState.testVariants
        }

        // testVariantResults
        const rawVariantResults = parsed.testVariantResults
        if (rawVariantResults && typeof rawVariantResults === 'object') {
          const resultRecord = rawVariantResults as Record<string, unknown>
          const pick = (id: TestVariantId) => {
            const one = resultRecord[id]
            if (!one || typeof one !== 'object') return defaultState.testVariantResults[id]
            const oneRecord = one as Record<string, unknown>
            const r = typeof oneRecord['result'] === 'string' ? (oneRecord['result'] as string) : ''
            const reasoning = typeof oneRecord['reasoning'] === 'string' ? (oneRecord['reasoning'] as string) : ''
            return { result: r, reasoning, ...(typeof oneRecord['requestPrompt'] === 'string' ? { requestPrompt: oneRecord['requestPrompt'] } : {}) }
          }

          testVariantResults.value = {
            a: pick('a'),
            b: pick('b'),
            c: pick('c'),
            d: pick('d'),
          }
        } else {
          testVariantResults.value = defaultState.testVariantResults
        }

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

        evaluationResults.value = {
          ...createDefaultEvaluationResults(),
          ...(parsed.evaluationResults && typeof parsed.evaluationResults === 'object'
            ? (parsed.evaluationResults as PersistedEvaluationResults)
            : {}),
        }
        compareSnapshotRoles.value = sanitizeCompareSnapshotRoles(
          (parsed as Partial<ProMultiMessageSessionState>).compareSnapshotRoles,
          ['a', 'b', 'c', 'd']
        )
        compareSnapshotRoleSignatures.value = sanitizeCompareSnapshotRoleSignatures(
          (parsed as Partial<ProMultiMessageSessionState>).compareSnapshotRoleSignatures,
          ['a', 'b', 'c', 'd']
        )
        selectedOptimizeModelKey.value = typeof parsed.selectedOptimizeModelKey === 'string' ? parsed.selectedOptimizeModelKey : ''
        selectedTestModelKey.value = typeof parsed.selectedTestModelKey === 'string' ? parsed.selectedTestModelKey : ''
        selectedTemplateId.value = typeof parsed.selectedTemplateId === 'string' ? parsed.selectedTemplateId : null
        selectedIterateTemplateId.value = typeof parsed.selectedIterateTemplateId === 'string' ? parsed.selectedIterateTemplateId : null
        isCompareMode.value = typeof parsed.isCompareMode === 'boolean' ? parsed.isCompareMode : true
        assetBindingState.restoreAssetBinding(parsed)
        lastActiveAt.value = Date.now()

        // 如果 variants 的 modelKey 为空，尝试用 legacy selectedTestModelKey 填充一次
        const seedModelKey = selectedTestModelKey.value
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

      // 兼容迁移：模板选择（从旧 TEMPLATE_SELECTION_KEYS 迁移一次）
      if (!selectedTemplateId.value) {
        const legacyTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.CONTEXT_SYSTEM_OPTIMIZE_TEMPLATE,
          ''
        )
        if (legacyTemplateId) {
          selectedTemplateId.value = legacyTemplateId
        }
      }
      if (!selectedIterateTemplateId.value) {
        const legacyIterateTemplateId = await $services.preferenceService.get(
          TEMPLATE_SELECTION_KEYS.CONTEXT_ITERATE_TEMPLATE,
          ''
        )
        if (legacyIterateTemplateId) {
          selectedIterateTemplateId.value = legacyIterateTemplateId
        }
      }
      sessionSnapshot.restored($services.preferenceService, 'session/v1/pro-multi')
    } catch (error) {
      console.error('[ProMultiMessageSession] Failed to restore session:', error)
      reset()
    }
  }

  const sessionContent = {
    // ========== 状态（直接返回，Pinia 会自动追踪响应式）==========
    conversationMessagesSnapshot,
    selectedMessageId,
    optimizedPrompt,
    reasoning,
    chainId,
    versionId,
    temporaryVariables,
    messageChainMap,
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
    updateConversationMessages,
    selectMessage,
    updateOptimizedResult,
    updateMessageChainMap,
    setMessageChainMap,
    removeMessageChainMapping,

    setTemporaryVariable,
    getTemporaryVariable,
    deleteTemporaryVariable,
    clearTemporaryVariables,
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

export type ProMultiMessageSessionApi = ReturnType<typeof useProMultiMessageSession>
