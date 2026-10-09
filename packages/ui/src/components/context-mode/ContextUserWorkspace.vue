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
        <div class="workspace-page-tools">
            <WorkspaceUtilityMenu
                :disabled="contextUserOptimization.isOptimizing || contextUserOptimization.isIterating || isAnyVariantRunning"
                :source="resolveSourceAssetRef(proVariableSession.origin, proVariableSession.assetBinding)"
                test-id="pro-variable-workspace-utility-menu"
                @clear="handleClearContent"
            />
        </div>
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
            <TestSourceLinkedCard
                style="flex-shrink: 0;"
                :feedback-key="sourceAreaFeedback.original.key"
                :feedback-tone="sourceAreaFeedback.original.tone"
                :source-tone="sourceAreaFeedback.original.sourceTone"
            >
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
                      @configModel="handleOpenModelManager"
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
                    <template #model-label-extra>
                        <TextModelQuickSwitch
                            :model-key="selectedOptimizeModelKeyModel"
                            :options="modelSelection.textModelOptions.value"
                            :refresh-models="modelSelection.refreshTextModels"
                            :disabled="contextUserOptimization.isOptimizing"
                        />
                    </template>

                    <template #model-select>
                        <SelectWithConfig
                            v-model="selectedOptimizeModelKeyModel"
                            :options="modelSelection.textModelOptions.value"
                            :getPrimary="OptionAccessors.getPrimary"
                            :getSecondary="OptionAccessors.getSecondary"
                            :getValue="OptionAccessors.getValue"
                            :placeholder="t('model.select.placeholder')"
                            size="medium"
                            :disabled="contextUserOptimization.isOptimizing"
                            filterable
                            :show-config-action="true"
                            :show-empty-config-c-t-a="true"
                            @focus="modelSelection.refreshTextModels"
                            @config="handleOpenModelManager"
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
                            :placeholder="t('template.select')"
                            size="medium"
                            :disabled="contextUserOptimization.isOptimizing"
                            filterable
                            :show-config-action="true"
                            :show-empty-config-c-t-a="true"
                            @focus="templateSelection.refreshOptimizeTemplates"
                            @config="handleOpenTemplateManager"
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
            </TestSourceLinkedCard>

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
            <TestSourceLinkedCard
                style="flex: 1; min-height: 200px; overflow: hidden"
                content-style="height: 100%; max-height: 100%; overflow: hidden;"
                :feedback-key="sourceAreaFeedback.workspace.key"
                :feedback-tone="sourceAreaFeedback.workspace.tone"
                :source-tone="sourceAreaFeedback.workspace.sourceTone"
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
                    :source-feedback-key="sourceAreaFeedback.workspace.key"
                    :source-feedback-tone="sourceAreaFeedback.workspace.tone"
                    :source-feedback-version="sourceAreaFeedback.workspace.resolvedVersion"
                      :optimization-mode="optimizationMode"
                       :advanced-mode-enabled="true"
                       :show-preview="true"
                      @iterate="handleIterate"
                      @openTemplateManager="handleOpenTemplateManager"
                      @switchVersion="handleSwitchVersion"
                      @switchToV0="handleSwitchToV0"
                     @save-favorite="handleSaveFavorite"
                     @open-preview="handleOpenPromptPreview"
                     @apply-improvement="handleApplyImprovement"
                     @apply-patch="handleApplyLocalPatch"
                     @save-local-edit="handleSaveLocalEdit"
                 />
            </TestSourceLinkedCard>
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
                        @open-variable-manager="handleOpenVariableManager"
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

                                <template v-if="hasCompareCandidates || hasCompareEvaluation">
                                    <EvaluationScoreBadge
                                        v-if="hasCompareEvaluation || isEvaluatingCompare"
                                        :score="compareScore"
                                        :level="compareScoreLevel"
                                        :loading="isEvaluatingCompare"
                                        :result="compareEvaluationResult"
                                        type="compare"
                                        :stale="isCompareEvaluationStale"
                                        :stale-message="t('evaluation.stale.compare')"
                                        :disable-evaluate="!canEvaluateCompare"
                                        :disable-evaluate-reason="compareDisabledReason"
                                        size="small"
                                        @show-detail="() => showDetail('compare')"
                                        @evaluate="() => handleEvaluate('compare')"
                                        @evaluate-with-feedback="handleEvaluateWithFeedback"
                                        @apply-improvement="handleApplyImprovement"
                                        @apply-patch="handleApplyLocalPatch"
                                    />
                                    <FocusAnalyzeButton
                                        v-else
                                        type="compare"
                                        :label="t('evaluation.compareEvaluate')"
                                        :disabled="!canEvaluateCompare"
                                        :disabled-reason="compareDisabledReason"
                                        :loading="isEvaluatingCompare"
                                        :button-props="{ size: 'small', type: 'tertiary' }"
                                        @evaluate="() => handleEvaluate('compare')"
                                        @evaluate-with-feedback="handleEvaluateWithFeedback"
                                    >
                                        <template #icon>
                                            <AnalyzeActionIcon />
                                        </template>
                                    </FocusAnalyzeButton>
                                </template>
                                <CompareHelpButton v-if="activeVariantIds.length >= 2" />
                                <NTag
                                    v-if="compareToolbarStatus"
                                    size="small"
                                    :type="compareToolbarStatus.type"
                                    :bordered="false"
                                >
                                    {{ compareToolbarStatus.label }}
                                </NTag>
                            </NFlex>
                        </div>
                    </NCard>

                    <!-- 配置区：与结果列对齐 -->
                    <NCard size="small" :style="{ flexShrink: 0 }">
                        <div class="variant-deck" :style="{ gridTemplateColumns: testGridTemplateColumns }">
                            <div v-for="id in activeVariantIds" :key="id" class="variant-cell">
                                <div
                                    class="variant-cell__controls"
                                    :class="{ 'variant-cell__controls--stacked': useStackedVariantControls }"
                                >
                                    <div class="variant-cell__meta">
                                        <TestVariantSourceTag
                                            class="variant-cell__label"
                                            :variant-label="getVariantLabel(id)"
                                            :selection="variantVersionModels[id].value"
                                            :resolved-version="getVariantResolvedVersion(id)"
                                            :labels="getTestPanelVersionLabels()"
                                            :feedback-key="variantSourceFeedback[id].key"
                                            :feedback-tone="variantSourceFeedback[id].tone"
                                            @activate="activateVariantSource(id)"
                                        />
                                        <CompareRoleBadge
                                            v-if="activeVariantIds.length >= 2"
                                            :entry="compareRoleEntryMap[id]"
                                            clickable
                                            @click="openCompareRoleConfig"
                                        />
                                        <TextModelQuickSwitch
                                            :model-key="variantModelKeyModels[id].value"
                                            :options="modelSelection.textModelOptions.value"
                                            :refresh-models="modelSelection.refreshTextModels"
                                            :disabled="variantRunning[id] || isAnyVariantRunning"
                                        />
                                    </div>

                                    <div class="variant-cell__actions">
                                        <TestPanelVersionSelect
                                            :value="variantVersionModels[id].value"
                                            :options="versionOptions"
                                            :disabled="variantRunning[id] || isAnyVariantRunning"
                                            :test-id="getVariantVersionTestId(id)"
                                            @update:value="(value) => handleVariantVersionChange(id, value)"
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
                                                :placeholder="t('model.select.placeholder')"
                                                size="medium"
                                                :disabled="variantRunning[id] || isAnyVariantRunning"
                                                filterable
                                                :show-config-action="true"
                                                :show-empty-config-c-t-a="true"
                                                @focus="modelSelection.refreshTextModels"
                                                @config="emit('config-model')"
                                                style="min-width: 0; width: 100%;"
                                            />
                                        </div>

                                        <div class="variant-cell__run">
                                            <ThemedTooltip :label="t('test.layout.runThisColumn')">
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
                                            </ThemedTooltip>
                                        </div>
                                    </div>
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
                                        <div v-if="hasVariantResult(id)" class="output-evaluation-entry">
                                            <SaveTestResultExampleButton
                                                sub-mode-key="pro-variable"
                                                :variant-id="id"
                                                :content="contextUserOptimization.optimizedPrompt || contextUserOptimization.prompt || ''"
                                                :original-content="contextUserOptimization.prompt || ''"
                                                function-mode="context"
                                                optimization-mode="user"
                                                :disabled="variantRunning[id]"
                                                :test-id="`save-test-example-pro-variable-${id}`"
                                            />
                                            <EvaluationScoreBadge
                                                v-if="getResultEvaluationProps(id).hasEvaluation || getResultEvaluationProps(id).isEvaluating"
                                                :score="getResultEvaluationProps(id).score"
                                                :level="getResultEvaluationProps(id).scoreLevel"
                                                :loading="getResultEvaluationProps(id).isEvaluating"
                                                :result="getResultEvaluationProps(id).evaluationResult"
                                                type="result"
                                                :stale="isResultEvaluationStale(id)"
                                                :stale-message="t('evaluation.stale.result')"
                                                :disable-evaluate="!canEvaluateResult"
                                                size="small"
                                                @show-detail="() => showResultDetail(id)"
                                                @evaluate="() => handleEvaluateResult(id)"
                                                @evaluate-with-feedback="handleResultEvaluateWithFeedbackEvent(id, $event)"
                                                @apply-improvement="handleApplyImprovement"
                                                @apply-patch="handleApplyLocalPatch"
                                            />
                                            <FocusAnalyzeButton
                                                v-else
                                                type="result"
                                                variant="toolbar"
                                                :label="t('evaluation.evaluate')"
                                                :disabled="!canEvaluateResult"
                                                :loading="getResultEvaluationProps(id).isEvaluating"
                                                :button-props="{ size: 'small', quaternary: true, circle: true }"
                                                @evaluate="() => handleEvaluateResult(id)"
                                                @evaluate-with-feedback="handleResultEvaluateWithFeedbackEvent(id, $event)"
                                            >
                                                <template #icon>
                                                    <AnalyzeActionIcon />
                                                </template>
                                            </FocusAnalyzeButton>
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
            :rewrite-recommendation="panelProps.rewriteRecommendation"
            :rewrite-reasons="panelProps.rewriteReasons"
            :stale="activeEvaluationStale"
            :stale-message="activeEvaluationStaleMessage"
            :disable-evaluate="activeEvaluationDisableEvaluate"
            :disable-evaluate-reason="activeEvaluationDisableReason"
            :can-rewrite-from-evaluation="true"
            @re-evaluate="handleReEvaluateActive"
            @evaluate-with-feedback="handleEvaluateActiveWithFeedback"
            @apply-local-patch="handleApplyLocalPatch"
            @apply-improvement="handleApplyImprovement"
            @rewrite-from-evaluation="handleRewriteFromEvaluation"
            @clear="handleClearEvaluation"
            @retry="handleReEvaluateActive"
        />
        <CompareRoleConfigDialog
            v-model="compareRoleConfig.showDialog.value"
            :entries="compareRoleConfig.entries.value"
            :manual-roles="compareRoleConfig.validManualRoles.value"
            :require-target-selection="compareRoleConfig.requiresExplicitTargetSelection.value"
            @confirm="handleCompareRoleConfigConfirm"
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
import { storeToRefs } from 'pinia'

import { useI18n } from "vue-i18n";
import { NCard, NFlex, NText, NIcon, NButton, NRadioGroup, NRadioButton, NTag } from "naive-ui";
import { useToast } from "../../composables/ui/useToast";
import InputPanelUI from "../InputPanel.vue";
import PromptPanelUI from "../PromptPanel.vue";
import PromptPreviewPanel from "../PromptPreviewPanel.vue";
import ContextUserTestPanel from "./ContextUserTestPanel.vue";
import OutputDisplay from "../OutputDisplay.vue";
import SaveTestResultExampleButton from '../SaveTestResultExampleButton.vue'
import SelectWithConfig from "../SelectWithConfig.vue";
import TextModelQuickSwitch from "../TextModelQuickSwitch.vue";
import TestPanelVersionSelect from '../TestPanelVersionSelect.vue'
import TestSourceLinkedCard from '../TestSourceLinkedCard.vue'
import TestVariantSourceTag from '../TestVariantSourceTag.vue'
import {
    AnalyzeActionIcon,
    CompareHelpButton,
    CompareRoleBadge,
    CompareRoleConfigDialog,
    EvaluationPanel,
    EvaluationScoreBadge,
    FocusAnalyzeButton,
} from '../evaluation'
import { buildCompareToolbarStatus } from '../evaluation/compare-ui'
import WorkspaceUtilityMenu from '../common/WorkspaceUtilityMenu.vue'
import ThemedTooltip from '../common/ThemedTooltip.vue'
import { resolveSourceAssetRef } from '../../utils/source-asset'
import {
    applyPatchOperationsToText,
    PREDEFINED_VARIABLES,
    type ContextMode,
    type EvaluationType,
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
import type { PersistedCompareSnapshotRoles } from '../../types/evaluation'
import { useTemporaryVariables } from "../../composables/variable/useTemporaryVariables";
import { useLocalPromptPreviewPanel } from '../../composables/prompt/useLocalPromptPreviewPanel'
import { useVariableAwareInputBridge } from '../../composables/variable/useVariableAwareInputBridge'
import { useContextUserOptimization } from '../../composables/prompt/useContextUserOptimization';
import type { ConversationMessage } from '../../types/variable'
import { useCompareRoleConfig, useEvaluationHandler, provideEvaluation, provideProContext, buildCompareEvaluationPayload, useTestSourceAreaFeedback, useTestVariantSourceFeedback } from '../../composables/prompt';
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
import { runTasksWithExecutionMode } from '../../utils/runTasksSequentially'
import {
    buildTestPanelVersionPromptRef,
    buildTestPanelVersionOptions,
    formatTestPanelVersionSelectionLabel,
    resolveTestPanelVersionSelection,
} from '../../utils/testPanelVersion'
import {
    collectReferencedBusinessVariableNames,
    formatVariableEvidenceEntries,
} from '../../utils/evaluationVariableEvidence'

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

// 注入 App 层统一的 open* 接口（与 Basic/Image 工作区保持一致）
const appOpenModelManager = inject<
    ((tab?: 'text' | 'image' | 'function') => void) | null
>('openModelManager', null)
const appOpenTemplateManager = inject<((type?: string) => void) | null>(
    'openTemplateManager',
    null,
)

// 注入 App 层统一的 Pro 工作区接口
const appOpenVariableManager = inject<((variableName?: string) => void) | null>('openVariableManager', null)
const appHandleSaveFavorite = inject<((data: SaveFavoritePayload) => void) | null>('handleSaveFavorite', null)
const appSaveToGlobal = inject<((name: string, value: string) => void) | null>('saveToGlobal', null)

const handleOpenModelManager = () => {
    if (appOpenModelManager) {
        appOpenModelManager('text')
        return
    }
    emit('config-model')
}

const handleOpenTemplateManager = (typeOrPayload?: string | Record<string, unknown>) => {
    // SelectWithConfig 的 @config 可能会传入 payload（非字符串），这里统一兜底处理。
    const type = typeof typeOrPayload === 'string' ? typeOrPayload : undefined
    if (appOpenTemplateManager) {
        appOpenTemplateManager(type || 'optimize')
        return
    }
    emit('open-template-manager', type)
}

const handleSaveFavorite = (data: SaveFavoritePayload) => {
    if (appHandleSaveFavorite) { appHandleSaveFavorite(data); return; }
    emit('save-favorite', data)
}

const handleOpenVariableManager = () => {
    if (appOpenVariableManager) { appOpenVariableManager(); return; }
    emit('open-variable-manager')
}

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

    if (typeof window !== 'undefined') {
        window.removeEventListener('pro-workspace-refresh-text-models', refreshTextModelsHandler)
        window.removeEventListener('pro-workspace-refresh-templates', refreshTemplatesHandler)
    }
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
    return props.evaluationModelKey || modelSelection.selectedOptimizeModelKey.value ||
        variantBModelKeyModel.value || variantAModelKeyModel.value || proVariableSession.selectedTestModelKey || ''
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
        clearSessionContent: () => proVariableSession.clearContent(),
        clearAssetBinding: () => proVariableSession.clearAssetBinding(),
        getSourceBindingSession: () => proVariableSession,
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
    get: () => getVariant('b')?.version ?? 'workspace',
    set: (value) => proVariableSession.updateTestVariant('b', { version: value }),
})

const variantCVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('c')?.version ?? 'workspace',
    set: (value) => proVariableSession.updateTestVariant('c', { version: value }),
})

const variantDVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('d')?.version ?? 'workspace',
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
const useStackedVariantControls = computed(() => activeVariantIds.value.length >= 2)

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
    const resolved = resolveTestPanelVersionSelection({
        selection,
        versions: contextUserOptimization.currentVersions || [],
        currentVersionId: contextUserOptimization.currentVersionId,
        workspacePrompt: contextUserOptimization.optimizedPrompt || '',
        originalPrompt: contextUserOptimization.prompt || '',
    })

    return {
        text: resolved.text,
        resolvedVersion: resolved.resolvedVersion,
    }
}

const getTestPanelVersionLabels = () => ({
    workspace: t('test.layout.workspace'),
    previous: t('test.layout.previous'),
    original: t('test.layout.original'),
})

// 版本选项：默认显示“工作区”与“原始(v0)”；存在可用上一版时显示“上一版(vN)”动态别名。
const versionOptions = computed(() => {
    return buildTestPanelVersionOptions(
        contextUserOptimization.currentVersions || [],
        getTestPanelVersionLabels(),
        {
            currentVersionId: contextUserOptimization.currentVersionId,
            workspacePrompt: contextUserOptimization.optimizedPrompt || '',
            originalPrompt: contextUserOptimization.prompt || '',
        },
    )
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

// Pinia setup store 会自动解包 refs。
// testVariantResults / testVariantLastRunFingerprint 在 restoreSession 时会被整对象替换，
// 这里必须通过 storeToRefs 持有 Ref，避免组件继续写入旧对象。
const {
    testVariantResults: variantResults,
    testVariantLastRunFingerprint: variantLastRunFingerprint,
} = storeToRefs(proVariableSession)

const variantRunning = reactive<Record<TestVariantId, boolean>>({
    a: false,
    b: false,
    c: false,
    d: false,
})

const { variantSourceFeedback, pulseVariantSource } =
    useTestVariantSourceFeedback<TestVariantId>(['a', 'b', 'c', 'd'])
const { sourceAreaFeedback, pulseSourceAreaForSelection } =
    useTestSourceAreaFeedback()

const isAnyVariantRunning = computed(() => activeVariantIds.value.some((id) => !!variantRunning[id]))

const getVariantLabel = (id: TestVariantId) => ({ a: 'A', b: 'B', c: 'C', d: 'D' }[id])

const handleVariantVersionChange = (id: TestVariantId, value: string | number) => {
    const selection = value as TestPanelVersionValue
    variantVersionModels[id].value = selection
    activateVariantSource(id)
}

const activateVariantSource = (id: TestVariantId) => {
    const selection = variantVersionModels[id].value
    const resolved = resolveTestPrompt(selection)
    pulseVariantSource(id, 'change')
    pulseSourceAreaForSelection(selection, resolved.resolvedVersion, 'change')
}

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

const getVariantResult = (id: TestVariantId) => variantResults.value[id]
const hasVariantResult = (id: TestVariantId) => !!(variantResults.value[id]?.result || '').trim()

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
    const prev = variantLastRunFingerprint.value[id]
    if (!prev) return false
    return prev !== getVariantFingerprint(id)
}

const getVariantVersionLabel = (id: TestVariantId): string => {
    const selection = variantVersionModels[id].value
    const resolved = resolveTestPrompt(selection)
    return formatTestPanelVersionSelectionLabel(
        selection,
        resolved.resolvedVersion,
        getTestPanelVersionLabels(),
    )
}

const getVariantResolvedVersion = (id: TestVariantId): number =>
    resolveTestPrompt(variantVersionModels[id].value).resolvedVersion

const compareReadyVariantIds = computed(() =>
    activeVariantIds.value.filter((id) => hasVariantResult(id) && !isVariantStale(id))
)

const hasCompareCandidates = computed(() => compareReadyVariantIds.value.length >= 2)
const compareRoleCandidates = computed(() =>
    activeVariantIds.value.map((id) => ({
        id,
        label: getVariantLabel(id),
        promptRef: buildVariantPromptRef(id),
        promptText: resolveTestPrompt(variantVersionModels[id].value).text,
        modelKey: variantModelKeyModels[id].value,
        versionLabel: getVariantVersionLabel(id),
    }))
)
const compareRoleConfig = useCompareRoleConfig({
    candidates: compareRoleCandidates,
    persistedRoles: toRef(proVariableSession, 'compareSnapshotRoles'),
    persistedRoleSignatures: toRef(proVariableSession, 'compareSnapshotRoleSignatures'),
    persistRoles: (roles, signatures) => proVariableSession.updateCompareSnapshotRoles(roles, signatures),
})
const compareRoleEntryMap = computed(() =>
    Object.fromEntries(compareRoleConfig.entries.value.map((entry) => [entry.id, entry]))
)
const compareToolbarStatus = computed(() =>
    activeVariantIds.value.length >= 2
        ? buildCompareToolbarStatus(
            t,
            compareRoleConfig.requiresExplicitTargetSelection.value,
            compareRoleConfig.requiresManualRoleReview.value,
        )
        : null
)
const resultEvaluationFingerprint = reactive<Record<TestVariantId, string>>({
    a: '',
    b: '',
    c: '',
    d: '',
})
const compareEvaluationFingerprint = ref('')

const buildCompareEvaluationFingerprint = () =>
    compareReadyVariantIds.value
        .map((id) => `${id}:${getVariantFingerprint(id)}`)
        .join('|')

const hasWorkspaceCompareCandidate = computed(() =>
    compareReadyVariantIds.value.some((id) => buildVariantPromptRef(id).kind === 'workspace')
)

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
        const key = variantVersionModels[id].value === 'workspace'
            ? 'test.error.noWorkspacePrompt'
            : resolved.resolvedVersion === 0
                ? 'test.error.noOriginalPrompt'
                : 'test.error.noOptimizedPrompt'
        toast.error(t(key))
        pulseVariantSource(id, 'error')
        pulseSourceAreaForSelection(variantVersionModels[id].value, resolved.resolvedVersion, 'error')
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

    variantResults.value[id] = { result: '', reasoning: '' }
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
                    const prev = variantResults.value[id]
                    variantResults.value[id] = { ...prev, result: (prev.result || '') + token }
                },
                onReasoningToken: (token: string) => {
                    const prev = variantResults.value[id]
                    variantResults.value[id] = { ...prev, reasoning: (prev.reasoning || '') + token }
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
        variantLastRunFingerprint.value[id] = getVariantFingerprint(id)
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
    const results = await runTasksWithExecutionMode(
        ids,
        async (id) =>
            runVariant(id, {
                silentSuccess: true,
                silentError: true,
                skipClearEvaluation: true,
                allowParallel: true,
                persist: false,
            }),
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
const refreshTextModelsHandler = async () => {
    try {
        await modelSelection.refreshTextModels()
    } catch (e) {
        console.warn('[ContextUserWorkspace] Failed to refresh text models after manager close:', e)
    }
}

const refreshTemplatesHandler = async () => {
    try {
        await templateSelection.refreshOptimizeTemplates()
        await templateSelection.refreshIterateTemplates()
    } catch (e) {
        console.warn('[ContextUserWorkspace] Failed to refresh templates after template manager update:', e)
    }
}

onMounted(() => {
    // ✅ 刷新模型列表
    void refreshTextModelsHandler()

    if (typeof window !== 'undefined') {
        window.addEventListener('pro-workspace-refresh-text-models', refreshTextModelsHandler)
        window.addEventListener('pro-workspace-refresh-templates', refreshTemplatesHandler)
    }
});

const collectUsedVariableNames = (...prompts: string[]) => {
    const usedVarNames = new Set<string>();

    if (variableManager?.variableManager.value) {
        const vm = variableManager.variableManager.value;
        prompts.forEach((prompt) => {
            if (!prompt) return;
            vm.scanVariablesInContent(prompt).forEach((name) => usedVarNames.add(name));
        });
        return usedVarNames;
    }

    const varPattern = /\{\{\s*([^{}\s]+)\s*\}\}/gu;
    prompts.forEach((prompt) => {
        if (!prompt) return;
        varPattern.lastIndex = 0;
        let match;
        while ((match = varPattern.exec(prompt)) !== null) {
            const name = match[1]?.trim();
            if (name) usedVarNames.add(name);
        }
    });

    return usedVarNames;
};

const buildUsedVariables = (
    names: Set<string>,
    options?: {
        includeValues?: boolean
        predefinedOverrides?: Record<string, string>
    },
): ProUserEvaluationContext['variables'] => {
    const includeValues = options?.includeValues ?? true;
    const predefinedOverrides = options?.predefinedOverrides || {};
    const tempVars = temporaryVariables.value;
    const globalVars = globalVariables.value;
    const predefinedVars = predefinedVariables.value;
    const usedVariables: ProUserEvaluationContext['variables'] = [];

    names.forEach((name) => {
        if (predefinedVars[name] !== undefined || predefinedOverrides[name] !== undefined) {
            usedVariables.push({
                name,
                value: includeValues
                    ? (predefinedOverrides[name] ?? predefinedVars[name] ?? '')
                    : undefined,
                source: 'predefined',
            });
        } else if (tempVars[name] !== undefined) {
            usedVariables.push({
                name,
                value: includeValues ? tempVars[name] : undefined,
                source: 'temporary',
            });
        } else if (globalVars[name] !== undefined) {
            usedVariables.push({
                name,
                value: includeValues ? globalVars[name] : undefined,
                source: 'global',
            });
        } else {
            usedVariables.push({
                name,
                value: includeValues ? '' : undefined,
                source: 'temporary',
            });
        }
    });

    return usedVariables;
};

const analysisProContext = computed<ProUserEvaluationContext | undefined>(() => {
    const currentWorkspacePrompt = contextUserOptimization.optimizedPrompt || '';
    const usedVarNames = collectUsedVariableNames(currentWorkspacePrompt);

    return {
        variables: buildUsedVariables(usedVarNames, { includeValues: false }),
        rawPrompt: currentWorkspacePrompt,
    };
});

const formatVariableEntries = (
    variables: ProUserEvaluationContext['variables'],
): string => variables
    .map((variable) => `${variable.name}=${String(variable.value ?? '')}`)
    .join('\n');

const proContext = computed<ProUserEvaluationContext | undefined>(() => {
    const rawPrompt = resolvedOriginalTestPrompt.value.text;
    const resolvedPrompt = resolvedOptimizedTestPrompt.value.text;
    const usedVarNames = collectUsedVariableNames(rawPrompt, resolvedPrompt);

    return {
        variables: buildUsedVariables(usedVarNames, { includeValues: true }),
        rawPrompt: rawPrompt,
        resolvedPrompt: resolvedPrompt,
    };
});

// 左侧分析只提供变量结构，不注入右侧测试值
provideProContext(analysisProContext);

const buildEvaluationTarget = () => {
    const workspacePrompt = contextUserOptimization.optimizedPrompt || '';
    const referencePrompt = (contextUserOptimization.prompt || '').trim();
    const normalizedWorkspacePrompt = workspacePrompt.trim();

    return {
        workspacePrompt,
        referencePrompt:
            referencePrompt && referencePrompt !== normalizedWorkspacePrompt
                ? contextUserOptimization.prompt
                : undefined,
    };
};

const buildVariantPromptRef = (id: TestVariantId) => {
    const selection = variantVersionModels[id].value;
    const resolved = resolveTestPanelVersionSelection({
        selection,
        versions: contextUserOptimization.currentVersions || [],
        currentVersionId: contextUserOptimization.currentVersionId,
        workspacePrompt: contextUserOptimization.optimizedPrompt || '',
        originalPrompt: contextUserOptimization.prompt || '',
    });
    return buildTestPanelVersionPromptRef(resolved, getTestPanelVersionLabels());
};

const buildResultVariableInputVariables = (
    id: TestVariantId,
): ProUserEvaluationContext['variables'] => {
    const promptText = resolveTestPrompt(variantVersionModels[id].value).text
    const relevantNames = new Set(collectReferencedBusinessVariableNames(promptText))
    return buildUsedVariables(relevantNames, { includeValues: true })
}

const buildResultVariableTestCaseContent = (id: TestVariantId): string =>
    formatVariableEvidenceEntries(
        buildResultVariableInputVariables(id),
        t('evaluation.syntheticInput.noExplicitVariables'),
    )

const buildCompareVariableInputVariables = (): ProUserEvaluationContext['variables'] => {
    const relevantNames = new Set<string>();
    const collectRelevantNames = (promptText: string) => {
        collectReferencedBusinessVariableNames(promptText).forEach((name) => {
            relevantNames.add(name);
        });
    };

    compareReadyVariantIds.value.forEach((id) => {
        collectRelevantNames(resolveTestPrompt(variantVersionModels[id].value).text);
    });

    if (!relevantNames.size) {
        collectRelevantNames(buildEvaluationTarget().workspacePrompt);
    }

    return buildUsedVariables(relevantNames, { includeValues: true });
};

const buildSharedVariableTestCaseDraft = () => {
    const variables = buildCompareVariableInputVariables();

    return {
        id: 'shared-variable-test-case',
        label: t('variables.management.variables'),
        input: {
            kind: 'variables' as const,
            label: t('variables.management.variables'),
            content: variables.length
                ? formatVariableEntries(variables)
                : t('evaluation.syntheticInput.noExplicitVariables'),
        },
    };
};

const comparePayload = computed(() =>
    buildCompareEvaluationPayload({
        target: buildEvaluationTarget(),
        testCases: [buildSharedVariableTestCaseDraft()],
        snapshotRolesOverride: compareRoleConfig.validManualRoles.value,
        snapshots: compareReadyVariantIds.value.map((id) => ({
            id,
            label: getVariantLabel(id),
            testCaseId: 'shared-variable-test-case',
            promptRef: buildVariantPromptRef(id),
            promptText: resolveTestPrompt(variantVersionModels[id].value).text,
            output: variantResults.value[id]?.result || '',
            reasoning: variantResults.value[id]?.reasoning || '',
            modelKey: variantModelKeyModels[id].value,
            versionLabel: getVariantVersionLabel(id),
        })),
    }),
);

const hasEvaluationWorkspacePrompt = computed(() => !!contextUserOptimization.optimizedPrompt.trim())
const canEvaluateResult = computed(() => hasEvaluationWorkspacePrompt.value)
const canEvaluateCompare = computed(() => !!comparePayload.value)
const compareDisabledReason = computed(() => {
    if (canEvaluateCompare.value) {
        return ''
    }

    if ((hasCompareCandidates.value || hasCompareEvaluation.value) && !hasWorkspaceCompareCandidate.value) {
        return t('evaluation.compareUnavailable.missingWorkspace')
    }

    return ''
})

// 🆕 计算当前迭代需求（用于 prompt-iterate 的 re-evaluate）
const currentIterateRequirement = computed(() => {
    const versions = contextUserOptimization.currentVersions;
    const versionId = contextUserOptimization.currentVersionId;
    if (!versions || versions.length === 0 || !versionId) return '';
    const currentVersion = versions.find((v) => v.id === versionId);
    return currentVersion?.iterationNote || '';
});

const resultEvaluationTargets = computed(() =>
    Object.fromEntries(
        activeVariantIds.value.map((id) => [
            id,
            {
                variantId: id,
                target: buildEvaluationTarget(),
                testCase: {
                    id: `${id}-variable-test-case`,
                    label: t('variables.management.variables'),
                    input: {
                        kind: 'variables' as const,
                        label: t('variables.management.variables'),
                        content: buildResultVariableTestCaseContent(id),
                    },
                },
                snapshot: {
                    id,
                    label: getVariantLabel(id),
                    testCaseId: `${id}-variable-test-case`,
                    promptRef: buildVariantPromptRef(id),
                    promptText: resolveTestPrompt(variantVersionModels[id].value).text,
                    output: variantResults.value[id]?.result || '',
                    reasoning: variantResults.value[id]?.reasoning || '',
                    modelKey: variantModelKeyModels[id].value || undefined,
                    versionLabel: getVariantVersionLabel(id),
                },
            },
        ]),
    ),
)

// 🆕 初始化评估处理器（使用全局 evaluation 实例，避免双套状态）
const evaluationHandler = useEvaluationHandler({
    services: servicesRef,
    analysisOptimizedPrompt: computed(() => contextUserOptimization.optimizedPrompt || ''),
    resultTargets: resultEvaluationTargets,
    evaluationModelKey: effectiveEvaluationModelKey,
    functionMode: computed(() => 'pro'),
    subMode: computed(() => 'variable'),
    proContext,
    analysisContext: analysisProContext,
    comparePayload,
    currentIterateRequirement,
    persistedResults: toRef(proVariableSession, 'evaluationResults'),
});

provideEvaluation(evaluationHandler.evaluation)

const { evaluation, handleEvaluate: handleEvaluateInternal } = evaluationHandler
const panelProps = evaluationHandler.panelProps
const getResultEvaluationProps = (variantId: string) => evaluationHandler.getResultEvaluationProps(variantId)

// 对比评估状态
const isEvaluatingCompare = evaluationHandler.compareEvaluation.isEvaluatingCompare
const compareScore = computed(() => evaluationHandler.compareEvaluation.compareScore.value ?? 0)
const hasCompareEvaluation = evaluationHandler.compareEvaluation.hasCompareResult
const compareEvaluationResult = computed(() => evaluation.state['compare'].result)
const compareScoreLevel = computed(() =>
    evaluation.getScoreLevel(evaluationHandler.compareEvaluation.compareScore.value ?? null)
)
const activeEvaluationStale = computed(() => {
    if (panelProps.value.currentType === 'compare') {
        return isCompareEvaluationStale.value
    }

    if (
        panelProps.value.currentType === 'result'
        && panelProps.value.currentVariantId
        && panelProps.value.currentVariantId in resultEvaluationFingerprint
    ) {
        return isResultEvaluationStale(panelProps.value.currentVariantId as TestVariantId)
    }

    return false
})
const activeEvaluationStaleMessage = computed(() => {
    if (panelProps.value.currentType === 'compare') {
        return t('evaluation.stale.compare')
    }

    if (panelProps.value.currentType === 'result') {
        return t('evaluation.stale.result')
    }

    return t('evaluation.stale.default')
})
const activeEvaluationDisableEvaluate = computed(() => {
    if (panelProps.value.currentType === 'compare') {
        return !canEvaluateCompare.value
    }

    if (panelProps.value.currentType === 'result') {
        return !canEvaluateResult.value
    }

    return false
})
const activeEvaluationDisableReason = computed(() => {
    if (panelProps.value.currentType === 'compare') {
        return compareDisabledReason.value
    }

    return ''
})

const ensureEvaluationWorkspaceReady = (): boolean => {
    if (!hasEvaluationWorkspacePrompt.value) {
        toast.error(t('test.error.noWorkspacePrompt'))
        return false
    }

    return true
}

const ensureCompareEvaluationReady = (): boolean => {
    if (!ensureEvaluationWorkspaceReady()) {
        return false
    }

  if (!comparePayload.value) {
    return false
  }

  if (
    compareRoleConfig.requiresExplicitTargetSelection.value ||
    compareRoleConfig.requiresManualRoleReview.value
  ) {
    compareRoleConfig.openDialog({ runCompareAfterConfirm: true })
    return false
  }

    return true
}

const isResultEvaluationStale = (id: TestVariantId) => {
    const props = getResultEvaluationProps(id)
    if (!props.hasEvaluation) return false

    const storedFingerprint = resultEvaluationFingerprint[id]
    if (!storedFingerprint) return false

    return storedFingerprint !== getVariantFingerprint(id)
}

const isCompareEvaluationStale = computed(() => {
    if (!hasCompareEvaluation.value) return false
    if (!compareEvaluationFingerprint.value) return false
    return compareEvaluationFingerprint.value !== buildCompareEvaluationFingerprint()
})

const handleEvaluateResult = async (variantId: string) => {
    if (!ensureEvaluationWorkspaceReady()) return

    await handleEvaluateInternal('result', { variantId })

    if (evaluation.state.result[variantId]?.result && variantId in resultEvaluationFingerprint) {
        resultEvaluationFingerprint[variantId as TestVariantId] = getVariantFingerprint(variantId as TestVariantId)
    }
}

const handleResultEvaluateWithFeedback = async (variantId: string, feedback: string) => {
    if (!ensureEvaluationWorkspaceReady()) return

    await evaluationHandler.handleEvaluateWithFeedback('result', feedback, { variantId })

    if (evaluation.state.result[variantId]?.result && variantId in resultEvaluationFingerprint) {
        resultEvaluationFingerprint[variantId as TestVariantId] = getVariantFingerprint(variantId as TestVariantId)
    }
}

const handleResultEvaluateWithFeedbackEvent = async (
    variantId: string,
    payload: { feedback: string },
) => {
    await handleResultEvaluateWithFeedback(variantId, payload.feedback)
}

const handleEvaluate = async (type: 'compare') => {
    if (!ensureCompareEvaluationReady()) return

    await handleEvaluateInternal(type)

    if (evaluation.state.compare.result) {
        compareEvaluationFingerprint.value = buildCompareEvaluationFingerprint()
    }
}

const handleEvaluateWithFeedback = async (payload: {
    type: EvaluationType
    feedback: string
}) => {
    if (payload.type === 'compare' && !ensureCompareEvaluationReady()) {
        return
    }

    await evaluationHandler.handleEvaluateWithFeedback(payload.type, payload.feedback)

    if (payload.type === 'compare' && evaluation.state.compare.result) {
        compareEvaluationFingerprint.value = buildCompareEvaluationFingerprint()
    }
}

const handleReEvaluateActive = async () => {
    const active = evaluation.state.activeDetail
    if (!active) return

    if (active.type === 'compare' && !ensureCompareEvaluationReady()) {
        return
    }

    if (active.type === 'result' && !ensureEvaluationWorkspaceReady()) {
        return
    }

    await evaluationHandler.handleReEvaluate()
}

const handleEvaluateActiveWithFeedback = async (payload: { feedback: string }) => {
    const active = evaluation.state.activeDetail
    if (!active) return

    if (active.type === 'compare' && !ensureCompareEvaluationReady()) {
        return
    }

    if (active.type === 'result' && !ensureEvaluationWorkspaceReady()) {
        return
    }

    await evaluationHandler.handleEvaluateActiveWithFeedback(payload.feedback)
}

const showResultDetail = (variantId: string) => {
    evaluation.showDetail('result', variantId)
}

const showDetail = (type: 'compare') => {
    evaluation.showDetail(type)
}

const openCompareRoleConfig = () => {
    compareRoleConfig.openDialog()
}

const handleCompareRoleConfigConfirm = async (
    roles: PersistedCompareSnapshotRoles<TestVariantId>,
) => {
    const requiresTargetSelectionOnConfirm =
        compareRoleCandidates.value.filter((candidate) => candidate.promptRef.kind === 'workspace').length > 1

    if (
        requiresTargetSelectionOnConfirm &&
        !Object.values(roles).includes('target')
    ) {
        toast.warning(t('evaluation.compareConfig.targetRequired'))
        return
    }

    await compareRoleConfig.saveRoles(roles)
    compareRoleConfig.closeDialog()

    if (compareRoleConfig.consumePendingCompareAfterConfirm()) {
        await handleEvaluate('compare')
    }
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
    resultEvaluationFingerprint.a = ''
    resultEvaluationFingerprint.b = ''
    resultEvaluationFingerprint.c = ''
    resultEvaluationFingerprint.d = ''
    compareEvaluationFingerprint.value = ''
}

const handleClearContent = () => {
    contextUserOptimization.clearContent()
    handleClearEvaluation()
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
        if (appSaveToGlobal) { appSaveToGlobal(name, value); return; }
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
    if (appSaveToGlobal) { appSaveToGlobal(name, value); return; }
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
const handleRewriteFromEvaluation = evaluationHandler.createRewriteFromEvaluationHandler(promptPanelRef);

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
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: visible;
}

.workspace-page-tools {
    display: contents;
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
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
    flex-wrap: wrap;
}

.variant-cell__controls--stacked {
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    flex-wrap: nowrap;
}

.variant-cell__meta {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex-wrap: wrap;
}

.variant-cell__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1 1 auto;
}

.variant-cell__label {
    flex-shrink: 0;
}

.variant-cell__role {
    flex-shrink: 0;
}

.variant-cell__stale {
    flex-shrink: 0;
}

.variant-cell__model {
    flex: 1 1 auto;
    min-width: 0;
}

.variant-cell__run {
    flex-shrink: 0;
}

.output-evaluation-entry {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    white-space: nowrap;
    margin-right: -2px;
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
