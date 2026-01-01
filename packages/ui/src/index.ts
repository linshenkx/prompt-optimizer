/*
 * Prompt Optimizer - AI提示词优化工具
 * Copyright (C) 2025 linshenkx
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// 纯Naive UI样式导入 - 移除theme.css依赖
import "./styles/index.css";
import "./styles/scrollbar.css";
import "./styles/common.css";
// 已移除: import './styles/theme.css' - 完全使用Naive UI主题系统

// 导出插件
export {
  installI18n,
  installI18nOnly,
  initializeI18nWithStorage,
  setI18nServices,
  i18n,
} from "./plugins/i18n";

export { pinia, installPinia, setPiniaServices } from "./plugins/pinia";

// 导出Naive UI配置
export {
  currentNaiveTheme as naiveTheme,
  currentThemeOverrides as themeOverrides,
  currentThemeId,
  currentThemeConfig,
  naiveThemeConfigs,
  switchTheme,
  initializeNaiveTheme,
} from "./config/naive-theme";

// 导出主题相关 Composables
export { useNaiveTheme } from "./composables/ui/useNaiveTheme";

/**
 * 组件导出
 * 注意：所有组件导出时都添加了UI后缀，以便与其他库的组件区分
 * 例如：Toast.vue 导出为 ToastUI
 */
// Components
export { default as ToastUI } from "./components/Toast.vue";
export { default as ModelManagerUI } from "./components/ModelManager.vue";
export { default as PromptPanelUI } from "./components/PromptPanel.vue";
export { default as OutputDisplay } from "./components/OutputDisplay.vue";
export { default as TemplateManagerUI } from "./components/TemplateManager.vue";
export { default as TemplateSelectUI } from "./components/TemplateSelect.vue";
export { default as SelectWithConfig } from "./components/SelectWithConfig.vue";
export { default as HistoryDrawerUI } from "./components/HistoryDrawer.vue";
export { default as InputPanelUI } from "./components/InputPanel.vue";
export { default as MainLayoutUI } from "./components/MainLayout.vue";
export { default as ContentCardUI } from "./components/ContentCard.vue";
export { default as ActionButtonUI } from "./components/ActionButton.vue";
export { default as ThemeToggleUI } from "./components/ThemeToggleUI.vue";
// TestPanel.vue - 已替换为TestAreaPanel
export { default as ModalUI } from "./components/Modal.vue";
export { default as PanelUI } from "./components/Panel.vue";

export { default as VariableManagerModal } from "./components/variable/VariableManagerModal.vue";
export { default as VariableEditor } from "./components/variable/VariableEditor.vue";
export { default as VariableImporter } from "./components/variable/VariableImporter.vue";
export { default as ToolManagerModal } from "./components/tool/ToolManagerModal.vue";
export { default as ConversationManager } from "./components/context-mode/ConversationManager.vue";
export { default as ContextEditor } from "./components/context-mode/ContextEditor.vue";
export { default as TestAreaPanel } from "./components/TestAreaPanel.vue";
export { default as TestInputSection } from "./components/TestInputSection.vue";
export { default as TestControlBar } from "./components/TestControlBar.vue";
export { default as TestResultSection } from "./components/TestResultSection.vue";
export { default as LanguageSwitchDropdown } from "./components/LanguageSwitchDropdown.vue";
export { default as BuiltinTemplateLanguageSwitchUi } from "./components/BuiltinTemplateLanguageSwitch.vue";
export { default as DataManagerUI } from "./components/DataManager.vue";
export { default as OptimizationModeSelectorUI } from "./components/OptimizationModeSelector.vue";
export { default as FunctionModeSelector } from "./components/FunctionModeSelector.vue";
export { default as TextDiffUI } from "./components/TextDiff.vue";
export { default as OutputDisplayFullscreen } from "./components/OutputDisplayFullscreen.vue";
export { default as OutputDisplayCore } from "./components/OutputDisplayCore.vue";
export { default as UpdaterIcon } from "./components/UpdaterIcon.vue";
export { default as UpdaterModal } from "./components/UpdaterModal.vue";
export { default as FullscreenDialog } from "./components/FullscreenDialog.vue";
export { default as InputWithSelect } from "./components/InputWithSelect.vue";
export { default as MarkdownRenderer } from "./components/MarkdownRenderer.vue";
export { default as ToolCallDisplay } from "./components/ToolCallDisplay.vue";
export { default as FavoriteManagerUI } from "./components/FavoriteManager.vue";
export { default as CategoryManagerUI } from "./components/CategoryManager.vue";
export { default as SaveFavoriteDialog } from "./components/SaveFavoriteDialog.vue";
export { default as ContextModeActions } from "./components/context-mode/ContextModeActions.vue";
export { default as PromptPreviewPanel } from "./components/PromptPreviewPanel.vue";
export { default as ContextSystemWorkspace } from "./components/context-mode/ContextSystemWorkspace.vue";
export { default as ContextUserWorkspace } from "./components/context-mode/ContextUserWorkspace.vue";
export { default as ContextUserTestPanel } from "./components/context-mode/ContextUserTestPanel.vue";
export { default as ConversationTestPanel } from "./components/context-mode/ConversationTestPanel.vue";
export { default as FunctionModelManagerUI } from "./components/FunctionModelManager.vue";

// 基础模式组件
export { BasicModeWorkspace } from "./components/basic-mode";

// App 布局组件
export { AppHeaderActions, AppCoreNav, PromptOptimizerApp } from "./components/app-layout";

// 评估组件
export { EvaluationPanel, EvaluateButton, EvaluationScoreBadge } from "./components/evaluation";

// 导出 Naive UI 组件 (解决组件解析问题)
export {
  NFlex,
  NButton,
  NCard,
  NInput,
  NSelect,
  NModal,
  NSpace,
  NTag,
  NText,
  NGrid,
  NGridItem,
  NIcon,
  NImage,
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NMessageProvider,
  NButtonGroup,
  NDropdown,
  NDivider,
  NDataTable,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadioButton,
  NScrollbar,
  NEmpty,
  NBadge,
  useMessage,
} from "naive-ui";

// 导出指令
export { clickOutside } from "./directives/clickOutside";

// 导出 composables
export * from "./composables";

// 从core重新导出需要的内容, 仅保留工厂函数、代理类和必要的工具/类型
export {
  StorageFactory,
  DexieStorageProvider,
  ModelManager,
  createModelManager,
  ElectronModelManagerProxy,
  TemplateManager,
  createTemplateManager,
  ElectronTemplateManagerProxy,
  createTemplateLanguageService,
  ElectronTemplateLanguageServiceProxy,
  HistoryManager,
  createHistoryManager,
  ElectronHistoryManagerProxy,
  DataManager,
  createDataManager,
  ElectronDataManagerProxy,
  createLLMService,
  ElectronLLMProxy,
  createPromptService,
  ElectronPromptServiceProxy,
  createPreferenceService,
  ElectronPreferenceServiceProxy,
  createCompareService,
  createContextRepo,
  ElectronContextRepoProxy,
  FavoriteManager,
  FavoriteManagerElectronProxy,
  isRunningInElectron,
  waitForElectronApi,
  // 评估服务
  EvaluationService,
  createEvaluationService,
  // 🆕 变量提取服务
  createVariableExtractionService,
  // 🆕 变量值生成服务
  createVariableValueGenerationService,
} from "@prompt-optimizer/core";

// 导出类型
export type {
  OptimizationMode,
  OptimizationRequest,
  ConversationMessage,
  CustomConversationRequest,
  IModelManager,
  ITemplateManager,
  IHistoryManager,
  ILLMService,
  IPromptService,
  IPreferenceService,
  ICompareService,
  ContextRepo,
  ContextPackage,
  ContextBundle,
  Template,
  IFavoriteManager,
  FavoritePrompt,
  FavoriteCategory,
  // 评估服务类型
  IEvaluationService,
  EvaluationType,
  EvaluationRequest,
  EvaluationResponse,
  EvaluationScore,
  EvaluationStreamHandlers,
  // 🆕 变量提取服务类型
  IVariableExtractionService,
  VariableExtractionRequest,
  VariableExtractionResponse,
  ExtractedVariable,
} from "@prompt-optimizer/core";

// 导出新增的类型和服务
export * from "./types";
export * from "./services";

// 导出图像模式组件与核心图像服务（转发 core 能力）
export { default as ImageWorkspace } from "./components/image-mode/ImageWorkspace.vue";
export { default as ImageModeSelector } from "./components/image-mode/ImageModeSelector.vue";
export {
  ImageModelManager,
  createImageModelManager,
  ImageService,
  createImageService,
} from "@prompt-optimizer/core";

// 导出数据转换工具和类型
export { DataTransformer, OptionAccessors } from "./utils/data-transformer";
export type {
  SelectOption,
  ModelSelectOption,
  TemplateSelectOption,
} from "./types/select-options";
