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

// Core package entry point

// 导出模板相关
export { TemplateManager, createTemplateManager } from './services/template/manager'
export { TemplateProcessor } from './services/template/processor'
export { TemplateLanguageService, createTemplateLanguageService } from './services/template/languageService'
export type { BuiltinTemplateLanguage, ITemplateLanguageService } from './services/template/languageService'
export * from './services/template/types'
export { StaticLoader } from './services/template/static-loader'
export * from './services/template/errors'
export { ElectronTemplateManagerProxy } from './services/template/electron-proxy'
export { ElectronTemplateLanguageServiceProxy } from './services/template/electron-language-proxy'
export { ALL_TEMPLATES } from './services/template/default-templates'

// 导出历史记录相关
export { HistoryManager, createHistoryManager } from './services/history/manager'
export * from './services/history/types'
export * from './services/history/errors'
export { ElectronHistoryManagerProxy } from './services/history/electron-proxy'

// 导出LLM服务相关
export type {
  ILLMService,
  Message,
  StreamHandlers,
  LLMResponse,
  ModelInfo,
  ModelOption,
  ITextAdapterRegistry,
  ITextProviderAdapter,
  TextProvider,
  TextModel,
  TextModelConfig,
  ConnectionSchema
} from './services/llm/types'
export { LLMService, createLLMService } from './services/llm/service'
export { TextAdapterRegistry, createTextAdapterRegistry } from './services/llm/adapters/registry'
export { ElectronLLMProxy } from './services/llm/electron-proxy'
export * from './services/llm/errors'

// 导出模型管理相关
export { ModelManager, createModelManager } from './services/model/manager'
export * from './services/model/types'
export * from './services/model/defaults'
export * from './services/model/parameter-schema'
export * from './services/model/parameter-utils'
export * from './services/model/advancedParameterDefinitions'
export { ElectronModelManagerProxy } from './services/model/electron-proxy'
export { ElectronConfigManager, isElectronRenderer } from './services/model/electron-config'

// 导出图像模型管理与服务
export { ImageModelManager, createImageModelManager } from './services/image-model/manager'
export { ImageService, createImageService } from './services/image/service'
export { ImageAdapterRegistry as _ImageAdapterRegistry, createImageAdapterRegistry } from './services/image/adapters/registry'
export { ElectronImageServiceProxy, ElectronImageModelManagerProxy } from './services/image/electron-proxy'
// 导出图像服务类型,将 ConnectionSchema 重命名为 ImageConnectionSchema 避免与 model/types 中的 ConnectionSchema 冲突
export type {
  ImageProvider,
  ImageModel,
  ImageRequest,
  ImageResult,
  ImageProgressHandlers,
  ImageModelConfig,
  IImageModelManager,
  IImageProviderAdapter,
  IImageAdapterRegistry,
  IImageService,
  ConnectionSchema as ImageConnectionSchema,
  ImageParameterDefinition
} from './services/image/types'

// 导出存储相关
export * from './services/storage/types'
export { StorageFactory } from './services/storage/factory'
export { DexieStorageProvider } from './services/storage/dexieStorageProvider'
export { LocalStorageProvider } from './services/storage/localStorageProvider'
export { MemoryStorageProvider } from './services/storage/memoryStorageProvider'
export { FileStorageProvider } from './services/storage/fileStorageProvider'

// 导出提示词服务相关
export { PromptService } from './services/prompt/service'
export { createPromptService } from './services/prompt/factory'
export * from './services/prompt/types'
export { ElectronPromptServiceProxy } from './services/prompt/electron-proxy'
export * from './services/prompt/errors'

// 导出对比服务相关
export { CompareService, createCompareService } from './services/compare/service'
export type { ICompareService } from './services/compare/types'
export * from './services/compare/types'
export * from './services/compare/errors'

// 导出数据管理相关
export { DataManager, createDataManager } from './services/data/manager'
export type { IDataManager } from './services/data/manager'
export { ElectronDataManagerProxy } from './services/data/electron-proxy'

// 导出偏好设置服务相关
export * from './services/preference/types'
export { ElectronPreferenceServiceProxy } from './services/preference/electron-proxy'
export { PreferenceService, createPreferenceService } from './services/preference/service'

// 导出环境检测工具
export {
  isRunningInElectron,
  isElectronApiReady,
  waitForElectronApi,
  isBrowser,
  isDevelopment,
  getEnvVar,
  scanCustomModelEnvVars,
  clearCustomModelEnvCache,
  CUSTOM_API_PATTERN,
  SUFFIX_PATTERN,
  MAX_SUFFIX_LENGTH
} from './utils/environment'
export type { CustomModelEnvConfig, ValidatedCustomModelEnvConfig, ValidationResult } from './utils/environment'
export type { LLMValidationResult, ValidationError, ValidationWarning } from './services/model/validation'
export { validateCustomModelConfig } from './utils/environment'

// 导出IPC序列化工具
export { safeSerializeForIPC, debugIPCSerializability, safeSerializeArgs } from './utils/ipc-serialization'

// 导出存储键常量
export {
  CORE_SERVICE_KEYS,
  UI_SETTINGS_KEYS,
  MODEL_SELECTION_KEYS,
  TEMPLATE_SELECTION_KEYS,
  IMAGE_MODE_KEYS,
  FUNCTION_MODEL_KEYS,
  getModeModelKey,
  ALL_STORAGE_KEYS,
  ALL_STORAGE_KEYS_ARRAY
} from './constants/storage-keys'
export type {
  CoreServiceKey,
  UISettingsKey,
  ModelSelectionKey,
  TemplateSelectionKey,
  ImageModeKey,
  FunctionModelKey,
  StorageKey
} from './constants/storage-keys'

// 导出上下文相关
export * from './services/context/types'
export { createContextRepo } from './services/context/repo'
export { ElectronContextRepoProxy } from './services/context/electron-proxy'
export * from './services/context/constants'

// 导出收藏管理相关
export { FavoriteManager } from './services/favorite/manager'
export { FavoriteManagerElectronProxy } from './services/favorite/electron-proxy'
export { TagTypeConverter } from './services/favorite/type-converter'
export * from './services/favorite/types'
export * from './services/favorite/errors'

// 导出高级模块相关类型
export * from './types/advanced'

// 导出评估服务相关
export * from './services/evaluation/types'
export * from './services/evaluation/errors'
export { EvaluationService, createEvaluationService } from './services/evaluation/service'
