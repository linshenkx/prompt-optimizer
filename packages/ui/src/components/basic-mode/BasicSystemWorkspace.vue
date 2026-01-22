<template>
    <div
        class="basic-system-workspace"
        data-testid="workspace"
        data-mode="basic-system"
    >
        <NFlex
            justify="space-between"
            :style="{
                display: 'flex',
                flexDirection: 'row',
                width: '100%',
                height: '100%',
                maxHeight: '100%',
                flex: 1,
                minHeight: 0,
                gap: '16px',
                overflow: 'hidden',
            }"
        >
            <!-- 左侧：优化区域 -->
            <NFlex
                vertical
                :style="{ flex: 1, overflow: 'auto', height: '100%', minHeight: 0 }"
                size="medium"
            >
                <!-- 输入控制区域（可折叠） -->
                <NCard :style="{ flexShrink: 0 }">
                    <!-- 折叠态：只显示标题栏 -->
                    <NFlex
                        v-if="isInputPanelCollapsed"
                        justify="space-between"
                        align="center"
                    >
                        <NFlex align="center" :size="8">
                            <NText :depth="1" style="font-size: 18px; font-weight: 500">
                                {{ t('promptOptimizer.originalPrompt') }}
                            </NText>
                            <NText
                                v-if="promptModel"
                                depth="3"
                                style="font-size: 12px;"
                            >
                                {{ promptSummary }}
                            </NText>
                        </NFlex>
                        <NButton
                            type="tertiary"
                            size="small"
                            ghost
                            round
                            @click="isInputPanelCollapsed = false"
                            :title="t('common.expand')"
                        >
                            <template #icon>
                                <NIcon>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </NIcon>
                            </template>
                        </NButton>
                    </NFlex>

                    <!-- 展开态：完整输入面板 -->
                    <InputPanelUI
                        v-else
                        v-model="promptModel"
                        :selected-model="selectedOptimizeModelKeyModel"
                        test-id-prefix="basic-system"
                        :label="t('promptOptimizer.originalPrompt')"
                        :placeholder="t('promptOptimizer.placeholder')"
                        :model-label="t('promptOptimizer.optimizeModel')"
                        :template-label="t('promptOptimizer.templateLabel')"
                        :button-text="t('promptOptimizer.optimize')"
                        :loading-text="t('common.loading')"
                        :loading="unwrappedLogicProps.isOptimizing"
                        :disabled="unwrappedLogicProps.isOptimizing"
                        :show-preview="false"
                        :show-analyze-button="true"
                        :analyze-loading="analyzing"
                        @submit="logic.handleOptimize"
                        @analyze="handleAnalyze"
                        @configModel="handleOpenModelManager"
                        @open-preview="handleOpenInputPreview"
                    >
                        <!-- 模型选择 -->
                        <template #model-select>
                            <SelectWithConfig
                                v-model="selectedOptimizeModelKeyModel"
                                :options="modelSelection.textModelOptions"
                                :getPrimary="OptionAccessors.getPrimary"
                                :getSecondary="OptionAccessors.getSecondary"
                                :getValue="OptionAccessors.getValue"
                                @config="handleOpenModelManager"
                            />
                        </template>

                        <!-- 模板选择 -->
                        <template #template-select>
                            <SelectWithConfig
                                v-model="selectedTemplateIdModel"
                                :options="templateSelection.templateOptions"
                                :getPrimary="OptionAccessors.getPrimary"
                                :getSecondary="OptionAccessors.getSecondary"
                                :getValue="OptionAccessors.getValue"
                                @config="() => handleOpenTemplateManager('optimize')"
                            />
                        </template>

                        <!-- 标题栏折叠按钮 -->
                        <template #header-extra>
                            <NButton
                                type="tertiary"
                                size="small"
                                ghost
                                round
                                @click="isInputPanelCollapsed = true"
                                :title="t('common.collapse')"
                            >
                                <template #icon>
                                    <NIcon>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
                                        </svg>
                                    </NIcon>
                                </template>
                            </NButton>
                        </template>
                    </InputPanelUI>
                </NCard>

                <!-- 优化工作区 -->
                <NCard
                    :style="{ flex: 1, minHeight: '200px', overflow: 'hidden' }"
                    content-style="height: 100%; max-height: 100%; overflow: hidden;"
                >
                    <PromptPanelUI
                        test-id="basic-system"
                        ref="promptPanelRef"
                        v-model:optimized-prompt="optimizedPromptModel"
                        :reasoning="unwrappedLogicProps.optimizedReasoning"
                        :original-prompt="promptModel"
                        :is-optimizing="unwrappedLogicProps.isOptimizing"
                        :is-iterating="unwrappedLogicProps.isIterating"
                        v-model:selected-iterate-template="selectedIterateTemplate"
                        :versions="unwrappedLogicProps.currentVersions"
                        :current-version-id="unwrappedLogicProps.currentVersionId"
                        optimization-mode="system"
                        :advanced-mode-enabled="false"
                        :show-preview="false"
                        @iterate="handleIterate"
                        @openTemplateManager="handleOpenTemplateManager"
                        @switchVersion="logic.handleSwitchVersion"
                        @save-favorite="handleSaveFavorite"
                        @open-preview="handleOpenPromptPreview"
                        @apply-improvement="handleApplyImprovement"
                        @apply-patch="handleApplyPatch"
                        @save-local-edit="handleSaveLocalEdit"
                    />
                </NCard>
            </NFlex>

            <!-- 右侧：测试区域 -->
            <TestAreaPanel
                ref="testAreaPanelRef"
                :style="{ flex: 1, overflow: 'auto', height: '100%', minHeight: 0 }"
                test-id-prefix="basic-system"
                optimization-mode="system"
                :model-provider="selectedTestModelInfo.provider"
                :model-name="selectedTestModelInfo.model ?? undefined"
                :optimized-prompt="optimizedPromptModel"
                :is-test-running="unwrappedLogicProps.isTestingOriginal || unwrappedLogicProps.isTestingOptimized"
                :global-variables="globalVariables"
                :predefined-variables="predefinedVariables"
                v-model:testContent="testContentModel"
                v-model:isCompareMode="isCompareMode"
                :enable-compare-mode="true"
                :enable-fullscreen="true"
                :input-mode="inputMode"
                :control-bar-layout="controlBarLayout"
                :button-size="buttonSize"
                :conversation-max-height="conversationMaxHeight"
                :show-original-result="true"
                :result-vertical-layout="resultVerticalLayout"
                :show-evaluation="true"
                :has-original-result="hasOriginalResult"
                :has-optimized-result="hasOptimizedResult"
                :is-evaluating-original="isEvaluatingOriginal"
                :is-evaluating-optimized="isEvaluatingOptimized"
                :original-score="originalScore"
                :optimized-score="optimizedScore"
                :has-original-evaluation="hasOriginalEvaluation"
                :has-optimized-evaluation="hasOptimizedEvaluation"
                :original-evaluation-result="originalEvaluationResult"
                :optimized-evaluation-result="optimizedEvaluationResult"
                :original-score-level="originalScoreLevel"
                :optimized-score-level="optimizedScoreLevel"
                @test="logic.handleTest"
                @open-variable-manager="handleOpenVariableManager"
                @evaluate-original="() => handleEvaluate('original')"
                @evaluate-optimized="() => handleEvaluate('optimized')"
                @show-original-detail="() => showDetail('original')"
                @show-optimized-detail="() => showDetail('optimized')"
                @apply-improvement="handleApplyImprovement"
                @apply-patch="handleApplyPatch"
            >
                <template #model-select>
                    <SelectWithConfig
                        v-model="selectedTestModelKeyModel"
                        :options="modelSelection.textModelOptions"
                        :getPrimary="OptionAccessors.getPrimary"
                        :getSecondary="OptionAccessors.getSecondary"
                        :getValue="OptionAccessors.getValue"
                        @config="handleOpenModelManager"
                    />
                </template>

                <template #original-result>
                    <OutputDisplay
                        :test-id="'basic-system-test-original-output'"
                        :content="unwrappedLogicProps.testResultsOriginalResult"
                        :reasoning="unwrappedLogicProps.testResultsOriginalReasoning"
                        :streaming="unwrappedLogicProps.isTestingOriginal"
                        :enableDiff="false"
                        mode="readonly"
                        :style="{ height: '100%', minHeight: '0' }"
                    />
                </template>

                <template #optimized-result>
                    <OutputDisplay
                        :test-id="'basic-system-test-optimized-output'"
                        :content="unwrappedLogicProps.testResultsOptimizedResult"
                        :reasoning="unwrappedLogicProps.testResultsOptimizedReasoning"
                        :streaming="unwrappedLogicProps.isTestingOptimized"
                        :enableDiff="false"
                        mode="readonly"
                        :style="{ height: '100%', minHeight: '0' }"
                    />
                </template>

                <template #single-result>
                    <OutputDisplay
                        :content="unwrappedLogicProps.testResultsOptimizedResult"
                        :reasoning="unwrappedLogicProps.testResultsOptimizedReasoning"
                        :streaming="unwrappedLogicProps.isTestingOptimized"
                        :enableDiff="false"
                        mode="readonly"
                        :style="{ height: '100%', minHeight: '0' }"
                    />
                </template>

                <template #custom-actions>
                    <template v-if="isCompareMode && unwrappedLogicProps.testResultsOriginalResult && unwrappedLogicProps.testResultsOptimizedResult">
                        <EvaluationScoreBadge
                            v-if="hasCompareEvaluation || isEvaluatingCompare"
                            :score="compareScore"
                            :level="compareScoreLevel"
                            :loading="isEvaluatingCompare"
                            :result="compareEvaluationResult"
                            type="compare"
                            size="small"
                            @show-detail="() => showDetail('compare')"
                            @apply-improvement="handleApplyImprovement"
                            @apply-patch="handleApplyPatch"
                        />
                        <NButton
                            v-else
                            quaternary
                            size="small"
                            @click="() => handleEvaluate('compare')"
                        >
                            {{ t('evaluation.compareEvaluate') }}
                        </NButton>
                    </template>
                </template>
            </TestAreaPanel>
        </NFlex>

        <EvaluationPanel
            v-model:show="evaluation.isPanelVisible.value"
            :is-evaluating="panelProps.isEvaluating"
            :result="panelProps.result"
            :stream-content="panelProps.streamContent"
            :error="panelProps.error"
            :current-type="panelProps.currentType"
            :score-level="panelProps.scoreLevel"
            @re-evaluate="evaluationHandler.handleReEvaluate"
            @apply-local-patch="handleApplyPatch"
            @apply-improvement="handleApplyImprovement"
            @clear="handleClearEvaluation"
            @retry="evaluationHandler.handleReEvaluate"
        />
    </div>
</template>

<script setup lang="ts">
/**
 * BasicSystemWorkspace - Basic 模式 System 子模式工作区
 *
 * 职责：
 * - 直接使用 useBasicSystemSession 作为状态源
 * - 使用 useBasicWorkspaceLogic 处理业务逻辑
 * - 使用 useWorkspaceModelSelection 管理模型选择
 * - 使用 useWorkspaceTemplateSelection 管理模板选择
 * - 使用 useEvaluationHandler 处理评估功能
 * - 内联基础模式工作区布局（与 BasicUserWorkspace 保持一致）
 */
 import { ref, computed, toRef, inject, onMounted, onUnmounted, watch, nextTick, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '../../composables/ui/useToast'
import { useBasicSystemSession } from '../../stores/session/useBasicSystemSession'
import { useBasicWorkspaceLogic } from '../../composables/workspaces/useBasicWorkspaceLogic'
import { useWorkspaceModelSelection } from '../../composables/workspaces/useWorkspaceModelSelection'
import { useWorkspaceTemplateSelection } from '../../composables/workspaces/useWorkspaceTemplateSelection'
import { useEvaluationHandler } from '../../composables/prompt/useEvaluationHandler'
import { provideEvaluation } from '../../composables/prompt/useEvaluationContext'
import { NButton, NCard, NFlex, NIcon, NText } from 'naive-ui'
import InputPanelUI from '../InputPanel.vue'
import PromptPanelUI from '../PromptPanel.vue'
import TestAreaPanel from '../TestAreaPanel.vue'
import OutputDisplay from '../OutputDisplay.vue'
import { EvaluationPanel, EvaluationScoreBadge } from '../evaluation'
import SelectWithConfig from '../SelectWithConfig.vue'
import { OptionAccessors } from '../../utils/data-transformer'
import type { AppServices } from '../../types/services'
import type { IteratePayload } from '../../types/workspace'
import { applyPatchOperationsToText, type PatchOperation, type Template } from '@prompt-optimizer/core'
import type { TestAreaPanelInstance } from '../types/test-area'

const { t } = useI18n()
const toast = useToast()

// 服务注入
const injectedServices = inject<Ref<AppServices | null>>('services')
const services = injectedServices ?? ref<AppServices | null>(null)
const appOpenModelManager = inject<((tab?: 'text' | 'image' | 'function') => void) | null>('openModelManager', null)
const appOpenTemplateManager = inject<((type?: string) => void) | null>('openTemplateManager', null)

// Session store（单一真源）
const session = useBasicSystemSession()

// 业务逻辑
const logic = useBasicWorkspaceLogic({
  services,
  sessionStore: session,
  optimizationMode: 'system',
  promptRecordType: 'optimize',
  onOptimizeComplete: (_chain) => {
    // 发送历史刷新事件
    window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
  },
  onIterateComplete: (_chain) => {
    window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
  },
  onLocalEditComplete: (_chain) => {
    window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
  }
})

// 模型选择
const modelSelection = useWorkspaceModelSelection(services, session)

// 模板选择（templateType: 'optimize', iterateTemplateType: 'iterate'）
const templateSelection = useWorkspaceTemplateSelection(
  services,
  session,
  'optimize',
  'iterate'
)

// 迭代模板（从 session 派生，持久化）
const selectedIterateTemplate = computed<Template | null>({
  get: () => templateSelection.selectedIterateTemplate.value,
  set: (value) => {
    templateSelection.selectedIterateTemplateId.value = value?.id ?? ''
    templateSelection.selectedIterateTemplate.value = value ?? null
  }
})

// 对比模式（从 session store 读取）
const isCompareMode = computed<boolean>({
  get: () => !!session.isCompareMode,
  set: (value) => session.toggleCompareMode(!!value)
})

// 派生状态
// ✅ 修复：处理 testResults 可能为 null 的情况
const hasOriginalResult = computed(() => !!logic.testResults.value?.originalResult)
const hasOptimizedResult = computed(() => !!logic.testResults.value?.optimizedResult)

// 组件引用（用于触发迭代对话框、刷新迭代下拉等）
type PromptPanelExpose = {
  openIterateDialog?: (initialContent?: string) => void
  refreshIterateTemplateSelect?: () => void
} | null
const promptPanelRef = ref<PromptPanelExpose>(null)
const testAreaPanelRef = ref<TestAreaPanelInstance | null>(null)

// 输入区折叠状态（初始展开）
const isInputPanelCollapsed = ref(false)

// 提示词摘要（折叠态显示）
const promptSummary = computed(() => {
  const prompt = logic.prompt.value
  if (!prompt) return ''
  return prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt
})

// 分析评估（prompt-only）：收起输入区后触发评估
const handleAnalyze = async () => {
  if (!logic.prompt.value?.trim()) return
  if (logic.isOptimizing.value) return
  if (analyzing.value) return

  analyzing.value = true
  try {
    // 分析模式不产生新提示词，但评估请求需要 non-empty optimizedPrompt
    // 将当前原始提示词同步到 optimizedPrompt，供 prompt-only 评估使用
    logic.optimizedPrompt.value = logic.prompt.value
    logic.optimizedReasoning.value = ''

    isInputPanelCollapsed.value = true
    await nextTick()
    await handleAnalyzeEvaluate()
  } finally {
    analyzing.value = false
  }
}

// 🔧 解包 logic 中的 ref，用于传递给子组件（避免 Vue prop 类型警告）
const unwrappedLogicProps = computed(() => ({
  isOptimizing: logic.isOptimizing.value,
  isIterating: logic.isIterating.value,
  currentVersions: logic.currentVersions.value,
  currentVersionId: logic.currentVersionId.value,
  isTestingOriginal: logic.isTestingOriginal.value,
  isTestingOptimized: logic.isTestingOptimized.value,
  optimizedReasoning: logic.optimizedReasoning.value,
  // ✅ 修复：处理 testResults 可能为 null 的情况
  testResultsOriginalResult: logic.testResults.value?.originalResult || '',
  testResultsOriginalReasoning: logic.testResults.value?.originalReasoning || '',
  testResultsOptimizedResult: logic.testResults.value?.optimizedResult || '',
  testResultsOptimizedReasoning: logic.testResults.value?.optimizedReasoning || ''
}))

// 🔧 为 v-model 创建解包的 computed（支持双向绑定）
const promptModel = computed({
  get: () => logic.prompt.value,
  set: (value) => { logic.prompt.value = value }
})

const optimizedPromptModel = computed({
  get: () => logic.optimizedPrompt.value,
  set: (value) => { logic.optimizedPrompt.value = value }
})

const testContentModel = computed({
  get: () => logic.testContent.value,
  set: (value) => { logic.testContent.value = value }
})

// 🔧 为 SelectWithConfig 的 v-model 创建解包的 computed
const selectedOptimizeModelKeyModel = computed({
  get: () => logic.selectedOptimizeModelKey.value,
  set: (value) => { logic.selectedOptimizeModelKey.value = value }
})

const selectedTemplateIdModel = computed({
  get: () => logic.selectedTemplateId.value,
  set: (value) => { logic.selectedTemplateId.value = value }
})

const selectedTestModelKeyModel = computed({
  get: () => logic.selectedTestModelKey.value,
  set: (value) => { logic.selectedTestModelKey.value = value }
})

// 测试模型信息
const selectedTestModelInfo = computed(() => modelSelection.selectedTestModelInfo.value)

// 评估处理器
// ✅ 修复：处理 testResults 可能为 null 的情况，添加 .value 访问
const testResultsComputed = computed(() => ({
  originalResult: logic.testResults.value?.originalResult || undefined,
  optimizedResult: logic.testResults.value?.optimizedResult || undefined
}))

const evaluationHandler = useEvaluationHandler({
  services,
  originalPrompt: logic.prompt,
  optimizedPrompt: logic.optimizedPrompt,
  testContent: logic.testContent,
  testResults: testResultsComputed,
  evaluationModelKey: logic.selectedTestModelKey,
  functionMode: computed(() => 'basic'),
  subMode: computed(() => 'system'),
  persistedResults: toRef(session, 'evaluationResults'),
  currentIterateRequirement: computed(() => {
    const versionId = logic.currentVersionId.value
    if (!versionId || !logic.currentVersions.value) return ''
    const currentVersion = logic.currentVersions.value.find(v => v.id === versionId)
    return currentVersion?.iterationNote || ''
  })
})

// 提供评估上下文
provideEvaluation(evaluationHandler.evaluation)

// 评估状态
const { evaluation, handleEvaluate: handleEvaluateInternal } = evaluationHandler
const testAreaProps = evaluationHandler.testAreaEvaluationProps
const panelProps = evaluationHandler.panelProps
const isEvaluatingOriginal = computed(() => testAreaProps.value.isEvaluatingOriginal)
const isEvaluatingOptimized = computed(() => testAreaProps.value.isEvaluatingOptimized)
const originalScore = computed(() => testAreaProps.value.originalScore ?? 0)
const optimizedScore = computed(() => testAreaProps.value.optimizedScore ?? 0)
const hasOriginalEvaluation = computed(() => testAreaProps.value.hasOriginalEvaluation)
const hasOptimizedEvaluation = computed(() => testAreaProps.value.hasOptimizedEvaluation)
const originalEvaluationResult = computed(() => testAreaProps.value.originalEvaluationResult)
const optimizedEvaluationResult = computed(() => testAreaProps.value.optimizedEvaluationResult)
const originalScoreLevel = computed(() => testAreaProps.value.originalScoreLevel)
const optimizedScoreLevel = computed(() => testAreaProps.value.optimizedScoreLevel)

// 对比评估状态
const isEvaluatingCompare = evaluationHandler.compareEvaluation.isEvaluatingCompare
const compareScore = computed(() => evaluationHandler.compareEvaluation.compareScore.value ?? 0)
const hasCompareEvaluation = evaluationHandler.compareEvaluation.hasCompareResult
const compareEvaluationResult = computed(() => evaluation.state['compare'].result)
const compareScoreLevel = computed(() =>
  evaluation.getScoreLevel(evaluationHandler.compareEvaluation.compareScore.value ?? null)
)

// 占位状态
const globalVariables = ref({})
const predefinedVariables = ref({})
const inputMode = ref<'normal' | 'compact'>('normal')
const controlBarLayout = ref<'horizontal' | 'vertical'>('horizontal')
const buttonSize = ref<'small' | 'medium' | 'large'>('medium')
const conversationMaxHeight = ref(600)
const resultVerticalLayout = ref(false)
const analyzing = ref(false)

// ==================== 事件处理 ====================

// 迭代优化
const handleIterate = (payload: IteratePayload) => {
  logic.handleIterate(payload)
}

// 评估
const handleEvaluate = async (type: 'original' | 'optimized' | 'compare') => {
  console.log('[BasicSystemWorkspace] evaluate', type)
  await handleEvaluateInternal(type)
}

// 分析评估（prompt-only）
const handleAnalyzeEvaluate = async () => {
  console.log('[BasicSystemWorkspace] analyzeEvaluate (prompt-only)')
  await handleEvaluateInternal('prompt-only')
}

// 显示详情
const showDetail = (type: 'original' | 'optimized' | 'compare') => {
  console.log('[BasicSystemWorkspace] showDetail', type)
  evaluation.showDetail(type)
}

// 应用改进
const handleApplyImprovement = (payload: { improvement: string; type: string }) => {
  evaluation.closePanel()
  promptPanelRef.value?.openIterateDialog?.(payload.improvement)
}

// 应用补丁
const handleApplyPatch = (payload: { operation: PatchOperation }) => {
  if (!payload.operation) return
  const current = logic.optimizedPrompt.value || ''
  const result = applyPatchOperationsToText(current, payload.operation)
  if (!result.ok) {
    toast.warning(t('toast.warning.patchApplyFailed'))
    return
  }
  logic.optimizedPrompt.value = result.text
  toast.success(t('evaluation.diagnose.applyFix'))
}

const handleClearEvaluation = () => {
  evaluation.closePanel()
  evaluation.clearAllResults()
}

// 保存本地编辑
const handleSaveLocalEdit = async (payload: { note?: string }) => {
  await logic.handleSaveLocalEdit({
    optimizedPrompt: logic.optimizedPrompt.value || '',
    note: payload.note,
    source: 'manual',
  })
}

// 保存收藏（从顶层 App 注入）
const globalHandleSaveFavorite = inject<((data: { content: string; originalContent?: string }) => void) | null>(
  'handleSaveFavorite',
  null
)

const handleSaveFavorite = () => {
  console.log('[BasicSystemWorkspace] saveFavorite')

  if (!globalHandleSaveFavorite) {
    toast.error(t('toast.error.favoriteNotInitialized'))
    return
  }

  const data = {
    content: logic.optimizedPrompt.value || logic.prompt.value,
    originalContent: logic.prompt.value
  }

  if (!data.content && !data.originalContent) {
    toast.warning(t('toast.error.noContentToSave'))
    return
  }

  globalHandleSaveFavorite(data)
}

// 打开变量管理器
const handleOpenVariableManager = (_variableName?: string) => {
  toast.info('变量管理器暂不可用')
}

// 打开输入预览
const handleOpenInputPreview = () => {
  console.log('[BasicSystemWorkspace] openInputPreview')
  toast.info('输入预览暂不可用')
}

// 打开提示词预览
const handleOpenPromptPreview = () => {
  console.log('[BasicSystemWorkspace] openPromptPreview')
  toast.info('提示词预览暂不可用')
}

// 打开模型管理器
const handleOpenModelManager = () => {
  appOpenModelManager?.('text')
}

// 打开模板管理器
const handleOpenTemplateManager = (type?: string) => {
  appOpenTemplateManager?.(type || 'optimize')
}

// ==================== 初始化 ====================

onMounted(async () => {
  // 加载版本列表
  await logic.loadVersions()
  // 刷新模型和模板列表
  await modelSelection.refreshTextModels()
  await templateSelection.refreshOptimizeTemplates()
  await templateSelection.refreshIterateTemplates()

  if (typeof window !== 'undefined') {
    window.addEventListener('basic-workspace-refresh-text-models', refreshTextModelsHandler)
    window.addEventListener('basic-workspace-refresh-templates', refreshTemplatesHandler)
    window.addEventListener('basic-workspace-refresh-iterate-select', refreshIterateSelectHandler)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('basic-workspace-refresh-text-models', refreshTextModelsHandler)
    window.removeEventListener('basic-workspace-refresh-templates', refreshTemplatesHandler)
    window.removeEventListener('basic-workspace-refresh-iterate-select', refreshIterateSelectHandler)
  }
})

const refreshTextModelsHandler = async () => {
  await modelSelection.refreshTextModels()
}

const refreshTemplatesHandler = async () => {
  await templateSelection.refreshOptimizeTemplates()
  await templateSelection.refreshIterateTemplates()
  await nextTick()
  promptPanelRef.value?.refreshIterateTemplateSelect?.()
}

const refreshIterateSelectHandler = async () => {
  await nextTick()
  promptPanelRef.value?.refreshIterateTemplateSelect?.()
}

// chainId 变化时加载版本
watch(() => session.chainId, async (newChainId) => {
  if (newChainId) {
    await logic.loadVersions()
  } else {
    logic.currentVersions.value = []
    logic.currentChainId.value = ''
    logic.currentVersionId.value = ''
  }
})

defineExpose({
  promptPanelRef,
  testAreaPanelRef,
  openIterateDialog: (initialContent?: string) => {
    promptPanelRef.value?.openIterateDialog?.(initialContent)
  }
})
</script>

<style scoped>
.basic-system-workspace {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}
</style>
