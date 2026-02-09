<template>
    <div
        class="basic-system-workspace"
        data-testid="workspace"
        data-mode="basic-system"
    >
        <div
            ref="splitRootRef"
            class="basic-system-split"
            :style="{ gridTemplateColumns: `${mainSplitLeftPct}% 12px 1fr` }"
        >
            <!-- 左侧：优化区域 -->
            <div class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
                <NFlex
                    vertical
                    :style="{ overflow: 'auto', height: '100%', minHeight: 0 }"
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
                        @apply-improvement="handleApplyImprovement"
                        @apply-patch="handleApplyPatch"
                        @save-local-edit="handleSaveLocalEdit"
                    />
                </NCard>
                </NFlex>
            </div>

            <div
                class="split-divider"
                role="separator"
                tabindex="0"
                :aria-valuemin="25"
                :aria-valuemax="50"
                :aria-valuenow="mainSplitLeftPct"
                @pointerdown="onSplitPointerDown"
                @keydown="onSplitKeydown"
            />

            <!-- 右侧：测试区域 -->
            <div ref="testPaneRef" class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
                <NFlex vertical :style="{ height: '100%', gap: '12px' }">
                    <!-- 测试输入（system 模式必填） -->
                    <NCard :style="{ flexShrink: 0 }" size="small">
                        <TestInputSection
                            v-model="testContentModel"
                            :label="t('test.content')"
                            :placeholder="t('test.placeholder')"
                            :help-text="t('test.simpleMode.help')"
                            :disabled="isAnyVariantRunning"
                            mode="normal"
                            :enable-fullscreen="true"
                            test-id="basic-system-test-input"
                        />
                    </NCard>

                    <!-- 顶部：列数与全局操作 -->
                    <NCard size="small" :style="{ flexShrink: 0 }">
                        <div class="test-area-top">
                            <NFlex align="center" :size="8" :wrap="false" style="min-width: 0;">
                                <NText :depth="2" class="test-area-label">
                                    {{ t('test.layout.columns') }}：
                                </NText>
                                <NRadioGroup
                                    v-model:value="testColumnCountModel"
                                    size="small"
                                    :disabled="isAnyVariantRunning"
                                >
                                    <NRadioButton :value="2">2</NRadioButton>
                                    <NRadioButton :value="3">3</NRadioButton>
                                    <NRadioButton :value="4" :disabled="!canUseFourColumns">4</NRadioButton>
                                </NRadioGroup>
                            </NFlex>

                            <NFlex align="center" justify="end" :size="8" :wrap="false">
                                <NButton
                                    type="primary"
                                    size="small"
                                    :loading="isAnyVariantRunning"
                                    :disabled="isAnyVariantRunning"
                                    @click="runAllVariants"
                                    :data-testid="'basic-system-test-run-all'"
                                >
                                    {{ t('test.layout.runAll') }}
                                </NButton>

                                <template v-if="testColumnCountModel === 2 && hasVariantResult('a') && hasVariantResult('b')">
                                    <EvaluationScoreBadge
                                        v-if="hasCompareEvaluation || isEvaluatingCompare"
                                        :score="compareScore"
                                        :level="compareScoreLevel"
                                        :loading="isEvaluatingCompare"
                                        :result="compareEvaluationResult"
                                        type="compare"
                                        size="small"
                                        @show-detail="() => showDetail('compare')"
                                        @evaluate="() => handleEvaluate('compare')"
                                        @evaluate-with-feedback="handleEvaluateWithFeedback"
                                        @apply-improvement="handleApplyImprovement"
                                        @apply-patch="handleApplyPatch"
                                    />
                                    <NSpace v-else :size="6" align="center">
                                        <FeedbackAnalyzeButton
                                            type="compare"
                                            :loading="isEvaluatingCompare"
                                            size="small"
                                            :compact="true"
                                            @evaluate-with-feedback="handleEvaluateWithFeedback"
                                        />
                                        <NButton
                                            quaternary
                                            size="small"
                                            :disabled="isEvaluatingCompare"
                                            @click="() => handleEvaluate('compare')"
                                        >
                                            {{ t('evaluation.compareEvaluate') }}
                                        </NButton>
                                    </NSpace>
                                </template>
                            </NFlex>
                        </div>
                    </NCard>

                    <!-- 配置区：与结果列对齐 -->
                    <NCard size="small" :style="{ flexShrink: 0 }">
                        <div class="variant-deck" :style="{ gridTemplateColumns: testGridTemplateColumns }">
                            <div v-for="id in activeVariantIds" :key="id" class="variant-cell">
                                <div class="variant-cell__controls">
                                    <NTag size="small" :bordered="false" class="variant-cell__label">
                                        {{ getVariantLabel(id) }}
                                    </NTag>
                                    <NTag
                                        v-if="isVariantStale(id)"
                                        size="small"
                                        type="warning"
                                        :bordered="false"
                                        class="variant-cell__stale"
                                    >
                                        {{ t('test.layout.stale') }}
                                    </NTag>
                                    <NSelect
                                        :value="variantVersionModels[id].value"
                                        :options="versionOptions"
                                        size="small"
                                        :disabled="variantRunning[id] || isAnyVariantRunning"
                                        :data-testid="getVariantVersionTestId(id)"
                                        @update:value="(value) => { variantVersionModels[id].value = value }"
                                        style="width: 92px"
                                    />
                                    <div class="variant-cell__model">
                                        <SelectWithConfig
                                            :data-testid="getVariantModelTestId(id)"
                                            :model-value="variantModelKeyModels[id].value"
                                            @update:model-value="(value) => { variantModelKeyModels[id].value = String(value ?? '') }"
                                            :options="modelSelection.textModelOptions"
                                            :getPrimary="OptionAccessors.getPrimary"
                                            :getSecondary="OptionAccessors.getSecondary"
                                            :getValue="OptionAccessors.getValue"
                                            @config="handleOpenModelManager"
                                            style="min-width: 0; width: 100%;"
                                        />
                                    </div>

                                    <NTooltip trigger="hover">
                                        <template #trigger>
                                            <NButton
                                                type="primary"
                                                size="small"
                                                circle
                                                :loading="variantRunning[id]"
                                                :disabled="isAnyVariantRunning && !variantRunning[id]"
                                                @click="() => runVariant(id)"
                                                :data-testid="getVariantRunTestId(id)"
                                            >
                                                <template #icon>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                        <path d="M8 5v14l11-7z" />
                                                    </svg>
                                                </template>
                                            </NButton>
                                        </template>
                                        {{ t('test.layout.runThisColumn') }}
                                    </NTooltip>
                                </div>
                            </div>
                        </div>
                    </NCard>

                    <!-- 结果区：多列网格（无横向滚动） -->
                    <div class="variant-results-wrap">
                        <div class="variant-results" :style="{ gridTemplateColumns: testGridTemplateColumns }">
                            <NCard
                                v-for="id in activeVariantIds"
                                :key="id"
                                size="small"
                                class="variant-result-card"
                                content-style="padding: 0; height: 100%; max-height: 100%; overflow: hidden;"
                            >
                                <OutputDisplay
                                    :test-id="getVariantOutputTestId(id)"
                                    :content="getVariantResult(id).result"
                                    :reasoning="getVariantResult(id).reasoning"
                                    :streaming="variantRunning[id]"
                                    :enableCopy="true"
                                    :enableFullscreen="true"
                                    :enableEdit="false"
                                    :enableDiff="false"
                                    :enableFavorite="false"
                                    reasoningMode="hide"
                                    mode="readonly"
                                    :style="{ height: '100%', minHeight: '0' }"
                                >
                                    <template #toolbar-right-extra>
                                        <div
                                            v-if="id === 'a' && hasVariantResult('a')"
                                            class="output-evaluation-entry"
                                        >
                                            <EvaluationScoreBadge
                                                v-if="hasOriginalEvaluation || isEvaluatingOriginal"
                                                :score="originalScore"
                                                :level="originalScoreLevel"
                                                :loading="isEvaluatingOriginal"
                                                :result="originalEvaluationResult"
                                                type="original"
                                                size="small"
                                                @show-detail="() => showDetail('original')"
                                                @evaluate="() => handleEvaluate('original')"
                                                @evaluate-with-feedback="handleEvaluateWithFeedback"
                                                @apply-improvement="handleApplyImprovement"
                                                @apply-patch="handleApplyPatch"
                                            />
                                            <NSpace v-else :size="6" align="center">
                                                <FeedbackAnalyzeButton
                                                    type="original"
                                                    :loading="isEvaluatingOriginal"
                                                    size="small"
                                                    :compact="true"
                                                    @evaluate-with-feedback="handleEvaluateWithFeedback"
                                                />
                                                <NButton
                                                    size="small"
                                                    quaternary
                                                    :disabled="isEvaluatingOriginal"
                                                    @click="() => handleEvaluate('original')"
                                                >
                                                    {{ t('evaluation.evaluate') }}
                                                </NButton>
                                            </NSpace>
                                        </div>

                                        <div
                                            v-else-if="id === 'b' && hasVariantResult('b')"
                                            class="output-evaluation-entry"
                                        >
                                            <EvaluationScoreBadge
                                                v-if="hasOptimizedEvaluation || isEvaluatingOptimized"
                                                :score="optimizedScore"
                                                :level="optimizedScoreLevel"
                                                :loading="isEvaluatingOptimized"
                                                :result="optimizedEvaluationResult"
                                                type="optimized"
                                                size="small"
                                                @show-detail="() => showDetail('optimized')"
                                                @evaluate="() => handleEvaluate('optimized')"
                                                @evaluate-with-feedback="handleEvaluateWithFeedback"
                                                @apply-improvement="handleApplyImprovement"
                                                @apply-patch="handleApplyPatch"
                                            />
                                            <NSpace v-else :size="6" align="center">
                                                <FeedbackAnalyzeButton
                                                    type="optimized"
                                                    :loading="isEvaluatingOptimized"
                                                    size="small"
                                                    :compact="true"
                                                    @evaluate-with-feedback="handleEvaluateWithFeedback"
                                                />
                                                <NButton
                                                    size="small"
                                                    quaternary
                                                    :disabled="isEvaluatingOptimized"
                                                    @click="() => handleEvaluate('optimized')"
                                                >
                                                    {{ t('evaluation.evaluate') }}
                                                </NButton>
                                            </NSpace>
                                        </div>
                                    </template>
                                </OutputDisplay>
                            </NCard>
                        </div>
                    </div>
                </NFlex>
            </div>
        </div>

        <EvaluationPanel
            v-model:show="evaluation.isPanelVisible.value"
            :is-evaluating="panelProps.isEvaluating"
            :result="panelProps.result"
            :stream-content="panelProps.streamContent"
            :error="panelProps.error"
            :current-type="panelProps.currentType"
            :score-level="panelProps.scoreLevel"
            @re-evaluate="evaluationHandler.handleReEvaluate"
            @evaluate-with-feedback="({ feedback }) => evaluationHandler.handleEvaluateActiveWithFeedback(feedback)"
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
import { ref, reactive, computed, toRef, inject, onMounted, onUnmounted, watch, nextTick, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '../../composables/ui/useToast'
import {
  useBasicSystemSession,
  type TestPanelVersionValue,
  type TestVariantConfig,
  type TestVariantId,
  type TestColumnCount,
} from '../../stores/session/useBasicSystemSession'
import { useBasicWorkspaceLogic } from '../../composables/workspaces/useBasicWorkspaceLogic'
import { useWorkspaceModelSelection } from '../../composables/workspaces/useWorkspaceModelSelection'
import { useWorkspaceTemplateSelection } from '../../composables/workspaces/useWorkspaceTemplateSelection'
import { useEvaluationHandler } from '../../composables/prompt/useEvaluationHandler'
import { provideEvaluation } from '../../composables/prompt/useEvaluationContext'
import { NButton, NCard, NFlex, NIcon, NText, NSelect, NRadioGroup, NRadioButton, NTooltip, NTag, NSpace } from 'naive-ui'
import InputPanelUI from '../InputPanel.vue'
import PromptPanelUI from '../PromptPanel.vue'
import TestInputSection from '../TestInputSection.vue'
import OutputDisplay from '../OutputDisplay.vue'
import { EvaluationPanel, EvaluationScoreBadge, FeedbackAnalyzeButton } from '../evaluation'
import SelectWithConfig from '../SelectWithConfig.vue'
import { OptionAccessors } from '../../utils/data-transformer'
import type { AppServices } from '../../types/services'
import type { IteratePayload } from '../../types/workspace'
import { applyPatchOperationsToText, type EvaluationType, type PatchOperation, type Template } from '@prompt-optimizer/core'
import { useElementSize } from '@vueuse/core'

const { t } = useI18n()
const toast = useToast()

// 服务注入
const injectedServices = inject<Ref<AppServices | null>>('services')
const services = injectedServices ?? ref<AppServices | null>(null)
const appOpenModelManager = inject<((tab?: 'text' | 'image' | 'function') => void) | null>('openModelManager', null)
const appOpenTemplateManager = inject<((type?: string) => void) | null>('openTemplateManager', null)

// Session store（单一真源）
const session = useBasicSystemSession()

// ==================== 主布局：可拖拽分栏（左侧 25%~50%） ====================

const splitRootRef = ref<HTMLElement | null>(null)
const testPaneRef = ref<HTMLElement | null>(null)

const clampLeftPct = (pct: number) => Math.min(50, Math.max(25, pct))

// 使用本地 draft，避免拖拽过程频繁写入持久化存储
const mainSplitLeftPct = ref<number>(50)
watch(
  () => session.layout.mainSplitLeftPct,
  (pct) => {
    if (typeof pct === 'number' && Number.isFinite(pct)) {
      mainSplitLeftPct.value = clampLeftPct(Math.round(pct))
    }
  },
  { immediate: true }
)

const isDraggingSplit = ref(false)
let dragStartX = 0
let dragStartPct = 0

const handleSplitPointerMove = (e: PointerEvent) => {
  const root = splitRootRef.value
  if (!root) return
  const rect = root.getBoundingClientRect()
  if (!rect.width) return

  const deltaX = e.clientX - dragStartX
  const nextPct = dragStartPct + (deltaX / rect.width) * 100
  mainSplitLeftPct.value = clampLeftPct(nextPct)
}

const endSplitDrag = () => {
  if (!isDraggingSplit.value) return
  isDraggingSplit.value = false
  document.removeEventListener('pointermove', handleSplitPointerMove)
  document.removeEventListener('pointerup', endSplitDrag)
  document.removeEventListener('pointercancel', endSplitDrag)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''

  session.setMainSplitLeftPct(mainSplitLeftPct.value)
}

const onSplitPointerDown = (e: PointerEvent) => {
  if (!splitRootRef.value) return
  dragStartX = e.clientX
  dragStartPct = mainSplitLeftPct.value
  isDraggingSplit.value = true
  document.addEventListener('pointermove', handleSplitPointerMove)
  document.addEventListener('pointerup', endSplitDrag)
  document.addEventListener('pointercancel', endSplitDrag)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const onSplitKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
  e.preventDefault()

  if (e.key === 'Home') {
    mainSplitLeftPct.value = 25
  } else if (e.key === 'End') {
    mainSplitLeftPct.value = 50
  } else {
    const delta = e.key === 'ArrowLeft' ? -1 : 1
    mainSplitLeftPct.value = clampLeftPct(mainSplitLeftPct.value + delta)
  }

  session.setMainSplitLeftPct(mainSplitLeftPct.value)
}

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

// 组件引用（用于触发迭代对话框、刷新迭代下拉等）
type PromptPanelExpose = {
  openIterateDialog?: (initialContent?: string) => void
  refreshIterateTemplateSelect?: () => void
} | null
const promptPanelRef = ref<PromptPanelExpose>(null)

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
  optimizedReasoning: logic.optimizedReasoning.value,
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

const getVariant = (id: TestVariantId): TestVariantConfig | undefined => {
  const list = session.testVariants as unknown as TestVariantConfig[]
  return Array.isArray(list) ? list.find(v => v.id === id) : undefined
}

// 测试列数（2/3/4）
const testColumnCountModel = computed<TestColumnCount>({
  get: () => {
    const raw = session.layout.testColumnCount
    return raw === 2 || raw === 3 || raw === 4 ? raw : 2
  },
  set: (value) => session.setTestColumnCount(value)
})

const originalTestVersionModel = computed<TestPanelVersionValue>({
  get: () => getVariant('a')?.version ?? 0,
  set: (value) => session.updateTestVariant('a', { version: value })
})

const optimizedTestVersionModel = computed<TestPanelVersionValue>({
  get: () => getVariant('b')?.version ?? 'latest',
  set: (value) => session.updateTestVariant('b', { version: value })
})

const originalTestModelKeyModel = computed<string>({
  get: () => getVariant('a')?.modelKey ?? '',
  set: (value) => session.updateTestVariant('a', { modelKey: value })
})

const optimizedTestModelKeyModel = computed<string>({
  get: () => getVariant('b')?.modelKey ?? '',
  set: (value) => session.updateTestVariant('b', { modelKey: value })
})

// C/D 两列（仅在 3/4 列模式下显示）
const variantCTestVersionModel = computed<TestPanelVersionValue>({
  get: () => getVariant('c')?.version ?? 'latest',
  set: (value) => session.updateTestVariant('c', { version: value })
})

const variantDTestVersionModel = computed<TestPanelVersionValue>({
  get: () => getVariant('d')?.version ?? 'latest',
  set: (value) => session.updateTestVariant('d', { version: value })
})

const variantCTestModelKeyModel = computed<string>({
  get: () => getVariant('c')?.modelKey ?? '',
  set: (value) => session.updateTestVariant('c', { modelKey: value })
})

const variantDTestModelKeyModel = computed<string>({
  get: () => getVariant('d')?.modelKey ?? '',
  set: (value) => session.updateTestVariant('d', { modelKey: value })
})

const ALL_VARIANT_IDS: TestVariantId[] = ['a', 'b', 'c', 'd']
const activeVariantIds = computed<TestVariantId[]>(() => ALL_VARIANT_IDS.slice(0, testColumnCountModel.value))

const variantVersionModels = {
  a: originalTestVersionModel,
  b: optimizedTestVersionModel,
  c: variantCTestVersionModel,
  d: variantDTestVersionModel,
} as const

const variantModelKeyModels = {
  a: originalTestModelKeyModel,
  b: optimizedTestModelKeyModel,
  c: variantCTestModelKeyModel,
  d: variantDTestModelKeyModel,
} as const

// 版本选项：仅显示“原始(v0)”与“最新(latest)”，若存在中间版本，则额外显示 v1..v(n-1)。
const versionOptions = computed(() => {
  const versions = logic.currentVersions.value || []

  const sortedVersions = versions
    .map(v => v.version)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 1)
    .slice()
    .sort((a, b) => a - b)

  const latest = sortedVersions.length ? sortedVersions[sortedVersions.length - 1] : null
  const middle = latest ? sortedVersions.filter(v => v < latest) : []

  return [
    { label: t('test.layout.original'), value: 0 },
    ...middle.map(v => ({ label: `v${v}`, value: v })),
    { label: t('test.layout.latest'), value: 'latest' },
  ]
})

// 确保测试列的模型选择始终有效（模型列表变化时自动 fallback）
watch(
  () => modelSelection.textModelOptions.value,
  (opts) => {
    const fallback = opts?.[0]?.value || ''
    if (!fallback) return
    const keys = new Set((opts || []).map(o => o.value))

    const legacy = logic.selectedTestModelKey.value
    const seed = legacy && keys.has(legacy) ? legacy : fallback

    for (const id of ALL_VARIANT_IDS) {
      const current = variantModelKeyModels[id].value
      if (!current || !keys.has(current)) {
        session.updateTestVariant(id, { modelKey: seed })
      }
    }
  },
  { immediate: true }
)

// 测试区宽度：用于禁用 4 列（避免横向滚动）
const { width: testPaneWidth } = useElementSize(testPaneRef)
const canUseFourColumns = computed(() => testPaneWidth.value >= 1000)

watch(
  canUseFourColumns,
  (ok) => {
    if (!ok && testColumnCountModel.value === 4) {
      testColumnCountModel.value = 3
    }
  },
  { immediate: true }
)

const testGridTemplateColumns = computed(() => `repeat(${testColumnCountModel.value}, minmax(0, 1fr))`)

type ResolvedTestPrompt = { text: string; resolvedVersion: number }

const resolveTestPrompt = (selection: TestPanelVersionValue): ResolvedTestPrompt => {
  const v0 = logic.prompt.value || ''
  const versions = logic.currentVersions.value || []
  const latest = versions.reduce<{ version: number; optimizedPrompt: string } | null>((acc, v) => {
    if (typeof v.version !== 'number' || v.version < 1) return acc
    const next = { version: v.version, optimizedPrompt: v.optimizedPrompt || '' }
    if (!acc || next.version > acc.version) return next
    return acc
  }, null)

  if (selection === 0) {
    return { text: v0, resolvedVersion: 0 }
  }

  if (selection === 'latest') {
    if (!latest) return { text: v0, resolvedVersion: 0 }
    return { text: latest.optimizedPrompt || '', resolvedVersion: latest.version }
  }

  const target = versions.find(v => v.version === selection)
  if (target) {
    return { text: target.optimizedPrompt || '', resolvedVersion: target.version }
  }

  if (!latest) return { text: v0, resolvedVersion: 0 }
  return { text: latest.optimizedPrompt || '', resolvedVersion: latest.version }
}

const resolvedOriginalTestPrompt = computed(() => resolveTestPrompt(originalTestVersionModel.value))
const resolvedOptimizedTestPrompt = computed(() => resolveTestPrompt(optimizedTestVersionModel.value))

// Pinia setup store 会自动解包 refs，这里是直接可变的响应式对象（非 Ref）
const variantResults = session.testVariantResults
const variantLastRunFingerprint = session.testVariantLastRunFingerprint

const variantRunning = reactive<Record<TestVariantId, boolean>>({
  a: false,
  b: false,
  c: false,
  d: false,
})

const isAnyVariantRunning = computed(() => activeVariantIds.value.some((id) => !!variantRunning[id]))

const getVariantLabel = (id: TestVariantId) => ({ a: 'A', b: 'B', c: 'C', d: 'D' }[id])

const getVariantVersionTestId = (id: TestVariantId) => {
  if (id === 'a') return 'basic-system-test-original-version-select'
  if (id === 'b') return 'basic-system-test-optimized-version-select'
  return `basic-system-test-variant-${id}-version-select`
}

const getVariantModelTestId = (id: TestVariantId) => {
  if (id === 'a') return 'basic-system-test-original-model-select'
  if (id === 'b') return 'basic-system-test-optimized-model-select'
  return `basic-system-test-variant-${id}-model-select`
}

const getVariantRunTestId = (id: TestVariantId) => `basic-system-test-run-${id}`

const getVariantOutputTestId = (id: TestVariantId) => {
  if (id === 'a') return 'basic-system-test-original-output'
  if (id === 'b') return 'basic-system-test-optimized-output'
  return `basic-system-test-variant-${id}-output`
}

const getVariantResult = (id: TestVariantId) => variantResults[id]
const hasVariantResult = (id: TestVariantId) => !!(variantResults[id]?.result || '').trim()

// 用于 stale 判定：生成短且稳定的指纹，避免把长文本写入持久化存储
const hashString = (input: string): string => {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}

const getVariantFingerprint = (id: TestVariantId) => {
  const selection = variantVersionModels[id].value
  const resolved = resolveTestPrompt(selection)
  const modelKey = variantModelKeyModels[id].value || ''
  // system 模式测试输入会直接影响输出，因此需要纳入 fingerprint
  const systemHash = hashString((resolved.text || '').trim())
  const userHash = hashString((logic.testContent.value || '').trim())
  return `${String(selection)}:${resolved.resolvedVersion}:${modelKey}:${systemHash}:${userHash}`
}

const isVariantStale = (id: TestVariantId) => {
  if (!hasVariantResult(id)) return false
  const prev = variantLastRunFingerprint[id]
  if (!prev) return false
  return prev !== getVariantFingerprint(id)
}

type VariantTestInput = {
  systemPrompt: string
  userPrompt: string
  modelKey: string
  resolvedVersion: number
}

const getVariantTestInput = (id: TestVariantId): VariantTestInput | null => {
  const modelKey = (variantModelKeyModels[id].value || '').trim()
  if (!modelKey) {
    toast.error(t('test.error.noModel'))
    return null
  }

  const userPrompt = (logic.testContent.value || '').trim()
  if (!userPrompt) {
    toast.error(t('test.error.noTestContent'))
    return null
  }

  const resolved = resolveTestPrompt(variantVersionModels[id].value)
  if (!resolved.text?.trim()) {
    const key = resolved.resolvedVersion === 0 ? 'test.error.noOriginalPrompt' : 'test.error.noOptimizedPrompt'
    toast.error(t(key))
    return null
  }

  return {
    systemPrompt: resolved.text,
    userPrompt,
    modelKey,
    resolvedVersion: resolved.resolvedVersion,
  }
}

const runVariant = async (
  id: TestVariantId,
  opts?: {
    silentSuccess?: boolean
    silentError?: boolean
    skipClearEvaluation?: boolean
    persist?: boolean
    allowParallel?: boolean
  }
): Promise<boolean> => {
  if (variantRunning[id]) return false
  if (!opts?.allowParallel && isAnyVariantRunning.value) return false

  const promptService = services.value?.promptService
  if (!promptService) {
    toast.error(t('toast.error.serviceInit'))
    return false
  }

  const input = getVariantTestInput(id)
  if (!input) return false

  if (!opts?.skipClearEvaluation) {
    evaluationHandler.clearBeforeTest()
  }

  variantResults[id] = { result: '', reasoning: '' }
  variantRunning[id] = true

  try {
    await promptService.testPromptStream(input.systemPrompt, input.userPrompt, input.modelKey, {
      onToken: (token: string) => {
        const prev = variantResults[id]
        variantResults[id] = { ...prev, result: (prev.result || '') + token }
      },
      onReasoningToken: (token: string) => {
        const prev = variantResults[id]
        variantResults[id] = { ...prev, reasoning: (prev.reasoning || '') + token }
      },
      onComplete: () => {
        // 由 finally 统一收尾
      },
      onError: (error: Error) => {
        throw error
      },
    })

    if (!opts?.silentSuccess) {
      toast.success(t('toast.success.testComplete'))
    }
    return true
  } catch (_error) {
    if (!opts?.silentError) {
      toast.error(t('toast.error.testFailed'))
    }
    return false
  } finally {
    variantRunning[id] = false
    variantLastRunFingerprint[id] = getVariantFingerprint(id)
    if (opts?.persist !== false) {
      void session.saveSession()
    }
  }
}

const runAllVariants = async () => {
  if (isAnyVariantRunning.value) return

  const ids = activeVariantIds.value
  for (const id of ids) {
    if (!getVariantTestInput(id)) return
  }

  evaluationHandler.clearBeforeTest()
  const results = await Promise.all(
    ids.map((id) =>
      runVariant(id, {
        silentSuccess: true,
        silentError: true,
        skipClearEvaluation: true,
        persist: false,
        allowParallel: true,
      })
    )
  )

  void session.saveSession()

  if (results.every(Boolean)) {
    toast.success(t('toast.success.testComplete'))
  } else {
    toast.error(t('toast.error.testFailed'))
  }
}

const testResultsComputed = computed(() => ({
  originalResult: variantResults.a.result || undefined,
  optimizedResult: variantResults.b.result || undefined,
}))

// 评估处理器：testResults 由多列输出提供（仅取 A/B）

const evaluationHandler = useEvaluationHandler({
  services,
  originalPrompt: computed(() => resolvedOriginalTestPrompt.value.text),
  optimizedPrompt: computed(() => resolvedOptimizedTestPrompt.value.text),
  testContent: logic.testContent,
  testResults: testResultsComputed,
  evaluationModelKey: computed(() =>
    optimizedTestModelKeyModel.value || originalTestModelKeyModel.value || logic.selectedTestModelKey.value || ''
  ),
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

const analyzing = ref(false)

// ==================== 事件处理 ====================

// 迭代优化
const handleIterate = (payload: IteratePayload) => {
  logic.handleIterate(payload)
}

// 评估
const handleEvaluate = async (type: 'original' | 'optimized' | 'compare') => {
  await handleEvaluateInternal(type)
}

const handleEvaluateWithFeedback = async (payload: {
  type: EvaluationType
  feedback: string
}) => {
  await evaluationHandler.handleEvaluateWithFeedback(payload.type, payload.feedback)
}

// 分析评估（prompt-only）
const handleAnalyzeEvaluate = async () => {
  await handleEvaluateInternal('prompt-only')
}

// 显示详情
const showDetail = (type: 'original' | 'optimized' | 'compare') => {
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
  endSplitDrag()
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

.basic-system-split {
    display: grid;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
}

.split-pane {
    min-height: 0;
}

.split-divider {
    cursor: col-resize;
    background: var(--n-divider-color, rgba(0, 0, 0, 0.08));
    border-radius: 999px;
    margin: 6px 0;
    transition: background 120ms ease;
}

.split-divider:hover,
.split-divider:focus-visible {
    background: var(--n-primary-color, rgba(59, 130, 246, 0.5));
    outline: none;
}

.test-area-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
}

.test-area-label {
    white-space: nowrap;
}

.variant-deck {
    display: grid;
    gap: 12px;
    width: 100%;
}

.variant-cell {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.variant-cell__controls {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.variant-cell__label {
    flex-shrink: 0;
}

.variant-cell__stale {
    flex-shrink: 0;
}

.variant-cell__model {
    /* 让模型选择不要无限拉伸：保持紧凑，避免把右侧按钮/布局挤散 */
    flex: 0 1 220px;
    max-width: 220px;
    min-width: 0;
}

.output-evaluation-entry {
    display: flex;
    align-items: center;
    white-space: nowrap;
}

.variant-results-wrap {
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.variant-results {
    display: grid;
    gap: 12px;
    height: 100%;
    min-height: 0;
}

.variant-result-card {
    height: 100%;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.variant-result-card :deep(.n-card__content) {
    height: 100%;
    max-height: 100%;
    overflow: hidden;
}
</style>
