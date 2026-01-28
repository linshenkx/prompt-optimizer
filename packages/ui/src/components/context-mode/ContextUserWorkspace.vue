<template>
    <!--
        上下文模式 - 用户提示词工作区

        职责:
        - 左侧: 用户提示词输入 + 优化结果显示
        - 右侧: 测试区域 (变量输入 + 测试执行)

        与系统模式的区别:
        - 不包含会话管理器 (ConversationManager)
        - 仅优化单条用户消息,无需管理多轮对话上下文
        - 包含工具管理按钮 (系统模式不包含)
    -->
    <div class="context-user-workspace" data-testid="workspace" data-mode="pro-variable">
        <div
            ref="splitRootRef"
            class="context-user-split"
            :style="{ gridTemplateColumns: `${mainSplitLeftPct}% 12px 1fr` }"
        >
            <!-- 左侧：优化区域 -->
            <div class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
                <NFlex
                    vertical
                    :size="12"
                    :style="{ overflow: 'auto', height: '100%', minHeight: 0 }"
                >
            <!-- 提示词输入面板 (可折叠) -->
            <NCard style="flex-shrink: 0;">
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
                            v-if="contextUserOptimization.prompt"
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
                    test-id-prefix="pro-variable"
                    v-model="contextUserOptimization.prompt"
                    :selected-model="selectedOptimizeModelKeyModel"
                    :label="t('promptOptimizer.originalPrompt')"
                    :placeholder="t('promptOptimizer.userPromptPlaceholder')"
                    :help-text="variableGuideInlineHint"
                    :model-label="t('promptOptimizer.optimizeModel')"
                    :template-label="t('promptOptimizer.templateLabel')"
                    :button-text="t('promptOptimizer.optimize')"
                    :loading-text="t('common.loading')"
                    :loading="contextUserOptimization.isOptimizing"
                    :disabled="contextUserOptimization.isOptimizing"
                     :show-preview="true"
                     :show-analyze-button="true"
                     :analyze-loading="isAnalyzing"
                     @submit="handleOptimize"
                     @analyze="handleAnalyze"
                     @configModel="emit('config-model')"
                     @open-preview="handleOpenInputPreview"
                     :enable-variable-extraction="true"
                     :show-extract-button="true"
                     :extracting="props.isExtracting"
                     v-bind="inputPanelVariableData || {}"
                     @extract-variables="handleExtractVariables"
                    @variable-extracted="handleVariableExtracted"
                    @add-missing-variable="handleAddMissingVariable"
                >
                    <!-- 模型选择插槽 -->
                    <template #model-select>
                        <SelectWithConfig
                            v-model="selectedOptimizeModelKeyModel"
                            :options="modelSelection.textModelOptions.value"
                            :getPrimary="OptionAccessors.getPrimary"
                            :getSecondary="OptionAccessors.getSecondary"
                            :getValue="OptionAccessors.getValue"
                            @config="emit('config-model')"
                        />
                    </template>

                    <!-- 模板选择插槽 -->
                    <template #template-select>
                        <SelectWithConfig
                            v-model="selectedTemplateIdModel"
                            :options="templateSelection.templateOptions.value"
                            :getPrimary="OptionAccessors.getPrimary"
                            :getSecondary="OptionAccessors.getSecondary"
                            :getValue="OptionAccessors.getValue"
                            @config="emit('open-template-manager')"
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

            <!--
                用户模式特性说明:
                此处不显示会话管理器 (ConversationManager)

                原因:
                - 用户模式专注于优化单条用户提示词
                - 不涉及多轮对话的上下文管理
                - 系统模式才需要管理 system/user/assistant/tool 多条消息

                如需管理复杂对话上下文,请使用系统模式
            -->

            <!-- 优化结果面板 -->
            <NCard
                style="flex: 1; min-height: 200px; overflow: hidden"
                content-style="height: 100%; max-height: 100%; overflow: hidden;"
            >
                <PromptPanelUI
                    test-id="pro-variable"
                    ref="promptPanelRef"
                    :optimized-prompt="contextUserOptimization.optimizedPrompt"
                    @update:optimized-prompt="contextUserOptimization.optimizedPrompt = $event"
                    :reasoning="contextUserOptimization.optimizedReasoning"
                    :original-prompt="contextUserOptimization.prompt"
                    :is-optimizing="contextUserOptimization.isOptimizing"
                    :is-iterating="contextUserOptimization.isIterating"
                    :selected-iterate-template="selectedIterateTemplate"
                    @update:selectedIterateTemplate="
                        emit('update:selectedIterateTemplate', $event)
                    "
                    :versions="contextUserOptimization.currentVersions"
                    :current-version-id="contextUserOptimization.currentVersionId"
                    :optimization-mode="optimizationMode"
                     :advanced-mode-enabled="true"
                     :show-preview="true"
                     @iterate="handleIterate"
                     @openTemplateManager="emit('open-template-manager', $event)"
                     @switchVersion="handleSwitchVersion"
                     @switchToV0="handleSwitchToV0"
                     @save-favorite="emit('save-favorite', $event)"
                     @open-preview="handleOpenPromptPreview"
                     @apply-improvement="handleApplyImprovement"
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

            <!-- 右侧：测试区域（变量共享 + 多列 variants） -->
            <div ref="testPaneRef" class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
                <NFlex vertical :style="{ height: '100%', gap: '12px' }">
                    <!-- 变量表单（共享所有列） -->
                    <ContextUserTestPanel
                        ref="testAreaPanelRef"
                        mode="variables-only"
                        :prompt="contextUserOptimization.prompt"
                        :optimized-prompt="contextUserOptimization.optimizedPrompt"
                        :evaluation-model-key="effectiveEvaluationModelKey"
                        :services="servicesRef"
                        :global-variables="globalVariables"
                        :predefined-variables="predefinedVariables"
                        :temporary-variables="temporaryVariables"
                        @variable-change="handleTestVariableChange"
                        @save-to-global="handleSaveToGlobalFromTest"
                        @temporary-variable-remove="handleTestVariableRemove"
                        @temporary-variables-clear="handleClearTemporaryVariables"
                    />

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
                                    :data-testid="'pro-variable-test-run-all'"
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
                                        @apply-improvement="handleApplyImprovement"
                                        @apply-patch="handleApplyLocalPatch"
                                    />
                                    <NButton
                                        v-else
                                        quaternary
                                        size="small"
                                        :disabled="isEvaluatingCompare"
                                        @click="() => handleEvaluate('compare')"
                                    >
                                        {{ t('evaluation.compareEvaluate') }}
                                    </NButton>
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
                                            :options="modelSelection.textModelOptions.value"
                                            :getPrimary="OptionAccessors.getPrimary"
                                            :getSecondary="OptionAccessors.getSecondary"
                                            :getValue="OptionAccessors.getValue"
                                            @config="emit('config-model')"
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
                                        <div v-if="id === 'a' && hasVariantResult('a')" class="output-evaluation-entry">
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
                                                @apply-improvement="handleApplyImprovement"
                                                @apply-patch="handleApplyLocalPatch"
                                            />
                                            <NButton
                                                v-else
                                                size="small"
                                                quaternary
                                                :disabled="isEvaluatingOriginal"
                                                @click="() => handleEvaluate('original')"
                                            >
                                                {{ t('evaluation.evaluate') }}
                                            </NButton>
                                        </div>

                                        <div v-else-if="id === 'b' && hasVariantResult('b')" class="output-evaluation-entry">
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
                                                @apply-improvement="handleApplyImprovement"
                                                @apply-patch="handleApplyLocalPatch"
                                            />
                                            <NButton
                                                v-else
                                                size="small"
                                                quaternary
                                                :disabled="isEvaluatingOptimized"
                                                @click="() => handleEvaluate('optimized')"
                                            >
                                                {{ t('evaluation.evaluate') }}
                                            </NButton>
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
            @apply-local-patch="handleApplyLocalPatch"
            @apply-improvement="handleApplyImprovement"
            @clear="handleClearEvaluation"
            @retry="evaluationHandler.handleReEvaluate"
        />

        <!-- 子模式本地预览面板：不再依赖 PromptOptimizerApp 的全局预览状态 -->
        <PromptPreviewPanel
            v-model:show="showPromptPreview"
            :previewContent="previewContent"
            :missingVariables="missingVariables"
            :hasMissingVariables="hasMissingVariables"
            :variableStats="variableStats"
            :contextMode="previewContextMode"
            :renderPhase="previewRenderPhase"
        />
    </div>
</template>

<script setup lang="ts">
/**
 * 上下文模式 - 用户提示词工作区组件
 *
 * @description
 * 用于优化单条用户提示词的工作区界面,采用左右分栏布局:
 * - 左侧: 提示词输入 + 优化结果展示
 * - 右侧: 测试区域 (变量输入 + 测试执行)
 *
 * @features
 * - 🆕 完全独立的优化和测试逻辑（使用专属 composables）
 * - 支持提示词优化和迭代
 * - 支持版本管理和历史记录
 * - 支持变量系统 (全局变量 + 测试临时变量)
 * - 🆕 支持文本选择并提取为变量 (用户模式独有)
 * - 🆕 使用 composable 管理临时变量，无需 props 传递
 * - 支持工具调用配置
 * - 支持响应式布局
 *
 * @example
 * ```vue
 * <ContextUserWorkspace
 *   :optimization-mode="optimizationMode"
 *   :selected-optimize-model="modelKey"
 *   :selected-template="template"
 *   :global-variables="globalVars"
 * />
 * ```
 */
import { ref, reactive, computed, inject, nextTick, watch, onMounted, onUnmounted, toRef, type Ref } from 'vue'

import { useI18n } from "vue-i18n";
import { NCard, NFlex, NText, NIcon, NButton, NSelect, NRadioGroup, NRadioButton, NTooltip, NTag } from "naive-ui";
import { useToast } from "../../composables/ui/useToast";
import InputPanelUI from "../InputPanel.vue";
import PromptPanelUI from "../PromptPanel.vue";
import PromptPreviewPanel from "../PromptPreviewPanel.vue";
import ContextUserTestPanel from "./ContextUserTestPanel.vue";
import OutputDisplay from "../OutputDisplay.vue";
import SelectWithConfig from "../SelectWithConfig.vue";
import { EvaluationPanel, EvaluationScoreBadge } from '../evaluation'
import {
    applyPatchOperationsToText,
    PREDEFINED_VARIABLES,
    type ContextMode,
    type OptimizationMode,
    type PatchOperation,
    type PromptRecord,
    type PromptRecordChain,
    type Template,
    type ProUserEvaluationContext,
} from "@prompt-optimizer/core";
import type { TestAreaPanelInstance } from "../types/test-area";
import type { IteratePayload, SaveFavoritePayload } from "../../types/workspace";
import type { AppServices } from '../../types/services';
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager';
import { useTemporaryVariables } from "../../composables/variable/useTemporaryVariables";
import { useLocalPromptPreviewPanel } from '../../composables/prompt/useLocalPromptPreviewPanel'
import { useVariableAwareInputBridge } from '../../composables/variable/useVariableAwareInputBridge'
import { useContextUserOptimization } from '../../composables/prompt/useContextUserOptimization';
import type { ConversationMessage } from '../../types/variable'
import { useEvaluationHandler, provideEvaluation, provideProContext } from '../../composables/prompt';
import {
    useProVariableSession,
    type TestPanelVersionValue,
    type TestVariantConfig,
    type TestVariantId,
    type TestColumnCount,
} from '../../stores/session/useProVariableSession';
import { useWorkspaceModelSelection } from '../../composables/workspaces/useWorkspaceModelSelection';
import { useWorkspaceTemplateSelection } from '../../composables/workspaces/useWorkspaceTemplateSelection';
import { OptionAccessors } from '../../utils/data-transformer';
import { useElementSize } from '@vueuse/core'
import { buildPromptExecutionContext, hashString, hashVariables } from '../../utils/prompt-variables'

// ========================
// Props 定义
// ========================
interface Props {
    // --- ✅ 已移除：模型和模板配置（现在从 session store 直接读取）---
    // ✅ 已移除：optimizationMode - 改为内部常量

    /** 测试模型名称（用于显示标签） */
    testModelName?: string;
    /** 🆕 评估模型（用于变量提取和变量值生成） */
    evaluationModelKey?: string;

    // --- 测试数据 ---
    /** 是否启用对比模式 */
    isCompareMode: boolean;
    /** 是否正在执行测试（兼容性保留，实际由内部管理）*/
    isTestRunning?: boolean;
    /** 🆕 是否正在执行AI变量提取 */
    isExtracting?: boolean;

    // --- 变量数据 ---
    /** 全局变量 (持久化存储) - 保留，用于变量检测 */
    globalVariables: Record<string, string>;
    /** 预定义变量 (系统内置) - 保留，用于变量检测 */
    predefinedVariables: Record<string, string>;

    // --- 响应式布局配置 ---
    /** 按钮尺寸 */
    buttonSize?: "small" | "medium" | "large";
    /** 对话历史最大高度 */
    conversationMaxHeight?: number;
    /** 结果区域是否垂直布局 */
    resultVerticalLayout?: boolean;
}

interface ContextUserHistoryPayload {
    record: PromptRecord;
    chain: PromptRecordChain;
    rootPrompt?: string;
}

const props = withDefaults(defineProps<Props>(), {
    testModelName: undefined,
    evaluationModelKey: undefined,
    isTestRunning: false,
    isExtracting: false,
    globalVariables: () => ({}),
    predefinedVariables: () => ({}),
    buttonSize: "medium",
    conversationMaxHeight: 300,
    resultVerticalLayout: false,
});

// ========================
// Emits 定义
// ========================
const emit = defineEmits<{
    // --- 数据更新事件 ---
    "update:selectedIterateTemplate": [value: Template | null];
    "update:isCompareMode": [value: boolean];

    // --- 操作事件 ---
    /** 切换对比模式 */
    "compare-toggle": [];
    /** 保存到收藏 */
    "save-favorite": [data: SaveFavoritePayload];

    // --- 打开面板/管理器 ---
    /** 打开变量管理器 */
    "open-variable-manager": [];
    /** 打开模板管理器 */
    "open-template-manager": [type?: string];
    /** 配置模型 */
    "config-model": [];

    // --- 预览相关 ---
    /** 打开输入预览 */
    "open-input-preview": [];
    /** 打开提示词预览 */
    "open-prompt-preview": [];

    // --- 变量管理 ---
    /** 变量值变化 */
    "variable-change": [name: string, value: string];
    /** 保存测试变量到全局 */
    "save-to-global": [name: string, value: string];
    /** 🆕 AI变量提取事件 */
    "extract-variables": [];
    /** 🆕 变量提取事件 (用于处理文本选择提取的变量) */
    "variable-extracted": [
        data: {
            variableName: string;
            variableValue: string;
            variableType: "global" | "temporary";
        },
    ];
}>();

const { t } = useI18n();
const toast = useToast();

// ========================
// 内部常量
// ========================
/** 优化模式：固定为 'user'（此组件专门用于用户提示词优化） */
const optimizationMode: OptimizationMode = 'user';

// ========================
// 注入服务和变量管理器
// ========================
const injectedServices = inject<Ref<AppServices | null>>('services');
const servicesRef = injectedServices ?? ref<AppServices | null>(null)
const variableManager = inject<VariableManagerHooks | null>('variableManager', null);

// ========================
// 内部状态管理
// ========================

// 输入区折叠状态（初始展开）
const isInputPanelCollapsed = ref(false);

// ========================
// 分析状态
// ========================
/** 是否正在执行分析 */
const isAnalyzing = ref(false);

/** 🆕 使用全局临时变量管理器 (从文本提取的变量,仅当前会话有效) */
const tempVarsManager = useTemporaryVariables();
const temporaryVariables = tempVarsManager.temporaryVariables;

// ========================
// 子模式本地提示词预览（不经过 PromptOptimizerApp）
// ========================
const previewContextMode = computed<ContextMode>(() => 'user')

const globalVariables = computed<Record<string, string>>(
    () => variableManager?.customVariables.value || props.globalVariables || {},
)

const predefinedVariables = computed<Record<string, string>>(() => {
    const originalPrompt = (contextUserOptimization.prompt || '').trim()
    const lastOptimizedPrompt = (contextUserOptimization.optimizedPrompt || '').trim()
    const currentPrompt = (lastOptimizedPrompt || originalPrompt).trim()

    const map: Record<string, string> = {}
    PREDEFINED_VARIABLES.forEach((name) => {
        map[name] = ''
    })

    map.originalPrompt = originalPrompt
    map.lastOptimizedPrompt = lastOptimizedPrompt
    map.currentPrompt = currentPrompt
    map.userQuestion = currentPrompt

    return map
})

// Priority: global < temporary < predefined (predefined is treated as reserved/system variables)
const previewVariables = computed<Record<string, string>>(() => ({
    ...globalVariables.value,
    ...(temporaryVariables.value || {}),
    ...predefinedVariables.value,
}))

const {
    show: showPromptPreview,
    renderPhase: previewRenderPhase,
    previewContent,
    missingVariables,
    hasMissingVariables,
    variableStats,
    open: openPromptPreview,
} = useLocalPromptPreviewPanel(previewVariables, previewContextMode)

const handleOpenInputPreview = () => {
    openPromptPreview(contextUserOptimization.prompt || '', { renderPhase: 'optimize' })
}

const handleOpenPromptPreview = () => {
    openPromptPreview(contextUserOptimization.optimizedPrompt || '', { renderPhase: 'optimize' })
}

// Pro-user（变量模式）以 session store 为唯一真源（可持久化字段）
const proVariableSession = useProVariableSession();

// ==================== 主布局：可拖拽分栏（左侧 25%~50%） ====================

const splitRootRef = ref<HTMLElement | null>(null)
const testPaneRef = ref<HTMLElement | null>(null)

const clampLeftPct = (pct: number) => Math.min(50, Math.max(25, pct))

// 使用本地 draft，避免拖拽过程频繁写入持久化存储
const mainSplitLeftPct = ref<number>(50)
watch(
    () => proVariableSession.layout.mainSplitLeftPct,
    (pct) => {
        if (typeof pct === 'number' && Number.isFinite(pct)) {
            mainSplitLeftPct.value = clampLeftPct(Math.round(pct))
        }
    },
    { immediate: true },
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

    proVariableSession.setMainSplitLeftPct(mainSplitLeftPct.value)
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

    proVariableSession.setMainSplitLeftPct(mainSplitLeftPct.value)
}

onUnmounted(() => {
    endSplitDrag()
})

// ✨ 新增：直接使用 session store 管理模型和模板选择
const modelSelection = useWorkspaceModelSelection(servicesRef, proVariableSession)
const templateSelection = useWorkspaceTemplateSelection(
    servicesRef,
    proVariableSession,
    'contextUserOptimize',
    'contextIterate'
)

// Variable value generation uses ContextUserTestPanel and requires a model key.
// If the app-level evaluation model key isn't configured, fall back to the selected optimize model.
const effectiveEvaluationModelKey = computed(() => {
    return props.evaluationModelKey || modelSelection.selectedOptimizeModelKey.value || ''
})

const patchSessionOptimizedResult = (
    partial: Partial<{
        optimizedPrompt: string;
        reasoning: string;
        chainId: string;
        versionId: string;
    }>,
) => {
    proVariableSession.updateOptimizedResult({
        optimizedPrompt:
            partial.optimizedPrompt ??
            proVariableSession.optimizedPrompt ??
            "",
        reasoning: partial.reasoning ?? proVariableSession.reasoning ?? "",
        chainId: partial.chainId ?? proVariableSession.chainId ?? "",
        versionId: partial.versionId ?? proVariableSession.versionId ?? "",
    });
};

const sessionPrompt = computed<string>({
    get: () => proVariableSession.prompt ?? "",
    set: (value) => proVariableSession.updatePrompt(value || ""),
});

const sessionOptimizedPrompt = computed<string>({
    get: () => proVariableSession.optimizedPrompt ?? "",
    set: (value) => patchSessionOptimizedResult({ optimizedPrompt: value || "" }),
});

const sessionOptimizedReasoning = computed<string>({
    get: () => proVariableSession.reasoning ?? "",
    set: (value) => patchSessionOptimizedResult({ reasoning: value || "" }),
});

const sessionChainId = computed<string>({
    get: () => proVariableSession.chainId ?? "",
    set: (value) => patchSessionOptimizedResult({ chainId: value || "" }),
});

const sessionVersionId = computed<string>({
    get: () => proVariableSession.versionId ?? "",
    set: (value) => patchSessionOptimizedResult({ versionId: value || "" }),
});

// 🔧 为 SelectWithConfig 的 v-model 创建解包的 computed（避免 Vue prop 类型警告）
const selectedOptimizeModelKeyModel = computed({
    get: () => modelSelection.selectedOptimizeModelKey.value,
    set: (value) => { modelSelection.selectedOptimizeModelKey.value = value }
})

const selectedTemplateIdModel = computed({
    get: () => templateSelection.selectedTemplateId.value,
    set: (value) => { templateSelection.selectedTemplateId.value = value }
})

const selectedIterateTemplate = computed<Template | null>({
    get: () => templateSelection.selectedIterateTemplate.value,
    set: (value) => {
        templateSelection.selectedIterateTemplateId.value = value?.id ?? ''
        templateSelection.selectedIterateTemplate.value = value ?? null
    }
})

// 🆕 初始化 ContextUser 专属优化器
const contextUserOptimization = useContextUserOptimization(
    servicesRef,
    modelSelection.selectedOptimizeModelKey,
    templateSelection.selectedTemplate,
    templateSelection.selectedIterateTemplate,
    {
        prompt: sessionPrompt as unknown as Ref<string>,
        optimizedPrompt: sessionOptimizedPrompt as unknown as Ref<string>,
        optimizedReasoning: sessionOptimizedReasoning as unknown as Ref<string>,
        currentChainId: sessionChainId as unknown as Ref<string>,
        currentVersionId: sessionVersionId as unknown as Ref<string>,
    },
);

// 提示词摘要（折叠态显示）
const promptSummary = computed(() => {
    const prompt = contextUserOptimization.prompt;
    if (!prompt) return '';
    return prompt.length > 50
        ? prompt.slice(0, 50) + '...'
        : prompt;
});

// ==================== 测试区：多列 variants（共享变量） ====================

const getVariant = (id: TestVariantId): TestVariantConfig | undefined => {
    const list = proVariableSession.testVariants as unknown as TestVariantConfig[]
    return Array.isArray(list) ? list.find(v => v.id === id) : undefined
}

const testColumnCountModel = computed<TestColumnCount>({
    get: () => {
        const raw = proVariableSession.layout.testColumnCount
        return raw === 2 || raw === 3 || raw === 4 ? raw : 2
    },
    set: (value) => proVariableSession.setTestColumnCount(value),
})

const variantAVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('a')?.version ?? 0,
    set: (value) => proVariableSession.updateTestVariant('a', { version: value }),
})

const variantBVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('b')?.version ?? 'latest',
    set: (value) => proVariableSession.updateTestVariant('b', { version: value }),
})

const variantCVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('c')?.version ?? 'latest',
    set: (value) => proVariableSession.updateTestVariant('c', { version: value }),
})

const variantDVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('d')?.version ?? 'latest',
    set: (value) => proVariableSession.updateTestVariant('d', { version: value }),
})

const variantAModelKeyModel = computed<string>({
    get: () => getVariant('a')?.modelKey ?? '',
    set: (value) => proVariableSession.updateTestVariant('a', { modelKey: value }),
})

const variantBModelKeyModel = computed<string>({
    get: () => getVariant('b')?.modelKey ?? '',
    set: (value) => proVariableSession.updateTestVariant('b', { modelKey: value }),
})

const variantCModelKeyModel = computed<string>({
    get: () => getVariant('c')?.modelKey ?? '',
    set: (value) => proVariableSession.updateTestVariant('c', { modelKey: value }),
})

const variantDModelKeyModel = computed<string>({
    get: () => getVariant('d')?.modelKey ?? '',
    set: (value) => proVariableSession.updateTestVariant('d', { modelKey: value }),
})

const ALL_VARIANT_IDS: TestVariantId[] = ['a', 'b', 'c', 'd']
const activeVariantIds = computed<TestVariantId[]>(() => ALL_VARIANT_IDS.slice(0, testColumnCountModel.value))

const variantVersionModels = {
    a: variantAVersionModel,
    b: variantBVersionModel,
    c: variantCVersionModel,
    d: variantDVersionModel,
} as const

const variantModelKeyModels = {
    a: variantAModelKeyModel,
    b: variantBModelKeyModel,
    c: variantCModelKeyModel,
    d: variantDModelKeyModel,
} as const

// pro-variable 变量优先级：global < temporary < predefined
const mergedTestVariables = computed<Record<string, string>>(() => ({
    ...(globalVariables.value || {}),
    ...(temporaryVariables.value || {}),
    ...(predefinedVariables.value || {}),
}))

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
    { immediate: true },
)

const testGridTemplateColumns = computed(() => `repeat(${testColumnCountModel.value}, minmax(0, 1fr))`)

type ResolvedTestPrompt = { text: string; resolvedVersion: number }

const resolveTestPrompt = (selection: TestPanelVersionValue): ResolvedTestPrompt => {
    const v0 = contextUserOptimization.prompt || ''
    const versions = contextUserOptimization.currentVersions || []
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

// 版本选项：仅显示“原始(v0)”与“最新(latest)”，若存在中间版本，则额外显示 v1..v(n-1)。
const versionOptions = computed(() => {
    const versions = contextUserOptimization.currentVersions || []

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

        const seed = proVariableSession.selectedTestModelKey && keys.has(proVariableSession.selectedTestModelKey)
            ? proVariableSession.selectedTestModelKey
            : fallback

        for (const id of ALL_VARIANT_IDS) {
            const current = variantModelKeyModels[id].value
            if (!current || !keys.has(current)) {
                proVariableSession.updateTestVariant(id, { modelKey: seed })
            }
        }
    },
    { immediate: true },
)

const resolvedOriginalTestPrompt = computed(() => resolveTestPrompt(variantAVersionModel.value))
const resolvedOptimizedTestPrompt = computed(() => resolveTestPrompt(variantBVersionModel.value))

// Pinia setup store 会自动解包 refs，这里是直接可变的响应式对象（非 Ref）
const variantResults = proVariableSession.testVariantResults
const variantLastRunFingerprint = proVariableSession.testVariantLastRunFingerprint

const variantRunning = reactive<Record<TestVariantId, boolean>>({
    a: false,
    b: false,
    c: false,
    d: false,
})

const isAnyVariantRunning = computed(() => activeVariantIds.value.some((id) => !!variantRunning[id]))

const getVariantLabel = (id: TestVariantId) => ({ a: 'A', b: 'B', c: 'C', d: 'D' }[id])

const getVariantVersionTestId = (id: TestVariantId) => {
    if (id === 'a') return 'pro-variable-test-original-version-select'
    if (id === 'b') return 'pro-variable-test-optimized-version-select'
    return `pro-variable-test-variant-${id}-version-select`
}

const getVariantModelTestId = (id: TestVariantId) => {
    if (id === 'a') return 'pro-variable-test-original-model-select'
    if (id === 'b') return 'pro-variable-test-optimized-model-select'
    return `pro-variable-test-variant-${id}-model-select`
}

const getVariantRunTestId = (id: TestVariantId) => `pro-variable-test-run-${id}`

const getVariantOutputTestId = (id: TestVariantId) => {
    if (id === 'a') return 'pro-variable-test-original-output'
    if (id === 'b') return 'pro-variable-test-optimized-output'
    return `pro-variable-test-variant-${id}-output`
}

const getVariantResult = (id: TestVariantId) => variantResults[id]
const hasVariantResult = (id: TestVariantId) => !!(variantResults[id]?.result || '').trim()

const getVariantFingerprint = (id: TestVariantId) => {
    const selection = variantVersionModels[id].value
    const resolved = resolveTestPrompt(selection)
    const modelKey = variantModelKeyModels[id].value || ''
    const promptHash = hashString((resolved.text || '').trim())
    const baseVars = variableManager?.allVariables.value || {}
    const varsForFingerprint = {
        ...baseVars,
        ...mergedTestVariables.value,
        currentPrompt: (resolved.text || '').trim(),
        userQuestion: (resolved.text || '').trim(),
    }
    const varsHash = hashVariables(varsForFingerprint)
    return `${String(selection)}:${resolved.resolvedVersion}:${modelKey}:${promptHash}:${varsHash}`
}

const isVariantStale = (id: TestVariantId) => {
    if (!hasVariantResult(id)) return false
    const prev = variantLastRunFingerprint[id]
    if (!prev) return false
    return prev !== getVariantFingerprint(id)
}

type VariantTestInput = {
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

    const resolved = resolveTestPrompt(variantVersionModels[id].value)
    const userPrompt = (resolved.text || '').trim()
    if (!userPrompt) {
        const key = resolved.resolvedVersion === 0 ? 'test.error.noOriginalPrompt' : 'test.error.noOptimizedPrompt'
        toast.error(t(key))
        return null
    }

    return { userPrompt, modelKey, resolvedVersion: resolved.resolvedVersion }
}

const runVariant = async (
    id: TestVariantId,
    opts?: {
        silentSuccess?: boolean
        silentError?: boolean
        skipClearEvaluation?: boolean
        persist?: boolean
        allowParallel?: boolean
    },
): Promise<boolean> => {
    if (variantRunning[id]) return false
    if (!opts?.allowParallel && isAnyVariantRunning.value) return false

    const promptService = servicesRef.value?.promptService
    if (!promptService) {
        toast.error(t('toast.error.serviceInit'))
        return false
    }

    const input = getVariantTestInput(id)
    if (!input) return false

    const userPrompt = input.userPrompt

    const baseVars = variableManager?.allVariables.value || {}
    const variables = {
        ...baseVars,
        ...mergedTestVariables.value,
        currentPrompt: userPrompt,
        userQuestion: userPrompt,
    }

    const ctx = buildPromptExecutionContext(userPrompt, variables)
    if (ctx.forbiddenTemplateSyntax.length > 0) {
        toast.error(t('test.error.forbiddenTemplateSyntax'))
        return false
    }
    if (ctx.missingVariables.length > 0) {
        toast.error(t('test.error.missingVariables', { vars: ctx.missingVariables.join(', ') }))
        return false
    }

    if (!opts?.skipClearEvaluation) {
        evaluationHandler.clearBeforeTest()
    }

    variantResults[id] = { result: '', reasoning: '' }
    variantRunning[id] = true

    try {
        const messages: ConversationMessage[] = [
            { role: 'user' as const, content: ctx.renderedContent },
        ]

        await promptService.testCustomConversationStream(
            {
                modelKey: input.modelKey,
                messages,
                variables,
                tools: [],
            },
            {
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
            },
        )

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
            void proVariableSession.saveSession()
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
            }),
        ),
    )

    void proVariableSession.saveSession()

    if (results.every(Boolean)) {
        toast.success(t('toast.success.testComplete'))
    } else {
        toast.error(t('toast.error.testFailed'))
    }
}

// ========================
// Pro-user（变量模式）测试：改为多列 variants，结果与配置由 session store 持久化
// ========================
onMounted(() => {
    // ✅ 刷新模型列表
    modelSelection.refreshTextModels()
});

const proContext = computed<ProUserEvaluationContext | undefined>(() => {
    const tempVars = temporaryVariables.value;
    const globalVars = globalVariables.value;
    const predefinedVars = predefinedVariables.value;
    const rawPrompt = resolvedOriginalTestPrompt.value.text;
    const resolvedPrompt = resolvedOptimizedTestPrompt.value.text;

    // 扫描提示词中实际使用的变量名
    // 同时扫描原始提示词和优化后的提示词，确保覆盖所有使用的变量
    const usedVarNames = new Set<string>();

    // 使用 variableManager 扫描变量
    if (variableManager?.variableManager.value) {
        const vm = variableManager.variableManager.value;
        // 扫描原始提示词中的变量
        if (rawPrompt) {
            vm.scanVariablesInContent(rawPrompt).forEach(name => usedVarNames.add(name));
        }
        // 扫描优化后提示词中的变量
        if (resolvedPrompt) {
            vm.scanVariablesInContent(resolvedPrompt).forEach(name => usedVarNames.add(name));
        }
    } else {
        // 回退方案：使用正则表达式扫描 {{varName}} 格式的变量
        // 允许两侧空格，但变量名内部不允许空白（支持中文等 Unicode 变量名）
        const varPattern = /\{\{\s*([^{}\s]+)\s*\}\}/gu;
        let match;
        if (rawPrompt) {
          while ((match = varPattern.exec(rawPrompt)) !== null) {
            const name = match[1]?.trim();
            if (name) usedVarNames.add(name);
          }
        }
        if (resolvedPrompt) {
          varPattern.lastIndex = 0; // 重置正则表达式
          while ((match = varPattern.exec(resolvedPrompt)) !== null) {
            const name = match[1]?.trim();
            if (name) usedVarNames.add(name);
          }
        }
    }

    // 只收集实际使用的变量
    const usedVariables: ProUserEvaluationContext['variables'] = [];

    // 按优先级顺序添加变量（预定义 > 临时 > 全局）
    usedVarNames.forEach(name => {
        // 预定义变量优先级最高（保留名不可被覆盖）
        if (predefinedVars[name] !== undefined) {
            usedVariables.push({ name, value: predefinedVars[name], source: 'predefined' });
        }
        // 其次是临时变量
        else if (tempVars[name] !== undefined) {
            usedVariables.push({ name, value: tempVars[name], source: 'temporary' });
        }
        // 最后是全局变量
        else if (globalVars[name] !== undefined) {
            usedVariables.push({ name, value: globalVars[name], source: 'global' });
        }
        // 变量未定义时仍然记录，标记为临时变量但值为空
        else {
            usedVariables.push({ name, value: '', source: 'temporary' });
        }
    });

    return {
        variables: usedVariables,
        rawPrompt: rawPrompt,
        resolvedPrompt: resolvedPrompt,
    };
});

// 🆕 提供 Pro 模式上下文给子组件（如 PromptPanel），用于评估时传递变量解析上下文
provideProContext(proContext);

// 🆕 测试结果数据
const testResultsData = computed(() => ({
    originalResult: variantResults.a.result || undefined,
    optimizedResult: variantResults.b.result || undefined,
}));

// 🆕 计算当前迭代需求（用于 prompt-iterate 的 re-evaluate）
const currentIterateRequirement = computed(() => {
    const versions = contextUserOptimization.currentVersions;
    const versionId = contextUserOptimization.currentVersionId;
    if (!versions || versions.length === 0 || !versionId) return '';
    const currentVersion = versions.find((v) => v.id === versionId);
    return currentVersion?.iterationNote || '';
});

// 🆕 初始化评估处理器（使用全局 evaluation 实例，避免双套状态）
const evaluationHandler = useEvaluationHandler({
    services: servicesRef,
    originalPrompt: computed(() => resolvedOriginalTestPrompt.value.text),
    optimizedPrompt: computed(() => resolvedOptimizedTestPrompt.value.text),
    testContent: computed(() => ''), // 变量模式不需要单独的测试内容，通过变量系统管理
    testResults: testResultsData,
    evaluationModelKey: effectiveEvaluationModelKey,
    functionMode: computed(() => 'pro'),
    subMode: computed(() => 'variable'),
    proContext,
    currentIterateRequirement,
    persistedResults: toRef(proVariableSession, 'evaluationResults'),
});

provideEvaluation(evaluationHandler.evaluation)

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

const handleEvaluate = async (type: 'original' | 'optimized' | 'compare') => {
    await handleEvaluateInternal(type)
}

const showDetail = (type: 'original' | 'optimized' | 'compare') => {
    evaluation.showDetail(type)
}

const handleApplyLocalPatch = (payload: { operation: PatchOperation }) => {
    if (!payload.operation) return
    const current = contextUserOptimization.optimizedPrompt || ''
    const result = applyPatchOperationsToText(current, payload.operation)
    if (!result.ok) {
        toast.warning(t('toast.warning.patchApplyFailed'))
        return
    }

    contextUserOptimization.optimizedPrompt = result.text
    toast.success(t('evaluation.diagnose.applyFix'))
}

const handleClearEvaluation = () => {
    evaluation.closePanel()
    evaluation.clearAllResults()
}

// ========================
// 变量感知输入（InputPanel 变量提取/缺失变量）
// ========================
const {
    variableInputData: inputPanelVariableData,
    handleVariableExtracted,
    handleAddMissingVariable,
} = useVariableAwareInputBridge({
    enabled: computed(() => true),
    isReady: computed(() => variableManager?.isReady.value ?? true),
    globalVariables,
    temporaryVariables: computed(() => ({ ...temporaryVariables.value })),
    predefinedVariables,
    saveGlobalVariable: (name, value) => {
        if (variableManager?.isReady.value) {
            variableManager.addVariable(name, value)
        }
        emit('save-to-global', name, value)
    },
    saveTemporaryVariable: (name, value) => tempVarsManager.setVariable(name, value),
    afterVariableExtracted: (data) => emit('variable-extracted', data),
    logPrefix: 'ContextUserWorkspace',
})

const handleSaveToGlobalFromTest = (name: string, value: string) => {
    if (variableManager?.isReady.value) {
        variableManager.addVariable(name, value)
    }
    emit('save-to-global', name, value)
}

/** 变量提示文本，包含双花括号示例，避免模板解析误判 */
const doubleBraceToken = "{{}}";
const variableGuideInlineHint = computed(() =>
    t("variableGuide.inlineHint", { doubleBraces: doubleBraceToken }),
);

// ========================
// 组件引用
// ========================
/** TestAreaPanel 组件引用,用于获取测试变量 */
const testAreaPanelRef = ref<TestAreaPanelInstance | null>(null);

/** PromptPanel 组件引用,用于打开迭代弹窗 */
const promptPanelRef = ref<InstanceType<typeof PromptPanelUI> | null>(null);

// ========================
// 事件处理
// ========================
// handleVariableExtracted / handleAddMissingVariable are provided by useVariableAwareInputBridge

/**
 * 🆕 处理AI变量提取事件
 *
 * 当用户点击"AI提取变量"按钮时触发
 *
 * 工作流程:
 * 1. 验证提示词内容和模型选择
 * 2. 收集已存在的变量名（全局+临时）
 * 3. 触发父组件的extract-variables事件
 * 4. 父组件调用AI服务并显示结果对话框
 */
const handleExtractVariables = () => {
    // 触发父组件事件，由App层处理AI提取逻辑
    emit('extract-variables');
};

/**
 * 🆕 同步测试区域对临时变量的修改
 *
 * 作用:
 * - 确保测试区域新增/编辑的变量能够参与左侧输入框的缺失变量检测
 * - 向父组件转发事件,保持既有对外接口不变
 */
const handleTestVariableChange = (name: string, value: string) => {
    // 🆕 使用 composable 方法设置变量
    tempVarsManager.setVariable(name, value);
    emit("variable-change", name, value);
};

/**
 * 🆕 测试区域移除临时变量时的处理
 */
const handleTestVariableRemove = (name: string) => {
    tempVarsManager.deleteVariable(name);
    emit("variable-change", name, "");
};

/**
 * 🆕 清空测试区域临时变量时的处理
 */
const handleClearTemporaryVariables = () => {
    // 🆕 使用 composable 方法清空所有临时变量
    const removedNames = Object.keys(temporaryVariables.value);
    tempVarsManager.clearAll();
    removedNames.forEach((name) => emit("variable-change", name, ""));
};

/**
 * 🆕 处理优化事件
 */
const handleOptimize = () => {
    if (isAnalyzing.value) return;
    contextUserOptimization.optimize();
};

/**
 * 处理分析操作
 * - 清空版本链，创建 V0（与优化同级）
 * - 不写入历史（分析不产生新提示词）
 * - 触发 prompt-only 评估
 */
const handleAnalyze = async () => {
    const prompt = contextUserOptimization.prompt;
    if (!prompt?.trim()) return;
    if (contextUserOptimization.isOptimizing) return;

    isAnalyzing.value = true;

    // 1. 清空版本链，创建虚拟 V0
    contextUserOptimization.handleAnalyze();

    // 2. 清理旧的提示词评估结果，避免跨提示词残留
    evaluationHandler.evaluation.clearResult('prompt-only');
    evaluationHandler.evaluation.clearResult('prompt-iterate');

    // 3. 收起输入区域
    isInputPanelCollapsed.value = true;

    await nextTick();

    // 4. 触发 prompt-only 评估
    try {
        await evaluationHandler.handleEvaluate('prompt-only');
    } finally {
        isAnalyzing.value = false;
    }
};

/**
 * 🆕 处理迭代优化事件
 */
const handleIterate = (payload: IteratePayload) => {
    contextUserOptimization.iterate({
        originalPrompt: contextUserOptimization.prompt,
        optimizedPrompt: contextUserOptimization.optimizedPrompt,
        iterateInput: payload.iterateInput
    });
};

/**
 * 🆕 处理版本切换事件
 */
const handleSwitchVersion = (version: PromptRecord) => {
    contextUserOptimization.switchVersion(version);
};

/**
 * 🆕 处理 V0 切换事件
 */
const handleSwitchToV0 = (version: PromptRecord) => {
    contextUserOptimization.switchToV0(version);
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isContextUserHistoryPayload = (
    value: unknown,
): value is ContextUserHistoryPayload => {
    if (!isObjectRecord(value)) return false;

    const rootPrompt = value.rootPrompt;
    const record = value.record;
    const chain = value.chain;

    if (typeof rootPrompt !== "undefined" && typeof rootPrompt !== "string") return false;
    if (!isObjectRecord(record) || typeof record.id !== "string") return false;
    if (
        !isObjectRecord(chain) ||
        typeof chain.chainId !== "string" ||
        !Array.isArray(chain.versions)
    ) {
        return false;
    }

    return true;
};

const restoreFromHistory = (payload: unknown) => {
    if (!isContextUserHistoryPayload(payload)) {
        console.warn(
            "[ContextUserWorkspace] Invalid history payload, ignored:",
            payload,
        );
        return;
    }
    contextUserOptimization.loadFromHistory(payload);
};

// 🆕 处理应用改进建议事件（使用 evaluationHandler 提供的工厂方法）
const handleApplyImprovement = evaluationHandler.createApplyImprovementHandler(promptPanelRef);

// 处理保存本地编辑
const handleSaveLocalEdit = async (payload: { note?: string }) => {
    await contextUserOptimization.saveLocalEdit({
        optimizedPrompt: contextUserOptimization.optimizedPrompt || '',
        note: payload.note,
        source: 'manual',
    });
};

// 暴露 TestAreaPanel 引用给父组件（用于工具调用等高级功能）
defineExpose({
    testAreaPanelRef,
    restoreFromHistory,
    contextUserOptimization,  // 🆕 暴露优化器状态，供父组件访问（如AI变量提取）
    temporaryVariables,        // 🆕 暴露临时变量，供父组件访问
    // 🆕 提供最小可用的公开 API，避免父组件依赖内部实现细节（不再需要不安全的类型强转访问内部状态）
    setPrompt: (prompt: string) => {
        contextUserOptimization.prompt = prompt;
    },
    getPrompt: () => contextUserOptimization.prompt || '',
    getOptimizedPrompt: () => contextUserOptimization.optimizedPrompt || '',
    getTemporaryVariableNames: () => Object.keys(temporaryVariables.value || {}),
    openIterateDialog: (initialContent?: string) => {
        promptPanelRef.value?.openIterateDialog?.(initialContent);
    },
    applyLocalPatch: (operation: PatchOperation) => {
        handleApplyLocalPatch({ operation })
    },
    reEvaluateActive: async () => {
        await evaluationHandler.handleReEvaluate();
    },
});
</script>

<style scoped>
.context-user-workspace {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.context-user-split {
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
