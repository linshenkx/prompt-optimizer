<template>
    <div class="image-image2image-workspace" data-testid="workspace" data-mode="image-image2image">
        <div
            ref="splitRootRef"
            class="image-image2image-split"
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
            <NCard :style="{ flexShrink: 0 }">
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
                        <NFlex align="center" :size="12">
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
                        data-testid="image-image2image-input"
                        :model-value="originalPrompt"
                        @update:model-value="handleOriginalPromptInput"
                        :readonly="isOptimizing"
                        :placeholder="t('imageWorkspace.input.originalPromptPlaceholder')"
                        :autosize="true"
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
                        data-testid="image-image2image-input"
                        :placeholder="
                            t('imageWorkspace.input.originalPromptPlaceholder')
                        "
                        :rows="4"
                        :autosize="{ minRows: 4, maxRows: 12 }"
                        clearable
                        show-count
                        :disabled="isOptimizing"
                    />

                    <!-- 图片上传区域 - Image2Image 模式始终显示 -->
                    <NSpace
                        vertical
                        :size="8"
                    >
                        <NText
                            :depth="2"
                            style="font-size: 14px; font-weight: 500"
                            >{{ t("imageWorkspace.input.image") }}</NText
                        >
                        <NFlex
                            align="center"
                            size="small"
                            :style="{ flex: 1, gap: '8px' }"
                        >
                            <NButton
                                data-testid="image-image2image-open-upload"
                                :disabled="isOptimizing"
                                @click="openUploadModal"
                                size="medium"
                            >
                                {{ t("imageWorkspace.input.selectImage") }}
                            </NButton>

                            <!-- 缩略图显示区域 -->
                            <div
                                v-if="previewImageUrl"
                                class="thumbnail-container"
                            >
                                <NImage
                                    data-testid="image-image2image-input-preview"
                                    :src="previewImageUrl"
                                    :style="{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        objectFit: 'cover',
                                        border: '1px solid #e0e0e6',
                                    }"
                                />
                            </div>

                            <!-- 删除按钮 -->
                            <NButton
                                v-if="previewImageUrl"
                                @click="clearUploadedImage"
                                :disabled="isOptimizing"
                                size="medium"
                                type="error"
                                secondary
                            >
                                ❌
                            </NButton>
                        </NFlex>
                    </NSpace>

                    <!-- 控制面板 - 使用网格布局 -->
                    <NGrid :cols="24" :x-gap="8" responsive="screen">
                        <!-- 文本模型选择 -->
                        <NGridItem :span="7" :xs="24" :sm="7">
                            <NSpace vertical :size="8">
                                <NText
                                    :depth="2"
                                    style="font-size: 14px; font-weight: 500"
                                    >{{
                                        t("imageWorkspace.input.textModel")
                                    }}</NText
                                >
                                <template v-if="appOpenModelManager">
                                    <SelectWithConfig
                                        data-testid="image-image2image-text-model-select"
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
                                        data-testid="image-image2image-text-model-select"
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
                                        data-testid="image-image2image-template-select"
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

                        <!-- 分析与优化按钮 -->
                        <NGridItem :span="6" :xs="24" :sm="6" class="flex items-end justify-end">
                            <NSpace :size="8">
                                <!-- 分析按钮（与优化同级） -->
                                <NButton
                                    type="default"
                                    size="medium"
                                    data-testid="image-image2image-analyze-button"
                                    :loading="isAnalyzing"
                                    @click="handleAnalyze"
                                    :disabled="
                                        isAnalyzing ||
                                        isOptimizing ||
                                        !originalPrompt.trim()
                                    "
                                >
                                    {{
                                        isAnalyzing
                                            ? t('promptOptimizer.analyzing')
                                            : t('promptOptimizer.analyze')
                                    }}
                                </NButton>
                                <!-- 优化按钮 -->
                                <NButton
                                    type="primary"
                                    size="medium"
                                    data-testid="image-image2image-optimize-button"
                                    :loading="isOptimizing"
                                    @click="handleOptimizePrompt"
                                    :disabled="
                                        isAnalyzing ||
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
            </NCard>

            <!-- 优化结果区域 - 使用与基础模式一致的卡片容器 -->
            <NCard
                :style="{ flex: 1, minHeight: '200px', overflow: 'hidden' }"
                content-style="height: 100%; max-height: 100%; overflow: hidden;"
            >
                <PromptPanelUI
                    v-if="services && services.templateManager"
                    test-id="image-image2image"
                    ref="promptPanelRef"
                    v-model:optimized-prompt="optimizedPrompt"
                    :reasoning="optimizedReasoning"
                    :original-prompt="originalPrompt"
                    :is-optimizing="isOptimizing"
                    :is-iterating="isIterating"
                    v-model:selected-iterate-template="selectedIterateTemplate"
                    :versions="currentVersions"
                    :current-version-id="currentVersionId"
                    :optimization-mode="optimizationMode"
                    :advanced-mode-enabled="advancedModeEnabled"
                    :show-preview="true"
                    iterate-template-type="imageIterate"
                    @iterate="handleIteratePrompt"
                    @openTemplateManager="onOpenTemplateManager"
                    @switchVersion="handleSwitchVersion"
                    @save-favorite="handleSaveFavorite"
                    @save-local-edit="handleSaveLocalEdit"
                    @open-preview="handleOpenPromptPreview"
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
                                    :data-testid="'image-image2image-test-run-all'"
                                >
                                    {{ t('test.layout.runAll') }}
                                </NButton>
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
                                        :disabled="variantRunning[id]"
                                        :data-testid="getVariantVersionTestId(id)"
                                        @update:value="(value) => { variantVersionModels[id].value = value }"
                                        style="width: 92px"
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
                                            @config="() => appOpenModelManager && appOpenModelManager('image')"
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
                                <div class="result-container">
                                    <div class="result-body">
                                        <template v-if="hasVariantResult(id)">
                                            <NSpace vertical :size="12" style="padding: 12px;">
                                                <NImage
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

                                                <NSpace justify="center" :size="8">
                                                    <NButton
                                                        size="small"
                                                        @click="downloadImageFromResult(getVariantResult(id)?.images?.[0], `variant-${id}`)"
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

        <!-- 原始提示词 - 全屏编辑器 -->
        <FullscreenDialog
            v-model="isFullscreen"
            :title="t('imageWorkspace.input.originalPrompt')"
        >
            <NInput
                v-model:value="fullscreenValue"
                type="textarea"
                :placeholder="t('imageWorkspace.input.originalPromptPlaceholder')"
                :autosize="{ minRows: 20 }"
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

        <!-- 图片上传弹窗 -->
        <n-modal
            data-testid="image-image2image-upload-modal"
            v-model:show="showUploadModal"
            preset="card"
            :title="t('imageWorkspace.upload.title')"
            style="width: min(500px, 90vw); max-width: 500px"
        >
            <div style="padding: 16px">
                <n-upload
                    data-testid="image-image2image-upload"
                    :max="1"
                    accept="image/png,image/jpeg"
                    :show-file-list="true"
                    @change="handleModalUploadChange"
                    :disabled="isOptimizing"
                >
                    <n-upload-dragger>
                        <div style="padding: 24px; text-align: center">
                            <div style="font-size: 32px; margin-bottom: 12px">
                                📁
                            </div>
                            <n-text style="font-size: 14px">{{
                                t("imageWorkspace.upload.dragText")
                            }}</n-text>
                            <n-p depth="3" style="margin-top: 8px; font-size: 12px">
                                {{ t("imageWorkspace.upload.fileRequirements") }}
                            </n-p>
                        </div>
                    </n-upload-dragger>
                </n-upload>

                <!-- 上传状态指示 -->
                <div v-if="uploadStatus !== 'idle'" style="margin-top: 16px">
                    <n-progress
                        v-if="uploadStatus === 'uploading'"
                        :percentage="uploadProgress"
                        :show-indicator="true"
                        status="info"
                    />
                    <n-alert
                        v-else-if="uploadStatus === 'error'"
                        :title="t('imageWorkspace.upload.uploadFailed')"
                        type="error"
                        size="small"
                    />
                    <n-alert
                        v-else-if="uploadStatus === 'success'"
                        :title="t('imageWorkspace.upload.uploadSuccess')"
                        type="success"
                        size="small"
                    />
                </div>
            </div>
        </n-modal>

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

        <!-- 模板管理器由 App 统一管理，这里不再渲染 -->
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, inject, ref, reactive, computed, watch, nextTick, toRef, type Ref } from 'vue'

import {
    NCard,
    NButton,
    NInput,
    NEmpty,
    NSpace,
    NUpload,
    NUploadDragger,
    NImage,
    NText,
    NFlex,
    NGrid,
    NGridItem,
    NP,
    NProgress,
    NAlert,
    NModal,
    NIcon,
    NTag,
    NSelect,
    NRadioGroup,
    NRadioButton,
    NTooltip,
    type UploadFileInfo,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import PromptPanelUI from "../PromptPanel.vue";
import PromptPreviewPanel from "../PromptPreviewPanel.vue";
import SelectWithConfig from "../SelectWithConfig.vue";
import { EvaluationPanel } from '../evaluation'
import { provideEvaluation } from '../../composables/prompt/useEvaluationContext';
import { useLocalPromptPreviewPanel } from '../../composables/prompt/useLocalPromptPreviewPanel'
import { OptionAccessors } from "../../utils/data-transformer";
import type { AppServices } from "../../types/services";
import { useFullscreen } from "../../composables/ui/useFullscreen";
import FullscreenDialog from "../FullscreenDialog.vue";
import type { SelectOption } from "../../types/select-options";
import { useToast } from "../../composables/ui/useToast";
import { getI18nErrorMessage } from '../../utils/error'
import { VariableAwareInput } from '../variable-extraction'
import TemporaryVariablesPanel from '../variable/TemporaryVariablesPanel.vue'
import VariableValuePreviewDialog from '../variable/VariableValuePreviewDialog.vue'
import { useTemporaryVariables } from '../../composables/variable/useTemporaryVariables'
import { useVariableAwareInputBridge } from '../../composables/variable/useVariableAwareInputBridge'
import { useTestVariableManager } from '../../composables/variable/useTestVariableManager'
import { useSmartVariableValueGeneration } from '../../composables/variable/useSmartVariableValueGeneration'
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager'
import {
    buildPromptExecutionContext,
    hashString,
    hashVariables,
} from '../../utils/prompt-variables'
import {
    useImageImage2ImageSession,
    type TestColumnCount,
    type TestPanelVersionValue,
    type TestVariantConfig,
    type TestVariantId,
} from '../../stores/session/useImageImage2ImageSession'
import { useImageGeneration } from '../../composables/image/useImageGeneration'
import { useEvaluationHandler, type TestResultsData } from '../../composables/prompt/useEvaluationHandler'
import { useWorkspaceTemplateSelection } from '../../composables/workspaces/useWorkspaceTemplateSelection'
import { useWorkspaceTextModelSelection } from '../../composables/workspaces/useWorkspaceTextModelSelection'
import { useElementSize } from '@vueuse/core'
import {
    applyPatchOperationsToText,
    type ContextMode,
    type ImageModelConfig,
    type Image2ImageRequest,
    type ImageResult,
    type ImageResultItem,
    type OptimizationMode,
    type OptimizationRequest,
    type PromptRecordChain,
    type PromptRecordType,
    type PatchOperation,
    type Template,
} from '@prompt-optimizer/core'
import { v4 as uuidv4 } from 'uuid'

// 国际化
const { t } = useI18n();

// Toast
const toast = useToast();

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
    isReady: computed(() => variableManager?.isReady.value ?? false),
    globalVariables: computed(() => variableManager?.customVariables.value || {}),
    temporaryVariables: tempVarsManager.temporaryVariables,
    allVariables: computed(() => variableManager?.allVariables.value || {}),
    saveGlobalVariable: (name, value) => variableManager?.addVariable(name, value),
    saveTemporaryVariable: (name, value) => tempVarsManager.setVariable(name, value),
    logPrefix: 'ImageImage2ImageWorkspace',
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
const session = useImageImage2ImageSession()

// 图像生成相关
const {
    imageModels,
    generateImage2Image,
    validateImage2ImageRequest,
    loadImageModels,
} = useImageGeneration()

// 服务引用
const historyManager = computed(() => services.value?.historyManager)
const promptService = computed(() => services.value?.promptService)

// 过程态（本地，不持久化）
const isOptimizing = ref(false)
const isIterating = ref(false)
const uploadStatus = ref<'idle' | 'uploading' | 'success' | 'error'>('idle')
const uploadProgress = ref(0)

// 历史管理专用 ref（不写入 session store）
const currentChainId = ref('')
const currentVersions = ref<PromptRecordChain['versions']>([])
const currentVersionId = ref('')

// 字段级访问器（从 session state）
const originalPrompt = computed<string>({
    get: () => session.originalPrompt || '',
    set: (value) => session.updatePrompt(value || ''),
})

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

const selectedImageModelKey = computed<string>({
    get: () => session.selectedImageModelKey || '',
    set: (value) => session.updateImageModel(value || ''),
})

const templateSelection = useWorkspaceTemplateSelection(
    services,
    session,
    'image2imageOptimize',
    'imageIterate',
)

const selectedTemplateId = templateSelection.selectedTemplateId
const templateOptions = templateSelection.templateOptions

const isCompareMode = computed<boolean>({
    get: () => !!session.isCompareMode,
    set: (value) => session.toggleCompareMode(!!value),
})

// Image2Image 特有：输入图像
const inputImageB64 = computed<string | null>({
    get: () => session.inputImageB64 || null,
    set: (value) => {
        session.updateInputImage(value, session.inputImageMime || '')
    },
})
const inputImageMime = computed<string>({
    get: () => session.inputImageMime || '',
    set: (value) => {
        session.updateInputImage(session.inputImageB64 || null, value || '')
    },
})

// 预览图像URL
const previewImageUrl = computed(() => {
    if (!inputImageB64.value) return null
    const mimeType = inputImageMime.value || 'image/png'
    return `data:${mimeType};base64,${inputImageB64.value}`
})

// 固定模板类型
const templateType = computed(() => "image2imageOptimize" as const)

// 图像模式统一使用 user 模式
const optimizationMode = 'user' as OptimizationMode
const advancedModeEnabled = false

const selectedTemplate = templateSelection.selectedTemplate

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
    get: () => getVariant('b')?.version ?? 'latest',
    set: (value) => session.updateTestVariant('b', { version: value }),
})

const variantCVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('c')?.version ?? 'latest',
    set: (value) => session.updateTestVariant('c', { version: value }),
})

const variantDVersionModel = computed<TestPanelVersionValue>({
    get: () => getVariant('d')?.version ?? 'latest',
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

// 版本选项：原始(v0) + 中间版本(v1..v(n-1)) + 最新(latest)
const versionOptions = computed(() => {
    const versions = currentVersions.value || []

    const sortedVersions = versions
        .map((v) => v.version)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 1)
        .slice()
        .sort((a, b) => a - b)

    const latest = sortedVersions.length ? sortedVersions[sortedVersions.length - 1] : null
    const middle = latest ? sortedVersions.filter((v) => v < latest) : []

    return [
        { label: t('test.layout.original'), value: 0 },
        ...middle.map((v) => ({ label: `v${v}`, value: v })),
        { label: t('test.layout.latest'), value: 'latest' },
    ]
})

// 确保测试列的模型选择始终有效（模型列表变化时自动 fallback）
watch(
    () => imageModelOptions.value,
    (opts) => {
        const fallback = opts?.[0]?.value || ''
        if (!fallback) return
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

type ResolvedPrompt = { text: string; resolvedVersion: number }

const resolvePromptForSelection = (selection: TestPanelVersionValue): ResolvedPrompt => {
    const v0 = originalPrompt.value || ''
    const versions = currentVersions.value || []

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
        if (!latest) return { text: optimizedPrompt.value || v0, resolvedVersion: 0 }
        return { text: latest.optimizedPrompt || '', resolvedVersion: latest.version }
    }

    const target = versions.find((v) => v.version === selection)
    if (target) {
        return { text: target.optimizedPrompt || '', resolvedVersion: target.version }
    }

    if (latest) return { text: latest.optimizedPrompt || '', resolvedVersion: latest.version }
    return { text: optimizedPrompt.value || v0, resolvedVersion: 0 }
}

// 注意：Pinia setup store 会把 ref 自动解包；直接赋值会丢失响应性。
// 这里用 computed 读取，确保 store 替换对象引用时 UI 能跟着更新。
const variantResults = computed(
    () => session.testVariantResults as unknown as Record<TestVariantId, ImageResult | null>,
)
const variantLastRunFingerprint = computed(
    () => session.testVariantLastRunFingerprint as unknown as Record<TestVariantId, string>,
)

const variantRunning = reactive<Record<TestVariantId, boolean>>({
    a: false,
    b: false,
    c: false,
    d: false,
})

const isAnyVariantRunning = computed(() =>
    activeVariantIds.value.some((id) => !!variantRunning[id]),
)

const getVariantLabel = (id: TestVariantId) => ({ a: 'A', b: 'B', c: 'C', d: 'D' }[id])

const getVariantVersionTestId = (id: TestVariantId) => {
    if (id === 'a') return 'image-image2image-test-original-version-select'
    if (id === 'b') return 'image-image2image-test-optimized-version-select'
    return `image-image2image-test-variant-${id}-version-select`
}

const getVariantModelTestId = (id: TestVariantId) => {
    if (id === 'a') return 'image-image2image-test-original-model-select'
    if (id === 'b') return 'image-image2image-test-optimized-model-select'
    return `image-image2image-test-variant-${id}-model-select`
}

const getVariantRunTestId = (id: TestVariantId) => `image-image2image-test-run-${id}`

const getVariantImageTestId = (id: TestVariantId) => {
    if (id === 'a') return 'image-image2image-original-image'
    if (id === 'b') return 'image-image2image-optimized-image'
    return `image-image2image-variant-${id}-image`
}

const getVariantResult = (id: TestVariantId) => variantResults.value[id]
const hasVariantResult = (id: TestVariantId) => !!(variantResults.value[id]?.images?.length)

// image 模式变量优先级：global < temporary < predefined
const mergedGenerationVariables = computed<Record<string, string>>(() => ({
    ...(variableManager?.customVariables.value || {}),
    ...(tempVarsManager.temporaryVariables.value || {}),
    ...(purePredefinedVariables.value || {}),
}))

// ========================
// 子模式本地提示词预览（不经过 PromptOptimizerApp）
// ========================
const previewContextMode = computed<ContextMode>(() => 'user')

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

const buildRuntimePredefinedVariables = (resolved: ResolvedPrompt): Record<string, string> => {
    const current = (resolved.text || '').trim()
    return {
        originalPrompt: (originalPrompt.value || '').trim(),
        lastOptimizedPrompt: (optimizedPrompt.value || '').trim(),
        currentPrompt: current,
        userQuestion: current,
    }
}

// 仅用于 stale 检测：避免对完整 base64 扫描（可能很大）
const getInputImageSignature = (): string => {
    const b64 = inputImageB64.value
    // 优先使用 b64：saveSession() 可能会补全 inputImageId，但我们不会清空运行时 b64。
    // 若优先使用 id，会导致保存前后 fingerprint 改变，从而误判为 stale。
    if (b64) {
        const head = b64.slice(0, 96)
        const tail = b64.slice(-96)
        const sig = hashString(`${head}:${tail}`)
        return `b64:${b64.length}:${sig}:${inputImageMime.value || ''}`
    }

    if (session.inputImageId) return `id:${session.inputImageId}`
    return 'noimg'
}

const getVariantFingerprint = (id: TestVariantId) => {
    const selection = variantVersionModels[id].value
    const resolved = resolvePromptForSelection(selection)
    const modelKey = (variantModelKeyModels[id].value || '').trim()
    const promptHash = hashString((resolved.text || '').trim())
    const imgSig = getInputImageSignature()
    const varsForFingerprint = {
        ...mergedGenerationVariables.value,
        ...buildRuntimePredefinedVariables(resolved),
    }
    const varsHash = hashVariables(varsForFingerprint)
    return `${String(selection)}:${resolved.resolvedVersion}:${modelKey}:${promptHash}:${varsHash}:${imgSig}`
}

const isVariantStale = (id: TestVariantId) => {
    if (!hasVariantResult(id)) return false
    const prev = variantLastRunFingerprint.value[id]
    if (!prev) return false
    return prev !== getVariantFingerprint(id)
}

const getVariantRequest = (id: TestVariantId): Image2ImageRequest | null => {
    const modelKey = (variantModelKeyModels[id].value || '').trim()
    if (!modelKey) {
        toast.error(t('imageWorkspace.generation.missingRequiredFields'))
        return null
    }

    const resolved = resolvePromptForSelection(variantVersionModels[id].value)
    if (!resolved.text?.trim()) {
        toast.error(t('imageWorkspace.generation.missingRequiredFields'))
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

    if (!inputImageB64.value) {
        toast.error(t('imageWorkspace.generation.inputImageRequired'))
        return null
    }

    return {
        prompt,
        configId: modelKey,
        count: 1,
        inputImage: { b64: inputImageB64.value, mimeType: inputImageMime.value || 'image/png' },
        paramOverrides: { outputMimeType: 'image/png' },
    }
}

// 并行生成时避免 saveSession 竞态：串行化保存，最后一次写入应包含最新状态。
let sessionSaveChain: Promise<void> = Promise.resolve()
const queueSessionSave = () => {
    sessionSaveChain = sessionSaveChain
        .then(() => session.saveSession())
        .catch((e) => {
            console.error('[ImageImage2ImageWorkspace] Failed to persist image session:', e)
        })
}

const runVariant = async (
    id: TestVariantId,
    opts?: {
        silentSuccess?: boolean
        silentError?: boolean
        persist?: boolean
        allowParallel?: boolean
    },
): Promise<boolean> => {
    if (variantRunning[id]) return false

    const request = getVariantRequest(id)
    if (!request) return false

    variantRunning[id] = true
    try {
        try {
            await validateImage2ImageRequest(request)
        } catch (e) {
            if (!opts?.silentError) {
                toast.error(getI18nErrorMessage(e, t('imageWorkspace.generation.validationFailed')))
            }
            return false
        }

        const res = await generateImage2Image(request)
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

    const results = await Promise.all(
        ids.map((id) => runVariant(id, { silentSuccess: true, silentError: true, persist: false })),
    )

    queueSessionSave()

    if (results.every(Boolean)) {
        toast.success(t('imageWorkspace.generation.generationCompleted'))
    } else {
        toast.error(t('imageWorkspace.generation.generateFailed'))
    }
}

// 评估处理器（图像模式专用：testResults 不参与）
const evaluationHandler = useEvaluationHandler({
    services,
    originalPrompt,
    optimizedPrompt,
    testContent: computed(() => ''),
    testResults: ref<TestResultsData | null>(null),
    evaluationModelKey: selectedTextModelKey,
    functionMode: computed(() => 'image'),
    subMode: computed(() => 'image2image'),
    persistedResults: toRef(session, 'evaluationResults'),
})

// 提供评估上下文给 PromptPanel（子模式私有；结果持久化在 session store）
provideEvaluation(evaluationHandler.evaluation)

const { evaluation } = evaluationHandler
const panelProps = evaluationHandler.panelProps

const handleApplyImprovement = (payload: { improvement: string }) => {
    evaluation.closePanel()
    promptPanelRef.value?.openIterateDialog?.(payload.improvement)
}

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
                  metadata: {
                      optimizationMode: 'user' as OptimizationMode,
                      functionMode: 'image',
                      localEdit: true,
                      localEditSource: 'manual',
                      imageModelKey: selectedImageModelKey.value,
                      hasInputImage: !!inputImageB64.value,
                      compareMode: isCompareMode.value,
                  },
              })
            : await historyManager.value.createNewChain({
                  id: uuidv4(),
                  originalPrompt: originalPrompt.value,
                  optimizedPrompt: newPrompt,
                  type: 'image2imageOptimize' as PromptRecordType,
                  modelKey,
                  templateId,
                  timestamp: Date.now(),
                  metadata: {
                      optimizationMode: 'user' as OptimizationMode,
                      functionMode: 'image',
                      localEdit: true,
                      localEditSource: 'manual',
                      imageModelKey: selectedImageModelKey.value,
                      hasInputImage: !!inputImageB64.value,
                      compareMode: isCompareMode.value,
                  },
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

        window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
        toast.success(t('toast.success.localEditSaved'))
    } catch (e) {
        console.error('[ImageImage2ImageWorkspace] Failed to save local edit:', e)
        toast.warning(t('toast.warning.saveHistoryFailed'))
    }
}

const handleClearEvaluation = () => {
    evaluation.closePanel()
    evaluation.clearAllResults()
}

// PromptPanel 引用，用于在语言切换后刷新迭代模板选择
const promptPanelRef = ref<InstanceType<typeof PromptPanelUI> | null>(null);

// 输入区折叠状态（初始展开）
const isInputPanelCollapsed = ref(false);

// 提示词摘要（折叠态显示）
const promptSummary = computed(() => {
    if (!originalPrompt.value) return '';
    return originalPrompt.value.length > 50
        ? originalPrompt.value.slice(0, 50) + '...'
        : originalPrompt.value;
});

/** 是否正在执行分析 */
const isAnalyzing = ref(false);

/**
 * 处理分析操作
 */
const handleAnalyze = async () => {
    if (!originalPrompt.value?.trim()) return;
    if (isOptimizing.value) return;

    isAnalyzing.value = true;

    // 1. 清空版本链，创建虚拟 V0
    const virtualV0Id = uuidv4()
    const virtualV0: PromptRecordChain['versions'][number] = {
        id: virtualV0Id,
        chainId: '',
        version: 0,
        originalPrompt: originalPrompt.value,
        optimizedPrompt: originalPrompt.value,
        type: 'imageOptimize',
        timestamp: Date.now(),
        modelKey: '',
        templateId: '',
    }

    currentChainId.value = ''
    currentVersions.value = [virtualV0]
    currentVersionId.value = virtualV0Id
    optimizedPrompt.value = originalPrompt.value
    session.updateOptimizedResult({
        optimizedPrompt: originalPrompt.value,
        reasoning: '',
        chainId: '',
        versionId: '',
    })

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

// 弹窗状态
const showUploadModal = ref(false);

// 弹窗相关方法
const openUploadModal = () => {
    showUploadModal.value = true;
};

// 文件上传处理
interface ImageUploadChangePayload {
    file: UploadFileInfo | null | undefined
    fileList: UploadFileInfo[]
    event?: Event
}

const handleUploadChange = async (data: ImageUploadChangePayload) => {
    const fileEntry = data.file ?? null
    const file = fileEntry?.file ?? null

    if (!file) {
        session.updateInputImage(null, '')
        uploadStatus.value = 'idle'
        uploadProgress.value = 0
        return
    }

    // 验证文件类型
    if (!/image\/(png|jpeg)/.test(file.type)) {
        toast.error(t('imageWorkspace.upload.fileTypeNotSupported'))
        uploadStatus.value = 'error'
        return
    }

    // 验证文件大小
    if (file.size > 10 * 1024 * 1024) {
        toast.error(t('imageWorkspace.upload.fileTooLarge'))
        uploadStatus.value = 'error'
        return
    }

    uploadStatus.value = 'uploading'
    uploadProgress.value = 0

    const reader = new FileReader()

    reader.onload = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1]
        session.updateInputImage(base64, file.type)
        uploadStatus.value = 'success'
        uploadProgress.value = 100
        toast.success(t('imageWorkspace.upload.uploadSuccess'))
    }

    reader.onerror = () => {
        toast.error(t('imageWorkspace.upload.readFailed'))
        uploadStatus.value = 'error'
    }

    reader.onprogress = e => {
        if (e.lengthComputable) {
            uploadProgress.value = Math.round((e.loaded / e.total) * 100)
        }
    }

    reader.readAsDataURL(file)
}

// 弹窗中的上传处理
const handleModalUploadChange = (data: ImageUploadChangePayload) => {
    // 复用原有的上传逻辑
    handleUploadChange(data);
    // 上传成功后关闭弹窗
    if (data?.file && data.file.status === "finished") {
        setTimeout(() => {
            showUploadModal.value = false;
        }, 1000);
    }
};

// 清除上传的图片 - 通过重新触发上传变更来清除
const clearUploadedImage = () => {
    // 调用上传变更处理器，传入空数据来清除图片
    handleUploadChange({ file: null, fileList: [] });
};

// 处理收藏保存请求 - 调用 App.vue 提供的统一接口
const handleSaveFavorite = (data: {
    content: string;
    originalContent?: string;
}) => {
    console.log("[ImageImage2ImageWorkspace] handleSaveFavorite triggered:", data);

    if (appHandleSaveFavorite) {
        appHandleSaveFavorite(data);
    } else {
        console.warn(
            "[ImageImage2ImageWorkspace] handleSaveFavorite not available from App.vue",
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
        "[ImageImage2ImageWorkspace] handleRestoreFavorite triggered:",
        event.detail,
    );
    const { content } = event.detail as RestoreFavoriteDetail;

    // 设置原始提示词
    originalPrompt.value = content;

    console.log("[ImageImage2ImageWorkspace] Favorite restored successfully");
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
    if (detail?.imageMode !== "image2image") return;

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
        "[ImageImage2ImageWorkspace] Favorite restore event listener registered immediately on component creation",
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
            return
        }

        const current = selectedImageModelKey.value
        const exists = imageModels.value.some(m => m.id === current)
        if (!exists) {
            selectedImageModelKey.value = imageModels.value[0]?.id || ''
        }
    } catch (e) {
        console.error('[ImageImage2ImageWorkspace] Failed to refresh image models:', e)
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
            type: 'image2imageOptimize' as PromptRecordType,
            modelKey: selectedTextModelKey.value,
            templateId: selectedTemplate.value.id,
            timestamp: Date.now(),
            metadata: {
                optimizationMode: 'user' as OptimizationMode,
                functionMode: 'image',
                imageModelKey: selectedImageModelKey.value,
                hasInputImage: !!inputImageB64.value,
                compareMode: isCompareMode.value,
            },
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

        window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
    } catch (e) {
        console.error('[ImageImage2ImageWorkspace] Failed to create history record:', e)
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
        console.error('[ImageImage2ImageWorkspace] Missing iterate dependencies')
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
                            })
                            currentVersions.value = updatedChain.versions
                            currentVersionId.value = updatedChain.currentRecord.id
                            session.updateOptimizedResult({
                                optimizedPrompt: optimizedPrompt.value,
                                reasoning: optimizedReasoning.value,
                                chainId: updatedChain.chainId,
                                versionId: updatedChain.currentRecord.id,
                            })
                            window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
                        } else {
                            await createHistoryRecord()
                        }
                        toast.success(t('toast.success.iterateComplete'))
                    } catch (e) {
                        console.error('[ImageImage2ImageWorkspace] Failed to persist iteration:', e)
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
const downloadImageFromResult = async (imageItem: ImageResultItem | null | undefined, prefix: string) => {
    if (!imageItem) return

    if (imageItem.url) {
        try {
            const response = await fetch(imageItem.url)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${prefix}-image.png`
            a.click()
            window.URL.revokeObjectURL(url)
        } catch {
            toast.error(t('imageWorkspace.results.downloadFailed'))
        }
        return
    }

    if (imageItem.b64) {
        const a = document.createElement('a')
        const mime = imageItem.mimeType ?? 'image/png'
        a.href = `data:${mime};base64,${imageItem.b64}`
        a.download = `${prefix}-image.png`
        a.click()
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
        console.error('[ImageImage2ImageWorkspace] Failed to initialize:', e)
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
            "[ImageImage2ImageWorkspace] Failed to refresh text models after manager close:",
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
            "[ImageImage2ImageWorkspace] Failed to refresh image models after manager close:",
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
            "[ImageImage2ImageWorkspace] Failed to refresh template list after manager close:",
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
    console.log("[ImageImage2ImageWorkspace] Starting initialization...");
    console.log("[ImageImage2ImageWorkspace] Services available:", !!services?.value);
    try {
        await initialize();
        console.log("[ImageImage2ImageWorkspace] Initialization completed successfully");
    } catch (error) {
        console.error("[ImageImage2ImageWorkspace] Initialization failed:", error);
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
    console.log("[ImageImage2ImageWorkspace] Cleaning up...");
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
/* 缩略图容器样式 */
.thumbnail-container {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.thumbnail-container :deep(.n-image) {
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.thumbnail-container :deep(.n-image:hover) {
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.image-image2image-workspace {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.image-image2image-split {
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
    flex: 0 1 260px;
    max-width: 260px;
    min-width: 0;
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
