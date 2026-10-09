<template>
  <div class="image-multiimage-workspace" data-testid="workspace" data-mode="image-multiimage">
    <div class="workspace-page-tools">
      <WorkspaceUtilityMenu
          :disabled="optimizing || isIterating || isAnyVariantRunning"
          :source="resolveSourceAssetRef(session.origin, session.assetBinding)"
          test-id="image-multiimage-workspace-utility-menu"
          @clear="handleClearContent"
        />
    </div>
    <div
      ref="splitRootRef"
      class="image-multiimage-split"
      :style="{ gridTemplateColumns: `${mainSplitLeftPct}% 12px 1fr` }"
    >
      <div class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
        <NFlex
          vertical
          size="medium"
          :style="{ overflow: 'auto', height: '100%', minHeight: 0 }"
        >
          <TestSourceLinkedCard
            :style="{ flexShrink: 0 }"
            :feedback-key="sourceAreaFeedback.original.key"
            :feedback-tone="sourceAreaFeedback.original.tone"
            :source-tone="sourceAreaFeedback.original.sourceTone"
          >
            <NFlex
              v-if="isInputPanelCollapsed"
              justify="space-between"
              align="center"
            >
              <NFlex align="center" :size="8">
                <NText :depth="1" style="font-size: 18px; font-weight: 500;">
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
                :title="t('common.expand')"
                @click="isInputPanelCollapsed = false"
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

            <NSpace v-else vertical :size="16">
              <NFlex justify="space-between" align="center" :wrap="false">
                <NText :depth="1" style="font-size: 18px; font-weight: 500;">
                  {{ t('imageWorkspace.input.originalPrompt') }}
                </NText>
                <NFlex align="center" :size="8">
                  <NButton
                    type="tertiary"
                    size="small"
                    ghost
                    round
                    :title="t('common.expand')"
                    @click="openFullscreen"
                  >
                    <template #icon>
                      <NIcon>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </NIcon>
                    </template>
                  </NButton>
                  <NButton
                    type="tertiary"
                    size="small"
                    ghost
                    round
                    :title="t('common.collapse')"
                    @click="isInputPanelCollapsed = true"
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

              <VariableAwareInput
                v-if="variableInputData"
                data-testid="image-multiimage-input"
                :model-value="originalPrompt"
                :readonly="optimizing || isIterating"
                :placeholder="t('imageWorkspace.input.multiImagePromptPlaceholder')"
                :autosize="{ minRows: 4, maxRows: 12 }"
                clearable
                show-count
                v-bind="variableInputData"
                @update:model-value="handleOriginalPromptInput"
                @variable-extracted="handleVariableExtracted"
                @add-missing-variable="handleAddMissingVariable"
              />
              <NInput
                v-else
                :value="originalPrompt"
                type="textarea"
                data-testid="image-multiimage-input"
                :placeholder="t('imageWorkspace.input.multiImagePromptPlaceholder')"
                :autosize="{ minRows: 4, maxRows: 12 }"
                clearable
                show-count
                :disabled="optimizing || isIterating"
                @update:value="handleOriginalPromptInput"
              />

              <NSpace vertical :size="8">
                <NText :depth="2" style="font-size: 14px; font-weight: 500;">
                  {{ t('imageWorkspace.input.image') }}
                </NText>

                <input
                  ref="fileInputRef"
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  class="hidden-input"
                  @change="handleFilesSelected"
                />

                <div class="image-card-list" data-testid="image-multiimage-card-list">
                  <div
                    v-for="(item, index) in session.inputImages"
                    :key="item.id"
                    class="image-card"
                    :class="{
                      'image-card--dragging': draggingImageIndex === index,
                      'image-card--drop-target': dragOverImageIndex === index,
                    }"
                    :data-testid="`image-multiimage-card-${index + 1}`"
                    @dragover.prevent="handleImageDragOver(index)"
                    @dragleave="handleImageDragLeave(index)"
                    @drop.prevent="handleImageDrop(index)"
                  >
                    <div class="image-card__preview-wrap">
                      <NButton
                        class="image-card__remove"
                        quaternary
                        circle
                        size="small"
                        type="error"
                        :aria-label="t('imageWorkspace.input.removeImageAriaLabel', { index: index + 1 })"
                        :title="t('imageWorkspace.input.removeImageAriaLabel', { index: index + 1 })"
                        @mousedown.stop
                        @click.stop="removeImage(item.id)"
                      >
                        <template #icon>
                          <NIcon class="image-card__remove-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </NIcon>
                        </template>
                      </NButton>
                      <AppPreviewImage
                        class="image-card__preview"
                        :src="toDataUrl(item)"
                        :alt="t('imageWorkspace.input.imageAlt', { index: index + 1 })"
                        object-fit="cover"
                      />
                    </div>
                    <div
                      class="image-card__footer"
                      draggable="true"
                      :title="t('imageWorkspace.input.reorderImageAriaLabel', { index: index + 1 })"
                      :aria-label="t('imageWorkspace.input.reorderImageAriaLabel', { index: index + 1 })"
                      @click.stop
                      @mousedown.stop
                      @dragstart="handleImageDragStart(index, $event)"
                      @dragend="handleImageDragEnd"
                    >
                      <NText strong class="image-card__label">{{ t('imageWorkspace.input.imageLabel', { index: index + 1 }) }}</NText>
                      <span class="image-card__drag-handle" aria-hidden="true">⋮⋮</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    class="image-upload-card"
                    :class="{ 'image-upload-card--drop-target': dragOverUploadCard }"
                    data-testid="image-multiimage-upload-card"
                    @click="triggerUpload"
                    @dragover.prevent="handleUploadCardDragOver"
                    @dragleave="handleUploadCardDragLeave"
                    @drop.prevent="handleUploadCardDrop"
                  >
                    <span class="image-upload-card__icon">+</span>
                    <span class="image-upload-card__text">{{ t("imageWorkspace.input.selectImage") }}</span>
                  </button>
                </div>

                <NText depth="3">{{ imageInputHint }}</NText>
              </NSpace>

              <NGrid :cols="24" :x-gap="8" responsive="screen">
                <NGridItem :span="7" :xs="24" :sm="7">
                  <NSpace vertical :size="8">
                    <NFlex align="center" :size="6" :wrap="false">
                      <NText :depth="2" style="font-size: 14px; font-weight: 500; flex-shrink: 0;">
                        {{ t('imageWorkspace.input.textModel') }}
                      </NText>
                      <TextModelQuickSwitch
                        :model-key="selectedTextModelKey"
                        :options="textModelOptions"
                        :refresh-models="modelSelection.refreshTextModels"
                        :disabled="optimizing || isIterating"
                      />
                    </NFlex>
                    <SelectWithConfig
                      data-testid="image-multiimage-text-model-select"
                      v-model="selectedTextModelKey"
                      :options="textModelOptions"
                      :getPrimary="OptionAccessors.getPrimary"
                      :getSecondary="OptionAccessors.getSecondary"
                      :getValue="OptionAccessors.getValue"
                      :placeholder="t('imageWorkspace.input.modelPlaceholder')"
                      size="medium"
                      :disabled="optimizing || isIterating"
                      filterable
                      :show-config-action="!!appOpenModelManager"
                      :show-empty-config-c-t-a="true"
                      @focus="handleTextModelSelectFocus"
                      @config="() => appOpenModelManager && appOpenModelManager('text')"
                    />
                  </NSpace>
                </NGridItem>

                <NGridItem :span="11" :xs="24" :sm="11">
                  <NSpace vertical :size="8">
                    <NText :depth="2" style="font-size: 14px; font-weight: 500;">
                      {{ t('imageWorkspace.input.optimizeTemplate') }}
                    </NText>
                    <SelectWithConfig
                      data-testid="image-multiimage-template-select"
                      v-model="selectedTemplateIdForSelect"
                      :options="templateOptions"
                      :getPrimary="OptionAccessors.getPrimary"
                      :getSecondary="OptionAccessors.getSecondary"
                      :getValue="OptionAccessors.getValue"
                      :placeholder="t('imageWorkspace.input.templatePlaceholder')"
                      size="medium"
                      :disabled="optimizing || isIterating"
                      filterable
                      :show-config-action="!!appOpenTemplateManager"
                      :show-empty-config-c-t-a="true"
                      @focus="handleTemplateSelectFocus"
                      @config="() => onOpenTemplateManager('multiimageOptimize')"
                    />
                  </NSpace>
                </NGridItem>

                <NGridItem :span="6" :xs="24" :sm="6" class="flex items-end justify-end">
                  <NSpace :size="8">
                    <NButton
                      type="default"
                      size="medium"
                      data-testid="image-multiimage-analyze-button"
                      :loading="isAnalyzing"
                      :disabled="isAnalyzing || optimizing || isIterating || !originalPrompt.trim()"
                      @click="handleAnalyzePrompt"
                    >
                      {{ isAnalyzing ? t('promptOptimizer.analyzing') : t('promptOptimizer.analyze') }}
                    </NButton>
                    <NButton
                      type="primary"
                      size="medium"
                      data-testid="image-multiimage-optimize"
                      :loading="optimizing"
                      :disabled="isAnalyzing || optimizing || isIterating || !canOptimize"
                      @click="optimizePrompt"
                    >
                      {{ optimizing ? t('imageWorkspace.input.optimizing') : t('common.optimize') }}
                    </NButton>
                  </NSpace>
                </NGridItem>
              </NGrid>
            </NSpace>
          </TestSourceLinkedCard>

          <TestSourceLinkedCard
            :style="{ flex: 1, minHeight: '200px', overflow: 'hidden' }"
            content-style="height: 100%; max-height: 100%; overflow: hidden;"
            :feedback-key="sourceAreaFeedback.workspace.key"
            :feedback-tone="sourceAreaFeedback.workspace.tone"
            :source-tone="sourceAreaFeedback.workspace.sourceTone"
          >
            <PromptPanelUI
              v-if="services && services.templateManager"
              test-id="image-multiimage"
              ref="promptPanelRef"
              v-model:optimized-prompt="optimizedPrompt"
              :reasoning="optimizedReasoning"
              :original-prompt="originalPrompt"
              :is-optimizing="optimizing"
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

      <div ref="testPaneRef" class="split-pane" style="min-width: 0; height: 100%; overflow: hidden;">
        <NFlex vertical :style="{ height: '100%', gap: '12px' }">
          <TemporaryVariablesPanel
            :manager="temporaryVariablePanelManager"
            :disabled="optimizing || isAnyVariantRunning"
            :show-generate-values="true"
            :is-generating="isGenerating"
            @generate-values="handleGenerateValues"
          />

          <NCard size="small" :style="{ flexShrink: 0 }">
            <div class="test-area-top">
              <NFlex align="center" :size="8" :wrap="false">
                <NText :depth="2" class="test-area-label">{{ t('test.layout.columns') }}：</NText>
                <NRadioGroup v-model:value="testColumnCountModel" size="small" :disabled="isAnyVariantRunning">
                  <NRadioButton :value="2" data-testid="image-multiimage-columns-2">2</NRadioButton>
                  <NRadioButton :value="3" data-testid="image-multiimage-columns-3">3</NRadioButton>
                  <NRadioButton :value="4" :disabled="!canUseFourColumns" data-testid="image-multiimage-columns-4">4</NRadioButton>
                </NRadioGroup>
              </NFlex>

              <NButton
                type="primary"
                size="small"
                :loading="isAnyVariantRunning"
                :disabled="isAnyVariantRunning"
                data-testid="image-multiimage-test-run-all"
                @click="runAllVariants"
              >
                {{ t('test.layout.runAll') }}
              </NButton>
            </div>
          </NCard>

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
                      :refresh-models="refreshImageModelsHandler"
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
                        @focus="refreshImageModelsHandler"
                        @config="() => appOpenModelManager && appOpenModelManager('image')"
                        style="min-width: 0; width: 100%;"
                      />
                      <NText
                        v-if="shouldShowVariantModelWarning(id)"
                        class="variant-cell__support"
                        type="error"
                        :depth="2"
                      >
                        {{ getVariantModelSupportState(id).message }}
                      </NText>
                    </div>

                    <div class="variant-cell__run">
                      <ThemedTooltip :label="getVariantRunTooltip(id)">
                        <span class="variant-cell__run-trigger">
                          <NButton
                            type="primary"
                            size="small"
                            circle
                            :loading="variantRunning[id]"
                            :disabled="variantRunning[id] || isVariantModelUnsupported(id)"
                            :data-testid="getVariantRunTestId(id)"
                            @click="runVariant(id)"
                          >
                            <template #icon>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </template>
                          </NButton>
                        </span>
                      </ThemedTooltip>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </NCard>

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
                          sub-mode-key="image-multiimage"
                          :variant-id="id"
                          :content="optimizedPrompt || originalPrompt"
                          :original-content="originalPrompt"
                          function-mode="image"
                          image-sub-mode="multiimage"
                          :disabled="variantRunning[id]"
                          :test-id="`save-test-example-image-multiimage-${id}`"
                        />
                      </NFlex>
                      <AppPreviewImage
                        v-if="getVariantResult(id)?.images?.[0]"
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
                      <NCard v-if="getVariantResult(id)?.text" size="small" :title="t('imageWorkspace.results.textOutput')">
                        <NText :depth="2" style="white-space: pre-wrap; line-height: 1.5;">{{ getVariantResult(id)?.text }}</NText>
                      </NCard>

                      <ImageTokenUsage
                        :metadata="getVariantResult(id)?.metadata"
                        :image="getVariantResult(id)?.images?.[0]"
                        :input-images-info="getVariantInputImagesInfo(id)"
                      />

                      <NSpace justify="center" :size="8">
                        <NButton size="small" :disabled="!getVariantResult(id)?.images?.[0]" @click="downloadImageFromResult(getVariantResult(id)?.images?.[0])">
                          <template #icon>
                            <NIcon>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                              </svg>
                            </NIcon>
                          </template>
                          {{ t('imageWorkspace.results.download') }}
                        </NButton>
                        <NButton v-if="getVariantResult(id)?.text" size="small" secondary @click="copyImageText(String(getVariantResult(id)?.text || ''))">
                          <template #icon>
                            <NIcon>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                  <NEmpty v-else :description="t('imageWorkspace.results.noGenerationResult')" style="padding: 24px 12px;" />
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

    <FullscreenDialog
      v-model="isFullscreen"
      :title="t('imageWorkspace.input.originalPrompt')"
    >
      <NInput
        v-model:value="fullscreenValue"
        type="textarea"
        :placeholder="t('imageWorkspace.input.multiImagePromptPlaceholder')"
        :autosize="false"
        style="height: 100%; min-height: 0;"
        clearable
        show-count
        :disabled="optimizing"
      />
    </FullscreenDialog>

    <VariableValuePreviewDialog
      v-model:show="showPreviewDialog"
      :result="generationResult"
      @confirm="confirmBatchApply"
    />

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
import { computed, inject, nextTick, onMounted, onUnmounted, reactive, ref, watch, toRef, type Ref } from 'vue'
import { NButton, NCard, NEmpty, NFlex, NGrid, NGridItem, NIcon, NInput, NRadioButton, NRadioGroup, NSpace, NText } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import {
  applyPatchOperationsToText,
  type ContextMode,
  type ImageInputRef,
  type ImageModelConfig,
  type ImageResult,
  type ImageResultItem,
  type MultiImageGenerationRequest,
  type OptimizationMode,
  type PatchOperation,
  type PromptRecordChain,
  type PromptRecordType,
  type Template,
} from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'
import { useImageMultiImageSession, type TestColumnCount, type TestPanelVersionValue, type TestVariantId } from '../../stores/session/useImageMultiImageSession'
import { useImageGeneration } from '../../composables/image/useImageGeneration'
import { useImageInputPreparation } from '../../composables/image/useImageInputPreparation'
import { useTemporaryVariables } from '../../composables/variable/useTemporaryVariables'
import { useTestVariableManager } from '../../composables/variable/useTestVariableManager'
import { useVariableAwareInputBridge } from '../../composables/variable/useVariableAwareInputBridge'
import { useSmartVariableValueGeneration } from '../../composables/variable/useSmartVariableValueGeneration'
import { useToast } from '../../composables/ui/useToast'
import { useFullscreen } from '../../composables/ui/useFullscreen'
import { useEvaluationHandler } from '../../composables/prompt/useEvaluationHandler'
import { provideEvaluation } from '../../composables/prompt/useEvaluationContext'
import { useTestSourceAreaFeedback } from '../../composables/prompt/useTestSourceAreaFeedback'
import { useTestVariantSourceFeedback } from '../../composables/prompt/useTestVariantSourceFeedback'
import { useFunctionModelManager } from '../../composables/model'
import { useWorkspaceTextModelSelection } from '../../composables/workspaces/useWorkspaceTextModelSelection'
import { useWorkspaceTemplateSelection } from '../../composables/workspaces/useWorkspaceTemplateSelection'
import { useElementSize } from '@vueuse/core'
import { useLocalPromptPreviewPanel } from '../../composables/prompt/useLocalPromptPreviewPanel'
import { buildPromptExecutionContext } from '../../utils/prompt-variables'
import { runTasksWithExecutionMode } from '../../utils/runTasksSequentially'
import { buildTestPanelVersionOptions, resolveTestPanelVersionSelection } from '../../utils/testPanelVersion'
import { buildMultiImageVariantFingerprint } from '../../utils/multiimage-workspace'
import { downloadImageSource } from '../../utils/image-download'
import { getI18nErrorMessage } from '../../utils/error'
import { withHistorySourceBindingMetadata } from '../../utils/history-source-binding'
import { createImagePromptAnalysisVersion } from '../../utils/imagePromptAnalysis'
import { resolveSourceAssetRef } from '../../utils/source-asset'
import { OptionAccessors } from '../../utils/data-transformer'
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager'
import PromptPanelUI from '../PromptPanel.vue'
import PromptPreviewPanel from '../PromptPreviewPanel.vue'
import ImageModelQuickSwitch from '../ImageModelQuickSwitch.vue'
import SelectWithConfig from '../SelectWithConfig.vue'
import TextModelQuickSwitch from '../TextModelQuickSwitch.vue'
import TestSourceLinkedCard from '../TestSourceLinkedCard.vue'
import TestVariantSourceTag from '../TestVariantSourceTag.vue'
import FullscreenDialog from '../FullscreenDialog.vue'
import AppPreviewImage from '../media/AppPreviewImage.vue'
import { VariableAwareInput } from '../variable-extraction'
import TemporaryVariablesPanel from '../variable/TemporaryVariablesPanel.vue'
import WorkspaceUtilityMenu from '../common/WorkspaceUtilityMenu.vue'
import ThemedTooltip from '../common/ThemedTooltip.vue'
import VariableValuePreviewDialog from '../variable/VariableValuePreviewDialog.vue'
import TestPanelVersionSelect from '../TestPanelVersionSelect.vue'
import ImageTokenUsage from './ImageTokenUsage.vue'
import SaveTestResultExampleButton from '../SaveTestResultExampleButton.vue'
import { EvaluationPanel } from '../evaluation'

const { t } = useI18n()
const toast = useToast()
const { prepareInputRefs: prepareImageInputRefs } = useImageInputPreparation()
const services = inject<Ref<AppServices | null>>('services', ref(null))
const variableManager = inject<VariableManagerHooks | null>('variableManager', null)
const session = useImageMultiImageSession()
const tempVarsManager = useTemporaryVariables()
const { imageModels, isImageModelListReady, loadImageModels, generateMultiImage, validateMultiImageRequest } = useImageGeneration()

interface VariantInputImageInfo {
  width?: number
  height?: number
  mimeType?: string
}

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
  logPrefix: 'ImageMultiImageWorkspace',
})

const fileInputRef = ref<HTMLInputElement | null>(null)
const optimizing = ref(false)
const isAnalyzing = ref(false)
const isIterating = ref(false)
const splitRootRef = ref<HTMLElement | null>(null)
const testPaneRef = ref<HTMLElement | null>(null)
const promptPanelRef = ref<InstanceType<typeof PromptPanelUI> | null>(null)
const currentChainId = ref('')
const currentVersions = ref<PromptRecordChain['versions']>([])
const currentVersionId = ref('')
const variantRunning = reactive<Record<TestVariantId, boolean>>({ a: false, b: false, c: false, d: false })

const { variantSourceFeedback, pulseVariantSource } =
  useTestVariantSourceFeedback<TestVariantId>(['a', 'b', 'c', 'd'])
const { sourceAreaFeedback, pulseSourceAreaForSelection } =
  useTestSourceAreaFeedback()

const temporaryVariablePanelManager = useTestVariableManager({
  globalVariables: computed(() => variableManager?.customVariables.value || {}),
  predefinedVariables: purePredefinedVariables,
  temporaryVariables: computed(() => tempVarsManager.temporaryVariables.value),
  onVariableChange: (name, value) => tempVarsManager.setVariable(name, value),
  onVariableRemove: (name) => tempVarsManager.deleteVariable(name),
  onVariablesClear: () => tempVarsManager.clearAll(),
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

const historyManager = computed(() => services.value?.historyManager)
const promptService = computed(() => services.value?.promptService)

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

const modelSelection = useWorkspaceTextModelSelection(services, session)
const selectedTextModelKey = modelSelection.selectedTextModelKey
const textModelOptions = modelSelection.textModelOptions
const functionModelManager = useFunctionModelManager(services)

const templateSelection = useWorkspaceTemplateSelection(
  services,
  session,
  'multiimageOptimize',
  'imageIterate',
)
const selectedTemplate = templateSelection.selectedTemplate
const templateOptions = templateSelection.templateOptions
const selectedTemplateId = templateSelection.selectedTemplateId

const evaluationHandler = useEvaluationHandler({
  services,
  analysisOptimizedPrompt: computed(() => optimizedPrompt.value || ''),
  analysisTargetResolver: (defaultTarget) => ({
    ...defaultTarget,
    referencePrompt: (originalPrompt.value || '').trim() || undefined,
  }),
  evaluationModelKey: computed(() => selectedTextModelKey.value || ''),
  resolveEvaluationModelKey: async () => {
    await functionModelManager.initialize()
    return functionModelManager.resolveEvaluationModelKey(selectedTextModelKey.value)
  },
  functionMode: computed(() => 'image'),
  subMode: computed(() => 'multiimage'),
  persistedResults: toRef(session, 'evaluationResults'),
})

provideEvaluation(evaluationHandler.evaluation)

const { evaluation, handleEvaluate: handleEvaluateInternal } = evaluationHandler
const panelProps = evaluationHandler.panelProps

const activeEvaluationStale = computed(() => false)
const activeEvaluationStaleMessage = computed(() => t('evaluation.stale.promptOnly'))
const activeEvaluationDisableEvaluate = computed(() =>
  panelProps.value.currentType === 'prompt-only' &&
  !optimizedPrompt.value.trim(),
)
const activeEvaluationDisableReason = computed(() => '')

const handleAnalyzePrompt = async () => {
  const prompt = originalPrompt.value.trim()
  if (!prompt || isAnalyzing.value) return

  isAnalyzing.value = true
  try {
    const virtualV0 = createImagePromptAnalysisVersion(
      prompt,
      'multiimageOptimize' as PromptRecordType,
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

const handleReEvaluateActive = async () => {
  if (!evaluation.state.activeDetail) return
  await evaluationHandler.handleReEvaluate()
}

const handleEvaluateActiveWithFeedback = async (payload: { feedback: string }) => {
  if (!evaluation.state.activeDetail) return
  await evaluationHandler.handleEvaluateActiveWithFeedback(payload.feedback)
}

const handleClearEvaluation = () => {
  evaluation.closePanel()
  evaluation.clearAllResults()
}

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

const selectedIterateTemplate = computed<Template | null>({
  get: () => templateSelection.selectedIterateTemplate.value,
  set: (template) => {
    templateSelection.selectedIterateTemplateId.value = template?.id ?? ''
    templateSelection.selectedIterateTemplate.value = template ?? null
  },
})

const optimizationMode = 'user' as OptimizationMode
const advancedModeEnabled = false

const selectedTemplateIdForSelect = computed<string>({
  get() {
    const id = selectedTemplateId.value || ''
    if (!id) return ''
    const existsInList = (templateOptions.value || []).some((opt) => opt.value === id)
    return existsInList ? id : ''
  },
  set(id: string) {
    selectedTemplateId.value = id || ''
  },
})

const promptSummary = computed(() => {
  if (!originalPrompt.value) return ''
  return originalPrompt.value.length > 50
    ? `${originalPrompt.value.slice(0, 50)}...`
    : originalPrompt.value
})

const isInputPanelCollapsed = ref(false)

const { isFullscreen, fullscreenValue, openFullscreen } = useFullscreen(
  computed(() => originalPrompt.value),
  (value) => {
    originalPrompt.value = value
  },
)

const variantResults = computed(() => session.testVariantResults as Record<TestVariantId, ImageResult | null>)
const variantLastRunFingerprint = computed(() => session.testVariantLastRunFingerprint as Record<TestVariantId, string>)
void variantLastRunFingerprint.value

const imageModelOptions = computed(() =>
  imageModels.value.map((config) => ({
    label: `${config.name} (${config.provider?.name || config.providerId})`,
    primary: config.name,
    secondary: [
      config.provider?.name || config.providerId || 'Unknown',
      config.model?.name || config.modelId || '',
    ]
      .filter(Boolean)
      .join(' · '),
    value: config.id,
    raw: config,
    supportsMultiImage: !!config.model?.capabilities?.multiImage,
  })),
)

const mergedGenerationVariables = computed<Record<string, string>>(() => ({
  ...(variableManager?.customVariables.value || {}),
  ...tempVarsManager.temporaryVariables.value,
}))

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

const canOptimize = computed(() =>
  session.inputImages.length >= 2 &&
  !!originalPrompt.value.trim() &&
  !!selectedTextModelKey.value.trim() &&
  !!selectedTemplate.value,
)
const imageInputHint = computed(() => {
  if (session.inputImages.length >= 2) {
    return t('imageWorkspace.input.multiImageHint')
  }
  if (session.inputImages.length === 1) {
    return t('imageWorkspace.input.multiImageMinHint')
  }
  return t('imageWorkspace.input.multiImageReadyHint')
})
const testColumnCountModel = computed<TestColumnCount>({
  get: () => (session.layout.testColumnCount === 3 || session.layout.testColumnCount === 4 ? session.layout.testColumnCount : 2),
  set: (value) => session.setTestColumnCount(value),
})

const ALL_VARIANT_IDS: TestVariantId[] = ['a', 'b', 'c', 'd']
const activeVariantIds = computed(() => ALL_VARIANT_IDS.slice(0, testColumnCountModel.value))
const useStackedVariantControls = computed(() => activeVariantIds.value.length >= 2)
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
const isAnyVariantRunning = computed(() => activeVariantIds.value.some((id) => variantRunning[id]))

const createVariantVersionModel = (id: TestVariantId) =>
  computed<TestPanelVersionValue>({
    get: () => session.testVariants.find((item) => item.id === id)?.version ?? 'workspace',
    set: (value) => session.updateTestVariant(id, { version: value }),
  })

const createVariantModelKeyModel = (id: TestVariantId) =>
  computed<string>({
    get: () => session.testVariants.find((item) => item.id === id)?.modelKey ?? '',
    set: (value) => session.updateTestVariant(id, { modelKey: value }),
  })

const variantVersionModels = { a: createVariantVersionModel('a'), b: createVariantVersionModel('b'), c: createVariantVersionModel('c'), d: createVariantVersionModel('d') } as const
const variantModelKeyModels = { a: createVariantModelKeyModel('a'), b: createVariantModelKeyModel('b'), c: createVariantModelKeyModel('c'), d: createVariantModelKeyModel('d') } as const

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

const imageModelConfigMap = computed(() => {
  const map = new Map<string, ImageModelConfig>()
  for (const config of imageModels.value) {
    map.set(config.id, config)
  }
  return map
})

const getVariantModelConfig = (id: TestVariantId) => {
  const modelKey = (variantModelKeyModels[id].value || '').trim()
  return modelKey ? imageModelConfigMap.value.get(modelKey) ?? null : null
}

const getVariantModelSupportState = (id: TestVariantId) => {
  const config = getVariantModelConfig(id)
  if (!config) {
    return { supported: true, message: '' }
  }

  return config.model?.capabilities?.multiImage
    ? {
        supported: true,
        message: '',
      }
    : {
        supported: false,
        message: t('imageWorkspace.generation.multiImageUnsupported'),
      }
}

const isVariantModelUnsupported = (id: TestVariantId) =>
  !!(variantModelKeyModels[id].value || '').trim() && !getVariantModelSupportState(id).supported

const shouldShowVariantModelWarning = (id: TestVariantId) => isVariantModelUnsupported(id)

const getVariantRunTooltip = (id: TestVariantId) => {
  const supportState = getVariantModelSupportState(id)
  if (!supportState.supported) {
    return supportState.message
  }
  return t('test.layout.runThisColumn')
}

const getVariantVersionTestId = (id: TestVariantId) => {
  if (id === 'a') return 'image-multiimage-test-original-version-select'
  if (id === 'b') return 'image-multiimage-test-optimized-version-select'
  return `image-multiimage-test-variant-${id}-version-select`
}

const getVariantModelTestId = (id: TestVariantId) => {
  if (id === 'a') return 'image-multiimage-test-original-model-select'
  if (id === 'b') return 'image-multiimage-test-optimized-model-select'
  return `image-multiimage-test-variant-${id}-model-select`
}

const getVariantRunTestId = (id: TestVariantId) => `image-multiimage-test-run-${id}`

const getVariantImageTestId = (id: TestVariantId) => {
  if (id === 'a') return 'image-multiimage-original-image'
  if (id === 'b') return 'image-multiimage-optimized-image'
  return `image-multiimage-variant-${id}-image`
}

const toPositiveNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }
  return undefined
}

const hasInputImageInfo = (value: VariantInputImageInfo | null): value is VariantInputImageInfo =>
  !!value && Object.keys(value).length > 0

const getVariantResult = (id: TestVariantId) => variantResults.value[id]
const getVariantInputImagesInfo = (id: TestVariantId): VariantInputImageInfo[] => {
  const metadata = getVariantResult(id)?.metadata
  const rawInfo = metadata?.inputImagesInfo
  if (!Array.isArray(rawInfo)) return []

  const infos: VariantInputImageInfo[] = []
  for (const item of rawInfo) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const width = toPositiveNumber(record.width)
    const height = toPositiveNumber(record.height)
    const mimeType =
      typeof record.mimeType === 'string' && record.mimeType.trim()
        ? record.mimeType
        : undefined

    if (width == null && height == null && !mimeType) {
      continue
    }

    infos.push({
      width,
      height,
      mimeType,
    })
  }

  return infos
}

const getTestPanelVersionLabels = () => ({
    workspace: t('test.layout.workspace'),
    previous: t('test.layout.previous'),
    original: t('test.layout.original'),
})

const versionOptions = computed(() =>
  buildTestPanelVersionOptions(currentVersions.value || [], getTestPanelVersionLabels(), {
    currentVersionId: currentVersionId.value,
    workspacePrompt: session.optimizedPrompt || '',
    originalPrompt: session.originalPrompt || '',
  }),
)

watch(
  () => imageModelOptions.value,
  (options) => {
    if (!isImageModelListReady.value) return
    const validKeys = new Set(options.map((item) => item.value))
    const seed = options.find((item) => item.supportsMultiImage)?.value || options[0]?.value || ''
    for (const id of ALL_VARIANT_IDS) {
      const current = variantModelKeyModels[id].value
      if (!current || !validKeys.has(current)) {
        session.updateTestVariant(id, { modelKey: seed })
      }
    }
  },
  { immediate: true },
)

let sessionSaveChain: Promise<void> = Promise.resolve()
const queueSessionSave = () => {
  sessionSaveChain = sessionSaveChain.then(() => session.saveSession()).catch((error) => {
    console.error('[ImageMultiImageWorkspace] Failed to persist image session:', error)
  })
  return sessionSaveChain
}

const saveSessionAfterHistoryCommit = async (reason: string) => {
  try {
    await session.saveSession()
  } catch (error) {
    console.error(`[ImageMultiImageWorkspace] Failed to persist image session after ${reason}:`, error)
    toast.warning(t('toast.warning.saveHistoryFailed'))
  }
}

watch(
  () => session.layout,
  () => {
    queueSessionSave()
  },
  { deep: true },
)

const clampLeftPct = (pct: number) => Math.min(50, Math.max(25, pct))
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

const handleSplitPointerMove = (event: PointerEvent) => {
  const root = splitRootRef.value
  if (!root) return

  const rect = root.getBoundingClientRect()
  if (!rect.width) return

  const deltaX = event.clientX - dragStartX
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

const onSplitPointerDown = (event: PointerEvent) => {
  if (!splitRootRef.value) return

  dragStartX = event.clientX
  dragStartPct = mainSplitLeftPct.value
  isDraggingSplit.value = true

  document.addEventListener('pointermove', handleSplitPointerMove)
  document.addEventListener('pointerup', endSplitDrag)
  document.addEventListener('pointercancel', endSplitDrag)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const onSplitKeydown = (event: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return

  event.preventDefault()
  if (event.key === 'Home') {
    mainSplitLeftPct.value = 25
  } else if (event.key === 'End') {
    mainSplitLeftPct.value = 50
  } else {
    const delta = event.key === 'ArrowLeft' ? -1 : 1
    mainSplitLeftPct.value = clampLeftPct(mainSplitLeftPct.value + delta)
  }

  session.setMainSplitLeftPct(mainSplitLeftPct.value)
}

const toDataUrl = (item: Pick<ImageInputRef, 'b64' | 'mimeType'>) => `data:${item.mimeType || 'image/png'};base64,${item.b64}`
const draggingImageIndex = ref<number | null>(null)
const dragOverImageIndex = ref<number | null>(null)
const dragOverUploadCard = ref(false)

const triggerUpload = () => fileInputRef.value?.click()

const handleFilesSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (files.length === 0) return
  try {
    const payloads = await prepareImageInputRefs(files)
    if (!payloads) return
    for (const payload of payloads) {
      await session.addInputImage(payload)
    }
    await session.saveSession()
  } finally {
    input.value = ''
  }
}

const resetDragState = () => {
  draggingImageIndex.value = null
  dragOverImageIndex.value = null
  dragOverUploadCard.value = false
}

const removeImage = async (id: string) => {
  session.removeInputImage(id)
  await session.saveSession()
}

const reorderImages = async (fromIndex: number, toIndex: number) => {
  if (fromIndex === toIndex) return
  if (fromIndex < 0 || toIndex < 0) return
  if (fromIndex >= session.inputImages.length || toIndex >= session.inputImages.length) return
  session.reorderInputImages(fromIndex, toIndex)
  await session.saveSession()
}

const handleImageDragStart = (index: number, event: DragEvent) => {
  draggingImageIndex.value = index
  dragOverImageIndex.value = index
  dragOverUploadCard.value = false
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleImageDragEnd = () => {
  resetDragState()
}

const handleImageDragOver = (index: number) => {
  if (draggingImageIndex.value === null) return
  dragOverImageIndex.value = index
  dragOverUploadCard.value = false
}

const handleImageDragLeave = (index: number) => {
  if (dragOverImageIndex.value === index) {
    dragOverImageIndex.value = null
  }
}

const handleImageDrop = async (index: number) => {
  const fromIndex = draggingImageIndex.value
  resetDragState()
  if (fromIndex === null) return
  await reorderImages(fromIndex, index)
}

const handleUploadCardDragOver = () => {
  if (draggingImageIndex.value === null) return
  dragOverImageIndex.value = null
  dragOverUploadCard.value = true
}

const handleUploadCardDragLeave = () => {
  dragOverUploadCard.value = false
}

const handleUploadCardDrop = async () => {
  const fromIndex = draggingImageIndex.value
  const lastIndex = session.inputImages.length - 1
  resetDragState()
  if (fromIndex === null || lastIndex < 0) return
  await reorderImages(fromIndex, lastIndex)
}

const handleOriginalPromptInput = (value: string) => {
  originalPrompt.value = value
}

const getImageDimensionsFromSource = (src: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }
    image.onerror = () => reject(new Error('Failed to resolve image dimensions'))
    image.src = src
  })

const createVariantInputImagesInfo = async (
  inputImages: MultiImageGenerationRequest['inputImages'],
): Promise<VariantInputImageInfo[]> => {
  const infos = await Promise.all(
    inputImages.map(async (inputImage) => {
      const mimeType = inputImage.mimeType || 'image/png'
      try {
        const { width, height } = await getImageDimensionsFromSource(
          `data:${mimeType};base64,${inputImage.b64}`,
        )
        return { width, height, mimeType }
      } catch (error) {
        console.warn(
          '[ImageMultiImageWorkspace] Failed to resolve input image metadata for variant result:',
          error,
        )
        return mimeType ? { mimeType } : null
      }
    }),
  )

  const normalized: VariantInputImageInfo[] = []
  for (const item of infos) {
    if (item && hasInputImageInfo(item)) {
      normalized.push(item)
    }
  }
  return normalized
}

const withVariantInputImagesInfo = (
  result: ImageResult,
  inputImagesInfo: VariantInputImageInfo[],
): ImageResult => {
  if (inputImagesInfo.length === 0) {
    return result
  }

  return {
    ...result,
    metadata: {
      ...(result.metadata || {}),
      inputImagesInfo,
    } as NonNullable<ImageResult['metadata']>,
  }
}

const createRecordId = () => {
  const maybeCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined
  return maybeCrypto?.randomUUID ? maybeCrypto.randomUUID() : `multiimage-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const createHistoryRecord = async () => {
  if (!selectedTemplate.value || !historyManager.value) return

  const chain = await historyManager.value.createNewChain({
    id: createRecordId(),
    originalPrompt: originalPrompt.value,
    optimizedPrompt: optimizedPrompt.value,
    type: 'multiimageOptimize' as PromptRecordType,
    modelKey: selectedTextModelKey.value,
    templateId: selectedTemplate.value.id,
    timestamp: Date.now(),
    metadata: withHistorySourceBindingMetadata({
      optimizationMode: 'user' as OptimizationMode,
      functionMode: 'image',
      imageModelKey: session.selectedImageModelKey,
      inputImageCount: session.inputImages.length,
      compareMode: session.isCompareMode,
    }, session),
  })

  currentChainId.value = chain.chainId
  currentVersions.value = chain.versions
  currentVersionId.value = chain.currentRecord.id
  session.updateOptimizedResult({
    optimizedPrompt: optimizedPrompt.value,
    reasoning: optimizedReasoning.value,
    chainId: chain.chainId,
    versionId: chain.currentRecord.id,
  })
  await saveSessionAfterHistoryCommit('optimization commit')
}

const optimizePrompt = async () => {
  if (!promptService.value || !selectedTemplate.value) return

  optimizing.value = true
  optimizedPrompt.value = ''
  optimizedReasoning.value = ''

  try {
    const request = {
      optimizationMode: 'user' as OptimizationMode,
      targetPrompt: originalPrompt.value,
      templateId: selectedTemplate.value.id,
      modelKey: selectedTextModelKey.value,
      inputImages: session.inputImages.map(({ b64, mimeType }) => ({ b64, mimeType })),
    }

    await promptService.value.optimizePromptStream(request, {
      onToken: (token) => {
        optimizedPrompt.value = `${optimizedPrompt.value || ''}${token}`
      },
      onReasoningToken: (token) => {
        optimizedReasoning.value = `${optimizedReasoning.value || ''}${token}`
      },
      onComplete: async () => {
        try {
          await createHistoryRecord()
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
          }
        } catch (error) {
          console.error('[ImageMultiImageWorkspace] Failed to persist optimization history:', error)
          toast.warning(t('toast.warning.saveHistoryFailed'))
        }
      },
      onError: (error: Error) => {
        throw error
      },
    })

    await session.saveSession()
    toast.success(t('toast.success.optimizeSuccess'))
  } catch (error) {
    console.error('[ImageMultiImageWorkspace] optimize failed:', error)
    toast.error(getI18nErrorMessage(error, t('toast.error.optimizeFailed')))
  } finally {
    optimizing.value = false
  }
}

const handleIteratePrompt = async (payload: {
  originalPrompt: string
  optimizedPrompt: string
  iterateInput: string
}) => {
  if (!selectedIterateTemplate.value || !promptService.value) {
    console.error('[ImageMultiImageWorkspace] Missing iterate dependencies')
    return
  }

  isIterating.value = true
  const previousOptimizedPrompt = optimizedPrompt.value

  optimizedPrompt.value = ''
  optimizedReasoning.value = ''

  try {
    await promptService.value.iteratePromptStream(
      payload.originalPrompt,
      payload.optimizedPrompt,
      payload.iterateInput,
      selectedTextModelKey.value,
      {
        onToken: (token) => {
          optimizedPrompt.value = `${optimizedPrompt.value}${token}`
        },
        onReasoningToken: (token) => {
          optimizedReasoning.value = `${optimizedReasoning.value}${token}`
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
                metadata: withHistorySourceBindingMetadata({
                  optimizationMode: 'user' as OptimizationMode,
                  functionMode: 'image',
                  imageModelKey: session.selectedImageModelKey,
                  inputImageCount: session.inputImages.length,
                  compareMode: session.isCompareMode,
                }, session),
              })
              currentChainId.value = updatedChain.chainId
              currentVersions.value = updatedChain.versions
              currentVersionId.value = updatedChain.currentRecord.id
              session.updateOptimizedResult({
                optimizedPrompt: optimizedPrompt.value,
                reasoning: optimizedReasoning.value,
                chainId: updatedChain.chainId,
                versionId: updatedChain.currentRecord.id,
              })
              await saveSessionAfterHistoryCommit('iteration commit')
            } else {
              await createHistoryRecord()
            }

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
            }
            toast.success(t('toast.success.iterateComplete'))
          } catch (error) {
            console.error('[ImageMultiImageWorkspace] Failed to persist iteration:', error)
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

const handleSwitchVersion = async (version: PromptRecordChain['versions'][number]) => {
  optimizedPrompt.value = version.optimizedPrompt || ''
  currentVersionId.value = version.id
  session.updateOptimizedResult({
    optimizedPrompt: version.optimizedPrompt || '',
    reasoning: optimizedReasoning.value || '',
    chainId: currentChainId.value || session.chainId || '',
    versionId: version.id || '',
  })
  await nextTick()
}

const handleSaveLocalEdit = async (payload: { note?: string }) => {
  if (!historyManager.value) {
    toast.error(t('toast.error.historyUnavailable'))
    return
  }

  const newPrompt = optimizedPrompt.value || ''
  if (!newPrompt.trim()) return

  try {
    const chainId = currentChainId.value || session.chainId || ''
    const currentRecord = currentVersions.value.find((version) => version.id === currentVersionId.value)
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
            imageModelKey: session.selectedImageModelKey,
            inputImageCount: session.inputImages.length,
            compareMode: session.isCompareMode,
          }, session),
        })
      : await historyManager.value.createNewChain({
          id: createRecordId(),
          originalPrompt: originalPrompt.value,
          optimizedPrompt: newPrompt,
          type: 'multiimageOptimize' as PromptRecordType,
          modelKey,
          templateId,
          timestamp: Date.now(),
          metadata: withHistorySourceBindingMetadata({
            optimizationMode: 'user' as OptimizationMode,
            functionMode: 'image',
            localEdit: true,
            localEditSource: 'manual',
            imageModelKey: session.selectedImageModelKey,
            inputImageCount: session.inputImages.length,
            compareMode: session.isCompareMode,
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

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('prompt-optimizer:history-refresh'))
    }
    toast.success(t('toast.success.localEditSaved'))
  } catch (error) {
    console.error('[ImageMultiImageWorkspace] Failed to save local edit:', error)
    toast.warning(t('toast.warning.saveHistoryFailed'))
  }
}

const buildRuntimePredefinedVariables = (resolved: { text: string }): Record<string, string> => {
  const current = (resolved.text || '').trim()
  return {
    originalPrompt: (originalPrompt.value || '').trim(),
    lastOptimizedPrompt: (optimizedPrompt.value || '').trim(),
    currentPrompt: current,
    userQuestion: current,
  }
}

const resolvePromptForSelection = (selection: TestPanelVersionValue) =>
  resolveTestPanelVersionSelection({
    selection,
    versions: currentVersions.value || [],
    currentVersionId: currentVersionId.value,
    workspacePrompt: session.optimizedPrompt || '',
    originalPrompt: session.originalPrompt || '',
  })

const getVariantResolvedVersion = (id: TestVariantId): number =>
  resolvePromptForSelection(variantVersionModels[id].value).resolvedVersion

const getVariantRequest = (id: TestVariantId) => {
  const modelKey = (variantModelKeyModels[id].value || '').trim()
  if (!modelKey) {
    toast.error(t('imageWorkspace.generation.missingRequiredFields'))
    return null
  }
  const supportState = getVariantModelSupportState(id)
  if (!supportState.supported) {
    toast.error(supportState.message)
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
  if (!ctx.renderedContent.trim()) {
    toast.error(t('imageWorkspace.generation.missingRequiredFields'))
    return null
  }
  if (session.inputImages.length < 2) {
    toast.error(t('imageWorkspace.generation.missingRequiredFields'))
    return null
  }
  return {
    prompt: ctx.renderedContent,
    configId: modelKey,
    inputImages: session.inputImages.map(({ b64, mimeType }) => ({ b64, mimeType })),
    count: 1,
    paramOverrides: { outputMimeType: 'image/png' },
  }
}

const getVariantFingerprint = (id: TestVariantId) =>
  buildMultiImageVariantFingerprint({
    selection: variantVersionModels[id].value,
    resolvedVersion: resolvePromptForSelection(variantVersionModels[id].value).resolvedVersion,
    modelKey: (variantModelKeyModels[id].value || '').trim(),
    prompt: resolvePromptForSelection(variantVersionModels[id].value).text || '',
    variables: {
      ...mergedGenerationVariables.value,
      ...buildRuntimePredefinedVariables(resolvePromptForSelection(variantVersionModels[id].value)),
    },
    inputImages: session.inputImages.map(({ b64, mimeType }) => ({ b64, mimeType })),
  })

const runVariant = async (
  id: TestVariantId,
  opts?: {
    silentSuccess?: boolean
    silentError?: boolean
    persist?: boolean
  },
): Promise<boolean> => {
  if (variantRunning[id]) return false
  const request = getVariantRequest(id)
  if (!request) return false

  variantRunning[id] = true
  try {
    try {
      await validateMultiImageRequest(request)
    } catch (error) {
      if (!opts?.silentError) {
        toast.error(getI18nErrorMessage(error, t('imageWorkspace.generation.validationFailed')))
      }
      return false
    }

    const result = await generateMultiImage(request)
    const inputImagesInfo = await createVariantInputImagesInfo(request.inputImages)
    session.updateTestVariantResult(id, withVariantInputImagesInfo(result, inputImagesInfo))
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

  const results = await runTasksWithExecutionMode(
    ids,
    async (id) => runVariant(id, { silentSuccess: true, silentError: true, persist: false }),
  )

  queueSessionSave()

  if (results.every(Boolean)) {
    toast.success(t('imageWorkspace.generation.generationCompleted'))
  } else {
    toast.error(t('imageWorkspace.generation.generateFailed'))
  }
}

const hasVariantResult = (id: TestVariantId) => Boolean(getVariantResult(id)?.images?.length || getVariantResult(id)?.text)
const getImageSrc = (imageItem: ImageResultItem | null | undefined) => imageItem?.url || (imageItem?.b64 ? `data:${imageItem.mimeType || 'image/png'};base64,${imageItem.b64}` : '')

const downloadImageFromResult = async (imageItem: ImageResultItem | null | undefined) => {
  if (!imageItem) return
  const downloaded = await downloadImageSource(getImageSrc(imageItem), { mimeType: imageItem.mimeType ?? null })
  if (!downloaded) toast.error(t('imageWorkspace.results.downloadFailed'))
}

const copyImageText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(t('imageWorkspace.results.copySuccess'))
  } catch (error) {
    console.error('[ImageMultiImageWorkspace] Failed to copy text:', error)
    toast.error(t('imageWorkspace.results.copyError'))
  }
}

type TemplateEntryType =
  | 'optimize'
  | 'userOptimize'
  | 'iterate'
  | 'contextIterate'
  | 'text2imageOptimize'
  | 'image2imageOptimize'
  | 'multiimageOptimize'
  | 'imageIterate'

const appOpenTemplateManager = inject<((type?: TemplateEntryType) => void) | null>('openTemplateManager', null)
const appOpenModelManager = inject<((tab?: 'text' | 'image' | 'function') => void) | null>('openModelManager', null)
const appHandleSaveFavorite = inject<((data: { content: string; originalContent?: string }) => void) | null>('handleSaveFavorite', null)

const onOpenTemplateManager = (type: TemplateEntryType) => {
  const target: TemplateEntryType =
    type === 'iterate' || type === 'contextIterate' ? 'imageIterate' : type
  appOpenTemplateManager?.(target)
}

const handleSaveFavorite = (data: { content: string; originalContent?: string }) => {
  if (appHandleSaveFavorite) {
    appHandleSaveFavorite(data)
  } else {
    console.warn('[ImageMultiImageWorkspace] handleSaveFavorite not available from App.vue')
  }
}

const handleClearContent = () => {
  currentChainId.value = ''
  currentVersions.value = []
  currentVersionId.value = ''
  session.clearContent()
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

const handleRestoreFavorite = (event: Event) => {
  if (!(event instanceof CustomEvent)) return
  const detail = event.detail as { content?: string; imageSubMode?: string; metadata?: Record<string, unknown> }
  if (detail.imageSubMode !== 'multiimage') return
  currentChainId.value = ''
  currentVersions.value = []
  currentVersionId.value = ''
  session.replaceInputImages([])
  session.updatePrompt(detail.content || '')
  session.updateOptimizedResult({ optimizedPrompt: '', reasoning: '', chainId: '', versionId: '' })
  session.updateOriginalImageResult(null)
  session.updateOptimizedImageResult(null)
  if (typeof detail.metadata?.templateId === 'string') session.updateTemplate(detail.metadata.templateId)
  if (typeof detail.metadata?.modelKey === 'string') session.updateTextModel(detail.metadata.modelKey)
}

const handleRestoreHistory = (event: Event) => {
  if (!(event instanceof CustomEvent)) return
  const detail = event.detail as { imageMode?: string; versions?: unknown; currentVersionId?: unknown; originalPrompt?: unknown; optimizedPrompt?: unknown; chainId?: unknown; templateId?: unknown }
  if (detail.imageMode !== 'multiimage') return
  const versions = Array.isArray(detail.versions) ? (detail.versions as PromptRecordChain['versions']) : []
  const requestedVersionId = typeof detail.currentVersionId === 'string' ? detail.currentVersionId : ''
  const record = (requestedVersionId && versions.find((version) => version.id === requestedVersionId)) || versions[versions.length - 1] || null
  currentChainId.value = typeof detail.chainId === 'string' ? detail.chainId : ''
  currentVersions.value = versions
  currentVersionId.value = record?.id || requestedVersionId || ''
  session.replaceInputImages([])
  session.updatePrompt(record?.originalPrompt || (typeof detail.originalPrompt === 'string' ? detail.originalPrompt : ''))
  session.updateOptimizedResult({
    optimizedPrompt: record?.optimizedPrompt || (typeof detail.optimizedPrompt === 'string' ? detail.optimizedPrompt : ''),
    reasoning: '',
    chainId: currentChainId.value,
    versionId: currentVersionId.value,
  })
  session.updateOriginalImageResult(null)
  session.updateOptimizedImageResult(null)
  if (record?.modelKey) session.updateTextModel(record.modelKey)
  if (record?.templateId) session.updateTemplate(record.templateId)
  else if (typeof detail.templateId === 'string') session.updateTemplate(detail.templateId)
}

// Register restore listeners immediately to avoid missing events during mode switching.
if (typeof window !== 'undefined') {
  window.addEventListener('image-workspace-restore-favorite', handleRestoreFavorite as EventListener)
  window.addEventListener('image-workspace-restore', handleRestoreHistory as EventListener)
}

const initialize = async () => {
  try {
    await modelSelection.refreshTextModels()
    await loadImageModels()
    await templateSelection.refreshOptimizeTemplates()
    await templateSelection.refreshIterateTemplates()
  } catch (error) {
    console.error('[ImageMultiImageWorkspace] Failed to initialize:', error)
  }
}

const refreshIterateHandler = async () => {
  await templateSelection.refreshIterateTemplates()
  promptPanelRef.value?.refreshIterateTemplateSelect?.()
}

const refreshTextModelsHandler = async () => {
  try {
    await modelSelection.refreshTextModels()
  } catch (error) {
    console.warn('[ImageMultiImageWorkspace] Failed to refresh text models after manager close:', error)
  }
}

const refreshImageModelsHandler = async () => {
  try {
    await loadImageModels()
  } catch (error) {
    console.warn('[ImageMultiImageWorkspace] Failed to refresh image models after manager close:', error)
  }
}

const refreshTemplatesHandler = async () => {
  try {
    await templateSelection.refreshOptimizeTemplates()
    await templateSelection.refreshIterateTemplates()
    await nextTick()
    promptPanelRef.value?.refreshIterateTemplateSelect?.()
  } catch (error) {
    console.warn('[ImageMultiImageWorkspace] Failed to refresh template list after manager close:', error)
  }
}

const handleTemplateSelectFocus = async () => {
  await refreshTemplatesHandler()
}

const handleTextModelSelectFocus = async () => {
  await refreshTextModelsHandler()
}

onMounted(async () => {
  await initialize()

  if (typeof window !== 'undefined') {
    window.addEventListener('image-workspace-refresh-iterate-select', refreshIterateHandler)
    window.addEventListener('image-workspace-refresh-text-models', refreshTextModelsHandler)
    window.addEventListener('image-workspace-refresh-image-models', refreshImageModelsHandler)
    window.addEventListener('image-workspace-refresh-templates', refreshTemplatesHandler)
  }

  await templateSelection.refreshOptimizeTemplates()
  await templateSelection.refreshIterateTemplates()
})

onUnmounted(() => {
  endSplitDrag()
  if (typeof window !== 'undefined') {
    window.removeEventListener('image-workspace-refresh-iterate-select', refreshIterateHandler)
    window.removeEventListener('image-workspace-refresh-text-models', refreshTextModelsHandler)
    window.removeEventListener('image-workspace-refresh-image-models', refreshImageModelsHandler)
    window.removeEventListener('image-workspace-refresh-templates', refreshTemplatesHandler)
    window.removeEventListener('image-workspace-restore-favorite', handleRestoreFavorite as EventListener)
    window.removeEventListener('image-workspace-restore', handleRestoreHistory as EventListener)
  }
})
</script>

<style scoped>
.image-multiimage-workspace { position: relative; height: 100%; min-height: 0; overflow: visible; }
.workspace-page-tools { display: contents; }
.image-multiimage-split { display: grid; gap: 12px; height: 100%; min-height: 0; overflow: hidden; }
.split-pane { min-height: 0; min-width: 0; overflow: hidden; }
.hidden-input { display: none; }
.image-card-list { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; overscroll-behavior-x: contain; overscroll-behavior-y: contain; touch-action: pan-y; }
.image-card { display: flex; flex-direction: column; gap: 8px; width: 116px; padding: 8px; border: 1px solid var(--n-border-color); border-radius: 14px; background: var(--n-color); transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, opacity 0.18s ease; }
.image-card:hover { border-color: var(--n-border-color-hover); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06); }
.image-card--dragging { opacity: 0.68; transform: scale(0.98); }
.image-card--drop-target { border-color: var(--n-primary-color); box-shadow: 0 0 0 2px var(--n-primary-color-suppl); }
.image-card__preview-wrap { position: relative; width: 100%; aspect-ratio: 1 / 1; border-radius: 12px; overflow: hidden; background: var(--n-color-embedded); }
.image-card__preview { width: 100%; height: 100%; display: block; }
.image-card__preview :deep(img) { -webkit-user-drag: none; user-select: none; }
.image-card__remove {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  width: 30px;
  min-width: 30px;
  height: 30px;
  border-radius: 999px;
  color: #fff;
  background: rgba(17, 24, 39, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.34);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.28);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.image-card__remove:hover,
.image-card__remove:focus-visible {
  color: #fff;
  background: rgba(220, 38, 38, 0.92);
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 10px 22px rgba(127, 29, 29, 0.36);
  transform: scale(1.05);
}
.image-card__remove-icon {
  width: 15px;
  height: 15px;
}
.image-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 32px;
  padding: 0 2px;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}
.image-card__footer:active {
  cursor: grabbing;
}
.image-card__drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 24px;
  color: var(--n-text-color-2);
  line-height: 1;
  font-size: 14px;
  letter-spacing: -1px;
}
.image-card__label { flex: 1; min-width: 0; text-align: left; }
.image-upload-card { width: 116px; min-height: 140px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px; padding: 8px; border: 1px dashed var(--n-border-color); border-radius: 14px; background: var(--n-color-embedded); color: var(--n-text-color-2); cursor: pointer; appearance: none; font: inherit; text-align: center; transition: border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease, transform 0.18s ease; }
.image-upload-card:hover { border-color: var(--n-border-color-hover); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05); transform: translateY(-1px); }
.image-upload-card:focus-visible { outline: none; border-color: var(--n-primary-color); box-shadow: 0 0 0 2px var(--n-primary-color-suppl); }
.image-upload-card--drop-target { border-color: var(--n-primary-color); box-shadow: 0 0 0 2px var(--n-primary-color-suppl); color: var(--n-primary-color); }
.image-upload-card__icon { font-size: 28px; line-height: 1; font-weight: 300; }
.image-upload-card__text { font-size: 13px; line-height: 1.4; }
.split-divider {
  cursor: col-resize;
  background: var(--n-divider-color, rgba(0, 0, 0, 0.08));
  border-radius: 999px;
  width: 12px;
  align-self: stretch;
  transition: background 120ms ease;
}
.split-divider:hover,
.split-divider:focus-visible {
  background: var(--n-primary-color, rgba(59, 130, 246, 0.5));
  outline: none;
}
.test-area-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.test-area-label { white-space: nowrap; }
.variant-deck { display: grid; gap: 12px; width: 100%; }
.variant-cell { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
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
.variant-cell__label { flex-shrink: 0; }
.variant-cell__model {
  flex: 1 1 auto;
  min-width: 0;
}
.variant-cell__support {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.35;
}
.variant-cell__run { flex-shrink: 0; }
.variant-cell__run-trigger {
  display: inline-flex;
}
.variant-results-wrap { flex: 1; min-height: 0; overflow: hidden; }
.variant-results { display: grid; gap: 12px; height: 100%; min-height: 0; }
.variant-result-card { height: 100%; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.variant-result-card :deep(.n-card__content) { height: 100%; max-height: 100%; overflow: hidden; }
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

@media (max-width: 900px) {
  .image-multiimage-split { grid-template-columns: minmax(0, 1fr) !important; }
  .split-divider { display: none; }
  .image-card-list { gap: 10px; }
  .image-card,
  .image-upload-card { width: calc(50% - 5px); min-width: 132px; }
}
</style>
