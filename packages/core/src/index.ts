// Core package entry point

// 导出模板相关
export { TemplateManager, templateManager } from './services/template/manager'
export { TemplateProcessor } from './services/template/processor'
export { TemplateLanguageService, templateLanguageService } from './services/template/languageService'
export type { BuiltinTemplateLanguage } from './services/template/languageService'
export * from './services/template/types'
export { StaticLoader } from './services/template/static-loader'
export * from './services/template/errors'

// 导出历史记录相关
export { HistoryManager, historyManager } from './services/history/manager'
export * from './services/history/types'
export * from './services/history/errors'

// 导出LLM服务相关
export { LLMService, createLLMService } from './services/llm/service'
export * from './services/llm/types'
export * from './services/llm/errors'

// 导出模型管理相关
export { ModelManager, modelManager } from './services/model/manager'
export * from './services/model/types'
export * from './services/model/defaults'
export * from './services/model/advancedParameterDefinitions'
export { 
  validateLLMParams, 
  getSupportedParameters
} from './services/model/validation'
export type { 
  ValidationResult,
  ValidationError as LLMValidationError,
  ValidationWarning 
} from './services/model/validation'

// 导出提示词服务相关
export { PromptService, createPromptService } from './services/prompt/service'
export * from './services/prompt/types'
export * from './services/prompt/errors'

// 导出对比服务相关
export { CompareService, compareService } from './services/compare'
export * from './services/compare/types'
export * from './services/compare/errors'

// 导出数据管理相关
export { DataManager, dataManager } from './services/data/manager'

// 导出存储相关
export { LocalStorageProvider } from './services/storage/localStorageProvider'
export { DexieStorageProvider } from './services/storage/dexieStorageProvider'
export { StorageFactory } from './services/storage/factory'
export * from './services/storage/types'

// 导出环境工具函数
export {
  isBrowser,
  isVercel,
  getProxyUrl,
  checkVercelApiAvailability,
  resetVercelStatusCache
} from './utils/environment';