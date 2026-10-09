<template>
    <div class="image-text2image-workspace" data-testid="workspace" data-mode="image-text2image">
        <div class="workspace-page-tools">
            <WorkspaceUtilityMenu
                :disabled="isOptimizing || isIterating || isAnyVariantRunning || isExtractingFromImage"
                :source="resolveSourceAssetRef(session.origin, session.assetBinding)"
                test-id="image-text2image-workspace-utility-menu"
                @clear="handleClearContent"
            />
        </div>
        <div
            ref="splitRootRef"
            class="image-text2image-split"
            :style="{ gridTemplateColumns: `${mainSplitLeftPct}% 12px 1fr` }"
        >
            <!-- 左侧：提示词优化区域（文本模型） -->
            <div class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
                <NFlex
                    vertical
                    :style="{ overflow: 'auto', height: '100%', minHeight: 0 }"
                    size="medium"
                >
            <!-- 输入控制区域 - 对齐InputPanel布局 -->
            <TestSourceLinkedCard
                :style="{ flexShrink: 0 }"
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
                            {{ t('imageWorkspace.input.originalPrompt') }}
                        </NText>
                        <NText
                            v-if="originalPrompt"
                            depth="3"
                            style="font-size: 12px;"
                        >
                            {{ promptSummary }}
                        </NText>
                    </NFlex>
                    <NFlex align="center" :size="8">
                        <PromptGardenInspirationPopover
                            mode="image-text2image"
                            :has-prompt="!!originalPrompt.trim()"
                            :disabled="isPromptGardenGuideDisabled"
                            test-id="image-text2image-prompt-garden-inspiration"
                            @apply="handlePromptGardenImportConfirm"
                            @open-import="showPromptGardenImport = true"
                        />
                        <NFlex align="center" :size="6" class="reference-action-toolbar">
                            <NTooltip
                                v-for="button in referenceActionButtons"
                                :key="button.kind"
                                trigger="hover"
                                :overlay-style="referenceActionTooltipOverlayStyle"
                                :content-style="referenceActionTooltipContentStyle"
                                :theme-overrides="referenceActionTooltipThemeOverrides"
                                to="body"
                                :flip="true"
                            >
                                <template #trigger>
                                    <span class="reference-action-button-wrap">
                                        <NButton
                                            type="tertiary"
                                            size="small"
                                            ghost
                                            class="header-utility-button"
                                            :data-testid="`reference-action-${button.kind}-button`"
                                            :loading="button.loading"
                                            :disabled="button.disabled"
                                            @click="triggerReferenceAction(button.kind)"
                                        >
                                            <template #icon>
                                                <NIcon>
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                                                        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 7.5h3l1.2-1.8A1.5 1.5 0 0110 5h4a1.5 1.5 0 011.3.7l1.2 1.8h3A1.5 1.5 0 0121 9v8.5A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5V9a1.5 1.5 0 011.5-1.5Z" />
                                                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.5a3 3 0 106 0 3 3 0 00-6 0Z" />
                                                    </svg>
                                                </NIcon>
                                            </template>
                                            {{ t(button.labelKey) }}
                                        </NButton>
                                    </span>
                                </template>
                                {{ t(button.tooltipKey) }}
                            </NTooltip>

                            <div
                                v-if="referenceAction.hasSourceImage || referenceAction.status !== 'idle'"
                                class="reference-action-anchor"
                            >
                                <AppPreviewImage
                                    v-if="referenceAction.sourceImagePreviewUrl"
                                    class="reference-action-thumbnail"
                                    :src="referenceAction.sourceImagePreviewUrl"
                                    :alt="t('imageWorkspace.referenceImage.thumbnailAlt')"
                                    width="40"
                                    height="40"
                                    object-fit="cover"
                                />

                                <NTag
                                    v-if="referenceActionStatusLabelKey"
                                    size="small"
                                    :bordered="false"
                                    :type="referenceAction.status === 'error' ? 'error' : 'default'"
                                    class="reference-action-status"
                                >
                                    {{ t(referenceActionStatusLabelKey) }}
                                </NTag>
                            </div>
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
                </NFlex>

                <!-- 展开态：完整输入面板 -->
                <NSpace v-else vertical :size="16">
                    <!-- 标题区域 -->
                    <NFlex justify="space-between" align="center" :wrap="false">
                        <NText
                            :depth="1"
                            style="font-size: 18px; font-weight: 500"
                            >{{
                                t("imageWorkspace.input.originalPrompt")
                            }}</NText
                        >
                        <NFlex align="center" :size="8">
                            <PromptGardenInspirationPopover
                                mode="image-text2image"
                                :has-prompt="!!originalPrompt.trim()"
                                :disabled="isPromptGardenGuideDisabled"
                                test-id="image-text2image-prompt-garden-inspiration"
                                @apply="handlePromptGardenImportConfirm"
                                @open-import="showPromptGardenImport = true"
                            />
                            <NFlex align="center" :size="6" class="reference-action-toolbar">
                                <NTooltip
                                    v-for="button in referenceActionButtons"
                                    :key="button.kind"
                                    trigger="hover"
                                    :overlay-style="referenceActionTooltipOverlayStyle"
                                    :content-style="referenceActionTooltipContentStyle"
                                    :theme-overrides="referenceActionTooltipThemeOverrides"
                                    to="body"
                                    :flip="true"
                                >
                                    <template #trigger>
                                        <span class="reference-action-button-wrap">
                                            <NButton
                                                type="tertiary"
                                                size="small"
                                                ghost
                                                class="header-utility-button"
                                                :data-testid="`reference-action-${button.kind}-button`"
                                                :loading="button.loading"
                                                :disabled="button.disabled"
                                                @click="triggerReferenceAction(button.kind)"
                                            >
                                                <template #icon>
                                                    <NIcon>
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            stroke-width="1.8"
                                                        >
                                                            <path
                                                                stroke-linecap="round"
                                                                stroke-linejoin="round"
                                                                d="M4.5 7.5h3l1.2-1.8A1.5 1.5 0 0110 5h4a1.5 1.5 0 011.3.7l1.2 1.8h3A1.5 1.5 0 0121 9v8.5A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5V9a1.5 1.5 0 011.5-1.5Z"
                                                            />
                                                            <path
                                                                stroke-linecap="round"
                                                                stroke-linejoin="round"
                                                                d="M9 12.5a3 3 0 106 0 3 3 0 00-6 0Z"
                                                            />
                                                        </svg>
                                                    </NIcon>
                                                </template>
                                                {{ t(button.labelKey) }}
                                            </NButton>
                                        </span>
                                    </template>
                                    {{ t(button.tooltipKey) }}
                                </NTooltip>

                                <div
                                    v-if="referenceAction.hasSourceImage || referenceAction.status !== 'idle'"
                                    class="reference-action-anchor"
                                >
                                    <AppPreviewImage
                                        v-if="referenceAction.sourceImagePreviewUrl"
                                        class="reference-action-thumbnail"
                                        :src="referenceAction.sourceImagePreviewUrl"
                                        :alt="t('imageWorkspace.referenceImage.thumbnailAlt')"
                                        width="40"
                                        height="40"
                                        object-fit="cover"
                                    />

                                    <NTag
                                        v-if="referenceActionStatusLabelKey"
                                        size="small"
                                        :bordered="false"
                                        :type="referenceAction.status === 'error' ? 'error' : 'default'"
                                        class="reference-action-status"
                                    >
                                        {{ t(referenceActionStatusLabelKey) }}
                                    </NTag>
                                </div>
                            </NFlex>
                            <NButton
                                type="tertiary"
                                size="small"
                                @click="openFullscreen"
                                :title="t('common.expand')"
                                ghost
                                round
                            >
                                <template #icon>
                                    <NIcon>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            stroke-width="2"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                                            />
                                        </svg>
                                    </NIcon>
                                </template>
                            </NButton>
                            <!-- 折叠按钮 -->
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
                        </NFlex>
                    </NFlex>

                    <!-- 输入框 -->
                    <VariableAwareInput
                        v-if="variableInputData"
                        data-testid="image-text2image-input"
                        :model-value="originalPrompt"
                        @update:model-value="handleOriginalPromptInput"
                        :readonly="isOptimizing"
                        :placeholder="t('imageWorkspace.input.originalPromptPlaceholder')"
                        :autosize="{ minRows: 4, maxRows: 12 }"
                        v-bind="variableInputData"
                        clearable
                        show-count
                        @variable-extracted="handleVariableExtracted"
                        @add-missing-variable="handleAddMissingVariable"
                    />
                    <NInput
                        v-else
                        v-model:value="originalPrompt"
                        type="textarea"
                        data-testid="image-text2image-input"
                        :placeholder="
                            t('imageWorkspace.input.originalPromptPlaceholder')
                        "
                        :rows="4"
                        :autosize="{ minRows: 4, maxRows: 12 }"
                        clearable
                        show-count
                        :disabled="isOptimizing"
                    />

                    <!-- 控制面板 - 使用网格布局 -->
                    <NGrid :cols="24" :x-gap="8" responsive="screen">
                        <!-- 文本模型选择 -->
                        <NGridItem :span="7" :xs="24" :sm="7">
                            <NSpace vertical :size="8">
                                <NFlex align="center" :size="6" :wrap="false">
                                    <NText
                                        :depth="2"
                                        style="font-size: 14px; font-weight: 500; flex-shrink: 0;"
                                        >{{
                                            t("imageWorkspace.input.textModel")
                                        }}</NText
                                    >
                                    <TextModelQuickSwitch
                                        :model-key="selectedTextModelKey"
                                        :options="textModelOptions"
                                        :refresh-models="modelSelection.refreshTextModels"
                                        :disabled="isOptimizing"
                                    />
                                </NFlex>
                                <template v-if="appOpenModelManager">
                                    <SelectWithConfig
                                        data-testid="image-text2image-text-model-select"
                                        v-model="selectedTextModelKey"
                                        :options="textModelOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="
                                            OptionAccessors.getSecondary
                                        "
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="
                                            t(
                                                'imageWorkspace.input.modelPlaceholder',
                                            )
                                        "
                                        size="medium"
                                        :disabled="isOptimizing"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="handleTextModelSelectFocus"
                                        @config="
                                            () =>
                                                appOpenModelManager &&
                                                appOpenModelManager('text')
                                        "
                                    />
                                </template>
                                <template v-else>
                                    <SelectWithConfig
                                        data-testid="image-text2image-text-model-select"
                                        v-model="selectedTextModelKey"
                                        :options="textModelOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="
                                            OptionAccessors.getSecondary
                                        "
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="
                                            t(
                                                'imageWorkspace.input.modelPlaceholder',
                                            )
                                        "
                                        size="medium"
                                        :disabled="isOptimizing"
                                        filterable
                                        @focus="handleTextModelSelectFocus"
                                    />
                                </template>
                            </NSpace>
                        </NGridItem>

                        <!-- 优化模板选择 -->
                        <NGridItem :span="11" :xs="24" :sm="11">
                            <NSpace vertical :size="8">
                                <NText
                                    :depth="2"
                                    style="font-size: 14px; font-weight: 500"
                                    >{{
                                        t(
                                            "imageWorkspace.input.optimizeTemplate",
                                        )
                                    }}</NText
                                >
                                <template
                                    v-if="services && services.templateManager"
                                >
                                    <SelectWithConfig
                                        v-model="selectedTemplateIdForSelect"
                                        :options="templateOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="
                                            OptionAccessors.getSecondary
                                        "
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="
                                            t(
                                                'imageWorkspace.input.templatePlaceholder',
                                            )
                                        "
                                        size="medium"
                                        :disabled="isOptimizing"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="handleTemplateSelectFocus"
                                        @config="
                                            () =>
                                                onOpenTemplateManager(
                                                    templateType,
                                                )
                                        "
                                    />
                                </template>
                                <NText
                                    v-else
                                    depth="3"
                                    style="padding: 0; font-size: 14px"
                                >
                                    {{ t("common.loading") }}
                                </NText>
                            </NSpace>
                        </NGridItem>

                        <!-- 优化按钮 -->
                        <NGridItem :span="6" :xs="24" :sm="6" class="flex items-end justify-end">
                            <NSpace :size="8">
                                <NButton
                                    type="default"
                                    size="medium"
                                    data-testid="image-text2image-analyze-button"
                                    :loading="isAnalyzing"
                                    @click="handleAnalyzePrompt"
                                    :disabled="
                                        isAnalyzing ||
                                        isExtractingFromImage ||
                                        isOptimizing ||
                                        !originalPrompt.trim()
                                    "
                                >
                                    {{
                                        isAnalyzing
                                            ? t("promptOptimizer.analyzing")
                                            : t("promptOptimizer.analyze")
                                    }}
                                </NButton>
                                <NButton
                                    type="primary"
                                    size="medium"
                                    data-testid="image-text2image-optimize-button"
                                    :loading="isOptimizing"
                                    @click="handleOptimizePrompt"
                                    :disabled="
                                        isAnalyzing ||
                                        isExtractingFromImage ||
                                        isOptimizing ||
                                        !originalPrompt.trim() ||
                                        !selectedTextModelKey ||
                                        !selectedTemplate
                                    "
                                >
                                    {{
                                        isOptimizing
                                            ? t("common.loading")
                                            : t("promptOptimizer.optimize")
                                    }}
                                </NButton>
                            </NSpace>
                        </NGridItem>
                    </NGrid>
                </NSpace>
            </TestSourceLinkedCard>

            <input
                ref="extractImageInputRef"
                type="file"
                accept="image/png,image/jpeg"
                style="display: none"
                @change="handleReferenceImageFileChange"
            />

            <!-- 优化结果区域 - 使用与基础模式一致的卡片容器 -->
            <TestSourceLinkedCard
                :style="{ flex: 1, minHeight: '200px', overflow: 'hidden' }"
                content-style="height: 100%; max-height: 100%; overflow: hidden;"
                :feedback-key="sourceAreaFeedback.workspace.key"
                :feedback-tone="sourceAreaFeedback.workspace.tone"
                :source-tone="sourceAreaFeedback.workspace.sourceTone"
            >
                <PromptPanelUI
                    v-if="services && services.templateManager"
                    test-id="image-text2image"
                    ref="promptPanelRef"
                    v-model:optimized-prompt="optimizedPrompt"
                    :reasoning="optimizedReasoning"
                    :original-prompt="originalPrompt"
                    :is-optimizing="isOptimizing"
                    :is-iterating="isIterating"
                    v-model:selected-iterate-template="selectedIterateTemplate"
                    :versions="currentVersions"
                    :current-version-id="currentVersionId"
                    :source-feedback-key="sourceAreaFeedback.workspace.key"
                    :source-feedback-tone="sourceAreaFeedback.workspace.tone"
                    :source-feedback-version="sourceAreaFeedback.workspace.resolvedVersion"
                    :optimization-mode="optimizationMode"
                    :advanced-mode-enabled="advancedModeEnabled"
                    :show-preview="true"
                    evaluation-type-override="prompt-only"
                    iterate-template-type="imageIterate"
                    @iterate="handleIteratePrompt"
                    @openTemplateManager="onOpenTemplateManager"
                    @switchVersion="handleSwitchVersion"
                    @save-favorite="handleSaveFavorite"
                    @save-local-edit="handleSaveLocalEdit"
                    @apply-improvement="handleApplyImprovement"
                    @apply-patch="handleApplyPatch"
                    @open-preview="handleOpenPromptPreview"
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

            <!-- 右侧：图像生成测试区域（图像模型，多列 variants） -->
            <div ref="testPaneRef" class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
                <NFlex vertical :style="{ height: '100%', gap: '12px' }">
                    <TemporaryVariablesPanel
                        :manager="temporaryVariablePanelManager"
                        :disabled="isOptimizing"
                        :show-generate-values="true"
                        :is-generating="isGenerating"
                        @generate-values="handleGenerateValues"
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
                                    :data-testid="'image-text2image-test-run-all'"
                                >
                                    {{ t('test.layout.runAll') }}
                                </NButton>

                                <template v-if="shouldShowCompareEvaluationAction">
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
                                        @show-detail="showCompareDetail"
                                        @evaluate="handleEvaluateCompare"
                                        @evaluate-with-feedback="handleCompareEvaluateWithFeedback"
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
                                        @evaluate="handleEvaluateCompare"
                                        @evaluate-with-feedback="handleCompareEvaluateWithFeedback"
                                    >
                                        <template #icon>
                                            <AnalyzeActionIcon />
                                        </template>
                                    </FocusAnalyzeButton>
                                </template>
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
                                        <ImageModelQuickSwitch
                                            :model-key="variantModelKeyModels[id].value"
                                            :options="imageModelOptions"
                                            :refresh-models="refreshImageModels"
                                            :disabled="variantRunning[id]"
                                        />
                                    </div>

                                    <div class="variant-cell__actions">
                                        <TestPanelVersionSelect
                                            :value="variantVersionModels[id].value"
                                            :options="versionOptions"
                                            :disabled="variantRunning[id]"
                                            :test-id="getVariantVersionTestId(id)"
                                            @update:value="(value) => handleVariantVersionChange(id, value)"
                                        />

                                        <div class="variant-cell__model">
                                            <SelectWithConfig
                                                :data-testid="getVariantModelTestId(id)"
                                                :model-value="variantModelKeyModels[id].value"
                                                @update:model-value="(value) => { variantModelKeyModels[id].value = String(value ?? '') }"
                                                :options="imageModelOptions"
                                                :getPrimary="OptionAccessors.getPrimary"
                                                :getSecondary="OptionAccessors.getSecondary"
                                                :getValue="OptionAccessors.getValue"
                                                :placeholder="t('imageWorkspace.generation.imageModelPlaceholder')"
                                                size="small"
                                                :disabled="variantRunning[id]"
                                                filterable
                                                :show-config-action="!!appOpenModelManager"
                                                :show-empty-config-c-t-a="true"
                                                @focus="refreshImageModels"
                                                @config="() => appOpenModelManager && appOpenModelManager('image')"
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
                                                    :disabled="variantRunning[id]"
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
                                    <div class="result-body">
                                        <template v-if="hasVariantResult(id)">
                                            <NSpace vertical :size="12" style="padding: 12px;">
                                                <NFlex justify="end" align="center">
                                                    <SaveTestResultExampleButton
                                                        sub-mode-key="image-text2image"
                                                        :variant-id="id"
                                                        :content="optimizedPrompt || originalPrompt"
                                                        :original-content="originalPrompt"
                                                        function-mode="image"
                                                        image-sub-mode="text2image"
                                                        :disabled="variantRunning[id]"
                                                        :test-id="`save-test-example-image-text2image-${id}`"
                                                    />
                                                    <div
                                                        v-if="shouldShowResultEvaluationAction(id)"
                                                        class="output-evaluation-entry"
                                                    >
                                                        <EvaluationScoreBadge
                                                            v-if="getResultEvaluationProps(id).hasEvaluation || getResultEvaluationProps(id).isEvaluating"
                                                            :score="getResultEvaluationProps(id).score"
                                                            :level="getResultEvaluationProps(id).scoreLevel"
                                                            :loading="getResultEvaluationProps(id).isEvaluating"
                                                            :result="getResultEvaluationProps(id).evaluationResult"
                                                            type="result"
                                                            :stale="isResultEvaluationStale(id)"
                                                            :stale-message="t('evaluation.stale.result')"
                                                            :disable-evaluate="!canEvaluateResult(id)"
                                                            size="small"
                                                            @show-detail="() => showResultDetail(id)"
                                                            @evaluate="() => handleEvaluateResult(id)"
                                                            @evaluate-with-feedback="handleResultEvaluateWithFeedbackEvent(id, $event)"
                                                            @apply-improvement="handleApplyImprovement"
                                                            @apply-patch="handleApplyPatch"
                                                        />
                                                        <FocusAnalyzeButton
                                                            v-else
                                                            type="result"
                                                            variant="toolbar"
                                                            :label="t('evaluation.evaluate')"
                                                            :disabled="!canEvaluateResult(id)"
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
                                                </NFlex>
                                                <AppPreviewImage
                                                    :data-testid="getVariantImageTestId(id)"
                                                    :src="getImageSrc(getVariantResult(id)?.images?.[0])"
                                                    object-fit="contain"
                                                    :img-props="{
                                                        style: {
                                                            width: '100%',
                                                            height: 'auto',
                                                            display: 'block',
                                                        },
                                                    }"
                                                />

                                                <template v-if="getVariantResult(id)?.text">
                                                    <NCard
                                                        size="small"
                                                        :title="t('imageWorkspace.results.textOutput')"
                                                    >
                                                        <NText
                                                            :depth="2"
                                                            style="white-space: pre-wrap; line-height: 1.5;"
                                                        >
                                                            {{ getVariantResult(id)?.text }}
                                                        </NText>
                                                    </NCard>
                                                </template>

                                                <ImageTokenUsage :metadata="getVariantResult(id)?.metadata" :image="getVariantResult(id)?.images?.[0]" />

                                                <NSpace justify="center" :size="8">
                                                    <NButton
                                                        size="small"
                                                        @click="downloadImageFromResult(getVariantResult(id)?.images?.[0])"
                                                    >
                                                        <template #icon>
                                                            <NIcon>
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    stroke-width="2"
                                                                >
                                                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                                                </svg>
                                                            </NIcon>
                                                        </template>
                                                        {{ t('imageWorkspace.results.download') }}
                                                    </NButton>

                                                    <NButton
                                                        v-if="getVariantResult(id)?.text"
                                                        size="small"
                                                        secondary
                                                        @click="copyImageText(String(getVariantResult(id)?.text || ''))"
                                                    >
                                                        <template #icon>
                                                            <NIcon>
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    stroke-width="2"
                                                                >
                                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                                                </svg>
                                                            </NIcon>
                                                        </template>
                                                        {{ t('imageWorkspace.results.copyText') }}
                                                    </NButton>
                                                </NSpace>
                                            </NSpace>
                                        </template>
                                        <template v-else>
                                            <NEmpty
                                                :description="t('imageWorkspace.results.noGenerationResult')"
                                                style="padding: 24px 12px;"
                                            />
                                        </template>
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
            :can-rewrite-from-evaluation="false"
            @apply-local-patch="handleApplyPatch"
            @apply-improvement="handleApplyImprovement"
            @re-evaluate="handleReEvaluateActive"
            @evaluate-with-feedback="handleEvaluateActiveWithFeedback"
            @clear="handleClearEvaluation"
            @retry="handleReEvaluateActive"
        />

        <!-- 原始提示词 - 全屏编辑器 -->
        <FullscreenDialog
            v-model="isFullscreen"
            :title="t('imageWorkspace.input.originalPrompt')"
        >
            <NInput
                v-model:value="fullscreenValue"
                type="textarea"
                :placeholder="t('imageWorkspace.input.originalPromptPlaceholder')"
                :autosize="false"
                style="height: 100%; min-height: 0;"
                clearable
                show-count
                :disabled="isOptimizing"
            />
        </FullscreenDialog>

        <VariableValuePreviewDialog
            v-model:show="showPreviewDialog"
            :result="generationResult"
            @confirm="confirmBatchApply"
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

        <PromptGardenImportDialog
            v-model:show="showPromptGardenImport"
            @confirm="handlePromptGardenImportConfirm"
        />

        <!-- 模板管理器由 App 统一管理，这里不再渲染 -->
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, inject, ref, reactive, computed, watch, nextTick, toRef, type Ref } from 'vue'
import { useRouter, type LocationQueryRaw } from 'vue-router'

import {
    NCard,
    NButton,
    NInput,
    NEmpty,
    NSpace,
    NText,
    NFlex,
    NGrid,
    NGridItem,
    NIcon,
    NTag,
    NRadioGroup,
    NRadioButton,
    NTooltip,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import PromptPanelUI from "../PromptPanel.vue";
import WorkspaceUtilityMenu from '../common/WorkspaceUtilityMenu.vue'
import ThemedTooltip from '../common/ThemedTooltip.vue'
import PromptGardenInspirationPopover from '../common/PromptGardenInspirationPopover.vue'
import PromptGardenImportDialog from '../common/PromptGardenImportDialog.vue'
import PromptPreviewPanel from "../PromptPreviewPanel.vue";
import ImageModelQuickSwitch from "../ImageModelQuickSwitch.vue";
import SelectWithConfig from "../SelectWithConfig.vue";
import TextModelQuickSwitch from "../TextModelQuickSwitch.vue";
import TestPanelVersionSelect from '../TestPanelVersionSelect.vue'
import TestSourceLinkedCard from '../TestSourceLinkedCard.vue'
import TestVariantSourceTag from '../TestVariantSourceTag.vue'
import { AnalyzeActionIcon, EvaluationPanel, EvaluationScoreBadge, FocusAnalyzeButton } from '../evaluation'
import { useLocalPromptPreviewPanel } from '../../composables/prompt/useLocalPromptPreviewPanel'
import { OptionAccessors } from "../../utils/data-transformer";
import type { AppServices } from "../../types/services";
import { useFullscreen } from "../../composables/ui/useFullscreen";
import { useTooltipTheme } from '../../composables/ui/useTooltipTheme'
import FullscreenDialog from "../FullscreenDialog.vue";
import type { SelectOption } from "../../types/select-options";
import { useToast } from "../../composables/ui/useToast";
import { getI18nErrorMessage } from '../../utils/error'
import { withHistorySourceBindingMetadata } from '../../utils/history-source-binding'
import { resolveSourceAssetRef } from '../../utils/source-asset'
import { downloadImageSource } from '../../utils/image-download'
import { createImagePromptAnalysisVersion } from '../../utils/imagePromptAnalysis'
import type { PromptGardenImportRequest } from '../../utils/prompt-garden-import'
import {
    resolveReferencePromptPreview,
    type ReferenceApplicationMode,
} from '../../services/ImageStyleExtractor'
import { VariableAwareInput } from '../variable-extraction'
import TemporaryVariablesPanel from '../variable/TemporaryVariablesPanel.vue'
import VariableValuePreviewDialog from '../variable/VariableValuePreviewDialog.vue'
import AppPreviewImage from '../media/AppPreviewImage.vue'
import SaveTestResultExampleButton from '../SaveTestResultExampleButton.vue'
import { useTemporaryVariables } from '../../composables/variable/useTemporaryVariables'
import { useVariableAwareInputBridge } from '../../composables/variable/useVariableAwareInputBridge'
import { useTestVariableManager } from '../../composables/variable/useTestVariableManager'
import { useSmartVariableValueGeneration } from '../../composables/variable/useSmartVariableValueGeneration'
import { useEvaluationHandler } from '../../composables/prompt/useEvaluationHandler'
import { provideEvaluation } from '../../composables/prompt/useEvaluationContext'
import { useTestSourceAreaFeedback } from '../../composables/prompt/useTestSourceAreaFeedback'
import { useTestVariantSourceFeedback } from '../../composables/prompt/useTestVariantSourceFeedback'
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager'
import {
    buildPromptExecutionContext,
    hashString,
    hashVariables,
} from '../../utils/prompt-variables'
import {
    buildTestPanelVersionOptions,
    resolveTestPanelVersionSelection,
    type ResolvedTestPanelVersionSelection,
} from '../../utils/testPanelVersion'
import {
    useImageText2ImageSession,
    type TestColumnCount,
    type TestPanelVersionValue,
    type TestVariantConfig,
    type TestVariantId,
} from '../../stores/session/useImageText2ImageSession'
import { useImageGeneration } from '../../composables/image/useImageGeneration'
import { useImageInputPreparation } from '../../composables/image/useImageInputPreparation'
import {
    useReferenceImageActions,
    type ReferenceActionKind,
} from '../../composables/image/useReferenceImageActions'
import ImageTokenUsage from './ImageTokenUsage.vue'
import { useFunctionModelManager } from '../../composables/model'
import { useWorkspaceTemplateSelection } from '../../composables/workspaces/useWorkspaceTemplateSelection'
import { useWorkspaceTextModelSelection } from '../../composables/workspaces/useWorkspaceTextModelSelection'
import { useElementSize } from '@vueuse/core'
import { runTasksWithExecutionMode } from '../../utils/runTasksSequentially'
import {
    buildImageText2ImageComparePayload,
    buildImageText2ImageResultEvaluationTargets,
    canEvaluateImageText2ImageCompare,
    canEvaluateImageText2ImageResult,
    shouldShowImageText2ImageCompareAction,
    shouldShowImageText2ImageResultAction,
} from './imageText2ImageEvaluation'
import {
    applyPatchOperationsToText,
    type ContextMode,
    type ImageModelConfig,
    type Text2ImageRequest,
    type ImageResult,
    type ImageResultItem,
    type OptimizationMode,
    type OptimizationRequest,
    type PatchOperation,
    type PromptRecordChain,
    type PromptRecordType,
    type Template,
    type TextModelConfig,
} from '@prompt-optimizer/core'
import { v4 as uuidv4 } from 'uuid'

// 国际化
const { t } = useI18n();
const router = useRouter()

// Toast
const toast = useToast();
const { prepareInputRefs: prepareImageInputRefs } = useImageInputPreparation()
const {
    tooltipThemeOverrides: referenceActionTooltipThemeOverrides,
    tooltipOverlayStyle: referenceActionTooltipOverlayStyle,
    tooltipContentStyle: referenceActionTooltipContentStyle,
} = useTooltipTheme({
    maxWidth: '220px',
    whiteSpace: 'normal',
    overflowWrap: 'break-word',
    padding: '10px 12px',
})

// 服务注入
const services = inject<Ref<AppServices | null>>("services", ref(null));

// 变量系统（全局变量 + 临时变量）
// - 全局变量由 PromptOptimizerApp 创建并 provide
// - 临时变量由 Pinia store 承载（刷新即丢失）
const variableManager = inject<VariableManagerHooks | null>('variableManager', null)
const tempVarsManager = useTemporaryVariables()

const {
    variableInputData,
    predefinedVariableValues: purePredefinedVariables,
    handleVariableExtracted,
    handleAddMissingVariable,
} = useVariableAwareInputBridge({
    enabled: computed(() => true),
    // 仅在全局变量管理器就绪时启用变量感知输入（避免“变量未加载但编辑器已替换/提取”）
    isReady: computed(() => variableManager?.isReady.value ?? false),
    globalVariables: computed(() => variableManager?.customVariables.value || {}),
    temporaryVariables: tempVarsManager.temporaryVariables,
    allVariables: computed(() => variableManager?.allVariables.value || {}),
    saveGlobalVariable: (name, value) => variableManager?.addVariable(name, value),
    saveTemporaryVariable: (name, value) => tempVarsManager.setVariable(name, value),
    logPrefix: 'ImageText2ImageWorkspace',
})

const temporaryVariablePanelManager = useTestVariableManager({
    globalVariables: computed(() => variableManager?.customVariables.value || {}),
    predefinedVariables: purePredefinedVariables,
    temporaryVariables: computed(() => tempVarsManager.temporaryVariables.value),
    onVariableChange: (name, value) => {
        tempVarsManager.setVariable(name, value)
    },
    onVariableRemove: (name) => {
        tempVarsManager.deleteVariable(name)
    },
    onVariablesClear: () => {
        tempVarsManager.clearAll()
    },
    onSaveToGlobal: (name, value) => {
        if (!variableManager || !variableManager.isReady.value) {
            throw new Error('variable manager not ready')
        }
        variableManager.addVariable(name, value)
    },
})

const {
    isGenerating,
    generationResult,
    showPreviewDialog,
    handleGenerateValues,
    confirmBatchApply,
} = useSmartVariableValueGeneration({
    services,
    promptContent: computed(() => optimizedPrompt.value || originalPrompt.value),
    variableNames: computed(() => temporaryVariablePanelManager.sortedVariables.value),
    getVariableValue: (name: string) => temporaryVariablePanelManager.getVariableDisplayValue(name),
    getVariableSource: (name: string) => temporaryVariablePanelManager.getVariableSource(name),
    applyValue: (name: string, value: string) => {
        temporaryVariablePanelManager.handleVariableValueChange(name, value)
    },
})

const handleOriginalPromptInput = (value: string) => {
    originalPrompt.value = value
}

// handleVariableExtracted / handleAddMissingVariable are provided by useVariableAwareInputBridge

// Session store（单一真源）
const session = useImageText2ImageSession()

// 图像生成相关
const {
    imageModels,
    generateText2Image,
    validateText2ImageRequest,
    loadImageModels,
    isImageModelListReady,
} = useImageGeneration()

// 服务引用
const historyManager = computed(() => services.value?.historyManager)
const promptService = computed(() => services.value?.promptService)

// 过程态（本地，不持久化）
const isOptimizing = ref(false)
const isAnalyzing = ref(false)
const isIterating = ref(false)
const isExtractingFromImage = ref(false)
const extractImageInputRef = ref<HTMLInputElement | null>(null)
type ReferenceImagePayload = {
    base64: string
    mimeType: string
}

const referenceImagePayload = ref<ReferenceImagePayload | null>(null)
const referenceActionPendingCount = ref(0)
const referenceActionPreviewToken = ref(0)

// 历史管理专用 ref（不写入 session store）
const currentChainId = ref('')
const currentVersions = ref<PromptRecordChain['versions']>([])
const currentVersionId = ref('')

// 字段级访问器（从 session state）
const originalPrompt = computed<string>({
    get: () => session.originalPrompt || '',
    set: (value) => session.updatePrompt(value || ''),
})

const showPromptGardenImport = ref(false)

const isPromptGardenGuideDisabled = computed(() =>
    isOptimizing.value || isIterating.value || isAnyVariantRunning.value || isExtractingFromImage.value,
)

const handlePromptGardenImportConfirm = async (request: PromptGardenImportRequest) => {
    if (!request.importCode) return false

    const currentRoute = router.currentRoute.value
    const query: LocationQueryRaw = {
        ...currentRoute.query,
        importCode: request.importCode,
    }
    if (request.exampleId) {
        query.exampleId = request.exampleId
    } else {
        delete query.exampleId
    }
    if (request.subModeKey) {
        query.subModeKey = request.subModeKey
    } else {
        delete query.subModeKey
    }

    await router.push({
        path: currentRoute.path,
        query,
    })

    return true
}

const optimizedPrompt = computed<string>({
    get: () => session.optimizedPrompt || '',
    set: (value) => {
        session.updateOptimizedResult({
            optimizedPrompt: value || '',
            reasoning: session.reasoning || '',
            chainId: session.chainId || '',
            versionId: session.versionId || '',
        })
    },
})

const optimizedReasoning = computed<string>({
    get: () => session.reasoning || '',
    set: (value) => {
        session.updateOptimizedResult({
            optimizedPrompt: session.optimizedPrompt || '',
            reasoning: value || '',
            chainId: session.chainId || '',
            versionId: session.versionId || '',
        })
    },
})

// Text 模型选择（与模板选择对齐：自动刷新 + 兜底写回 session store）
const modelSelection = useWorkspaceTextModelSelection(services, session)
const selectedTextModelKey = modelSelection.selectedTextModelKey
const functionModelManager = useFunctionModelManager(services)
const effectiveImageRecognitionModelKey = functionModelManager.effectiveImageRecognitionModel

const selectedImageModelKey = computed<string>({
    get: () => session.selectedImageModelKey || '',
    set: (value) => session.updateImageModel(value || ''),
})

const templateSelection = useWorkspaceTemplateSelection(
    services,
    session,
    'text2imageOptimize',
    'imageIterate',
)

const selectedTemplateId = templateSelection.selectedTemplateId
const templateOptions = templateSelection.templateOptions

const isCompareMode = computed<boolean>({
    get: () => !!session.isCompareMode,
    set: (value) => session.toggleCompareMode(!!value),
})

// 固定模板类型
const templateType = computed(() => "text2imageOptimize" as const)

// 图像模式统一使用 user 模式
const optimizationMode = 'user' as OptimizationMode
const advancedModeEnabled = false

const selectedTemplate = templateSelection.selectedTemplate

const ensureModelManagerInitializedIfSupported = async (manager: unknown) => {
    if (!manager || typeof manager !== 'object') return

    const maybeInitializable = manager as { ensureInitialized?: () => Promise<void> }
    if (typeof maybeInitializable.ensureInitialized === 'function') {
        await maybeInitializable.ensureInitialized()
    }
}

const getImageRecognitionModelConfig = async (): Promise<TextModelConfig> => {
    const manager = services.value?.modelManager
    if (!manager) {
        throw new Error(t('toast.error.serviceInit'))
    }

    await ensureModelManagerInitializedIfSupported(manager)
    await functionModelManager.initialize()

    const modelKey = functionModelManager.effectiveImageRecognitionModel.value || ''
    if (!modelKey) {
        throw new Error(t('functionModel.noImageRecognitionModel'))
    }

    const modelConfig = await manager.getModel(modelKey)
    if (!modelConfig) {
        throw new Error(t('functionModel.noImageRecognitionModel'))
    }

    return modelConfig
}

const openFunctionModelManager = () => {
    if (appOpenModelManager) {
        appOpenModelManager('function')
        return
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent('model-manager:set-tab', { detail: 'function' }),
        )
    }
}

const promptConfigureImageRecognitionModel = () => {
    toast.error(t('functionModel.noImageRecognitionModel'))
    openFunctionModelManager()
}

// PromptPanel 需要 Template 对象的 v-model；用 wrapper 同步写回 iterateTemplateId
const selectedIterateTemplate = computed<Template | null>({
    get: () => templateSelection.selectedIterateTemplate.value,
    set: (template) => {
        templateSelection.selectedIterateTemplateId.value = template?.id ?? ''
        templateSelection.selectedIterateTemplate.value = template ?? null
    },
})

// 模型选项
const textModelOptions = modelSelection.textModelOptions
const imageModelOptions = ref<SelectOption<ImageModelConfig>[]>([])

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

onUnmounted(() => {
    endSplitDrag()
})

// ==================== 测试区：多列 variants（按提示词版本 + 图像模型） ====================

const getVariant = (id: TestVariantId): TestVariantConfig | undefined => {
    const list = session.testVariants as unknown as TestVariantConfig[]
    return Array.isArray(list) ? list.find((v) => v.id === id) : undefined
}

const testColumnCountModel = computed<TestColumnCount>({
    get: () => {
        const raw = session.layout.testColumnCount
        return raw === 2 || raw === 3 || raw === 4 ? raw : 2
    },
    set: (value) => session.setTestColumnCount(value),
})

const variantAVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('a')?.version ?? 0,
    set: (value) => session.updateTestVariant('a', { version: value }),
})

const variantBVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('b')?.version ?? 'workspace',
    set: (value) => session.updateTestVariant('b', { version: value }),
})

const variantCVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('c')?.version ?? 'workspace',
    set: (value) => session.updateTestVariant('c', { version: value }),
})

const variantDVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('d')?.version ?? 'workspace',
    set: (value) => session.updateTestVariant('d', { version: value }),
})

const variantAModelKeyModel = computed<string>({
    get: () => getVariant('a')?.modelKey ?? '',
    set: (value) => session.updateTestVariant('a', { modelKey: value }),
})

const variantBModelKeyModel = computed<string>({
    get: () => getVariant('b')?.modelKey ?? '',
    set: (value) => session.updateTestVariant('b', { modelKey: value }),
})

const variantCModelKeyModel = computed<string>({
    get: () => getVariant('c')?.modelKey ?? '',
    set: (value) => session.updateTestVariant('c', { modelKey: value }),
})

const variantDModelKeyModel = computed<string>({
    get: () => getVariant('d')?.modelKey ?? '',
    set: (value) => session.updateTestVariant('d', { modelKey: value }),
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

// 版本选项：默认显示“工作区”与“原始(v0)”；存在可用上一版时显示“上一版(vN)”动态别名。
const versionOptions = computed(() => {
    return buildTestPanelVersionOptions(
        currentVersions.value || [],
        getTestPanelVersionLabels(),
        {
            currentVersionId: currentVersionId.value,
            workspacePrompt: optimizedPrompt.value || '',
            originalPrompt: originalPrompt.value || '',
        },
    )
})

// 确保测试列的模型选择始终有效（模型列表变化时自动 fallback）
watch(
    () => imageModelOptions.value,
    (opts) => {
        if (!isImageModelListReady.value) return
        const fallback = opts?.[0]?.value || ''
        const keys = new Set((opts || []).map((o) => o.value))

        const legacy = session.selectedImageModelKey
        const seed = legacy && keys.has(legacy) ? legacy : fallback

        for (const id of ALL_VARIANT_IDS) {
            const current = variantModelKeyModels[id].value
            if (!current || !keys.has(current)) {
                session.updateTestVariant(id, { modelKey: seed })
            }
        }
    },
    { immediate: true },
)

const resolvePromptForSelection = (
    selection: TestPanelVersionValue,
): ResolvedTestPanelVersionSelection => {
    return resolveTestPanelVersionSelection({
        selection,
        versions: currentVersions.value || [],
        currentVersionId: currentVersionId.value,
        workspacePrompt: optimizedPrompt.value || '',
        originalPrompt: originalPrompt.value || '',
    })
}

// 注意：Pinia setup store 会把 ref 自动解包；直接赋值会丢失响应性。
// 这里用 computed 读取，确保 store 替换对象引用时 UI 能跟着更新。
const variantResults = computed(
    () => session.testVariantResults as unknown as Record<TestVariantId, ImageResult | null>,
)
const variantLastRunFingerprint = computed(
    () => session.testVariantLastRunFingerprint as unknown as Record<TestVariantId, string>,
)
void variantLastRunFingerprint.value

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
    const resolved = resolvePromptForSelection(selection)
    pulseVariantSource(id, 'change')
    pulseSourceAreaForSelection(selection, resolved.resolvedVersion, 'change')
}

const getVariantResolvedVersion = (id: TestVariantId): number =>
    resolvePromptForSelection(variantVersionModels[id].value).resolvedVersion

const getVariantVersionTestId = (id: TestVariantId) => {
    if (id === 'a') return 'image-text2image-test-original-version-select'
    if (id === 'b') return 'image-text2image-test-optimized-version-select'
    return `image-text2image-test-variant-${id}-version-select`
}

const getVariantModelTestId = (id: TestVariantId) => {
    if (id === 'a') return 'image-text2image-test-original-model-select'
    if (id === 'b') return 'image-text2image-test-optimized-model-select'
    return `image-text2image-test-variant-${id}-model-select`
}

const getVariantRunTestId = (id: TestVariantId) => `image-text2image-test-run-${id}`

const getVariantImageTestId = (id: TestVariantId) => {
    if (id === 'a') return 'image-text2image-original-image'
    if (id === 'b') return 'image-text2image-optimized-image'
    return `image-text2image-variant-${id}-image`
}

const getVariantResult = (id: TestVariantId) => variantResults.value[id]
const hasVariantResult = (id: TestVariantId) => !!(variantResults.value[id]?.images?.length)

// image 模式变量优先级：global < temporary < predefined
// - predefined 作为只读“系统变量”，在替换阶段优先级最高
const mergedGenerationVariables = computed<Record<string, string>>(() => ({
    ...(variableManager?.customVariables.value || {}),
    ...(tempVarsManager.temporaryVariables.value || {}),
    ...(purePredefinedVariables.value || {}),
}))

// ========================
// 子模式本地提示词预览（不经过 PromptOptimizerApp）
// ========================
const previewContextMode = computed<ContextMode>(() => 'user')

// Keep runtime predefined values aligned with buildRuntimePredefinedVariables used for execution.
const runtimePredefinedVariablesForPreview = computed<Record<string, string>>(() => {
    const current = (optimizedPrompt.value || '').trim()
    return {
        originalPrompt: (originalPrompt.value || '').trim(),
        lastOptimizedPrompt: (optimizedPrompt.value || '').trim(),
        currentPrompt: current,
        userQuestion: current,
    }
})

const previewVariables = computed<Record<string, string>>(() => ({
    ...mergedGenerationVariables.value,
    ...runtimePredefinedVariablesForPreview.value,
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
    openPromptPreview(optimizedPrompt.value || '', { renderPhase: 'test' })
}

const buildRuntimePredefinedVariables = (resolved: ResolvedTestPanelVersionSelection): Record<string, string> => {
    const current = (resolved.text || '').trim()
    return {
        // Align with core PREDEFINED_VARIABLES (packages/core/src/services/context/constants.ts)
        originalPrompt: (originalPrompt.value || '').trim(),
        lastOptimizedPrompt: (optimizedPrompt.value || '').trim(),
        currentPrompt: current,
        userQuestion: current,
    }
}

const getVariantFingerprint = (id: TestVariantId) => {
    const selection = variantVersionModels[id].value
    const resolved = resolvePromptForSelection(selection)
    const modelKey = (variantModelKeyModels[id].value || '').trim()
    const promptHash = hashString((resolved.text || '').trim())
    const varsForFingerprint = {
        ...mergedGenerationVariables.value,
        ...buildRuntimePredefinedVariables(resolved),
    }
    const varsHash = hashVariables(varsForFingerprint)
    return `${String(selection)}:${resolved.resolvedVersion}:${modelKey}:${promptHash}:${varsHash}`
}

const evaluationVersionLabels = computed(() => getTestPanelVersionLabels())

const evaluationVariants = computed(() =>
    activeVariantIds.value.map((id) => {
        const resolvedPrompt = resolvePromptForSelection(variantVersionModels[id].value)
        return {
            id,
            label: getVariantLabel(id),
            resolvedPrompt,
            promptText: resolvedPrompt.text,
            modelKey: (variantModelKeyModels[id].value || '').trim() || undefined,
            result: getVariantResult(id),
        }
    }),
)

const imageEvaluationContext = computed(() => ({
    originalIntent: originalPrompt.value || '',
    workspacePrompt: optimizedPrompt.value || '',
    referencePrompt: originalPrompt.value || '',
    versionLabels: evaluationVersionLabels.value,
}))

const resultEvaluationTargets = computed(() =>
    buildImageText2ImageResultEvaluationTargets({
        context: imageEvaluationContext.value,
        variants: evaluationVariants.value,
    }),
)

const comparePayload = computed(() =>
    buildImageText2ImageComparePayload({
        context: imageEvaluationContext.value,
        variants: evaluationVariants.value,
    }),
)

const hasImageRecognitionModel = computed(
    () => !!(effectiveImageRecognitionModelKey.value || '').trim(),
)

const resultEvaluationFingerprint = reactive<Record<TestVariantId, string>>({
    a: '',
    b: '',
    c: '',
    d: '',
})
const compareEvaluationFingerprint = ref('')

const evaluationHandler = useEvaluationHandler({
    services,
    analysisOptimizedPrompt: computed(() => optimizedPrompt.value || ''),
    analysisTargetResolver: (defaultTarget) => ({
        ...defaultTarget,
        referencePrompt: (originalPrompt.value || '').trim() || undefined,
    }),
    resultTargets: resultEvaluationTargets,
    comparePayload,
    evaluationModelKey: computed(() => selectedTextModelKey.value || ''),
    resolveEvaluationModelKey: async (type) => {
        await functionModelManager.initialize()

        if (type === 'result' || type === 'compare') {
            const modelKey =
                functionModelManager.effectiveImageRecognitionModel.value || ''
            if (!modelKey) {
                throw new Error(t('functionModel.noImageRecognitionModel'))
            }
            return modelKey
        }

        return functionModelManager.resolveEvaluationModelKey(selectedTextModelKey.value)
    },
    functionMode: computed(() => 'image'),
    subMode: computed(() => 'text2image'),
    persistedResults: toRef(session, 'evaluationResults'),
})

provideEvaluation(evaluationHandler.evaluation)

const { evaluation, handleEvaluate: handleEvaluateInternal } = evaluationHandler
const panelProps = evaluationHandler.panelProps
const getResultEvaluationProps = (variantId: string) =>
    evaluationHandler.getResultEvaluationProps(variantId)

const handleAnalyzePrompt = async () => {
    const prompt = originalPrompt.value.trim()
    if (!prompt || isAnalyzing.value) return

    isAnalyzing.value = true
    try {
        const virtualV0 = createImagePromptAnalysisVersion(
            prompt,
            'text2imageOptimize' as PromptRecordType,
        )
        currentChainId.value = ''
        currentVersions.value = [virtualV0]
        currentVersionId.value = virtualV0.id
        session.updateOptimizedResult({
            optimizedPrompt: prompt,
            reasoning: '',
            chainId: '',
            versionId: '',
        })
        evaluation.clearResult('prompt-only')
        evaluation.clearResult('prompt-iterate')
        await nextTick()
        await handleEvaluateInternal('prompt-only')
    } finally {
        isAnalyzing.value = false
    }
}

const isEvaluatingCompare = evaluationHandler.compareEvaluation.isEvaluatingCompare
const compareScore = computed(
    () => evaluationHandler.compareEvaluation.compareScore.value ?? 0,
)
const hasCompareEvaluation = evaluationHandler.compareEvaluation.hasCompareResult
const compareEvaluationResult = computed(() => evaluation.state.compare.result)
const compareScoreLevel = computed(() =>
    evaluation.getScoreLevel(
        evaluationHandler.compareEvaluation.compareScore.value ?? null,
    ),
)

const compareReadyVariantIds = computed(() =>
    activeVariantIds.value.filter((id) => !!resultEvaluationTargets.value[id]),
)
const hasCompareCandidates = computed(() => compareReadyVariantIds.value.length >= 2)
const hasWorkspaceCompareCandidate = computed(() =>
    compareReadyVariantIds.value.some((id) =>
        evaluationVariants.value.find((variant) => variant.id === id)?.resolvedPrompt.promptKind === 'workspace'
    ),
)

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

const shouldShowResultEvaluationAction = (id: TestVariantId) =>
    shouldShowImageText2ImageResultAction(
        id,
        resultEvaluationTargets.value,
        getResultEvaluationProps(id).hasEvaluation,
    )

const canEvaluateResult = (id: TestVariantId) =>
    canEvaluateImageText2ImageResult(
        id,
        resultEvaluationTargets.value,
        hasImageRecognitionModel.value,
    )

const shouldShowCompareEvaluationAction = computed(() =>
    shouldShowImageText2ImageCompareAction(
        comparePayload.value,
        hasCompareEvaluation.value,
        hasCompareCandidates.value,
    ),
)

const canEvaluateCompare = computed(() =>
    canEvaluateImageText2ImageCompare(
        comparePayload.value,
        hasImageRecognitionModel.value,
    ),
)
const compareDisabledReason = computed(() => {
    if (canEvaluateCompare.value) {
        return ''
    }

    if ((hasCompareCandidates.value || hasCompareEvaluation.value) && !hasWorkspaceCompareCandidate.value) {
        return t('evaluation.compareUnavailable.missingWorkspace')
    }

    if ((hasCompareCandidates.value || hasCompareEvaluation.value) && !hasImageRecognitionModel.value) {
        return t('functionModel.noImageRecognitionModel')
    }

    return ''
})

const activeEvaluationStale = computed(() => {
    if (panelProps.value.currentType === 'compare') {
        return isCompareEvaluationStale.value
    }

    if (
        panelProps.value.currentType === 'result' &&
        panelProps.value.currentVariantId &&
        panelProps.value.currentVariantId in resultEvaluationFingerprint
    ) {
        return isResultEvaluationStale(
            panelProps.value.currentVariantId as TestVariantId,
        )
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

    if (
        panelProps.value.currentType === 'result' &&
        panelProps.value.currentVariantId
    ) {
        return !canEvaluateResult(
            panelProps.value.currentVariantId as TestVariantId,
        )
    }

    return false
})
const activeEvaluationDisableReason = computed(() => {
    if (panelProps.value.currentType === 'compare') {
        return compareDisabledReason.value
    }

    return ''
})

const ensureImageEvaluationModelReady = (): boolean => {
    if (hasImageRecognitionModel.value) {
        return true
    }

    promptConfigureImageRecognitionModel()
    return false
}

const ensureResultEvaluationReady = (variantId: TestVariantId): boolean => {
    if (!resultEvaluationTargets.value[variantId]) {
        return false
    }

    return ensureImageEvaluationModelReady()
}

const ensureCompareEvaluationReady = (): boolean => {
    if (!comparePayload.value) {
        return false
    }

    return ensureImageEvaluationModelReady()
}

const updateResultEvaluationFingerprint = (variantId: TestVariantId) => {
    if (evaluation.state.result[variantId]?.result) {
        resultEvaluationFingerprint[variantId] = getVariantFingerprint(variantId)
    }
}

const updateCompareEvaluationFingerprint = () => {
    if (evaluation.state.compare.result) {
        compareEvaluationFingerprint.value = buildCompareEvaluationFingerprint()
    }
}

const handleEvaluateResult = async (variantId: TestVariantId) => {
    if (!ensureResultEvaluationReady(variantId)) return

    await handleEvaluateInternal('result', { variantId })
    updateResultEvaluationFingerprint(variantId)
}

const handleResultEvaluateWithFeedbackEvent = async (
    variantId: TestVariantId,
    payload: { feedback: string },
) => {
    if (!ensureResultEvaluationReady(variantId)) return

    await evaluationHandler.handleEvaluateWithFeedback(
        'result',
        payload.feedback,
        { variantId },
    )
    updateResultEvaluationFingerprint(variantId)
}

const handleEvaluateCompare = async () => {
    if (!ensureCompareEvaluationReady()) return

    await handleEvaluateInternal('compare')
    updateCompareEvaluationFingerprint()
}

const handleCompareEvaluateWithFeedback = async (payload: {
    feedback: string
}) => {
    if (!ensureCompareEvaluationReady()) return

    await evaluationHandler.handleEvaluateWithFeedback(
        'compare',
        payload.feedback,
    )
    updateCompareEvaluationFingerprint()
}

const handleReEvaluateActive = async () => {
    const active = evaluation.state.activeDetail
    if (!active) return

    if (
        active.type === 'result' &&
        (!active.variantId ||
            !ensureResultEvaluationReady(active.variantId as TestVariantId))
    ) {
        return
    }

    if (active.type === 'compare' && !ensureCompareEvaluationReady()) {
        return
    }

    await evaluationHandler.handleReEvaluate()

    if (active.type === 'result' && active.variantId) {
        updateResultEvaluationFingerprint(active.variantId as TestVariantId)
    } else if (active.type === 'compare') {
        updateCompareEvaluationFingerprint()
    }
}

const handleEvaluateActiveWithFeedback = async (payload: {
    feedback: string
}) => {
    const active = evaluation.state.activeDetail
    if (!active) return

    if (
        active.type === 'result' &&
        (!active.variantId ||
            !ensureResultEvaluationReady(active.variantId as TestVariantId))
    ) {
        return
    }

    if (active.type === 'compare' && !ensureCompareEvaluationReady()) {
        return
    }

    await evaluationHandler.handleEvaluateActiveWithFeedback(payload.feedback)

    if (active.type === 'result' && active.variantId) {
        updateResultEvaluationFingerprint(active.variantId as TestVariantId)
    } else if (active.type === 'compare') {
        updateCompareEvaluationFingerprint()
    }
}

const showResultDetail = (variantId: TestVariantId) => {
    evaluation.showDetail('result', variantId)
}

const showCompareDetail = () => {
    evaluation.showDetail('compare')
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
    currentChainId.value = ''
    currentVersions.value = []
    currentVersionId.value = ''
    referenceImagePayload.value = null
    referenceActionPendingCount.value = 0
    referenceActionPreviewToken.value = 0
    isExtractingFromImage.value = false
    referenceAction.resetState()
    session.clearContent()
    handleClearEvaluation()
}

watch(
    () => [session.chainId, session.versionId, session.optimizedPrompt] as const,
    ([chainId, versionId, optimized]) => {
        if (chainId || versionId || optimized) return
        currentChainId.value = ''
        currentVersions.value = []
        currentVersionId.value = ''
    },
)

const getVariantRequest = (id: TestVariantId): Text2ImageRequest | null => {
    const modelKey = (variantModelKeyModels[id].value || '').trim()
    if (!modelKey) {
        toast.error(t('imageWorkspace.generation.missingRequiredFields'))
        return null
    }

    const resolved = resolvePromptForSelection(variantVersionModels[id].value)
    if (!resolved.text?.trim()) {
        toast.error(t('imageWorkspace.generation.missingRequiredFields'))
        pulseVariantSource(id, 'error')
        pulseSourceAreaForSelection(variantVersionModels[id].value, resolved.resolvedVersion, 'error')
        return null
    }

    const varsForRequest = {
        ...mergedGenerationVariables.value,
        ...buildRuntimePredefinedVariables(resolved),
    }

    const ctx = buildPromptExecutionContext(resolved.text, varsForRequest)
    if (ctx.forbiddenTemplateSyntax.length > 0) {
        toast.error(t('imageWorkspace.generation.forbiddenTemplateSyntax'))
        return null
    }
    if (ctx.missingVariables.length > 0) {
        toast.error(t('imageWorkspace.generation.missingVariables', { vars: ctx.missingVariables.join(', ') }))
        return null
    }

    const prompt = ctx.renderedContent
    if (!prompt.trim()) {
        toast.error(t('imageWorkspace.generation.missingRequiredFields'))
        return null
    }

    return {
        prompt,
        configId: modelKey,
        count: 1,
        paramOverrides: { outputMimeType: 'image/png' },
    }
}

// 并行生成时避免 saveSession 竞态：串行化保存，最后一次写入应包含最新状态。
let sessionSaveChain: Promise<void> = Promise.resolve()
const queueSessionSave = () => {
    sessionSaveChain = sessionSaveChain
        .then(() => session.saveSession())
        .catch((e) => {
            console.error('[ImageText2ImageWorkspace] Failed to persist image session:', e)
        })
    return sessionSaveChain
}

const saveSessionAfterHistoryCommit = async (reason: string) => {
    try {
        await session.saveSession()
    } catch (e) {
        console.error(`[ImageText2ImageWorkspace] Failed to persist image session after ${reason}:`, e)
        toast.warning(t('toast.warning.saveHistoryFailed'))
    }
}

const runVariant = async (
    id: TestVariantId,
    opts?: {
        silentSuccess?: boolean
        silentError?: boolean
        persist?: boolean
        allowParallel?: boolean
        skipClearEvaluation?: boolean
    },
): Promise<boolean> => {
    if (variantRunning[id]) return false

    const request = getVariantRequest(id)
    if (!request) return false

    if (!opts?.skipClearEvaluation) {
        evaluationHandler.clearBeforeTest()
    }

    variantRunning[id] = true
    try {
        try {
            await validateText2ImageRequest(request)
        } catch (e) {
            if (!opts?.silentError) {
                toast.error(getI18nErrorMessage(e, t('imageWorkspace.generation.validationFailed')))
            }
            return false
        }

        const res = await generateText2Image(request)
        session.updateTestVariantResult(id, res)
        session.setTestVariantLastRunFingerprint(id, getVariantFingerprint(id))

        if (!opts?.silentSuccess) {
            toast.success(t('imageWorkspace.generation.generationCompleted'))
        }
        return true
    } catch (error) {
        if (!opts?.silentError) {
            toast.error(getI18nErrorMessage(error, t('imageWorkspace.generation.generateFailed')))
        }
        return false
    } finally {
        variantRunning[id] = false
        if (opts?.persist !== false) {
            queueSessionSave()
        }
    }
}

const runAllVariants = async () => {
    if (isAnyVariantRunning.value) return

    const ids = activeVariantIds.value
    for (const id of ids) {
        if (!getVariantRequest(id)) return
    }

    evaluationHandler.clearBeforeTest()

    const results = await runTasksWithExecutionMode(
        ids,
        async (id) =>
            runVariant(id, {
                silentSuccess: true,
                silentError: true,
                persist: false,
                skipClearEvaluation: true,
            }),
    )

    queueSessionSave()

    if (results.every(Boolean)) {
        toast.success(t('imageWorkspace.generation.generationCompleted'))
    } else {
        toast.error(t('imageWorkspace.generation.generateFailed'))
    }
}

// 保存本地编辑
const handleSaveLocalEdit = async (payload: { note?: string }) => {
    if (!historyManager.value) {
        toast.error(t('toast.error.historyUnavailable'))
        return
    }

    const newPrompt = optimizedPrompt.value || ''
    if (!newPrompt.trim()) return

    try {
        const chainId = currentChainId.value || session.chainId || ''
        const currentRecord = currentVersions.value.find((v) => v.id === currentVersionId.value)

        const modelKey = currentRecord?.modelKey || selectedTextModelKey.value || 'local-edit'
        const templateId =
            currentRecord?.templateId ||
            selectedIterateTemplate.value?.id ||
            selectedTemplate.value?.id ||
            'local-edit'

        const chain = chainId
            ? await historyManager.value.addIteration({
                  chainId,
                  originalPrompt: originalPrompt.value,
                  optimizedPrompt: newPrompt,
                  modelKey,
                  templateId,
                  iterationNote: payload.note,
                  metadata: withHistorySourceBindingMetadata({
                      optimizationMode: 'user' as OptimizationMode,
                      functionMode: 'image',
                      localEdit: true,
                      localEditSource: 'manual',
                      imageModelKey: selectedImageModelKey.value,
                      hasInputImage: false,
                      compareMode: isCompareMode.value,
                  }, session),
              })
            : await historyManager.value.createNewChain({
                  id: uuidv4(),
                  originalPrompt: originalPrompt.value,
                  optimizedPrompt: newPrompt,
                  type: 'text2imageOptimize' as PromptRecordType,
                  modelKey,
                  templateId,
                  timestamp: Date.now(),
                  metadata: withHistorySourceBindingMetadata({
                      optimizationMode: 'user' as OptimizationMode,
                      functionMode: 'image',
                      localEdit: true,
                      localEditSource: 'manual',
                      imageModelKey: selectedImageModelKey.value,
                      hasInputImage: false,
                      compareMode: isCompareMode.value,
                  }, session),
              })

        currentChainId.value = chain.chainId
        currentVersions.value = chain.versions
        currentVersionId.value = chain.currentRecord.id

        session.updateOptimizedResult({
            optimizedPrompt: newPrompt,
            reasoning: '',
            chainId: chain.chainId,
            versionId: chain.currentRecord.id,
        })
        await saveSessionAfterHistoryCommit('local edit commit')

        window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
        toast.success(t('toast.success.localEditSaved'))
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to save local edit:', e)
        toast.warning(t('toast.warning.saveHistoryFailed'))
    }
}

// PromptPanel 引用，用于在语言切换后刷新迭代模板选择
const promptPanelRef = ref<InstanceType<typeof PromptPanelUI> | null>(null);

const handleApplyImprovement = evaluationHandler.createApplyImprovementHandler(promptPanelRef)

const handleApplyPatch = (payload: { operation: PatchOperation }) => {
    if (!payload.operation) return
    const current = optimizedPrompt.value || ''
    const result = applyPatchOperationsToText(current, payload.operation)
    if (!result.ok) {
        toast.warning(t('toast.warning.patchApplyFailed'))
        return
    }
    optimizedPrompt.value = result.text
    toast.success(t('evaluation.diagnose.applyFix'))
}

// 输入区折叠状态（初始展开）
const isInputPanelCollapsed = ref(false);

// 提示词摘要（折叠态显示）
const promptSummary = computed(() => {
    if (!originalPrompt.value) return '';
    return originalPrompt.value.length > 50
        ? originalPrompt.value.slice(0, 50) + '...'
        : originalPrompt.value;
});

const resetExtractedPromptArtifacts = () => {
    currentChainId.value = ''
    currentVersions.value = []
    currentVersionId.value = ''

    session.clearAssetBinding()
    session.updateOptimizedResult({
        optimizedPrompt: '',
        reasoning: '',
        chainId: '',
        versionId: '',
    })

}

const syncTemporaryVariables = (variables: Record<string, string>) => {
    const nextVariables = { ...variables }
    const existingVariables = tempVarsManager.listVariables()

    for (const name of Object.keys(existingVariables)) {
        if (!(name in nextVariables)) {
            tempVarsManager.deleteVariable(name)
        }
    }

    for (const [name, value] of Object.entries(nextVariables)) {
        tempVarsManager.setVariable(name, value)
    }
}

const referenceAction = reactive(useReferenceImageActions({
    getCurrentPrompt: () => originalPrompt.value,
    applyPrompt: (prompt) => {
        originalPrompt.value = prompt
    },
    applyVariables: (variables) => {
        syncTemporaryVariables(variables)
    },
    resetPromptArtifacts: resetExtractedPromptArtifacts,
}))

const referenceActionButtons = computed(() => ([
    {
        kind: 'replicate' as ReferenceActionKind,
        labelKey: 'imageWorkspace.referenceImage.replicateAction',
        tooltipKey: 'imageWorkspace.referenceImage.replicateActionDescription',
        loading: isExtractingFromImage.value && referenceAction.actionKind === 'replicate',
        disabled: isExtractingFromImage.value || isOptimizing.value,
    },
    {
        kind: 'style-learn' as ReferenceActionKind,
        labelKey: 'imageWorkspace.referenceImage.styleLearnAction',
        tooltipKey: referenceAction.canTriggerStyleLearning
            ? 'imageWorkspace.referenceImage.styleLearnActionDescription'
            : 'imageWorkspace.referenceImage.styleLearnDisabledHint',
        loading: isExtractingFromImage.value && referenceAction.actionKind === 'style-learn',
        disabled: isExtractingFromImage.value || isOptimizing.value || !referenceAction.canTriggerStyleLearning,
    },
]))

const referenceActionStatusLabelKey = computed(() => {
    if (referenceAction.status === 'processing') {
        return 'imageWorkspace.referenceImage.processingStatus'
    }

    if (referenceAction.status === 'ready') {
        return 'imageWorkspace.referenceImage.readyStatus'
    }

    if (referenceAction.status === 'error') {
        return 'imageWorkspace.referenceImage.errorStatus'
    }

    return ''
})

const resolveReferenceActionMode = (
    actionKind: ReferenceActionKind,
): ReferenceApplicationMode => (actionKind === 'style-learn' ? 'migrate' : 'replicate')

const resolveReferenceActionPreview = async (
    actionKind: ReferenceActionKind = referenceAction.actionKind,
    previewToken: number = referenceActionPreviewToken.value,
) => {
    if (!referenceImagePayload.value) {
        return false
    }

    const modelConfig = await getImageRecognitionModelConfig()

    const preview = await resolveReferencePromptPreview({
        mode: resolveReferenceActionMode(actionKind),
        originalPrompt: referenceAction.currentPromptSnapshot,
        modelConfig,
        imageB64: referenceImagePayload.value.base64,
        mimeType: referenceImagePayload.value.mimeType || 'image/png',
        templateManager: services.value?.templateManager,
        referenceMode: 'text2image',
    })

    if (previewToken !== referenceActionPreviewToken.value) {
        return false
    }

    referenceAction.setResultPreview(preview)
    if (!referenceAction.applyToCurrentPrompt()) {
        return false
    }

    queueSessionSave()
    toast.success(t('imageWorkspace.referenceImage.applySuccess'))
    return true
}

const beginReferenceActionTask = () => {
    referenceActionPendingCount.value += 1
    isExtractingFromImage.value = true
    referenceAction.beginProcessing()
}

const endReferenceActionTask = () => {
    referenceActionPendingCount.value = Math.max(0, referenceActionPendingCount.value - 1)
    isExtractingFromImage.value = referenceActionPendingCount.value > 0
}

const createReferenceActionPreviewToken = () => {
    referenceActionPreviewToken.value += 1
    return referenceActionPreviewToken.value
}

const triggerReferenceAction = (actionKind: ReferenceActionKind) => {
    if (isExtractingFromImage.value) {
        return
    }

    if (actionKind === 'style-learn' && !referenceAction.canTriggerStyleLearning) {
        return
    }

    referenceAction.requestAction(actionKind)
    extractImageInputRef.value?.click()
}

const handleReferenceImageFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement | null
    const file = input?.files?.[0] || null

    if (input) {
        input.value = ''
    }

    if (!file || isExtractingFromImage.value) {
        return
    }

    if (!effectiveImageRecognitionModelKey.value) {
        promptConfigureImageRecognitionModel()
        return
    }

    const preparedInputs = await prepareImageInputRefs([file])
    if (!preparedInputs) {
        return
    }
    const preparedInput = preparedInputs[0]

    const nextActionKind = referenceAction.actionKind
    const previewToken = createReferenceActionPreviewToken()
    beginReferenceActionTask()

    try {
        const { b64: base64, mimeType = 'image/png' } = preparedInput
        referenceAction.setSourceImagePreview(`data:${mimeType || 'image/png'};base64,${base64}`)
        referenceImagePayload.value = {
            base64,
            mimeType: mimeType || 'image/png',
        }
        await resolveReferenceActionPreview(nextActionKind, previewToken)
    } catch (error) {
        const errorMessage = getI18nErrorMessage(error, t('imageWorkspace.input.extractFailed'))
        referenceAction.setError(errorMessage)
        toast.error(errorMessage)
    } finally {
        endReferenceActionTask()
    }
}

// 注入 App 层统一的 openTemplateManager / openModelManager / handleSaveFavorite 接口
type TemplateEntryType =
    | "optimize"
    | "userOptimize"
    | "iterate"
    | "contextIterate"
    | "text2imageOptimize"
    | "image2imageOptimize"
    | "imageIterate";

const appOpenTemplateManager = inject<
    ((type?: TemplateEntryType) => void) | null
>("openTemplateManager", null);
const appOpenModelManager = inject<
    ((tab?: "text" | "image" | "function") => void) | null
>("openModelManager", null);
const appHandleSaveFavorite = inject<
    ((data: { content: string; originalContent?: string }) => void) | null
>("handleSaveFavorite", null);

// 将迭代类型映射为图像迭代，并调用 App 入口
const onOpenTemplateManager = (type: TemplateEntryType) => {
    const target: TemplateEntryType =
        type === "iterate" || type === "contextIterate" ? "imageIterate" : type;
    appOpenTemplateManager?.(target);
};

// 全屏编辑：复用 useFullscreen 模式，编辑 originalPrompt
const { isFullscreen, fullscreenValue, openFullscreen } = useFullscreen(
    computed(() => originalPrompt.value),
    (value) => {
        originalPrompt.value = value;
    },
);

// ========== 模板 SelectWithConfig 选中绑定 ==========
const selectedTemplateIdForSelect = computed<string>({
    get() {
        const id = selectedTemplateId.value || "";
        if (!id) return "";
        const existsInList = (templateOptions.value || []).some(
            (opt) => opt.value === id,
        );
        return existsInList ? id : "";
    },
    set(id: string) {
        selectedTemplateId.value = id || "";
    },
});

// 处理收藏保存请求 - 调用 App.vue 提供的统一接口
const handleSaveFavorite = (data: {
    content: string;
    originalContent?: string;
}) => {
    console.log("[ImageText2ImageWorkspace] handleSaveFavorite triggered:", data);

    if (appHandleSaveFavorite) {
        appHandleSaveFavorite(data);
    } else {
        console.warn(
            "[ImageText2ImageWorkspace] handleSaveFavorite not available from App.vue",
        );
    }
};

// 复制图像文本输出
const copyImageText = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(t("imageWorkspace.results.copySuccess"));
    } catch (error) {
        console.error("Failed to copy text:", error);
        toast.error(t("imageWorkspace.results.copyError"));
    }
};

// 处理收藏回填 - 从收藏夹恢复提示词到图像工作区
interface RestoreFavoriteDetail {
    content: string;
    imageSubMode?: "text2image" | "image2image";
}

const handleRestoreFavorite = async (event: Event) => {
    if (!(event instanceof CustomEvent)) {
        return;
    }
    console.log(
        "[ImageText2ImageWorkspace] handleRestoreFavorite triggered:",
        event.detail,
    );
    const { content } = event.detail as RestoreFavoriteDetail;

    // 设置原始提示词
    originalPrompt.value = content;

    console.log("[ImageText2ImageWorkspace] Favorite restored successfully");
};

type ImageWorkspaceRestoreDetail = {
    originalPrompt?: unknown;
    optimizedPrompt?: unknown;
    metadata?: unknown;
    chainId?: unknown;
    versions?: unknown;
    currentVersionId?: unknown;
    imageMode?: unknown;
    templateId?: unknown;
};

const handleRestoreHistory = async (event: Event) => {
    if (!(event instanceof CustomEvent)) {
        return;
    }

    const detail = event.detail as ImageWorkspaceRestoreDetail;
    if (detail?.imageMode !== "text2image") return;

    const versions = Array.isArray(detail.versions)
        ? (detail.versions as PromptRecordChain["versions"])
        : [];

    const requestedVersionId =
        typeof detail.currentVersionId === "string" ? detail.currentVersionId : "";
    const record =
        (requestedVersionId &&
            versions.find((v) => v.id === requestedVersionId)) ||
        versions[versions.length - 1] ||
        null;

    const original =
        (record?.originalPrompt && record.originalPrompt) ||
        (typeof detail.originalPrompt === "string" ? detail.originalPrompt : "");
    const optimized =
        (record?.optimizedPrompt && record.optimizedPrompt) ||
        (typeof detail.optimizedPrompt === "string" ? detail.optimizedPrompt : "");

    // 1) Restore local history refs (PromptPanel versions list)
    currentChainId.value = typeof detail.chainId === "string" ? detail.chainId : "";
    currentVersions.value = versions;
    currentVersionId.value = record?.id || requestedVersionId || "";

    // 2) Restore session store (single source of truth for fields)
    originalPrompt.value = original;
    session.updateOptimizedResult({
        optimizedPrompt: optimized,
        reasoning: "",
        chainId: currentChainId.value || session.chainId || "",
        versionId: currentVersionId.value || session.versionId || "",
    });

    if (record?.modelKey) {
        session.updateTextModel(record.modelKey);
    }

    if (record?.templateId) {
        session.updateTemplate(record.templateId);
    } else if (typeof detail.templateId === "string") {
        session.updateTemplate(detail.templateId);
    }

    const meta =
        (record?.metadata as unknown as Record<string, unknown> | undefined) ||
        (typeof detail.metadata === "object" && detail.metadata
            ? (detail.metadata as Record<string, unknown>)
            : undefined);

    const imageModelKey = meta?.imageModelKey;
    if (typeof imageModelKey === "string") {
        session.updateImageModel(imageModelKey);
    }

    const compareMode = meta?.compareMode;
    if (typeof compareMode === "boolean") {
        session.toggleCompareMode(compareMode);
    }
};

// 在组件创建时立即注册收藏回填事件监听器
if (typeof window !== "undefined") {
    window.addEventListener(
        "image-workspace-restore-favorite",
        handleRestoreFavorite as EventListener,
    );
    window.addEventListener(
        "image-workspace-restore",
        handleRestoreHistory as EventListener,
    );
    console.log(
        "[ImageText2ImageWorkspace] Favorite restore event listener registered immediately on component creation",
    );
}

const refreshImageModels = async () => {
    try {
        await loadImageModels()
        imageModelOptions.value = imageModels.value.map(m => ({
            label: `${m.name} (${m.provider?.name || m.providerId || 'Unknown'} - ${m.model?.name || m.modelId || 'Unknown'})`,
            primary: m.name,
            secondary: `${m.provider?.name || m.providerId || 'Unknown'} · ${m.model?.name || m.modelId || 'Unknown'}`,
            value: m.id,
            raw: m,
        }))

        if (!imageModels.value.length) {
            if (isImageModelListReady.value) selectedImageModelKey.value = ''
            return
        }

        const current = selectedImageModelKey.value
        const exists = imageModels.value.some(m => m.id === current)
        if (!exists) {
            selectedImageModelKey.value = imageModels.value[0]?.id || ''
        }
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to refresh image models:', e)
    }
}

// 创建历史记录（并同步 chain/version 到 session store）
const createHistoryRecord = async () => {
    if (!selectedTemplate.value || !historyManager.value) return

    try {
        const recordData = {
            id: uuidv4(),
            originalPrompt: originalPrompt.value,
            optimizedPrompt: optimizedPrompt.value,
            type: 'text2imageOptimize' as PromptRecordType,
            modelKey: selectedTextModelKey.value,
            templateId: selectedTemplate.value.id,
            timestamp: Date.now(),
            metadata: withHistorySourceBindingMetadata({
                optimizationMode: 'user' as OptimizationMode,
                functionMode: 'image',
                imageModelKey: selectedImageModelKey.value,
                hasInputImage: false,
                compareMode: isCompareMode.value,
            }, session),
        }

        const newRecord = await historyManager.value.createNewChain(recordData)
        currentChainId.value = newRecord.chainId
        currentVersions.value = newRecord.versions
        currentVersionId.value = newRecord.currentRecord.id

        session.updateOptimizedResult({
            optimizedPrompt: optimizedPrompt.value,
            reasoning: optimizedReasoning.value,
            chainId: newRecord.chainId,
            versionId: newRecord.currentRecord.id,
        })
        await saveSessionAfterHistoryCommit('optimization commit')

        window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to create history record:', e)
        toast.warning(t('toast.error.optimizeCompleteButHistoryFailed'))
    }
}

// 优化提示词（流式写入 store.state）
const handleOptimizePrompt = async () => {
    if (!originalPrompt.value.trim() || isOptimizing.value) return
    if (!selectedTemplate.value) {
        toast.error(t('toast.error.noOptimizeTemplate'))
        return
    }
    if (!selectedTextModelKey.value) {
        toast.error(t('toast.error.noOptimizeModel'))
        return
    }
    if (!promptService.value) {
        toast.error(t('toast.error.serviceInit'))
        return
    }

    isOptimizing.value = true
    session.optimizedPrompt = ''
    session.reasoning = ''

    await nextTick()

    try {
        const request: OptimizationRequest = {
            optimizationMode: 'user',
            targetPrompt: originalPrompt.value,
            templateId: selectedTemplate.value.id,
            modelKey: selectedTextModelKey.value,
        }

        await promptService.value.optimizePromptStream(request, {
            onToken: token => {
                session.optimizedPrompt += token
            },
            onReasoningToken: token => {
                session.reasoning += token
            },
            onComplete: async () => {
                await createHistoryRecord()
                        toast.success(t('toast.success.optimizeSuccess'))
            },
            onError: (error: Error) => {
                throw error
            },
        })
    } catch (error) {
        toast.error(getI18nErrorMessage(error, t('toast.error.optimizeFailed')))
    } finally {
        isOptimizing.value = false
    }
}

// 迭代优化（流式写入 store.state）
const handleIteratePrompt = async (payload: {
    originalPrompt: string
    optimizedPrompt: string
    iterateInput: string
}) => {
    if (!selectedIterateTemplate.value || !promptService.value) {
        console.error('[ImageText2ImageWorkspace] Missing iterate dependencies')
        return
    }

    isIterating.value = true
    const previousOptimizedPrompt = optimizedPrompt.value

    session.optimizedPrompt = ''
    session.reasoning = ''

    try {
        await promptService.value.iteratePromptStream(
            payload.originalPrompt,
            payload.optimizedPrompt,
            payload.iterateInput,
            selectedTextModelKey.value,
            {
                onToken: token => {
                    session.optimizedPrompt += token
                },
                onReasoningToken: token => {
                    session.reasoning += token
                },
                onComplete: async () => {
                    try {
                        if (historyManager.value && currentChainId.value) {
                            const updatedChain = await historyManager.value.addIteration({
                                chainId: currentChainId.value,
                                originalPrompt: payload.originalPrompt,
                                optimizedPrompt: optimizedPrompt.value,
                                iterationNote: payload.iterateInput,
                                modelKey: selectedTextModelKey.value,
                                templateId: selectedIterateTemplate.value!.id,
                                metadata: withHistorySourceBindingMetadata(undefined, session),
                            })
                            currentVersions.value = updatedChain.versions
                            currentVersionId.value = updatedChain.currentRecord.id
                            session.updateOptimizedResult({
                                optimizedPrompt: optimizedPrompt.value,
                                reasoning: optimizedReasoning.value,
                                chainId: updatedChain.chainId,
                                versionId: updatedChain.currentRecord.id,
                            })
                            await saveSessionAfterHistoryCommit('iteration commit')
                            window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
                        } else {
                            await createHistoryRecord()
                        }
                        toast.success(t('toast.success.iterateComplete'))
                    } catch (e) {
                        console.error('[ImageText2ImageWorkspace] Failed to persist iteration:', e)
                        toast.warning(t('toast.error.iterateCompleteButHistoryFailed'))
                    }
                },
                onError: (error: Error) => {
                    throw error
                },
            },
            selectedIterateTemplate.value.id,
        )
    } catch (error) {
        toast.error(getI18nErrorMessage(error, t('toast.error.iterateFailed')))
        optimizedPrompt.value = previousOptimizedPrompt
    } finally {
        isIterating.value = false
    }
}

// 切换版本（仅影响当前 UI 展示，不持久化 versions）
const handleSwitchVersion = async (version: PromptRecordChain['versions'][number]) => {
    optimizedPrompt.value = version.optimizedPrompt
    currentVersionId.value = version.id
    session.updateOptimizedResult({
        optimizedPrompt: version.optimizedPrompt || '',
        reasoning: optimizedReasoning.value || '',
        chainId: currentChainId.value || session.chainId || '',
        versionId: version.id || '',
    })
    await nextTick()
}

// 获取图像显示源地址
const getImageSrc = (imageItem: ImageResultItem | null | undefined) => {
    if (!imageItem) return ''
    if (imageItem.url) return imageItem.url
    if (imageItem.b64) {
        const mime = imageItem.mimeType ?? 'image/png'
        return `data:${mime};base64,${imageItem.b64}`
    }
    return ''
}

// 下载图像
const downloadImageFromResult = async (imageItem: ImageResultItem | null | undefined) => {
    if (!imageItem) return
    const downloaded = await downloadImageSource(getImageSrc(imageItem), {
        mimeType: imageItem.mimeType ?? null,
    })
    if (!downloaded) {
        toast.error(t('imageWorkspace.results.downloadFailed'))
    }
}

// 初始化
const initialize = async () => {
    try {
        await modelSelection.refreshTextModels()
        await refreshImageModels()
        await templateSelection.refreshOptimizeTemplates()
        await templateSelection.refreshIterateTemplates()
    } catch (e) {
        console.error('[ImageText2ImageWorkspace] Failed to initialize:', e)
    }
}

// 初始化和语言切换事件处理器
const refreshIterateHandler = async () => {
    await templateSelection.refreshIterateTemplates()
    promptPanelRef.value?.refreshIterateTemplateSelect?.();
};

// 文本模型刷新事件处理器（模型管理器关闭后同步刷新）
const refreshTextModelsHandler = async () => {
    try {
        await modelSelection.refreshTextModels();
    } catch (e) {
        console.warn(
            "[ImageText2ImageWorkspace] Failed to refresh text models after manager close:",
            e,
        );
    }
};

// 图像模型刷新事件处理器（模型管理器关闭后同步刷新）
const refreshImageModelsHandler = async () => {
    try {
        await refreshImageModels();
    } catch (e) {
        console.warn(
            "[ImageText2ImageWorkspace] Failed to refresh image models after manager close:",
            e,
        );
    }
};

// 模板管理器关闭后刷新当前模板列表（并尽量保持当前选择）
const refreshTemplatesHandler = async () => {
    try {
        await templateSelection.refreshOptimizeTemplates()
        await templateSelection.refreshIterateTemplates()
        await nextTick();
        promptPanelRef.value?.refreshIterateTemplateSelect?.();
    } catch (e) {
        console.warn(
            "[ImageText2ImageWorkspace] Failed to refresh template list after manager close:",
            e,
        );
    }
};

// 下拉获得焦点时，主动刷新模板列表，确保新建/编辑后的模板可见
const handleTemplateSelectFocus = async () => {
    await refreshTemplatesHandler();
};

// 文本模型下拉获得焦点时刷新，确保新建/编辑后的模型立即可用
const handleTextModelSelectFocus = async () => {
    await refreshTextModelsHandler();
};

onMounted(async () => {
    console.log("[ImageText2ImageWorkspace] Starting initialization...");
    console.log("[ImageText2ImageWorkspace] Services available:", !!services?.value);
    try {
        await initialize();
        console.log("[ImageText2ImageWorkspace] Initialization completed successfully");
    } catch (error) {
        console.error("[ImageText2ImageWorkspace] Initialization failed:", error);
    }

    // 监听模板语言切换事件，刷新迭代模板选择
    if (typeof window !== "undefined") {
        window.addEventListener(
            "image-workspace-refresh-iterate-select",
            refreshIterateHandler,
        );
        window.addEventListener(
            "image-workspace-refresh-text-models",
            refreshTextModelsHandler,
        );
        window.addEventListener(
            "image-workspace-refresh-image-models",
            refreshImageModelsHandler,
        );
        window.addEventListener(
            "image-workspace-refresh-templates",
            refreshTemplatesHandler,
        );
    }

    await templateSelection.refreshOptimizeTemplates()
    await templateSelection.refreshIterateTemplates()
});

// 清理
onUnmounted(() => {
    console.log("[ImageText2ImageWorkspace] Cleaning up...");
    if (typeof window !== "undefined") {
        window.removeEventListener(
            "image-workspace-refresh-iterate-select",
            refreshIterateHandler,
        );
        window.removeEventListener(
            "image-workspace-refresh-text-models",
            refreshTextModelsHandler,
        );
        window.removeEventListener(
            "image-workspace-refresh-image-models",
            refreshImageModelsHandler,
        );
        window.removeEventListener(
            "image-workspace-refresh-templates",
            refreshTemplatesHandler,
        );
        window.removeEventListener(
            "image-workspace-restore-favorite",
            handleRestoreFavorite as EventListener,
        );
        window.removeEventListener(
            "image-workspace-restore",
            handleRestoreHistory as EventListener,
        );
    }
});
</script>

<style scoped>
.image-text2image-workspace {
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

.image-text2image-split {
    display: grid;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
}

.split-pane {
    min-height: 0;
}

.header-utility-button {
    border-radius: 999px;
    font-weight: 500;
}

.reference-action-toolbar {
    min-width: 0;
    flex-wrap: wrap;
}

.reference-action-button-wrap {
    display: inline-flex;
}

.reference-action-anchor {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}

.reference-action-thumbnail {
    width: 40px;
    height: 40px;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid var(--n-border-color);
    background: var(--n-color-embedded);
    flex-shrink: 0;
}

.reference-action-status {
    border-radius: 999px;
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

.variant-cell__model {
    flex: 1 1 auto;
    min-width: 0;
}

.variant-cell__run {
    flex-shrink: 0;
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
</style>
