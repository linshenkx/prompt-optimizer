<template>
    <div class="context-system-workspace" data-testid="workspace" data-mode="pro-multi">
        <div class="workspace-page-tools">
            <WorkspaceUtilityMenu
                :disabled="displayAdapter.displayedIsOptimizing.value || isIterating || isAnyVariantRunning"
                :source="resolveSourceAssetRef(proMultiSession.origin, proMultiSession.assetBinding)"
                test-id="pro-multi-workspace-utility-menu"
                @clear="handleClearContent"
            />
        </div>
        <div
            ref="splitRootRef"
            class="context-system-split"
            :style="{ gridTemplateColumns: `${mainSplitLeftPct}% 12px 1fr` }"
        >
            <!-- 左侧：优化区域 -->
            <div class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
                <NFlex
                    vertical
                    :style="{ overflow: 'auto', height: '100%', minHeight: 0 }"
                    :size="12"
                >
                    <!-- 会话管理器 (系统模式专属，也是消息输入界面) -->
                    <TestSourceLinkedCard
                        :style="{ flexShrink: 0, overflow: 'auto' }"
                        content-style="padding: 0;"
                        :feedback-key="sourceAreaFeedback.original.key"
                        :feedback-tone="sourceAreaFeedback.original.tone"
                        :source-tone="sourceAreaFeedback.original.sourceTone"
                    >
                        <ConversationManager
                            :messages="conversationMessages"
                            @update:messages="handleConversationMessagesUpdated"
                            @message-change="(index, message, action) => {
                                // Pro Multi：新增/更新消息后自动选中最新消息，确保“优化”按钮可用
                                if ((action === 'add' || action === 'update') && (message.role === 'system' || message.role === 'user') && message.id) {
                                    void conversationOptimization.selectMessage(message)
                                }
                                emit('message-change', index, message, action)
                            }"
                            :available-variables="availableVariables"
                            :temporary-variables="tempVars.temporaryVariables.value"
                            :scan-variables="scanVariables"
                            :optimization-mode="optimizationMode"
                            :tool-count="toolCount"
                            @open-variable-manager="handleOpenVariableManager"
                            @open-context-editor="handleOpenContextEditor"
                            @open-tool-manager="handleOpenToolManager"
                            :enable-tool-management="true"
                            :collapsible="true"
                            :max-height="300"
                            :selected-message-id="selectedMessageId"
                            :enable-message-optimization="enableMessageOptimization"
                            :is-message-optimizing="conversationOptimization.isOptimizing.value"
                            @message-select="conversationOptimization.selectMessage"
                            @optimize-message="handleOptimizeClick"
                            @variable-extracted="handleVariableExtracted"
                            @add-missing-variable="handleAddMissingVariable"
                        />
                    </TestSourceLinkedCard>

                    <!-- 优化控制区 -->
                    <NCard :style="{ flexShrink: 0 }" size="small">
                        <NFlex vertical :size="12">
                            <!-- 模型和模板选择行 -->
                            <NFlex :size="12" :wrap="false">
                                <!-- 优化模型选择 -->
                                <NFlex vertical :size="4" style="flex: 1">
                                    <NFlex align="center" :size="6" :wrap="false">
                                        <NText :depth="3" style="font-size: 12px; flex-shrink: 0;">
                                            {{ $t('promptOptimizer.optimizeModel') }}
                                        </NText>
                                        <TextModelQuickSwitch
                                            :model-key="selectedOptimizeModelKeyModel"
                                            :options="modelSelection.textModelOptions.value"
                                            :refresh-models="modelSelection.refreshTextModels"
                                            :disabled="conversationOptimization.isOptimizing.value"
                                        />
                                    </NFlex>
                                    <SelectWithConfig
                                        v-model="selectedOptimizeModelKeyModel"
                                        :options="modelSelection.textModelOptions.value"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="OptionAccessors.getSecondary"
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="t('model.select.placeholder')"
                                        size="medium"
                                        :disabled="conversationOptimization.isOptimizing.value"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="modelSelection.refreshTextModels"
                                        @config="handleOpenModelManager"
                                    />
                                </NFlex>

                                <!-- 模板选择 -->
                                <NFlex vertical :size="4" style="flex: 1">
                                    <NText :depth="3" style="font-size: 12px">
                                        {{ $t('promptOptimizer.templateLabel') }}
                                    </NText>
                                    <SelectWithConfig
                                        v-model="selectedTemplateIdModel"
                                        :options="templateSelection.templateOptions.value"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="OptionAccessors.getSecondary"
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="t('template.select')"
                                        size="medium"
                                        :disabled="conversationOptimization.isOptimizing.value"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="templateSelection.refreshOptimizeTemplates"
                                        @config="handleOpenTemplateManager"
                                    />
                                </NFlex>
                            </NFlex>

                            <NButton
                                type="primary"
                                :loading="displayAdapter.displayedIsOptimizing.value"
                                :disabled="displayAdapter.displayedIsOptimizing.value || !selectedMessageId"
                                @click="handleOptimizeClick"
                                block
                                data-testid="pro-multi-optimize-button"
                            >
                                {{ displayAdapter.displayedIsOptimizing.value ? $t('common.loading') : $t('promptOptimizer.optimize') }}
                            </NButton>
                        </NFlex>
                    </NCard>

                    <!-- 优化结果面板 -->
                    <TestSourceLinkedCard
                        :style="{ flex: 1, minHeight: '200px', overflow: 'hidden' }"
                        content-style="height: 100%; max-height: 100%; overflow: hidden;"
                        :feedback-key="sourceAreaFeedback.workspace.key"
                        :feedback-tone="sourceAreaFeedback.workspace.tone"
                        :source-tone="sourceAreaFeedback.workspace.sourceTone"
                    >
                        <template v-if="displayAdapter.isInMessageOptimizationMode.value">
                            <PromptPanelUI
                                test-id="pro-multi"
                                ref="promptPanelRef"
                                :original-prompt="displayAdapter.displayedOriginalPrompt.value"
                                :optimized-prompt="displayAdapter.displayedOptimizedPrompt.value"
                                :reasoning="optimizedReasoning"
                                :is-optimizing="displayAdapter.displayedIsOptimizing.value"
                                :is-iterating="isIterating"
                                :selected-iterate-template="selectedIterateTemplate"
                                @update:selectedIterateTemplate="emit('update:selectedIterateTemplate', $event)"
                                :versions="displayAdapter.displayedVersions.value"
                                :current-version-id="displayAdapter.displayedCurrentVersionId.value ?? undefined"
                                :source-feedback-key="sourceAreaFeedback.workspace.key"
                                :source-feedback-tone="sourceAreaFeedback.workspace.tone"
                                :source-feedback-version="sourceAreaFeedback.workspace.resolvedVersion"
                                :show-apply-button="displayAdapter.isInMessageOptimizationMode.value"
                                 :optimization-mode="optimizationMode"
                                 :advanced-mode-enabled="true"
                                  :show-preview="true"
                                @iterate="handleIterate"
                                @openTemplateManager="handleOpenTemplateManager"
                                @switchVersion="handleSwitchVersion"
                                  @switchToV0="handleSwitchToV0"
                                  @save-favorite="handleSaveFavorite"
                                  @open-preview="handleOpenPromptPreview"
                                  @apply-to-conversation="handleApplyToConversation"
                                 @apply-improvement="handleApplyImprovement"
                                 @apply-patch="handleApplyLocalPatch"
                                 @save-local-edit="handleSaveLocalEdit"
                             />
                        </template>
                        <template v-else>
                            <NEmpty
                                data-testid="pro-multi-empty-select-message"
                                :description="t('contextMode.system.selectMessageHint')"
                                size="large"
                            />
                        </template>
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
                    <ConversationTestPanel
                        ref="testAreaPanelRef"
                        mode="variables-only"
                        :optimization-mode="optimizationMode"
                        :global-variables="globalVariables"
                        :predefined-variables="predefinedVariables"
                        :temporary-variables="tempVars.temporaryVariables.value"
                        :input-mode="inputMode"
                        :button-size="buttonSize"
                        @variable-change="handleVariableChange"
                        @save-to-global="handleSaveToGlobal"
                        @temporary-variable-remove="handleVariableRemove"
                        @temporary-variables-clear="handleVariablesClear"
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
                                    :data-testid="'pro-multi-test-run-all'"
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
                                <div class="result-container">
                                    <ToolCallDisplay
                                        v-if="variantToolCalls[id].length > 0"
                                        :tool-calls="variantToolCalls[id]"
                                        size="small"
                                        class="tool-calls-section"
                                    />

                                    <div class="result-body">
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
                                                    v-if="hasVariantResult(id)"
                                                    class="output-evaluation-entry"
                                                >
                                                    <SaveTestResultExampleButton
                                                        sub-mode-key="pro-multi"
                                                        :variant-id="id"
                                                        :content="displayAdapter.displayedOptimizedPrompt.value || conversationOptimization.optimizedPrompt.value || ''"
                                                        :original-content="conversationOptimization.selectedMessage.value?.originalContent || conversationOptimization.selectedMessage.value?.content || ''"
                                                        function-mode="context"
                                                        optimization-mode="system"
                                                        :disabled="variantRunning[id]"
                                                        :test-id="`save-test-example-pro-multi-${id}`"
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
                                    </div>
                                </div>
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
import {
    ref,
    reactive,
    computed,
    toRef,
    inject,
    provide,
    watch,
    onMounted,
    onUnmounted,
    type Ref,
} from 'vue'
import { storeToRefs } from 'pinia'

import { useI18n } from "vue-i18n";
import {
    useProMultiMessageSession,
    type TestPanelVersionValue,
    type TestVariantConfig,
    type TestVariantId,
    type TestColumnCount,
} from '../../stores/session/useProMultiMessageSession'
import {
    NCard,
    NFlex,
    NButton,
    NText,
    NEmpty,
    NRadioGroup,
    NRadioButton,
    NTag,
} from "naive-ui";
import PromptPanelUI from "../PromptPanel.vue";
import PromptPreviewPanel from "../PromptPreviewPanel.vue";
import ConversationTestPanel from "./ConversationTestPanel.vue";
import ConversationManager from "./ConversationManager.vue";
import OutputDisplay from "../OutputDisplay.vue";
import SaveTestResultExampleButton from '../SaveTestResultExampleButton.vue'
import SelectWithConfig from "../SelectWithConfig.vue";
import TextModelQuickSwitch from "../TextModelQuickSwitch.vue";
import TestPanelVersionSelect from '../TestPanelVersionSelect.vue'
import TestSourceLinkedCard from '../TestSourceLinkedCard.vue'
import TestVariantSourceTag from '../TestVariantSourceTag.vue'
import ToolCallDisplay from "../ToolCallDisplay.vue";
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
import { useConversationOptimization } from '../../composables/prompt/useConversationOptimization'
import { usePromptDisplayAdapter } from '../../composables/prompt/usePromptDisplayAdapter'
import { useTemporaryVariables } from '../../composables/variable/useTemporaryVariables'
import { useCompareRoleConfig, useEvaluationHandler, provideEvaluation, provideProContext, buildCompareEvaluationPayload, useTestSourceAreaFeedback, useTestVariantSourceFeedback } from '../../composables/prompt'
import { useLocalPromptPreviewPanel } from '../../composables/prompt/useLocalPromptPreviewPanel'
import { useWorkspaceModelSelection } from '../../composables/workspaces/useWorkspaceModelSelection'
import { useWorkspaceTemplateSelection } from '../../composables/workspaces/useWorkspaceTemplateSelection'
import { OptionAccessors } from '../../utils/data-transformer'
import { useToast } from "../../composables/ui/useToast";
import { useElementSize } from '@vueuse/core'
import { runTasksWithExecutionMode } from '../../utils/runTasksSequentially'
import {
    buildTestPanelVersionPromptRef,
    buildTestPanelVersionOptions,
    formatTestPanelVersionSelectionLabel,
    resolveTestPanelVersionSelection,
} from '../../utils/testPanelVersion'
import {
    buildConversationExecutionContext,
    hashString,
    hashVariables,
} from '../../utils/prompt-variables'
import {
    applyPatchOperationsToText,
    PREDEFINED_VARIABLES,
    type ContextMode,
    type EvaluationType,
    type ConversationMessage,
    type ToolCall,
    type ToolCallResult,
    type OptimizationMode,
    type PromptRecord,
    type PromptRecordChain,
    type Template,
    type ToolDefinition,
    type ProSystemEvaluationContext,
    type PatchOperation,
} from "@prompt-optimizer/core";
import type { PersistedCompareSnapshotRoles } from '../../types/evaluation'
import type { TestAreaPanelInstance } from "../types/test-area";
import type { IteratePayload, SaveFavoritePayload } from "../../types/workspace";
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager'
import type { AppServices } from '../../types/services'

interface Props {
    // 核心状态
    optimizedReasoning?: string;

    // 优化状态
    isOptimizing?: boolean;
    isIterating?: boolean;

    // 外部状态注入（用于初始化本地 hook）
    // ✅ 已移除：selectedOptimizeModel, selectedTemplate, selectedIterateTemplate - 现在从 session store 直接读取
    // 🆕 评估模型（用于评估功能）
    evaluationModelKey?: string;

    // ✅ 已移除：optimizationContext - 改为从 inject('optimizationContext') 获取
    // ✅ 已移除：toolCount - 可从 optimizationContextTools 派生

    // ✅ 已移除：变量相关 props - 改为从 inject('variableManager') 获取
    // globalVariables, predefinedVariables, availableVariables, scanVariables

    // ✅ 已移除：enableMessageOptimization - 消息优化功能已移除

    // 全局优化链（用于历史记录恢复）
    versions?: PromptRecord[];
    currentVersionId?: string;

    // 响应式布局配置
    inputMode?: "compact" | "normal";
    buttonSize?: "small" | "medium" | "large";
    conversationMaxHeight?: number;
    resultVerticalLayout?: boolean;

    // 对比模式
    isCompareMode?: boolean;

    // ✅ 已移除：selectedTestModel - 现在从 session store 直接读取
    /** 测试模型名称（用于显示标签） */
    testModelName?: string;
}

interface ConversationSnapshotEntry extends ConversationMessage {
    chainId?: string;
    appliedVersion?: number;
}

interface ContextSystemHistoryPayload {
    chain: PromptRecordChain;
    record: PromptRecord;
    conversationSnapshot?: ConversationSnapshotEntry[];
    message?: ConversationMessage;
}

const props = withDefaults(defineProps<Props>(), {
    optimizedReasoning: "",
    isOptimizing: false,
    isIterating: false,
    evaluationModelKey: undefined,
    versions: () => [],
    currentVersionId: "",
    inputMode: "normal",
    buttonSize: "medium",
    conversationMaxHeight: 300,
    resultVerticalLayout: false,
    isCompareMode: false,
    testModelName: undefined,
});

// Emits 定义
const emit = defineEmits<{
    // 数据更新
    (e: "update:selectedIterateTemplate", value: Template | null): void;
    (e: "update:optimizationContext", value: ConversationMessage[]): void;

    // 操作事件（用于历史记录查看场景）
    (e: "test", testVariables: Record<string, string>): void;
    (e: "switch-version", version: PromptRecord): void;
    (e: "switch-to-v0", version: PromptRecord): void;
    (e: "save-favorite", data: SaveFavoritePayload): void;
    (e: "message-change", index: number, message: ConversationMessage, action: "add" | "update" | "delete"): void;

    // 打开面板/管理器
    (e: "open-variable-manager"): void;
    (e: "open-context-editor", tab?: string): void;
    (e: "open-template-manager", type?: string): void;
    (e: "open-tool-manager"): void;
    (e: "config-model"): void;

    // 预览相关
    (e: "open-prompt-preview"): void;

    // 变量管理
    (e: "variable-change", name: string, value: string): void;
    (e: "save-to-global", name: string, value: string): void;

    // 🆕 对比模式
    (e: "update:isCompareMode", value: boolean): void;
    (e: "compare-toggle"): void;
}>();

const { t } = useI18n();
const toast = useToast();

// 注入服务和变量管理器
const injectedServices = inject<Ref<AppServices | null>>('services')
const servicesRef = injectedServices ?? ref<AppServices | null>(null)
const variableManager = inject<VariableManagerHooks | null>('variableManager', null)

// 注入 App 层统一的 open* 接口（避免 Pro 工作区 emit 链断导致按钮无响应）
const appOpenModelManager = inject<
    ((tab?: 'text' | 'image' | 'function') => void) | null
>('openModelManager', null)
const appOpenTemplateManager = inject<((type?: string) => void) | null>(
    'openTemplateManager',
    null,
)
type ContextEditorOpenArg = ConversationMessage[] | 'messages' | 'variables' | 'tools'
const appOpenContextEditor = inject<
    ((messagesOrTab?: ContextEditorOpenArg, variables?: Record<string, string>) => void) | null
>('openContextEditor', null)

// 注入 App 层统一的 open* 接口（Pro 工作区专有功能）
const appOpenToolManager = inject<(() => void) | null>('openToolManager', null)
const appOpenVariableManager = inject<((variableName?: string) => void) | null>('openVariableManager', null)
const appHandleSaveFavorite = inject<((data: SaveFavoritePayload) => void) | null>('handleSaveFavorite', null)
const appSaveToGlobal = inject<((name: string, value: string) => void) | null>('saveToGlobal', null)

 // Pro Multi: message list is session-owned (per-submode isolation).
 // Keep emitting update:optimizationContext only as a backward-compat hook for non-App hosts.
 const proMultiSession = useProMultiMessageSession()
 const conversationMessages = computed<ConversationMessage[]>({
     get: () => proMultiSession.conversationMessagesSnapshot || [],
     set: (messages) => {
         proMultiSession.updateConversationMessages(messages)
     },
 })

 const handleConversationMessagesUpdated = (messages: ConversationMessage[]) => {
     proMultiSession.updateConversationMessages(messages)

     // If the selected message was deleted, clear selection to keep the UI consistent.
     const selectedId = proMultiSession.selectedMessageId
     if (selectedId && !messages.some((m) => m.id === selectedId)) {
         proMultiSession.selectMessage('')
     }

     emit('update:optimizationContext', messages)
 }

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

const handleOpenContextEditor = (
    messages: ConversationMessage[],
    variables: Record<string, string>,
) => {
    if (appOpenContextEditor) {
        appOpenContextEditor(messages, variables)
        return
    }
    // 兜底：旧链路（如果宿主仍通过 emit 打开编辑器）
    emit('open-context-editor')
}

// Pro 工作区专有功能的处理函数（优先使用 inject，emit 作为兜底）
const handleOpenToolManager = () => {
    if (appOpenToolManager) { appOpenToolManager(); return; }
    emit('open-tool-manager')
}

const handleOpenVariableManager = () => {
    if (appOpenVariableManager) { appOpenVariableManager(); return; }
    emit('open-variable-manager')
}

const handleSaveFavorite = (data: SaveFavoritePayload) => {
    if (appHandleSaveFavorite) { appHandleSaveFavorite(data); return; }
    emit('save-favorite', data)
}

const handleSaveToGlobal = (name: string, value: string) => {
    if (appSaveToGlobal) { appSaveToGlobal(name, value); return; }
    emit('save-to-global', name, value)
}

// ✅ 优化模式：固定为 'system'（此组件专门用于系统模式优化）
const optimizationMode: OptimizationMode = 'system';

// 🆕 访问变量数据（从 variableManager inject）
const globalVariables = computed(() => variableManager?.variableManager.value?.listVariables() || {})

const predefinedVariables = computed(() => {
    // 从 PREDEFINED_VARIABLES 常量获取预定义变量
    return PREDEFINED_VARIABLES.reduce((acc, name) => {
        acc[name] = variableManager?.variableManager.value?.getVariable(name) || ''
        return acc
    }, {} as Record<string, string>)
})

const availableVariables = computed(() => {
    // 合并全局变量和预定义变量
    return { ...globalVariables.value, ...predefinedVariables.value }
})

const scanVariables = (content: string) => {
    return variableManager?.variableManager.value?.scanVariablesInContent(content) || []
}

const toolCount = computed(() => {
    // 从 optimizationContextTools 派生
    return optimizationContextToolsRef.value?.length || 0
})

const enableMessageOptimization = computed(() => {
    // Pro Multi：自动选中最新消息进行优化（不需要显式“选择”按钮）
    // 这里仍需启用“消息优化模式”，以便 PromptPanel 展示优化结果区。
    return optimizationMode === 'system'
})

// 🆕 初始化临时变量管理器（与 ContextEditor 共享）
const tempVars = useTemporaryVariables()

// ========================
// 子模式本地提示词预览（不经过 PromptOptimizerApp）
// ========================
const previewContextMode = computed<ContextMode>(() => 'system')

// Priority: global < temporary < predefined
const previewVariables = computed<Record<string, string>>(() => ({
    ...globalVariables.value,
    ...(tempVars.temporaryVariables.value || {}),
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

const handleOpenPromptPreview = () => {
    openPromptPreview(displayAdapter.displayedOptimizedPrompt.value || '', { renderPhase: 'optimize' })
}

 // 🆕 测试结果持久化（Pro-system）

// ✨ 新增：直接使用 session store 管理模型和模板选择
const modelSelection = useWorkspaceModelSelection(servicesRef, proMultiSession)
const templateSelection = useWorkspaceTemplateSelection(
    servicesRef,
    proMultiSession,
    'conversationMessageOptimize',
    'contextIterate'
)

// 🆕 初始化本地会话优化逻辑
 const conversationOptimization = useConversationOptimization(
     servicesRef,
     conversationMessages,
     computed(() => optimizationMode),
     modelSelection.selectedOptimizeModelKey,
     templateSelection.selectedTemplate,
     templateSelection.selectedIterateTemplate
 )

// 暴露给子组件（虽然目前主要通过 Props 传递给 ConversationManager，但保持 Provide 以防万一）
provide('conversationOptimization', conversationOptimization);

// 🆕 初始化显示适配器（根据模式自动切换数据源）
 const displayAdapter = usePromptDisplayAdapter(
     conversationOptimization,
     {
         enableMessageOptimization,
         optimizationContext: conversationMessages,
         globalVersions: computed(() => props.versions || []),
         globalCurrentVersionId: computed(() => props.currentVersionId),
         globalIsOptimizing: computed(() => props.isOptimizing),
     }
 )

// 从 inject 获取 optimizationContextTools（由 App.vue 提供）
const optimizationContextToolsRef = inject<Ref<ToolDefinition[]>>('optimizationContextTools', ref([]))
// 使用本地 managed 的 selectedMessageId
const selectedMessageId = conversationOptimization.selectedMessageId

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

const refreshTextModelsHandler = async () => {
    try {
        await modelSelection.refreshTextModels()
    } catch (e) {
        console.warn('[ContextSystemWorkspace] Failed to refresh text models after manager close:', e)
    }
}

const refreshTemplatesHandler = async () => {
    try {
        await templateSelection.refreshOptimizeTemplates()
        await templateSelection.refreshIterateTemplates()
    } catch (e) {
        console.warn('[ContextSystemWorkspace] Failed to refresh templates after template manager update:', e)
    }
}

// 🆕 从 session store 恢复测试结果（只恢复稳定字段，不恢复过程态）
 onMounted(() => {
    // ✅ 刷新模型列表
    void refreshTextModelsHandler()

    if (typeof window !== 'undefined') {
        window.addEventListener('pro-workspace-refresh-text-models', refreshTextModelsHandler)
        window.addEventListener('pro-workspace-refresh-templates', refreshTemplatesHandler)
    }

     // Pro Multi：初始态保持“未选择消息”，让用户明确选择要优化的消息。
     // 仅在 session store 有选中记录时尝试恢复（刷新/恢复场景）。
     if (proMultiSession.selectedMessageId) {
         const restored = (conversationMessages.value || []).find((m) => m.id === proMultiSession.selectedMessageId)
         if (restored) {
             void conversationOptimization.selectMessage(restored)
         } else {
             // 防止选中 ID 指向已不存在的消息，导致 UI 误判为“已选中”。
             proMultiSession.selectMessage('')
         }
     }

})

// ==================== 主布局：可拖拽分栏（左侧 25%~50%） ====================

const splitRootRef = ref<HTMLElement | null>(null)
const testPaneRef = ref<HTMLElement | null>(null)

const clampLeftPct = (pct: number) => Math.min(50, Math.max(25, pct))

// 使用本地 draft，避免拖拽过程频繁写入持久化存储
const mainSplitLeftPct = ref<number>(50)
watch(
    () => proMultiSession.layout.mainSplitLeftPct,
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

    proMultiSession.setMainSplitLeftPct(mainSplitLeftPct.value)
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

    proMultiSession.setMainSplitLeftPct(mainSplitLeftPct.value)
}

onUnmounted(() => {
    endSplitDrag()

    if (typeof window !== 'undefined') {
        window.removeEventListener('pro-workspace-refresh-text-models', refreshTextModelsHandler)
        window.removeEventListener('pro-workspace-refresh-templates', refreshTemplatesHandler)
    }
})

// ==================== 测试区：多列 variants（当前选中消息版本） ====================

const getVariant = (id: TestVariantId): TestVariantConfig | undefined => {
    const list = proMultiSession.testVariants as unknown as TestVariantConfig[]
    return Array.isArray(list) ? list.find((v) => v.id === id) : undefined
}

const testColumnCountModel = computed<TestColumnCount>({
    get: () => {
        const raw = proMultiSession.layout.testColumnCount
        return raw === 2 || raw === 3 || raw === 4 ? raw : 2
    },
    set: (value) => proMultiSession.setTestColumnCount(value),
})

const variantAVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('a')?.version ?? 0,
    set: (value) => proMultiSession.updateTestVariant('a', { version: value }),
})

const variantBVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('b')?.version ?? 'workspace',
    set: (value) => proMultiSession.updateTestVariant('b', { version: value }),
})

const variantCVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('c')?.version ?? 'workspace',
    set: (value) => proMultiSession.updateTestVariant('c', { version: value }),
})

const variantDVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('d')?.version ?? 'workspace',
    set: (value) => proMultiSession.updateTestVariant('d', { version: value }),
})

const variantAModelKeyModel = computed<string>({
    get: () => getVariant('a')?.modelKey ?? '',
    set: (value) => proMultiSession.updateTestVariant('a', { modelKey: value }),
})

const variantBModelKeyModel = computed<string>({
    get: () => getVariant('b')?.modelKey ?? '',
    set: (value) => proMultiSession.updateTestVariant('b', { modelKey: value }),
})

const variantCModelKeyModel = computed<string>({
    get: () => getVariant('c')?.modelKey ?? '',
    set: (value) => proMultiSession.updateTestVariant('c', { modelKey: value }),
})

const variantDModelKeyModel = computed<string>({
    get: () => getVariant('d')?.modelKey ?? '',
    set: (value) => proMultiSession.updateTestVariant('d', { modelKey: value }),
})

const ALL_VARIANT_IDS: TestVariantId[] = ['a', 'b', 'c', 'd']
const activeVariantIds = computed<TestVariantId[]>(() =>
    ALL_VARIANT_IDS.slice(0, testColumnCountModel.value),
)
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

// pro-multi 变量优先级：global < temporary < predefined
const mergedTestVariables = computed<Record<string, string>>(() => ({
    ...globalVariables.value,
    ...(tempVars.temporaryVariables.value || {}),
    ...predefinedVariables.value,
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

const testGridTemplateColumns = computed(
    () => `repeat(${testColumnCountModel.value}, minmax(0, 1fr))`,
)

const getTestPanelVersionLabels = () => ({
    workspace: t('test.layout.workspace'),
    previous: t('test.layout.previous'),
    original: t('test.layout.original'),
})

const compareVersionContextCurrentVersionId = computed(
    () => displayAdapter.displayedCurrentVersionId.value || conversationOptimization.currentRecordId.value,
)

// 版本选项：默认显示“工作区”与“原始(v0)”；存在可用上一版时显示“上一版(vN)”动态别名。
const versionOptions = computed(() => {
    return buildTestPanelVersionOptions(
        conversationOptimization.currentVersions.value || [],
        getTestPanelVersionLabels(),
        {
            currentVersionId: compareVersionContextCurrentVersionId.value,
            workspacePrompt: displayAdapter.displayedOptimizedPrompt.value || conversationOptimization.optimizedPrompt.value || '',
            originalPrompt: conversationOptimization.selectedMessage.value?.originalContent || conversationOptimization.selectedMessage.value?.content || '',
        },
    )
})

// 确保测试列的模型选择始终有效（模型列表变化时自动 fallback）
watch(
    () => modelSelection.textModelOptions.value,
    (opts) => {
        const fallback = opts?.[0]?.value || ''
        if (!fallback) return
        const keys = new Set((opts || []).map((o) => o.value))

        const legacy = proMultiSession.selectedTestModelKey
        const seed = legacy && keys.has(legacy) ? legacy : fallback

        for (const id of ALL_VARIANT_IDS) {
            const current = variantModelKeyModels[id].value
            if (!current || !keys.has(current)) {
                proMultiSession.updateTestVariant(id, { modelKey: seed })
            }
        }
    },
    { immediate: true },
)

type ResolvedSelectedMessage = { text: string; resolvedVersion: number }

const resolveSelectedMessageContent = (
    selection: TestPanelVersionValue,
): ResolvedSelectedMessage => {
    const selectedMsg = conversationOptimization.selectedMessage.value
    const resolved = resolveTestPanelVersionSelection({
        selection,
        versions: conversationOptimization.currentVersions.value || [],
        currentVersionId: compareVersionContextCurrentVersionId.value,
        workspacePrompt: displayAdapter.displayedOptimizedPrompt.value || conversationOptimization.optimizedPrompt.value || '',
        originalPrompt: selectedMsg?.originalContent || selectedMsg?.content || '',
    })

    return {
        text: resolved.text,
        resolvedVersion: resolved.resolvedVersion,
    }
}

const resolvedOriginalTestPrompt = computed(() =>
    resolveSelectedMessageContent(variantAVersionModel.value),
)
const resolvedOptimizedTestPrompt = computed(() =>
    resolveSelectedMessageContent(variantBVersionModel.value),
)

// Pinia setup store 会自动解包 refs。
// testVariantResults / testVariantLastRunFingerprint 在 restoreSession 时会被整对象替换，
// 这里必须通过 storeToRefs 持有 Ref，避免组件继续写入旧对象。
const {
    testVariantResults: variantResults,
    testVariantLastRunFingerprint: variantLastRunFingerprint,
} = storeToRefs(proMultiSession)

const variantRunning = reactive<Record<TestVariantId, boolean>>({
    a: false,
    b: false,
    c: false,
    d: false,
})

const variantToolCalls = reactive<Record<TestVariantId, ToolCallResult[]>>({
    a: [],
    b: [],
    c: [],
    d: [],
})

const { variantSourceFeedback, pulseVariantSource } =
    useTestVariantSourceFeedback<TestVariantId>(['a', 'b', 'c', 'd'])
const { sourceAreaFeedback, pulseSourceAreaForSelection } =
    useTestSourceAreaFeedback()

const isAnyVariantRunning = computed(() =>
    activeVariantIds.value.some((id) => !!variantRunning[id]),
)

const getVariantLabel = (id: TestVariantId) => ({ a: 'A', b: 'B', c: 'C', d: 'D' }[id])

const handleVariantVersionChange = (id: TestVariantId, value: string | number) => {
    const selection = value as TestPanelVersionValue
    variantVersionModels[id].value = selection
    activateVariantSource(id)
}

const activateVariantSource = (id: TestVariantId) => {
    const selection = variantVersionModels[id].value
    const resolved = resolveSelectedMessageContent(selection)
    pulseVariantSource(id, 'change')
    pulseSourceAreaForSelection(selection, resolved.resolvedVersion, 'change')
}

const getVariantVersionTestId = (id: TestVariantId) => {
    if (id === 'a') return 'pro-multi-test-original-version-select'
    if (id === 'b') return 'pro-multi-test-optimized-version-select'
    return `pro-multi-test-variant-${id}-version-select`
}

const getVariantModelTestId = (id: TestVariantId) => {
    if (id === 'a') return 'pro-multi-test-original-model-select'
    if (id === 'b') return 'pro-multi-test-optimized-model-select'
    return `pro-multi-test-variant-${id}-model-select`
}

const getVariantRunTestId = (id: TestVariantId) => `pro-multi-test-run-${id}`

const getVariantOutputTestId = (id: TestVariantId) => {
    if (id === 'a') return 'pro-multi-test-original-output'
    if (id === 'b') return 'pro-multi-test-optimized-output'
    return `pro-multi-test-variant-${id}-output`
}

const getVariantResult = (id: TestVariantId) => variantResults.value[id]
const hasVariantResult = (id: TestVariantId) => !!(variantResults.value[id]?.result || '').trim()

const formatConversationAsText = (messages: ConversationMessage[]): string => {
    if (!messages || messages.length === 0) return ''
    return messages.map((msg) => `${String(msg.role).toUpperCase()}: ${msg.content}`).join('\n\n')
}

const formatToolsAsText = (tools: ToolDefinition[]): string => {
    if (!tools || tools.length === 0) return ''
    return tools
        .map((tool) => {
            const func = tool.function
            let text = `Tool name: ${func.name}`
            if (func.description) text += `\nDescription: ${func.description}`
            if (func.parameters) text += `\nParameter schema: ${JSON.stringify(func.parameters, null, 2)}`
            return text
        })
        .join('\n\n')
}

const EXECUTION_PROMPT_MARKER = '[See the current execution prompt in the snapshot below]'

const buildMessagesForSelection = (
    selection: TestPanelVersionValue,
    options?: { replaceSelectedWithMarker?: boolean },
): ConversationMessage[] => {
    const id = selectedMessageId.value
    const resolved = resolveSelectedMessageContent(selection)
    const replaceSelectedWithMarker = options?.replaceSelectedWithMarker === true

    return (conversationMessages.value || []).map((msg) => ({
        ...msg,
        content:
            id && msg.id === id
                ? replaceSelectedWithMarker
                    ? EXECUTION_PROMPT_MARKER
                    : resolved.text
                : msg.content,
    }))
}

const buildConversationEvidenceContent = (selection: TestPanelVersionValue): string => {
    const toolsText = formatToolsAsText(optimizationContextToolsRef.value || [])
    const conversationText = formatConversationAsText(
        buildMessagesForSelection(selection, { replaceSelectedWithMarker: true }),
    )

    return toolsText.trim()
        ? `${conversationText}\n\nTOOLS:\n${toolsText}`
        : conversationText
}

const getVariantFingerprint = (id: TestVariantId) => {
    const selection = variantVersionModels[id].value
    const resolved = resolveSelectedMessageContent(selection)
    const modelKey = variantModelKeyModels[id].value || ''
    const tools = optimizationContextToolsRef.value || []
    const messages = buildMessagesForSelection(selection)
    const convHash = hashString(formatConversationAsText(messages))
    const toolsHash = hashString(formatToolsAsText(tools))

    const baseVars = variableManager?.allVariables.value || {}
    const conversationContext = formatConversationAsText(messages)
    const toolsContext = formatToolsAsText(tools)
    const varsHash = hashVariables({
        ...baseVars,
        ...mergedTestVariables.value,
        conversationContext,
        toolsContext,
    })

    return `${selectedMessageId.value || ''}:${String(selection)}:${resolved.resolvedVersion}:${modelKey}:${convHash}:${toolsHash}:${varsHash}`
}

const isVariantStale = (id: TestVariantId) => {
    if (!hasVariantResult(id)) return false
    const prev = variantLastRunFingerprint.value[id]
    if (!prev) return false
    return prev !== getVariantFingerprint(id)
}

const getVariantVersionLabel = (id: TestVariantId): string => {
    const selection = variantVersionModels[id].value
    const resolved = resolveSelectedMessageContent(selection)
    return formatTestPanelVersionSelectionLabel(
        selection,
        resolved.resolvedVersion,
        getTestPanelVersionLabels(),
    )
}

const getVariantResolvedVersion = (id: TestVariantId): number =>
    resolveSelectedMessageContent(variantVersionModels[id].value).resolvedVersion

const compareReadyVariantIds = computed(() =>
    activeVariantIds.value.filter((id) => hasVariantResult(id) && !isVariantStale(id))
)

const hasCompareCandidates = computed(() => compareReadyVariantIds.value.length >= 2)
const compareRoleCandidates = computed(() =>
    activeVariantIds.value.map((id) => {
        const selection = variantVersionModels[id].value

        return {
            id,
            label: getVariantLabel(id),
            promptRef: buildVariantPromptRef(id),
            promptText: resolveSelectedMessageContent(selection).text,
            modelKey: variantModelKeyModels[id].value,
            versionLabel: getVariantVersionLabel(id),
        }
    })
)
const compareRoleConfig = useCompareRoleConfig({
    candidates: compareRoleCandidates,
    persistedRoles: toRef(proMultiSession, 'compareSnapshotRoles'),
    persistedRoleSignatures: toRef(proMultiSession, 'compareSnapshotRoleSignatures'),
    persistRoles: (roles, signatures) => proMultiSession.updateCompareSnapshotRoles(roles, signatures),
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
    messages: ConversationMessage[]
    modelKey: string
    resolvedVersion: number
    tools: ToolDefinition[]
    variables: Record<string, string>
}

const getVariantTestInput = (id: TestVariantId): VariantTestInput | null => {
    const modelKey = (variantModelKeyModels[id].value || '').trim()
    if (!modelKey) {
        toast.error(t('test.error.noModel'))
        return null
    }

     if (!conversationMessages.value || conversationMessages.value.length === 0) {
         toast.error(t('test.error.noConversation'))
         return null
     }

    if (!selectedMessageId.value) {
        toast.warning(t('toast.warning.messageNotFound'))
        return null
    }

    const resolved = resolveSelectedMessageContent(variantVersionModels[id].value)
    if (!resolved.text?.trim()) {
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

    const messages = buildMessagesForSelection(variantVersionModels[id].value)
    const tools = optimizationContextToolsRef.value || []

    const baseVars = variableManager?.allVariables.value || {}
    const conversationContext = formatConversationAsText(messages)
    const toolsContext = formatToolsAsText(tools)
    const variables = {
        ...baseVars,
        ...mergedTestVariables.value,
        conversationContext,
        toolsContext,
    }

    const ctx = buildConversationExecutionContext(messages, variables)
    if (ctx.forbiddenTemplateSyntax.length > 0) {
        toast.error(t('test.error.forbiddenTemplateSyntax'))
        return null
    }
    if (ctx.missingVariables.length > 0) {
        toast.error(t('test.error.missingVariables', { vars: ctx.missingVariables.join(', ') }))
        return null
    }

    return {
        messages: ctx.renderedMessages,
        modelKey,
        resolvedVersion: resolved.resolvedVersion,
        tools,
        variables,
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

    if (!opts?.skipClearEvaluation) {
        evaluationHandler.clearBeforeTest()
    }

    variantResults.value[id] = { result: '', reasoning: '' }
    variantToolCalls[id] = []
    variantRunning[id] = true

    try {
        await promptService.testCustomConversationStream(
            {
                modelKey: input.modelKey,
                messages: input.messages,
                variables: input.variables,
                tools: input.tools,
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
                onToolCall: (toolCall: ToolCall) => {
                    const toolCallResult: ToolCallResult = {
                        toolCall,
                        status: 'success',
                        timestamp: new Date(),
                    }
                    variantToolCalls[id].push(toolCallResult)
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
            void proMultiSession.saveSession()
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

    void proMultiSession.saveSession()

    if (results.every(Boolean)) {
        toast.success(t('toast.success.testComplete'))
    } else {
        toast.error(t('toast.error.testFailed'))
    }
}

// 🆕 构建 Pro-System 评估上下文（基于 A/B 的消息版本）
 const proContext = computed<ProSystemEvaluationContext | undefined>(() => {
     const selectedMsg = conversationOptimization.selectedMessage.value
     if (!selectedMsg?.id) return undefined

    const original = resolvedOriginalTestPrompt.value.text
    const optimized = resolvedOptimizedTestPrompt.value.text

 return {
         targetMessage: {
             role: selectedMsg.role as 'system' | 'user' | 'assistant' | 'tool',
             content: optimized,
             originalContent: original,
         },
         conversationMessages: (conversationMessages.value || []).map((msg) => ({
             role: msg.role,
             content: msg.id === selectedMsg.id ? optimized : msg.content,
             isTarget: msg.id === selectedMsg.id,
         })),
     }
 })

// 🆕 提供 Pro 模式上下文给子组件（如 PromptPanel），用于评估时传递多消息上下文
provideProContext(proContext)

const buildEvaluationTarget = () => {
    const workspacePrompt =
        displayAdapter.displayedOptimizedPrompt.value ||
        conversationOptimization.optimizedPrompt.value ||
        '';
    const referencePrompt = (displayAdapter.displayedOriginalPrompt.value || '').trim();
    const normalizedWorkspacePrompt = workspacePrompt.trim();

    return {
        workspacePrompt,
        referencePrompt:
            referencePrompt && referencePrompt !== normalizedWorkspacePrompt
                ? displayAdapter.displayedOriginalPrompt.value
                : undefined,
    };
}

const buildVariantPromptRef = (id: TestVariantId) => {
    const selection = variantVersionModels[id].value
    const selectedMsg = conversationOptimization.selectedMessage.value
    const resolved = resolveTestPanelVersionSelection({
        selection,
        versions: conversationOptimization.currentVersions.value || [],
        currentVersionId: compareVersionContextCurrentVersionId.value,
        workspacePrompt: displayAdapter.displayedOptimizedPrompt.value || conversationOptimization.optimizedPrompt.value || '',
        originalPrompt: selectedMsg?.originalContent || selectedMsg?.content || '',
    })
    return buildTestPanelVersionPromptRef(resolved, getTestPanelVersionLabels())
}

const buildConversationTestCaseDraft = (
    id: string,
    selection: TestPanelVersionValue,
) => ({
    id: `${id}-conversation-test-case`,
    label: 'Conversation Snapshot',
    input: {
        kind: 'conversation' as const,
        label: 'Conversation Snapshot',
        summary: `The target message is marked with "${EXECUTION_PROMPT_MARKER}". See the execution prompt below for the full content.`,
        content: buildConversationEvidenceContent(selection),
    },
})

const comparePayload = computed(() =>
    buildCompareEvaluationPayload({
        target: buildEvaluationTarget(),
        testCases: compareReadyVariantIds.value.map((id) =>
            buildConversationTestCaseDraft(id, variantVersionModels[id].value)
        ),
        snapshotRolesOverride: compareRoleConfig.validManualRoles.value,
        snapshots: compareReadyVariantIds.value.map((id) => {
            const selection = variantVersionModels[id].value

            return {
                id,
                label: getVariantLabel(id),
                testCaseId: `${id}-conversation-test-case`,
                promptRef: buildVariantPromptRef(id),
                promptText: resolveSelectedMessageContent(selection).text,
                output: variantResults.value[id]?.result || '',
                reasoning: variantResults.value[id]?.reasoning || '',
                modelKey: variantModelKeyModels[id].value,
                versionLabel: getVariantVersionLabel(id),
            }
        }),
    })
)

const hasEvaluationWorkspacePrompt = computed(() => !!buildEvaluationTarget().workspacePrompt.trim())
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
    const versions = displayAdapter.displayedVersions.value
    const versionId = displayAdapter.displayedCurrentVersionId.value
    if (!versions || versions.length === 0 || !versionId) return ''
    const currentVersion = versions.find((v) => v.id === versionId)
    return currentVersion?.iterationNote || ''
})

const resultEvaluationTargets = computed(() =>
    Object.fromEntries(
        activeVariantIds.value.map((id) => [
            id,
            {
                variantId: id,
                target: buildEvaluationTarget(),
                testCase: buildConversationTestCaseDraft(id, variantVersionModels[id].value),
                snapshot: {
                    id,
                    label: getVariantLabel(id),
                    testCaseId: `${id}-conversation-test-case`,
                    promptRef: buildVariantPromptRef(id),
                    promptText: resolveSelectedMessageContent(variantVersionModels[id].value).text,
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
    analysisOptimizedPrompt: computed(() => displayAdapter.displayedOptimizedPrompt.value || ''),
    resultTargets: resultEvaluationTargets,
    evaluationModelKey: computed(() => {
        const key = props.evaluationModelKey || modelSelection.selectedOptimizeModelKey.value ||
            variantBModelKeyModel.value || variantAModelKeyModel.value || proMultiSession.selectedTestModelKey
        return key || ''
    }),
    functionMode: computed(() => 'pro'),
    subMode: computed(() => 'multi'),
    proContext,
    comparePayload,
    currentIterateRequirement,
    persistedResults: toRef(proMultiSession, 'evaluationResults'),
})

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
    evaluation.getScoreLevel(evaluationHandler.compareEvaluation.compareScore.value ?? null),
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
    const current = conversationOptimization.optimizedPrompt.value || ''
    const result = applyPatchOperationsToText(current, payload.operation)
    if (!result.ok) {
        toast.warning(t('toast.warning.patchApplyFailed'))
        return
    }

    conversationOptimization.optimizedPrompt.value = result.text
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
    conversationOptimization.clearContent()
    handleClearEvaluation()
    emit('update:optimizationContext', [])
}

// Pro/multi: selected message changed => clear evaluation results
watch(selectedMessageId, (next, prev) => {
    if (next === prev) return
    handleClearEvaluation()
})

// 处理迭代优化事件
// 注意：由于 displayedOptimizedPrompt 在未选中消息时为空，迭代按钮不会显示，所以此函数调用时必定处于消息优化模式
const handleIterate = (payload: IteratePayload) => {
    conversationOptimization.iterateMessage(payload)
}

// 处理优化点击事件
// 注意：优化按钮在没有选中消息时会被禁用，所以此函数调用时必定处于消息优化模式
const handleOptimizeClick = () => {
    conversationOptimization.optimizeMessage()
}

// 🆕 ConversationTestPanel 引用
const testAreaPanelRef = ref<TestAreaPanelInstance | null>(null);

/** PromptPanel 组件引用,用于打开迭代弹窗 */
const promptPanelRef = ref<InstanceType<typeof PromptPanelUI> | null>(null);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isConversationMessage = (value: unknown): value is ConversationMessage => {
    if (!isObjectRecord(value)) return false;
    return (
        typeof value.id === "string" &&
        typeof value.role === "string" &&
        typeof value.content === "string"
    );
};

const isContextSystemHistoryPayload = (
    value: unknown,
): value is ContextSystemHistoryPayload => {
    if (!isObjectRecord(value)) return false;

    const chain = value.chain;
    const record = value.record;
    const conversationSnapshot = value.conversationSnapshot;
    const message = value.message;

    if (
        !isObjectRecord(chain) ||
        typeof chain.chainId !== "string" ||
        !Array.isArray(chain.versions)
    ) {
        return false;
    }
    if (!isObjectRecord(record) || typeof record.id !== "string") return false;
    if (conversationSnapshot !== undefined && !Array.isArray(conversationSnapshot))
        return false;
    if (message !== undefined && !isConversationMessage(message)) return false;

    return true;
};

const restoreFromHistory = async (payload: unknown) => {
    if (!isContextSystemHistoryPayload(payload)) {
        console.warn(
            "[ContextSystemWorkspace] Invalid history payload, ignored:",
            payload,
        );
        return;
    }

    const { chain, record, conversationSnapshot, message } = payload;
    try {
        if (conversationSnapshot?.length) {
            let mappingCount = 0;
            conversationSnapshot.forEach((snapshotMsg) => {
                if (snapshotMsg.id && snapshotMsg.chainId) {
                    // 🔧 Codex 修复：使用纯 messageId 作为 key，与 useConversationOptimization 统一
                    conversationOptimization.messageChainMap.value.set(
                        snapshotMsg.id,
                        snapshotMsg.chainId,
                    );
                    mappingCount += 1;
                }
            });
            if (mappingCount > 0) {
                console.log(
                    `[ContextSystemWorkspace] Rebuilt optimization chain mappings for ${mappingCount} message(s)`,
                );
            }
        }

        if (!message) {
            return;
        }

        await conversationOptimization.selectMessage(message);
        conversationOptimization.currentChainId.value = chain.chainId;
        conversationOptimization.currentVersions.value = chain.versions;
        conversationOptimization.currentRecordId.value = record.id;
        conversationOptimization.optimizedPrompt.value = record.optimizedPrompt;
    } catch (error) {
        console.error('[ContextSystemWorkspace] Failed to restore history:', error);
        // 错误会向上传播到 App.vue 的 handleHistoryReuse 中统一处理
        throw error;
    }
};

// 🆕 处理版本切换
const handleSwitchVersion = (version: PromptRecord) => {
    if (displayAdapter.isInMessageOptimizationMode.value) {
        conversationOptimization.switchVersion(version);
    } else {
        emit('switch-version', version);
    }
};

// 🆕 处理 V0 切换
const handleSwitchToV0 = (version: PromptRecord) => {
    if (displayAdapter.isInMessageOptimizationMode.value) {
        conversationOptimization.switchToV0(version);
    } else {
        emit('switch-to-v0', version);
    }
};

const handleApplyToConversation = () => {
    if (!displayAdapter.isInMessageOptimizationMode.value) return;
    conversationOptimization.applyCurrentVersion();
};

// 🆕 处理变量提取
// 注意：toast 已在 VariableAwareInput 中显示，这里不重复（参考 ContextUserWorkspace 的实现）
const handleVariableExtracted = (data: {
    variableName: string;
    variableValue: string;
    variableType: "global" | "temporary";
}) => {
    if (data.variableType === "global") {
        variableManager?.addVariable(data.variableName, data.variableValue);
    } else {
        tempVars.setVariable(data.variableName, data.variableValue);
    }
};

// 🆕 处理添加缺失变量
// 注意：toast 已在 VariableAwareInput 中显示，这里不重复（参考 ContextUserWorkspace 的实现）
const handleAddMissingVariable = (varName: string) => {
    tempVars.setVariable(varName, "");
};

// 🆕 处理临时变量变更
const handleVariableChange = (name: string, value: string) => {
    tempVars.setVariable(name, value);
    emit('variable-change', name, value);
};

// 🆕 处理临时变量移除
const handleVariableRemove = (name: string) => {
    tempVars.deleteVariable(name);
    emit('variable-change', name, '');
};

// 🆕 处理清空所有临时变量
const handleVariablesClear = () => {
    const removedNames = Object.keys(tempVars.temporaryVariables.value);
    tempVars.clearAll();
    removedNames.forEach(name => emit('variable-change', name, ''));
};

// 🆕 处理应用改进建议事件（使用 evaluationHandler 提供的工厂方法）
const handleApplyImprovement = evaluationHandler.createApplyImprovementHandler(promptPanelRef);
const handleRewriteFromEvaluation = evaluationHandler.createRewriteFromEvaluationHandler(promptPanelRef);

// 处理保存本地编辑
const handleSaveLocalEdit = async (payload: { note?: string }) => {
    await conversationOptimization.saveLocalEdit({
        optimizedPrompt: conversationOptimization.optimizedPrompt.value || '',
        note: payload.note,
        source: 'manual',
    });
};

// 暴露引用
defineExpose({
    testAreaPanelRef,
    restoreFromHistory,
    openIterateDialog: (initialContent?: string) => {
        promptPanelRef.value?.openIterateDialog?.(initialContent);
    },
    applyLocalPatch: (operation: PatchOperation) => {
        handleApplyLocalPatch({ operation })
    },
    reEvaluateActive: async () => {
        await evaluationHandler.handleReEvaluate();
    },
    // 🔧 Codex 修复：暴露 session store 恢复方法，供父组件在 session restore 完成后调用
    restoreConversationOptimizationFromSession: () => {
        conversationOptimization.restoreFromSessionStore();
    },
});
</script>

<style scoped>
.context-system-workspace {
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

.context-system-split {
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

.result-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.result-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
}

.tool-calls-section {
    flex: 0 0 auto;
}
</style>
