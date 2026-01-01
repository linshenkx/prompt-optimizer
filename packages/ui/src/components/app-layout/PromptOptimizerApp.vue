<template>
    <!--
        PromptOptimizerApp - 主应用组件

        职责:
        - 提供完整的 Prompt Optimizer 应用功能
        - 统一 web 和 extension 应用的核心逻辑
        - 管理所有状态、composables 和事件处理

        设计说明:
        - 从 App.vue 提取的核心逻辑
        - 减少 web/extension 应用的重复代码
    -->
    <NConfigProvider
        :theme="naiveTheme"
        :theme-overrides="themeOverrides"
        :hljs="hljsInstance"
    >
        <div v-if="isInitializing" class="loading-container">
            <div class="spinner"></div>
            <p>{{ t("log.info.initializing") }}</p>
        </div>
        <div v-else-if="!services" class="loading-container error">
            <p>{{ t("toast.error.appInitFailed") }}</p>
        </div>
        <template v-if="isReady">
            <MainLayoutUI>
                <!-- Title Slot -->
                <template #title>
                    {{ t("promptOptimizer.title") }}
                </template>

                <!-- Core Navigation Slot -->
                <template #core-nav>
                    <AppCoreNav
                        :functionMode="functionMode"
                        :basicSubMode="basicSubMode"
                        :proSubMode="proSubMode"
                        :imageSubMode="imageSubMode"
                        @update:functionMode="handleModeSelect"
                        @basic-sub-mode-change="handleBasicSubModeChange"
                        @pro-sub-mode-change="handleProSubModeChange"
                        @image-sub-mode-change="handleImageSubModeChange"
                    />
                </template>

                <!-- Actions Slot -->
                <template #actions>
                    <AppHeaderActions
                        @open-templates="openTemplateManager"
                        @open-history="historyManager.showHistory = true"
                        @open-model-manager="modelManager.showConfig = true"
                        @open-favorites="showFavoriteManager = true"
                        @open-data-manager="showDataManager = true"
                        @open-github="openGithubRepo"
                    />
                </template>
                <template #main>
                    <!-- 上下文模式：根据模式使用不同的独立组件 -->
                    <template v-if="functionMode === 'pro'">
                        <!-- 上下文-系统模式 -->
                        <ContextSystemWorkspace
                            ref="systemWorkspaceRef"
                            v-if="contextMode === 'system'"
                            :optimized-reasoning="optimizer.optimizedReasoning"
                            :optimization-mode="selectedOptimizationMode"
                            :is-optimizing="optimizer.isOptimizing"
                            :is-iterating="optimizer.isIterating"
                            :selected-iterate-template="
                                optimizer.selectedIterateTemplate
                            "
                            @update:selectedIterateTemplate="
                                optimizer.selectedIterateTemplate = $event
                            "
                            :optimization-context="optimizationContext"
                            @update:optimizationContext="
                                optimizationContext = $event
                            "
                            :tool-count="optimizationContextTools.length"
                            :global-variables="
                                variableManager?.customVariables?.value || {}
                            "
                            :predefined-variables="predefinedVariables"
                            :available-variables="
                                variableManager?.variableManager.value?.resolveAllVariables() ||
                                {}
                            "
                            :scan-variables="
                                (content) =>
                                    variableManager?.variableManager.value?.scanVariablesInContent(
                                        content,
                                    ) || []
                            "
                            :input-mode="
                                responsiveLayout.recommendedInputMode.value
                            "
                            :control-bar-layout="
                                responsiveLayout.recommendedControlBarLayout
                                    .value
                            "
                            :button-size="
                                responsiveLayout.smartButtonSize.value
                            "
                            :conversation-max-height="
                                responsiveLayout.responsiveHeights.value
                                    .conversationMax
                            "
                            :result-vertical-layout="
                                responsiveLayout.isMobile.value
                            "
                            :is-compare-mode="isCompareMode"
                            @update:isCompareMode="isCompareMode = $event"
                            @compare-toggle="handleTestAreaCompareToggle"
                            @optimize="handleOptimizePrompt"
                            @iterate="handleIteratePrompt"
                            @switchVersion="handleSwitchVersion"
                            @save-favorite="handleSaveFavorite"
                            @open-global-variables="openVariableManager()"
                            @open-variable-manager="handleOpenVariableManager"
                            @open-context-editor="handleOpenContextEditor()"
                            @open-tool-manager="handleOpenToolManager"
                            @openTemplateManager="openTemplateManager"
                            @config-model="modelManager.showConfig = true"
                            @open-input-preview="handleOpenInputPreview"
                            @open-prompt-preview="handleOpenPromptPreview"
                            :enable-message-optimization="true"
                            :selected-optimize-model="modelManager.selectedOptimizeModel"
                            :selected-template="currentSelectedTemplate"
                            :evaluation-model-key="functionModelManager.effectiveEvaluationModel.value"
                            :selected-test-model="modelManager.selectedTestModel"
                            :test-model-provider="selectedTestModelInfo?.provider"
                            :test-model-name="selectedTestModelInfo?.model"
                        >
                            <!-- 优化模型选择插槽 -->
                            <template #optimize-model-select>
                                <SelectWithConfig
                                    v-model="modelManager.selectedOptimizeModel"
                                    :options="textModelOptions"
                                    :getPrimary="OptionAccessors.getPrimary"
                                    :getSecondary="OptionAccessors.getSecondary"
                                    :getValue="OptionAccessors.getValue"
                                    :placeholder="t('model.select.placeholder')"
                                    size="medium"
                                    :disabled="optimizer.isOptimizing"
                                    filterable
                                    :show-config-action="true"
                                    :show-empty-config-c-t-a="true"
                                    @focus="refreshTextModels"
                                    @config="modelManager.showConfig = true"
                                />
                            </template>

                            <!-- 模板选择插槽 -->
                            <template #template-select>
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
                                        :placeholder="t('template.select')"
                                        size="medium"
                                        :disabled="optimizer.isOptimizing"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="refreshOptimizeTemplates"
                                        @config="
                                            handleOpenOptimizeTemplateManager
                                        "
                                    />
                                </template>
                                <NText v-else depth="3" class="p-2 text-sm">
                                    {{ t("template.loading") || "加载中..." }}
                                </NText>
                            </template>

                            <!-- 测试模型选择插槽 -->
                            <template #test-model-select>
                                <SelectWithConfig
                                    v-model="modelManager.selectedTestModel"
                                    :options="textModelOptions"
                                    :getPrimary="OptionAccessors.getPrimary"
                                    :getSecondary="OptionAccessors.getSecondary"
                                    :getValue="OptionAccessors.getValue"
                                    :placeholder="t('model.select.placeholder')"
                                    size="medium"
                                    filterable
                                    :show-config-action="true"
                                    :show-empty-config-c-t-a="true"
                                    @focus="refreshTextModels"
                                    @config="modelManager.showConfig = true"
                                />
                            </template>
                        </ContextSystemWorkspace>

                        <!-- 上下文-用户模式 -->
                        <ContextUserWorkspace
                            ref="userWorkspaceRef"
                            v-else-if="contextMode === 'user'"
                            :optimization-mode="selectedOptimizationMode"
                            :selected-optimize-model="modelManager.selectedOptimizeModel"
                            :selected-test-model="modelManager.selectedTestModel"
                            :test-model-provider="selectedTestModelInfo?.provider"
                            :test-model-name="selectedTestModelInfo?.model"
                            :evaluation-model-key="functionModelManager.effectiveEvaluationModel.value"
                            :selected-template="currentSelectedTemplate"
                            :selected-iterate-template="
                                optimizer.selectedIterateTemplate
                            "
                            @update:selectedIterateTemplate="
                                optimizer.selectedIterateTemplate = $event
                            "
                            :is-compare-mode="isCompareMode"
                            @update:isCompareMode="isCompareMode = $event"
                            :is-extracting="variableExtraction.isExtracting.value"
                            :global-variables="
                                variableManager?.customVariables?.value || {}
                            "
                            :predefined-variables="predefinedVariables"
                            @variable-change="handleTestPanelVariableChange"
                            @save-to-global="handleSaveToGlobal"
                            :control-bar-layout="
                                responsiveLayout.recommendedControlBarLayout
                                    .value
                            "
                            :button-size="
                                responsiveLayout.smartButtonSize.value
                            "
                            :conversation-max-height="
                                responsiveLayout.responsiveHeights.value
                                    .conversationMax
                            "
                            :result-vertical-layout="
                                responsiveLayout.isMobile.value
                            "
                            @compare-toggle="handleTestAreaCompareToggle"
                            @save-favorite="handleSaveFavorite"
                            @open-global-variables="openVariableManager()"
                            @open-variable-manager="handleOpenVariableManager"
                            @openTemplateManager="openTemplateManager"
                            @config-model="modelManager.showConfig = true"
                            @open-input-preview="handleOpenInputPreview"
                            @open-prompt-preview="handleOpenPromptPreview"
                            @extract-variables="handleExtractVariablesForContextUser"
                        >
                            <!-- 优化模型选择插槽 -->
                            <template #optimize-model-select>
                                <SelectWithConfig
                                    v-model="modelManager.selectedOptimizeModel"
                                    :options="textModelOptions"
                                    :getPrimary="OptionAccessors.getPrimary"
                                    :getSecondary="OptionAccessors.getSecondary"
                                    :getValue="OptionAccessors.getValue"
                                    :placeholder="t('model.select.placeholder')"
                                    size="medium"
                                    :disabled="optimizer.isOptimizing"
                                    filterable
                                    :show-config-action="true"
                                    :show-empty-config-c-t-a="true"
                                    @focus="refreshTextModels"
                                    @config="modelManager.showConfig = true"
                                />
                            </template>

                            <!-- 模板选择插槽 -->
                            <template #template-select>
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
                                        :placeholder="t('template.select')"
                                        size="medium"
                                        :disabled="optimizer.isOptimizing"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="refreshOptimizeTemplates"
                                        @config="
                                            handleOpenOptimizeTemplateManager
                                        "
                                    />
                                </template>
                                <NText v-else depth="3" class="p-2 text-sm">
                                    {{ t("template.loading") || "加载中..." }}
                                </NText>
                            </template>

                            <!-- 测试模型选择插槽 -->
                            <template #test-model-select>
                                <SelectWithConfig
                                    v-model="modelManager.selectedTestModel"
                                    :options="textModelOptions"
                                    :getPrimary="OptionAccessors.getPrimary"
                                    :getSecondary="OptionAccessors.getSecondary"
                                    :getValue="OptionAccessors.getValue"
                                    :placeholder="t('model.select.placeholder')"
                                    size="medium"
                                    filterable
                                    :show-config-action="true"
                                    :show-empty-config-c-t-a="true"
                                    @focus="refreshTextModels"
                                    @config="modelManager.showConfig = true"
                                />
                            </template>
                        </ContextUserWorkspace>
                    </template>

                    <!-- 基础模式：使用 BasicModeWorkspace 组件 -->
                    <template v-else-if="functionMode === 'basic'">
                        <BasicModeWorkspace
                            ref="basicModeWorkspaceRef"
                            :optimization-mode="selectedOptimizationMode"
                            :advanced-mode-enabled="advancedModeEnabled"
                            :prompt="optimizer.prompt"
                            @update:prompt="optimizer.prompt = $event"
                            :optimized-prompt="optimizer.optimizedPrompt"
                            @update:optimized-prompt="optimizer.optimizedPrompt = $event"
                            :optimized-reasoning="optimizer.optimizedReasoning"
                            :is-optimizing="optimizer.isOptimizing"
                            :is-iterating="optimizer.isIterating"
                            :current-versions="optimizer.currentVersions"
                            :current-version-id="optimizer.currentVersionId"
                            :selected-iterate-template="optimizer.selectedIterateTemplate"
                            @update:selectedIterateTemplate="optimizer.selectedIterateTemplate = $event"
                            :test-content="testContent"
                            @update:test-content="testContent = $event"
                            :is-compare-mode="isCompareMode"
                            @update:isCompareMode="isCompareMode = $event"
                            :original-result="testResults.originalResult"
                            :original-reasoning="testResults.originalReasoning"
                            :optimized-result="testResults.optimizedResult"
                            :test-optimized-reasoning="testResults.optimizedReasoning"
                            :is-testing-original="testResults.isTestingOriginal"
                            :is-testing-optimized="testResults.isTestingOptimized"
                            :global-variables="variableManager?.customVariables?.value || {}"
                            :predefined-variables="predefinedVariables"
                            :model-provider="selectedTestModelInfo?.provider"
                            :model-name="selectedTestModelInfo?.model"
                            :has-original-result="!!testResults.originalResult"
                            :has-optimized-result="!!testResults.optimizedResult"
                            :is-evaluating-original="evaluation.isEvaluatingOriginal.value"
                            :is-evaluating-optimized="evaluation.isEvaluatingOptimized.value"
                            :is-evaluating-compare="evaluation.isEvaluatingCompare.value"
                            :original-score="evaluation.originalScore.value"
                            :optimized-score="evaluation.optimizedScore.value"
                            :compare-score="evaluation.compareScore.value"
                            :has-original-evaluation="evaluation.hasOriginalResult.value"
                            :has-optimized-evaluation="evaluation.hasOptimizedResult.value"
                            :has-compare-evaluation="evaluation.hasCompareResult.value"
                            :original-evaluation-result="evaluation.state.original.result"
                            :optimized-evaluation-result="evaluation.state.optimized.result"
                            :compare-evaluation-result="evaluation.state.compare.result"
                            :original-score-level="evaluation.originalLevel.value"
                            :optimized-score-level="evaluation.optimizedLevel.value"
                            :compare-score-level="evaluation.compareLevel.value"
                            :input-mode="responsiveLayout.recommendedInputMode.value"
                            :control-bar-layout="responsiveLayout.recommendedControlBarLayout.value"
                            :button-size="responsiveLayout.smartButtonSize.value"
                            :conversation-max-height="responsiveLayout.responsiveHeights.value.conversationMax"
                            :result-vertical-layout="responsiveLayout.isMobile.value"
                            :analyzing="isBasicAnalyzing"
                            @optimize="handleOptimizePrompt"
                            @iterate="handleIteratePrompt"
                            @switchVersion="handleSwitchVersion"
                            @test="handleTestAreaTest"
                            @compare-toggle="handleTestAreaCompareToggle"
                            @evaluate-original="() => handleEvaluate('original')"
                            @evaluate-optimized="() => handleEvaluate('optimized')"
                            @evaluate-compare="() => handleEvaluate('compare')"
                            @evaluate-prompt-only="handleAnalyzeEvaluate"
                            @show-original-detail="() => evaluation.showDetail('original')"
                            @show-optimized-detail="() => evaluation.showDetail('optimized')"
                            @show-compare-detail="() => evaluation.showDetail('compare')"
                            @apply-improvement="handleApplyImprovement"
                            @apply-patch="handleApplyLocalPatch"
                            @save-local-edit="handleSaveLocalEdit"
                            @save-favorite="handleSaveFavorite"
                            @open-variable-manager="handleOpenVariableManager"
                            @open-input-preview="handleOpenInputPreview"
                            @open-prompt-preview="handleOpenPromptPreview"
                            @config-model="modelManager.showConfig = true"
                            @openTemplateManager="openTemplateManager"
                        >
                            <!-- 优化模型选择插槽 -->
                            <template #optimize-model-select>
                                <SelectWithConfig
                                    v-model="modelManager.selectedOptimizeModel"
                                    :options="textModelOptions"
                                    :getPrimary="OptionAccessors.getPrimary"
                                    :getSecondary="OptionAccessors.getSecondary"
                                    :getValue="OptionAccessors.getValue"
                                    :placeholder="t('model.select.placeholder')"
                                    size="medium"
                                    :disabled="optimizer.isOptimizing"
                                    filterable
                                    :show-config-action="true"
                                    :show-empty-config-c-t-a="true"
                                    @focus="refreshTextModels"
                                    @config="modelManager.showConfig = true"
                                />
                            </template>

                            <!-- 模板选择插槽 -->
                            <template #template-select>
                                <template v-if="services && services.templateManager">
                                    <SelectWithConfig
                                        v-model="selectedTemplateIdForSelect"
                                        :options="templateOptions"
                                        :getPrimary="OptionAccessors.getPrimary"
                                        :getSecondary="OptionAccessors.getSecondary"
                                        :getValue="OptionAccessors.getValue"
                                        :placeholder="t('template.select')"
                                        size="medium"
                                        :disabled="optimizer.isOptimizing"
                                        filterable
                                        :show-config-action="true"
                                        :show-empty-config-c-t-a="true"
                                        @focus="refreshOptimizeTemplates"
                                        @config="handleOpenOptimizeTemplateManager"
                                    />
                                </template>
                                <NText v-else depth="3" class="p-2 text-sm">
                                    {{ t("template.loading") || "加载中..." }}
                                </NText>
                            </template>

                            <!-- 测试模型选择插槽 -->
                            <template #test-model-select>
                                <SelectWithConfig
                                    v-model="modelManager.selectedTestModel"
                                    :options="textModelOptions"
                                    :getPrimary="OptionAccessors.getPrimary"
                                    :getSecondary="OptionAccessors.getSecondary"
                                    :getValue="OptionAccessors.getValue"
                                    :placeholder="t('model.select.placeholder')"
                                    size="medium"
                                    filterable
                                    :show-config-action="true"
                                    :show-empty-config-c-t-a="true"
                                    @focus="refreshTextModels"
                                    @config="modelManager.showConfig = true"
                                />
                            </template>
                        </BasicModeWorkspace>
                    </template>
                    <!-- 图像模式：渲染新的工作区组件，不破坏现有结构 -->
                    <template v-else>
                        <ImageWorkspace />
                    </template>
                </template>
            </MainLayoutUI>

            <!-- Modals and Drawers that are conditionally rendered -->
            <ModelManagerUI
                v-if="isReady"
                v-model:show="modelManager.showConfig"
                @update:show="
                    (v: boolean) => {
                        if (!v) handleModelManagerClosed();
                    }
                "
            />
            <TemplateManagerUI
                v-if="isReady"
                v-model:show="templateManagerState.showTemplates"
                :templateType="templateManagerState.currentType"
                @close="handleTemplateManagerClosed"
                @languageChanged="handleTemplateLanguageChanged"
            />
            <HistoryDrawerUI
                v-if="isReady"
                v-model:show="historyManager.showHistory"
                :history="promptHistory.history"
                @reuse="handleHistoryReuse"
                @clear="promptHistory.handleClearHistory"
                @deleteChain="promptHistory.handleDeleteChain"
            />
            <DataManagerUI
                v-if="isReady"
                v-model:show="showDataManager"
                @imported="handleDataImported"
            />

            <!-- 收藏管理对话框 -->
            <FavoriteManagerUI
                v-if="isReady"
                :show="showFavoriteManager"
                @update:show="
                    (v: boolean) => {
                        if (!v) showFavoriteManager = false;
                    }
                "
                @optimize-prompt="handleFavoriteOptimizePrompt"
                @use-favorite="handleUseFavorite"
            />

            <!-- 保存收藏对话框 -->
            <SaveFavoriteDialog
                v-if="isReady"
                v-model:show="showSaveFavoriteDialog"
                :content="saveFavoriteData?.content || ''"
                :original-content="saveFavoriteData?.originalContent || ''"
                :current-function-mode="functionMode"
                :current-optimization-mode="selectedOptimizationMode"
                @saved="handleSaveFavoriteComplete"
            />

            <!-- 变量管理弹窗 -->
            <VariableManagerModal
                v-if="isReady"
                v-model:visible="showVariableManager"
                :variable-manager="variableManager"
                :focus-variable="focusVariableName"
            />

            <!-- 🆕 AI 变量提取结果对话框 -->
            <VariableExtractionResultDialog
                v-if="isReady"
                v-model:show="variableExtraction.showResultDialog.value"
                :result="variableExtraction.extractionResult.value"
                @confirm="variableExtraction.confirmBatchCreate"
            />

            <!-- 工具管理弹窗 -->
            <ToolManagerModal
                v-if="isReady"
                v-model:visible="showToolManager"
                :tools="optimizationContextTools"
                @confirm="handleToolManagerConfirm"
                @cancel="showToolManager = false"
            />

            <!-- 上下文编辑器弹窗 -->
            <ContextEditor
                v-if="isReady"
                v-model:visible="showContextEditor"
                :state="contextEditorState"
                :services="servicesForContextEditor"
                :variable-manager="variableManager"
                :optimization-mode="selectedOptimizationMode"
                :scan-variables="
                    (content) =>
                        variableManager?.variableManager.value?.scanVariablesInContent(
                            content,
                        ) || []
                "
                :replace-variables="
                    (content, vars) =>
                        variableManager?.variableManager.value?.replaceVariables(
                            content,
                            vars,
                        ) || content
                "
                :defaultTab="contextEditorDefaultTab"
                :only-show-tab="contextEditorOnlyShowTab"
                :title="contextEditorTitle"
                @update:state="handleContextEditorStateUpdate"
                @save="handleContextEditorSave"
                @cancel="handleContextEditorCancel"
                @open-variable-manager="handleOpenVariableManager"
            />

            <!-- 提示词预览面板 -->
            <PromptPreviewPanel
                v-if="isReady"
                :show="showPreviewPanel"
                @update:show="showPreviewPanel = $event"
                :previewContent="promptPreview.previewContent.value"
                :missingVariables="promptPreview.missingVariables.value"
                :hasMissingVariables="promptPreview.hasMissingVariables.value"
                :variableStats="promptPreview.variableStats.value"
                :contextMode="contextMode"
                :renderPhase="renderPhase"
            />

            <!-- 评估结果面板 -->
            <EvaluationPanel
                v-if="isReady"
                v-model:show="evaluation.isPanelVisible.value"
                :is-evaluating="evaluation.state.activeDetailType ? evaluation.state[evaluation.state.activeDetailType].isEvaluating : false"
                :result="evaluation.activeResult.value"
                :stream-content="evaluation.activeStreamContent.value"
                :error="evaluation.activeError.value"
                :current-type="evaluation.state.activeDetailType"
                :score-level="evaluation.activeScoreLevel.value"
                @re-evaluate="handleReEvaluate"
                @apply-local-patch="handleApplyLocalPatch"
                @apply-improvement="handleApplyImprovement"
            />

            <!-- 关键:使用NGlobalStyle同步全局样式到body,消除CSS依赖 -->
            <NGlobalStyle />
        </template>
    </NConfigProvider>
</template>

<script setup lang="ts">
/**
 * PromptOptimizerApp - 主应用组件
 *
 * @description
 * 从 App.vue 提取的核心应用逻辑，统一 web 和 extension 应用。
 * 包含所有状态管理、composables 和事件处理。
 */
import {
    ref,
    watch,
    provide,
    computed,
    shallowRef,
    toRef,
    type Ref,
} from "vue";
import { useI18n } from "vue-i18n";
import {
    NConfigProvider,
    NGlobalStyle,
    NText,
} from "naive-ui";
import hljs from "highlight.js/lib/core";
import jsonLang from "highlight.js/lib/languages/json";
hljs.registerLanguage("json", jsonLang);

// 内部组件导入
import MainLayoutUI from '../MainLayout.vue'
import ModelManagerUI from '../ModelManager.vue'
import TemplateManagerUI from '../TemplateManager.vue'
import HistoryDrawerUI from '../HistoryDrawer.vue'
import DataManagerUI from '../DataManager.vue'
import FavoriteManagerUI from '../FavoriteManager.vue'
import SaveFavoriteDialog from '../SaveFavoriteDialog.vue'
import VariableManagerModal from '../variable/VariableManagerModal.vue'
import { VariableExtractionResultDialog } from '../variable-extraction'
import ToolManagerModal from '../tool/ToolManagerModal.vue'
import ImageWorkspace from '../image-mode/ImageWorkspace.vue'
import ContextEditor from '../context-mode/ContextEditor.vue'
import PromptPreviewPanel from '../PromptPreviewPanel.vue'
import ContextSystemWorkspace from '../context-mode/ContextSystemWorkspace.vue'
import ContextUserWorkspace from '../context-mode/ContextUserWorkspace.vue'
import BasicModeWorkspace from '../basic-mode/BasicModeWorkspace.vue'
import SelectWithConfig from '../SelectWithConfig.vue'
import AppHeaderActions from './AppHeaderActions.vue'
import AppCoreNav from './AppCoreNav.vue'
import EvaluationPanel from '../evaluation/EvaluationPanel.vue'

// Composables - 使用 barrel exports
import {
    // 提示词相关
    usePromptOptimizer,
    usePromptHistory,
    usePromptPreview,
    usePromptTester,
    // 模型相关
    useModelManager,
    useModelSelectRefs,
    useFunctionModelManager,
    // 模式相关
    useFunctionMode,
    useBasicSubMode,
    useProSubMode,
    useImageSubMode,
    // 上下文相关
    useContextManagement,
    useContextEditorUIState,
    // 变量相关
    useVariableManager,
    useAggregatedVariables,
    useVariableExtraction,
    useTemporaryVariables,
    // UI 相关
    useToast,
    useNaiveTheme,
    useResponsiveTestLayout,
    // 系统相关
    useAppInitializer,
    useHistoryManager,
    useTemplateManager,
    useEvaluationHandler,
    provideEvaluation,
    // App 级别
    useAppHistoryRestore,
    useAppFavorite,
} from '../../composables'

// i18n functions
import { initializeI18nWithStorage, setI18nServices } from '../../plugins/i18n'

// Data Transformation
import { DataTransformer, OptionAccessors } from '../../utils/data-transformer'

// Types
import type { OptimizationMode, ConversationMessage, ModelSelectOption, TemplateSelectOption, TestAreaPanelInstance } from '../../types'
import { applyPatchOperationsToText, type IPromptService, type PromptRecordChain, type PromptRecord, type PatchOperation } from "@prompt-optimizer/core";

// 1. 基础 composables
const hljsInstance = hljs;
const { t } = useI18n();
const toast = useToast();

// 2. 初始化应用服务
const { services, isInitializing } = useAppInitializer();

// 3. Initialize i18n with storage when services are ready
watch(
    services,
    async (newServices) => {
        if (newServices) {
            setI18nServices(newServices);
            await initializeI18nWithStorage();
            console.log("[PromptOptimizerApp] i18n initialized");
        }
    },
    { immediate: true },
);

// 4. 向子组件提供服务
provide("services", services);

// 5. 控制主UI渲染的标志
const isReady = computed(() => !!services.value && !isInitializing.value);

// 创建 ContextEditor 使用的 services 引用
const servicesForContextEditor = computed(() => services?.value || null);

// 6. 创建所有必要的引用
const promptService = shallowRef<IPromptService | null>(null);
const showDataManager = ref(false);

type ContextUserHistoryPayload = {
    record: PromptRecord;
    chain: PromptRecordChain;
    rootPrompt: string;
};

type ContextWorkspaceExpose = {
    testAreaPanelRef?: Ref<TestAreaPanelInstance | null>;
    restoreFromHistory?: (payload: ContextUserHistoryPayload) => void;
    openIterateDialog?: (input?: string) => void;
    applyLocalPatch?: (operation: PatchOperation) => void;
    reEvaluateActive?: () => Promise<void>;
};

const systemWorkspaceRef = ref<ContextWorkspaceExpose | null>(null);
const userWorkspaceRef = ref<ContextWorkspaceExpose | null>(null);
const basicModeWorkspaceRef = ref<{
    promptPanelRef?: {
        openIterateDialog?: (input?: string) => void;
        refreshIterateTemplateSelect?: () => void;
    } | null;
    openIterateDialog?: (input?: string) => void;
} | null>(null);

// 高级模式状态
const { functionMode, setFunctionMode } = useFunctionMode(services as any);

// 三种功能模式的子模式持久化（独立存储）
const { basicSubMode, setBasicSubMode } = useBasicSubMode(services as any);
const { proSubMode, setProSubMode } = useProSubMode(services as any);
const { imageSubMode, setImageSubMode } = useImageSubMode(services as any);

// selectedOptimizationMode 改为 computed，从对应的 subMode 动态计算
const selectedOptimizationMode = computed<OptimizationMode>(() => {
    if (functionMode.value === 'basic') return basicSubMode.value as OptimizationMode;
    if (functionMode.value === 'pro') return proSubMode.value as OptimizationMode;
    return 'system';
});

const advancedModeEnabled = computed({
    get: () => functionMode.value === "pro",
    set: (val: boolean) => {
        setFunctionMode(val ? "pro" : "basic");
    },
});

// 处理功能模式变化
const handleModeSelect = async (mode: "basic" | "pro" | "image") => {
    // 模式切换时：关闭并清理评估状态，避免跨模式残留
    evaluation.closePanel();
    evaluation.clearAllResults();

    await setFunctionMode(mode);

    if (mode === "basic") {
        const { ensureInitialized } = useBasicSubMode(services as any);
        await ensureInitialized();
    } else if (mode === "pro") {
        const { ensureInitialized } = useProSubMode(services as any);
        await ensureInitialized();
        await handleContextModeChange(
            proSubMode.value as import("@prompt-optimizer/core").ContextMode,
        );
    } else if (mode === "image") {
        const { ensureInitialized } = useImageSubMode(services as any);
        await ensureInitialized();
    }
};

// 测试内容状态
const testContent = ref("");
const isCompareMode = ref(true);

// 响应式布局
const responsiveLayout = useResponsiveTestLayout();

// Naive UI 主题配置
const { naiveTheme, themeOverrides, initTheme } = useNaiveTheme();

// 初始化主题系统
if (typeof window !== "undefined") {
    initTheme();
}

// 变量管理状态
const showVariableManager = ref(false);
const focusVariableName = ref<string | undefined>(undefined);

// 工具管理状态
const showToolManager = ref(false);

// 上下文模式
const contextMode = ref<import("@prompt-optimizer/core").ContextMode>("system");

// 上下文编辑器状态
const showContextEditor = ref(false);
const contextEditorDefaultTab = ref<"messages" | "variables" | "tools">("messages");

// 使用 composable 管理编辑器 UI 状态
const {
    onlyShowTab: contextEditorOnlyShowTab,
    title: contextEditorTitle,
    handleCancel: handleContextEditorCancel,
} = useContextEditorUIState(showContextEditor, t);

const contextEditorState = ref({
    messages: [] as ConversationMessage[],
    tools: [] as any[],
    showVariablePreview: true,
    showToolManager: false,
    mode: "edit" as "edit" | "preview",
});

// 提示词预览面板状态
const showPreviewPanel = ref(false);

// 变量管理器实例
const variableManager = useVariableManager(services as any);

// 🆕 临时变量管理器（全局单例，用于AI提取的变量）
const tempVarsManager = useTemporaryVariables();

// 🆕 AI 智能变量提取
const variableExtraction = useVariableExtraction(
    services,
    (variableName: string, variableValue: string) => {
        // 创建变量时的回调：保存到临时变量（不持久化）
        tempVarsManager.setVariable(variableName, variableValue);
    },
    (replacedPrompt: string) => {
        // 替换提示词回调：更新 ContextUser 工作区的提示词内容
        const userWorkspace = userWorkspaceRef.value as any;
        if (userWorkspace?.contextUserOptimization) {
            userWorkspace.contextUserOptimization.prompt = replacedPrompt;
        }
    }
);

// 使用聚合变量管理器
const aggregatedVariables = useAggregatedVariables(variableManager);
const promptPreviewContent = ref("");
const promptPreviewVariables = computed(() => {
    return aggregatedVariables.allVariables.value;
});

// 渲染阶段（用于预览）
const renderPhase = ref<"optimize" | "test">("optimize");

const promptPreview = usePromptPreview(
    promptPreviewContent,
    promptPreviewVariables,
    contextMode,
    renderPhase,
);

// 预览处理函数
const handleOpenInputPreview = () => {
    // 根据当前模式选择正确的提示词内容
    const isPro = advancedModeEnabled.value;
    const isUserMode = selectedOptimizationMode.value === "user";

    if (isUserMode && isPro) {
        // 上下文/变量模式：使用 ContextUser 工作区的提示词
        const userWorkspace = userWorkspaceRef.value as any;
        promptPreviewContent.value = userWorkspace?.contextUserOptimization?.prompt || "";
    } else {
        // 基础模式或其他模式：使用 optimizer 的提示词
        promptPreviewContent.value = optimizer.prompt || "";
    }

    renderPhase.value = "test";
    showPreviewPanel.value = true;
};

const handleOpenPromptPreview = () => {
    // 根据当前模式选择正确的优化后提示词内容
    const isPro = advancedModeEnabled.value;
    const isUserMode = selectedOptimizationMode.value === "user";

    if (isUserMode && isPro) {
        // 上下文/变量模式：使用 ContextUser 工作区的优化后提示词
        const userWorkspace = userWorkspaceRef.value as any;
        promptPreviewContent.value = userWorkspace?.contextUserOptimization?.optimizedPrompt || "";
    } else {
        // 基础模式或其他模式：使用 optimizer 的优化后提示词
        promptPreviewContent.value = optimizer.optimizedPrompt || "";
    }

    renderPhase.value = "test";
    showPreviewPanel.value = true;
};

const templateSelectType = computed<
    | "optimize"
    | "userOptimize"
    | "iterate"
    | "conversationMessageOptimize"
    | "contextUserOptimize"
>(() => {
    const isPro = advancedModeEnabled.value;
    if (selectedOptimizationMode.value === "system") {
        return isPro ? "conversationMessageOptimize" : "optimize";
    }
    return isPro ? "contextUserOptimize" : "userOptimize";
});

// 变量管理处理函数
const handleOpenVariableManager = (variableName?: string) => {
    if (variableName) {
        focusVariableName.value = variableName;
    }
    showVariableManager.value = true;
};

// 🆕 AI 变量提取处理函数
const handleExtractVariables = async (
    promptContent: string,
    extractionModelKey: string
) => {
    const existingVariableNames = Object.keys(
        variableManager.customVariables.value || {}
    );

    await variableExtraction.extractVariables(
        promptContent,
        extractionModelKey,
        existingVariableNames
    );
};

// 🆕 处理ContextUser模式的 AI 变量提取
const handleExtractVariablesForContextUser = async () => {
    // 从userWorkspaceRef获取提示词内容
    const userWorkspace = userWorkspaceRef.value as any;
    if (!userWorkspace?.contextUserOptimization) {
        console.error('[PromptOptimizerApp] Unable to access ContextUser workspace');
        toast.warning(t('evaluation.variableExtraction.workspaceNotReady'));
        return;
    }

    const promptContent = userWorkspace.contextUserOptimization.prompt || '';
    // 🔧 使用评估模型（复用评估功能的模型配置）
    const extractionModelKey = functionModelManager.effectiveEvaluationModel.value || '';

    if (!promptContent.trim()) {
        toast.warning(t('evaluation.variableExtraction.noPromptContent'));
        return;
    }

    if (!extractionModelKey) {
        toast.warning(t('evaluation.variableExtraction.noEvaluationModel'));
        return;
    }

    // 收集已存在的变量名（全局+临时）
    const globalVarNames = Object.keys(variableManager.customVariables.value || {});
    const tempVarNames = Object.keys(userWorkspace.temporaryVariables?.value || {});
    const existingVariableNames = [...globalVarNames, ...tempVarNames];

    await variableExtraction.extractVariables(
        promptContent,
        extractionModelKey,
        existingVariableNames
    );
};

// 工具管理器处理函数
const handleOpenToolManager = () => {
    showToolManager.value = true;
};

const handleToolManagerConfirm = (tools: any[]) => {
    optimizationContextTools.value = tools;
    showToolManager.value = false;
};

// 6. 在顶层调用所有 Composables
const modelSelectRefs = useModelSelectRefs();
const modelManager = useModelManager(services as any, modelSelectRefs);
const functionModelManager = useFunctionModelManager(
    services as any,
    computed(() => modelManager.selectedOptimizeModel),
);

// 提示词优化器
const optimizer = usePromptOptimizer(
    services as any,
    selectedOptimizationMode,
    toRef(modelManager, "selectedOptimizeModel"),
    toRef(modelManager, "selectedTestModel"),
    contextMode,
);

// 上下文管理
const contextManagement = useContextManagement({
    services,
    selectedOptimizationMode,
    advancedModeEnabled,
    showContextEditor,
    contextEditorDefaultTab,
    contextEditorState,
    variableManager,
    optimizer,
});

// 从 contextManagement 提取其他状态和方法
const optimizationContext = contextManagement.optimizationContext;
const optimizationContextTools = contextManagement.optimizationContextTools;
const predefinedVariables = contextManagement.predefinedVariables;
const initializeContextPersistence = contextManagement.initializeContextPersistence;
const handleOpenContextEditor = contextManagement.handleOpenContextEditor;
const handleContextEditorSave = contextManagement.handleContextEditorSave;
const handleContextEditorStateUpdate = contextManagement.handleContextEditorStateUpdate;
const handleContextModeChange = contextManagement.handleContextModeChange;

// 提供依赖给子组件
provide("variableManager", variableManager);
provide("optimizationContextTools", optimizationContextTools);

// 基础模式提示词测试
const promptTester = usePromptTester(
    services as any,
    toRef(modelManager, 'selectedTestModel'),
    selectedOptimizationMode,
    variableManager
);

// 测试结果引用
const testResults = computed(() => promptTester.testResults);

// 处理测试面板的变量变化
const handleTestPanelVariableChange = async (_name: string, _value: string) => {
    // 测试变量现在只在TestAreaPanel内部管理
};

// 处理保存测试变量到全局
const handleSaveToGlobal = async (name: string, value: string) => {
    if (!variableManager) {
        console.warn("[PromptOptimizerApp] variableManager not ready");
        return;
    }

    try {
        variableManager.updateVariable(name, value);
        toast.success(t('test.variables.savedToGlobal', { name }));
    } catch (error) {
        console.error("[PromptOptimizerApp] Failed to save variable to global:", error);
        toast.error(t('test.error.saveToGlobalFailed', { name }));
    }
};

// 评估功能
const currentSubMode = computed(() => {
    if (functionMode.value === 'basic') return basicSubMode.value;
    if (functionMode.value === 'pro') return proSubMode.value;
    if (functionMode.value === 'image') return imageSubMode.value;
    return 'system';
});

// 计算当前版本的迭代需求（用于 prompt-iterate 类型的重新评估）
const currentIterateRequirement = computed(() => {
    const versions = optimizer.currentVersions;
    const versionId = optimizer.currentVersionId;
    if (!versions || versions.length === 0 || !versionId) return '';
    const currentVersion = versions.find((v) => v.id === versionId);
    return currentVersion?.iterationNote || '';
});

const evaluationHandler = useEvaluationHandler({
    services: services as any,
    originalPrompt: toRef(optimizer, "prompt") as any,
    optimizedPrompt: toRef(optimizer, "optimizedPrompt") as any,
    testContent,
    testResults: testResults as any,
    evaluationModelKey: computed(() => functionModelManager.effectiveEvaluationModel.value),
    functionMode: functionMode as any,
    subMode: currentSubMode as any,
    currentIterateRequirement,
});

const { evaluation, handleEvaluate, handleReEvaluate: handleReEvaluateBasic } = evaluationHandler;

// 提供评估上下文给子组件
provideEvaluation(evaluation);

// 基础模式“分析”专用 loading（避免与普通 prompt-only 评估混用）
const isBasicAnalyzing = ref(false);

// 同步 contextManagement 中的 contextMode
watch(
    contextManagement.contextMode,
    async (newMode) => {
        // Context 子模式切换时：关闭并清理评估状态，避免残留
        evaluation.closePanel();
        evaluation.clearAllResults();

        contextMode.value = newMode;

        if (functionMode.value === "pro") {
            await setProSubMode(newMode as import("@prompt-optimizer/core").ProSubMode);
        }
    },
    { immediate: true },
);

// 提示词历史
const promptHistory = usePromptHistory(
    services as any,
    toRef(optimizer, "prompt") as any,
    toRef(optimizer, "optimizedPrompt") as any,
    toRef(optimizer, "currentChainId") as any,
    toRef(optimizer, "currentVersions") as any,
    toRef(optimizer, "currentVersionId") as any,
);

provide("promptHistory", promptHistory);

// 历史管理器
const historyManager = useHistoryManager(
    services as any,
    optimizer.prompt as any,
    optimizer.optimizedPrompt as any,
    optimizer.currentChainId as any,
    optimizer.currentVersions as any,
    optimizer.currentVersionId as any,
    promptHistory.handleSelectHistory,
    promptHistory.handleClearHistory,
    promptHistory.handleDeleteChain as any,
);

// App 级别历史记录恢复
const { handleHistoryReuse } = useAppHistoryRestore({
    services: services as any,
    functionMode,
    setFunctionMode,
    basicSubMode,
    setBasicSubMode,
    proSubMode,
    setProSubMode,
    handleContextModeChange,
    handleSelectHistory: promptHistory.handleSelectHistory,
    optimizationContext,
    systemWorkspaceRef,
    userWorkspaceRef,
    t,
});

// App 级别收藏管理
const {
    showFavoriteManager,
    showSaveFavoriteDialog,
    saveFavoriteData,
    handleSaveFavorite,
    handleSaveFavoriteComplete,
    handleFavoriteOptimizePrompt,
    handleUseFavorite,
} = useAppFavorite({
    functionMode,
    setFunctionMode,
    basicSubMode,
    setBasicSubMode,
    proSubMode,
    setProSubMode,
    handleContextModeChange,
    optimizerPrompt: toRef(optimizer, "prompt") as any,
    t,
});

provide("handleSaveFavorite", handleSaveFavorite);

// 模板管理器
const templateManagerState = useTemplateManager(services as any, {
    selectedOptimizeTemplate: toRef(optimizer, "selectedOptimizeTemplate"),
    selectedUserOptimizeTemplate: toRef(optimizer, "selectedUserOptimizeTemplate"),
    selectedIterateTemplate: toRef(optimizer, "selectedIterateTemplate"),
});

const currentSelectedTemplate = computed({
    get() {
        return selectedOptimizationMode.value === "system"
            ? optimizer.selectedOptimizeTemplate
            : optimizer.selectedUserOptimizeTemplate;
    },
    set(newValue) {
        if (!newValue) return;
        if (selectedOptimizationMode.value === "system") {
            optimizer.selectedOptimizeTemplate = newValue;
        } else {
            optimizer.selectedUserOptimizeTemplate = newValue;
        }
    },
});

const templateOptions = ref<TemplateSelectOption[]>([]);
const textModelOptions = ref<ModelSelectOption[]>([]);

const handleOpenOptimizeTemplateManager = () => {
    const type = templateSelectType.value;
    openTemplateManager(type as any);
};

const clearCurrentTemplateSelection = () => {
    if (selectedOptimizationMode.value === "system") {
        optimizer.selectedOptimizeTemplate = null;
    } else {
        optimizer.selectedUserOptimizeTemplate = null;
    }
};

const ensureTemplateSelection = () => {
    const current = currentSelectedTemplate.value;
    const available = templateOptions.value;

    if (current) {
        const matched = available.find((t) => t.raw.id === current.id);
        if (matched) {
            if (matched.raw !== current) {
                currentSelectedTemplate.value = matched.raw;
            }
            return;
        }
    }

    if (available.length > 0) {
        currentSelectedTemplate.value = available[0].raw;
    } else {
        clearCurrentTemplateSelection();
    }
};

const refreshOptimizeTemplates = async () => {
    if (!services.value?.templateManager) {
        templateOptions.value = [];
        clearCurrentTemplateSelection();
        return;
    }

    try {
        const list = await services.value.templateManager.listTemplatesByType(
            templateSelectType.value as any,
        );
        templateOptions.value = DataTransformer.templatesToSelectOptions(list || []);
    } catch (error) {
        console.warn("[PromptOptimizerApp] Failed to refresh optimize templates:", error);
        templateOptions.value = [];
    }

    ensureTemplateSelection();
};

const refreshTextModels = async () => {
    if (!services.value?.modelManager) {
        textModelOptions.value = [];
        return;
    }

    try {
        const manager = services.value.modelManager;
        if (typeof (manager as any).ensureInitialized === "function") {
            await (manager as any).ensureInitialized();
        }
        const enabledModels = await manager.getEnabledModels();
        textModelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels);

        const availableKeys = new Set(textModelOptions.value.map((opt) => opt.value));
        const fallbackValue = textModelOptions.value[0]?.value || "";
        const selectionReady = modelManager.isModelSelectionReady;

        if (fallbackValue && selectionReady) {
            if (!availableKeys.has(modelManager.selectedOptimizeModel)) {
                modelManager.selectedOptimizeModel = fallbackValue;
            }
            if (!availableKeys.has(modelManager.selectedTestModel)) {
                modelManager.selectedTestModel = fallbackValue;
            }
        }
    } catch (error) {
        console.warn("[PromptOptimizerApp] Failed to refresh text models:", error);
        textModelOptions.value = [];
    }
};

// 获取选中测试模型的详细信息
const selectedTestModelInfo = computed(() => {
    if (!modelManager.selectedTestModel) return null;
    const option = textModelOptions.value.find(
        (o) => o.value === modelManager.selectedTestModel,
    );
    if (!option?.raw) return null;
    return {
        provider: option.raw.providerMeta?.name || option.raw.providerMeta?.id || null,
        model: option.raw.modelMeta?.name || option.raw.modelMeta?.id || null,
    };
});

const selectedTemplateIdForSelect = computed<string>({
    get() {
        const current = currentSelectedTemplate.value;
        if (!current) return "";
        return templateOptions.value.some((t) => t.raw.id === current.id)
            ? current.id
            : "";
    },
    set(id: string) {
        if (!id) {
            clearCurrentTemplateSelection();
            return;
        }
        const tpl = templateOptions.value.find((t) => t.raw.id === id);
        if (tpl) {
            currentSelectedTemplate.value = tpl.raw;
        }
    },
});

watch(
    () => services.value?.templateManager,
    async (manager) => {
        if (manager) {
            await refreshOptimizeTemplates();
        } else {
            templateOptions.value = [];
            clearCurrentTemplateSelection();
        }
    },
    { immediate: true },
);

watch(
    () => services.value?.modelManager,
    async (manager) => {
        if (manager) {
            await refreshTextModels();
        } else {
            textModelOptions.value = [];
        }
    },
    { immediate: true },
);

watch(
    () => templateSelectType.value,
    async () => {
        await refreshOptimizeTemplates();
    },
);

// 7. 监听服务初始化
watch(services, async (newServices) => {
    if (!newServices) return;

    promptService.value = newServices.promptService;
    await initializeContextPersistence();

    if (functionMode.value === "basic") {
        const { ensureInitialized } = useBasicSubMode(services as any);
        await ensureInitialized();
    } else if (functionMode.value === "pro") {
        const { ensureInitialized } = useProSubMode(services as any);
        await ensureInitialized();
        await handleContextModeChange(
            proSubMode.value as import("@prompt-optimizer/core").ContextMode,
        );
    } else if (functionMode.value === "image") {
        const { ensureInitialized } = useImageSubMode(services as any);
        await ensureInitialized();
    }

    const handleGlobalHistoryRefresh = () => {
        promptHistory.initHistory();
    };
    window.addEventListener(
        "prompt-optimizer:history-refresh",
        handleGlobalHistoryRefresh,
    );
});

// 8. 处理数据导入成功后的刷新
const handleDataImported = () => {
    useToast().success(t("dataManager.import.successWithRefresh"));
    setTimeout(() => {
        window.location.reload();
    }, 1500);
};

// 处理优化提示词
const handleOptimizePrompt = () => {
    const shouldClearPromptEvaluation = (() => {
        const hasPrompt = !!optimizer.prompt?.trim();
        const hasMessages = optimizationContext.value.length > 0;
        const hasInput = advancedModeEnabled.value ? (hasPrompt || hasMessages) : hasPrompt;
        const hasTemplate = !!currentSelectedTemplate.value;
        const hasModel = !!modelManager.selectedOptimizeModel;
        return hasInput && hasTemplate && hasModel;
    })();

    // 只有在确定会发起生成时才清除旧的 prompt-only / prompt-iterate 评估结果
    if (shouldClearPromptEvaluation) {
        evaluation.clearResult('prompt-only');
        evaluation.clearResult('prompt-iterate');
    }

    if (advancedModeEnabled.value) {
        const advancedContext = {
            variables:
                variableManager?.variableManager.value?.resolveAllVariables() || {},
            messages:
                optimizationContext.value.length > 0
                    ? optimizationContext.value
                    : undefined,
            tools:
                optimizationContextTools.value.length > 0
                    ? optimizationContextTools.value
                    : undefined,
        };
        optimizer.handleOptimizePromptWithContext(advancedContext);
    } else {
        optimizer.handleOptimizePrompt();
    }
};

// 处理迭代提示词
const handleIteratePrompt = (payload: any) => {
    const shouldClearPromptEvaluation = (() => {
        const hasOriginal = !!payload?.originalPrompt?.trim?.();
        const hasOptimized = !!payload?.optimizedPrompt?.trim?.();
        const hasIterateInput = !!payload?.iterateInput?.trim?.();
        const hasTemplate = !!optimizer.selectedIterateTemplate;
        const hasModel = !!modelManager.selectedOptimizeModel;
        return hasOriginal && hasOptimized && hasIterateInput && hasTemplate && hasModel;
    })();

    // 只有在确定会发起迭代时才清除旧的 prompt-only / prompt-iterate 评估结果
    if (shouldClearPromptEvaluation) {
        evaluation.clearResult('prompt-only');
        evaluation.clearResult('prompt-iterate');
    }

    optimizer.handleIteratePrompt(payload);
};

/**
 * 基础模式"分析"入口：
 * - 清空版本链，创建 V0（与优化同级）
 * - 不写入历史（分析不产生新提示词）
 * - 触发 prompt-only 评估
 */
const handleAnalyzeEvaluate = async () => {
    const prompt = optimizer.prompt || '';
    if (!prompt.trim()) return;

    // 清空版本链，创建虚拟 V0
    optimizer.handleAnalyze();

    // 清理旧的提示词评估结果，避免跨提示词残留
    evaluation.clearResult('prompt-only');
    evaluation.clearResult('prompt-iterate');

    isBasicAnalyzing.value = true;
    try {
        await handleEvaluate('prompt-only');
    } finally {
        isBasicAnalyzing.value = false;
    }
};

const handleSaveLocalEdit = async (payload: { note?: string }) => {
    await optimizer.saveLocalEdit({
        optimizedPrompt: optimizer.optimizedPrompt || '',
        note: payload.note,
        source: 'manual',
    });
    toast.success(t('toast.success.localEditSaved'));
};

// 注：handleEvaluatePromptOnly 已移除，PromptPanel 现在直接通过 inject 的 evaluation context 调用评估方法

// 处理应用评估改进建议
const _basicApplyImprovement = evaluationHandler.createApplyImprovementHandler(basicModeWorkspaceRef);
const getActiveContextWorkspace = (): ContextWorkspaceExpose | null => {
    if (contextMode.value === 'system') return systemWorkspaceRef.value;
    if (contextMode.value === 'user') return userWorkspaceRef.value;
    return null;
};

const handleApplyImprovement = (payload: { improvement: string; type: any }) => {
    // 关闭评估面板
    evaluation.closePanel();

    if (functionMode.value === 'pro') {
        const workspace = getActiveContextWorkspace();
        if (!workspace?.openIterateDialog) {
            // 这里按产品约定属于异常：Context 模式必须可以应用改进建议
            console.error('[PromptOptimizerApp] Context apply-improvement handler missing openIterateDialog');
            toast.error(t('toast.error.optimizeProcessFailed'));
            return;
        }
        workspace.openIterateDialog(payload.improvement);
        return;
    }

    _basicApplyImprovement(payload);
};

const handleApplyLocalPatch = async (payload: { operation: PatchOperation }) => {
    if (!payload.operation) return;

    if (functionMode.value === 'pro') {
        const workspace = getActiveContextWorkspace();
        if (!workspace || typeof (workspace as any).applyLocalPatch !== 'function') {
            toast.error(t('toast.error.optimizeProcessFailed'));
            return;
        }
        (workspace as any).applyLocalPatch(payload.operation);
        return;
    }

    // basic 模式：直接覆盖当前 optimizedPrompt（不自动创建新版本）
    // 用户可通过"保存修改"按钮显式保存为新版本
    const current = optimizer.optimizedPrompt || '';
    const result = applyPatchOperationsToText(current, payload.operation);
    if (!result.ok) {
        toast.warning(t('toast.warning.patchApplyFailed'));
        console.warn('[PromptOptimizerApp] Local patch apply failed:', result.report);
        return;
    }
    optimizer.optimizedPrompt = result.text;
    toast.success(t('evaluation.diagnose.applyFix'));
};

// 处理重新评估：始终使用当前模式/工作区的最新状态
const handleReEvaluate = async (): Promise<void> => {
    if (functionMode.value === 'pro') {
        const workspace = getActiveContextWorkspace();
        if (!workspace?.reEvaluateActive) {
            // 这里按产品约定属于异常：Context 模式必须可以重新评估当前内容
            console.error('[PromptOptimizerApp] Context re-evaluate handler missing reEvaluateActive');
            toast.error(t('toast.error.optimizeProcessFailed'));
            return;
        }
        await workspace.reEvaluateActive();
        return;
    }

    await handleReEvaluateBasic();
};

// 处理切换版本
const handleSwitchVersion = (versionId: any) => {
    // 版本切换时清除 prompt-only / prompt-iterate 评估结果（内容已变更）
    evaluation.clearResult('prompt-only');
    evaluation.clearResult('prompt-iterate');
    optimizer.handleSwitchVersion(versionId);
};

// 打开变量管理器
const openVariableManager = (variableName?: string) => {
    if (variableManager?.refresh) {
        variableManager.refresh();
    }
    focusVariableName.value = variableName;
    showVariableManager.value = true;
};

// 监听变量管理器关闭
watch(showVariableManager, (newValue) => {
    if (!newValue) {
        focusVariableName.value = undefined;
    }
});

// 监听高级模式和优化模式变化
watch(
    [advancedModeEnabled, selectedOptimizationMode],
    ([newAdvancedMode, newOptimizationMode]) => {
        if (newAdvancedMode) {
            if (
                !optimizationContext.value ||
                optimizationContext.value.length === 0
            ) {
                if (newOptimizationMode === "system") {
                    optimizationContext.value = [
                        { role: "system", content: "{{currentPrompt}}" },
                        { role: "user", content: "{{userQuestion}}" },
                    ];
                } else if (newOptimizationMode === "user") {
                    optimizationContext.value = [
                        { role: "user", content: "{{currentPrompt}}" },
                    ];
                }
            }
        }
    },
    { immediate: false },
);

// 打开GitHub仓库
const openGithubRepo = async () => {
    const url = "https://github.com/linshenkx/prompt-optimizer";

    if (typeof window !== "undefined" && (window as any).electronAPI) {
        try {
            await (window as any).electronAPI.shell.openExternal(url);
        } catch (error) {
            console.error("Failed to open external URL in Electron:", error);
            window.open(url, "_blank");
        }
    } else {
        window.open(url, "_blank");
    }
};

// 打开模板管理器
const openTemplateManager = (
    templateType?:
        | "optimize"
        | "userOptimize"
        | "iterate"
        | "text2imageOptimize"
        | "image2imageOptimize"
        | "imageIterate",
) => {
    templateManagerState.currentType =
        (templateType as any) ||
        (selectedOptimizationMode.value === "system"
            ? "optimize"
            : "userOptimize");
    templateManagerState.showTemplates = true;
};

// 基础模式子模式变更处理器
const handleBasicSubModeChange = async (mode: OptimizationMode) => {
    // 子模式切换时：关闭并清理评估状态，避免残留
    evaluation.closePanel();
    evaluation.clearAllResults();
    await setBasicSubMode(mode as import("@prompt-optimizer/core").BasicSubMode);
};

// 上下文模式子模式变更处理器
const handleProSubModeChange = async (mode: OptimizationMode) => {
    // 子模式切换时：关闭并清理评估状态，避免残留
    evaluation.closePanel();
    evaluation.clearAllResults();
    await setProSubMode(mode as import("@prompt-optimizer/core").ProSubMode);

    if (services.value?.contextMode.value !== mode) {
        await handleContextModeChange(
            mode as import("@prompt-optimizer/core").ContextMode,
        );
    }
};

// 图像模式子模式变更处理器
const handleImageSubModeChange = async (
    mode: import("@prompt-optimizer/core").ImageSubMode,
) => {
    // 子模式切换时：关闭并清理评估状态，避免残留
    evaluation.closePanel();
    evaluation.clearAllResults();
    await setImageSubMode(mode);

    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent("image-submode-changed", {
                detail: { mode },
            }),
        );
    }
};

// 处理模板语言变化
const handleTemplateLanguageChanged = (_newLanguage: string) => {
    refreshOptimizeTemplates();

    // 通过 BasicModeWorkspace 访问 PromptPanel 的方法
    if (basicModeWorkspaceRef.value?.promptPanelRef?.refreshIterateTemplateSelect) {
        basicModeWorkspaceRef.value.promptPanelRef.refreshIterateTemplateSelect();
    }

    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("image-workspace-refresh-iterate-select"));
    }
};

// 向子组件提供统一的 openTemplateManager 接口
provide("openTemplateManager", openTemplateManager);

// 模板管理器关闭回调
const handleTemplateManagerClosed = () => {
    try {
        templateManagerState.handleTemplateManagerClose(() => {
            refreshOptimizeTemplates();
        });
    } catch (e) {
        console.warn("[PromptOptimizerApp] Failed to run template manager close handler:", e);
    }
    refreshOptimizeTemplates();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("image-workspace-refresh-templates"));
    }
};

// 提供 openModelManager 接口
const openModelManager = (tab: "text" | "image" | "function" = "text") => {
    modelManager.showConfig = true;
    setTimeout(() => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new CustomEvent("model-manager:set-tab", { detail: tab }),
            );
        }
    }, 0);
};
provide("openModelManager", openModelManager);

// 模型管理器关闭回调
const handleModelManagerClosed = async () => {
    try {
        modelManager.handleModelManagerClose();
    } catch (e) {
        console.warn("[PromptOptimizerApp] Failed to refresh text models after manager close:", e);
    }
    await refreshTextModels();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("image-workspace-refresh-text-models"));
        window.dispatchEvent(new Event("image-workspace-refresh-image-models"));
    }
};

// 基础模式的测试处理函数
const handleTestAreaTest = async (testVariables?: Record<string, string>) => {
    // 只清除测试相关的评估结果，保留左侧提示词评估（prompt-only/prompt-iterate）
    evaluation.clearResult('original');
    evaluation.clearResult('optimized');
    evaluation.clearResult('compare');

    await promptTester.executeTest(
        optimizer.prompt,
        optimizer.optimizedPrompt,
        testContent.value,
        isCompareMode.value,
        testVariables || {}
    );
};

const handleTestAreaCompareToggle = () => {
    // Compare mode toggle handler
};
</script>

<style scoped>
.active-button {
    background-color: var(--primary-color, #3b82f6) !important;
    color: white !important;
    border-color: var(--primary-color, #3b82f6) !important;
}

.active-button:hover {
    background-color: var(--primary-hover-color, #2563eb) !important;
    border-color: var(--primary-hover-color, #2563eb) !important;
}

.loading-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-size: 1.2rem;
    color: var(--text-color);
    background-color: var(--background-color);
}

.loading-container.error {
    color: #f56c6c;
}

.spinner {
    border: 4px solid rgba(128, 128, 128, 0.2);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border-left-color: var(--primary-color);
    animation: spin 1s ease infinite;
    margin-bottom: 20px;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
</style>
