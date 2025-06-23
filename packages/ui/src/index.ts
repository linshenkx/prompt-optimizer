﻿// 导入样式
import 'element-plus/dist/index.css'
import './styles/index.css'
import './styles/scrollbar.css'
import './styles/common.css'
import './styles/theme.css'

// 导出插件
export { installI18n, i18n } from './plugins/i18n'

/**
 * 组件导出
 * 注意：所有组件导出时都添加了UI后缀，以便与其他库的组件区分
 * 例如：Toast.vue 导出为 ToastUI
 */
// Components
export { default as ToastUI } from './components/Toast.vue'
export { default as ModelManagerUI } from './components/ModelManager.vue'
export { default as OutputPanelUI } from './components/OutputPanel.vue'
export { default as PromptPanelUI } from './components/PromptPanel.vue'
export { default as TemplateManagerUI } from './components/TemplateManager.vue'
export { default as TemplateSelectUI } from './components/TemplateSelect.vue'
export { default as ModelSelectUI } from './components/ModelSelect.vue'
export { default as HistoryDrawerUI } from './components/HistoryDrawer.vue'
export { default as InputPanelUI } from './components/InputPanel.vue'
export { default as MainLayoutUI } from './components/MainLayout.vue'
export { default as ContentCardUI } from './components/ContentCard.vue'
export { default as ActionButtonUI } from './components/ActionButton.vue'
export { default as ThemeToggleUI } from './components/ThemeToggleUI.vue'
export { default as TestPanelUI } from './components/TestPanel.vue'
export { default as LanguageSwitchUI } from './components/LanguageSwitch.vue'
export { default as BuiltinTemplateLanguageSwitchUi } from './components/BuiltinTemplateLanguageSwitch.vue'
export { default as DataManagerUI } from './components/DataManager.vue'
export { default as OptimizationModeSelectorUI } from './components/OptimizationModeSelector.vue'
export { default as OptimizePanelUI } from './components/OptimizePanel.vue'
export { default as TextDiffUI } from './components/TextDiff.vue'

// 导出指令
export { clickOutside } from './directives/clickOutside'

// 导出 composables
export * from './composables'

// 从core重新导出需要的内容
export {
    templateManager,
    modelManager,
    historyManager,
    dataManager,
    createLLMService,
    createPromptService
} from '@prompt-optimizer/core'

// 导出类型
export type { OptimizationMode } from '@prompt-optimizer/core'
