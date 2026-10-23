<template>
    <div
        class="basic-system-workspace"
        :class="{ 'compact-two-region': isCompact }"
        data-testid="workspace"
        data-mode="basic-system"
    >
        <div class="workspace-page-tools">
            <Teleport defer to="#compact-workspace-tools" :disabled="!isCompact">
            <WorkspaceUtilityMenu :compact="isCompact"
                :disabled="unwrappedLogicProps.isOptimizing || unwrappedLogicProps.isIterating || isAnyVariantRunning"
                :source="resolveSourceAssetRef(session.origin, session.assetBinding)"
                test-id="basic-system-workspace-utility-menu"
                @clear="handleClearContent"
            />
            </Teleport>
        </div>
        <div
            ref="splitRootRef"
            class="basic-system-split compact-workspace-pane"
            :style="{ gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : `${mainSplitLeftPct}% 12px 1fr` }"
        >
            <!-- 左侧：优化区域 -->
            <div v-show="!isCompact || mobileRegion === 'optimize'" class="split-pane compact-optimize-region" style="min-width: 0; height: 100%; overflow: hidden;">
                <OptimizeWorkspaceLayout ref="optimizeLayoutRef" :compact="isCompact"
                    @scroll="rememberOptimizeScroll">
                <template #original>
                <!-- 输入控制区域（可折叠） -->
                <TestSourceLinkedCard class="compact-original-card"
                    :style="{ flexShrink: 0 }"
                    :feedback-key="sourceAreaFeedback.original.key"
                    :feedback-tone="sourceAreaFeedback.original.tone"
                    :source-tone="sourceAreaFeedback.original.sourceTone"
                >
                    <!-- 折叠态：只显示标题栏 -->
                    <NFlex class="source-summary-heading"
                        v-if="isInputPanelCollapsed"
                        justify="space-between"
                        align="center"
                    >
                        <NFlex class="source-summary-group" align="center" :size="8">
                            <NText class="source-summary-title" :depth="1" style="font-size: 18px; font-weight: 500">
                                {{ t('promptOptimizer.originalPrompt') }}
                            </NText>
                            <NText class="source-summary-text"
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
                    <div class="workspace-input-panel" v-show="!isInputPanelCollapsed">
                    <InputPanelUI
                        :compact="isCompact"
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
                        :show-analyze-button="!isCompact"
                        :analyze-loading="analyzing"
                        @submit="handleOptimizeSafely"
                        @analyze="handleAnalyze"
                        @configModel="handleOpenModelManager"
                    >
                        <!-- 模型选择 -->
                        <template #model-label-extra>
                            <TextModelQuickSwitch v-if="!isCompact"
                                :model-key="selectedOptimizeModelKeyModel"
                                :options="modelSelection.textModelOptions.value"
                                :refresh-models="modelSelection.refreshTextModels"
                                :disabled="unwrappedLogicProps.isOptimizing"
                            />
                        </template>

                        <template #model-select>
                            <SelectWithConfig
                                v-model="selectedOptimizeModelKeyModel"
                                data-testid="basic-system-model-select"
                                :options="modelSelection.textModelOptions"
                                :getPrimary="OptionAccessors.getPrimary"
                                :getSecondary="OptionAccessors.getSecondary"
                                :getValue="OptionAccessors.getValue"
                                :placeholder="t('model.select.placeholder')"
                                size="medium"
                                :disabled="unwrappedLogicProps.isOptimizing"
                                filterable
                                :show-config-action="true"
                                :show-empty-config-c-t-a="true"
                                @focus="modelSelection.refreshTextModels"
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
                                :placeholder="t('template.select')"
                                size="medium"
                                :disabled="unwrappedLogicProps.isOptimizing"
                                filterable
                                :show-config-action="true"
                                :show-empty-config-c-t-a="true"
                                @focus="templateSelection.refreshOptimizeTemplates"
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
                    </div>
                </TestSourceLinkedCard>

                </template>
                <template #workspace>
                <!-- 优化工作区 -->
                <TestSourceLinkedCard class="compact-result-card"
                    :style="{ flex: 1, minHeight: '200px', overflow: 'hidden' }"
                    content-style="height: 100%; max-height: 100%; overflow: hidden;"
                    :feedback-key="sourceAreaFeedback.workspace.key"
                    :feedback-tone="sourceAreaFeedback.workspace.tone"
                    :source-tone="sourceAreaFeedback.workspace.sourceTone"
                >
                    <PromptPanelUI
                        :mobile-layout="isCompact"
                        :enable-evaluation="!isCompact"
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
                        :source-feedback-key="sourceAreaFeedback.workspace.key"
                        :source-feedback-tone="sourceAreaFeedback.workspace.tone"
                        :source-feedback-version="sourceAreaFeedback.workspace.resolvedVersion"
                        optimization-mode="system"
                        :advanced-mode-enabled="false"
                        :show-preview="false"
                        @iterate="handleIterate"
                        @openTemplateManager="handleOpenTemplateManager"
                        @switchVersion="logic.handleSwitchVersion"
                        @switchToV0="logic.handleSwitchToV0"
                        @save-favorite="handleSaveFavorite"
                        @apply-improvement="handleApplyImprovement"
                        @apply-patch="handleApplyPatch"
                        @save-local-edit="handleSaveLocalEdit"
                    />
                </TestSourceLinkedCard>
                </template>
                </OptimizeWorkspaceLayout>
            </div>

            <div
                v-if="!isCompact"
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
            <div v-show="!isCompact || mobileRegion === 'test'" ref="testPaneRef" class="split-pane compact-test-region" style="min-width: 0; height: 100%; overflow: hidden;">
                <TestWorkspaceLayout ref="testLayoutRef" :compact="isCompact" v-model:config-expanded="testConfigExpanded" :running="isAnyVariantRunning" :has-results="activeVariantIds.some(id => variantResults[id].requestPrompt !== undefined)"
                    @scroll="rememberTestScroll">
                    <template #input>
                    <!-- Kept mounted when mobile configuration is folded. -->
                    <!-- 测试输入（system 模式必填） -->
                    <NCard :style="{ flexShrink: 0 }" size="small">
                        <TestInputSection
                            v-model="testContentModel"
                            :label="t('test.content')"
                            :placeholder="t('test.placeholder')"
                            :help-text="isCompact ? undefined : t('test.simpleMode.help')"
                            :disabled="isAnyVariantRunning"
                            :mode="isCompact ? 'compact' : 'normal'"
                            :enable-fullscreen="true"
                            test-id="basic-system-test-input"
                        >
                            <template #header-actions>
                                <TestImageAttachmentControl
                                    v-model="testImageModel"
                                    :disabled="isAnyVariantRunning"
                                />
                            </template>
                        </TestInputSection>
                    </NCard>

                    </template>
                    <template #global-controls>
                    <!-- 顶部：列数与全局操作 -->
                    <NCard size="small" class="test-global-controls" :style="{ flexShrink: 0 }">
                        <div class="test-area-top">

                            <NFlex class="test-group-count" align="center" :size="8" :wrap="false" style="min-width: 0;">
                                <NText :depth="2" class="test-area-label">
                                    {{ t('workspace.testGroups') }}：
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

                            <NFlex v-if="!isCompact" align="center" justify="end" :size="8" :wrap="false">
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

                                <template v-if="!isCompact && (hasCompareCandidates || hasCompareEvaluation)">
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
                                        @apply-patch="handleApplyPatch"
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
                                <CompareHelpButton v-if="!isCompact && activeVariantIds.length >= 2" />
                                <NTag
                                    v-if="!isCompact && compareToolbarStatus"
                                    size="small"
                                    :type="compareToolbarStatus.type"
                                    :bordered="false"
                                >
                                    {{ compareToolbarStatus.label }}
                                </NTag>
                            </NFlex>
                        </div>
                    </NCard>

                    </template>
                    <!-- 桌面配置与结果列对齐；移动端配置紧凑排列，结果同时展示。 -->
                    <template #variant-controls>
                    <NCard size="small" class="test-variant-controls" :style="{ flexShrink: 0 }">
                        <div class="variant-deck" :style="{ gridTemplateColumns: testGridTemplateColumns }">
                            <div v-for="id in activeVariantIds" :key="id"  class="variant-cell">
                                <div
                                    class="variant-cell__controls"
                                    :class="{ 'variant-cell__controls--stacked': useStackedVariantControls }"
                                >
                                    <div v-if="!isCompact" class="variant-cell__meta">
                                        <TestVariantSourceTag
                                            class="variant-cell__label"
                                            :variant-label="getVariantLabel(id)"
                                            :selection="variantVersionModels[id].value"
                                            :resolved-version="getVariantResolvedVersion(id)"
                                            :labels="getTestPanelVersionLabels()"
                                            :feedback-key="variantSourceFeedback[id].key"
                                            :feedback-tone="variantSourceFeedback[id].tone"
                                            @activate="previewVariantSource(id)"
                                        />
                                        <CompareRoleBadge
                                            v-if="!isCompact && activeVariantIds.length >= 2"
                                            :entry="compareRoleEntryMap[id]"
                                            clickable
                                            @click="openCompareRoleConfig"
                                        />
                                        <TextModelQuickSwitch v-if="!isCompact"
                                            :model-key="variantModelKeyModels[id].value"
                                            :options="modelSelection.textModelOptions.value"
                                            :refresh-models="modelSelection.refreshTextModels"
                                            :disabled="variantRunning[id] || isAnyVariantRunning"
                                        />
                                    </div>

                                    <div class="variant-cell__actions">
                                        <button v-if="isCompact" type="button" class="test-config-group-label" :aria-label="t('workspace.viewPrompt') + ' ' + id.toUpperCase()" @click="previewVariantSource(id)">{{ id.toUpperCase() }}</button>
                                        <div class="variant-cell__version">
                                        <NText v-if="isCompact" depth="2" class="test-settings-label">{{ t('workspace.promptVersion') }}</NText>
                                        <TestPanelVersionSelect
                                            :value="variantVersionModels[id].value"
                                            :options="versionOptions"
                                            :disabled="variantRunning[id] || isAnyVariantRunning"
                                            :test-id="getVariantVersionTestId(id)"
                                            @update:value="(value) => handleVariantVersionChange(id, value)"
                                        />
                                        </div>
                                        <div class="variant-cell__model">
                                            <NText v-if="isCompact" depth="2" class="test-settings-label">{{ t('test.model') }}</NText>
                                            <SelectWithConfig
                                                :data-testid="getVariantModelTestId(id)"
                                                :model-value="variantModelKeyModels[id].value"
                                                @update:model-value="(value) => { variantModelKeyModels[id].value = String(value ?? '') }"
                                                :options="modelSelection.textModelOptions"
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
                                                @config="handleOpenModelManager"
                                                style="min-width: 0; width: 100%;"
                                            />
                                        </div>

                                        <div v-if="!isCompact" class="variant-cell__run">
                                            <ThemedTooltip :label="t('test.layout.runThisColumn')">
                                                <NButton
                                                    type="primary"
                                                    size="small"
                                                    circle
                                                    :loading="variantRunning[id]"
                                                    :disabled="isAnyVariantRunning && !variantRunning[id]"
                                                    @click="() => runVariant(id)"
                                                    :data-testid="getVariantRunTestId(id)"
                                                    :aria-label="t('test.layout.runThisColumn')"
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

                    </template>
                    <template #config-actions>
                        <div class="test-run-controls">
                            <NButton type="primary" :loading="isAnyVariantRunning" :disabled="isAnyVariantRunning"
                                data-testid="basic-system-test-run-all" @click="runAllVariants">
                                {{ t('test.layout.runAll') }}
                            </NButton>
                        </div>
                    </template>
                    <template #config-summary>{{ t('test.content') }} · {{ testContentModel }}</template>
                    <template #results>
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
                                <MobileTestResultHeader v-if="isCompact"
                                    :variant="{ id, sourceLabel: getVariantVersionLabel(id), running: variantRunning[id],
                                        promptContent: variantResults[id].requestPrompt ?? resolveTestPrompt(variantVersionModels[id].value).text,
                                        hasPromptSnapshot: variantResults[id].requestPrompt !== undefined }"
                                    :busy="isAnyVariantRunning" @run="runVariant(id)" />
                                <p v-if="variantFailed[id]" role="alert" class="compact-test-error">{{ t('workspace.testFailed') }}</p>
                                <p v-if="isCompact && isVariantStale(id)" class="compact-stale">{{ t('workspace.staleResult') }}</p>
                                <OutputDisplay
                                    :fit-content="isCompact"
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
                                                sub-mode-key="basic-system"
                                                :variant-id="id"
                                                :content="logic.optimizedPrompt.value || logic.prompt.value"
                                                :original-content="logic.prompt.value"
                                                function-mode="basic"
                                                optimization-mode="system"
                                                :disabled="variantRunning[id] || isVariantStale(id)"
                                                :test-id="`save-test-example-basic-system-${id}`"
                                            />
                                            <EvaluationScoreBadge
                                                v-if="!isCompact && (getResultEvaluationProps(id).hasEvaluation || getResultEvaluationProps(id).isEvaluating)"
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
                                                @apply-patch="handleApplyPatch"
                                            />
                                            <FocusAnalyzeButton
                                                v-else-if="!isCompact"
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
                    </template>
                </TestWorkspaceLayout>
            </div>
        </div>

        <TestSourcePreview v-model:show="sourcePreviewOpen" :title="sourcePreviewTitle"
          :content="sourcePreviewContent" :editable="sourcePreviewEditable" @edit="editPreviewSource" />
        <WorkspaceRegionSwitch v-if="isCompact" v-model="mobileRegion"
            :optimizing="unwrappedLogicProps.isOptimizing || unwrappedLogicProps.isIterating"
            :testing="isAnyVariantRunning" />
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
            @apply-local-patch="handleApplyPatch"
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
    </div>
</template>

<script setup lang="ts">
import TestSourcePreview from '../common/TestSourcePreview.vue'
import TestWorkspaceLayout from '../common/TestWorkspaceLayout.vue'
import MobileTestResultHeader from '../common/MobileTestResultHeader.vue'
import OptimizeWorkspaceLayout from '../common/OptimizeWorkspaceLayout.vue'
import WorkspaceRegionSwitch from '../common/WorkspaceRegionSwitch.vue'
import { useElementSize } from '@vueuse/core'
import { useWorkspacePresentation } from '../../composables/ui/useWorkspacePresentation'
import { useWorkspaceSplit } from '../../composables/ui/useWorkspaceSplit'
import { useTestVariantBindings } from '../../composables/workspaces/useTestVariantBindings'
import { useWorkspaceEvaluationActions } from '../../composables/workspaces/useWorkspaceEvaluationActions'
import { useTestSourcePreview } from '../../composables/workspaces/useTestSourcePreview'
const {
  isCompact, mobileRegion, testConfigExpanded, inputCollapsed: isInputPanelCollapsed,
  optimizeLayoutRef, testLayoutRef, rememberOptimizeScroll, rememberTestScroll,
  resetTestScroll, showOptimizationSection, resetMobileView,
} = useWorkspacePresentation('system')

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
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useToast } from '../../composables/ui/useToast'
import {
  useBasicSystemSession,
  type TestPanelVersionValue,
  type TestVariantId,
} from '../../stores/session/useBasicSystemSession'
import { useBasicWorkspaceLogic } from '../../composables/workspaces/useBasicWorkspaceLogic'
import { useWorkspaceModelSelection } from '../../composables/workspaces/useWorkspaceModelSelection'
import { useWorkspaceTemplateSelection } from '../../composables/workspaces/useWorkspaceTemplateSelection'
import { useEvaluationHandler } from '../../composables/prompt/useEvaluationHandler'
import { buildCompareEvaluationPayload, useCompareRoleConfig, useTestSourceAreaFeedback, useTestVariantSourceFeedback } from '../../composables/prompt'
import { provideEvaluation } from '../../composables/prompt/useEvaluationContext'
import { NButton, NCard, NFlex, NIcon, NText, NRadioGroup, NRadioButton, NTag } from 'naive-ui'
import InputPanelUI from '../InputPanel.vue'
import PromptPanelUI from '../PromptPanel.vue'
import WorkspaceUtilityMenu from '../common/WorkspaceUtilityMenu.vue'
import ThemedTooltip from '../common/ThemedTooltip.vue'
import { resolveSourceAssetRef } from '../../utils/source-asset'
import TestInputSection from '../TestInputSection.vue'
import TestImageAttachmentControl from '../TestImageAttachmentControl.vue'
import OutputDisplay from '../OutputDisplay.vue'
import SaveTestResultExampleButton from '../SaveTestResultExampleButton.vue'
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
import SelectWithConfig from '../SelectWithConfig.vue'
import TextModelQuickSwitch from '../TextModelQuickSwitch.vue'
import TestPanelVersionSelect from '../TestPanelVersionSelect.vue'
import TestSourceLinkedCard from '../TestSourceLinkedCard.vue'
import TestVariantSourceTag from '../TestVariantSourceTag.vue'
import { OptionAccessors } from '../../utils/data-transformer'
import {
  buildTestPanelVersionPromptRef,
  buildTestPanelVersionOptions,
  formatTestPanelVersionSelectionLabel,
  resolveTestPanelVersionSelection,
} from '../../utils/testPanelVersion'
import type { AppServices } from '../../types/services'
import type { IteratePayload } from '../../types/workspace'
import {
  applyPatchOperationsToText,
  type ImageInputRef,
  type PatchOperation,
  type Template,
} from '@prompt-optimizer/core'
import type { PersistedCompareSnapshotRoles } from '../../types/evaluation'
import { useWorkspaceTestBatch } from '../../composables/workspaces/useWorkspaceTestBatch'

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

const { mainSplitLeftPct, onSplitPointerDown, onSplitKeydown } = useWorkspaceSplit({
  root: splitRootRef,
  getPercent: () => session.layout.mainSplitLeftPct,
  setPercent: percent => session.setMainSplitLeftPct(percent),
})

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
  runIterateWithInput?: (input: string) => boolean
  refreshIterateTemplateSelect?: () => void
  confirmDiscardChanges?: () => Promise<boolean>
} | null
const promptPanelRef = ref<PromptPanelExpose>(null)

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
    // 分析应重置当前工作区链，创建仅存在于内存中的虚拟 V0，
    // 避免下方提示词工作区和右侧测试继续沿用旧的优化链。
    logic.handleAnalyze()
    evaluation.clearResult('prompt-only')
    evaluation.clearResult('prompt-iterate')

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

const testImageModel = computed<ImageInputRef | null>({
  get: () => session.testImageB64
    ? {
        b64: session.testImageB64,
        mimeType: session.testImageMimeType || 'image/png',
      }
    : null,
  set: (value) => {
    session.updateTestImage(value?.b64 ?? null, value?.mimeType ?? '')
  },
})

const getTestInputImages = (): ImageInputRef[] => {
  const image = testImageModel.value
  return image ? [image] : []
}

const getSafeImageProviderErrorMessage = (
  error: unknown,
  inputImages: ImageInputRef[],
): string => {
  if (!(error instanceof Error)) return ''

  let message = error.message.trim().replace(
    /data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi,
    '[redacted-image]',
  )
  for (const image of inputImages) {
    const rawB64 = image.b64.trim()
    if (rawB64 && message.includes(rawB64)) {
      message = message.split(rawB64).join('[redacted-image]')
    }
  }

  return message
}

// 🔧 为 SelectWithConfig 的 v-model 创建解包的 computed
const selectedOptimizeModelKeyModel = computed({
  get: () => logic.selectedOptimizeModelKey.value,
  set: (value) => { logic.selectedOptimizeModelKey.value = value }
})

const selectedTemplateIdModel = computed({
  get: () => logic.selectedTemplateId.value,
  set: (value) => { logic.selectedTemplateId.value = value }
})

const {
  testColumnCountModel, activeVariantIds, variantVersionModels, variantModelKeyModels,
  allVariantIds: ALL_VARIANT_IDS,
} = useTestVariantBindings({
  getVariants: () => session.testVariants,
  getCount: () => session.layout.testColumnCount,
  setVariant: (id, patch) => session.updateTestVariant(id, patch),
  setCount: count => session.setTestColumnCount(count),
})
const originalTestModelKeyModel = variantModelKeyModels.a
const optimizedTestModelKeyModel = variantModelKeyModels.b
const useStackedVariantControls = computed(() => activeVariantIds.value.length >= 2)

const getTestPanelVersionLabels = () => ({
  workspace: t('test.layout.workspace'),
  previous: t('test.layout.previous'),
  original: t('test.layout.original'),
})

// 版本选项：默认显示“工作区”与“原始(v0)”；存在可用上一版时显示“上一版(vN)”动态别名。
const versionOptions = computed(() => {
  return buildTestPanelVersionOptions(
    logic.currentVersions.value || [],
    getTestPanelVersionLabels(),
    {
      currentVersionId: logic.currentVersionId.value,
      workspacePrompt: logic.optimizedPrompt.value || '',
      originalPrompt: logic.prompt.value || '',
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

// Retain the desktop width limit; mobile renders all enabled groups in two columns.
const { width: testPaneWidth } = useElementSize(testPaneRef)
const canUseFourColumns = computed(() => isCompact.value || testPaneWidth.value >= 1000)
watch(canUseFourColumns, (ok) => {
  if (!ok && testColumnCountModel.value === 4) testColumnCountModel.value = 3
}, { immediate: true })
const testGridTemplateColumns = computed(() => `repeat(${isCompact.value ? 2 : testColumnCountModel.value}, minmax(0, 1fr))`)

type ResolvedTestPrompt = { text: string; resolvedVersion: number }

const resolveTestPrompt = (selection: TestPanelVersionValue): ResolvedTestPrompt => {
  const resolved = resolveTestPanelVersionSelection({
    selection,
    versions: logic.currentVersions.value || [],
    currentVersionId: logic.currentVersionId.value,
    workspacePrompt: logic.optimizedPrompt.value || '',
    originalPrompt: logic.prompt.value || '',
  })

  return {
    text: resolved.text,
    resolvedVersion: resolved.resolvedVersion,
  }
}

// Pinia setup store 会自动解包 refs。
// testVariantResults / testVariantLastRunFingerprint 在 restoreSession 时会被整对象替换，
// 这里必须通过 storeToRefs 持有 Ref，避免组件继续写入旧对象。
const {
  testVariantResults: variantResults,
  testVariantLastRunFingerprint: variantLastRunFingerprint,
} = storeToRefs(session)

const variantFailed = reactive<Record<TestVariantId, boolean>>({ a: false, b: false, c: false, d: false })

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

const {
  show: sourcePreviewOpen, selectedId: sourcePreviewId,
  content: sourcePreviewContent, title: sourcePreviewTitle, editable: sourcePreviewEditable,
  preview: openSourcePreview, edit: editPreviewSource,
} = useTestSourcePreview({
  mode: 'live',
  readSource: (id) => {
    const selection = variantVersionModels[id].value
    return {
      content: resolveTestPrompt(selection).text,
      title: `${t('workspace.viewPrompt')} · ${getVariantLabel(id)} · ${getVariantVersionLabel(id)}`,
      editable: [0, 'workspace'].includes(selection),
      view: selection === 0 ? 'original' : 'workspace',
    }
  },
  onEdit: async (view) => {
    if (view === 'original') isInputPanelCollapsed.value = false
    await showOptimizationSection(view, 'content')
    activateVariantSource(sourcePreviewId.value)
  },
})
const previewVariantSource = (id: TestVariantId) => {
  if (!isCompact.value) { activateVariantSource(id); return }
  openSourcePreview(id)
}

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

const getVariantResult = (id: TestVariantId) => variantResults.value[id]
const hasVariantResult = (id: TestVariantId) => !!(variantResults.value[id]?.result || '').trim()

// 用于 stale 判定：生成短且稳定的指纹，避免把长文本写入持久化存储
const hashString = (input: string): string => {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}

// 图片最多可达 5 MiB；只在图片本身变化时计算一次，避免每次渲染、每列 stale 检查都重复扫描 base64。
const testImageFingerprint = computed(() => session.testImageB64
  ? hashString(`${session.testImageMimeType || 'image/png'}:${session.testImageB64}`)
  : 'none')

const getVariantFingerprint = (id: TestVariantId) => {
  const selection = variantVersionModels[id].value
  const resolved = resolveTestPrompt(selection)
  const modelKey = variantModelKeyModels[id].value || ''
  // system 模式测试输入会直接影响输出，因此需要纳入 fingerprint
  const systemHash = hashString((resolved.text || '').trim())
  const userHash = hashString((logic.testContent.value || '').trim())
  const textFingerprint = `${String(selection)}:${resolved.resolvedVersion}:${modelKey}:${systemHash}:${userHash}`
  // 无图时保持历史 fingerprint 字符串完全不变；有图才追加图片摘要，删除后自然失效。
  return testImageFingerprint.value === 'none'
    ? textFingerprint
    : `${textFingerprint}:${testImageFingerprint.value}`
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
    modelKey: variantModelKeyModels[id].value || undefined,
    versionLabel: getVariantVersionLabel(id),
  }))
)
const compareRoleConfig = useCompareRoleConfig({
  candidates: compareRoleCandidates,
  persistedRoles: toRef(session, 'compareSnapshotRoles'),
  persistedRoleSignatures: toRef(session, 'compareSnapshotRoleSignatures'),
  persistRoles: (roles, signatures) => session.updateCompareSnapshotRoles(roles, signatures),
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

const hasWorkspaceCompareCandidate = computed(() =>
  compareReadyVariantIds.value.some((id) => buildVariantPromptRef(id).kind === 'workspace')
)

type VariantTestInput = {
  systemPrompt: string
  userPrompt: string
  modelKey: string
  resolvedVersion: number
}

const getVariantTestInput = (id: TestVariantId): VariantTestInput | null => {
  const modelKey = (variantModelKeyModels[id].value || '').trim()
  if (!modelKey) {
    if (isCompact.value) {
      testConfigExpanded.value = true
    }
    toast.error(t('test.error.noModel'))
    return null
  }

  const userPrompt = (logic.testContent.value || '').trim()
  if (!userPrompt) {
    if (isCompact.value) testConfigExpanded.value = true
    toast.error(t('test.error.noTestContent'))
    return null
  }

  const resolved = resolveTestPrompt(variantVersionModels[id].value)
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
    inputImages?: ImageInputRef[]
    runFingerprint?: string
    onError?: (error: unknown) => void
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
  if (isCompact.value && !opts?.allowParallel) testConfigExpanded.value = false
  if (id === 'a') resetTestScroll()

  if (!opts?.skipClearEvaluation) {
    evaluationHandler.clearBeforeTest()
  }

  variantResults.value[id] = { result: '', reasoning: '', requestPrompt: `[system]\n${input.systemPrompt}\n\n[user]\n${input.userPrompt}` }
  variantRunning[id] = true
  variantFailed[id] = false
  const inputImages = opts?.inputImages ?? getTestInputImages()
  const runFingerprint = opts?.runFingerprint ?? getVariantFingerprint(id)

  try {
    const callbacks = {
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
    }

    if (inputImages.length > 0) {
      await promptService.testPromptStream(
        input.systemPrompt,
        input.userPrompt,
        input.modelKey,
        callbacks,
        inputImages,
      )
    } else {
      // 保留原有纯文本调用形态，避免影响已有实现和调用方。
      await promptService.testPromptStream(
        input.systemPrompt,
        input.userPrompt,
        input.modelKey,
        callbacks,
      )
    }

    if (!opts?.silentSuccess) {
      toast.success(t('toast.success.testComplete'))
    }
    return true
  } catch (error) {
    variantFailed[id] = true
    opts?.onError?.(error)
    if (!opts?.silentError) {
      const imageProviderMessage = inputImages.length > 0
        ? getSafeImageProviderErrorMessage(error, inputImages)
        : ''
      toast.error(imageProviderMessage || t('toast.error.testFailed'))
    }
    return false
  } finally {
    variantRunning[id] = false
    variantLastRunFingerprint.value[id] = variantFailed[id] ? `failed:${runFingerprint}` : runFingerprint
    if (opts?.persist !== false) {
      void session.saveSession()
    }
  }
}

const runAllVariants = useWorkspaceTestBatch({
  isRunning: () => isAnyVariantRunning.value,
  getIds: () => activeVariantIds.value,
  validate: getVariantTestInput,
  prepare: (ids) => {
    if (isCompact.value) testConfigExpanded.value = false

    // 对比两侧固定使用同一次点击时的图片与 fingerprint 快照。
    const sharedInputImages = getTestInputImages()
    const runFingerprints = Object.fromEntries(
      ids.map((id) => [id, getVariantFingerprint(id)]),
    ) as Record<TestVariantId, string>
    const runErrors: unknown[] = []

    evaluationHandler.clearBeforeTest()

    return {
      run: async (id) =>
        runVariant(id, {
          silentSuccess: true,
          silentError: true,
          skipClearEvaluation: true,
          allowParallel: true,
          persist: false,
          inputImages: sharedInputImages,
          runFingerprint: runFingerprints[id],
          onError: (error) => runErrors.push(error),
        }),
      complete: (results) => {
        void session.saveSession()

        if (results.every(Boolean)) {
          toast.success(t('toast.success.testComplete'))
        } else {
          const imageProviderMessage = sharedInputImages.length > 0
            ? getSafeImageProviderErrorMessage(runErrors[0], sharedInputImages)
            : ''
          toast.error(imageProviderMessage || t('toast.error.testFailed'))
        }
      },
    }
  },
})

const buildEvaluationTarget = () => {
  const workspacePrompt = logic.optimizedPrompt.value || ''
  const referencePrompt = (logic.prompt.value || '').trim()
  const normalizedWorkspacePrompt = workspacePrompt.trim()

  return {
    workspacePrompt,
    referencePrompt:
      referencePrompt && referencePrompt !== normalizedWorkspacePrompt
        ? logic.prompt.value
        : undefined,
  }
}

const buildVariantPromptRef = (id: TestVariantId) => {
  const selection = variantVersionModels[id].value
  const resolved = resolveTestPanelVersionSelection({
    selection,
    versions: logic.currentVersions.value || [],
    currentVersionId: logic.currentVersionId.value,
    workspacePrompt: logic.optimizedPrompt.value || '',
    originalPrompt: logic.prompt.value || '',
  })
  return buildTestPanelVersionPromptRef(resolved, getTestPanelVersionLabels())
}

const buildTestImageEvaluationMedia = () => {
  const assetId = session.testImageAssetId?.trim() || ''
  const b64 = session.testImageB64?.trim() || ''
  if (!assetId && !b64) return undefined

  return [{
    label: t('test.image.evaluationLabel'),
    ...(assetId ? { assetId } : { b64 }),
    mimeType: session.testImageMimeType || 'image/png',
  }]
}

const buildSharedTextTestCaseDraft = () => ({
  id: 'shared-test-case',
  label: t('test.content'),
  input: logic.testContent.value.trim()
    ? {
        kind: 'text' as const,
        label: t('test.content'),
        content: logic.testContent.value,
        media: buildTestImageEvaluationMedia(),
      }
    : undefined,
})

const resultEvaluationTargets = computed(() =>
  Object.fromEntries(
    activeVariantIds.value.map((id) => [
      id,
      {
        variantId: id,
        target: buildEvaluationTarget(),
        testCase: {
          id: `${id}-test-case`,
          label: t('test.content'),
          input: {
            kind: 'text' as const,
            label: t('test.content'),
            content: logic.testContent.value || '',
            media: buildTestImageEvaluationMedia(),
          },
        },
        snapshot: {
          id,
          label: getVariantLabel(id),
          testCaseId: `${id}-test-case`,
          promptRef: buildVariantPromptRef(id),
          promptText: resolveTestPrompt(variantVersionModels[id].value).text,
          output: variantResults.value[id]?.result || '',
          reasoning: variantResults.value[id]?.reasoning || '',
          modelKey: variantModelKeyModels[id].value || undefined,
          versionLabel: getVariantVersionLabel(id),
        },
      },
    ])
  )
)

const comparePayload = computed(() =>
  buildCompareEvaluationPayload({
    target: buildEvaluationTarget(),
    testCases: [buildSharedTextTestCaseDraft()],
    snapshotRolesOverride: compareRoleConfig.validManualRoles.value,
    snapshots: compareReadyVariantIds.value.map((id) => ({
      id,
      label: getVariantLabel(id),
      testCaseId: 'shared-test-case',
      promptRef: buildVariantPromptRef(id),
      promptText: resolveTestPrompt(variantVersionModels[id].value).text,
      output: variantResults.value[id]?.result || '',
      reasoning: variantResults.value[id]?.reasoning || '',
      modelKey: variantModelKeyModels[id].value,
      versionLabel: getVariantVersionLabel(id),
    })),
  })
)

const hasEvaluationWorkspacePrompt = computed(() => !!logic.optimizedPrompt.value.trim())
const hasEvaluationTestContent = computed(() => !!logic.testContent.value.trim())
const canEvaluateResult = computed(() =>
  hasEvaluationWorkspacePrompt.value && hasEvaluationTestContent.value
)
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

const evaluationHandler = useEvaluationHandler({
  services,
  analysisOptimizedPrompt: computed(() => logic.optimizedPrompt.value || ''),
  resultTargets: resultEvaluationTargets,
  evaluationModelKey: computed(() =>
    optimizedTestModelKeyModel.value || originalTestModelKeyModel.value || logic.selectedTestModelKey.value || ''
  ),
  functionMode: computed(() => 'basic'),
  subMode: computed(() => 'system'),
  comparePayload,
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

const analyzing = ref(false)

const ensureResultEvaluationReady = (): boolean => {
  if (!hasEvaluationWorkspacePrompt.value) {
    toast.error(t('test.error.noWorkspacePrompt'))
    return false
  }

  if (!hasEvaluationTestContent.value) {
    toast.error(t('test.error.noTestContent'))
    return false
  }

  return true
}

const ensureCompareEvaluationReady = (): boolean => {
  if (!hasEvaluationWorkspacePrompt.value) {
    toast.error(t('test.error.noWorkspacePrompt'))
    return false
  }

  if (!hasEvaluationTestContent.value) {
    toast.error(t('test.error.noTestContent'))
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

const openCompareRoleConfig = () => {
  compareRoleConfig.openDialog()
}

const handleCompareRoleConfigConfirm = async (
  roles: PersistedCompareSnapshotRoles<TestVariantId>
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

// ==================== 事件处理 ====================

const handleOptimizeSafely = async () => {
  if (isCompact.value && promptPanelRef.value?.confirmDiscardChanges && !(await promptPanelRef.value.confirmDiscardChanges())) return
  const pending = logic.handleOptimize()
  await pending
}
// 迭代优化
const handleIterate = (payload: IteratePayload) => {
  logic.handleIterate(payload)
}

// 评估
const {
  handleEvaluateResult, handleResultEvaluateWithFeedbackEvent,
  handleEvaluate, handleEvaluateWithFeedback,
  handleReEvaluateActive, handleEvaluateActiveWithFeedback,
} = useWorkspaceEvaluationActions({
  handler: evaluationHandler,
  getActiveDetail: () => evaluation.state.activeDetail,
  ensureResultReady: ensureResultEvaluationReady,
  ensureCompareReady: ensureCompareEvaluationReady,
  onResultEvaluated: (variantId) => {
    if (evaluation.state.result[variantId]?.result && variantId in resultEvaluationFingerprint) {
      resultEvaluationFingerprint[variantId as TestVariantId] = getVariantFingerprint(variantId as TestVariantId)
    }
  },
  onCompareEvaluated: () => {
    if (evaluation.state.compare.result) {
      compareEvaluationFingerprint.value = buildCompareEvaluationFingerprint()
    }
  },
})

// 分析评估（prompt-only）
const handleAnalyzeEvaluate = async () => {
  await handleEvaluateInternal('prompt-only')
}

// 显示详情
const showResultDetail = (variantId: string) => {
  evaluation.showDetail('result', variantId)
}

const showDetail = (type: 'compare') => {
  evaluation.showDetail(type)
}

// 应用改进
const handleApplyImprovement = (payload: { improvement: string; type: string }) => {
  evaluation.closePanel()
  promptPanelRef.value?.openIterateDialog?.(payload.improvement)
}

const handleRewriteFromEvaluation = evaluationHandler.createRewriteFromEvaluationHandler(promptPanelRef)

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
  resultEvaluationFingerprint.a = ''
  resultEvaluationFingerprint.b = ''
  resultEvaluationFingerprint.c = ''
  resultEvaluationFingerprint.d = ''
  compareEvaluationFingerprint.value = ''
}

const handleClearContent = () => {
  for (const id of ALL_VARIANT_IDS) variantFailed[id] = false
  resetMobileView()
  logic.clearContent()
  handleClearEvaluation()
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
  isUpdateBusy: () => logic.isOptimizing.value || logic.isIterating.value || isAnyVariantRunning.value || evaluation.isAnyEvaluating.value,
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
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: visible;
}

.workspace-page-tools {
    display: contents;
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
